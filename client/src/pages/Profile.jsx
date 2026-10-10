import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function Profile() {
  const { user, updateProfile } = useAuth();
  const [full_name, setName] = useState(user?.full_name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await updateProfile({ full_name, phone });
      setMessage('Profil güncellendi');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page">
      <div className="container" style={{ maxWidth: 520 }}>
        <h1 className="page-title">Profil</h1>
        <p className="page-sub">Hesap bilgilerinizi yönetin.</p>
        <form className="auth-form" onSubmit={save} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--line)', borderRadius: 20, padding: '1.5rem' }}>
          {message && <div className="alert">{message}</div>}
          {error && <div className="alert alert-error">{error}</div>}
          <div className="field">
            <label>E-posta</label>
            <input value={user?.email || ''} disabled />
          </div>
          <div className="field">
            <label>Ad Soyad</label>
            <input value={full_name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="field">
            <label>Telefon</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <button className="btn btn-primary" type="submit" disabled={busy}>
            {busy ? 'Kaydediliyor…' : 'Kaydet'}
          </button>
        </form>
      </div>
    </div>
  );
}
