import { NavLink, Outlet, Link } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

export default function Layout() {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const [open, setOpen] = useState(false);

  return (
    <>
      <header className="nav">
        <div className="container nav-inner">
          <Link to="/" className="logo" onClick={() => setOpen(false)}>
            E‑Bilet<span>.</span>
          </Link>

          <nav className={`nav-links ${open ? 'open' : ''}`}>
            <NavLink to="/etkinlikler" onClick={() => setOpen(false)}>Etkinlikler</NavLink>
            {user && <NavLink to="/biletlerim" onClick={() => setOpen(false)}>Biletlerim</NavLink>}
            {user && <NavLink to="/profil" onClick={() => setOpen(false)}>Profil</NavLink>}
            {user?.role === 'admin' && (
              <NavLink to="/admin" onClick={() => setOpen(false)}>Yönetim</NavLink>
            )}
          </nav>

          <div className="nav-actions">
            <button className="theme-toggle" onClick={toggle} aria-label="Tema değiştir" type="button">
              {theme === 'light' ? '☾' : '☀'}
            </button>
            {user ? (
              <>
                <span style={{ fontSize: '0.85rem', color: 'var(--ink-muted)', display: 'none' }} className="hide-mobile">
                  {user.full_name}
                </span>
                <button className="btn btn-ghost" type="button" onClick={logout}>Çıkış</button>
              </>
            ) : (
              <>
                <Link className="btn btn-ghost" to="/giris">Giriş</Link>
                <Link className="btn btn-primary" to="/kayit">Kayıt Ol</Link>
              </>
            )}
            <button className="menu-btn" type="button" onClick={() => setOpen((v) => !v)} aria-label="Menü">
              ☰
            </button>
          </div>
        </div>
      </header>
      <Outlet />
      <footer className="footer">
        <div className="container footer-inner">
          <div>
            <strong style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem' }}>E‑Bilet</strong>
            <div>Gerçek zamanlı koltuk rezervasyonu</div>
          </div>
          <div>© {new Date().getFullYear()} E‑Bilet. Tüm hakları saklıdır.</div>
        </div>
      </footer>
    </>
  );
}
