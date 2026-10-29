import nodemailer from 'nodemailer';

let transporter;
function getTransporter() {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) return null;
  if (!transporter) transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number.parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true' || process.env.SMTP_PORT === '465',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  return transporter;
}

export const emailDeliveryConfigured = () => Boolean(getTransporter() || (process.env.RESEND_API_KEY && process.env.EMAIL_FROM));

export async function sendEmail({ to, subject, text, html }) {
  const smtpEmail = process.env.SMTP_USER?.includes('@') ? process.env.SMTP_USER : `${process.env.SMTP_USER || 'no-reply'}@thoughtpolice.space`;
  const from = process.env.EMAIL_FROM || `PlotHour <${smtpEmail}>`;
  const smtp = getTransporter();
  if (smtp) return smtp.sendMail({ from, to, subject, text, ...(html ? { html } : {}) });
  if (process.env.RESEND_API_KEY && process.env.EMAIL_FROM) {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(12_000),
      body: JSON.stringify({ from, to: Array.isArray(to) ? to : [to], subject, text, ...(html ? { html } : {}) }),
    });
    if (!response.ok) throw new Error(`Email delivery provider returned ${response.status}.`);
    return response.json().catch(() => ({}));
  }
  throw new Error('Email delivery is not configured. Add SMTP settings or RESEND_API_KEY and EMAIL_FROM.');
}

export function escapeEmailHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}
