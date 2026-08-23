// server.js
const express = require('express');
const path = require('path');
const crypto = require('crypto');

// Fix: global crypto for Baileys
if (typeof globalThis.crypto === 'undefined') {
    globalThis.crypto = crypto;
}

const { makeWASocket, useMemoryAuthState, Browsers, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const { startBot } = require('./bot/index');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files (CSS, JS, images) from "public"
app.use(express.static(path.join(__dirname, 'public')));

// ========== PAIRING API ==========
app.get('/api/pair', async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json');

    const phone = (req.query.phone || '').replace(/\D/g, '');
    if (!phone || phone.length < 10) {
        return res.status(400).json({ success: false, error: 'Valid phone number required' });
    }

    if (req.query.ping === 'true') {
        return res.json({ status: 'online' });
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
        return res.json({ success: true, code });
    } catch (error) {
        console.error('Pairing error:', error.message);
        return res.status(500).json({ success: false, error: error.message });
    }
});

// ========== CATCH‑ALL ROUTE – serve the HTML ==========
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ========== START MAIN BOT ==========
startBot().catch(err => console.error('Bot error:', err));

// ========== START SERVER ==========
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
