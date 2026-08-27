const config = require('../config');
const api = require('../services/lms-api');
const sessionStore = require('./session');
const rateLimit = require('./rate-limit');
const msgs = require('./messages');
const { extractText } = require('../utils');

const RE_CANCEL = /^(batal|cancel|stop|keluar|exit|reset)\s*$/i;
const RE_MENU = /^(menu|mulai|start|halo|hai|hi|hello|assalamu.?alaikum|selamat\s+(pagi|siang|sore|malam))\s*[!.?]?$/i;
const RE_HELP = /^(3|help|bantuan|panduan|\?|\/help)\s*$/i;
const RE_REGISTER = /^(1|daftar|registrasi|verifikasi|verif)\s*$/i;
const RE_CHANGE_PASSWORD = /^(2|(ganti|ubah)\s*(kata\s*)?sandi|lupa\s*(kata\s*)?sandi)\s*$/i;

const RE_OTP = /^\d{6}$/;
const RE_PASSWORD = /^(?=.*[A-Za-z])(?=.*\d)\S{8,128}$/;
const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

    const checkResult = await api.checkNim(nim);
    if (checkResult.kind === 'not_found') {
      rateLimit.record(key);
      sessionStore.clear(jid);
      await send(jid, msgs.nimNotFound(nim));
      return;
    }
    if (checkResult.kind === 'already_registered') {
      rateLimit.reset(key);
      sessionStore.clear(jid);
      await send(jid, msgs.alreadyRegistered(checkResult));
      return;
    }
    if (checkResult.kind === 'error') {
      sessionStore.clear(jid);
      await send(jid, msgs.genericFailure());
      return;
    }

    sessionStore.set(jid, 'REGISTER_EMAIL', { nim });
    await send(jid, msgs.askEmail());
  }

  async function handleRegisterEmail(jid, raw, data) {
    const email = raw.trim();
    if (!RE_EMAIL.test(email)) {
      await send(jid, msgs.invalidEmailFormat());
      return;
    }
    await send(jid, msgs.checking());

    const key = `reg:${jid}`;
    const otpResult = await api.sendOtp(data.nim, email);
    if (otpResult.kind === 'sent') {
      rateLimit.reset(key);
      sessionStore.set(jid, 'REGISTER_OTP', { nim: data.nim, email, otpToken: otpResult.otpToken });
      await send(jid, msgs.otpSent(otpResult));
      return;
    }
    if (otpResult.kind === 'cooldown') {
      await send(jid, msgs.cooldown(otpResult.waitSeconds));
      return;
    }
    if (otpResult.kind === 'already_registered') {
      sessionStore.clear(jid);
      await send(jid, msgs.alreadyRegistered());
      return;
    }
    if (otpResult.kind === 'not_found') {
      rateLimit.record(key);
      sessionStore.clear(jid);
      await send(jid, msgs.nimNotFound(data.nim));
      return;
    }
    sessionStore.clear(jid);
    await send(jid, msgs.genericFailure());
  }

  async function handleRegisterOtp(jid, raw, data) {
    const code = raw.replace(/\D/g, '');
    if (!RE_OTP.test(code)) {
      await send(jid, msgs.invalidOtpInput());
      return;
    }
    await send(jid, msgs.checking());

    const result = await api.verifyOtp(data.otpToken, code);
    if (result.kind === 'verified') {
      sessionStore.set(jid, 'REGISTER_PASSWORD', { nim: data.nim, passwordToken: result.passwordToken });
      await send(jid, msgs.askNewPassword());
      return;
    }
    if (result.kind === 'wrong_otp') {
      await send(jid, msgs.wrongOtp(result.attemptsLeft));
      return;
    }
    if (result.kind === 'expired') {
      sessionStore.clear(jid);
      await send(jid, msgs.otpExpired());
      return;
    }
    if (result.kind === 'too_many_attempts') {
      sessionStore.clear(jid);
      await send(jid, msgs.tooManyAttempts());
      return;
    }
    sessionStore.clear(jid);
    await send(jid, msgs.genericFailure());
  }

  async function handleRegisterPassword(jid, raw, data) {
    const password = raw.trim().replace(/\s+/g, '');
    if (!RE_PASSWORD.test(password)) {
      await send(jid, msgs.weakPassword());
      return;
    }
    await send(jid, msgs.checking());

    const result = await api.setPassword(data.passwordToken, password);
    sessionStore.clear(jid);
    if (result.kind === 'registered') {
      rateLimit.reset(`reg:${jid}`);
      await send(jid, msgs.registerSuccess(result));
    } else {
      await send(jid, msgs.genericFailure());
    }
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

    const checkResult = await api.checkNim(nim);
    if (checkResult.kind === 'not_found') {
      rateLimit.record(key);
      sessionStore.clear(jid);
      await send(jid, msgs.nimNotFound(nim));
      return;
    }
    if (checkResult.kind === 'error') {
      sessionStore.clear(jid);
      await send(jid, msgs.genericFailure());
      return;
    }

    sessionStore.set(jid, 'RESET_EMAIL', { nim });
    await send(jid, msgs.askEmail());
  }

  async function handleResetEmail(jid, raw, data) {
    const email = raw.trim();
    if (!RE_EMAIL.test(email)) {
      await send(jid, msgs.invalidEmailFormat());
      return;
    }
    await send(jid, msgs.checking());

    const key = `otp:${jid}`;
    const otpResult = await api.sendOtp(data.nim, email);
    if (otpResult.kind === 'sent') {
      rateLimit.reset(key);
      sessionStore.set(jid, 'RESET_OTP', { nim: data.nim, email, otpToken: otpResult.otpToken });
      await send(jid, msgs.otpSent(otpResult));
      return;
    }
    if (otpResult.kind === 'cooldown') {
      await send(jid, msgs.cooldown(otpResult.waitSeconds));
      return;
    }
    if (otpResult.kind === 'not_found') {
      rateLimit.record(key);
      sessionStore.clear(jid);
      await send(jid, msgs.nimNotFound(data.nim));
      return;
    }
    sessionStore.clear(jid);
    await send(jid, msgs.genericFailure());
  }

  async function handleResetOtp(jid, raw, data) {
    const code = raw.replace(/\D/g, '');
    if (!RE_OTP.test(code)) {
      await send(jid, msgs.invalidOtpInput());
      return;
    }
    await send(jid, msgs.checking());

    const result = await api.verifyOtp(data.otpToken, code);
    if (result.kind === 'verified') {
      sessionStore.set(jid, 'RESET_PASSWORD', { nim: data.nim, passwordToken: result.passwordToken });
      await send(jid, msgs.askNewPassword());
      return;
    }
    if (result.kind === 'wrong_otp') {
      await send(jid, msgs.wrongOtp(result.attemptsLeft));
      return;
    }
    if (result.kind === 'expired') {
      sessionStore.clear(jid);
      await send(jid, msgs.otpExpired());
      return;
    }
    if (result.kind === 'too_many_attempts') {
      sessionStore.clear(jid);
      await send(jid, msgs.tooManyAttempts());
      return;
    }
    sessionStore.clear(jid);
    await send(jid, msgs.genericFailure());
  }

  async function handleResetPassword(jid, raw, data) {
    const password = raw.trim().replace(/\s+/g, '');
    if (!RE_PASSWORD.test(password)) {
      await send(jid, msgs.weakPassword());
      return;
    }
    await send(jid, msgs.checking());

    const result = await api.setPassword(data.passwordToken, password);
    sessionStore.clear(jid);
    if (result.kind === 'registered') {
      await send(jid, msgs.passwordUpdated());
    } else {
      await send(jid, msgs.genericFailure());
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
        case 'REGISTER_EMAIL':
          return handleRegisterEmail(jid, trimmed, current.data);
        case 'REGISTER_OTP':
          return handleRegisterOtp(jid, trimmed, current.data);
        case 'REGISTER_PASSWORD':
          return handleRegisterPassword(jid, trimmed, current.data);
        case 'RESET_NIM':
          return handleResetNim(jid, trimmed);
        case 'RESET_EMAIL':
          return handleResetEmail(jid, trimmed, current.data);
        case 'RESET_OTP':
          return handleResetOtp(jid, trimmed, current.data);
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
