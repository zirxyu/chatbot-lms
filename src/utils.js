const crypto = require('crypto');

function normalizePhone(input) {
  const digits = String(input || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('62')) return digits;
  if (digits.startsWith('0')) return `62${digits.slice(1)}`;
  return digits;
}

function toJid(phone) {
  return `${normalizePhone(phone)}@s.whatsapp.net`;
}

function fromJid(jid) {
  return String(jid || '').split('@')[0].replace(/\D/g, '');
}

function unwrapMessage(message) {
  let current = message;
  const wrappers = ['ephemeralMessage', 'viewOnceMessage', 'viewOnceMessageV2', 'documentWithCaptionMessage'];
  for (let i = 0; i < 5; i += 1) {
    const wrapper = wrappers.find((key) => current?.[key]?.message);
    if (!wrapper) break;
    current = current[wrapper].message;
  }
  return current;
}

function extractText(rawMessage) {
  const message = unwrapMessage(rawMessage);
  if (!message) return '';
  const text =
    message.conversation ||
    message.extendedTextMessage?.text ||
    message.imageMessage?.caption ||
    message.videoMessage?.caption ||
    message.buttonsResponseMessage?.selectedDisplayText ||
    message.listResponseMessage?.title ||
    '';
  return String(text).trim();
}

function maskEmail(email) {
  if (!email || !email.includes('@')) return 'email terdaftar Anda';
  const [local, domain] = email.split('@');
  const head = local.slice(0, Math.min(2, local.length));
  return `${head}${'*'.repeat(Math.max(3, local.length - head.length))}@${domain}`;
}

function requestId() {
  return crypto.randomBytes(4).toString('hex');
}

module.exports = { normalizePhone, toJid, fromJid, extractText, maskEmail, requestId };
