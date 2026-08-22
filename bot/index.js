const { makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, proto } = require('@whiskeysockets/baileys')
const { commands, loadCommands } = require('./commands/index')
const { handleAI } = require('./commands/ai')
const fs = require('fs')
const path = require('path')

// ========== CYPHER v1 CONFIG ==========
const PREFIX = "."
const OWNER_NUMBER = "234XXXXXXXXXX"
const BOT_NAME = "CYPHER v1"
const VERSION = "1.0.0"

// ========== LOAD ALL 200+ COMMANDS ==========
loadCommands()
console.log(`≡ Loaded ${Object.keys(commands).length} commands`)

async function startBot(authFolder = 'auth') {
    const { version } = await fetchLatestBaileysVersion()
    const { state, saveCreds } = await useMultiFileAuthState(authFolder)

    const sock = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: true,
        syncFullHistory: false
    })

    // ========== CONNECTION HANDLER ==========
    sock.ev.on('connection.update', (update) => {
        const { connection, qr } = update
        if (qr) console.log("≡ Action: Scan QR Code to pair")
        if (connection === 'open') {
            console.log(`≡ ${BOT_NAME} v${VERSION} — ONLINE`)
            console.log(`≡ Prefix: ${PREFIX} | Commands: ${Object.keys(commands).length}`)
        }
        if (connection === 'close') {
            console.log("≡ Notice: Reconnecting...")
            setTimeout(() => startBot(authFolder), 5000)
        }
    })

    sock.ev.on('creds.update', saveCreds)

    // ========== MESSAGE HANDLER — 200+ COMMANDS ==========
    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0]
        if (!msg.message || msg.key.fromMe) return

        const text = msg.message.conversation || msg.message.extendedTextMessage?.text || ""
        const sender = msg.key.remoteJid
        const isGroup = sender.includes('@g.us')
        const senderNumber = msg.key.participant?.split('@')[0] || sender.split('@')[0]
        const isOwner = senderNumber === OWNER_NUMBER

        if (!text.startsWith(PREFIX)) {
            // AI Auto-response for non-command messages
            if (!isGroup && text.length > 2) {
                await handleAI(sock, msg, text, senderNumber)
            }
            return
        }

        const cmd = text.slice(PREFIX.length).trim().split(' ')[0].toLowerCase()
        const args = text.slice(PREFIX.length + cmd.length).trim()

        console.log(`≡ [${senderNumber}] .${cmd} ${args.slice(0, 30)}...`)

        // ========== COMMAND EXECUTOR ==========
        try {
            if (commands[cmd]) {
                await commands[cmd].execute(sock, msg, args, { senderNumber, isOwner, isGroup, BOT_NAME, VERSION })
            } else if (cmd === "help" || cmd === "menu") {
                await sendHelp(sock, sender)
            } else if (cmd === "allcmds") {
                await sendAllCommands(sock, sender)
            } else {
                await sock.sendMessage(sender, { 
                    text: `⟡ Warning: Command ".${cmd}" not found\nType ${PREFIX}help for all commands.` 
                })
            }
        } catch (err) {
            console.error(`≡ Error in .${cmd}:`, err)
            await sock.sendMessage(sender, { text: `⟡ Error: Error executing .${cmd}` })
        }
    })

    return sock
}

// ========== HELP MENU ==========
async function sendHelp(sock, jid) {
    const categories = {
        "⟡ AI": ["ai", "ask", "chat"],
        "⟡ Fun": ["meme", "joke", "quote", "fact", "riddle", "coinflip", "dice"],
        "⟡ Tools": ["sticker", "pdf", "qr", "shorten", "weather", "time"],
        "⟡ Admin": ["kick", "add", "promote", "demote", "mute", "tagall"],
        "⟡ Download": ["yt", "mp3", "ig", "tiktok", "fb"],
        "⟡ System": ["ping", "uptime", "info", "alive", "restart"]
    }

    let text = `≡ ${BOT_NAME} v${VERSION} — COMMANDS ≡\n\n`
    text += `Total: ${Object.keys(commands).length}+ Commands\nPrefix: ${PREFIX}\n\n`
    
    for (const [cat, cmds] of Object.entries(categories)) {
        text += `${cat}\n`
        cmds.forEach(c => {
            text += `  ${PREFIX}${c}\n`
        })
        text += "\n"
    }
    
    text += `\n> Created by Crypty • Assisted by Mole`
    await sock.sendMessage(jid, { text })
}

// ========== ALL COMMANDS LIST ==========
async function sendAllCommands(sock, jid) {
    const cmdList = Object.keys(commands).map(c => `${PREFIX}${c}`).join("\n")
    await sock.sendMessage(jid, { 
        text: `≡ ALL ${Object.keys(commands).length} COMMANDS:\n\n${cmdList}` 
    })
}

// ========== START BOT ==========
if (require.main === module) {
    startBot()
}

module.exports = { startBot }
