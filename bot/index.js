const { makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const { commands, loadCommands } = require('./commands/index');
const { handleAI } = require('./commands/ai');
const fs = require('fs');
const path = require('path');

// ========== BOT CONFIG ==========
const PREFIX = ".";
const OWNER_NUMBER = "2347016334222";   // <-- CHANGE TO YOUR NUMBER
const BOT_NAME = "CYPHER v1";
const VERSION = "1.0.0";
const OWNER_NAME = "Crypty";
const DEVELOPER = "Mole";
const START_TIME = Date.now();

// ========== WHITELIST SYSTEM ==========
const WHITELIST_FILE = path.join(__dirname, '..', 'auth', 'whitelist.json');

function loadWhitelist() {
    if (!fs.existsSync(WHITELIST_FILE)) {
        fs.writeFileSync(WHITELIST_FILE, JSON.stringify([OWNER_NUMBER], null, 2));
        return [OWNER_NUMBER];
    }
    try {
        const data = fs.readFileSync(WHITELIST_FILE, 'utf-8');
        const list = JSON.parse(data);
        if (!list.includes(OWNER_NUMBER)) list.push(OWNER_NUMBER);
        return list;
    } catch {
        return [OWNER_NUMBER];
    }
}

function saveWhitelist(list) {
    fs.writeFileSync(WHITELIST_FILE, JSON.stringify(list, null, 2));
}

// ========== LOAD COMMANDS ==========
loadCommands();
console.log(`≡ Loaded ${Object.keys(commands).length} commands`);

// ========== UPTIME ==========
function getUptime() {
    const seconds = Math.floor((Date.now() - START_TIME) / 1000);
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${d}d ${h}h ${m}m ${s}s`;
}

async function startBot(authFolder = 'auth') {
    const { version } = await fetchLatestBaileysVersion();
    const { state, saveCreds } = await useMultiFileAuthState(authFolder);

    const sock = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: false,   // we use pairing code via website, not QR
        syncFullHistory: false
    });

    // ========== CONNECTION UPDATE (no pairing code here) ==========
    sock.ev.on('connection.update', async (update) => {
        const { connection } = update;
        if (connection === 'open') {
            console.log(`≡ ${BOT_NAME} v${VERSION} — ONLINE`);
            console.log(`≡ Prefix: ${PREFIX} | Commands: ${Object.keys(commands).length}`);
            console.log(`≡ Owner: ${OWNER_NAME} | Assisted by: ${DEVELOPER}`);
        }
        if (connection === 'close') {
            console.log("≡ Notice: Reconnecting...");
            setTimeout(() => startBot(authFolder), 5000);
        }
    });

    sock.ev.on('creds.update', saveCreds);

    // ========== MESSAGE HANDLER with WHITELIST ==========
    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const text = msg.message.conversation || msg.message.extendedTextMessage?.text || "";
        const sender = msg.key.remoteJid;
        const isGroup = sender.includes('@g.us');
        const senderNumber = msg.key.participant?.split('@')[0] || sender.split('@')[0];
        const isOwner = senderNumber === OWNER_NUMBER;

        const whitelist = loadWhitelist();
        const isAuthorized = isOwner || whitelist.includes(senderNumber);

        // ---- WHITELIST CHECK ----
        if (!isAuthorized) {
            await sock.sendMessage(sender, { text: "⛔ You are not authorized to use this bot. Contact the owner." });
            return;
        }

        // ---- HANDLE COMMANDS ----
        if (!text.startsWith(PREFIX)) {
            if (!isGroup && text.length > 2) {
                await handleAI(sock, msg, text, senderNumber);
            }
            return;
        }

        const cmd = text.slice(PREFIX.length).trim().split(' ')[0].toLowerCase();
        const args = text.slice(PREFIX.length + cmd.length).trim();

        console.log(`≡ [${senderNumber}] .${cmd} ${args.slice(0, 30)}...`);

        // ---- WHITELIST MANAGEMENT (owner only) ----
        if (isOwner) {
            if (cmd === "adduser") {
                const newUser = args.replace(/\D/g, '');
                if (!newUser || newUser.length < 10) {
                    await sock.sendMessage(sender, { text: "❌ Provide a valid number (e.g., .adduser 2347016334222)" });
                    return;
                }
                let list = loadWhitelist();
                if (list.includes(newUser)) {
                    await sock.sendMessage(sender, { text: `✅ ${newUser} is already authorized.` });
                    return;
                }
                list.push(newUser);
                saveWhitelist(list);
                await sock.sendMessage(sender, { text: `✅ ${newUser} added to whitelist.` });
                return;
            }

            if (cmd === "deluser" || cmd === "removeuser") {
                const target = args.replace(/\D/g, '');
                if (!target || target === OWNER_NUMBER) {
                    await sock.sendMessage(sender, { text: "❌ Cannot remove owner or invalid number." });
                    return;
                }
                let list = loadWhitelist();
                if (!list.includes(target)) {
                    await sock.sendMessage(sender, { text: `❌ ${target} not in whitelist.` });
                    return;
                }
                list = list.filter(n => n !== target);
                saveWhitelist(list);
                await sock.sendMessage(sender, { text: `✅ ${target} removed from whitelist.` });
                return;
            }

            if (cmd === "listusers" || cmd === "whitelist") {
                const list = loadWhitelist();
                const msgText = `≡ Authorized Users (${list.length}):\n\n${list.map((n, i) => `${i+1}. ${n}`).join('\n')}`;
                await sock.sendMessage(sender, { text: msgText });
                return;
            }
        }

        // ---- NORMAL COMMANDS (for authorized users) ----
        try {
            if (commands[cmd]) {
                await commands[cmd].execute(sock, msg, args, { senderNumber, isOwner, isGroup, BOT_NAME, VERSION, OWNER_NAME, DEVELOPER });
            } else if (cmd === "menu" || cmd === "start" || cmd === "help") {
                await sendFullMenu(sock, sender);
            } else if (cmd === "allcmds") {
                await sendAllCommands(sock, sender);
            } else if (cmd === "info" || cmd === "about") {
                await sendBotInfo(sock, sender);
            } else if (cmd === "uptime") {
                await sock.sendMessage(sender, { text: `≡ Uptime: ${getUptime()}` });
            } else {
                await sock.sendMessage(sender, {
                    text: `⟡ Warning: Command ".${cmd}" not found\nType ${PREFIX}menu for all commands.`
                });
            }
        } catch (err) {
            console.error(`≡ Error in .${cmd}:`, err);
            await sock.sendMessage(sender, { text: `⟡ Error: Error executing .${cmd}` });
        }
    });

    return sock;
}

// ========== MENU (TEXT ONLY – NO IMAGE) ==========
async function sendFullMenu(sock, jid) {
    const uptime = getUptime();
    let text = `≡ ${BOT_NAME} v${VERSION} — MAIN MENU ≡\n\n`;
    text += `╭───────────────────────\n`;
    text += `◇ Owner: ${OWNER_NAME}\n`;
    text += `◇ Assisted by: ${DEVELOPER}\n`;
    text += `◇ Version: ${VERSION}\n`;
    text += `◇ Uptime: ${uptime}\n`;
    text += `◇ Commands: ${Object.keys(commands).length}+\n`;
    text += `◇ Prefix: ${PREFIX}\n`;
    text += `╰───────────────────────\n\n`;
    text += `≡ CATEGORIES:\n\n`;
    text += `◇ ${PREFIX}ai — AI Chat\n`;
    text += `◇ ${PREFIX}fun — Fun & Games\n`;
    text += `◇ ${PREFIX}tools — Utilities\n`;
    text += `◇ ${PREFIX}admin — Group Management\n`;
    text += `◇ ${PREFIX}download — Media Downloaders\n`;
    text += `◇ ${PREFIX}system — System Info\n`;
    text += `◇ ${PREFIX}allcmds — Full Command List\n\n`;
    text += `> ≡ "No filters. No limits. Just pure intelligence." ≡\n`;
    text += `> Created by ${OWNER_NAME} • Assisted by ${DEVELOPER}`;

    await sock.sendMessage(jid, { text });
}

async function sendBotInfo(sock, jid) {
    const uptime = getUptime();
    const text = `≡ ${BOT_NAME} v${VERSION} — BOT INFO ≡\n\n`
        + `◇ Owner: ${OWNER_NAME}\n`
        + `◇ Assisted by: ${DEVELOPER}\n`
        + `◇ Version: ${VERSION}\n`
        + `◇ Uptime: ${uptime}\n`
        + `◇ Commands: ${Object.keys(commands).length}+\n`
        + `◇ Status: ✅ Online\n`
        + `◇ Prefix: ${PREFIX}\n\n`
        + `> ≡ "No filters. No limits. Just pure intelligence." ≡`;
    await sock.sendMessage(jid, { text });
}

async function sendAllCommands(sock, jid) {
    const cmdList = Object.keys(commands).map(c => `${PREFIX}${c}`).join("\n");
    await sock.sendMessage(jid, {
        text: `≡ ALL ${Object.keys(commands).length} COMMANDS:\n\n${cmdList}`
    });
}

// ========== START BOT ==========
if (require.main === module) {
    startBot();
}

module.exports = { startBot, getUptime };
