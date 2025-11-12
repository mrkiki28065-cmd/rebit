// bot.js
const TelegramBot = require("node-telegram-bot-api");
const fs = require("fs");

// Ganti dengan token bot kamu
const TOKEN = "ISI_TOKEN_BOT_KAMU_DI_SINI";
const bot = new TelegramBot(TOKEN, { polling: true });

let saldo = {}; // penyimpanan sementara saldo pemain
const dataFile = "./saldo.json";

// Load saldo jika sudah ada file
if (fs.existsSync(dataFile)) {
  saldo = JSON.parse(fs.readFileSync(dataFile));
}

function saveSaldo() {
  fs.writeFileSync(dataFile, JSON.stringify(saldo, null, 2));
}

// --- Parsing data duel ---
function parseDuel(text) {
  const hasil = { kecil: [], besar: [] };

  const kecilMatch = text.match(/(?:KECIL:|K:)([\s\S]*?)(?=(BESAR:|B:|$))/i);
  const besarMatch = text.match(/(?:BESAR:|B:)([\s\S]*)/i);

  if (kecilMatch) hasil.kecil = parseTeam(kecilMatch[1]);
  if (besarMatch) hasil.besar = parseTeam(besarMatch[1]);

  return hasil;
}

function parseTeam(section) {
  const lines = section.trim().split(/(?=[A-Za-z])/);
  const players = [];

  for (let line of lines) {
    const parts = line.trim().split(/\s+/);
    if (parts.length < 2) continue;
    const name = parts.slice(0, parts.length - 1).join(" ");
    const nominal = parseInt(parts[parts.length - 1]);
    if (!isNaN(nominal)) players.push({ name, nominal });
  }

  return players;
}

// --- Hitung hasil mode normal / no cut ---
function hitungHasil(modal, mode = "normal", fee = 5.5) {
  if (mode === "nc") {
    const feeTetap = Math.floor(modal / 10) + 1;
    return modal * 2 - feeTetap;
  } else {
    const total = modal * 2;
    const potongan = total * (fee / 100);
    return total - potongan;
  }
}

// --- Command /rekapwin ---
bot.onText(/^\/rekapwin(?:\s+(\d+(\.\d+)?|nc))?$/i, (msg, match) => {
  const chatId = msg.chat.id;
  const reply = msg.reply_to_message;

  if (!reply || !reply.text) {
    return bot.sendMessage(chatId, "⚠️ Balas pesan data duel untuk gunakan /rekapwin");
  }

  const duelData = parseDuel(reply.text);
  const mode = match[1] === "nc" ? "nc" : "normal";
  const fee = mode === "nc" ? null : parseFloat(match[1]) || 5.5;

  let text = `📊 *REKAPWIN*\nMode: ${mode === "nc" ? "NO CUT" : `Normal (${fee}%)`}\n\n`;

  ["kecil", "besar"].forEach(team => {
    const list = duelData[team];
    if (list.length) {
      const totalModal = list.reduce((a, b) => a + b.nominal, 0);
      text += `*${team.toUpperCase()}* (Total: ${totalModal})\n`;
      list.forEach(p => {
        const hasil = hitungHasil(p.nominal, mode, fee);
        text += `- ${p.name} (${p.nominal} → ${hasil})\n`;
        // update saldo
        saldo[p.name] = (saldo[p.name] || 0) + hasil;
      });
      text += "\n";
    }
  });

  saveSaldo();
  bot.sendMessage(chatId, text, { parse_mode: "Markdown" });
});

// --- Command saldo pemain ---
bot.onText(/^\/wd\s+(.+)/i, (msg, match) => {
  const chatId = msg.chat.id;
  const name = match[1].trim().toUpperCase();
  const s = saldo[name] || 0;
  bot.sendMessage(chatId, `💰 Saldo ${name}: ${s}`);
});

// --- Command tambah saldo ---
bot.onText(/^\/tambah\s+(.+)\s+(\d+)/i, (msg, match) => {
  const chatId = msg.chat.id;
  const name = match[1].toUpperCase();
  const jumlah = parseInt(match[2]);
  saldo[name] = (saldo[name] || 0) + jumlah;
  saveSaldo();
  bot.sendMessage(chatId, `✅ Saldo ${name} ditambah ${jumlah}`);
});

// --- Command kurangi saldo ---
bot.onText(/^\/kurangi\s+(.+)\s+(\d+)/i, (msg, match) => {
  const chatId = msg.chat.id;
  const name = match[1].toUpperCase();
  const jumlah = parseInt(match[2]);
  saldo[name] = (saldo[name] || 0) - jumlah;
  saveSaldo();
  bot.sendMessage(chatId, `✅ Saldo ${name} dikurangi ${jumlah}`);
});

// --- Command reset last win ---
bot.onText(/^\/resetlw/i, (msg) => {
  saldo = {};
  saveSaldo();
  bot.sendMessage(msg.chat.id, "♻️ Last win direset.");
});