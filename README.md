# analx

Monorepo for **$ANAL** / **Anal by lana.ai**: static site plus **one backend** (Helius + AnalX chat).

| Directory | Role |
|-----------|------|
| `website/` | Static site. **`lana-talk.html`** — wallet connect; Helius verifies ANAL (≥42,069 for access; tiered Kimi prompts). |
| `api/` | **Production backend** — Express app: Helius proxy routes + `POST /api/chat` (Kimi). Deploy this to Railway. |
| `helius-proxy/`, `ai-agent/` | Legacy split (optional reference); behavior lives in `api/`. |

## Railway (one project, one service)

1. Connect this GitHub repo; root **`Dockerfile`** builds **`api/`** (see `railway.json`).
2. **Variables** (same service):
   - `HELIUS_API_KEY` — required  
   - `KIMI_API_KEY` — required  
   - Optional: `TOKEN_MINT`, `KIMI_TEMPERATURE`, `ALLOWED_ORIGINS`, `CORS_EXTRA_ORIGINS` (merged with `ALLOWED_ORIGINS` for extra hosts, e.g. `https://analbylana.xyz,https://www.analbylana.xyz`), `HELIUS_FETCH_TIMEOUT_MS` (default `12000` — avoids Railway **502** / fake “CORS” when Helius is slow), `MAX_USER_CHAT_PROMPTS` (default `5` for **no** `wallet` on `/api/chat`), `CHAT_LIMIT_MESSAGE`. **Holder chat** (body includes `wallet`): Helius checks ANAL balance — default **≥ 42,069** ANAL → **10** prompts; **> 1,000,000** ANAL → **20** prompts. Tune with `ANAL_TIER1_MIN_UI`, `ANAL_TIER2_BOUND_UI`, `ANAL_TIER1_PROMPTS`, `ANAL_TIER2_PROMPTS`. For `ALLOWED_ORIGINS`, use comma-separated origins (newlines OK). Add `https://anondevv69.github.io` for GitHub Pages testing. If both `ALLOWED_ORIGINS` and `CORS_EXTRA_ORIGINS` are empty, all origins are allowed (dev only).
3. Deploy. Copy the public `*.up.railway.app` URL into `website/index.html` as **`CONFIG.API_URL`** (one URL for both chat and on-chain helpers).

No `SERVICE` build arg — removed.

## Chat behavior

On-chain intents hit `/api/supply`, `/api/holders`, etc. on **the same host**; everything else goes to `POST /api/chat`. Persona: DYOR, internal agent for stack questions, no keys in the browser.

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
