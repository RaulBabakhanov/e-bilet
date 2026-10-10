import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, categoryLabel, formatDate, formatPrice } from '../api';

const CATS = [
  { id: 'all', label: 'Tümü' },
  { id: 'konser', label: 'Konser' },
  { id: 'sinema', label: 'Sinema' },
  { id: 'tiyatro', label: 'Tiyatro' },
  { id: 'otobus', label: 'Otobüs' },
  { id: 'etkinlik', label: 'Spor / Diğer' },
];

export default function Events() {
  const [events, setEvents] = useState([]);
  const [category, setCategory] = useState('all');
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => {
      setLoading(true);
      const params = new URLSearchParams();
      if (category !== 'all') params.set('category', category);
      if (q.trim()) params.set('q', q.trim());
      api(`/events?${params}`)
        .then((d) => setEvents(d.events))
        .catch(() => setEvents([]))
        .finally(() => setLoading(false));
    }, 200);
    return () => clearTimeout(t);
  }, [category, q]);

  return (
    <div className="page">
      <div className="container">
        <h1 className="page-title">Etkinlikler</h1>
        <p className="page-sub">Müsait koltukları gerçek zamanlı görün, yerinizi anında ayırtın.</p>

        <div className="search-row">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Etkinlik, şehir veya salon ara…"
          />
        </div>

        <div className="filters" style={{ marginBottom: '1.5rem' }}>
          {CATS.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`chip ${category === c.id ? 'active' : ''}`}
              onClick={() => setCategory(c.id)}
            >
              {c.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="empty">Yükleniyor…</div>
        ) : events.length === 0 ? (
          <div className="empty">Etkinlik bulunamadı.</div>
        ) : (
          <div className="event-grid">
            {events.map((e, i) => (
              <Link
                key={e.id}
                to={`/etkinlik/${e.id}`}
                className="event-card"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <div className="event-card-media">
                  <img src={e.image_url} alt={e.title} loading="lazy" />
                  <span className="event-card-cat">{categoryLabel(e.category)}</span>
                </div>
                <div className="event-card-body">
                  <h3>{e.title}</h3>
                  <div className="event-meta">
                    <span>{formatDate(e.event_date)} · {e.event_time}</span>
                    <span>{e.venue_name}, {e.venue_city}</span>
                    <span>{e.available_seats} / {e.total_seats} koltuk müsait</span>
                  </div>
                  <div className="event-price">{formatPrice(e.base_price)}’den</div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
