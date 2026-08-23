const express = require('express');
const path = require('path');
const crypto = require('crypto');

// Fix for Baileys crypto issue
if (typeof globalThis.crypto === 'undefined') {
    globalThis.crypto = crypto;
}

let baileys;
try {
    baileys = require('@whiskeysockets/baileys');
} catch (e) {
    console.error('Baileys not found:', e.message);
    process.exit(1);
}

const { makeWASocket, Browsers, fetchLatestBaileysVersion } = baileys;

// Try to get useMemoryAuthState – if not, use a simple object
let useMemoryAuthState;
try {
    // Attempt to import the named export
    const module = require('@whiskeysockets/baileys');
    if (module.useMemoryAuthState) {
        useMemoryAuthState = module.useMemoryAuthState;
    } else {
        // Fallback: define a dummy function that returns an empty state
        useMemoryAuthState = () => ({ state: { creds: {}, keys: {} } });
        console.warn('useMemoryAuthState not found, using fallback.');
    }
} catch (e) {
    useMemoryAuthState = () => ({ state: { creds: {}, keys: {} } });
    console.warn('useMemoryAuthState import failed, using fallback.');
}

const { startBot } = require('./bot/index');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

// ========== PAIRING API ==========
app.get('/api/pair', async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json');

    // Ping
    if (req.query.ping === 'true') {
        return res.status(200).json({ status: 'online' });
    }

    const phone = (req.query.phone || '').replace(/\D/g, '');
    if (!phone || phone.length < 10) {
        return res.status(400).json({ success: false, error: 'Valid phone number required' });
    }

    try {
        const { version } = await fetchLatestBaileysVersion();
        const { state } = useMemoryAuthState();

        const sock = makeWASocket({
            version,
            auth: state,
            printQRInTerminal: false,
            syncFullHistory: false,
            browser: Browsers.macOS('Safari'),
        });

        await new Promise(resolve => setTimeout(resolve, 1500));

        const code = await Promise.race([
            sock.requestPairingCode(phone),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 10000))
        ]);

        sock.end();
        return res.status(200).json({ success: true, code });
    } catch (error) {
        console.error('Pairing error:', error.message);
        return res.status(500).json({ success: false, error: error.message });
    }
});

// Catch‑all route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start bot (main)
startBot().catch(err => console.error('Bot error:', err));

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
