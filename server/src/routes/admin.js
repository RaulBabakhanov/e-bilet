import { Router } from 'express';
import db from '../db.js';
import { adminRequired } from '../middleware/auth.js';

const router = Router();
router.use(adminRequired);

router.get('/stats', (req, res) => {
  const totals = db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM events WHERE status = 'active') AS active_events,
      (SELECT COUNT(*) FROM tickets WHERE status = 'valid') AS sold_tickets,
      (SELECT COALESCE(SUM(total_amount), 0) FROM orders WHERE payment_status = 'paid') AS revenue,
      (SELECT COUNT(*) FROM users WHERE role = 'user') AS users,
      (SELECT COUNT(*) FROM orders WHERE payment_status = 'paid') AS paid_orders
  `).get();

  const byEvent = db.prepare(`
    SELECT e.id, e.title, e.event_date,
      COUNT(t.id) AS tickets_sold,
      COALESCE(SUM(s.price), 0) AS revenue
    FROM events e
    LEFT JOIN tickets t ON t.event_id = e.id AND t.status = 'valid'
    LEFT JOIN seats s ON s.id = t.seat_id
    GROUP BY e.id
    ORDER BY tickets_sold DESC
  `).all();

  const recentOrders = db.prepare(`
    SELECT o.*, u.full_name, u.email, u.phone, e.title AS event_title, e.event_date, e.event_time
    FROM orders o
    JOIN users u ON u.id = o.user_id
    JOIN events e ON e.id = o.event_id
    WHERE o.payment_status = 'paid'
    ORDER BY o.created_at DESC
    LIMIT 100
  `).all();

  const orderTickets = db.prepare(`
    SELECT t.order_id, t.ticket_code, t.status,
      s.row_label, s.seat_number, s.section, s.price
    FROM tickets t
    JOIN seats s ON s.id = t.seat_id
    WHERE t.order_id IN (${recentOrders.length ? recentOrders.map(() => '?').join(',') : 'NULL'})
    ORDER BY s.row_label, s.seat_number
  `).all(...recentOrders.map((o) => o.id));

  const ticketsByOrder = {};
  for (const t of orderTickets) {
    if (!ticketsByOrder[t.order_id]) ticketsByOrder[t.order_id] = [];
    ticketsByOrder[t.order_id].push(t);
  }

  const sales = recentOrders.map((o) => ({
    ...o,
    tickets: ticketsByOrder[o.id] || [],
    seat_labels: (ticketsByOrder[o.id] || []).map((t) => `${t.row_label}${t.seat_number}`).join(', '),
  }));

  const byCustomer = db.prepare(`
    SELECT u.id, u.full_name, u.email, u.phone,
      COUNT(DISTINCT o.id) AS order_count,
      COUNT(t.id) AS ticket_count,
      COALESCE(SUM(CASE WHEN t.status = 'valid' THEN s.price ELSE 0 END), 0) AS total_spent
    FROM users u
    JOIN orders o ON o.user_id = u.id AND o.payment_status = 'paid'
    LEFT JOIN tickets t ON t.order_id = o.id
    LEFT JOIN seats s ON s.id = t.seat_id
    WHERE u.role = 'user'
    GROUP BY u.id
    ORDER BY total_spent DESC
  `).all();

  res.json({ totals, byEvent, recentOrders: sales, byCustomer });
});

router.get('/venues', (req, res) => {
  res.json({ venues: db.prepare('SELECT * FROM venues ORDER BY name').all() });
});

router.post('/venues', (req, res) => {
  const { name, address, city, capacity } = req.body;
  if (!name) return res.status(400).json({ error: 'Salon adı gerekli' });
  const result = db.prepare(
    'INSERT INTO venues (name, address, city, capacity) VALUES (?, ?, ?, ?)'
  ).run(name, address || null, city || null, capacity || 0);
  res.status(201).json({ venue: db.prepare('SELECT * FROM venues WHERE id = ?').get(result.lastInsertRowid) });
});

router.get('/events', (req, res) => {
  const events = db.prepare(`
    SELECT e.*, v.name AS venue_name,
      (SELECT COUNT(*) FROM seats s WHERE s.event_id = e.id AND s.status = 'sold') AS sold,
      (SELECT COUNT(*) FROM seats s WHERE s.event_id = e.id) AS total_seats
    FROM events e
    JOIN venues v ON v.id = e.venue_id
    ORDER BY e.event_date DESC
  `).all();
  res.json({ events });
});

router.post('/events', (req, res) => {
  const { venue_id, title, description, category, image_url, event_date, event_time, base_price, rows, seatsPerRow, sections } = req.body;
  if (!venue_id || !title || !event_date || !event_time) {
    return res.status(400).json({ error: 'Zorunlu alanlar eksik' });
  }

  const tx = db.transaction(() => {
    const result = db.prepare(`
      INSERT INTO events (venue_id, title, description, category, image_url, event_date, event_time, base_price)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      venue_id,
      title,
      description || '',
      category || 'etkinlik',
      image_url || '',
      event_date,
      event_time,
      base_price || 0
    );
    const eventId = result.lastInsertRowid;

    const rowCount = Number(rows) || 8;
    const perRow = Number(seatsPerRow) || 12;
    const sectionPlan = sections || [
      { name: 'vip', rows: ['A', 'B'], multiplier: 1.8 },
      { name: 'standart', rows: null, multiplier: 1 },
    ];

    const insertSeat = db.prepare(`
      INSERT INTO seats (event_id, row_label, seat_number, section, price, status)
      VALUES (?, ?, ?, ?, ?, 'available')
    `);

    const labels = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.slice(0, rowCount).split('');
    for (const row of labels) {
      let section = 'standart';
      let multiplier = 1;
      for (const plan of sectionPlan) {
        if (plan.rows?.includes(row)) {
          section = plan.name;
          multiplier = plan.multiplier;
          break;
        }
      }
      // Engelli koltuk: her sıranın 1. koltuğu
      for (let n = 1; n <= perRow; n++) {
        let seatSection = section;
        if (n === 1 && row === labels[labels.length - 1]) seatSection = 'engelli';
        const price = Math.round((base_price || 100) * (seatSection === 'engelli' ? 0.7 : multiplier));
        insertSeat.run(eventId, row, n, seatSection, price);
      }
    }

    db.prepare('UPDATE venues SET capacity = ? WHERE id = ?').run(rowCount * perRow, venue_id);
    return eventId;
  });

  const eventId = tx();
  const event = db.prepare(`
    SELECT e.*, v.name AS venue_name FROM events e
    JOIN venues v ON v.id = e.venue_id WHERE e.id = ?
  `).get(eventId);
  res.status(201).json({ event });
});

router.patch('/events/:id', (req, res) => {
  const { title, description, status, base_price, image_url, event_date, event_time } = req.body;
  db.prepare(`
    UPDATE events SET
      title = COALESCE(?, title),
      description = COALESCE(?, description),
      status = COALESCE(?, status),
      base_price = COALESCE(?, base_price),
      image_url = COALESCE(?, image_url),
      event_date = COALESCE(?, event_date),
      event_time = COALESCE(?, event_time)
    WHERE id = ?
  `).run(
    title ?? null,
    description ?? null,
    status ?? null,
    base_price ?? null,
    image_url ?? null,
    event_date ?? null,
    event_time ?? null,
    req.params.id
  );
  res.json({ event: db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id) });
});

router.get('/events/:id/seats', (req, res) => {
  const event = db.prepare(`
    SELECT e.*, v.name AS venue_name FROM events e
    JOIN venues v ON v.id = e.venue_id WHERE e.id = ?
  `).get(req.params.id);
  if (!event) return res.status(404).json({ error: 'Etkinlik bulunamadı' });
  const seats = db.prepare(`
    SELECT id, event_id, row_label, seat_number, section, price, status, held_by, hold_expires
    FROM seats WHERE event_id = ?
    ORDER BY row_label, seat_number
  `).all(req.params.id);
  res.json({ event, seats });
});

router.patch('/seats/:id', (req, res) => {
  const seat = db.prepare('SELECT * FROM seats WHERE id = ?').get(req.params.id);
  if (!seat) return res.status(404).json({ error: 'Koltuk bulunamadı' });

  const { section, price, status } = req.body;
  let nextStatus = seat.status;

  if (status === 'available') {
    if (seat.status === 'sold') {
      return res.status(400).json({ error: 'Satılmış koltuk için önce bileti iptal edin' });
    }
    nextStatus = 'available';
  } else if (status === 'blocked') {
    if (seat.status === 'sold') {
      return res.status(400).json({ error: 'Satılmış koltuk engellenemez' });
    }
    nextStatus = 'blocked';
  }

  db.prepare(`
    UPDATE seats SET
      section = COALESCE(?, section),
      price = COALESCE(?, price),
      status = ?,
      held_by = CASE WHEN ? IN ('available', 'blocked') THEN NULL ELSE held_by END,
      hold_expires = CASE WHEN ? IN ('available', 'blocked') THEN NULL ELSE hold_expires END
    WHERE id = ?
  `).run(
    section ?? null,
    price != null ? Number(price) : null,
    nextStatus,
    nextStatus,
    nextStatus,
    seat.id
  );

  const seats = db.prepare(`
    SELECT id, event_id, row_label, seat_number, section, price, status, held_by, hold_expires
    FROM seats WHERE event_id = ? ORDER BY row_label, seat_number
  `).all(seat.event_id);

  const io = req.app.get('io');
  io?.to(`event:${seat.event_id}`).emit('seats:update', {
    eventId: seat.event_id,
    seats,
    changed: [seat.id],
    action: 'admin',
  });

  res.json({ seat: seats.find((s) => s.id === seat.id), seats });
});

router.post('/seats/bulk', (req, res) => {
  const { eventId, seatIds, section, price, status } = req.body;
  if (!eventId || !Array.isArray(seatIds) || !seatIds.length) {
    return res.status(400).json({ error: 'Etkinlik ve koltuklar gerekli' });
  }

  const getSeat = db.prepare('SELECT * FROM seats WHERE id = ? AND event_id = ?');
  const update = db.prepare(`
    UPDATE seats SET
      section = COALESCE(?, section),
      price = COALESCE(?, price),
      status = COALESCE(?, status),
      held_by = CASE WHEN ? IN ('available', 'blocked') THEN NULL ELSE held_by END,
      hold_expires = CASE WHEN ? IN ('available', 'blocked') THEN NULL ELSE hold_expires END
    WHERE id = ? AND status != 'sold'
  `);

  const tx = db.transaction(() => {
    let updated = 0;
    for (const id of seatIds) {
      const seat = getSeat.get(id, eventId);
      if (!seat || seat.status === 'sold') continue;
      let next = status || seat.status;
      if (status === 'blocked' || status === 'available') next = status;
      const result = update.run(
        section ?? null,
        price != null ? Number(price) : null,
        next,
        next,
        next,
        id
      );
      updated += result.changes;
    }
    return updated;
  });

  const updated = tx();
  const seats = db.prepare(`
    SELECT id, event_id, row_label, seat_number, section, price, status, held_by, hold_expires
    FROM seats WHERE event_id = ? ORDER BY row_label, seat_number
  `).all(eventId);

  const io = req.app.get('io');
  io?.to(`event:${eventId}`).emit('seats:update', {
    eventId,
    seats,
    changed: seatIds,
    action: 'admin',
  });

  res.json({ updated, seats });
});

router.get('/tickets', (req, res) => {
  const tickets = db.prepare(`
    SELECT t.*, e.title AS event_title, u.full_name, u.email,
      s.row_label, s.seat_number, s.price
    FROM tickets t
    JOIN events e ON e.id = t.event_id
    JOIN users u ON u.id = t.user_id
    JOIN seats s ON s.id = t.seat_id
    ORDER BY t.created_at DESC
    LIMIT 200
  `).all();
  res.json({ tickets });
});

router.post('/tickets/:id/cancel', (req, res) => {
  const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(req.params.id);
  if (!ticket) return res.status(404).json({ error: 'Bilet bulunamadı' });
  if (ticket.status === 'cancelled') return res.status(400).json({ error: 'Zaten iptal' });

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

  res.json({ message: 'Bilet iptal edildi, koltuk açıldı' });
});

export default router;
