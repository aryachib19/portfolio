import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import nodemailer from 'nodemailer';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

// ─── Middleware ────────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10kb' }));
app.use(express.static(path.join(__dirname, '../public')));

// Simple in-memory rate limiter (per IP, 5 req / 15 min)
const rateLimitMap = new Map();
function rateLimit(req, res, next) {
  const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress;
  const now = Date.now();
  const window = 15 * 60 * 1000; // 15 minutes
  const maxReqs = 5;

  const record = rateLimitMap.get(ip) || { count: 0, resetAt: now + window };
  if (now > record.resetAt) {
    record.count = 0;
    record.resetAt = now + window;
  }
  record.count++;
  rateLimitMap.set(ip, record);

  if (record.count > maxReqs) {
    return res.status(429).json({ error: 'Too many requests. Please wait before trying again.' });
  }
  next();
}

// ─── Validation ───────────────────────────────────────────────────────────────
function validateContact({ name, email, message }) {
  const errors = [];
  if (!name || name.length < 2 || name.length > 100) errors.push('Name must be 2–100 characters.');
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push('Valid email required.');
  if (!message || message.length < 10 || message.length > 2000) errors.push('Message must be 10–2000 characters.');
  return errors;
}

// ─── Contact Route ─────────────────────────────────────────────────────────────
app.post('/api/contact', rateLimit, async (req, res) => {
  const { name, email, subject, message } = req.body || {};
  const errors = validateContact({ name, email, message });
  if (errors.length) return res.status(400).json({ error: errors.join(' ') });

  // Log submission to file (always works, even without email config)
  const entry = {
    ts: new Date().toISOString(),
    name: name.trim(),
    email: email.trim(),
    subject: (subject || '').trim(),
    message: message.trim(),
  };

  const logPath = path.join(__dirname, '../submissions.jsonl');
  const line = JSON.stringify(entry) + '\n';
  try {
    writeFileSync(logPath, line, { flag: 'a' });
  } catch (_) { /* ignore write errors in serverless envs */ }

  // Optional: send email via SMTP if env vars are set
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
        html: `
          <div style="font-family:monospace;background:#080c10;color:#e6edf3;padding:2rem;border-radius:8px;">
            <h2 style="color:#00ff88;margin:0 0 1rem">New Portfolio Message</h2>
            <p><strong style="color:#58a6ff">From:</strong> ${entry.name} &lt;${entry.email}&gt;</p>
            <p><strong style="color:#58a6ff">Subject:</strong> ${entry.subject || '(none)'}</p>
            <hr style="border-color:#30363d;margin:1rem 0"/>
            <p style="white-space:pre-wrap;color:#8b949e">${entry.message}</p>
          </div>
        `,
      });
    } catch (mailErr) {
      console.error('Email send failed:', mailErr.message);
      // Still return success — submission was logged
    }
  }

  res.json({ ok: true, message: 'Message received. I\'ll be in touch soon!' });
});

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/api/health', (_, res) => res.json({ status: 'ok', ts: Date.now() }));

// ─── SPA fallback ─────────────────────────────────────────────────────────────
app.get('*', (_, res) => res.sendFile(path.join(__dirname, '../public/index.html')));

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n  🚀 Portfolio server running at http://localhost:${PORT}\n`);
});
