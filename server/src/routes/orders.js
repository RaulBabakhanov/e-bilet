import { Router } from 'express';
import { customAlphabet } from 'nanoid';
import QRCode from 'qrcode';
import db from '../db.js';
import { authRequired } from '../middleware/auth.js';
import { releaseExpiredHolds } from './seats.js';

const router = Router();
const ticketCode = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 12);

router.post('/checkout', authRequired, async (req, res) => {
  const { eventId, seatIds, paymentMethod = 'demo' } = req.body;
  if (!eventId || !Array.isArray(seatIds) || !seatIds.length) {
    return res.status(400).json({ error: 'Etkinlik ve koltuk seçimi gerekli' });
  }

  releaseExpiredHolds(eventId);

  const seats = db.prepare(`
    SELECT * FROM seats WHERE event_id = ? AND id IN (${seatIds.map(() => '?').join(',')})
  `).all(eventId, ...seatIds);

  if (seats.length !== seatIds.length) {
    return res.status(400).json({ error: 'Geçersiz koltuk seçimi' });
  }

  for (const seat of seats) {
    if (seat.status === 'sold') {
      return res.status(409).json({ error: `${seat.row_label}${seat.seat_number} satılmış` });
    }
    if (seat.status === 'held' && seat.held_by !== req.user.id) {
      return res.status(409).json({ error: `${seat.row_label}${seat.seat_number} başka kullanıcıda` });
    }
    if (seat.status === 'available') {
      return res.status(400).json({ error: 'Önce koltukları rezerve edin' });
    }
  }

  const total = seats.reduce((sum, s) => sum + s.price, 0);
  const paymentRef = `PAY-${Date.now()}-${req.user.id}`;

  // Demo ödeme: her zaman başarılı (Stripe/İyzico entegrasyonu için hazır)
  const paymentOk = paymentMethod === 'demo' || paymentMethod === 'stripe' || paymentMethod === 'iyzico';
  if (!paymentOk) return res.status(400).json({ error: 'Geçersiz ödeme yöntemi' });

  try {
    const result = db.transaction(() => {
      const orderResult = db.prepare(`
        INSERT INTO orders (user_id, event_id, total_amount, payment_status, payment_ref)
        VALUES (?, ?, ?, 'paid', ?)
      `).run(req.user.id, eventId, total, paymentRef);

      const orderId = orderResult.lastInsertRowid;
      const tickets = [];

      for (const seat of seats) {
        const update = db.prepare(`
          UPDATE seats SET status = 'sold', held_by = NULL, hold_expires = NULL
          WHERE id = ? AND status = 'held' AND held_by = ?
        `).run(seat.id, req.user.id);

        if (!update.changes) {
          throw new Error(`Koltuk ${seat.row_label}${seat.seat_number} satılamadı`);
        }

        const code = ticketCode();
        const payload = JSON.stringify({
          ticket: code,
          eventId,
          seat: `${seat.row_label}${seat.seat_number}`,
          userId: req.user.id,
        });

        const ticketResult = db.prepare(`
          INSERT INTO tickets (order_id, user_id, event_id, seat_id, ticket_code, qr_data, status)
          VALUES (?, ?, ?, ?, ?, ?, 'valid')
        `).run(orderId, req.user.id, eventId, seat.id, code, payload);

        tickets.push({
          id: ticketResult.lastInsertRowid,
          ticket_code: code,
          seat_id: seat.id,
          row_label: seat.row_label,
          seat_number: seat.seat_number,
          section: seat.section,
          price: seat.price,
        });
      }

      return { orderId, tickets, total, paymentRef };
    })();

    // QR kodları oluştur
    for (const t of result.tickets) {
      const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(t.id);
      const qr = await QRCode.toDataURL(ticket.qr_data, { width: 280, margin: 1 });
      db.prepare('UPDATE tickets SET qr_data = ? WHERE id = ?').run(qr, t.id);
      t.qr_data = qr;
    }

    const allSeats = db.prepare(`
      SELECT id, event_id, row_label, seat_number, section, price, status, held_by, hold_expires
      FROM seats WHERE event_id = ? ORDER BY row_label, seat_number
    `).all(eventId);

    const io = req.app.get('io');
    io?.to(`event:${eventId}`).emit('seats:update', {
      eventId,
      seats: allSeats,
      changed: seatIds,
      action: 'sold',
    });

    const event = db.prepare(`
      SELECT e.*, v.name AS venue_name FROM events e
      JOIN venues v ON v.id = e.venue_id WHERE e.id = ?
    `).get(eventId);

    res.status(201).json({
      order: {
        id: result.orderId,
        total_amount: result.total,
        payment_ref: result.paymentRef,
        payment_status: 'paid',
      },
      tickets: result.tickets,
      event,
    });
  } catch (err) {
    res.status(409).json({ error: err.message || 'Ödeme tamamlanamadı' });
  }
});

router.get('/mine', authRequired, (req, res) => {
  const orders = db.prepare(`
    SELECT o.*, e.title AS event_title, e.event_date, e.event_time, e.image_url,
      v.name AS venue_name
    FROM orders o
    JOIN events e ON e.id = o.event_id
    JOIN venues v ON v.id = e.venue_id
    WHERE o.user_id = ?
    ORDER BY o.created_at DESC
  `).all(req.user.id);
  res.json({ orders });
});

export default router;
