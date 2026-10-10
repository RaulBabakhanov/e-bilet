import { Link } from 'react-router-dom';

export default function Home() {
  return (
    <section className="hero">
      <div className="hero-media" aria-hidden="true" />
      <div className="hero-content">
        <h1 className="brand-mark">
          E‑Bilet<em>.</em>
        </h1>
        <p className="hero-lead">
          Konser, sinema ve yolculuk biletlerini anlık koltuk haritasıyla seçin.
          Satılan koltuklar herkesin ekranında aynı anda güncellenir.
        </p>
        <div className="hero-cta">
          <Link className="btn btn-accent" to="/etkinlikler">Etkinlikleri Keşfet</Link>
          <Link className="btn btn-ghost" to="/kayit" style={{ borderColor: 'rgba(255,255,255,0.35)', color: '#fff' }}>
            Hesap Oluştur
          </Link>
        </div>
      </div>
    </section>
  );
}
