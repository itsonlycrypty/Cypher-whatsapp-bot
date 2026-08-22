const { makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys')

// Store active pairing sessions
const sessions = new Map()

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    
    if (req.method === 'OPTIONS') return res.status(200).end()

    const { phone, sessionId } = req.query

    // Check existing session status
    if (sessionId && sessions.has(sessionId)) {
        const session = sessions.get(sessionId)
        return res.json({ 
            success: true, 
            paired: session.paired, 
            code: session.code 
        })
    }

    if (!phone) {
        return res.status(400).json({ success: false, error: "Phone number required" })
    }

    // Clean phone number — remove +, spaces, etc.
    const cleanPhone = phone.replace(/\D/g, '')
    const sessionId = Date.now().toString()
    
    try {
        // Create auth state for this session
        const { state, saveCreds } = await useMultiFileAuthState(`auth-${sessionId}`)
        
        // Initialize Baileys socket
        const sock = makeWASocket({
            auth: state,
            printQRInTerminal: false,
            syncFullHistory: false
        })

        sessions.set(sessionId, { sock, code: null, paired: false })

        // Connection handler — THIS IS WHERE THE MAGIC HAPPENS
        sock.ev.on('connection.update', async (update) => {
            const { connection, qr, isNewLogin } = update
            
            // ⚡ REQUEST PAIRING CODE FROM WHATSAPP SERVERS
            if (connection === 'connecting') {
                try {
                    // THIS IS THE REAL FUNCTION — ASKS WHATSAPP FOR THE CODE
                    const code = await sock.requestPairingCode(cleanPhone)
                    sessions.get(sessionId).code = code
                    console.log(`≡ Pairing code for ${cleanPhone}: ${code}`
                } catch (err) {
                    console.error("≡ Error requesting pairing code:", err)
                    sessions.delete(sessionId)
                }
            }

            // ✅ SUCCESSFULLY PAIRED!
            if (connection === 'open') {
                sessions.get(sessionId).paired = true
                console.log(`≡ SUCCESS: Device paired with ${cleanPhone}`)
                await saveCreds()
            }

            // Handle disconnection
            if (connection === 'close') {
                const reason = DisconnectReason[update.lastDisconnect?.error?.output?.statusCode]
                console.log(`≡ Connection closed: ${reason}`)
                // Clean up after 5 minutes
                setTimeout(() => sessions.delete(sessionId), 300000)
            }
        })

        // Wait briefly for code to generate
        await new Promise(resolve => setTimeout(resolve, 3000))
        
        const session = sessions.get(sessionId)
        if (!session?.code) {
            return res.status(500).json({ 
                success: false, 
                error: "Could not generate pairing code. Please try again." 
            })
        }

        return res.json({
            success: true,
            sessionId,
            code: session.code,
            message: "Enter this code in WhatsApp → Settings → Linked Devices → Link with phone number"
        })

    } catch (error) {
        console.error("≡ API Error:", error)
        return res.status(500).json({ 
            success: false, 
            error: error.message || "Server error" 
        })
    }
}
