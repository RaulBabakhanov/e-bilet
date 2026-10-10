import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ full_name: '', email: '', phone: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const onSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await register(form);
      navigate('/etkinlikler');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-wrap">
      <h1>Kayıt Ol</h1>
      <p style={{ color: 'var(--ink-muted)', margin: 0 }}>Birkaç adımda hesabınızı oluşturun.</p>
      <form className="auth-form" onSubmit={onSubmit}>
        {error && <div className="alert alert-error">{error}</div>}
        <div className="field">
          <label>Ad Soyad</label>
          <input value={form.full_name} onChange={set('full_name')} required />
        </div>
        <div className="field">
          <label>E-posta</label>
          <input type="email" value={form.email} onChange={set('email')} required />
        </div>
        <div className="field">
          <label>Telefon</label>
          <input value={form.phone} onChange={set('phone')} placeholder="05xx…" />
        </div>
        <div className="field">
          <label>Şifre</label>
          <input type="password" value={form.password} onChange={set('password')} minLength={6} required />
        </div>
        <button className="btn btn-primary" disabled={busy} type="submit">
          {busy ? 'Kaydediliyor…' : 'Hesap Oluştur'}
        </button>
      </form>
      <p className="auth-foot">
        Zaten hesabınız var mı? <Link to="/giris">Giriş yapın</Link>
      </p>
    </div>
  );
}
