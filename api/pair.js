const { makeWASocket, Browsers } = require('@whiskeysockets/baileys');

module.exports = async (req, res) => {
  // 1. CORS & Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  // 2. Get phone number (remove spaces/symbols)
  const phone = (req.query.phone || '').replace(/\D/g, '');
  if (!phone) {
    return res.status(400).json({ success: false, error: 'Phone number is required' });
  }

  try {
    // 3. Create a TEMPORARY socket (no disk writes, pure memory)
    const sock = makeWASocket({
      auth: { creds: {}, keys: {} },
      printQRInTerminal: false,
      syncFullHistory: false,
      browser: Browsers.macOS('Safari'), // Makes WhatsApp trust the connection
    });

    // 4. THE MAGIC LINE: Request the 8-digit pairing code directly.
    //    This handles the connection internally and resolves FAST (~3-5 seconds).
    const code = await sock.requestPairingCode(phone);

    // 5. Close the socket immediately
    sock.end();

    // 6. Return the 8-digit code as JSON
    return res.status(200).json({
      success: true,
      code: code,
      note: "Enter this 8-digit code in WhatsApp > Linked Devices > Link with Phone Number"
    });

  } catch (error) {
    console.error('Pairing error:', error);
    // IMPORTANT: Always return JSON, NEVER let Vercel return HTML
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate code. Check your number (e.g., 2347016334222).'
    });
  }
};
