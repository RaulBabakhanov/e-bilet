import { Router } from 'express';
import db from '../db.js';

const router = Router();

router.get('/', (req, res) => {
  const { category, q } = req.query;
  let sql = `
    SELECT e.*, v.name AS venue_name, v.city AS venue_city, v.address AS venue_address,
      (SELECT COUNT(*) FROM seats s WHERE s.event_id = e.id AND s.status = 'available') AS available_seats,
      (SELECT COUNT(*) FROM seats s WHERE s.event_id = e.id) AS total_seats
    FROM events e
    JOIN venues v ON v.id = e.venue_id
    WHERE e.status = 'active'
  `;
  const params = [];
  if (category && category !== 'all') {
    sql += ' AND e.category = ?';
    params.push(category);
  }
  if (q) {
    sql += ' AND (e.title LIKE ? OR e.description LIKE ? OR v.city LIKE ?)';
    const like = `%${q}%`;
    params.push(like, like, like);
  }
  sql += ' ORDER BY e.event_date ASC, e.event_time ASC';
  res.json({ events: db.prepare(sql).all(...params) });
});

router.get('/:id', (req, res) => {
  const event = db.prepare(`
    SELECT e.*, v.name AS venue_name, v.city AS venue_city, v.address AS venue_address, v.capacity
    FROM events e
    JOIN venues v ON v.id = e.venue_id
    WHERE e.id = ?
  `).get(req.params.id);
  if (!event) return res.status(404).json({ error: 'Etkinlik bulunamadı' });
  res.json({ event });
});

export default router;
