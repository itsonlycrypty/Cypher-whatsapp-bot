const express = require('express');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');

if (typeof globalThis.crypto === 'undefined') globalThis.crypto = crypto;

const { makeWASocket, useMultiFileAuthState, Browsers, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');

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

    // Create a temporary folder for this session
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

        // Wait for connection.open (up to 20 seconds)
        await new Promise((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error('Connection timeout')), 20000);
            sock.ev.on('connection.update', (u) => {
                if (u.connection === 'open') { clearTimeout(timer); resolve(); }
                if (u.connection === 'close') { clearTimeout(timer); reject(new Error('Connection closed')); }
            });
        });

        // Now request the pairing code
        const code = await sock.requestPairingCode(phone);
        sock.end();

        // Clean up temp folder
        fs.rmSync(tempDir, { recursive: true, force: true });

        return res.json({ success: true, code });
    } catch (error) {
        console.error('Pairing error:', error.message);
        try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch (e) {}
        return res.status(500).json({ success: false, error: error.message });
    }
});

// Start the main bot (owner's session)
const { startBot } = require('./bot/index');
startBot().catch(err => console.error('Bot error:', err));

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
