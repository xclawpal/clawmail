# ClawMail

Disposable email service with auto-categorization. Spin up a temporary inbox, read incoming mail, extract OTP codes, then throw it away.

Built on vanilla JavaScript and Vite. No registration, no tracking.

## Features

- Generate custom or random email addresses on supported domains
- Auto-poll inbox at configurable intervals
- Smart categorization: detects OTP, promotional, and spam messages
- One-click OTP extraction with regex fallback
- Dual view for messages: plain text and sandboxed HTML
- Theme toggle between dark (`midnight`) and light (`paper`)
- Session persistence via `localStorage`
- Responsive layout, no external UI library

## Stack

| Layer       | Choice                          |
|-------------|---------------------------------|
| Bundler     | Vite 5                          |
| Language    | Vanilla ES2020                  |
| Styling     | CSS custom properties           |
| Fonts       | Inter, JetBrains Mono           |
| Icons       | Inline SVG                      |
| Backend     | External API (your own backend) |

## Getting Started

Requires Node.js 16 or higher.

```bash
git clone https://github.com/xclawpal/clawmail.git
cd clawmail
npm install
cp .env.example .env
```

Edit `.env` with your backend credentials, then:

```bash
npm run dev
```

The dev server listens on `http://127.0.0.1:5180`.

## Configuration

All runtime settings are read from `.env`:

| Variable             | Purpose                                       |
|----------------------|-----------------------------------------------|
| `VITE_API_HOST`      | Backend base URL                              |
| `VITE_API_KEY`       | Bearer token for API calls                    |
| `VITE_MAIL_DOMAIN`   | Default domain when API returns none          |
| `VITE_POLL_MS`       | Inbox poll interval (default `8000`)          |
| `VITE_THEME`         | Initial theme: `midnight` or `paper`          |

## Backend Contract

ClawMail expects a backend exposing these endpoints:

```
GET    /domains          → { domains: string[] }
POST   /generate         → { id, address }
GET    /inbox/:id        → { messages: Message[] }
GET    /message/:id      → Message
GET    /code/:id         → { code: string }
DELETE /email/:id        → { ok: boolean }
```

A `Message` looks like:

```json
{
  "id": "msg-123",
  "from": "no-reply@service.com",
  "subject": "Your verification code",
  "text": "Your code is 123456",
  "html": "<p>Your code is 123456</p>",
  "timestamp": 1715769600000
}
```

You can plug in any backend that matches this shape — Cloudflare Workers + KV, a Node.js service, or any temp-mail provider behind an adapter.

## Build

```bash
npm run build      # output → dist/
npm run preview    # serve dist/ locally
```

## Project Layout

```
clawmail/
├── index.html         # Entry markup
├── public/            # Static assets
├── src/
│   ├── main.js        # App logic
│   └── style.css      # All styles
├── vite.config.js     # Vite config (port 5180, host 127.0.0.1)
├── .env.example       # Configuration template
└── package.json
```

## Deployment

`dist/` is a static bundle — drop it on any static host:

- Cloudflare Pages
- Vercel
- Netlify
- GitHub Pages
- Any S3-compatible bucket with a CDN

## Category Detection

ClawMail tags incoming messages locally before display:

- **otp** — subject or body contains `code`, `otp`, `verify`, `verification`, or `confirm` along with a 4-8 digit number
- **promo** — keywords like `unsubscribe`, `promotion`, `offer`, `deal`, `discount`
- **spam** — explicit `spam`, `phishing`, `suspicious` markers

Detection is heuristic and runs client-side — your backend can override by returning a `category` field on each message.

## Notes

- Messages and OTP codes are processed in the browser. Nothing is logged.
- HTML view uses a sandboxed iframe (`sandbox="allow-same-origin"`) to neutralize scripts.
- Session resumes automatically after page reload until you click **Delete**.

## License

MIT
