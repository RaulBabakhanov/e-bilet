import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [step, setStep] = useState(1);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const request = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const data = await api('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) });
      setMessage(data.message);
      if (data.demo_token) {
        setToken(data.demo_token);
        setStep(2);
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const reset = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const data = await api('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, password }),
      });
      setMessage(data.message);
      setStep(3);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="auth-wrap">
      <h1>Şifremi Unuttum</h1>
      {step === 1 && (
        <form className="auth-form" onSubmit={request}>
          {error && <div className="alert alert-error">{error}</div>}
          <div className="field">
            <label>E-posta</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <button className="btn btn-primary" type="submit">Sıfırlama Bağlantısı</button>
        </form>
      )}
      {step === 2 && (
        <form className="auth-form" onSubmit={reset}>
          {message && <div className="alert">{message}</div>}
          {error && <div className="alert alert-error">{error}</div>}
          <div className="field">
            <label>Token (demo)</label>
            <input value={token} onChange={(e) => setToken(e.target.value)} required />
          </div>
          <div className="field">
            <label>Yeni şifre</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} required />
          </div>
          <button className="btn btn-primary" type="submit">Şifreyi Güncelle</button>
        </form>
      )}
      {step === 3 && (
        <div className="auth-form">
          <div className="alert">{message}</div>
          <Link className="btn btn-primary" to="/giris">Girişe Dön</Link>
        </div>
      )}
      <p className="auth-foot"><Link to="/giris">Girişe dön</Link></p>
    </div>
  );
}
