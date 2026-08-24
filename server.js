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

    // Try up to 3 times with short delays
    for (let attempt = 1; attempt <= 3; attempt++) {
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

            // Wait a tiny bit for the socket to initialise
            await new Promise(r => setTimeout(r, 500));

            // Request code with a 7-second timeout (Railway gives 10s total)
            const code = await Promise.race([
                sock.requestPairingCode(phone),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Request timed out')), 7000))
            ]);

            sock.end();

            // If we get here, we have a code – but we need to check if it's valid.
            // We'll trust it, but the user will know if it doesn't work.
            return res.json({ success: true, code, attempt });
        } catch (err) {
            console.log(`Attempt ${attempt} failed:`, err.message);
            if (attempt === 3) {
                return res.status(500).json({ success: false, error: 'All attempts failed. Try again later.' });
            }
            // Wait 1 second before retry
            await new Promise(r => setTimeout(r, 1000));
        }
    }
});

// Start main bot
const { startBot } = require('./bot/index');
startBot().catch(err => console.error('Bot error:', err));

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
