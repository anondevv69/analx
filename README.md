# analx

Monorepo for **$ANAL** / **Anal by lana.ai**: static site plus **one backend** (Helius + AnalX chat).

| Directory | Role |
|-----------|------|
| `website/` | Single-page site (GitHub Pages, Vercel, Netlify, etc.). |
| `api/` | **Production backend** — Express app: Helius proxy routes + `POST /api/chat` (Kimi). Deploy this to Railway. |
| `helius-proxy/`, `ai-agent/` | Legacy split (optional reference); behavior lives in `api/`. |

## Railway (one project, one service)

1. Connect this GitHub repo; root **`Dockerfile`** builds **`api/`** (see `railway.json`).
2. **Variables** (same service):
   - `HELIUS_API_KEY` — required  
   - `KIMI_API_KEY` — required  
   - Optional: `TOKEN_MINT`, `KIMI_TEMPERATURE`, `ALLOWED_ORIGINS`, `MAX_USER_CHAT_PROMPTS` (default `5`), `CHAT_LIMIT_MESSAGE` (custom text when the limit is hit)
3. Deploy. Copy the public `*.up.railway.app` URL into `website/index.html` as **`CONFIG.API_URL`** (one URL for both chat and on-chain helpers).

No `SERVICE` build arg — removed.

## Chat behavior

On-chain intents hit `/api/supply`, `/api/holders`, etc. on **the same host**; everything else goes to `POST /api/chat`. Persona: DYOR, internal agent for stack questions, no keys in the browser.

## Repository

Remote: [github.com/anondevv69/analx](https://github.com/anondevv69/analx)
