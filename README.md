# analx

Monorepo for **$ANAL** / **Anal by lana.ai**: static site, Helius proxy (on-chain data), and **AnalX** Kimi chat agent.

| Directory | Role |
|-----------|------|
| `website/` | Single-page site (GitHub Pages, Vercel, Netlify, or static host). |
| `helius-proxy/` | Express proxy for Helius RPC — **keep `HELIUS_API_KEY` on the server only** (e.g. Railway). |
| `ai-agent/` | Express + Kimi — **keep `KIMI_API_KEY` on the server only**. |

## Chat behavior

- **Explicit on-chain questions** (supply, holders, token/mint metadata, recent txs, lock schedule) are answered from Helius or fixed token facts in the browser.
- **Everything else** goes to the chat backend so conversations stay unique, with jokes and education about **$ANAL** and **lana.ai**; off-topic messages pivot back to the token. The AnalX **system prompt** matches the site persona (DYOR, no financial advice; stack questions → “internal agent”; never keys or private transfer gossip).

## Privacy (persona)

- Secrets stay in Railway env vars only. Health and `/api/chat` JSON do **not** expose provider names.

## Environment variables

**helius-proxy:** `HELIUS_API_KEY` (required), optional `TOKEN_MINT`, `PORT`, `ALLOWED_ORIGINS`.

**ai-agent:** `KIMI_API_KEY` (required), optional `KIMI_TEMPERATURE` (default `0.82`), `PORT`, `ALLOWED_ORIGINS`.

**website:** Set `CONFIG.AI_URL` and `CONFIG.HELIUS_URL` in `website/index.html` to your deployed Railway URLs (no secrets in the frontend).

## Railway (this repo)

Two **services** from the same GitHub repo (deploy each folder with **Railway CLI** `railway up` from `helius-proxy/` and `ai-agent/`, or set **Root Directory** in the dashboard).

| Service (example name) | Folder | Required variables |
|--------------------------|--------|---------------------|
| Helius proxy | `helius-proxy/` | `HELIUS_API_KEY` |
| AnalX chat | `ai-agent/` | `KIMI_API_KEY` |

After first deploy, open **Railway → project → each service → Variables**, add the keys, and **Redeploy** (or let Railway redeploy on save). `PORT` is set automatically.

Optional on both: `ALLOWED_ORIGINS` — comma-separated origins for your live site (e.g. `https://YOURNAME.github.io,https://yourdomain.xyz`).

Then set `CONFIG.AI_URL` and `CONFIG.HELIUS_URL` in `website/index.html` to your two `*.up.railway.app` URLs and redeploy GitHub Pages if needed.

## Repository

Remote: [github.com/anondevv69/analx](https://github.com/anondevv69/analx)
