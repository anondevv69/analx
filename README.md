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

## Custom domain (`analbylana.xyz`)

1. **Push** this repo (includes `.github/workflows/pages.yml` and `website/CNAME`).
2. On GitHub: **Settings → Pages → Build and deployment → Source:** **GitHub Actions** (pick the “Deploy site to GitHub Pages” workflow if prompted).
3. **Settings → Pages → Custom domain:** enter `analbylana.xyz`, save, wait for DNS check, then enable **Enforce HTTPS** when available.
4. At your **registrar** (where you bought the domain), add DNS per [GitHub’s custom domain docs](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site#configuring-an-apex-domain):
   - **Apex** (`analbylana.xyz`): **A** records → `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`  
   - **Optional `www`:** **CNAME** → `<your-username>.github.io` (e.g. `anondevv69.github.io`)

DNS can take up to an hour (sometimes longer). `website/CNAME` tells Pages which hostname to serve.

**Railway API:** In your API service variables, set `ALLOWED_ORIGINS` to include `https://analbylana.xyz` (and `https://www.analbylana.xyz` if you use `www`), so the browser can call your API from that site.

## Repository

Remote: [github.com/anondevv69/analx](https://github.com/anondevv69/analx)
