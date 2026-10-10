import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('demo@ebilet.com');
  const [password, setPassword] = useState('user123');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await login(email, password);
      navigate(location.state?.from || '/etkinlikler');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-wrap">
      <h1>Giriş Yap</h1>
      <p style={{ color: 'var(--ink-muted)', margin: 0 }}>Bilet almak ve rezervasyon için hesabınıza girin.</p>
      <form className="auth-form" onSubmit={onSubmit}>
        {error && <div className="alert alert-error">{error}</div>}
        <div className="field">
          <label>E-posta</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="field">
          <label>Şifre</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        <button className="btn btn-primary" disabled={busy} type="submit">
          {busy ? 'Giriş…' : 'Giriş Yap'}
        </button>
      </form>
      <p className="auth-foot">
        <Link to="/sifremi-unuttum">Şifremi unuttum</Link>
        <br />
        Hesabınız yok mu? <Link to="/kayit">Kayıt olun</Link>
      </p>
      <p style={{ fontSize: '0.8rem', color: 'var(--ink-muted)', marginTop: '1rem' }}>
        Demo: demo@ebilet.com / user123 · Admin: admin@ebilet.com / admin123
      </p>
    </div>
  );
}
