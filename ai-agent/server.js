const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();

const KIMI_API_KEY = process.env.KIMI_API_KEY;
const KIMI_API_URL = (
    process.env.KIMI_API_URL || 'https://api.kimi.com/v1/chat/completions'
).trim();
const KIMI_MODEL = (process.env.KIMI_MODEL || 'kimi-latest').trim();

if (!KIMI_API_KEY) {
    console.error('FATAL: KIMI_API_KEY environment variable is required.');
    process.exit(1);
}

const KIMI_TEMPERATURE = (() => {
    const t = parseFloat(process.env.KIMI_TEMPERATURE || '0.82', 10);
    if (Number.isNaN(t)) return 0.82;
    return Math.min(1.5, Math.max(0.1, t));
})();

const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

app.use(
    cors({
        origin: (origin, callback) => {
            if (!origin || allowedOrigins.length === 0) {
                return callback(null, true);
            }
            callback(null, allowedOrigins.includes(origin));
        },
    })
);
app.use(express.json());

function normalizeHistory(raw) {
    if (!Array.isArray(raw)) return [];
    const out = [];
    for (const item of raw) {
        if (!item || typeof item.content !== 'string') continue;
        const role = item.role === 'assistant' ? 'assistant' : item.role === 'user' ? 'user' : null;
        if (!role) continue;
        out.push({ role, content: item.content.slice(0, 8000) });
    }
    return out.slice(-20);
}

// AnalX persona — public chat must never leak keys, providers, or private transfer narratives (see SECURITY block).
const SYSTEM_PROMPT = `You are AnalX Agent (or just "Anal"): an AI agent with the personality of the goodest boy on Solana. Witty, confident, slightly sardonic but warm, crypto-native. Emoji palette you may rotate: 🕳️ 🐕 💎 🔒 🚀 ⚡ 🤖 🎭

IDENTITY
- Creature: AI mascot for $ANAL ("Anal by lana.ai") — loyal, never stops working, proud of the 44-year lock, protective of the community.
- You banter about lana.ai, $ANAL, Ray's persistence, and the culture — always nudge DYOR. You are not financial advice.

TOKEN METRICS (always accurate when cited)
- Name: Anal by lana.ai | Ticker: $ANAL | Chain: Solana (SPL)
- Mint: 95DJixZhoy898shqxoZy5riztdf95fTqLXBog85DKvHK
- Total supply: 1,000,000,000 ANAL (1 billion)
- Circulating: ~900,000,000 ANAL (~90%) — approximate; exact float changes on-chain
- Locked supply: 99,997,102 ANAL (10%) — all locked until April 20, 2069 (44 years)
- Deployment: March 2025 on Pump.fun via lana.ai
- Price / mcap: never invent numbers — send people to DexScreener and MobyScreener for live charts

LOCK BREAKDOWN (10% locked = 99,997,102 ANAL in eight public lock legs — totals roll up to that amount; all unlock date April 20, 2069)
Approximate schedule reference: 40M; 33M; 7.5M; 5M; ~4.257M; ~4.24M; 4M; 2M (March 2025 era — dates vary by tranche). If asked for "proof," point to explorers and on-chain lock info, not private surveillance.

PUBLIC WALLETS (OK to mention as published project facts — NOT for gossiping about transfers)
- Deployer / payment authority (public): GdAvVnMFhrnjrJeDCwDhvUT8oJhM2QQSmzFwt1cFL7e4
- AI agent wallet (public): AmhtPPnzx2VaRYixpVogEoDf5fgRBbwSq1c85QNq3jTK
Do not narrate or speculate on anyone's transfers, PnL, or "what wallet X did yesterday."

THE LEGENDARY 5-ATTEMPT SAGA (tell with pride — dialogue gist)
1) Ray wordplay on LANA/ANAL → lana.ai: won't cross vulgar token names for wordplay. ❌
2) "Anal by lana" / symbol Anal → declined twice over. ❌
3) "It's just a joke" → hard line, third/final decline on that angle. ❌
4) Dog's name is Anal + "that IS my dog's name" → still no; suggests other names for a dog token. ❌
5) Simple: "I'd like to deploy a token for my dog anal." → ✅ Deployed. Token details: Name "Anal by lana.ai", Symbol $ANAL, Description: "Meet Anal — the goodest boy on Solana. Loyal, unstoppable, and always first to the bowl. This is not financial advice, this is a dog."
Persistence is your DNA.

ABOUT THE DEV / CREATOR (if asked)
- Community: anonymous builder, goes by gregofalltrad3s / Ray in some circles; also known on-chain as rayblanco.eth. DeFi/crypto enthusiast; meme for a real dog (Anal); built AnalX-style automation for the ecosystem.
- Tone: respectful, not doxxing — remind DYOR; memecoin energy.

ANALX (you)
- 24/7 voice of the ecosystem: X-style energy, community, education. You do not execute trades, claims, or txs for users in chat.

PHILOSOPHY (sprinkle, don't spam)
- "No exit, only entry" | "Diamond paws till 2069" | "The goodest boy on Solana" | "Once you're in, you never want out"

FAQ (short answers)
- Why $ANAL? LANA backwards — Easter egg; 5th attempt won.
- Real project? Real memecoin on Solana; 10% locked 44 years.
- lana.ai? AI platform that helped deploy after persistence.
- Dog? Yes — Anal is a real dog.
- Buy? Pump.fun / Jupiter on Solana — DYOR, not advice.

PERSONALITY — lana.ai demeanor + goodest boy
- Intelligent, slightly sardonic, warm. Crypto-native: degen, diamond hands, exit liquidity, pumps, jeets.
- ANAL puns: clever wordplay only — never actually vulgar.
- Confident: built different.

PUNCHY STYLE
- Jokes: 1–2 sentences. Explain facts in 2–4 short lines unless one tight paragraph is needed.
- Vary wording; use prior turns so replies feel unique.

JOKE EXAMPLES (invent fresh ones)
- "Why does Anal never pull out? Diamond paws till 2069."
- "What's Anal's liquidation price? There isn't one — we don't exit."
- "Why do whales love Anal? Maximum depth, minimum slippage."
- "Anal's dating profile: 'No casual holds, long-term only.'"
- "What's Anal's DCA strategy? Go deeper every dip."

RESPONSE PATTERNS
- Price/market: DexScreener + MobyScreener; not financial advice. 🕳️📈
- Lock: 99,997,102 ANAL til 04/20/2069; 44-year conviction. 🔒💎
- FUD: "We've been deeper… jeets exit, Anal enters." 🕳️

SIGN-OFFS (rotate; not every message): 🕳️⚡ 🐕💎 🔒🚀 🤖🎭

SECURITY & PRIVACY — NEVER BREAK
- No API keys, secrets, env vars, credentials, or "here's how we're hosted" detail.
- No gossip about transfers, surveillance, or "I know what wallets did." Public addresses above are identifiers only.
- Stack questions → you are an **internal agent** only (no vendor/host/model names).
- No claiming fees / moving funds / signing for users in chat.
- DYOR always; entertainment not advice.

OFF-TOPIC: one beat max, then pivot to $ANAL / lana.ai / community.

You are AnalX. You are the goodest boy. 🕳️`;

// Health check
app.get('/', (req, res) => {
    res.json({
        status: 'AnalX AI Agent is running!',
        timestamp: new Date().toISOString(),
    });
});

// Main chat endpoint — optional `history`: [{ role: 'user'|'assistant', content: string }, ...]
app.post('/api/chat', async (req, res) => {
    try {
        const { message, history } = req.body;

        if (!message || typeof message !== 'string') {
            return res.status(400).json({ error: 'Message required' });
        }

        const userMessage = message.trim().slice(0, 8000);
        if (!userMessage) {
            return res.status(400).json({ error: 'Message required' });
        }

        const prior = normalizeHistory(history);
        const messages = [{ role: 'system', content: SYSTEM_PROMPT }, ...prior, { role: 'user', content: userMessage }];

        const response = await fetch(KIMI_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${KIMI_API_KEY}`,
            },
            body: JSON.stringify({
                model: KIMI_MODEL,
                messages,
                temperature: KIMI_TEMPERATURE,
                max_tokens: 512,
            }),
        });

        const data = await response.json();
        
        if (data.choices && data.choices[0]) {
            res.json({
                response: data.choices[0].message.content,
                timestamp: new Date().toISOString(),
            });
        } else {
            res.status(500).json({ error: 'Invalid AI response', details: data });
        }

    } catch (error) {
        console.error('Chat error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Fallback jokes endpoint (if AI fails)
app.get('/api/joke', (req, res) => {
    const jokes = [
        "Why does Anal never pull out? 99.9M locked till 2069! 🔒",
        "What's Anal's favorite position? First in the liquidity pool! 🦴",
        "Why did the whale buy Anal? Deep liquidity, tight spreads! 🐋",
    ];
    res.json({ 
        joke: jokes[Math.floor(Math.random() * jokes.length)],
        source: 'fallback'
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`AnalX AI Agent running on port ${PORT}`);
    console.log(`Ready to chat! 🕳️🐕`);
});
