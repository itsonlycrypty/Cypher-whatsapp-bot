const { makeWASocket, Browsers, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  // Expect either ?phone=fullnumber or ?country=234&number=7016334222
  let phone = req.query.phone;
  if (!phone) {
    const country = (req.query.country || '').replace(/\D/g, '');
    const number = (req.query.number || '').replace(/\D/g, '');
    if (country && number) {
      phone = country + number;
    }
  }
  phone = (phone || '').replace(/\D/g, '');
  if (!phone || phone.length < 10) {
    return res.status(400).json({ success: false, error: 'Valid phone number required' });
  }

  try {
    const { version } = await fetchLatestBaileysVersion();
    const sock = makeWASocket({
      version,
      auth: { creds: {}, keys: {} },
      printQRInTerminal: false,
      syncFullHistory: false,
      browser: Browsers.macOS('Safari'),
    });

    // Give the socket a moment to initialize
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Race between pairing and a 10s timeout
    const code = await Promise.race([
      sock.requestPairingCode(phone),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 10000))
    ]);

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
