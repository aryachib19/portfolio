# Alex Chen — Portfolio

A full-stack portfolio site with a working contact form, rate limiting, and optional email delivery.

## Stack

- **Frontend**: Vanilla HTML / CSS / JS (your original design, untouched)
- **Backend**: Node.js + Express
- **Contact API**: `POST /api/contact` — validates, logs to `submissions.jsonl`, optionally emails via SMTP

---

## Local Development

```bash
npm install
cp .env.example .env   # fill in SMTP vars if you want email
npm run dev            # auto-restarts on file changes
```

Open `http://localhost:3000`

---

## Deploy (Free)

### Option A — Render.com (recommended, free tier)

1. Push this folder to a GitHub repo
2. Go to [render.com](https://render.com) → **New Web Service**
3. Connect your repo
4. Settings:
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Environment**: Node
5. Add Environment Variables (optional, for email):
   - `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `CONTACT_TO`
6. Click **Create Web Service** — live in ~2 minutes

### Option B — Railway.app

```bash
npm install -g @railway/cli
railway login
railway init
railway up
```

### Option C — Fly.io

```bash
npm install -g flyctl
flyctl auth login
flyctl launch
flyctl deploy
```

---

## Contact Form

Form submissions are **always** saved to `submissions.jsonl` (one JSON object per line).

To also receive email notifications, set these env vars:
- `SMTP_HOST` / `SMTP_PORT` — your SMTP server
- `SMTP_USER` / `SMTP_PASS` — credentials
- `CONTACT_TO` — where to forward messages

For Gmail: use an [App Password](https://myaccount.google.com/apppasswords) (not your regular password).

---

## API

| Endpoint | Method | Description |
|---|---|---|
| `GET /` | GET | Serves the portfolio |
| `POST /api/contact` | POST | Submit contact form |
| `GET /api/health` | GET | Health check |

### `POST /api/contact` payload
```json
{
  "name": "Jane Smith",
  "email": "jane@example.com",
  "subject": "Job opportunity",
  "message": "Hi Alex, I wanted to reach out..."
}
```
