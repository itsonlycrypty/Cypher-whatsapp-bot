const axios = require('axios')

module.exports = {
    meme: {
        description: "Send a random meme",
        async execute(sock, msg, args, { sender }) {
            const res = await axios.get("https://meme-api.com/gimme")
            await sock.sendMessage(msg.key.remoteJid, { 
                image: { url: res.data.url },
                caption: `⟡ ${res.data.title}`
            }, { quoted: msg })
        }
    },
    joke: {
        description: "Tell a joke",
        async execute(sock, msg, args, { sender }) {
            const res = await axios.get("https://v2.jokeapi.dev/joke/Any?safe-mode")
            const joke = res.data.type === 'single' ? res.data.joke : `${res.data.setup}\n\n${res.data.delivery}`
            await sock.sendMessage(msg.key.remoteJid, { text: joke }, { quoted: msg })
        }
    },
    fact: {
        description: "Random fun fact",
        async execute(sock, msg, args, { sender }) {
            const res = await axios.get("https://uselessfacts.jsph.pl/random.json?language=en")
            await sock.sendMessage(msg.key.remoteJid, { text: `⟡ ${res.data.text}` }, { quoted: msg })
        }
    },
    coinflip: {
        description: "Flip a coin",
        async execute(sock, msg, args, { sender }) {
            const result = Math.random() > 0.5 ? "⟡ HEADS" : "⟡ TAILS"
            await sock.sendMessage(msg.key.remoteJid, { text: result }, { quoted: msg })
        }
    },
    dice: {
        description: "Roll dice",
        async execute(sock, msg, args, { sender }) {
            const roll = Math.floor(Math.random() * 6) + 1
            await sock.sendMessage(msg.key.remoteJid, { text: `⟡ You rolled a ${roll}` }, { quoted: msg })
        }
    }
}
