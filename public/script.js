let generatedCode = ""

function generateCode() {
    const phone = document.getElementById('phone').value.trim()
    const status = document.getElementById('status')
    const codeBox = document.getElementById('code-box')
    const instructions = document.getElementById('instructions')
    
    if (!phone || phone.length < 10) {
        status.textContent = "◇ Warning: Enter a valid phone number!"
        status.style.color = "#ff6666"
        codeBox.classList.remove('show')
        instructions.classList.remove('show')
        return
    }

    status.textContent = "≡ Generating Pairing Code..."
    status.style.color = "#ff003c"
    
    // Generate 8-digit pairing code — FORMAT: XXXX-XXXX (matches WhatsApp!)
    const part1 = Math.floor(1000 + Math.random() * 9000)
    const part2 = Math.floor(1000 + Math.random() * 9000)
    generatedCode = `${part1}-${part2}`
    
    // Display code
    document.getElementById('pairing-code').textContent = generatedCode
    codeBox.classList.add('show')
    instructions.classList.add('show')
    
    status.textContent = "≡ Success: Code Generated! ≡"
    status.style.color = "#00ff88"
    
    // Store code for verification
    localStorage.setItem('cypher_pairing_code', generatedCode)
    localStorage.setItem('cypher_phone', phone)
}

function copyCode() {
    const code = document.getElementById('pairing-code').textContent
    navigator.clipboard.writeText(code).then(() => {
        const btn = document.querySelector('.copy-btn')
        btn.textContent = "◇ COPIED!"
        setTimeout(() => btn.textContent = "◇ COPY CODE", 2000)
    })
}
