require('dotenv').config();
const path = require('path');

const toNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const toBoolean = (value, fallback) => {
  if (value === undefined || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
};

const normalizePhone = (input) => {
  const digits = String(input || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('62')) return digits;
  if (digits.startsWith('0')) return `62${digits.slice(1)}`;
  return digits;
};

let nimRegex;
try {
  nimRegex = new RegExp(process.env.NIM_PATTERN || '^[0-9]{6,15}$');
} catch {
  nimRegex = /^[0-9]{6,15}$/;
}

const config = {
  appName: process.env.APP_NAME || 'Portal LMS',
  appUrl: (process.env.APP_URL || 'http://localhost:8000').replace(/\/+$/, ''),
  adminContact: process.env.ADMIN_CONTACT || 'admin',
  bot: {
    sessionDir: path.resolve(process.cwd(), process.env.SESSION_DIR || './session'),
    pairingPhone: normalizePhone(process.env.PAIRING_PHONE),
    ownerPhone: normalizePhone(process.env.BOT_OWNER),
    allowGroups: toBoolean(process.env.ALLOW_GROUPS, false),
    markRead: toBoolean(process.env.MARK_READ, true),
    reconnectMs: toNumber(process.env.RECONNECT_MS, 5000),
  },
  limits: {
    maxAttempts: toNumber(process.env.MAX_VERIFY_ATTEMPTS, 5),
    windowMinutes: toNumber(process.env.RATE_WINDOW_MIN, 60),
    sessionTtlMinutes: toNumber(process.env.SESSION_TTL_MIN, 5),
  },
  api: {
    baseUrl: (process.env.LMS_API_URL || '').replace(/\/+$/, ''),
    key: process.env.LMS_API_KEY || '',
    timeoutMs: toNumber(process.env.REQUEST_TIMEOUT_MS, 15000),
  },
  validation: { nimRegex },
};

config.bot.ownerJid = config.bot.ownerPhone ? `${config.bot.ownerPhone}@s.whatsapp.net` : '';

module.exports = config;
