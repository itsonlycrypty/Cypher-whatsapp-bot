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

        // === Wait for connection to open ===
        await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Connection timeout')), 15000);
            sock.ev.on('connection.update', (update) => {
                if (update.connection === 'open') {
                    clearTimeout(timeout);
                    resolve();
                }
                if (update.connection === 'close') {
                    clearTimeout(timeout);
                    reject(new Error('Connection closed'));
                }
            });
        });

        // === Now request the pairing code ===
        const code = await sock.requestPairingCode(phone);

        sock.end();
        fs.rmSync(tempDir, { recursive: true, force: true });

        return res.json({ success: true, code });
    } catch (error) {
        console.error('Pairing error:', error.message);
        try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch (e) {}
        return res.status(500).json({ success: false, error: error.message });
    }
});

// Start the main bot (with persistent auth)
const { startBot } = require('./bot/index');
startBot().catch(err => console.error('Bot error:', err));

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
