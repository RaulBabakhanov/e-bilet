import { Router } from 'express';
import db from '../db.js';
import { authRequired } from '../middleware/auth.js';

const router = Router();
const HOLD_MINUTES = Number(process.env.HOLD_MINUTES || 10);

export function releaseExpiredHolds(eventId) {
  const expired = db.prepare(`
    SELECT id FROM seats
    WHERE status = 'held' AND hold_expires IS NOT NULL AND hold_expires < datetime('now')
    ${eventId ? 'AND event_id = ?' : ''}
  `).all(...(eventId ? [eventId] : []));

  if (expired.length) {
    const ids = expired.map((s) => s.id);
    db.prepare(`
      UPDATE seats SET status = 'available', held_by = NULL, hold_expires = NULL
      WHERE id IN (${ids.map(() => '?').join(',')})
    `).run(...ids);
  }
  return expired.map((s) => s.id);
}

router.get('/event/:eventId', (req, res) => {
  const eventId = Number(req.params.eventId);
  const released = releaseExpiredHolds(eventId);
  const seats = db.prepare(`
    SELECT id, event_id, row_label, seat_number, section, price, status, held_by, hold_expires
    FROM seats WHERE event_id = ?
    ORDER BY row_label, seat_number
  `).all(eventId);

  const sections = [...new Set(seats.map((s) => s.section))];
  res.json({ seats, sections, released });
});

router.post('/hold', authRequired, (req, res) => {
  const { eventId, seatIds } = req.body;
  if (!eventId || !Array.isArray(seatIds) || !seatIds.length) {
    return res.status(400).json({ error: 'Etkinlik ve koltuk seçimi gerekli' });
  }

  releaseExpiredHolds(eventId);
  const holdExpires = new Date(Date.now() + HOLD_MINUTES * 60 * 1000).toISOString();

  const getSeat = db.prepare('SELECT * FROM seats WHERE id = ? AND event_id = ?');
  const holdSeat = db.prepare(`
    UPDATE seats SET status = 'held', held_by = ?, hold_expires = ?
    WHERE id = ? AND (status = 'available' OR (status = 'held' AND held_by = ?))
  `);

  const held = [];
  const failed = [];

  const tx = db.transaction(() => {
    for (const seatId of seatIds) {
      const seat = getSeat.get(seatId, eventId);
      if (!seat) {
        failed.push(seatId);
        continue;
      }
      if (seat.status === 'sold') {
        failed.push(seatId);
        continue;
      }
      if (seat.status === 'held' && seat.held_by !== req.user.id) {
        failed.push(seatId);
        continue;
      }
      const result = holdSeat.run(req.user.id, holdExpires, seatId, req.user.id);
      if (result.changes) held.push(seatId);
      else failed.push(seatId);
    }
  });

  try {
    tx();
  } catch (e) {
    return res.status(500).json({ error: 'Rezervasyon başarısız' });
  }

  if (!held.length) {
    return res.status(409).json({ error: 'Seçilen koltuklar müsait değil', failed });
  }

  const seats = db.prepare(`
    SELECT id, event_id, row_label, seat_number, section, price, status, held_by, hold_expires
    FROM seats WHERE event_id = ? ORDER BY row_label, seat_number
  `).all(eventId);

  const io = req.app.get('io');
  io?.to(`event:${eventId}`).emit('seats:update', { eventId, seats, changed: held, action: 'held' });

  res.json({ held, failed, holdExpires, seats });
});

router.post('/release', authRequired, (req, res) => {
  const { eventId, seatIds } = req.body;
  if (!eventId) return res.status(400).json({ error: 'Etkinlik gerekli' });

  let released = [];
  if (Array.isArray(seatIds) && seatIds.length) {
    db.prepare(`
      UPDATE seats SET status = 'available', held_by = NULL, hold_expires = NULL
      WHERE event_id = ? AND held_by = ? AND status = 'held'
      AND id IN (${seatIds.map(() => '?').join(',')})
    `).run(eventId, req.user.id, ...seatIds);
    released = seatIds;
  } else {
    const rows = db.prepare(`
      SELECT id FROM seats WHERE event_id = ? AND held_by = ? AND status = 'held'
    `).all(eventId, req.user.id);
    released = rows.map((r) => r.id);
    if (released.length) {
      db.prepare(`
        UPDATE seats SET status = 'available', held_by = NULL, hold_expires = NULL
        WHERE event_id = ? AND held_by = ? AND status = 'held'
      `).run(eventId, req.user.id);
    }
  }

  const seats = db.prepare(`
    SELECT id, event_id, row_label, seat_number, section, price, status, held_by, hold_expires
    FROM seats WHERE event_id = ? ORDER BY row_label, seat_number
  `).all(eventId);

  const io = req.app.get('io');
  io?.to(`event:${eventId}`).emit('seats:update', { eventId, seats, changed: released, action: 'released' });

  res.json({ released, seats });
});

export default router;
