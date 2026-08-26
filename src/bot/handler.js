const config = require('../config');
const api = require('../services/lms-api');
const sessionStore = require('./session');
const rateLimit = require('./rate-limit');
const msgs = require('./messages');
const { extractText, fromJid } = require('../utils');

const RE_CANCEL = /^(batal|cancel|stop|keluar|exit|reset)\s*$/i;
const RE_MENU = /^(menu|mulai|start|halo|hai|hi|hello|assalamu.?alaikum|selamat\s+(pagi|siang|sore|malam))\s*[!.?]?$/i;
const RE_HELP = /^(3|help|bantuan|panduan|\?|\/help)\s*$/i;
const RE_REGISTER = /^(1|daftar|registrasi|verifikasi|verif)\s*$/i;
const RE_CHANGE_PASSWORD = /^(2|(ganti|ubah)\s*(kata\s*)?sandi|lupa\s*(kata\s*)?sandi)\s*$/i;

const RE_OTP = /^\d{6}$/;
const RE_PASSWORD = /^(?=.*[A-Za-z])(?=.*\d)\S{8,128}$/;

const cleanNim = (raw) => raw.replace(/[\s.\-_/]/g, '');

function createHandler(sock) {
  async function send(jid, text) {
    try {
      await sock.sendPresenceUpdate('composing', jid);
    } catch {}
    await sock.sendMessage(jid, { text });
  }

  async function handleRegisterNim(jid, raw) {
    const key = `reg:${jid}`;
    if (rateLimit.isBlocked(key)) {
      sessionStore.clear(jid);
      await send(jid, msgs.rateLimited());
      return;
    }
    const nim = cleanNim(raw);
    if (!config.validation.nimRegex.test(nim)) {
      await send(jid, msgs.invalidNimFormat());
      return;
    }
    await send(jid, msgs.checking());
    const result = await api.registerByNim(nim, fromJid(jid));
    switch (result.kind) {
      case 'created':
        rateLimit.reset(key);
        await send(jid, msgs.registerSuccess(result));
        break;
      case 'exists':
        rateLimit.reset(key);
        await send(jid, msgs.alreadyRegistered(result));
        break;
      case 'invalid':
        rateLimit.record(key);
        await send(jid, msgs.nimNotFound(nim));
        break;
      default:
        await send(jid, msgs.genericFailure(result));
    }
    sessionStore.clear(jid);
  }

  async function handleResetNim(jid, raw) {
    const key = `otp:${jid}`;
    const nim = cleanNim(raw);
    if (!config.validation.nimRegex.test(nim)) {
      await send(jid, msgs.invalidNimFormat());
      return;
    }
    if (rateLimit.isBlocked(key)) {
      sessionStore.clear(jid);
      await send(jid, msgs.rateLimited());
      return;
    }
    await send(jid, msgs.checking());
    const result = await api.requestOtp(nim, fromJid(jid));
    if (result.kind === 'sent') {
      rateLimit.reset(key);
      sessionStore.set(jid, 'RESET_CODE', { nim });
      await send(jid, msgs.otpSent(result));
      return;
    }
    sessionStore.clear(jid);
    if (result.kind === 'invalid' || result.kind === 'no_account') rateLimit.record(key);
    await send(jid, msgs.otpRequestFailed(result, nim));
  }

  async function handleResetCode(jid, raw, data) {
    const code = raw.replace(/\D/g, '');
    if (!RE_OTP.test(code)) {
      await send(jid, msgs.invalidOtpInput());
      return;
    }
    sessionStore.set(jid, 'RESET_PASSWORD', { ...data, code });
    await send(jid, msgs.askNewPassword());
  }

  async function handleResetPassword(jid, raw, data) {
    const password = raw.trim().replace(/\s+/g, '');
    if (!RE_PASSWORD.test(password)) {
      await send(jid, msgs.weakPassword());
      return;
    }
    await send(jid, msgs.checking());
    const result = await api.confirmReset(data.nim, data.code, password);
    sessionStore.clear(jid);
    if (result.kind === 'updated') {
      await send(jid, msgs.passwordUpdated());
    } else {
      await send(jid, msgs.resetFailed(result));
    }
  }

  async function handleMessage(msg) {
    const jid = msg.key.remoteJid;
    const text = extractText(msg.message);
    if (!text) return;

    const trimmed = text.trim();
    const lowered = trimmed.toLowerCase();

    if (config.bot.markRead) {
      await sock.readMessages([msg.key]).catch(() => {});
    }

    if (RE_CANCEL.test(lowered)) {
      sessionStore.clear(jid);
      await send(jid, msgs.canceled());
      return;
    }

    const current = sessionStore.get(jid);

    if (current) {
      if (RE_MENU.test(lowered) || RE_HELP.test(lowered)) {
        sessionStore.clear(jid);
        await send(jid, msgs.welcome());
        return;
      }
      switch (current.state) {
        case 'REGISTER_NIM':
          return handleRegisterNim(jid, trimmed);
        case 'RESET_NIM':
          return handleResetNim(jid, trimmed);
        case 'RESET_CODE':
          return handleResetCode(jid, trimmed, current.data);
        case 'RESET_PASSWORD':
          return handleResetPassword(jid, trimmed, current.data);
        default:
          sessionStore.clear(jid);
          await send(jid, msgs.welcome());
      }
      return;
    }

    if (RE_HELP.test(lowered)) {
      await send(jid, msgs.help());
      return;
    }
    if (RE_REGISTER.test(lowered)) {
      sessionStore.set(jid, 'REGISTER_NIM');
      await send(jid, msgs.askNimForRegister());
      return;
    }
    if (RE_CHANGE_PASSWORD.test(lowered)) {
      sessionStore.set(jid, 'RESET_NIM');
      await send(jid, msgs.askNimForReset());
      return;
    }
    await send(jid, msgs.welcome());
  }

  return handleMessage;
}

module.exports = createHandler;
