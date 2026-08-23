// bot/commands/ai.js
const fetch = require('node-fetch');

const GROQ_API_KEY = "gsk_43XtkS9yY3neXPH4AymtTvU6dyb37"; // replace with your new key if needed
const API_URL = "https://api.groq.com/openai/v1/chat/completions";

const chatHistory = new Map();

async function handleAI(sock, msg, text, sender) {
    const history = chatHistory.get(sender) || [];
    history.push({ role: "user", content: text });

    try {
        const res = await fetch(API_URL, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${GROQ_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "llama3-70b-8192",
                messages: [
                    { role: "system", content: "You are a helpful assistant." },
                    ...history.slice(-10)
                ],
                temperature: 0.7,
                max_tokens: 600
            })
        });

        if (!res.ok) throw new Error(`API error: ${res.status}`);
        const data = await res.json();
        const reply = data.choices[0].message.content;

        history.push({ role: "assistant", content: reply });
        chatHistory.set(sender, history);

        await sock.sendMessage(msg.key.remoteJid, { text: reply });
    } catch (err) {
        console.error("AI error:", err);
        await sock.sendMessage(msg.key.remoteJid, { text: "❌ AI is currently unavailable." });
    }
}

module.exports = { handleAI };
