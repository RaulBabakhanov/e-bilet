import nodemailer from 'nodemailer';

let etherealTransporter = null;

function smtpConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

async function getTransporter() {
  if (smtpConfigured()) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  if (!etherealTransporter) {
    const testAccount = await nodemailer.createTestAccount();
    etherealTransporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: { user: testAccount.user, pass: testAccount.pass },
    });
    console.log('[E-POSTA] Ethereal test hesabı kullanılıyor:', testAccount.user);
  }
  return etherealTransporter;
}

export function buildTicketEmail(ticket) {
  const subject = `E-Bilet — ${ticket.event_title} | ${ticket.ticket_code}`;
  const text = [
    `Merhaba ${ticket.buyer_name},`,
    '',
    'Biletiniz hazır. Detaylar aşağıda:',
    '',
    `Etkinlik : ${ticket.event_title}`,
    `Tarih    : ${ticket.event_date} ${ticket.event_time}`,
    `Salon    : ${ticket.venue_name}`,
    `Koltuk   : ${ticket.row_label}${ticket.seat_number} (${ticket.section})`,
    `Bilet No : ${ticket.ticket_code}`,
    `Ücret    : ${ticket.price} TL`,
    '',
    'Girişte bu e-postadaki bilet numarasını veya uygulamadaki QR kodu gösterin.',
    '',
    'İyi eğlenceler!',
    'E-Bilet',
  ].join('\n');

  const html = `
  <div style="font-family:Segoe UI,Arial,sans-serif;max-width:560px;margin:0 auto;color:#14110f;background:#f7f3ea;padding:24px;border-radius:16px">
    <h1 style="font-size:28px;margin:0 0 8px;color:#0f4c3a">E-Bilet</h1>
    <p style="margin:0 0 20px;color:#5c534a">Merhaba <strong>${ticket.buyer_name}</strong>, biletiniz hazır.</p>
    <div style="background:#fff;border-radius:12px;padding:16px;border:1px solid #e5dfd2">
      <h2 style="margin:0 0 12px;font-size:20px">${ticket.event_title}</h2>
      <p style="margin:4px 0"><strong>Tarih:</strong> ${ticket.event_date} · ${ticket.event_time}</p>
      <p style="margin:4px 0"><strong>Salon:</strong> ${ticket.venue_name}</p>
      <p style="margin:4px 0"><strong>Koltuk:</strong> ${ticket.row_label}${ticket.seat_number} (${ticket.section})</p>
      <p style="margin:4px 0"><strong>Bilet No:</strong> ${ticket.ticket_code}</p>
      <p style="margin:4px 0"><strong>Ücret:</strong> ${ticket.price} TL</p>
    </div>
    <p style="margin:16px 0 0;font-size:13px;color:#5c534a">Girişte QR kodunuzu veya bilet numaranızı gösterin.</p>
  </div>`;

  return { subject, text, html };
}

export async function sendTicketEmail(ticket, toOverride) {
  const to = toOverride || ticket.buyer_email;
  const { subject, text, html } = buildTicketEmail(ticket);
  const transporter = await getTransporter();
  const from = process.env.SMTP_FROM || process.env.SMTP_USER || '"E-Bilet" <bilet@ebilet.local>';

  const info = await transporter.sendMail({ from, to, subject, text, html });
  const previewUrl = nodemailer.getTestMessageUrl(info) || null;
  const mode = smtpConfigured() ? 'smtp' : 'ethereal';

  console.log(`[E-POSTA] ${mode} → ${to} | ${subject}${previewUrl ? ` | önizleme: ${previewUrl}` : ''}`);

  return {
    sent: true,
    to,
    subject,
    mode,
    previewUrl,
    message:
      mode === 'smtp'
        ? `Bilet e-postası ${to} adresine gönderildi. Gelen kutunu / Spam klasörünü kontrol et.`
        : `DİKKAT: Gerçek Gmail’e gitmez (test modu). Aşağıdaki önizleme linkinden mesajı aç. Gerçek mail için server/.env içine Gmail SMTP bilgilerini yaz.`,
  };
}
