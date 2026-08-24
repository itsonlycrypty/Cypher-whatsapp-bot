const express = require('express');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');

// === Fix for Baileys crypto bug ===
if (typeof globalThis.crypto === 'undefined') {
    globalThis.crypto = crypto;
}

// === Import Baileys ===
const { makeWASocket, useMultiFileAuthState, Browsers, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');

const app = express();
const PORT = process.env.PORT || 3000;

// === Serve static files from "public" ===
const publicPath = path.join(__dirname, 'public');
if (!fs.existsSync(publicPath)) fs.mkdirSync(publicPath, { recursive: true });
app.use(express.static(publicPath));

// === Fallback for index.html ===
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

    // Phone number
    const phone = (req.query.phone || '').replace(/\D/g, '');
    if (!phone || phone.length < 10) {
        return res.status(400).json({ success: false, error: 'Valid phone number required' });
    }

    // Create a temporary folder for this pairing session
    const tempDir = path.join(os.tmpdir(), `pair-${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });

    try {
        const { state, saveCreds } = await useMultiFileAuthState(tempDir);
        const { version } = await fetchLatestBaileysVersion();

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

        // Clean up temp folder
        fs.rmSync(tempDir, { recursive: true, force: true });

        return res.status(200).json({ success: true, code });
    } catch (error) {
        console.error('Pairing error:', error.message);
        // Clean up temp folder if it exists
        try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch (e) {}
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
