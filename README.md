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

The repo root is a **monorepo** (no root `package.json`). Railway’s **Railpack** builder cannot infer a single app from `./` alone — use the **root `Dockerfile`** (see `railway.json`).

### Option A — Root Dockerfile (recommended for GitHub deploys from repo root)

1. Create **two services** in one Railway project, both connected to this GitHub repo (root path `/`).
2. For **each** service, open **Variables** and add:
   - **AnalX (chat):** `SERVICE` = `ai-agent` and `KIMI_API_KEY` = your key  
   - **Helius proxy:** `SERVICE` = `helius-proxy` and `HELIUS_API_KEY` = your key  

   Railway passes `SERVICE` into the Docker build so the correct folder is copied. If you omit `SERVICE`, the image defaults to **`ai-agent`**.

3. Redeploy after saving variables. `PORT` is set by Railway; the apps listen on `process.env.PORT`.

Optional on both: `ALLOWED_ORIGINS` — comma-separated origins for your live site.

### Option B — Subdirectory (no root `Dockerfile` needed)

In **Settings → Source → Root Directory**, set **`ai-agent`** or **`helius-proxy`**. Then Railpack/Nixpacks sees `package.json` in that folder. Use the small `Dockerfile` inside each folder if you prefer Docker.

### Secrets

Add `HELIUS_API_KEY` / `KIMI_API_KEY` only in Railway **Variables**, never in the repo.

Then set `CONFIG.AI_URL` and `CONFIG.HELIUS_URL` in `website/index.html` to your two `*.up.railway.app` URLs.

## Repository

Remote: [github.com/anondevv69/analx](https://github.com/anondevv69/analx)
