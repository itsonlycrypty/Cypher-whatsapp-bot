const { makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys')
const QRCode = require('qrcode')

const sessions = new Map()

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*')
    const { phone, sessionId } = req.query

    if (sessionId && sessions.has(sessionId)) {
        const session = sessions.get(sessionId)
        return res.json({ paired: session?.paired || false })
    }

    if (!phone) return res.status(400).json({ success: false, message: "Phone required" })

    const sessionId = Date.now().toString()
    let qrCode = ""
    let paired = false

    const { state, saveCreds } = await useMultiFileAuthState(`auth-${sessionId}`)
    
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false
    })

    sock.ev.on('connection.update', async (update) => {
        const { qr, connection, lastDisconnect } = update
        
        if (qr) {
            qrCode = await QRCode.toDataURL(qr)
            sessions.set(sessionId, { qrCode, paired: false, sock })
        }
        
        if (connection === 'open') {
            paired = true
            sessions.set(sessionId, { paired: true, sock })
            console.log("≡ Success: Bot Paired")
        }
        
        if (connection === 'close') {
            const reason = lastDisconnect?.error?.output?.statusCode
            if (reason !== DisconnectReason.loggedOut) {
                console.log("≡ Notice: Reconnecting...")
            }
        }
    })

    sock.ev.on('creds.update', saveCreds)

    setTimeout(() => {
        if (!paired) {
            sessions.delete(sessionId)
            sock.end()
        }
    }, 25000)

    sessions.set(sessionId, { qrCode, paired: false, sock })
    
    res.json({
        success: true,
        sessionId,
        code: qrCode
    })
}
