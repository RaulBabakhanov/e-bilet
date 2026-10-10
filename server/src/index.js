import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import http from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

import './db.js';
import authRoutes from './routes/auth.js';
import eventRoutes from './routes/events.js';
import seatRoutes from './routes/seats.js';
import orderRoutes from './routes/orders.js';
import ticketRoutes from './routes/tickets.js';
import adminRoutes from './routes/admin.js';
import { releaseExpiredHolds } from './routes/seats.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const server = http.createServer(app);

const CLIENT_URL = process.env.CLIENT_URL || process.env.RENDER_EXTERNAL_URL || 'http://localhost:5173';

const io = new Server(server, {
  cors: { origin: [CLIENT_URL, 'http://localhost:5173', 'http://127.0.0.1:5173'], methods: ['GET', 'POST'] },
});

app.set('io', io);
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'E-Bilet API' }));

app.use('/api/auth', authRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/seats', seatRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/admin', adminRoutes);

io.on('connection', (socket) => {
  socket.on('join:event', (eventId) => {
    socket.join(`event:${eventId}`);
  });
  socket.on('leave:event', (eventId) => {
    socket.leave(`event:${eventId}`);
  });
});

// Süresi dolan hold'ları temizle
setInterval(() => {
  const released = releaseExpiredHolds();
  if (released.length) {
    // Tüm etkinlik odalarına genel yenileme sinyali
    io.emit('seats:expired', { seatIds: released });
  }
}, 30_000);

const clientDist = path.join(__dirname, '..', '..', 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) return next();
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`E-Bilet API http://localhost:${PORT}`);
});
