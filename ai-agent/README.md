# AnalX AI Agent

AI-powered chat backend for $ANAL token website. The **AnalX system prompt** in `server.js` is the full public persona (lana.ai story, token table, banter, DYOR). Operators configure the LLM via env; **end users** should only hear that AnalX is an **internal agent** if they ask about stack — API responses do not name providers.

## Features

- 🧠 **Kimi AI Integration** - Smart, contextual responses
- 🎭 **AnalX Personality** - Witty, crypto-savvy, dog-themed
- 🕳️ **Unlimited Jokes** - AI generates fresh jokes every time
- 📊 **Token Knowledge** - Knows all $ANAL facts and stats
- ⚡ **Fast Responses** - Optimized for quick chat experience

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Health check |
| `/api/chat` | POST | Chat (`message` required; optional `history` array of `{ role, content }` for multi-turn context) |
| `/api/joke` | GET | Fallback jokes if AI unavailable |

## Environment Variables

```bash
KIMI_API_KEY=your_kimi_api_key_here
# Optional: Moonshot platform (sk- keys) — match URL + model to their docs
# KIMI_API_URL=https://api.moonshot.ai/v1/chat/completions
# KIMI_MODEL=kimi-k2.5
PORT=3000
# Optional: slightly higher = more varied lines (default 0.82)
# KIMI_TEMPERATURE=0.82
# Optional: lock CORS to your site(s), comma-separated
# ALLOWED_ORIGINS=https://prismblanco.github.io,https://analbylana.xyz
```

## Deployment to Railway

1. Push this repo to GitHub
2. Connect Railway to the repo
3. Add `KIMI_API_KEY` in **Variables** (and optionally `ALLOWED_ORIGINS`)
4. Deploy!

## Frontend Integration

```javascript
const AI_URL = 'https://your-railway-url.railway.app';

async function getAIResponse(message, history = []) {
    const response = await fetch(`${AI_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, history }),
    });
    const data = await response.json();
    return data.response;
}
```

## About Kimi API

- Website: https://www.moonshot.cn
- Get API key from: https://platform.moonshot.cn
- Pricing: Pay-as-you-go per tokens used

---

🕳️🐕 Powered by AnalX Agent
