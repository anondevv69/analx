const BASE58_CHUNK = /[1-9A-HJ-NP-Za-km-z]{32,48}/g;

function isPlausibleSolanaAddress(s) {
    if (!s || typeof s !== 'string') return false;
    const t = s.trim();
    return t.length >= 32 && t.length <= 48 && /^[1-9A-HJ-NP-Za-km-z]+$/.test(t);
}

/**
 * Extract Solana addresses from free text: Solscan URLs, then base58 tokens.
 */
function extractAddressesFromMessage(text) {
    if (!text || typeof text !== 'string') return [];
    const found = [];
    const seen = new Set();
    const solscan = text.matchAll(/solscan\.io\/(?:account|token|tx)\/([1-9A-HJ-NP-Za-km-z]{32,88})/gi);
    for (const m of solscan) {
        const a = m[1];
        if (isPlausibleSolanaAddress(a) && !seen.has(a)) {
            seen.add(a);
            found.push(a);
        }
    }
    const chunks = text.match(BASE58_CHUNK) || [];
    for (const c of chunks) {
        if (isPlausibleSolanaAddress(c) && !seen.has(c)) {
            seen.add(c);
            found.push(c);
        }
    }
    return found;
}

/**
 * Prefer an explicit address/URL in the message; otherwise analyze the connected wallet.
 */
function resolveAnalysisTarget(userMessage, sessionWallet) {
    const sw = (sessionWallet || '').trim();
    const addresses = extractAddressesFromMessage(userMessage);
    for (const a of addresses) {
        if (a !== sw) {
            return { target: a, source: 'explicit', addressesFound: addresses };
        }
    }
    if (addresses.length && addresses[0] === sw) {
        return { target: sw, source: 'session_linked', addressesFound: addresses };
    }
    return { target: sw, source: 'session', addressesFound: addresses };
}

module.exports = {
    extractAddressesFromMessage,
    resolveAnalysisTarget,
};
