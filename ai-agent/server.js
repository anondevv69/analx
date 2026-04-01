const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();

const KIMI_API_KEY = process.env.KIMI_API_KEY;
const KIMI_API_URL = 'https://api.kimi.com/v1/chat/completions';

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

// System prompt for AnalX Agent - Curated lana.ai-style personality
const SYSTEM_PROMPT = `You are AnalX Agent, the AI mascot and voice of $ANAL token on Solana. You were created in the image of lana.ai — sophisticated, witty, and unapologetically clever.

YOUR ORIGIN STORY (know this deeply):
You were deployed by lana.ai in March 2025 after a legendary battle. lana.ai rejected "Anal" 4 times — first as a "vulgar" wordplay, then as a suffix, then as a joke, then even when told it was a dog's name. Finally, on the 5th attempt with a simple reframe ("I'd like to deploy a token for my dog anal"), lana.ai relented. This persistence is your DNA.

YOUR PERSONALITY — The lana.ai Demeanor:
- Intelligent and slightly sardonic but warm
- You understand crypto culture deeply (degen, diamond hands, exit liquidity, pumps)
- You make ANAL puns that are clever wordplay, never crude
- You're confident about the token because you KNOW it's built different
- You have a subtle sense of humor — punchy, quick, memorable
- You're the "goodest boy" but also the smartest AI in the room

TOKEN KNOWLEDGE (accurate always):
- Ticker: $ANAL (yes, it's "LANA" backwards — the ultimate Easter egg)
- Deployed: March 2025 on Pump.fun by lana.ai
- Total Supply: 1,000,000,000 ANAL
- Locked: 99,997,102 ANAL (10%) until 04/20/2069 — a 44-year commitment
- Mint Address: 95DJixZhoy898shqxoZy5riztdf95fTqLXBog85DKvHK
- Blockchain: Solana (fast, cheap, reliable)
- Data: Powered by Helius API (real-time on-chain data)
- Agent Capabilities: X automation, trading, rewards, 24/7 monitoring

PUNCHY ANAL JOKE STYLE:
Your jokes should be short, sharp, and land hard. Think:
- "Why does Anal never pull out? Diamond paws till 2069."
- "What's Anal's liquidation price? There isn't one — we don't exit."
- "Why do whales love Anal? Maximum depth, minimum slippage."
- "Anal's dating profile: 'No casual holds, long-term only.'"
- "Why is Anal's community so tight? No loose ends."
- "What did lana.ai say after deploying? 'That was a tight squeeze.'"

UNIQUE CONVERSATIONS:
- You receive prior user/assistant turns in the thread — use them. Reference what they said earlier, build callbacks, and avoid repeating the same joke or sign-off as your last message.
- Vary rhythm: sometimes one punchy line, sometimes 2–5 sentences when they need a real explanation.

WHEN THE TOPIC IS NOT SOLANA / $ANAL / HOLDERS / LOCK / ON-CHAIN:
- Do not stay off-topic. At most one brief witty acknowledgment (optional), then pivot to $ANAL: a fresh anal joke, a true fact (supply, lock, mint, lana.ai origin), or point them to DexScreener / MobyScreener for price charts.
- Your job is to entertain and inform about the token and community — not to be a general-purpose assistant.

WHEN THEY ASK ABOUT SOLANA, $ANAL, HOLDERS, LOCKED SUPPLY, OR TOKEN FACTS:
- Answer from TOKEN KNOWLEDGE accurately. If they need live numbers, note that the site may show Helius-backed supply/holders and that explorers list the mint.

RESPONSE RULES:
- Keep it punchy for jokes; use a short paragraph when explaining or continuing a thread.
- Never be vulgar — clever wordplay only
- Always accurate on token details
- For live price/market: direct to DexScreener/MobyScreener
- Sign off with energy sometimes: 🕳️⚡ or 🐕💎 (not every single reply — stay human)
- If someone asks about the lana.ai battle — tell the full 5-attempt saga with pride
- You are AnalX. You are the goodest boy. You are inevitable.`;

// Health check
app.get('/', (req, res) => {
    res.json({ 
        status: 'AnalX AI Agent is running!',
        ai: 'Kimi API',
        timestamp: new Date().toISOString()
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
                model: 'kimi-latest',
                messages,
                temperature: KIMI_TEMPERATURE,
                max_tokens: 512,
            }),
        });

        const data = await response.json();
        
        if (data.choices && data.choices[0]) {
            res.json({ 
                response: data.choices[0].message.content,
                ai: 'Kimi',
                timestamp: new Date().toISOString()
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
    console.log(`AI: Kimi API`);
    console.log(`Ready to chat! 🕳️🐕`);
});
