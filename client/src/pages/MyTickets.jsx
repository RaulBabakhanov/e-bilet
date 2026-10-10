import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, formatDate, formatPrice } from '../api';

export default function MyTickets() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);

  const load = () =>
    api('/tickets/mine')
      .then((d) => setTickets(d.tickets))
      .catch(() => setTickets([]));

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, []);

  const cancelTicket = async (e, id) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm('Bu bileti iptal etmek istiyor musunuz? Ücret iade edilir (demo) ve koltuk açılır.')) return;
    setBusyId(id);
    setMessage('');
    setError('');
    try {
      const data = await api(`/tickets/${id}/cancel`, { method: 'POST', body: JSON.stringify({}) });
      setMessage(data.message);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="page">
      <div className="container">
        <h1 className="page-title">Biletlerim</h1>
        <p className="page-sub">Satın aldığınız e-biletler ve QR kodlar burada. İsterseniz iptal edebilirsiniz.</p>

        {message && <div className="alert" style={{ marginBottom: '1rem' }}>{message}</div>}
        {error && <div className="alert alert-error" style={{ marginBottom: '1rem' }}>{error}</div>}

        {loading ? (
          <div className="empty">Yükleniyor…</div>
        ) : tickets.length === 0 ? (
          <div className="empty">
            Henüz biletiniz yok. <Link to="/etkinlikler">Etkinliklere göz atın</Link>
          </div>
        ) : (
          tickets.map((t) => (
            <div key={t.id} className="ticket" style={{ display: 'grid' }}>
              <div className="ticket-main">
                <Link to={`/bilet/${t.id}`} style={{ color: 'inherit' }}>
                  <h3>{t.event_title}</h3>
                </Link>
                <div style={{ color: 'var(--ink-muted)' }}>
                  {formatDate(t.event_date)} · {t.event_time} · {t.venue_name}
                </div>
                <div className="ticket-grid">
                  <div><span>Koltuk</span><strong>{t.row_label}{t.seat_number}</strong></div>
                  <div><span>Bölüm</span><strong>{t.section}</strong></div>
                  <div>
                    <span>Durum</span>
                    <strong>{t.status === 'valid' ? 'Geçerli' : 'İptal'}</strong>
                  </div>
                  <div><span>Ücret</span><strong>{formatPrice(t.price)}</strong></div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '1rem' }}>
                  <Link className="btn btn-soft" to={`/bilet/${t.id}`} style={{ padding: '0.45rem 0.9rem' }}>
                    Detay / QR
                  </Link>
                  {t.status === 'valid' && !t.checked_in && (
                    <button
                      type="button"
                      className="btn btn-ghost"
                      style={{ padding: '0.45rem 0.9rem' }}
                      disabled={busyId === t.id}
                      onClick={(e) => cancelTicket(e, t.id)}
                    >
                      {busyId === t.id ? 'İptal…' : 'Bileti İptal Et'}
                    </button>
                  )}
                </div>
              </div>
              <div className="ticket-qr">
                {t.status === 'valid' && t.qr_data?.startsWith('data:') ? (
                  <img src={t.qr_data} alt="QR" />
                ) : (
                  <div style={{ color: 'var(--ink-muted)', textAlign: 'center', padding: '1rem' }}>
                    {t.status === 'cancelled' ? 'İptal edildi' : 'QR'}
                  </div>
                )}
                <div className="ticket-code">{t.ticket_code}</div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
