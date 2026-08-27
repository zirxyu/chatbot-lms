require('dotenv').config();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const nodemailer = require('nodemailer');

const config = require('../src/config');
const log = require('../src/logger');
const { maskEmail } = require('../src/utils');

const PORT = Number(process.env.PORT) || 4000;
const API_KEY = process.env.LMS_API_KEY || 'secret-chatbot-key-smakensaft-unmul';
const SECRET = process.env.MOCK_SECRET || 'mock-development-secret-change-me';
const ROOT = path.join(__dirname, '..');
const DB_FILE = path.join(ROOT, 'data', 'db.json');
const OUTBOX = path.join(ROOT, 'outbox');

const NIMS_DATA = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'nims.json'), 'utf8'));
const VALID_NIMS = new Map(NIMS_DATA.map((item) => [item.nim, item.name]));

function loadDb() {
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } catch {
    return { users: {}, otps: {} };
  }
}

const db = loadDb();

function saveDb() {
  fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

const keyBuf = crypto.createHash('sha256').update(SECRET).digest();

function encrypt(plain) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', keyBuf, iv);
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map((b) => b.toString('base64')).join('.');
}

function decrypt(blob) {
  const [iv, tag, encrypted] = blob.split('.').map((part) => Buffer.from(part, 'base64'));
  const decipher = crypto.createDecipheriv('aes-256-gcm', keyBuf, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

function signToken(nim, ttlMinutes = 30) {
  const exp = Date.now() + ttlMinutes * 60000;
  const payload = Buffer.from(JSON.stringify({ nim, exp })).toString('base64url');
  const signature = crypto.createHmac('sha256', keyBuf).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

function verifyToken(token) {
  try {
    const [payload, signature] = token.split('.');
    const expected = crypto.createHmac('sha256', keyBuf).update(payload).digest('base64url');
    if (signature !== expected) return null;
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (data.exp < Date.now()) return null;
    return data;
  } catch {
    return null;
  }
}

function generatePassword(length = 12) {
  const lower = 'abcdefghjkmnpqrstuvwxyz';
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const digits = '23456789';
  const all = lower + upper + digits;
  const pick = (set) => set[crypto.randomInt(set.length)];
  const chars = [pick(lower), pick(upper), pick(digits)];
  while (chars.length < length) chars.push(pick(all));
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = crypto.randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

const transporter = process.env.SMTP_HOST
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
    })
  : null;

async function deliver({ to, subject, html }) {
  if (transporter) {
    await transporter.sendMail({ from: process.env.MAIL_FROM || to, to, subject, html });
    log.info({ to, subject }, 'Email terkirim via SMTP');
    return;
  }
  fs.mkdirSync(OUTBOX, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const safeSubject = subject.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
  const file = path.join(OUTBOX, `${stamp}-${safeSubject}.html`);
  fs.writeFileSync(file, html);
  log.info({ to, subject, file: path.relative(ROOT, file) }, 'Email disimpan ke outbox (mode tanpa SMTP)');
}

function page(title, bodyHtml) {
  return `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<title>${title}</title>
<style>
  body { font-family: Arial, Helvetica, sans-serif; background: #f4f6f9; margin: 0; padding: 32px; }
  .card { max-width: 560px; margin: auto; background: #fff; border-radius: 12px; padding: 32px;
          box-shadow: 0 2px 10px rgba(0,0,0,.08); color: #1f2937; }
  h1 { font-size: 20px; margin: 0 0 16px; color: #111827; }
  .box { background: #f3f4f6; border-radius: 8px; padding: 14px 18px; margin: 14px 0;
         font-size: 15px; word-break: break-all; }
  .code { font-size: 30px; font-weight: bold; letter-spacing: 8px; text-align: center; color: #1d4ed8; }
  a.btn { display: inline-block; background: #2563eb; color: #fff; padding: 11px 22px;
          border-radius: 8px; text-decoration: none; margin-top: 8px; }
  p, li { font-size: 14px; line-height: 1.6; }
  .foot { margin-top: 24px; font-size: 12px; color: #6b7280; }
</style>
</head>
<body><div class="card">${bodyHtml}
<p class="foot">Email otomatis dari ${config.appName}. Abaikan bila Anda tidak merasa melakukan permintaan ini.</p>
</div></body></html>`;
}

const esc = (value) =>
  String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function credentialsTemplate(username, password) {
  return page(
    'Akun Berhasil Dibuat',
    `<h1>Akun ${esc(config.appName)} Berhasil Dibuat</h1>
     <p>Selamat! Akun Anda telah aktif. Berikut data login Anda:</p>
     <div class="box">Username&nbsp;: <b>${esc(username)}</b><br>Kata sandi: <b>${esc(password)}</b></div>
     <p>Segera masuk dan ganti kata sandi Anda.</p>
     <a class="btn" href="${esc(config.appUrl)}">Masuk ke Portal LMS</a>`
  );
}

function otpTemplate(code, minutes) {
  return page(
    'Kode Verifikasi Ganti Sandi',
    `<h1>Kode Verifikasi</h1>
     <p>Gunakan kode berikut untuk mengganti kata sandi akun LMS Anda:</p>
     <div class="box code">${esc(code)}</div>
     <p>Kode berlaku selama <b>${minutes} menit</b>. Jangan bagikan kode ini kepada siapa pun.</p>`
  );
}

function passwordChangedTemplate() {
  return page(
    'Kata Sandi Diperbarui',
    `<h1>Kata Sandi Berhasil Diperbarui</h1>
     <p>Kata sandi akun LMS Anda baru saja diubah melalui verifikasi WhatsApp.</p>
     <p>Bila <b>bukan</b> Anda yang melakukan perubahan, segera hubungi ${esc(config.adminContact)}.</p>`
  );
}

const app = express();
app.use(express.json());

const requireApiKey = (req, res, next) => {
  if ((req.get('x-chatbot-token') || '') !== API_KEY) {
    return res.status(401).json({ success: false, status: 'unauthorized', message: 'API key tidak valid' });
  }
  return next();
};

app.get('/', (_req, res) => {
  res.json({ service: 'mock-lms-api', ok: true, valid_nims: VALID_NIMS.size });
});

// POST /chatbot/check-nim
app.post('/chatbot/check-nim', requireApiKey, (req, res) => {
  try {
    const nim = String(req.body?.nomer_induk ?? '').trim();
    if (!/^[0-9]{6,15}$/.test(nim)) {
      return res.status(400).json({ success: false, status: 'invalid_request', message: 'Parameter nomer_induk tidak valid' });
    }
    if (!VALID_NIMS.has(nim)) {
      return res.json({ success: false, status: 'not_found', message: 'NIM tidak terdaftar' });
    }
    const existing = db.users[nim];
    if (existing) {
      return res.json({ success: true, status: 'already_registered', message: 'Akun sudah terdaftar' });
    }
    const name = VALID_NIMS.get(nim);
    return res.json({
      success: true,
      status: 'valid',
      name,
      email_masked: '',
    });
  } catch (err) {
    log.error({ err: err.stack || err.message }, 'Endpoint check-nim gagal');
    return res.status(500).json({ success: false, status: 'server_error' });
  }
});

// POST /chatbot/send-otp
app.post('/chatbot/send-otp', requireApiKey, async (req, res) => {
  try {
    const nim = String(req.body?.nomer_induk ?? '').trim();
    const email = String(req.body?.email ?? '').trim();
    if (!/^[0-9]{6,15}$/.test(nim)) {
      return res.status(400).json({ success: false, status: 'invalid_request', message: 'Parameter nomer_induk tidak valid' });
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ success: false, status: 'invalid_request', message: 'Parameter email tidak valid' });
    }
    if (!VALID_NIMS.has(nim)) {
      return res.json({ success: false, status: 'not_found', message: 'NIM tidak terdaftar' });
    }
    const existing = db.users[nim];
    if (existing) {
      return res.json({ success: true, status: 'already_registered', message: 'Akun sudah terdaftar' });
    }

    const now = Date.now();
    const previous = db.otps[nim];
    if (previous && now - previous.sent_at < 60000) {
      const waitSeconds = Math.ceil((60000 - (now - previous.sent_at)) / 1000);
      return res.json({ success: false, status: 'cooldown', wait_seconds: waitSeconds, message: 'Tunggu sebentar sebelum meminta kode lagi' });
    }

    const minutes = 10;
    const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
    const name = VALID_NIMS.get(nim);
    const otpToken = signToken(nim, minutes);
    db.otps[nim] = {
      hash: sha256(code),
      email,
      sent_at: now,
      expires_at: now + minutes * 60000,
      attempts: 0,
    };
    saveDb();

    await deliver({
      to: email,
      subject: `[${config.appName}] Kode Verifikasi`,
      html: otpTemplate(code, minutes),
    });

    log.info({ nim, email }, 'OTP terkirim');
    return res.json({
      success: true,
      status: 'otp_sent',
      email_masked: maskEmail(email),
      otp_token: otpToken,
    });
  } catch (err) {
    log.error({ err: err.stack || err.message }, 'Endpoint send-otp gagal');
    return res.status(500).json({ success: false, status: 'server_error' });
  }
});

// POST /chatbot/verify-otp
app.post('/chatbot/verify-otp', requireApiKey, (req, res) => {
  try {
    const { otp_token, otp_code } = req.body || {};
    if (!otp_token || !otp_code) {
      return res.status(400).json({ success: false, status: 'invalid_request', message: 'Parameter tidak lengkap' });
    }

    const tokenData = verifyToken(otp_token);
    if (!tokenData) {
      return res.json({ success: false, status: 'expired', message: 'Token kedaluwarsa' });
    }

    const nim = tokenData.nim;
    const record = db.otps[nim];
    if (!record) {
      return res.json({ success: false, status: 'expired', message: 'OTP tidak ditemukan atau kedaluwarsa' });
    }

    const now = Date.now();
    if (record.expires_at < now) {
      delete db.otps[nim];
      saveDb();
      return res.json({ success: false, status: 'expired', message: 'OTP kedaluwarsa' });
    }

    record.attempts += 1;
    if (record.attempts > 5) {
      delete db.otps[nim];
      saveDb();
      return res.json({ success: false, status: 'too_many_attempts', message: 'Terlalu banyak percobaan' });
    }

    if (record.hash !== sha256(String(otp_code))) {
      saveDb();
      return res.json({ success: false, status: 'wrong_otp', attempts_left: 5 - record.attempts, message: 'Kode salah' });
    }

    delete db.otps[nim];
    saveDb();

    const passwordToken = signToken(nim, 30);
    const email = `${nim}@student.unmul.ac.id`;
    return res.json({
      success: true,
      status: 'otp_verified',
      password_token: passwordToken,
      email_masked: maskEmail(email),
    });
  } catch (err) {
    log.error({ err: err.stack || err.message }, 'Endpoint verify-otp gagal');
    return res.status(500).json({ success: false, status: 'server_error' });
  }
});

// POST /chatbot/set-password
app.post('/chatbot/set-password', requireApiKey, async (req, res) => {
  try {
    const { password_token, password, password_confirmation } = req.body || {};
    if (!password_token || !password) {
      return res.status(400).json({ success: false, status: 'invalid_request', message: 'Parameter tidak lengkap' });
    }
    if (password !== password_confirmation) {
      return res.status(400).json({ success: false, status: 'invalid_request', message: 'Password tidak cocok' });
    }
    if (!/^(?=.*[A-Za-z])(?=.*\d)\S{8,128}$/.test(password)) {
      return res.status(422).json({ success: false, status: 'weak_password', message: 'Kata sandi minimal 8 karakter, kombinasi huruf dan angka' });
    }

    const tokenData = verifyToken(password_token);
    if (!tokenData) {
      return res.json({ success: false, status: 'expired', message: 'Token kedaluwarsa' });
    }

    const nim = tokenData.nim;
    const now = new Date().toISOString();
    const username = `mhs${nim}`;
    const email = `${nim}@student.unmul.ac.id`;

    if (!db.users[nim]) {
      db.users[nim] = {
        nim,
        username,
        email,
        password_enc: encrypt(password),
        created_at: now,
        updated_at: now,
      };
    } else {
      db.users[nim].password_enc = encrypt(password);
      db.users[nim].updated_at = now;
    }
    saveDb();

    await deliver({
      to: email,
      subject: `[${config.appName}] Kata Sandi Diperbarui`,
      html: passwordChangedTemplate(),
    });

    log.info({ nim }, 'Password berhasil diatur');
    return res.json({
      success: true,
      status: 'registered',
      name: `Mahasiswa ${nim}`,
      email,
    });
  } catch (err) {
    log.error({ err: err.stack || err.message }, 'Endpoint set-password gagal');
    return res.status(500).json({ success: false, status: 'server_error' });
  }
});

app.use((req, res) => {
  res.status(404).json({ success: false, status: 'not_found' });
});

app.listen(PORT, () => {
  log.info(`Mock LMS API berjalan di http://localhost:${PORT}`);
  log.info(`NIM valid terdaftar: ${VALID_NIMS.size} entri (data/nims.json)`);
  log.info(`Mode pengiriman email: ${transporter ? 'SMTP' : 'outbox/ (tanpa SMTP)'}`);
});
