const { 
  makeWASocket, 
  useMemoryAuthState, 
  Browsers, 
  fetchLatestBaileysVersion 
} = require('@whiskeysockets/baileys');

module.exports = async (req, res) => {
  // Enable CORS for all origins
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  // --- PING request (for frontend latency check) ---
  if (req.query.ping === 'true') {
    return res.status(200).json({ status: 'online' });
  }

  // --- Extract and clean the phone number ---
  const phone = (req.query.phone || '').replace(/\D/g, '');
  if (!phone || phone.length < 10) {
    return res.status(400).json({ 
      success: false, 
      error: 'Valid phone number required (e.g., 2347016334222)' 
    });
  }

  try {
    // 1. Get the latest WhatsApp protocol version
    const { version } = await fetchLatestBaileysVersion();

    // 2. Use in‑memory auth (no filesystem, safe for serverless)
    const { state } = useMemoryAuthState();

    // 3. Create the socket
    const sock = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: false,
      syncFullHistory: false,
      browser: Browsers.macOS('Safari'),
    });

    // 4. Wait a moment for the socket to initialise
    await new Promise(resolve => setTimeout(resolve, 1500));

    // 5. Request the pairing code (race against a 9s timeout)
    const code = await Promise.race([
      sock.requestPairingCode(phone),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('WhatsApp server timeout')), 9000)
      )
    ]);

    // 6. Clean up and send the code
    sock.end();
    return res.status(200).json({ success: true, code });

  } catch (error) {
    console.error('Pairing error:', error.message);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate code. Try again.'
    });
  }
};
