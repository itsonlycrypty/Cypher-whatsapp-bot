const express = require('express');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');

if (typeof globalThis.crypto === 'undefined') globalThis.crypto = crypto;

const { makeWASocket, useMultiFileAuthState, Browsers, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files
const publicPath = path.join(__dirname, 'public');
if (!fs.existsSync(publicPath)) fs.mkdirSync(publicPath, { recursive: true });
app.use(express.static(publicPath));

app.get('/', (req, res) => res.sendFile(path.join(publicPath, 'index.html')));

// In‑memory store for pairing codes (for demo)
// In production, use a database (Redis/MongoDB)
const pendingPairs = {};

app.get('/api/pair', async (req, res) => {
    res.setHeader('Content-Type', 'application/json');

    if (req.query.ping === 'true') return res.json({ status: 'online' });

    const phone = (req.query.phone || '').replace(/\D/g, '');
    if (!phone || phone.length < 10) {
        return res.status(400).json({ success: false, error: 'Valid phone number required' });
    }

    // Create a unique folder for this user (in /tmp)
    const sessionId = Date.now() + '-' + Math.random().toString(36).substr(2, 6);
    const tempDir = path.join(os.tmpdir(), `wa-session-${sessionId}`);
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

        // Store the session temporarily (in memory) – you would store in DB
        pendingPairs[sessionId] = { phone, tempDir, sock };

        // Return the code + sessionId (so we can save later)
        sock.end(); // we'll close the socket after the user enters the code

        return res.json({ success: true, code, sessionId });
    } catch (error) {
        console.error('Pairing error:', error.message);
        try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch (e) {}
        return res.status(500).json({ success: false, error: error.message });
    }
});

// Optional: endpoint to confirm pairing and save session permanently
// After the user enters the code in WhatsApp, they should confirm here
app.post('/api/confirm', express.json(), (req, res) => {
    const { sessionId } = req.body;
    if (!sessionId || !pendingPairs[sessionId]) {
        return res.status(400).json({ success: false, error: 'Invalid session' });
    }

    const { phone, tempDir } = pendingPairs[sessionId];
    // Move the auth folder to a permanent location (e.g., ./sessions/{phone})
    const permDir = path.join(__dirname, 'sessions', phone);
    fs.mkdirSync(path.dirname(permDir), { recursive: true });
    fs.renameSync(tempDir, permDir);

    delete pendingPairs[sessionId];

    // Optionally, start a new socket for this user to keep them online
    // This part is complex; for now just store credentials.

    return res.json({ success: true, message: 'Device linked successfully!' });
});

// Start the main bot (owner's session) – you can optionally run a separate one
// For multi‑user, you might want to load all existing sessions.
// For simplicity, we'll just run the owner's bot if they have an 'auth' folder.
const { startBot } = require('./bot/index');
startBot().catch(err => console.error('Owner bot error:', err));

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
