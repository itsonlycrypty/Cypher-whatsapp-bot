const { makeWASocket } = require('@whiskeysockets/baileys')

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  
  if (req.method === 'OPTIONS') return res.status(200).end()

  const phone = (req.query.phone || '').replace(/\D/g, '')
  if (!phone) return res.status(400).json({ success: false, error: 'Phone number required' })

  let codeSent = false
  let timeoutReached = false

  const timeout = setTimeout(() => {
    timeoutReached = true
    if (!codeSent) {
      codeSent = true
      return res.status(503).json({
        success: false,
        error: 'WhatsApp server timeout — please try again'
      })
    }
  }, 25000) // 25 seconds — just under Vercel's 30s limit

  try {
    const sock = makeWASocket({
      auth: { creds: {}, keys: {} },
      printQRInTerminal: false,
      syncFullHistory: false,
      connectTimeoutMs: 15000,
      retryRequestDelayMs: 500
    })

    sock.ev.on('connection.update', async (update) => {
      if (timeoutReached || codeSent) return
      
      if (update.connection === 'connecting') {
        try {
          const code = await sock.requestPairingCode(phone)
          if (!codeSent) {
            codeSent = true
            clearTimeout(timeout)
            sock.end()
            return res.json({
              success: true,
              code: code,
              message: 'Enter in WhatsApp → Settings → Linked Devices → Link with phone number'
            })
          }
        } catch (err) {
          if (!codeSent) {
            codeSent = true
            clearTimeout(timeout)
            sock.end()
            return res.status(500).json({
              success: false,
              error: err.message.includes('rate') ? 'Too many requests — wait 1 minute' : 'Could not generate code — try again'
            })
          }
        }
      }
    })
  } catch (err) {
    if (!codeSent) {
      clearTimeout(timeout)
      return res.status(500).json({ success: false, error: 'Server error — please retry' })
    }
  }
}
