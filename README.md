# E-Bilet — Online E-Bilet ve Gerçek Zamanlı Koltuk Rezervasyonu

Profesyonel web tabanlı e-bilet sistemi: anlık koltuk haritası (Socket.IO), JWT kimlik doğrulama, QR kodlu dijital bilet ve yönetici paneli.

## Teknolojiler

- **Frontend:** React + Vite
- **Backend:** Node.js + Express
- **Veritabanı:** SQLite (`node:sqlite`, native derleme gerekmez)
- **Gerçek zamanlı:** Socket.IO
- **Kimlik doğrulama:** JWT
- **Ödeme:** Demo / Stripe / İyzico simülasyonu

## Kurulum

```bash
# Kök dizinde
npm install
npm run install:all
npm run seed
npm run dev
```

- Site: http://localhost:5173
- API: http://localhost:5000

## Demo hesaplar

| Rol    | E-posta            | Şifre    |
|--------|--------------------|----------|
| Kullanıcı | demo@ebilet.com | user123  |
| Yönetici  | admin@ebilet.com | admin123 |

## Özellikler

- Gerçek zamanlı koltuk durumu (yeşil / sarı / kırmızı / mavi seçim)
- Çoklu koltuk seçimi ve otomatik tutar
- 10 dakikalık geçici rezervasyon (ödeme sırasında)
- QR kodlu e-bilet, yazdırma / PDF
- Kayıt, giriş, şifremi unuttum, profil, biletlerim
- Admin: salon, etkinlik, koltuk planı, satış raporu, iptal/iade, QR giriş doğrulama
- Karanlık / aydınlık tema, mobil uyumlu tasarım
