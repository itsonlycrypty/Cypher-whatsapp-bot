const express = require('express');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');

if (typeof globalThis.crypto === 'undefined') globalThis.crypto = crypto;

const { makeWASocket, useMemoryAuthState, Browsers, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');

const app = express();
const PORT = process.env.PORT || 3000;

const publicPath = path.join(__dirname, 'public');
if (!fs.existsSync(publicPath)) fs.mkdirSync(publicPath, { recursive: true });
app.use(express.static(publicPath));

app.get('/', (req, res) => res.sendFile(path.join(publicPath, 'index.html')));

app.get('/api/pair', async (req, res) => {
    res.setHeader('Content-Type', 'application/json');

    if (req.query.ping === 'true') return res.json({ status: 'online' });

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

        // Give socket a moment to initialise
        await new Promise(r => setTimeout(r, 500));

        // Request code directly – no connection.open wait (faster)
        const code = await Promise.race([
            sock.requestPairingCode(phone),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Request timed out')), 20000))
        ]);

        sock.end();
        return res.json({ success: true, code });
    } catch (error) {
        console.error('Pairing error:', error.message);
        return res.status(500).json({ success: false, error: error.message });
    }
});

// Start the main bot (owner's session)
const { startBot } = require('./bot/index');
startBot().catch(err => console.error('Bot error:', err));

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
