const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const { SYSTEM_PROMPT } = require('./prompt');

const HELIUS_API_KEY = process.env.HELIUS_API_KEY;
const KIMI_API_KEY = process.env.KIMI_API_KEY;
const TOKEN_MINT = process.env.TOKEN_MINT || '95DJixZhoy898shqxoZy5riztdf95fTqLXBog85DKvHK';
const KIMI_API_URL = 'https://api.kimi.com/v1/chat/completions';

if (!HELIUS_API_KEY) {
    console.error('FATAL: HELIUS_API_KEY is required.');
    process.exit(1);
}
if (!KIMI_API_KEY) {
    console.error('FATAL: KIMI_API_KEY is required.');
    process.exit(1);
}

const KIMI_TEMPERATURE = (() => {
    const t = parseFloat(process.env.KIMI_TEMPERATURE || '0.82', 10);
    if (Number.isNaN(t)) return 0.82;
    return Math.min(1.5, Math.max(0.1, t));
})();

const MAX_USER_CHAT_PROMPTS = Math.min(
    20,
    Math.max(1, parseInt(process.env.MAX_USER_CHAT_PROMPTS || '5', 10) || 5)
);

const CHAT_LIMIT_MESSAGE =
    process.env.CHAT_LIMIT_MESSAGE ||
    "Yo — this ain't for full-blown convos, just quick $ANAL / lana.ai banter and facts. Refresh the page if you need a clean slate. DYOR. 🕳️⚡";

const allowedOriginsRaw = (process.env.ALLOWED_ORIGINS || '')
    .split(/[,;\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);

/**
 * When ALLOWED_ORIGINS is set, expand each entry so preflight succeeds for:
 * - http vs https (same host)
 * - www vs apex (e.g. analbylana.xyz vs www.analbylana.xyz are different origins)
 */
const allowedOriginsSet = (() => {
    if (allowedOriginsRaw.length === 0) return null;
    const set = new Set();
    function addHttpHttpsForHost(hostWithPort) {
        set.add(`https://${hostWithPort}`);
        set.add(`http://${hostWithPort}`);
    }
    for (const o of allowedOriginsRaw) {
        try {
            const u = new URL(o.includes('://') ? o : `https://${o}`);
            if (u.protocol !== 'http:' && u.protocol !== 'https:') continue;
            const host = u.host;
            addHttpHttpsForHost(host);
            const hn = u.hostname;
            if (hn === 'localhost' || /^\d{1,3}(\.\d{1,3}){3}$/.test(hn)) continue;
            if (hn.startsWith('www.')) {
                addHttpHttpsForHost(hn.slice(4) + (u.port ? `:${u.port}` : ''));
            } else {
                addHttpHttpsForHost(`www.${hn}` + (u.port ? `:${u.port}` : ''));
            }
        } catch (_) {
            set.add(o);
        }
    }
    return set;
})();

if (allowedOriginsSet) {
    console.log('CORS allowlist (' + allowedOriginsSet.size + ' origins):', [...allowedOriginsSet].sort().join(', '));
}

async function fetchAnalHolderStatus(walletAddress) {
    const response = await fetch(`https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'getTokenAccountsByOwner',
            params: [walletAddress, { mint: TOKEN_MINT }, { encoding: 'jsonParsed' }],
        }),
    });
    const data = await response.json();
    if (data.error) {
        return { error: data.error.message || 'Helius RPC error' };
    }
    const value = data.result?.value || [];
    let total = BigInt(0);
    let decimals = 9;
    for (const acc of value) {
        const ta = acc?.account?.data?.parsed?.info?.tokenAmount;
        if (ta) {
            try {
                total += BigInt(String(ta.amount || '0'));
            } catch (_) {
                /* ignore */
            }
            if (typeof ta.decimals === 'number') decimals = ta.decimals;
        }
    }
    const uiAmount = Number(total) / 10 ** decimals;
    return {
        address: walletAddress,
        mint: TOKEN_MINT,
        isHolder: total > BigInt(0),
        amountRaw: total.toString(),
        uiAmount,
        decimals,
    };
}

function normalizeHistory(raw) {
    if (!Array.isArray(raw)) return [];
    const out = [];
    for (const item of raw) {
        if (!item || typeof item.content !== 'string') continue;
        const role = item.role === 'assistant' ? 'assistant' : item.role === 'user' ? 'user' : null;
        if (!role) continue;
        out.push({ role, content: item.content.slice(0, 8000) });
    }
    return out.slice(-10);
}

const app = express();

app.use(
    cors({
        origin: (origin, callback) => {
            if (!origin || allowedOriginsSet === null) {
                return callback(null, true);
            }
            callback(null, allowedOriginsSet.has(origin));
        },
    })
);
app.use(express.json());

app.get('/api/holder/anal/:address', async (req, res) => {
    try {
        const { address } = req.params;
        if (!address || address.length < 32 || address.length > 52) {
            return res.status(400).json({ error: 'Invalid Solana address' });
        }
        const result = await fetchAnalHolderStatus(address);
        if (result.error) {
            return res.status(502).json({ error: result.error });
        }
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/', (req, res) => {
    res.json({
        status: 'AnalX API',
        helius: true,
        chat: true,
        timestamp: new Date().toISOString(),
    });
});

app.get('/api/token', async (req, res) => {
    try {
        const response = await fetch(`https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: '2.0',
                id: 1,
                method: 'getAsset',
                params: { id: TOKEN_MINT },
            }),
        });
        const data = await response.json();
        res.json(data.result || { error: 'No data' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/holders', async (req, res) => {
    try {
        const response = await fetch(`https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: '2.0',
                id: 1,
                method: 'getTokenLargestAccounts',
                params: [TOKEN_MINT],
            }),
        });
        const data = await response.json();
        res.json(data.result || { error: 'No data' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/supply', async (req, res) => {
    try {
        const response = await fetch(`https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: '2.0',
                id: 1,
                method: 'getTokenSupply',
                params: [TOKEN_MINT],
            }),
        });
        const data = await response.json();
        res.json(data.result || { error: 'No data' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/transactions', async (req, res) => {
    try {
        const response = await fetch(`https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: '2.0',
                id: 1,
                method: 'getSignaturesForAddress',
                params: [TOKEN_MINT, { limit: 10 }],
            }),
        });
        const data = await response.json();
        res.json(data.result || []);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/account/:address', async (req, res) => {
    try {
        const { address } = req.params;
        const response = await fetch(`https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: '2.0',
                id: 1,
                method: 'getTokenAccountsByOwner',
                params: [address, { mint: TOKEN_MINT }, { encoding: 'jsonParsed' }],
            }),
        });
        const data = await response.json();
        res.json(data.result || { error: 'No data' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

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
        const userTurnsInHistory = prior.filter((m) => m.role === 'user').length;
        if (userTurnsInHistory >= MAX_USER_CHAT_PROMPTS) {
            return res.status(429).json({
                error: 'chat_limit',
                message: CHAT_LIMIT_MESSAGE,
            });
        }

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

app.get('/api/joke', (req, res) => {
    const jokes = [
        "Why does Anal never pull out? 99.9M locked till 2069! 🔒",
        "What's Anal's favorite position? First in the liquidity pool! 🦴",
        "Why did the whale buy Anal? Deep liquidity, tight spreads! 🐋",
    ];
    res.json({
        joke: jokes[Math.floor(Math.random() * jokes.length)],
        source: 'fallback',
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`AnalX unified API on port ${PORT}`);
});
