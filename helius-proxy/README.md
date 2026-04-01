# AnalDog Helius Proxy

A simple Express server that proxies Helius API requests for the AnalDog chat on the $ANAL website.

## Purpose

Enables the chat bot to fetch real-time Solana blockchain data (token info, holders, supply) without CORS issues.

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /` | Health check |
| `GET /api/token` | Token metadata from Helius |
| `GET /api/holders` | Top token holders |
| `GET /api/supply` | Token supply info |
| `GET /api/transactions` | Recent transactions |
| `GET /api/account/:address` | Token balance for wallet |

## Environment Variables

- `HELIUS_API_KEY` — **Required.** Your Helius API key (never commit this; set it only in Railway or local `.env`).
- `TOKEN_MINT` — Optional. SPL mint address (defaults to the public $ANAL mint).
- `PORT` — Server port (default: 3000).
- `ALLOWED_ORIGINS` — Optional. Comma-separated list of browser origins allowed for CORS (e.g. `https://prismblanco.github.io,https://analbylana.xyz`). If unset, all origins are allowed (fine for development; tighten for production).

If this key was ever committed to git, **rotate it** in the [Helius dashboard](https://www.helius.dev/) and update Railway.

## Deployment to Railway

1. Create new project on Railway
2. Connect GitHub repo or deploy from CLI
3. Add `HELIUS_API_KEY` in **Variables** (and optionally `ALLOWED_ORIGINS` for your live site origins)
4. Deploy!

## Usage in Frontend

```javascript
// Fetch token data
const response = await fetch('https://your-railway-url.railway.app/api/token');
const data = await response.json();
```
