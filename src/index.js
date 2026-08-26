const { Client, LocalAuth } = require('whatsapp-web.js');
const QRCode = require('qrcode-terminal');
const config = require('./config');
const log = require('./logger');
const createHandler = require('./bot/handler');

let client = null;
let restartCount = 0;
const MAX_RESTART = 5;

async function start() {
  if (!config.api.baseUrl || !config.api.key) {
    log.error('LMS_API_URL dan LMS_API_KEY wajib diisi pada file .env');
    process.exit(1);
  }

  client = new Client({
    authStrategy: new LocalAuth({ dataPath: config.bot.sessionDir }),
    puppeteer: {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--no-first-run',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process',
      ],
    },
  });

  const msgCache = new Map();

  const fakeSock = {
    sendMessage: async (jid, { text }) => {
      try {
        const cached = msgCache.get(jid);
        if (cached) {
          await cached.reply(text);
          return;
        }
        await client.sendMessage(jid, text);
      } catch (err) {
        log.error({ jid, err: err.message, stack: err.stack?.split('\n')[1] }, 'Gagal kirim pesan');
      }
    },
    sendPresenceUpdate: async () => {},
    readMessages: async () => {},
  };

  const handleMessage = createHandler(fakeSock);

  client.on('qr', async (qr) => {
    log.info('Scan QR berikut lewat WhatsApp → Perangkat Tertaut:');
    QRCode.generate(qr, { small: false });
    try {
      const QRCodeImg = require('qrcode');
      const qrPath = require('path').join(__dirname, '..', 'qr.png');
      await QRCodeImg.toFile(qrPath, qr, { width: 400, margin: 2 });
      log.info(`QR tersimpan di: ${qrPath}`);
    } catch {}
  });

  client.on('ready', async () => {
    restartCount = 0;
    const info = client.info;
    log.info(`✅ Bot terhubung sebagai ${info?.pushname || 'unknown'} (${info?.wid?.user || '?'})`);
    if (config.bot.ownerJid) {
      try {
        const ownerChat = await client.getChatById(config.bot.ownerJid);
        await ownerChat.sendMessage(`✅ *${config.appName}*\nBot aktif dan siap melayani mahasiswa.`);
      } catch {}
    }
  });

  client.on('authenticated', () => log.info('Autentikasi WhatsApp berhasil'));

  client.on('auth_failure', (msg) => {
    log.error({ msg }, 'Autentikasi WhatsApp gagal');
  });

  client.on('disconnected', (reason) => {
    log.warn({ reason }, 'WhatsApp terputus');
    if (reason === 'LOGOUT') {
      log.info('Session logout — menjalankan ulang dalam 5 detik...');
      setTimeout(restart, 5000);
    }
  });

  client.on('message', async (msg) => {
    try {
      if (msg.fromMe) return;
      const jid = msg.from || '';
      if (jid === 'status@broadcast') return;
      if (jid.endsWith('@g.us') && !config.bot.allowGroups) return;

      msgCache.set(jid, msg);
      setTimeout(() => msgCache.delete(jid), 300000);

      const chat = await msg.getChat().catch(() => null);
      if (chat && config.bot.markRead) await chat.sendSeen().catch(() => {});

      log.info({ from: jid, body: (msg.body || '').slice(0, 50) }, 'Pesan masuk');

      const adapted = {
        message: { conversation: msg.body || '' },
        key: { remoteJid: jid, fromMe: false, id: msg.id || '' },
      };

      await handleMessage(adapted);
    } catch (err) {
      log.error({ err: err.message }, 'Gagal memproses pesan');
    }
  });

  client.on('loading_screen', (percent) => {
    if (percent % 25 === 0) log.info(`Memuat chat: ${percent}%`);
  });

  log.info('Memulai bot WhatsApp...');
  client.initialize().catch((err) => {
    log.error({ err: err.message }, 'Gagal inisialisasi');
    setTimeout(restart, 5000);
  });
}

function restart() {
  if (restartCount >= MAX_RESTART) {
    log.error('Terlalu banyak restart — berhenti.');
    process.exit(1);
  }
  restartCount++;
  log.info(`Restart #${restartCount}...`);
  try { client?.destroy(); } catch {}
  client = null;
  setTimeout(start, 2000);
}

function shutdown() {
  log.info('Mematikan bot...');
  try { client?.destroy(); } catch {}
  setTimeout(() => process.exit(0), 800);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

start();
