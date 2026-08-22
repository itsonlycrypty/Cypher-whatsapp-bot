const { makeWASocket, Browsers } = require('@whiskeysockets/baileys');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  const phone = (req.query.phone || '').replace(/\D/g, '');
  if (!phone || phone.length < 10) {
    return res.status(400).json({ success: false, error: 'Valid phone number required (e.g., 2347016334222)' });
  }

  try {
    // Race between the pairing code and a 12s timeout
    const code = await Promise.race([
      new Promise(async (resolve, reject) => {
        try {
          const sock = makeWASocket({
            auth: { creds: {}, keys: {} },
            printQRInTerminal: false,
            syncFullHistory: false,
            browser: Browsers.macOS('Safari'),
          });
          const pairCode = await sock.requestPairingCode(phone);
          sock.end();
          resolve(pairCode);
        } catch (err) {
          reject(err);
        }
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout – WhatsApp server took too long')), 12000))
    ]);

    return res.status(200).json({ success: true, code });

  } catch (error) {
    console.error('Pairing error:', error.message);
    return res.status(500).json({
      success: false,
      error: error.message || 'Unknown error – check your number and try again'
    });
  }
};
