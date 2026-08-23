const express = require('express');
const path = require('path');
const crypto = require('crypto');

// === Fix for Baileys crypto bug ===
if (typeof globalThis.crypto === 'undefined') {
    globalThis.crypto = crypto;
}

// === Import Baileys ===
let baileys;
try {
    baileys = require('@whiskeysockets/baileys');
} catch (e) {
    console.error('Baileys not installed! Run npm install');
    process.exit(1);
}

const { makeWASocket, Browsers, fetchLatestBaileysVersion } = baileys;

// === Attempt to get useMemoryAuthState ===
let useMemoryAuthState;
try {
    // Try named import
    if (baileys.useMemoryAuthState) {
        useMemoryAuthState = baileys.useMemoryAuthState;
    } else {
        // Fallback: manually create a memory store
        useMemoryAuthState = () => {
            const state = { creds: {}, keys: {} };
            return { state, saveCreds: () => {} };
        };
        console.log('Using fallback memory auth.');
    }
} catch (e) {
    useMemoryAuthState = () => {
        const state = { creds: {}, keys: {} };
        return { state, saveCreds: () => {} };
    };
    console.log('Using fallback memory auth (error).');
}

// === Express app ===
const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files from "public" – check if folder exists
const publicPath = path.join(__dirname, 'public');
app.use(express.static(publicPath));

// If static fails, serve index.html directly
app.get('/', (req, res) => {
    res.sendFile(path.join(publicPath, 'index.html'));
});

// === PAIRING API ===
app.get('/api/pair', async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json');

    // Ping
    if (req.query.ping === 'true') {
        return res.status(200).json({ status: 'online' });
    }

    // Get phone number
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

        // Wait for socket to initialise
        await new Promise(resolve => setTimeout(resolve, 1500));

        // Request code with timeout
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

// === Start the main bot (background) ===
const { startBot } = require('./bot/index');
startBot().catch(err => console.error('Bot error:', err));

// === Start server ===
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
