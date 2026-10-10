import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import db from '../db.js';
import { authRequired, signToken } from '../middleware/auth.js';

const router = Router();

router.post('/register', (req, res) => {
  const { email, password, full_name, phone } = req.body;
  if (!email || !password || !full_name) {
    return res.status(400).json({ error: 'E-posta, şifre ve ad soyad zorunlu' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Şifre en az 6 karakter olmalı' });
  }
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
  if (existing) return res.status(409).json({ error: 'Bu e-posta zaten kayıtlı' });

  const hash = bcrypt.hashSync(password, 10);
  const result = db.prepare(
    'INSERT INTO users (email, password, full_name, phone) VALUES (?, ?, ?, ?)'
  ).run(email.toLowerCase(), hash, full_name, phone || null);

  const user = db.prepare('SELECT id, email, full_name, phone, role FROM users WHERE id = ?').get(result.lastInsertRowid);
  const token = signToken(user);
  res.status(201).json({ user, token });
});

router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'E-posta ve şifre gerekli' });

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase());
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: 'E-posta veya şifre hatalı' });
  }

  const safe = { id: user.id, email: user.email, full_name: user.full_name, phone: user.phone, role: user.role };
  res.json({ user: safe, token: signToken(safe) });
});

router.post('/forgot-password', (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'E-posta gerekli' });
  const user = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
  if (!user) {
    return res.json({ message: 'Eğer hesap varsa sıfırlama bağlantısı oluşturuldu', demo_token: null });
  }
  const token = crypto.randomBytes(24).toString('hex');
  const expires = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  db.prepare('UPDATE users SET reset_token = ?, reset_expires = ? WHERE id = ?').run(token, expires, user.id);
  res.json({
    message: 'Sıfırlama tokeni oluşturuldu (demo ortamında token yanıtta döner)',
    demo_token: token,
  });
});

router.post('/reset-password', (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) return res.status(400).json({ error: 'Token ve yeni şifre gerekli' });
  if (password.length < 6) return res.status(400).json({ error: 'Şifre en az 6 karakter olmalı' });

  const user = db.prepare(
    "SELECT id FROM users WHERE reset_token = ? AND reset_expires > datetime('now')"
  ).get(token);
  if (!user) return res.status(400).json({ error: 'Geçersiz veya süresi dolmuş token' });

  const hash = bcrypt.hashSync(password, 10);
  db.prepare('UPDATE users SET password = ?, reset_token = NULL, reset_expires = NULL WHERE id = ?').run(hash, user.id);
  res.json({ message: 'Şifre güncellendi' });
});

router.get('/me', authRequired, (req, res) => {
  res.json({ user: req.user });
});

router.put('/profile', authRequired, (req, res) => {
  const { full_name, phone } = req.body;
  db.prepare('UPDATE users SET full_name = COALESCE(?, full_name), phone = COALESCE(?, phone) WHERE id = ?')
    .run(full_name || null, phone ?? null, req.user.id);
  const user = db.prepare('SELECT id, email, full_name, phone, role FROM users WHERE id = ?').get(req.user.id);
  res.json({ user });
});

export default router;
