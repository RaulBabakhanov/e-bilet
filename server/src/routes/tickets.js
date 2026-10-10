import { Router } from 'express';
import db from '../db.js';
import { authRequired, adminRequired } from '../middleware/auth.js';
import { sendTicketEmail } from '../mail.js';

const router = Router();

router.get('/mine', authRequired, (req, res) => {
  const tickets = db.prepare(`
    SELECT t.*, e.title AS event_title, e.event_date, e.event_time, e.category, e.image_url,
      v.name AS venue_name, v.address AS venue_address, v.city AS venue_city,
      s.row_label, s.seat_number, s.section, s.price,
      u.full_name AS buyer_name, u.email AS buyer_email
    FROM tickets t
    JOIN events e ON e.id = t.event_id
    JOIN venues v ON v.id = e.venue_id
    JOIN seats s ON s.id = t.seat_id
    JOIN users u ON u.id = t.user_id
    WHERE t.user_id = ?
    ORDER BY e.event_date ASC, t.created_at DESC
  `).all(req.user.id);
  res.json({ tickets });
});

router.get('/:id', authRequired, (req, res) => {
  const ticket = db.prepare(`
    SELECT t.*, e.title AS event_title, e.event_date, e.event_time, e.category, e.image_url,
      v.name AS venue_name, v.address AS venue_address, v.city AS venue_city,
      s.row_label, s.seat_number, s.section, s.price,
      u.full_name AS buyer_name, u.email AS buyer_email
    FROM tickets t
    JOIN events e ON e.id = t.event_id
    JOIN venues v ON v.id = e.venue_id
    JOIN seats s ON s.id = t.seat_id
    JOIN users u ON u.id = t.user_id
    WHERE t.id = ?
  `).get(req.params.id);

  if (!ticket) return res.status(404).json({ error: 'Bilet bulunamadı' });
  if (ticket.user_id !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Bu bilete erişim yok' });
  }
  res.json({ ticket });
});

router.post('/:id/email', authRequired, async (req, res) => {
  const ticket = db.prepare(`
    SELECT t.*, e.title AS event_title, e.event_date, e.event_time,
      v.name AS venue_name, s.row_label, s.seat_number, s.section, s.price,
      u.full_name AS buyer_name, u.email AS buyer_email
    FROM tickets t
    JOIN events e ON e.id = t.event_id
    JOIN venues v ON v.id = e.venue_id
    JOIN seats s ON s.id = t.seat_id
    JOIN users u ON u.id = t.user_id
    WHERE t.id = ?
  `).get(req.params.id);

  if (!ticket) return res.status(404).json({ error: 'Bilet bulunamadı' });
  if (ticket.user_id !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Bu bilete erişim yok' });
  }

  try {
    const result = await sendTicketEmail(ticket, req.body.email);
    res.json(result);
  } catch (err) {
    console.error('E-posta hatası:', err);
    res.status(500).json({ error: 'E-posta gönderilemedi: ' + (err.message || 'bilinmeyen hata') });
  }
});

router.post('/:id/cancel', authRequired, (req, res) => {
  const ticket = db.prepare(`
    SELECT t.*, e.event_date, e.event_time
    FROM tickets t
    JOIN events e ON e.id = t.event_id
    WHERE t.id = ?
  `).get(req.params.id);

  if (!ticket) return res.status(404).json({ error: 'Bilet bulunamadı' });
  if (ticket.user_id !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Bu bileti iptal edemezsiniz' });
  }
  if (ticket.status !== 'valid') {
    return res.status(400).json({ error: 'Bilet zaten iptal' });
  }
  if (ticket.checked_in) {
    return res.status(400).json({ error: 'Kullanılmış bilet iptal edilemez' });
  }

  const eventStart = new Date(`${ticket.event_date}T${ticket.event_time || '00:00'}`);
  if (!Number.isNaN(eventStart.getTime()) && eventStart.getTime() < Date.now()) {
    return res.status(400).json({ error: 'Etkinlik başladıktan sonra iptal edilemez' });
  }

  const tx = db.transaction(() => {
    db.prepare("UPDATE tickets SET status = 'cancelled' WHERE id = ?").run(ticket.id);
    db.prepare(`
      UPDATE seats SET status = 'available', held_by = NULL, hold_expires = NULL WHERE id = ?
    `).run(ticket.seat_id);
  });
  tx();

  const seats = db.prepare(`
    SELECT id, event_id, row_label, seat_number, section, price, status, held_by, hold_expires
    FROM seats WHERE event_id = ? ORDER BY row_label, seat_number
  `).all(ticket.event_id);

  const io = req.app.get('io');
  io?.to(`event:${ticket.event_id}`).emit('seats:update', {
    eventId: ticket.event_id,
    seats,
    changed: [ticket.seat_id],
    action: 'released',
  });

  res.json({ message: 'Bilet iptal edildi, koltuk tekrar satışa açıldı', refund: true });
});

router.post('/verify', adminRequired, (req, res) => {
  const { ticket_code } = req.body;
  if (!ticket_code) return res.status(400).json({ error: 'Bilet numarası gerekli' });

  const ticket = db.prepare(`
    SELECT t.*, e.title AS event_title, e.event_date, e.event_time,
      s.row_label, s.seat_number, u.full_name AS buyer_name
    FROM tickets t
    JOIN events e ON e.id = t.event_id
    JOIN seats s ON s.id = t.seat_id
    JOIN users u ON u.id = t.user_id
    WHERE t.ticket_code = ?
  `).get(ticket_code.toUpperCase());

  if (!ticket) return res.status(404).json({ error: 'Bilet bulunamadı', valid: false });
  if (ticket.status !== 'valid') return res.json({ valid: false, ticket, message: 'Bilet geçersiz veya iptal' });
  if (ticket.checked_in) return res.json({ valid: false, ticket, message: 'Bilet daha önce kullanılmış' });

  db.prepare('UPDATE tickets SET checked_in = 1 WHERE id = ?').run(ticket.id);
  res.json({ valid: true, ticket, message: 'Giriş onaylandı' });
});

export default router;
