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

### DNS at your registrar (this fixes “Domain does not resolve to the GitHub Pages server”)

Create **all** of the following (remove old **A**/**AAAA** records that point somewhere else first — parking pages, old hosts, etc.):

| Host / name | Type | Value |
|-------------|------|--------|
| `@` (or `analbylana.xyz`, apex) | **A** | `185.199.108.153` |
| same | **A** | `185.199.109.153` |
| same | **A** | `185.199.110.153` |
| same | **A** | `185.199.111.153` |
| `@` (optional IPv6) | **AAAA** | `2606:50c0:8000::153` |
| same | **AAAA** | `2606:50c0:8001::153` |
| same | **AAAA** | `2606:50c0:8002::153` |
| same | **AAAA** | `2606:50c0:8003::153` |
| `www` | **CNAME** | **`anondevv69.github.io`** (exactly; **no** `/analx` — [per GitHub](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site#configuring-a-subdomain)) |

#### Namecheap (DNS only — domain registered there)

1. Log in → **Domain List** → **Manage** next to `analbylana.xyz`.
2. Open the **Advanced DNS** tab.
3. Under **Host records**, remove anything that conflicts with GitHub (old **A** records to parking IPs, **URL Redirect** records for `@`/`www` if you want GitHub to serve the site — you can add redirects later from GitHub).
4. **Add New Record** four times for the apex:
   - Type **A Record**, **Host** `@`, **Value** `185.199.108.153` (TTL Automatic is fine).
   - Repeat Host `@` with `185.199.109.153`, `185.199.110.153`, and `185.199.111.153`.
5. **Add New Record:** Type **CNAME Record**, **Host** `www`, **Value** `anondevv69.github.io` (Namecheap may append a trailing dot — that’s OK).
6. Optional: add the four **AAAA** rows for Host `@` if Namecheap supports IPv6 on your plan (same values as the table above).
7. Ensure **Nameservers** are **Namecheap BasicDNS** (or Namecheap Web Hosting DNS) — not a third-party proxy — unless you know you’re managing DNS elsewhere.

**Cloudflare:** set records to **DNS only** (grey cloud), not proxied — orange cloud often breaks GitHub Pages checks.

**CAA:** if you use CAA records, ensure Let’s Encrypt is allowed, e.g. `0 issue "letsencrypt.org"` (see [HTTPS docs](https://docs.github.com/en/pages/getting-started-with-github-pages/securing-your-github-pages-site-with-https)).

Check propagation: `dig analbylana.xyz +short` should eventually return the four **185.199.*** IPs. Wait up to 24–48 hours after changes, then in **Pages** click **Save** on the custom domain again to re-check.

### Railway

Set **`ALLOWED_ORIGINS`** to include `https://analbylana.xyz` and, if used, `https://www.analbylana.xyz`.

## Repository

Remote: [github.com/anondevv69/analx](https://github.com/anondevv69/analx)
