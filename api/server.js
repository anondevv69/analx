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

/** Wallet chat (when `wallet` sent on POST /api/chat): min ANAL balance (whole tokens, UI) for any prompts */
const ANAL_TIER1_MIN_UI = Math.max(0, parseInt(process.env.ANAL_TIER1_MIN_UI || '42069', 10) || 42069);
/** Balances above this (whole tokens) get tier-2 prompt allowance */
const ANAL_TIER2_BOUND_UI = Math.max(
    ANAL_TIER1_MIN_UI,
    parseInt(process.env.ANAL_TIER2_BOUND_UI || '1000000', 10) || 1000000
);
const ANAL_TIER1_PROMPTS = Math.min(100, Math.max(1, parseInt(process.env.ANAL_TIER1_PROMPTS || '10', 10) || 10));
const ANAL_TIER2_PROMPTS = Math.min(100, Math.max(1, parseInt(process.env.ANAL_TIER2_PROMPTS || '20', 10) || 20));

function promptTierFromRawAmount(amountRawStr, decimals) {
    let raw;
    try {
        raw = BigInt(String(amountRawStr || '0'));
    } catch (_) {
        return { promptLimit: 0, tier: 0, eligible: false };
    }
    const d = Number(decimals);
    const dec = Number.isFinite(d) && d >= 0 && d <= 18 ? Math.floor(d) : 9;
    const mult = BigInt(10) ** BigInt(dec);
    const tier1Min = BigInt(ANAL_TIER1_MIN_UI) * mult;
    const bound = BigInt(ANAL_TIER2_BOUND_UI) * mult;
    if (raw < tier1Min) {
        return { promptLimit: 0, tier: 0, eligible: false };
    }
    if (raw <= bound) {
        return { promptLimit: ANAL_TIER1_PROMPTS, tier: 1, eligible: true };
    }
    return { promptLimit: ANAL_TIER2_PROMPTS, tier: 2, eligible: true };
}

const CHAT_LIMIT_MESSAGE =
    process.env.CHAT_LIMIT_MESSAGE ||
    "Yo — this ain't for full-blown convos, just quick $ANAL / lana.ai banter and facts. Refresh the page if you need a clean slate. DYOR. 🕳️⚡";

const allowedOriginsRaw = (
    (process.env.ALLOWED_ORIGINS || '') +
    ',' +
    (process.env.CORS_EXTRA_ORIGINS || '')
)
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

/** Fail before Railway edge ~30s timeout so the browser gets JSON + CORS instead of a misleading CORS error on 502 */
const HELIUS_FETCH_TIMEOUT_MS = Math.min(60000, Math.max(5000, parseInt(process.env.HELIUS_FETCH_TIMEOUT_MS || '12000', 10) || 12000));

async function fetchHeliusRpcJson(rpcBody) {
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), HELIUS_FETCH_TIMEOUT_MS);
    try {
        const response = await fetch(`https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(rpcBody),
            signal: ctrl.signal,
        });
        return await response.json();
    } catch (e) {
        if (e.name === 'AbortError') {
            return { __timedOut: true };
        }
        throw e;
    } finally {
        clearTimeout(tid);
    }
}

async function fetchAnalHolderStatus(walletAddress) {
    const data = await fetchHeliusRpcJson({
        jsonrpc: '2.0',
        id: 1,
        method: 'getTokenAccountsByOwner',
        params: [walletAddress, { mint: TOKEN_MINT }, { encoding: 'jsonParsed' }],
    });
    if (data && data.__timedOut) {
        return { error: 'Helius RPC timed out — try again or check HELIUS_FETCH_TIMEOUT_MS / Railway resources.' };
    }
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
    const tierInfo = promptTierFromRawAmount(total.toString(), decimals);
    return {
        address: walletAddress,
        mint: TOKEN_MINT,
        isHolder: total > BigInt(0),
        amountRaw: total.toString(),
        uiAmount,
        decimals,
        promptLimit: tierInfo.promptLimit,
        tier: tierInfo.tier,
        eligibleForChat: tierInfo.eligible,
        minAnalForChatUi: ANAL_TIER1_MIN_UI,
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
        const { message, history, wallet } = req.body;

        if (!message || typeof message !== 'string') {
            return res.status(400).json({ error: 'Message required' });
        }

        const userMessage = message.trim().slice(0, 8000);
        if (!userMessage) {
            return res.status(400).json({ error: 'Message required' });
        }

        const prior = normalizeHistory(history);
        const userTurnsInHistory = prior.filter((m) => m.role === 'user').length;

        let maxPrompts = MAX_USER_CHAT_PROMPTS;
        let limitKind = 'public';

        if (wallet != null && String(wallet).trim() !== '') {
            const w = String(wallet).trim();
            if (w.length < 32 || w.length > 52) {
                return res.status(400).json({ error: 'invalid_wallet' });
            }
            const status = await fetchAnalHolderStatus(w);
            if (status.error) {
                return res.status(502).json({ error: 'holder_check_failed', message: status.error });
            }
            maxPrompts = status.promptLimit;
            limitKind = 'wallet';
            if (maxPrompts === 0) {
                return res.status(403).json({
                    error: 'insufficient_anal',
                    message:
                        'Holder chat requires at least ' +
                        ANAL_TIER1_MIN_UI.toLocaleString() +
                        ' $ANAL. Tier: ' +
                        ANAL_TIER1_MIN_UI.toLocaleString() +
                        '–' +
                        ANAL_TIER2_BOUND_UI.toLocaleString() +
                        ' ANAL → ' +
                        ANAL_TIER1_PROMPTS +
                        ' prompts; above ' +
                        ANAL_TIER2_BOUND_UI.toLocaleString() +
                        ' ANAL → ' +
                        ANAL_TIER2_PROMPTS +
                        ' prompts.',
                    minAnalForChatUi: ANAL_TIER1_MIN_UI,
                });
            }
        }

        if (userTurnsInHistory >= maxPrompts) {
            return res.status(429).json({
                error: 'chat_limit',
                message:
                    limitKind === 'wallet'
                        ? 'Holder chat limit reached (' +
                          maxPrompts +
                          ' user messages this session for your balance tier). Refresh the page to reset. DYOR. 🕳️⚡'
                        : CHAT_LIMIT_MESSAGE,
                limit: maxPrompts,
                limitKind,
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
                promptRemaining: Math.max(0, maxPrompts - userTurnsInHistory - 1),
                promptLimit: maxPrompts,
                limitKind,
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
