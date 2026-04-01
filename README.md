# analx

Monorepo for **$ANAL** / **Anal by lana.ai**: static site, Helius proxy (on-chain data), and **AnalX** Kimi chat agent.

| Directory | Role |
|-----------|------|
| `website/` | Single-page site (GitHub Pages, Vercel, Netlify, or static host). |
| `helius-proxy/` | Express proxy for Helius RPC — **keep `HELIUS_API_KEY` on the server only** (e.g. Railway). |
| `ai-agent/` | Express + Kimi — **keep `KIMI_API_KEY` on the server only**. |

## Chat behavior

- **Explicit on-chain questions** (supply, holders, token/mint metadata, recent txs, lock schedule) are answered from Helius or fixed token facts in the browser.
- **Everything else** goes to **Kimi** so conversations stay unique, with jokes and education about **$ANAL** and **lana.ai**; off-topic messages get a quick pivot back to the token.

## Environment variables

**helius-proxy:** `HELIUS_API_KEY` (required), optional `TOKEN_MINT`, `PORT`, `ALLOWED_ORIGINS`.

**ai-agent:** `KIMI_API_KEY` (required), optional `KIMI_TEMPERATURE` (default `0.82`), `PORT`, `ALLOWED_ORIGINS`.

**website:** Set `CONFIG.AI_URL` and `CONFIG.HELIUS_URL` in `website/index.html` to your deployed Railway URLs (no secrets in the frontend).

## Repository

Remote: [github.com/anondevv69/analx](https://github.com/anondevv69/analx)
