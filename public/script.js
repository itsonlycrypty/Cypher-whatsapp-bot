let currentSessionId = null

async function generateCode() {
    const phone = document.getElementById('phone').value.trim()
    const status = document.getElementById('status')
    const codeBox = document.getElementById('code-box')
    const instructions = document.getElementById('instructions')
    
    if (!phone || phone.length < 10) {
        status.textContent = "◇ Warning: Enter a valid phone number with country code!"
        status.style.color = "#ff6666"
        codeBox.classList.remove('show')
        instructions.classList.remove('show')
        return
    }

    status.textContent = "≡ Requesting code from WhatsApp..."
    status.style.color = "#ff003c"
    
    try {
        // ⚡ CALL THE REAL API — TALKS TO WHATSAPP SERVERS
        const response = await fetch(`/api/pair?phone=${encodeURIComponent(phone)}`)
        const data = await response.json()
        
        if (data.success && data.code) {
            currentSessionId = data.sessionId
            
            // Display REAL code from WhatsApp
            document.getElementById('pairing-code').textContent = data.code
            codeBox.classList.add('show')
            instructions.classList.add('show')
            
            status.textContent = "≡ Success! Enter code in WhatsApp ≡"
            status.style.color = "#00ff88"
            
            // Start checking if paired
            pollPairingStatus()
        } else {
            throw new Error(data.error || "Failed to get code")
        }
    } catch (err) {
        status.textContent = "⟡ Error: " + err.message
        status.style.color = "#ff6666"
        console.error(err)
    }
}

async function pollPairingStatus() {
    if (!currentSessionId) return
    
    const status = document.getElementById('status')
    let attempts = 0
    
    const poll = setInterval(async () => {
        attempts++
        if (attempts > 60) { // Stop after 2 minutes
            clearInterval(poll)
            status.textContent = "◇ Timed out. Try again."
            status.style.color = "#ffaa00"
            return
        }
        
        try {
            const res = await fetch(`/api/pair?sessionId=${currentSessionId}`)
            const data = await res.json()
            
            if (data.paired) {
                clearInterval(poll)
                status.textContent = "✅ SUCCESS: DEVICE PAIRED! Send .menu to start ≡"
                status.style.color = "#00ff88"
            }
        } catch {}
    }, 2000)
}

function copyCode() {
    const code = document.getElementById('pairing-code').textContent
    navigator.clipboard.writeText(code).then(() => {
        const btn = document.querySelector('.copy-btn')
        btn.textContent = "◇ COPIED!"
        setTimeout(() => btn.textContent = "◇ COPY CODE", 2000)
    })
}
