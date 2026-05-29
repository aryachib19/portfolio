import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { writeFileSync } from 'fs';
import nodemailer from 'nodemailer';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '10kb' }));
app.use(express.static(path.join(__dirname, '../public')));

const rateLimitMap = new Map();
function rateLimit(req, res, next) {
  const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress;
  const now = Date.now();
  const window = 15 * 60 * 1000;
  const maxReqs = 5;
  const record = rateLimitMap.get(ip) || { count: 0, resetAt: now + window };
  if (now > record.resetAt) { record.count = 0; record.resetAt = now + window; }
  record.count++;
  rateLimitMap.set(ip, record);
  if (record.count > maxReqs) return res.status(429).json({ error: 'Too many requests.' });
  next();
}

function validateContact({ name, email, message }) {
  const errors = [];
  if (!name || name.length < 2 || name.length > 100) errors.push('Name must be 2–100 characters.');
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push('Valid email required.');
  if (!message || message.length < 10 || message.length > 2000) errors.push('Message must be 10–2000 characters.');
  return errors;
}

app.post('/api/contact', rateLimit, async (req, res) => {
  const { name, email, subject, message } = req.body || {};
  const errors = validateContact({ name, email, message });
  if (errors.length) return res.status(400).json({ error: errors.join(' ') });

  const entry = {
    ts: new Date().toISOString(),
    name: name.trim(),
    email: email.trim(),
    subject: (subject || '').trim(),
    message: message.trim(),
  };

  try {
    const logPath = path.join(__dirname, '../submissions.jsonl');
    writeFileSync(logPath, JSON.stringify(entry) + '\n', { flag: 'a' });
  } catch (_) {}

  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    try {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT) || 587,
        secure: false,
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      });
      await transporter.sendMail({
        from: `"Portfolio Contact" <${process.env.SMTP_USER}>`,
        to: process.env.CONTACT_TO || process.env.SMTP_USER,
        replyTo: `${entry.name} <${entry.email}>`,
        subject: `[Portfolio] ${entry.subject || 'New message from ' + entry.name}`,
        text: `From: ${entry.name} <${entry.email}>\n\n${entry.message}`,
      });
    } catch (mailErr) {
      console.error('Email send failed:', mailErr.message);
    }
  }

  res.json({ ok: true, message: "Message received. I'll be in touch soon!" });
});

app.get('/api/health', (_, res) => res.json({ status: 'ok', ts: Date.now() }));
app.get('*', (_, res) => res.sendFile(path.join(__dirname, '../public/index.html')));

app.listen(PORT, () => console.log(`\n  🚀 Portfolio server running at http://localhost:${PORT}\n`));
