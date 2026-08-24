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

    let phone = (req.query.phone || '').replace(/\D/g, '');
    // Remove leading zero if present (e.g., 070... -> 70...)
    if (phone.startsWith('0')) phone = phone.substring(1);

    if (!phone || phone.length < 10) {
        return res.status(400).json({ success: false, error: 'Valid phone number required (no leading zero)' });
    }

    const tempDir = path.join(os.tmpdir(), `pair-${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });

    try {
        console.log(`Pairing request for ${phone}`);
        const { state, saveCreds } = await useMultiFileAuthState(tempDir);
        const { version } = await fetchLatestBaileysVersion();

        const sock = makeWASocket({
            version,
            auth: state,
            printQRInTerminal: false,
            syncFullHistory: false,
            browser: Browsers.macOS('Safari'),
        });

        // Wait for connection.open (15s timeout)
        console.log('Waiting for connection.open...');
        await new Promise((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error('Connection timeout')), 15000);
            sock.ev.on('connection.update', (u) => {
                console.log('Connection update:', u.connection);
                if (u.connection === 'open') {
                    clearTimeout(timer);
                    resolve();
                }
                if (u.connection === 'close') {
                    clearTimeout(timer);
                    reject(new Error('Connection closed'));
                }
            });
        });

        console.log('Connection open, requesting code...');
        const code = await Promise.race([
            sock.requestPairingCode(phone),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Code request timeout')), 5000))
        ]);

        console.log('Code generated:', code);
        sock.end();
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
