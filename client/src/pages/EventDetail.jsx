import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, categoryLabel, formatDate, formatPrice } from '../api';
import { getSocket } from '../socket';
import { useAuth } from '../context/AuthContext';

export default function EventDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [event, setEvent] = useState(null);
  const [seats, setSeats] = useState([]);
  const [selected, setSelected] = useState([]);
  const [sectionFilter, setSectionFilter] = useState('all');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    Promise.all([api(`/events/${id}`), api(`/seats/event/${id}`)])
      .then(([ev, seatData]) => {
        if (!alive) return;
        setEvent(ev.event);
        setSeats(seatData.seats);
      })
      .catch((e) => setError(e.message))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [id]);

  useEffect(() => {
    const socket = getSocket();
    socket.emit('join:event', Number(id));
    const onUpdate = (payload) => {
      if (Number(payload.eventId) !== Number(id)) return;
      setSeats(payload.seats);
      setSelected((prev) =>
        prev.filter((sid) => {
          const seat = payload.seats.find((s) => s.id === sid);
          if (!seat) return false;
          if (seat.status === 'sold' || seat.status === 'blocked') return false;
          if (seat.status === 'held' && user && seat.held_by !== user.id) return false;
          return true;
        })
      );
    };
    const onExpired = () => {
      api(`/seats/event/${id}`).then((d) => setSeats(d.seats)).catch(() => {});
    };
    socket.on('seats:update', onUpdate);
    socket.on('seats:expired', onExpired);
    return () => {
      socket.emit('leave:event', Number(id));
      socket.off('seats:update', onUpdate);
      socket.off('seats:expired', onExpired);
    };
  }, [id, user]);

  const rows = useMemo(() => {
    const map = new Map();
    for (const s of seats) {
      if (sectionFilter !== 'all' && s.section !== sectionFilter) continue;
      if (!map.has(s.row_label)) map.set(s.row_label, []);
      map.get(s.row_label).push(s);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [seats, sectionFilter]);

  const sections = useMemo(() => [...new Set(seats.map((s) => s.section))], [seats]);

  const selectedSeats = seats.filter((s) => selected.includes(s.id));
  const total = selectedSeats.reduce((sum, s) => sum + s.price, 0);

  const seatClass = (seat) => {
    if (selected.includes(seat.id)) return 'selected';
    if (seat.status === 'sold' || seat.status === 'blocked') return 'sold';
    if (seat.status === 'held') {
      if (user && seat.held_by === user.id) return 'mine-held';
      return 'held';
    }
    return 'available';
  };

  const toggleSeat = (seat) => {
    setError('');
    if (seat.status === 'sold' || seat.status === 'blocked') return;
    if (seat.status === 'held' && (!user || seat.held_by !== user.id)) return;
    setSelected((prev) =>
      prev.includes(seat.id) ? prev.filter((x) => x !== seat.id) : [...prev, seat.id]
    );
  };

  const goCheckout = async () => {
    if (!user) {
      navigate('/giris', { state: { from: `/etkinlik/${id}` } });
      return;
    }
    if (!selected.length) {
      setError('En az bir koltuk seçin');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await api('/seats/hold', {
        method: 'POST',
        body: JSON.stringify({ eventId: Number(id), seatIds: selected }),
      });
      navigate(`/odeme/${id}`, { state: { seatIds: selected } });
    } catch (e) {
      setError(e.message);
      const fresh = await api(`/seats/event/${id}`);
      setSeats(fresh.seats);
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className="page container"><p>Yükleniyor…</p></div>;
  if (!event) return <div className="page container"><p>Etkinlik bulunamadı.</p></div>;

  return (
    <div className="page">
      <div className="container">
        <p style={{ color: 'var(--ink-muted)', marginBottom: '0.35rem' }}>
          <Link to="/etkinlikler">Etkinlikler</Link> / {categoryLabel(event.category)}
        </p>
        <h1 className="page-title">{event.title}</h1>
        <p className="page-sub">
          {formatDate(event.event_date)} · {event.event_time} · {event.venue_name}, {event.venue_city}
        </p>

        <div className="section-filters">
          <button type="button" className={`chip ${sectionFilter === 'all' ? 'active' : ''}`} onClick={() => setSectionFilter('all')}>
            Tüm bölümler
          </button>
          {sections.map((s) => (
            <button
              key={s}
              type="button"
              className={`chip ${sectionFilter === s ? 'active' : ''}`}
              onClick={() => setSectionFilter(s)}
            >
              {s.toUpperCase()}
            </button>
          ))}
        </div>

        <div className="seat-layout">
          <div>
            <div className="seat-map">
              <div className="stage">Sahne / Perde</div>
              {rows.map(([row, rowSeats]) => (
                <div className="seat-row" key={row}>
                  <span className="row-label">{row}</span>
                  {rowSeats
                    .sort((a, b) => a.seat_number - b.seat_number)
                    .map((seat) => (
                      <button
                        key={seat.id}
                        type="button"
                        className={`seat ${seatClass(seat)}`}
                        title={`${seat.row_label}${seat.seat_number} · ${seat.section} · ${formatPrice(seat.price)}`}
                        disabled={
                          seat.status === 'sold'
                          || seat.status === 'blocked'
                          || (seat.status === 'held' && (!user || seat.held_by !== user.id))
                        }
                        onClick={() => toggleSeat(seat)}
                      >
                        {seat.seat_number}
                      </button>
                    ))}
                  <span className="row-label">{row}</span>
                </div>
              ))}
              <div className="legend">
                <span><i className="dot" style={{ background: 'var(--seat-available)' }} /> Müsait</span>
                <span><i className="dot" style={{ background: 'var(--seat-selected)' }} /> Seçiminiz</span>
                <span><i className="dot" style={{ background: 'var(--seat-held)' }} /> Tutuluyor</span>
                <span><i className="dot" style={{ background: 'var(--seat-sold)' }} /> Satıldı</span>
              </div>
            </div>
          </div>

          <aside className="summary-panel">
            <h3>Sepetiniz</h3>
            {selectedSeats.length === 0 ? (
              <p style={{ color: 'var(--ink-muted)', fontSize: '0.9rem' }}>Koltuk seçerek başlayın. Değişiklikler anlık yansır.</p>
            ) : (
              <ul className="selected-list">
                {selectedSeats.map((s) => (
                  <li key={s.id}>
                    <span>{s.row_label}{s.seat_number} · {s.section}</span>
                    <strong>{formatPrice(s.price)}</strong>
                  </li>
                ))}
              </ul>
            )}
            <div className="total-row">
              <span>Toplam</span>
              <span>{formatPrice(total)}</span>
            </div>
            {error && <div className="alert alert-error" style={{ marginBottom: '0.75rem' }}>{error}</div>}
            <button className="btn btn-primary" style={{ width: '100%' }} type="button" disabled={busy || !selected.length} onClick={goCheckout}>
              {busy ? 'Rezerve ediliyor…' : 'Satın Al'}
            </button>
            <p style={{ fontSize: '0.8rem', color: 'var(--ink-muted)', marginTop: '0.75rem' }}>
              Ödeme ekranında koltuklar 10 dakika tutulur.
            </p>
          </aside>
        </div>
      </div>
    </div>
  );
}
