const config = require('../config');
const log = require('../logger');
const { requestId } = require('../utils');

const PATHS = {
  checkNim: '/chatbot/check-nim',
  sendOtp: '/chatbot/send-otp',
  verifyOtp: '/chatbot/verify-otp',
  setPassword: '/chatbot/set-password',
};

async function post(pathname, payload) {
  const ref = requestId();
  const startedAt = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.api.timeoutMs);
  try {
    const res = await fetch(`${config.api.baseUrl}${pathname}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'X-Chatbot-Token': config.api.key,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const body = await res.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      const err = new Error(`Respons tidak valid dari server (HTTP ${res.status})`);
      err.kind = 'bad_response';
      err.ref = ref;
      throw err;
    }
    log.info({ pathname, httpStatus: res.status, ms: Date.now() - startedAt, ref }, 'API OK');
    return { httpStatus: res.status, ref, ...body };
  } catch (err) {
    err.ref = err.ref || ref;
    if (err.name === 'AbortError') {
      err.kind = 'timeout';
      err.message = 'Server tidak merespons tepat waktu';
    } else if (!err.kind) {
      err.kind = 'network_error';
      err.message = 'Gagal menghubungi server';
    }
    log.error({ pathname, ref, kind: err.kind, detail: err.message }, 'API gagal');
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

async function checkNim(nim) {
  try {
    const res = await post(PATHS.checkNim, { nomer_induk: nim });
    if (res.status === 'valid') {
      return { kind: 'valid', name: res.name, emailMasked: res.email_masked };
    }
    if (res.status === 'not_found') return { kind: 'not_found', ref: res.ref };
    if (res.status === 'already_registered') return { kind: 'already_registered', ref: res.ref };
    return { kind: 'unknown', ref: res.ref, detail: res.message || res.status || `HTTP ${res.httpStatus}` };
  } catch (err) {
    return { kind: 'error', ref: err.ref, detail: err.message };
  }
}

async function sendOtp(nim, email) {
  try {
    const res = await post(PATHS.sendOtp, { nomer_induk: nim, email });
    if (res.status === 'otp_sent') {
      return {
        kind: 'sent',
        emailMasked: res.email_masked,
        otpToken: res.otp_token,
      };
    }
    if (res.status === 'not_found') return { kind: 'not_found', ref: res.ref };
    if (res.status === 'already_registered') return { kind: 'already_registered', ref: res.ref };
    if (res.status === 'cooldown') return { kind: 'cooldown', waitSeconds: res.wait_seconds, ref: res.ref };
    if (res.httpStatus === 429 || res.status === 'too_many_requests') {
      return { kind: 'throttled', ref: res.ref };
    }
    return { kind: 'unknown', ref: res.ref, detail: res.message || res.status || `HTTP ${res.httpStatus}` };
  } catch (err) {
    return { kind: 'error', ref: err.ref, detail: err.message };
  }
}

async function verifyOtp(otpToken, otpCode) {
  try {
    const res = await post(PATHS.verifyOtp, { otp_token: otpToken, otp_code: otpCode });
    if (res.status === 'otp_verified') {
      return { kind: 'verified', passwordToken: res.password_token, emailMasked: res.email_masked };
    }
    if (res.status === 'wrong_otp') return { kind: 'wrong_otp', attemptsLeft: res.attempts_left, ref: res.ref };
    if (res.status === 'expired') return { kind: 'expired', ref: res.ref };
    if (res.status === 'too_many_attempts') return { kind: 'too_many_attempts', ref: res.ref };
    if (res.status === 'invalid_token') return { kind: 'invalid_token', ref: res.ref };
    return { kind: 'unknown', ref: res.ref, detail: res.message || res.status || `HTTP ${res.httpStatus}` };
  } catch (err) {
    return { kind: 'error', ref: err.ref, detail: err.message };
  }
}

async function setPassword(passwordToken, password) {
  try {
    const res = await post(PATHS.setPassword, {
      password_token: passwordToken,
      password: password,
      password_confirmation: password,
    });
    if (res.status === 'registered') {
      return { kind: 'registered', name: res.name, email: res.email };
    }
    if (res.status === 'expired') return { kind: 'expired', ref: res.ref };
    if (res.status === 'invalid_token') return { kind: 'invalid_token', ref: res.ref };
    return { kind: 'unknown', ref: res.ref, detail: res.message || res.status || `HTTP ${res.httpStatus}` };
  } catch (err) {
    return { kind: 'error', ref: err.ref, detail: err.message };
  }
}

module.exports = { checkNim, sendOtp, verifyOtp, setPassword };
