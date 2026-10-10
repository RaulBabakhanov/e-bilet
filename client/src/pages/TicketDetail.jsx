import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, formatDate, formatPrice } from '../api';

export default function TicketDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [ticket, setTicket] = useState(null);
  const [error, setError] = useState('');
  const [mailMsg, setMailMsg] = useState('');
  const [mailBusy, setMailBusy] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [cancelBusy, setCancelBusy] = useState(false);

  const load = () =>
    api(`/tickets/${id}`)
      .then((d) => setTicket(d.ticket))
      .catch((e) => setError(e.message));

  useEffect(() => {
    load();
  }, [id]);

  const sendEmail = async () => {
    setMailBusy(true);
    setMailMsg('');
    setPreviewUrl('');
    try {
      const data = await api(`/tickets/${id}/email`, { method: 'POST', body: JSON.stringify({}) });
      setMailMsg(data.message);
      if (data.previewUrl) setPreviewUrl(data.previewUrl);
    } catch (e) {
      setMailMsg(e.message);
    } finally {
      setMailBusy(false);
    }
  };

  const cancelTicket = async () => {
    if (!confirm('Bu bileti iptal etmek istiyor musunuz? Ücret iade edilir (demo) ve koltuk açılır.')) return;
    setCancelBusy(true);
    setError('');
    try {
      const data = await api(`/tickets/${id}/cancel`, { method: 'POST', body: JSON.stringify({}) });
      setMailMsg(data.message);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setCancelBusy(false);
    }
  };

  if (error && !ticket) return <div className="page container"><div className="alert alert-error">{error}</div></div>;
  if (!ticket) return <div className="page container"><p>Yükleniyor…</p></div>;

  return (
    <div className="page">
      <div className="container" style={{ maxWidth: 720 }}>
        <p style={{ color: 'var(--ink-muted)' }}><Link to="/biletlerim">← Biletlerim</Link></p>
        <h1 className="page-title">E‑Bilet</h1>
        <p className="page-sub">Girişte QR kodu okutun veya bilet numarasını gösterin.</p>

        {error && <div className="alert alert-error" style={{ marginBottom: '1rem' }}>{error}</div>}

        <article className="ticket" id="printable-ticket">
          <div className="ticket-main">
            <h3>{ticket.event_title}</h3>
            <div className="ticket-grid">
              <div><span>Tarih</span><strong>{formatDate(ticket.event_date)}</strong></div>
              <div><span>Saat</span><strong>{ticket.event_time}</strong></div>
              <div><span>Salon</span><strong>{ticket.venue_name}</strong></div>
              <div><span>Adres</span><strong>{ticket.venue_city}</strong></div>
              <div><span>Koltuk</span><strong>{ticket.row_label}{ticket.seat_number}</strong></div>
              <div><span>Bölüm</span><strong>{ticket.section}</strong></div>
              <div><span>Ad Soyad</span><strong>{ticket.buyer_name}</strong></div>
              <div><span>E-posta</span><strong>{ticket.buyer_email}</strong></div>
              <div><span>Ücret</span><strong>{formatPrice(ticket.price)}</strong></div>
              <div><span>Durum</span><strong>{ticket.status === 'valid' ? 'Geçerli' : 'İptal edildi'}</strong></div>
            </div>
          </div>
          <div className="ticket-qr">
            {ticket.status === 'valid' && ticket.qr_data?.startsWith('data:') ? (
              <img src={ticket.qr_data} alt="QR Kod" />
            ) : (
              <div style={{ color: 'var(--ink-muted)', textAlign: 'center' }}>İptal</div>
            )}
            <div className="ticket-code">{ticket.ticket_code}</div>
          </div>
        </article>

        {mailMsg && (
          <div className="alert" style={{ marginBottom: '1rem' }}>
            {mailMsg}
            {previewUrl && (
              <div style={{ marginTop: '0.75rem' }}>
                <a className="btn btn-primary" href={previewUrl} target="_blank" rel="noreferrer">
                  Test e-postasını burada aç →
                </a>
              </div>
            )}
          </div>
        )}

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          {ticket.status === 'valid' && (
            <>
              <button className="btn btn-primary" type="button" onClick={() => window.print()}>
                PDF / Yazdır
              </button>
              <button className="btn btn-accent" type="button" disabled={mailBusy} onClick={sendEmail}>
                {mailBusy ? 'Gönderiliyor…' : 'Sistemden e-posta gönder'}
              </button>
              <a
                className="btn btn-soft"
                href={`mailto:${ticket.buyer_email}?subject=${encodeURIComponent(`E-Bilet ${ticket.ticket_code}`)}&body=${encodeURIComponent(
                  `Merhaba ${ticket.buyer_name},\n\nBiletiniz:\nEtkinlik: ${ticket.event_title}\nTarih: ${ticket.event_date} ${ticket.event_time}\nSalon: ${ticket.venue_name}\nKoltuk: ${ticket.row_label}${ticket.seat_number}\nBilet No: ${ticket.ticket_code}\nÜcret: ${ticket.price} TL\n\n— E-Bilet`
                )}`}
              >
                Outlook / Gmail ile aç
              </a>
              {!ticket.checked_in && (
                <button className="btn btn-ghost" type="button" disabled={cancelBusy} onClick={cancelTicket}>
                  {cancelBusy ? 'İptal ediliyor…' : 'Bileti İptal Et'}
                </button>
              )}
            </>
          )}
          {ticket.status === 'cancelled' && (
            <button className="btn btn-soft" type="button" onClick={() => navigate('/etkinlikler')}>
              Yeni bilet al
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
