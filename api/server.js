const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const { SYSTEM_PROMPT } = require('./prompt');
const { HELIUS_CHAT_SYSTEM_PROMPT } = require('./helius-chat-prompt');
const { READ_ONLY_RPC_METHODS } = require('./helius-rpc-allowlist');

const HELIUS_API_KEY = process.env.HELIUS_API_KEY;
const KIMI_API_KEY = process.env.KIMI_API_KEY;
const JUPITER_API_KEY = (process.env.JUPITER_API_KEY || '').trim();
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

/** Same ANAL gate as JSON-RPC proxy — `wallet` is the connected pubkey from the client */
async function gateHolderWallet(wallet) {
    if (!wallet || typeof wallet !== 'string') {
        return { ok: false, status: 400, body: { error: 'wallet required (connected holder address)' } };
    }
    const w = wallet.trim();
    if (w.length < 32 || w.length > 52) {
        return { ok: false, status: 400, body: { error: 'invalid_wallet' } };
    }
    const st = await fetchAnalHolderStatus(w);
    if (st.error) {
        return { ok: false, status: 502, body: { error: st.error } };
    }
    if (!st.eligibleForChat) {
        return {
            ok: false,
            status: 403,
            body: { error: 'insufficient_anal', minAnalForChatUi: ANAL_TIER1_MIN_UI },
        };
    }
    return { ok: true, wallet: w };
}

/** Helius Enhanced Transactions REST — https://www.helius.dev/docs/api-reference/enhanced-transactions/overview */
const HELIUS_ENHANCED_ORIGIN = 'https://api-mainnet.helius-rpc.com';

function heliusEnhancedUrl(path, extraQuery = {}) {
    const p = path.startsWith('/') ? path.slice(1) : path;
    const u = new URL(p, HELIUS_ENHANCED_ORIGIN + '/');
    u.searchParams.set('api-key', HELIUS_API_KEY);
    for (const [k, v] of Object.entries(extraQuery)) {
        if (v !== undefined && v !== null && v !== '') {
            u.searchParams.set(k, String(v));
        }
    }
    return u;
}

async function heliusEnhancedFetch(urlObj, init = {}) {
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), HELIUS_FETCH_TIMEOUT_MS);
    try {
        const response = await fetch(urlObj.toString(), { ...init, signal: ctrl.signal });
        const text = await response.text();
        let json;
        try {
            json = JSON.parse(text);
        } catch (_) {
            return {
                kind: 'bad_json',
                status: response.status,
                text: text.slice(0, 2000),
            };
        }
        return { kind: 'json', response, json };
    } catch (e) {
        if (e.name === 'AbortError') {
            return { kind: 'timeout' };
        }
        throw e;
    } finally {
        clearTimeout(tid);
    }
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

async function fetchJupiterTrending24h(limit) {
    if (!JUPITER_API_KEY) return null;
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), HELIUS_FETCH_TIMEOUT_MS);
    try {
        const lim = Math.min(100, Math.max(1, limit));
        const response = await fetch(
            `https://api.jup.ag/tokens/v2/toptrending/24h?limit=${lim}`,
            {
                headers: {
                    'x-api-key': JUPITER_API_KEY,
                    Accept: 'application/json',
                },
                signal: ctrl.signal,
            }
        );
        if (!response.ok) return null;
        return await response.json();
    } catch (_) {
        return null;
    } finally {
        clearTimeout(tid);
    }
}

/**
 * Builds CONTEXT for Kimi: holder status, DAS snapshot, optional Jupiter trending when user asks market-style questions.
 */
async function buildHeliusChatContext(wallet, userMessage, holderStatus) {
    const lower = (userMessage || '').toLowerCase();
    const wantTrend =
        /\b(trending|trend|hot tokens|top tokens|volume leaders|what'?s hot|24\s*h|leaderboard|market movers)\b/.test(
            lower
        );

    const st = holderStatus || (await fetchAnalHolderStatus(wallet));

    let dasPart = '';
    const d = await fetchHeliusRpcJson({
        jsonrpc: '2.0',
        id: 1,
        method: 'getAssetsByOwner',
        params: {
            ownerAddress: wallet,
            page: 1,
            limit: 25,
            displayOptions: { showFungible: true, showNativeBalance: true },
        },
    });
    if (d && !d.__timedOut && !d.error && d.result) {
        dasPart = JSON.stringify(d.result).slice(0, 8000);
    }

    let trendingPart = '';
    if (wantTrend) {
        const tr = await fetchJupiterTrending24h(15);
        if (tr && Array.isArray(tr) && tr.length) {
            trendingPart = JSON.stringify(tr).slice(0, 12000);
        } else if (wantTrend && !JUPITER_API_KEY) {
            trendingPart =
                '[Jupiter trending unavailable: set JUPITER_API_KEY on the API server for live toptrending data.]';
        }
    }

    const holderJson = st && !st.error ? JSON.stringify(st, null, 2).slice(0, 4000) : '{}';

    return {
        contextBlock:
            '--- HOLDER (Helius) ---\n' +
            holderJson +
            '\n\n--- WALLET ASSETS DAS (Helius, truncated) ---\n' +
            dasPart +
            (trendingPart
                ? '\n\n--- JUPITER TRENDING 24h (when applicable) ---\n' + trendingPart
                : ''),
    };
}

/** When set, holder-tools page + related API routes require header `X-Holder-Tools-Password`. */
const HOLDER_TOOLS_PASSWORD = (process.env.HOLDER_TOOLS_PASSWORD || '').trim();

function requireHolderToolsPassword(req, res, next) {
    if (!HOLDER_TOOLS_PASSWORD) {
        return next();
    }
    const p = req.get('x-holder-tools-password') || req.get('X-Holder-Tools-Password');
    if (p === HOLDER_TOOLS_PASSWORD) {
        return next();
    }
    return res.status(401).json({ error: 'holder_tools_password_required' });
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
        allowedHeaders: ['Content-Type', 'X-Holder-Tools-Password'],
    })
);
app.use(express.json());

app.get('/api/holder-tools/status', (req, res) => {
    res.json({ passwordRequired: Boolean(HOLDER_TOOLS_PASSWORD) });
});

app.post('/api/holder-tools/auth', (req, res) => {
    if (!HOLDER_TOOLS_PASSWORD) {
        return res.json({ ok: true, passwordRequired: false });
    }
    const { password } = req.body || {};
    if (password === HOLDER_TOOLS_PASSWORD) {
        return res.json({ ok: true, passwordRequired: true });
    }
    return res.status(401).json({ error: 'invalid_password' });
});

app.get('/api/holder/anal/:address', requireHolderToolsPassword, async (req, res) => {
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

app.get('/api/account/:address', requireHolderToolsPassword, async (req, res) => {
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

app.get('/api/wallet/:address/signatures', requireHolderToolsPassword, async (req, res) => {
    try {
        const { address } = req.params;
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '20', 10) || 20));
        const data = await fetchHeliusRpcJson({
            jsonrpc: '2.0',
            id: 1,
            method: 'getSignaturesForAddress',
            params: [address, { limit }],
        });
        if (data.__timedOut) {
            return res.status(504).json({ error: 'Helius timeout' });
        }
        if (data.error) {
            return res.status(502).json({ error: data.error.message || 'RPC error' });
        }
        res.json(data.result || []);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/tx/:signature', requireHolderToolsPassword, async (req, res) => {
    try {
        const sig = req.params.signature;
        if (!sig || sig.length < 80) {
            return res.status(400).json({ error: 'Invalid transaction signature' });
        }
        const data = await fetchHeliusRpcJson({
            jsonrpc: '2.0',
            id: 1,
            method: 'getTransaction',
            params: [sig, { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0 }],
        });
        if (data.__timedOut) {
            return res.status(504).json({ error: 'Helius timeout' });
        }
        if (data.error) {
            return res.status(502).json({ error: data.error.message || 'RPC error' });
        }
        res.json(data.result !== undefined ? data.result : null);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/das/assets-by-owner', requireHolderToolsPassword, async (req, res) => {
    try {
        const ownerAddress = req.body && req.body.ownerAddress;
        if (!ownerAddress || typeof ownerAddress !== 'string') {
            return res.status(400).json({ error: 'ownerAddress required in JSON body' });
        }
        const limit = Math.min(1000, Math.max(1, parseInt(req.body.limit || '100', 10) || 100));
        const data = await fetchHeliusRpcJson({
            jsonrpc: '2.0',
            id: 1,
            method: 'getAssetsByOwner',
            params: {
                ownerAddress: ownerAddress.trim(),
                page: 1,
                limit,
                displayOptions: { showFungible: true, showNativeBalance: true },
            },
        });
        if (data.__timedOut) {
            return res.status(504).json({ error: 'Helius timeout' });
        }
        if (data.error) {
            return res.status(502).json({ error: data.error.message || 'RPC error', details: data.error });
        }
        res.json(data.result !== undefined ? data.result : data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/helius/allowed-methods', requireHolderToolsPassword, (req, res) => {
    res.json([...READ_ONLY_RPC_METHODS].sort());
});

/** POST body: { wallet, transactions: string[], commitment?: 'finalized'|'confirmed' } — max 100 sigs */
app.post('/api/helius/enhanced/transactions', requireHolderToolsPassword, async (req, res) => {
    try {
        const { wallet, transactions, commitment } = req.body || {};
        const g = await gateHolderWallet(wallet);
        if (!g.ok) {
            return res.status(g.status).json(g.body);
        }
        if (!Array.isArray(transactions) || transactions.length === 0) {
            return res.status(400).json({
                error: 'transactions required',
                hint: 'Non-empty array of transaction signatures (max 100).',
            });
        }
        if (transactions.length > 100) {
            return res.status(400).json({ error: 'max 100 transactions per request' });
        }
        for (const s of transactions) {
            if (typeof s !== 'string' || s.length < 80 || s.length > 128) {
                return res.status(400).json({ error: 'invalid signature in transactions array' });
            }
        }
        const body = { transactions };
        if (commitment === 'finalized' || commitment === 'confirmed') {
            body.commitment = commitment;
        }
        const url = heliusEnhancedUrl('v0/transactions');
        const result = await heliusEnhancedFetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        if (result.kind === 'timeout') {
            return res.status(504).json({ error: 'Helius Enhanced API timed out' });
        }
        if (result.kind === 'bad_json') {
            return res.status(502).json({ error: 'Invalid JSON from Helius', details: result.text });
        }
        if (!result.response.ok) {
            return res.status(result.response.status).json(result.json);
        }
        res.json(result.json);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * Query: wallet (required), optional before-signature, after-signature, type, source, limit, commitment
 * Proxies GET /v0/addresses/{address}/transactions on Helius Enhanced API.
 */
app.get('/api/helius/enhanced/addresses/:address/transactions', requireHolderToolsPassword, async (req, res) => {
    try {
        const g = await gateHolderWallet(req.query.wallet);
        if (!g.ok) {
            return res.status(g.status).json(g.body);
        }
        const { address } = req.params;
        if (!address || address.length < 32 || address.length > 52) {
            return res.status(400).json({ error: 'invalid address' });
        }
        const q = { ...req.query };
        delete q.wallet;
        if (q.limit != null && q.limit !== '') {
            const lim = parseInt(String(q.limit), 10);
            if (!Number.isNaN(lim)) {
                q.limit = String(Math.min(100, Math.max(1, lim)));
            } else {
                delete q.limit;
            }
        }
        const path = `v0/addresses/${encodeURIComponent(address)}/transactions`;
        const url = heliusEnhancedUrl(path, q);
        const result = await heliusEnhancedFetch(url);
        if (result.kind === 'timeout') {
            return res.status(504).json({ error: 'Helius Enhanced API timed out' });
        }
        if (result.kind === 'bad_json') {
            return res.status(502).json({ error: 'Invalid JSON from Helius', details: result.text });
        }
        if (!result.response.ok) {
            return res.status(result.response.status).json(result.json);
        }
        res.json(result.json);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/helius/rpc', requireHolderToolsPassword, async (req, res) => {
    try {
        const { method, params, wallet } = req.body || {};
        const g = await gateHolderWallet(wallet);
        if (!g.ok) {
            return res.status(g.status).json(g.body);
        }
        if (!method || typeof method !== 'string') {
            return res.status(400).json({ error: 'method required' });
        }
        if (!READ_ONLY_RPC_METHODS.has(method)) {
            return res.status(403).json({
                error: 'method_not_allowed',
                message: 'Only read-only RPC/DAS methods are allowed (no sendTransaction, simulate, airdrop, etc.).',
            });
        }
        if (params === undefined) {
            return res.status(400).json({
                error: 'params required',
                hint: 'Use a JSON array for most RPC calls, or an object for DAS methods like getAssetsByOwner.',
            });
        }
        const paramsStr = JSON.stringify(params);
        if (paramsStr.length > 24000) {
            return res.status(400).json({ error: 'params too large' });
        }
        const data = await fetchHeliusRpcJson({
            jsonrpc: '2.0',
            id: 1,
            method,
            params,
        });
        if (data.__timedOut) {
            return res.status(504).json({ error: 'Helius timeout' });
        }
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/** Kimi + Helius/Jupiter CONTEXT — holder tier limits; requires X-Holder-Tools-Password when HOLDER_TOOLS_PASSWORD is set */
app.post('/api/holder/helius-chat', requireHolderToolsPassword, async (req, res) => {
    try {
        const { wallet, message, history } = req.body || {};
        const g = await gateHolderWallet(wallet);
        if (!g.ok) {
            return res.status(g.status).json(g.body);
        }

        if (!message || typeof message !== 'string') {
            return res.status(400).json({ error: 'message required' });
        }
        const userMessage = message.trim().slice(0, 8000);
        if (!userMessage) {
            return res.status(400).json({ error: 'message required' });
        }

        const st = await fetchAnalHolderStatus(g.wallet);
        if (st.error) {
            return res.status(502).json({ error: st.error });
        }
        if (!st.eligibleForChat) {
            return res.status(403).json({
                error: 'insufficient_anal',
                minAnalForChatUi: ANAL_TIER1_MIN_UI,
            });
        }

        const prior = normalizeHistory(history);
        const userTurnsInHistory = prior.filter((m) => m.role === 'user').length;
        const promptLimit = st.promptLimit || ANAL_TIER1_PROMPTS;
        if (userTurnsInHistory >= promptLimit) {
            return res.status(429).json({
                error: 'chat_limit',
                message:
                    process.env.HELIUS_CHAT_LIMIT_MESSAGE ||
                    'Message limit reached for your tier. Refresh the page to reset. DYOR.',
                limit: promptLimit,
            });
        }

        const { contextBlock } = await buildHeliusChatContext(g.wallet, userMessage, st);

        const systemContent =
            HELIUS_CHAT_SYSTEM_PROMPT +
            '\n\n--- CONTEXT (real data for this request; may be partial) ---\n' +
            contextBlock;

        const kimiMaxTokens = Math.min(
            4096,
            parseInt(process.env.KIMI_MAX_TOKENS_HELIUS_CHAT || '2048', 10) || 2048
        );

        const messages = [
            { role: 'system', content: systemContent },
            ...prior,
            { role: 'user', content: userMessage },
        ];

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
                max_tokens: kimiMaxTokens,
            }),
        });

        const data = await response.json();

        if (data.choices && data.choices[0]) {
            return res.json({
                response: data.choices[0].message.content,
                timestamp: new Date().toISOString(),
                promptRemaining: Math.max(0, promptLimit - userTurnsInHistory - 1),
                promptLimit,
                tier: st.tier,
            });
        }
        return res.status(500).json({ error: 'Invalid AI response', details: data });
    } catch (error) {
        console.error('Helius chat error:', error);
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
                limit: MAX_USER_CHAT_PROMPTS,
            });
        }

        const kimiMaxTokens = Math.min(2048, parseInt(process.env.KIMI_MAX_TOKENS || '512', 10) || 512);

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
                max_tokens: kimiMaxTokens,
            }),
        });

        const data = await response.json();

        if (data.choices && data.choices[0]) {
            res.json({
                response: data.choices[0].message.content,
                timestamp: new Date().toISOString(),
                promptRemaining: Math.max(0, MAX_USER_CHAT_PROMPTS - userTurnsInHistory - 1),
                promptLimit: MAX_USER_CHAT_PROMPTS,
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
