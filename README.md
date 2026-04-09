# analx

Monorepo for **$ANAL** / **Anal by lana.ai**: static site plus **one backend** (Helius + AnalX chat).

| Directory | Role |
|-----------|------|
| `website/` | **`lana-talk.html`** — wallet connect; ≥42,069 ANAL unlocks **Anal chat** (Helius-backed); users paste addresses or Solscan links in messages. |
| `api/` | Express: **`POST /api/helius/rpc`**, **[Enhanced Transactions](https://www.helius.dev/docs/api-reference/enhanced-transactions/overview)** proxies (`/api/helius/enhanced/...`, holder gate), `POST /api/chat` (Kimi, home page). |
| `helius-proxy/`, `ai-agent/` | Legacy split (optional reference); behavior lives in `api/`. |

## Railway (one project, one service)

1. Connect this GitHub repo; root **`Dockerfile`** builds **`api/`** (see `railway.json`).
2. **Variables** (same service):
   - `HELIUS_API_KEY` — required  
   - `KIMI_API_KEY` — required (Bearer token for the **LLM** HTTP API — **not** your kimi.com web login)  
   - Optional LLM routing (defaults match Kimi’s consumer API host):  
     - `KIMI_API_URL` — default `https://api.kimi.com/v1/chat/completions`. For **[Moonshot Open Platform](https://platform.moonshot.ai)** keys (`sk-…`), set `https://api.moonshot.ai/v1/chat/completions` (China: `https://api.moonshot.cn/v1/chat/completions`).  
     - `KIMI_MODEL` — default `kimi-latest`. On Moonshot, use a model id from their docs (e.g. `kimi-k2.5`, `kimi-k2-turbo-preview`). Mismatched URL + key + model often returns **HTML** instead of JSON.  
   - **Grok (xAI)** — set `XAI_API_KEY` (or `GROK_API_KEY`), optional `XAI_API_URL` (default `https://api.x.ai/v1/chat/completions`), optional `XAI_MODEL` (default `grok-3`; use e.g. `grok-3-mini` for lower cost — see [xAI models](https://docs.x.ai/docs/models)). If **`KIMI_API_KEY` is unset** and `XAI_API_KEY` is set, the server **defaults to Grok** (no need for `LLM_PROVIDER`). If both keys exist, set **`LLM_PROVIDER=grok`** to force Grok, or remove `KIMI_API_KEY` so only xAI is used.  
   - Optional: `TOKEN_MINT`, `KIMI_TEMPERATURE`, `ALLOWED_ORIGINS`, `CORS_EXTRA_ORIGINS`, `HELIUS_FETCH_TIMEOUT_MS` (default `12000`), `MAX_USER_CHAT_PROMPTS`, `CHAT_LIMIT_MESSAGE`, `KIMI_MAX_TOKENS` (default `512` for **`/api/chat`** on the home page). **`HOLDER_TOOLS_PASSWORD`** — when set, `lana-talk.html` and holder-tool API routes require header `X-Holder-Tools-Password` (browser stores it in `sessionStorage` after `POST /api/holder-tools/auth`). Omit to leave tools open. **`JUPITER_API_KEY`** — optional; enables [Jupiter](https://dev.jup.ag/) `toptrending/24h` data in **`POST /api/holder/helius-chat`** when users ask about trending / 24h movers. **`KIMI_MAX_TOKENS_HELIUS_CHAT`** (default `2048`) — max tokens for that route. **Holder gate** (`/api/holder/anal`, **`POST /api/helius/rpc`**): same ANAL thresholds — `ANAL_TIER1_MIN_UI`, `ANAL_TIER2_BOUND_UI`, `ANAL_TIER1_PROMPTS`, `ANAL_TIER2_PROMPTS` still shape `promptLimit` / `tier` on the holder status object (`eligibleForChat` = ≥ min ANAL). For `ALLOWED_ORIGINS` / `CORS_EXTRA_ORIGINS`, see above. If both origin vars are empty, all origins are allowed (dev only).
3. Deploy. Copy the public **`*.up.railway.app` URL** from Railway into **`website/index.html`** and **`website/lana-talk.html`** as **`CONFIG.API_URL`** (same URL for chat, holder verify, and on-chain helpers). Railway may assign a new hostname (e.g. after recreating the service) — update both files if the API URL changes or the site will call a dead host and show false “CORS” errors.

No `SERVICE` build arg — removed.

## Chat behavior

Home page: on-chain keywords hit `/api/supply`, `/api/holders`, etc.; other messages go to **`POST /api/chat`** (Kimi, AnalX persona). No `wallet` field — **5** turns per refresh (`MAX_USER_CHAT_PROMPTS`).

## Helius holder chat (`lana-talk.html`)

After wallet verification (≥42,069 ANAL) and optional **`HOLDER_TOOLS_PASSWORD`**:

- **`POST /api/holder/helius-chat`** — `{ "wallet", "message", "history" }`. LLM + `api/helius-chat-prompt.js`; server injects **Helius** DAS + holder snapshot, and **Jupiter** trending (if `JUPITER_API_KEY` set) when the user asks market/trend-style questions. **`history`** supports long threads (default last **24** messages; override with **`HELIUS_CHAT_HISTORY_MESSAGES`**, max 48). Tier prompt limits match holder tiers (`ANAL_TIER*_PROMPTS`).
- **`POST /api/helius/rpc`** — `{ "wallet", "method", "params" }` (allowlisted read-only). **`GET /api/helius/allowed-methods`** lists methods.
- **Enhanced Transactions** ([Helius docs](https://www.helius.dev/docs/api-reference/enhanced-transactions/overview)): **`POST /api/helius/enhanced/transactions`**, **`GET /api/helius/enhanced/addresses/:address/transactions?wallet=...`**

**Other read-only shortcuts (password-gated with holder tools):** `GET /api/wallet/:address/signatures`, `GET /api/tx/:signature`, `POST /api/das/assets-by-owner`, `GET /api/account/:address`.

## Custom domain (`analbylana.xyz`)

### GitHub

1. **Settings → Pages → Source:** **GitHub Actions** (workflow “Deploy site to GitHub Pages” must run successfully at least once).
2. **Settings → Pages → Custom domain:** add **`analbylana.xyz`**, Save.  
   If you also want **`www.analbylana.xyz`**, add it under the same section (or tick the option to add the `www` variant — GitHub will show both as “alternate” names).

> Publishing from **GitHub Actions** means the `website/CNAME` file is **not** what proves the domain to GitHub — [GitHub ignores it for Actions](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site). The domain you type under **Settings → Pages** is what matters. **DNS must still point at GitHub** or you get `NotServedByPagesError`.

### DNS at your registrar

Exact **A**, **AAAA**, and **`www` CNAME** values for GitHub Pages change over time and should not live in this README. Use GitHub’s official guide: **[Managing a custom domain for your GitHub Pages site](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site)** — after you add the domain under **Settings → Pages**, GitHub shows the records to create at your DNS host.

**Tips:** remove conflicting old apex/`www` records first; if you use **Cloudflare**, set GitHub records to **DNS only** (grey cloud); if you use **CAA**, allow Let’s Encrypt per [HTTPS for Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/securing-your-github-pages-site-with-https). After DNS propagates, click **Save** again on the custom domain in Pages if the check was pending.

### Railway

Set **`ALLOWED_ORIGINS`** to include `https://analbylana.xyz` and, if used, `https://www.analbylana.xyz`.

## Repository

Remote: [github.com/anondevv69/analx](https://github.com/anondevv69/analx)
