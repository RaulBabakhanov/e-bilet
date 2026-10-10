import bcrypt from 'bcryptjs';
import db from './db.js';

const adminHash = bcrypt.hashSync('admin123', 10);
const userHash = bcrypt.hashSync('user123', 10);

const userCount = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
if (userCount === 0) {
  db.prepare(`
    INSERT INTO users (email, password, full_name, phone, role) VALUES
    ('admin@ebilet.com', ?, 'Sistem Yöneticisi', '05320000000', 'admin'),
    ('demo@ebilet.com', ?, 'Demo Kullanıcı', '05321112233', 'user')
  `).run(adminHash, userHash);
  console.log('✓ Kullanıcılar oluşturuldu');
}

function ensureVenue(name, address, city, capacity) {
  const existing = db.prepare('SELECT id FROM venues WHERE name = ?').get(name);
  if (existing) return existing.id;
  return db.prepare('INSERT INTO venues (name, address, city, capacity) VALUES (?, ?, ?, ?)')
    .run(name, address, city, capacity).lastInsertRowid;
}

const vZorlu = ensureVenue('Zorlu PSM', 'Levazım Mah. Koru Sok. No:2', 'İstanbul', 200);
const vCinema = ensureVenue("Cinemaximum City's", "Nişantaşı City's AVM", 'İstanbul', 120);
const vCong = ensureVenue('Ankara Congresium', 'İncek Bulvarı No:1', 'Ankara', 180);
const vVolkswagen = ensureVenue('Volkswagen Arena', 'Maslak Mah. Büyükdere Cad.', 'İstanbul', 220);
const vJolly = ensureVenue('Jolly Joker Ankara', 'Kızılay Tunalı Hilmi Cad.', 'Ankara', 140);
const vMaximum = ensureVenue('Maximum UNIQ Hall', 'Maslak', 'İstanbul', 160);
const vOtogar = ensureVenue('İstanbul Esenler Otogarı', 'Esenler', 'İstanbul', 48);
const vHarbiye = ensureVenue('Harbiye Açıkhava', 'Harbiye', 'İstanbul', 240);

const insertEvent = db.prepare(`
  INSERT INTO events (venue_id, title, description, category, image_url, event_date, event_time, base_price)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);
const insertSeat = db.prepare(`
  INSERT INTO seats (event_id, row_label, seat_number, section, price, status)
  VALUES (?, ?, ?, ?, ?, 'available')
`);

function createSeats(eventId, e) {
  const labels = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.slice(0, e.rows).split('');
  for (const row of labels) {
    const isVip = ['A', 'B'].includes(row) && e.category !== 'otobus';
    for (let n = 1; n <= e.seatsPerRow; n++) {
      let section = isVip ? 'vip' : 'standart';
      let mult = isVip ? 1.75 : 1;
      if (e.category === 'otobus') {
        section = n <= 2 ? 'pencere' : 'koridor';
        mult = n <= 2 ? 1.12 : 1;
      }
      if (row === labels[labels.length - 1] && n === 1) {
        section = 'engelli';
        mult = 0.7;
      }
      insertSeat.run(eventId, row, n, section, Math.round(e.base_price * mult));
    }
  }
  const soldCount = Math.min(10, Math.floor(e.rows * e.seatsPerRow * 0.08));
  const sold = db.prepare('SELECT id FROM seats WHERE event_id = ? ORDER BY RANDOM() LIMIT ?').all(eventId, soldCount);
  for (const s of sold) {
    db.prepare("UPDATE seats SET status = 'sold' WHERE id = ?").run(s.id);
  }
}

/** Türkiye ortalama bilet fiyatlarına yakın örnekler (2026) */
const catalog = [
  {
    venue_id: vVolkswagen,
    title: 'Duman — İstanbul Konseri',
    description: 'Türk rock efsanesi Duman ile stadyum enerjisinde unutulmaz bir gece.',
    category: 'konser',
    image_url: 'https://images.unsplash.com/photo-1459749411175-047dfae242c5?w=1200&q=80',
    event_date: '2026-08-22',
    event_time: '21:00',
    base_price: 950,
    rows: 12,
    seatsPerRow: 14,
  },
  {
    venue_id: vZorlu,
    title: 'Sezen Aksu Tribute Gecesi',
    description: 'Sezen Aksu şarkılarıyla orkestra eşliğinde özel bir saygı gecesi.',
    category: 'konser',
    image_url: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=1200&q=80',
    event_date: '2026-09-12',
    event_time: '20:30',
    base_price: 1250,
    rows: 10,
    seatsPerRow: 12,
  },
  {
    venue_id: vHarbiye,
    title: 'Yaz Festivali: Elektronik Gece',
    description: 'Açık hava elektronik müzik festivali. Yerli ve yabancı DJ’ler.',
    category: 'konser',
    image_url: 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=1200&q=80',
    event_date: '2026-08-08',
    event_time: '22:00',
    base_price: 780,
    rows: 14,
    seatsPerRow: 16,
  },
  {
    venue_id: vJolly,
    title: 'Manga Canlı Performans',
    description: 'Ankara’da Manga ile yüksek enerjili rock gecesi.',
    category: 'konser',
    image_url: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=1200&q=80',
    event_date: '2026-08-29',
    event_time: '21:30',
    base_price: 650,
    rows: 9,
    seatsPerRow: 12,
  },
  {
    venue_id: vMaximum,
    title: 'Jazz İstanbul Sessions',
    description: 'İstanbul caz sahnesinin seçkin isimleriyle samimi bir akşam.',
    category: 'konser',
    image_url: 'https://images.unsplash.com/photo-1415201364774-f6f0bb35beb0?w=1200&q=80',
    event_date: '2026-09-05',
    event_time: '20:00',
    base_price: 520,
    rows: 8,
    seatsPerRow: 10,
  },
  {
    venue_id: vCinema,
    title: 'Karanlık Sular — IMAX',
    description: 'Ödüllü gerilim filmi. IMAX salonda özel gösterim.',
    category: 'sinema',
    image_url: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=1200&q=80',
    event_date: '2026-07-28',
    event_time: '19:30',
    base_price: 240,
    rows: 8,
    seatsPerRow: 12,
  },
  {
    venue_id: vCinema,
    title: 'Aile Komedisi: Tatil Belası',
    description: 'Yerli aile komedisi. Hafta sonu matinesi dahil seanslar.',
    category: 'sinema',
    image_url: 'https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?w=1200&q=80',
    event_date: '2026-08-02',
    event_time: '16:00',
    base_price: 200,
    rows: 8,
    seatsPerRow: 12,
  },
  {
    venue_id: vCinema,
    title: 'Animasyon: Uzay Macerası 3D',
    description: 'Çocuklar ve aileler için 3D animasyon filmi.',
    category: 'sinema',
    image_url: 'https://images.unsplash.com/photo-1440404653325-ab127d49abc1?w=1200&q=80',
    event_date: '2026-08-10',
    event_time: '14:30',
    base_price: 220,
    rows: 8,
    seatsPerRow: 12,
  },
  {
    venue_id: vZorlu,
    title: 'Hamlet — Modern Sahne',
    description: 'Klasik oyun, çağdaş sahneleme. Türkçe oynanır.',
    category: 'tiyatro',
    image_url: 'https://images.unsplash.com/photo-1503095396549-807759245b35?w=1200&q=80',
    event_date: '2026-09-18',
    event_time: '20:00',
    base_price: 480,
    rows: 9,
    seatsPerRow: 11,
  },
  {
    venue_id: vMaximum,
    title: 'Stand-up: Açık Mikrofon Gecesi',
    description: 'Türkiye’nin sevilen komedyenlerinden açık mikrofon gecesi.',
    category: 'tiyatro',
    image_url: 'https://images.unsplash.com/photo-1527224857830-43a7acc85260?w=1200&q=80',
    event_date: '2026-08-14',
    event_time: '21:00',
    base_price: 420,
    rows: 8,
    seatsPerRow: 10,
  },
  {
    venue_id: vCong,
    title: 'Çocuk Tiyatrosu: Keloğlan',
    description: 'Aileler için müzikli çocuk oyunu.',
    category: 'tiyatro',
    image_url: 'https://images.unsplash.com/photo-1460723237483-7a6dc9d0b212?w=1200&q=80',
    event_date: '2026-08-16',
    event_time: '15:00',
    base_price: 280,
    rows: 8,
    seatsPerRow: 12,
  },
  {
    venue_id: vOtogar,
    title: 'İstanbul → Ankara Ekspres',
    description: '2+1 konforlu koltuk, Wi-Fi ve ikram. Ortalama şehirler arası ücret.',
    category: 'otobus',
    image_url: 'https://images.unsplash.com/photo-1544620341-11fe85b0b4f5?w=1200&q=80',
    event_date: '2026-07-25',
    event_time: '08:00',
    base_price: 620,
    rows: 12,
    seatsPerRow: 4,
  },
  {
    venue_id: vOtogar,
    title: 'İstanbul → İzmir Gece Seferi',
    description: 'Gece yolculuğu, yatar koltuk seçenekli otobüs.',
    category: 'otobus',
    image_url: 'https://images.unsplash.com/photo-1570125909232-eb263c188f7e?w=1200&q=80',
    event_date: '2026-07-30',
    event_time: '23:30',
    base_price: 740,
    rows: 12,
    seatsPerRow: 4,
  },
  {
    venue_id: vOtogar,
    title: 'Ankara → Antalya Tatil Seferi',
    description: 'Yaz tatili seferi. Klima ve ikram dahil.',
    category: 'otobus',
    image_url: 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=1200&q=80',
    event_date: '2026-08-05',
    event_time: '21:00',
    base_price: 690,
    rows: 12,
    seatsPerRow: 4,
  },
  {
    venue_id: vCong,
    title: 'Basketbol: Ankara Derbisi',
    description: 'Sezon maçı. Tribün biletleri sınırlı sayıdadır.',
    category: 'etkinlik',
    image_url: 'https://images.unsplash.com/photo-1546519638-68e109498ffc?w=1200&q=80',
    event_date: '2026-09-01',
    event_time: '19:00',
    base_price: 550,
    rows: 12,
    seatsPerRow: 14,
  },
  {
    venue_id: vZorlu,
    title: 'Gece Yarısı Akustik',
    description: 'Küçük salon akustik performans. Sınırlı koltuk.',
    category: 'konser',
    image_url: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=1200&q=80',
    event_date: '2026-08-15',
    event_time: '21:00',
    base_price: 590,
    rows: 8,
    seatsPerRow: 10,
  },
];

let added = 0;
for (const e of catalog) {
  const exists = db.prepare('SELECT id FROM events WHERE title = ?').get(e.title);
  if (exists) {
    // Fiyatları Türkiye ortalamasına çek
    db.prepare('UPDATE events SET base_price = ?, description = ?, image_url = ? WHERE id = ?')
      .run(e.base_price, e.description, e.image_url, exists.id);
    const seats = db.prepare('SELECT id, row_label, seat_number, section FROM seats WHERE event_id = ?').all(exists.id);
    for (const s of seats) {
      let mult = 1;
      if (s.section === 'vip') mult = 1.75;
      else if (s.section === 'engelli') mult = 0.7;
      else if (s.section === 'pencere') mult = 1.12;
      db.prepare('UPDATE seats SET price = ? WHERE id = ?').run(Math.round(e.base_price * mult), s.id);
    }
    continue;
  }
  const eventId = insertEvent.run(
    e.venue_id, e.title, e.description, e.category, e.image_url,
    e.event_date, e.event_time, e.base_price
  ).lastInsertRowid;
  createSeats(eventId, e);
  added += 1;
}

console.log(`✓ Katalog güncellendi. Yeni etkinlik: ${added}`);
console.log('Seed tamamlandı.');
