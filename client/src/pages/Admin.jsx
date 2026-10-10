import { useEffect, useMemo, useState } from 'react';
import { api, categoryLabel, formatDate, formatPrice } from '../api';

const TABS = [
  ['dashboard', 'Özet'],
  ['sales', 'Satışlar'],
  ['events', 'Etkinlikler'],
  ['seats', 'Koltuk Planı'],
  ['venues', 'Salonlar'],
  ['tickets', 'Biletler'],
  ['verify', 'QR Doğrula'],
];

const SECTIONS = ['standart', 'vip', 'engelli', 'pencere', 'koridor'];

export default function Admin() {
  const [stats, setStats] = useState(null);
  const [venues, setVenues] = useState([]);
  const [events, setEvents] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [tab, setTab] = useState('dashboard');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [verifyCode, setVerifyCode] = useState('');
  const [verifyResult, setVerifyResult] = useState(null);
  const [showEventForm, setShowEventForm] = useState(false);

  const [venueForm, setVenueForm] = useState({ name: '', city: '', address: '', capacity: 100 });
  const [eventForm, setEventForm] = useState({
    venue_id: '',
    title: '',
    description: '',
    category: 'konser',
    event_date: '',
    event_time: '20:00',
    base_price: 200,
    rows: 8,
    seatsPerRow: 12,
    image_url: 'https://images.unsplash.com/photo-1459749411175-047dfae242c5?w=1200&q=80',
  });

  // Seat plan editor
  const [planEventId, setPlanEventId] = useState('');
  const [planEvent, setPlanEvent] = useState(null);
  const [planSeats, setPlanSeats] = useState([]);
  const [picked, setPicked] = useState([]);
  const [bulkSection, setBulkSection] = useState('vip');
  const [bulkPrice, setBulkPrice] = useState('');
  const [planBusy, setPlanBusy] = useState(false);

  const flash = (msg, isError = false) => {
    setMessage(isError ? '' : msg);
    setError(isError ? msg : '');
  };

  const load = async () => {
    const [s, v, t, e] = await Promise.all([
      api('/admin/stats'),
      api('/admin/venues'),
      api('/admin/tickets'),
      api('/admin/events'),
    ]);
    setStats(s);
    setVenues(v.venues);
    setTickets(t.tickets);
    setEvents(e.events);
    if (!eventForm.venue_id && v.venues[0]) {
      setEventForm((f) => ({ ...f, venue_id: String(v.venues[0].id) }));
    }
    if (!planEventId && e.events[0]) {
      setPlanEventId(String(e.events[0].id));
    }
  };

  useEffect(() => {
    load().catch((err) => flash(err.message, true));
  }, []);

  useEffect(() => {
    if (!planEventId || tab !== 'seats') return;
    setPicked([]);
    api(`/admin/events/${planEventId}/seats`)
      .then((d) => {
        setPlanEvent(d.event);
        setPlanSeats(d.seats);
      })
      .catch((err) => flash(err.message, true));
  }, [planEventId, tab]);

  const planRows = useMemo(() => {
    const map = new Map();
    for (const s of planSeats) {
      if (!map.has(s.row_label)) map.set(s.row_label, []);
      map.get(s.row_label).push(s);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [planSeats]);

  const createVenue = async (e) => {
    e.preventDefault();
    try {
      await api('/admin/venues', { method: 'POST', body: JSON.stringify(venueForm) });
      flash('Salon eklendi');
      setVenueForm({ name: '', city: '', address: '', capacity: 100 });
      await load();
    } catch (err) {
      flash(err.message, true);
    }
  };

  const createEvent = async (e) => {
    e.preventDefault();
    try {
      await api('/admin/events', {
        method: 'POST',
        body: JSON.stringify({
          ...eventForm,
          venue_id: Number(eventForm.venue_id),
          base_price: Number(eventForm.base_price),
          rows: Number(eventForm.rows),
          seatsPerRow: Number(eventForm.seatsPerRow),
        }),
      });
      flash('Etkinlik ve koltuk planı oluşturuldu');
      setShowEventForm(false);
      await load();
    } catch (err) {
      flash(err.message, true);
    }
  };

  const toggleEventStatus = async (ev) => {
    const next = ev.status === 'active' ? 'inactive' : 'active';
    try {
      await api(`/admin/events/${ev.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: next }),
      });
      flash(next === 'active' ? 'Etkinlik yayınlandı' : 'Etkinlik pasife alındı');
      await load();
    } catch (err) {
      flash(err.message, true);
    }
  };

  const cancelTicket = async (id) => {
    if (!confirm('Bilet iptal edilsin ve koltuk açılsın mı?')) return;
    try {
      await api(`/admin/tickets/${id}/cancel`, { method: 'POST' });
      flash('Bilet iptal edildi, koltuk açıldı');
      await load();
      if (planEventId) {
        const d = await api(`/admin/events/${planEventId}/seats`);
        setPlanSeats(d.seats);
      }
    } catch (err) {
      flash(err.message, true);
    }
  };

  const verify = async (e) => {
    e.preventDefault();
    setVerifyResult(null);
    try {
      const data = await api('/tickets/verify', {
        method: 'POST',
        body: JSON.stringify({ ticket_code: verifyCode }),
      });
      setVerifyResult(data);
    } catch (err) {
      setVerifyResult({ valid: false, message: err.message });
    }
  };

  const togglePick = (seat) => {
    if (seat.status === 'sold') return;
    setPicked((prev) =>
      prev.includes(seat.id) ? prev.filter((x) => x !== seat.id) : [...prev, seat.id]
    );
  };

  const applyBulk = async (payload) => {
    if (!picked.length) {
      flash('Önce koltuk seçin', true);
      return;
    }
    setPlanBusy(true);
    try {
      const data = await api('/admin/seats/bulk', {
        method: 'POST',
        body: JSON.stringify({ eventId: Number(planEventId), seatIds: picked, ...payload }),
      });
      setPlanSeats(data.seats);
      setPicked([]);
      flash(`${data.updated} koltuk güncellendi`);
    } catch (err) {
      flash(err.message, true);
    } finally {
      setPlanBusy(false);
    }
  };

  const adminSeatClass = (seat) => {
    if (picked.includes(seat.id)) return 'selected';
    if (seat.status === 'sold') return 'sold';
    if (seat.status === 'blocked') return 'held';
    if (seat.status === 'held') return 'held';
    if (seat.section === 'vip') return 'available';
    return 'available';
  };

  return (
    <div className="page">
      <div className="container">
        <div className="admin-hero">
          <div>
            <h1 className="page-title">Yönetim Paneli</h1>
            <p className="page-sub" style={{ marginBottom: 0 }}>
              Etkinlik, salon, koltuk planı, satış ve giriş doğrulama.
            </p>
          </div>
          <button type="button" className="btn btn-primary" onClick={() => { setTab('events'); setShowEventForm(true); }}>
            + Yeni Etkinlik
          </button>
        </div>

        <div className="filters" style={{ marginBottom: '1.5rem' }}>
          {TABS.map(([id, label]) => (
            <button key={id} type="button" className={`chip ${tab === id ? 'active' : ''}`} onClick={() => setTab(id)}>
              {label}
            </button>
          ))}
        </div>

        {message && <div className="alert" style={{ marginBottom: '1rem' }}>{message}</div>}
        {error && <div className="alert alert-error" style={{ marginBottom: '1rem' }}>{error}</div>}

        {tab === 'dashboard' && stats && (
          <>
            <div className="stats-grid">
              <div className="stat"><span>Aktif etkinlik</span><strong>{stats.totals.active_events}</strong></div>
              <div className="stat"><span>Satılan bilet</span><strong>{stats.totals.sold_tickets}</strong></div>
              <div className="stat"><span>Toplam gelir</span><strong>{formatPrice(stats.totals.revenue)}</strong></div>
              <div className="stat"><span>Ödenen sipariş</span><strong>{stats.totals.paid_orders || 0}</strong></div>
            </div>

            <h2 className="admin-h2">Müşteri harcamaları</h2>
            <div className="table-wrap" style={{ marginBottom: '2rem' }}>
              <table>
                <thead>
                  <tr><th>Müşteri</th><th>İletişim</th><th>Sipariş</th><th>Bilet</th><th>Toplam harcama</th></tr>
                </thead>
                <tbody>
                  {(stats.byCustomer || []).length === 0 ? (
                    <tr><td colSpan={5} style={{ color: 'var(--ink-muted)' }}>Henüz satış yok</td></tr>
                  ) : (
                    stats.byCustomer.map((c) => (
                      <tr key={c.id}>
                        <td><strong>{c.full_name}</strong></td>
                        <td>
                          {c.email}
                          {c.phone && <div style={{ fontSize: '0.8rem', color: 'var(--ink-muted)' }}>{c.phone}</div>}
                        </td>
                        <td>{c.order_count}</td>
                        <td>{c.ticket_count}</td>
                        <td><strong>{formatPrice(c.total_spent)}</strong></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <h2 className="admin-h2">Etkinlik bazlı satış</h2>
            <div className="table-wrap" style={{ marginBottom: '1rem' }}>
              <table>
                <thead>
                  <tr><th>Etkinlik</th><th>Tarih</th><th>Bilet</th><th>Gelir</th><th></th></tr>
                </thead>
                <tbody>
                  {stats.byEvent.map((e) => (
                    <tr key={e.id}>
                      <td>{e.title}</td>
                      <td>{formatDate(e.event_date)}</td>
                      <td>{e.tickets_sold}</td>
                      <td>{formatPrice(e.revenue)}</td>
                      <td>
                        <button type="button" className="btn btn-ghost" style={{ padding: '0.35rem 0.75rem' }} onClick={() => { setPlanEventId(String(e.id)); setTab('seats'); }}>
                          Koltuklar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button type="button" className="btn btn-soft" onClick={() => setTab('sales')}>Tüm satış detayları →</button>
          </>
        )}

        {tab === 'sales' && stats && (
          <>
            <p className="page-sub">Kim hangi bileti aldı, hangi koltuk, kaç TL ödedi.</p>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Tarih</th>
                    <th>Müşteri</th>
                    <th>Etkinlik</th>
                    <th>Koltuklar</th>
                    <th>Tutar</th>
                    <th>Ödeme ref</th>
                  </tr>
                </thead>
                <tbody>
                  {(stats.recentOrders || []).length === 0 ? (
                    <tr><td colSpan={6} style={{ color: 'var(--ink-muted)' }}>Henüz satış yok</td></tr>
                  ) : (
                    stats.recentOrders.map((o) => (
                      <tr key={o.id}>
                        <td style={{ whiteSpace: 'nowrap', fontSize: '0.85rem' }}>{o.created_at}</td>
                        <td>
                          <strong>{o.full_name}</strong>
                          <div style={{ fontSize: '0.8rem', color: 'var(--ink-muted)' }}>{o.email}</div>
                          {o.phone && <div style={{ fontSize: '0.8rem', color: 'var(--ink-muted)' }}>{o.phone}</div>}
                        </td>
                        <td>
                          {o.event_title}
                          <div style={{ fontSize: '0.8rem', color: 'var(--ink-muted)' }}>
                            {formatDate(o.event_date)} · {o.event_time}
                          </div>
                        </td>
                        <td>
                          <strong>{o.seat_labels || '—'}</strong>
                          <div style={{ fontSize: '0.8rem', color: 'var(--ink-muted)' }}>
                            {(o.tickets || []).length} bilet
                          </div>
                        </td>
                        <td><strong>{formatPrice(o.total_amount)}</strong></td>
                        <td style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.75rem' }}>{o.payment_ref}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {tab === 'venues' && (
          <>
            <form className="admin-form" onSubmit={createVenue}>
              <div className="field"><label>Salon adı</label><input value={venueForm.name} onChange={(e) => setVenueForm({ ...venueForm, name: e.target.value })} required /></div>
              <div className="field"><label>Şehir</label><input value={venueForm.city} onChange={(e) => setVenueForm({ ...venueForm, city: e.target.value })} /></div>
              <div className="field full"><label>Adres</label><input value={venueForm.address} onChange={(e) => setVenueForm({ ...venueForm, address: e.target.value })} /></div>
              <div className="field"><label>Kapasite</label><input type="number" value={venueForm.capacity} onChange={(e) => setVenueForm({ ...venueForm, capacity: e.target.value })} /></div>
              <div className="field" style={{ alignSelf: 'end' }}><button className="btn btn-primary" type="submit">Salon Ekle</button></div>
            </form>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Salon</th><th>Şehir</th><th>Adres</th><th>Kapasite</th></tr>
                </thead>
                <tbody>
                  {venues.map((v) => (
                    <tr key={v.id}>
                      <td>{v.name}</td>
                      <td>{v.city}</td>
                      <td>{v.address}</td>
                      <td>{v.capacity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {tab === 'events' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
              <p style={{ margin: 0, color: 'var(--ink-muted)' }}>{events.length} etkinlik kayıtlı</p>
              <button type="button" className="btn btn-soft" onClick={() => setShowEventForm((v) => !v)}>
                {showEventForm ? 'Formu gizle' : 'Etkinlik ekle'}
              </button>
            </div>

            {showEventForm && (
              <form className="admin-form" onSubmit={createEvent}>
                <div className="field">
                  <label>Salon</label>
                  <select value={eventForm.venue_id} onChange={(e) => setEventForm({ ...eventForm, venue_id: e.target.value })} required>
                    {venues.map((v) => <option key={v.id} value={v.id}>{v.name} — {v.city}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label>Kategori</label>
                  <select value={eventForm.category} onChange={(e) => setEventForm({ ...eventForm, category: e.target.value })}>
                    <option value="konser">Konser</option>
                    <option value="sinema">Sinema</option>
                    <option value="tiyatro">Tiyatro</option>
                    <option value="otobus">Otobüs</option>
                  </select>
                </div>
                <div className="field full"><label>Başlık</label><input value={eventForm.title} onChange={(e) => setEventForm({ ...eventForm, title: e.target.value })} required /></div>
                <div className="field full"><label>Açıklama</label><textarea rows={3} value={eventForm.description} onChange={(e) => setEventForm({ ...eventForm, description: e.target.value })} /></div>
                <div className="field"><label>Tarih</label><input type="date" value={eventForm.event_date} onChange={(e) => setEventForm({ ...eventForm, event_date: e.target.value })} required /></div>
                <div className="field"><label>Saat</label><input type="time" value={eventForm.event_time} onChange={(e) => setEventForm({ ...eventForm, event_time: e.target.value })} required /></div>
                <div className="field"><label>Taban fiyat</label><input type="number" value={eventForm.base_price} onChange={(e) => setEventForm({ ...eventForm, base_price: e.target.value })} /></div>
                <div className="field"><label>Sıra sayısı</label><input type="number" value={eventForm.rows} onChange={(e) => setEventForm({ ...eventForm, rows: e.target.value })} /></div>
                <div className="field"><label>Sıra başı koltuk</label><input type="number" value={eventForm.seatsPerRow} onChange={(e) => setEventForm({ ...eventForm, seatsPerRow: e.target.value })} /></div>
                <div className="field full"><label>Görsel URL</label><input value={eventForm.image_url} onChange={(e) => setEventForm({ ...eventForm, image_url: e.target.value })} /></div>
                <div className="field full"><button className="btn btn-primary" type="submit">Etkinlik + Koltuk Planı Oluştur</button></div>
              </form>
            )}

            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Etkinlik</th><th>Salon</th><th>Tarih</th><th>Satış</th><th>Durum</th><th></th></tr>
                </thead>
                <tbody>
                  {events.map((ev) => (
                    <tr key={ev.id}>
                      <td>
                        <strong>{ev.title}</strong>
                        <div style={{ fontSize: '0.8rem', color: 'var(--ink-muted)' }}>{categoryLabel(ev.category)}</div>
                      </td>
                      <td>{ev.venue_name}</td>
                      <td>{formatDate(ev.event_date)} · {ev.event_time}</td>
                      <td>{ev.sold}/{ev.total_seats}</td>
                      <td>
                        <span className={`status-pill ${ev.status === 'active' ? 'ok' : 'off'}`}>
                          {ev.status === 'active' ? 'Aktif' : 'Pasif'}
                        </span>
                      </td>
                      <td style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                        <button type="button" className="btn btn-ghost" style={{ padding: '0.35rem 0.7rem' }} onClick={() => toggleEventStatus(ev)}>
                          {ev.status === 'active' ? 'Pasife al' : 'Yayınla'}
                        </button>
                        <button type="button" className="btn btn-soft" style={{ padding: '0.35rem 0.7rem' }} onClick={() => { setPlanEventId(String(ev.id)); setTab('seats'); }}>
                          Plan
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {tab === 'seats' && (
          <div className="seat-layout">
            <div>
              <div className="field" style={{ marginBottom: '1rem', maxWidth: 420 }}>
                <label>Etkinlik seç</label>
                <select value={planEventId} onChange={(e) => setPlanEventId(e.target.value)}>
                  {events.map((ev) => (
                    <option key={ev.id} value={ev.id}>{ev.title} — {formatDate(ev.event_date)}</option>
                  ))}
                </select>
              </div>

              {planEvent && (
                <p style={{ color: 'var(--ink-muted)', marginTop: 0 }}>
                  {planEvent.venue_name} · Taban {formatPrice(planEvent.base_price)} · Koltuklara tıklayarak seçin
                </p>
              )}

              <div className="seat-map">
                <div className="stage">Sahne / Perde</div>
                {planRows.map(([row, rowSeats]) => (
                  <div className="seat-row" key={row}>
                    <span className="row-label">{row}</span>
                    {rowSeats
                      .sort((a, b) => a.seat_number - b.seat_number)
                      .map((seat) => (
                        <button
                          key={seat.id}
                          type="button"
                          className={`seat ${adminSeatClass(seat)}`}
                          title={`${seat.row_label}${seat.seat_number} · ${seat.section} · ${formatPrice(seat.price)} · ${seat.status}`}
                          disabled={seat.status === 'sold'}
                          onClick={() => togglePick(seat)}
                          style={seat.section === 'vip' && seat.status === 'available' ? { outline: '2px solid var(--seat-vip)' } : undefined}
                        >
                          {seat.seat_number}
                        </button>
                      ))}
                    <span className="row-label">{row}</span>
                  </div>
                ))}
                <div className="legend">
                  <span><i className="dot" style={{ background: 'var(--seat-available)' }} /> Müsait</span>
                  <span><i className="dot" style={{ background: 'var(--seat-selected)' }} /> Seçili</span>
                  <span><i className="dot" style={{ background: 'var(--seat-held)' }} /> Tutuluyor / Engelli</span>
                  <span><i className="dot" style={{ background: 'var(--seat-sold)' }} /> Satıldı</span>
                </div>
              </div>
            </div>

            <aside className="summary-panel">
              <h3>Plan düzenle</h3>
              <p style={{ color: 'var(--ink-muted)', fontSize: '0.9rem', marginTop: 0 }}>
                {picked.length} koltuk seçili
              </p>

              <div className="field" style={{ marginBottom: '0.75rem' }}>
                <label>Bölüm</label>
                <select value={bulkSection} onChange={(e) => setBulkSection(e.target.value)}>
                  {SECTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="field" style={{ marginBottom: '1rem' }}>
                <label>Fiyat (opsiyonel)</label>
                <input type="number" value={bulkPrice} onChange={(e) => setBulkPrice(e.target.value)} placeholder="Örn. 500" />
              </div>

              <div style={{ display: 'grid', gap: '0.5rem' }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={planBusy || !picked.length}
                  onClick={() => applyBulk({
                    section: bulkSection,
                    price: bulkPrice === '' ? undefined : Number(bulkPrice),
                  })}
                >
                  Bölüm / Fiyat uygula
                </button>
                <button
                  type="button"
                  className="btn btn-soft"
                  disabled={planBusy || !picked.length}
                  onClick={() => applyBulk({ status: 'available' })}
                >
                  Müsait yap (hold kaldır)
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={planBusy || !picked.length}
                  onClick={() => applyBulk({ status: 'blocked' })}
                >
                  Engelle / Satışa kapat
                </button>
                <button type="button" className="btn btn-ghost" disabled={!picked.length} onClick={() => setPicked([])}>
                  Seçimi temizle
                </button>
              </div>
            </aside>
          </div>
        )}

        {tab === 'tickets' && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Kod</th><th>Etkinlik</th><th>Kullanıcı</th><th>Koltuk</th><th>Ücret</th><th>Durum</th><th></th></tr>
              </thead>
              <tbody>
                {tickets.map((t) => (
                  <tr key={t.id}>
                    <td style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.85rem' }}>{t.ticket_code}</td>
                    <td>{t.event_title}</td>
                    <td>{t.full_name}<div style={{ fontSize: '0.8rem', color: 'var(--ink-muted)' }}>{t.email}</div></td>
                    <td>{t.row_label}{t.seat_number}</td>
                    <td>{formatPrice(t.price)}</td>
                    <td>
                      <span className={`status-pill ${t.status === 'valid' ? 'ok' : 'off'}`}>
                        {t.status === 'valid' ? 'Geçerli' : 'İptal'}
                      </span>
                    </td>
                    <td>
                      {t.status === 'valid' && (
                        <button className="btn btn-ghost" type="button" style={{ padding: '0.35rem 0.7rem' }} onClick={() => cancelTicket(t.id)}>
                          İptal / İade
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'verify' && (
          <form className="admin-form" onSubmit={verify} style={{ maxWidth: 480 }}>
            <div className="field full">
              <label>Bilet numarası / QR içeriği</label>
              <input value={verifyCode} onChange={(e) => setVerifyCode(e.target.value)} placeholder="Örn. ABCD1234…" required />
            </div>
            <div className="field full">
              <button className="btn btn-accent" type="submit">Doğrula / Giriş Onayla</button>
            </div>
            {verifyResult && (
              <div className={`alert full ${verifyResult.valid ? '' : 'alert-error'}`}>
                {verifyResult.message}
                {verifyResult.ticket && (
                  <div style={{ marginTop: '0.5rem' }}>
                    {verifyResult.ticket.event_title} — {verifyResult.ticket.row_label}{verifyResult.ticket.seat_number} — {verifyResult.ticket.buyer_name}
                  </div>
                )}
              </div>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
