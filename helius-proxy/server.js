const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();

const HELIUS_API_KEY = process.env.HELIUS_API_KEY;
const TOKEN_MINT = process.env.TOKEN_MINT || '95DJixZhoy898shqxoZy5riztdf95fTqLXBog85DKvHK';

if (!HELIUS_API_KEY) {
    console.error('FATAL: HELIUS_API_KEY environment variable is required.');
    process.exit(1);
}

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

// Health check
app.get('/', (req, res) => {
    res.json({ status: 'AnalDog Helius Proxy is running!', timestamp: new Date().toISOString() });
});

// Get token info from Helius
app.get('/api/token', async (req, res) => {
    try {
        const response = await fetch(`https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: '2.0',
                id: 1,
                method: 'getAsset',
                params: { id: TOKEN_MINT }
            })
        });
        const data = await response.json();
        res.json(data.result || { error: 'No data' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get token holders (largest accounts)
app.get('/api/holders', async (req, res) => {
    try {
        const response = await fetch(`https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: '2.0',
                id: 1,
                method: 'getTokenLargestAccounts',
                params: [TOKEN_MINT]
            })
        });
        const data = await response.json();
        res.json(data.result || { error: 'No data' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get token supply
app.get('/api/supply', async (req, res) => {
    try {
        const response = await fetch(`https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: '2.0',
                id: 1,
                method: 'getTokenSupply',
                params: [TOKEN_MINT]
            })
        });
        const data = await response.json();
        res.json(data.result || { error: 'No data' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get recent transactions
app.get('/api/transactions', async (req, res) => {
    try {
        const response = await fetch(`https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: '2.0',
                id: 1,
                method: 'getSignaturesForAddress',
                params: [TOKEN_MINT, { limit: 10 }]
            })
        });
        const data = await response.json();
        res.json(data.result || []);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get account info for a specific wallet
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
                params: [address, { mint: TOKEN_MINT }, { encoding: 'jsonParsed' }]
            })
        });
        const data = await response.json();
        res.json(data.result || { error: 'No data' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`AnalDog Helius Proxy running on port ${PORT}`);
});
