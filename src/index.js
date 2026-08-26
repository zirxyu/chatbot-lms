const makeWASocket = require('@whiskeysockets/baileys').default;
const {
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason,
} = require('@whiskeysockets/baileys');
const QRCode = require('qrcode-terminal');

const config = require('./config');
const log = require('./logger');
const createHandler = require('./bot/handler');

let sock = null;
let shuttingDown = false;

async function start() {
  if (!config.api.baseUrl || !config.api.key) {
    log.error('LMS_API_URL dan LMS_API_KEY wajib diisi pada file .env (lihat .env.example)');
    process.exit(1);
  }

  const { state, saveCreds } = await useMultiFileAuthState(config.bot.sessionDir);
  const { version } = await fetchLatestBaileysVersion().catch(() => ({ version: undefined }));

  const baileysLog = log.child({ module: 'baileys' });
  baileysLog.level = 'warn';

  sock = makeWASocket({
    version,
    auth: state,
    logger: baileysLog,
    markOnlineOnConnect: false,
    syncFullHistory: false,
    getMessage: async () => undefined,
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr && !sock.authState.creds.registered) {
      if (config.bot.pairingPhone) {
        sock
          .requestPairingCode(config.bot.pairingPhone)
          .then((code) => {
            const pretty = String(code || '').match(/.{1,4}/g)?.join('-') || code;
            log.info(`Kode pairing WhatsApp untuk ${config.bot.pairingPhone}: ${pretty}`);
            log.info('Masukkan kode tersebut di WhatsApp → Perangkat Tertaut → Tautkan dengan nomor telepon');
          })
          .catch((err) => log.error({ err: err.message }, 'Gagal meminta kode pairing'));
      } else {
        log.info('Scan QR berikut lewat WhatsApp → Perangkat Tertaut:');
        QRCode.generate(qr, { small: true });
      }
    }

    if (connection === 'open') {
      log.info(`Bot WhatsApp terhubung sebagai ${sock.user?.id}`);
      if (config.bot.ownerJid) {
        sock
          .sendMessage(config.bot.ownerJid, {
            text: `✅ *${config.appName}*\nBot aktif dan siap melayani mahasiswa.`,
          })
          .catch(() => {});
      }
    }

    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      if (statusCode === DisconnectReason.loggedOut) {
        log.error('Sesi WhatsApp logout. Hapus folder session lalu jalankan ulang untuk login kembali.');
        process.exit(1);
      }
      log.warn(
        { statusCode },
        `Koneksi terputus, menyambung ulang dalam ${Math.round(config.bot.reconnectMs / 1000)} detik`
      );
      setTimeout(start, config.bot.reconnectMs);
    }
  });

  const handleMessage = createHandler(sock);

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;
    for (const msg of messages) {
      try {
        if (!msg.message || msg.key.fromMe) continue;
        const jid = msg.key.remoteJid || '';
        if (jid === 'status@broadcast' || jid.endsWith('@newsletter')) continue;
        if (jid.endsWith('@g.us') && !config.bot.allowGroups) continue;
        await handleMessage(msg);
      } catch (err) {
        log.error({ err: err.stack || err.message }, 'Gagal memproses pesan');
      }
    }
  });
}

function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  log.info('Mematikan bot...');
  try {
    sock?.end(undefined);
  } catch {}
  setTimeout(() => process.exit(0), 800);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

start();
