async function generateQR() {
    const phone = document.getElementById('phone').value.trim()
    const status = document.getElementById('status')
    const qrContainer = document.getElementById('qrcode')
    
    if (!phone || phone.length < 10) {
        status.textContent = "⟡ Warning: Enter a valid phone number!"
        status.style.color = "#ff6666"
        qrContainer.classList.remove('show')
        return
    }

    status.textContent = "≡ Generating QR Code..."
    status.style.color = "#ff003c"
    
    try {
        const response = await fetch(`/api/pair?phone=${encodeURIComponent(phone)}`)
        const data = await response.json()
        
        if (data.success) {
            qrContainer.innerHTML = ""
            await QRCode.toCanvas(qrContainer, data.code, { 
                width: 200,
                color: { dark: "#000", light: "#fff" }
            })
            qrContainer.classList.add('show')
            status.textContent = "⟡ Success: Scan QR Code with WhatsApp • Expires in 20s"
            status.style.color = "#00ff88"
            
            setTimeout(() => {
                status.textContent = "⟡ Waiting for scan..."
                pollStatus(data.sessionId)
            }, 2000)
        } else {
            throw new Error(data.message)
        }
    } catch (err) {
        status.textContent = "⟡ Error: " + err.message
        status.style.color = "#ff6666"
    }
}

async function pollStatus(sessionId) {
    const status = document.getElementById('status')
    for (let i = 0; i < 30; i++) {
        await new Promise(r => setTimeout(r, 2000))
        try {
            const res = await fetch(`/api/pair?sessionId=${sessionId}`)
            const data = await res.json()
            if (data.paired) {
                status.textContent = "≡ SUCCESS: CYPHER v1 SUCCESSFULLY PAIRED ≡"
                status.style.color = "#00ff88"
                return
            }
        } catch {}
    }
    status.textContent = "⟡ Notice: Timed out. Try again."
    status.style.color = "#ffaa00"
}
