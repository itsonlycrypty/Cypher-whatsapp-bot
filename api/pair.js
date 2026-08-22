const { makeWASocket } = require('@whiskeysockets/baileys')

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Content-Type', 'application/json')
  
  const phone = (req.query.phone || '').replace(/\D/g, '')
  if (!phone) return res.status(400).json({ success: false, error: 'Phone required' })

  try {
    const sock = makeWASocket({
      auth: { creds: {}, keys: {} },
      printQRInTerminal: false,
      syncFullHistory: false
    })

    let code = null
    
    sock.ev.on('connection.update', async (u) => {
      if (u.connection === 'connecting' && !code) {
        try {
          code = await sock.requestPairingCode(phone)
          sock.end()
          res.json({ success: true, code })
        } catch (e) {
          sock.end()
          res.status(500).json({ success: false, error: e.message })
        }
      }
    })

    setTimeout(() => {
      if (!code) {
        sock.end()
        res.status(504).json({ success: false, error: 'Timeout — please try again' })
      }
    }, 20000)

  } catch (e) {
    res.status(500).json({ success: false, error: e.message })
  }
}
