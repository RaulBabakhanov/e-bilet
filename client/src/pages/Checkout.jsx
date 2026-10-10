import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { api, formatPrice } from '../api';

const HOLD_MS = 10 * 60 * 1000;

function formatRemain(ms) {
  if (ms <= 0) return '00:00';
  const s = Math.ceil(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
}

export default function Checkout() {
  const { eventId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const seatIds = location.state?.seatIds || [];
  const [event, setEvent] = useState(null);
  const [seats, setSeats] = useState([]);
  const [method, setMethod] = useState('demo');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);
  const [emailSent, setEmailSent] = useState(false);
  const [emailPreview, setEmailPreview] = useState('');
  const [holdUntil, setHoldUntil] = useState(() => Date.now() + HOLD_MS);
  const [now, setNow] = useState(Date.now());
  const [card, setCard] = useState({ name: '', number: '', exp: '', cvc: '' });

  useEffect(() => {
    if (!seatIds.length) {
      navigate(`/etkinlik/${eventId}`, { replace: true });
      return;
    }
    Promise.all([api(`/events/${eventId}`), api(`/seats/event/${eventId}`)])
      .then(([ev, seatData]) => {
        setEvent(ev.event);
        const mine = seatData.seats.filter((s) => seatIds.includes(s.id));
        setSeats(mine);
        const expires = mine
          .map((s) => (s.hold_expires ? new Date(s.hold_expires).getTime() : 0))
          .filter(Boolean);
        if (expires.length) setHoldUntil(Math.min(...expires));
        else setHoldUntil(Date.now() + HOLD_MS);
      })
      .catch((e) => setError(e.message));
  }, [eventId]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const remain = holdUntil - now;
  const expired = remain <= 0 && !done;

  useEffect(() => {
    if (!expired) return;
    setError('Rezervasyon süresi doldu. Koltuklar serbest bırakıldı.');
  }, [expired]);

  const total = seats.reduce((s, x) => s + x.price, 0);

  const cancelHold = async () => {
    try {
      await api('/seats/release', {
        method: 'POST',
        body: JSON.stringify({ eventId: Number(eventId), seatIds }),
      });
    } catch {
      /* ignore */
    }
    navigate(`/etkinlik/${eventId}`);
  };

  const pay = async () => {
    if (expired) {
      setError('Süre doldu, yeniden koltuk seçin');
      return;
    }
    if (method !== 'demo') {
      if (!card.name.trim() || card.number.replace(/\s/g, '').length < 12 || card.exp.length < 4 || card.cvc.length < 3) {
        setError('Kart bilgilerini eksiksiz girin (simülasyon)');
        return;
      }
    }
    setBusy(true);
    setError('');
    try {
      const result = await api('/orders/checkout', {
        method: 'POST',
        body: JSON.stringify({ eventId: Number(eventId), seatIds, paymentMethod: method }),
      });
          setDone(result);
          try {
            const mails = await Promise.all(
              result.tickets.map((t) =>
                api(`/tickets/${t.id}/email`, { method: 'POST', body: JSON.stringify({}) })
              )
            );
            setEmailSent(true);
            const preview = mails.find((m) => m.previewUrl)?.previewUrl;
            if (preview) setEmailPreview(preview);
          } catch {
            setEmailSent(false);
          }
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const timerClass = useMemo(() => {
    if (remain < 60_000) return 'hold-timer danger';
    if (remain < 180_000) return 'hold-timer warn';
    return 'hold-timer';
  }, [remain]);

  if (done) {
    return (
      <div className="page">
        <div className="container" style={{ maxWidth: 640 }}>
          <h1 className="page-title">Ödeme başarılı</h1>
          <p className="page-sub">
            E-biletleriniz oluşturuldu. QR kodlu biletlerinizi hesabınızdan görüntüleyebilirsiniz.
          </p>
          <div className="alert" style={{ marginBottom: '1.25rem' }}>
            Sipariş no: <strong>{done.order.payment_ref}</strong> · Toplam: <strong>{formatPrice(done.order.total_amount)}</strong>
            {emailSent && (
              <div style={{ marginTop: '0.5rem' }}>
                Bilet e-postası gönderildi.
                {emailPreview && (
                  <div style={{ marginTop: '0.35rem' }}>
                    <a href={emailPreview} target="_blank" rel="noreferrer">E-posta önizlemesini aç →</a>
                  </div>
                )}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <Link className="btn btn-primary" to="/biletlerim">Biletlerime Git</Link>
            <Link className="btn btn-ghost" to={`/bilet/${done.tickets[0].id}`}>İlk bileti aç</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="container" style={{ maxWidth: 640 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'start', flexWrap: 'wrap' }}>
          <div>
            <h1 className="page-title">Ödeme</h1>
            <p className="page-sub" style={{ marginBottom: 0 }}>{event?.title} — koltuklar tutuluyor.</p>
          </div>
          <div className={timerClass} aria-live="polite">
            <span>Kalan süre</span>
            <strong>{formatRemain(remain)}</strong>
          </div>
        </div>

        <ul className="selected-list" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--line)', borderRadius: 16, padding: '0.75rem 1rem', marginTop: '1.5rem' }}>
          {seats.map((s) => (
            <li key={s.id}>
              <span>{s.row_label}{s.seat_number} · {s.section}</span>
              <strong>{formatPrice(s.price)}</strong>
            </li>
          ))}
        </ul>

        <div className="total-row">
          <span>Toplam</span>
          <span>{formatPrice(total)}</span>
        </div>

        <div className="field" style={{ marginBottom: '1rem' }}>
          <label>Ödeme yöntemi</label>
          <select value={method} onChange={(e) => setMethod(e.target.value)} disabled={expired}>
            <option value="demo">Demo Ödeme (anında onay)</option>
            <option value="stripe">Stripe (simülasyon)</option>
            <option value="iyzico">İyzico (simülasyon)</option>
          </select>
        </div>

        {method !== 'demo' && (
          <div className="pay-card">
            <div className="field full">
              <label>Kart üzerindeki isim</label>
              <input value={card.name} onChange={(e) => setCard({ ...card, name: e.target.value })} placeholder="AD SOYAD" disabled={expired} />
            </div>
            <div className="field full">
              <label>Kart numarası</label>
              <input
                value={card.number}
                onChange={(e) => setCard({ ...card, number: e.target.value.replace(/[^\d\s]/g, '').slice(0, 19) })}
                placeholder="4242 4242 4242 4242"
                inputMode="numeric"
                disabled={expired}
              />
            </div>
            <div className="field">
              <label>SKT</label>
              <input value={card.exp} onChange={(e) => setCard({ ...card, exp: e.target.value.slice(0, 5) })} placeholder="MM/YY" disabled={expired} />
            </div>
            <div className="field">
              <label>CVC</label>
              <input value={card.cvc} onChange={(e) => setCard({ ...card, cvc: e.target.value.replace(/\D/g, '').slice(0, 4) })} placeholder="123" inputMode="numeric" disabled={expired} />
            </div>
          </div>
        )}

        {error && <div className="alert alert-error" style={{ marginBottom: '1rem' }}>{error}</div>}

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button className="btn btn-accent" type="button" disabled={busy || expired} onClick={pay}>
            {busy ? 'İşleniyor…' : expired ? 'Süre doldu' : `${formatPrice(total)} Öde`}
          </button>
          <button className="btn btn-ghost" type="button" disabled={busy} onClick={cancelHold}>
            Vazgeç
          </button>
          {expired && (
            <Link className="btn btn-soft" to={`/etkinlik/${eventId}`}>Yeniden seç</Link>
          )}
        </div>
        <p style={{ fontSize: '0.8rem', color: 'var(--ink-muted)', marginTop: '0.85rem' }}>
          Başarılı ödemede bilet e-postası otomatik gönderilir. Kart bilgileri kaydedilmez (simülasyon).
        </p>
      </div>
    </div>
  );
}
