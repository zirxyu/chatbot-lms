const config = require('../config');
const log = require('../logger');
const { requestId } = require('../utils');

const PATHS = {
  register: '/auth/wa/register',
  otpRequest: '/auth/wa/password-reset/request',
  otpConfirm: '/auth/wa/password-reset/confirm',
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
        'x-api-key': config.api.key,
      },
      body: JSON.stringify({ ...payload, ref }),
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

async function registerByNim(nim, phone) {
  try {
    const res = await post(PATHS.register, { nim, phone });
    const data = res.data || {};
    if (res.success && res.status === 'account_created') {
      return { kind: 'created', username: data.username, email: data.email };
    }
    if (res.success && res.status === 'account_exists') {
      return { kind: 'exists', username: data.username, email: data.email, resetUrl: data.reset_url };
    }
    if (res.status === 'nim_not_found') return { kind: 'invalid', ref: res.ref };
    return { kind: 'unknown', ref: res.ref, detail: res.message || res.status || `HTTP ${res.httpStatus}` };
  } catch (err) {
    return { kind: 'error', ref: err.ref, detail: err.message };
  }
}

async function requestOtp(nim, phone) {
  try {
    const res = await post(PATHS.otpRequest, { nim, phone });
    const data = res.data || {};
    if (res.success && res.status === 'otp_sent') {
      return {
        kind: 'sent',
        emailMasked: data.email_masked,
        expiresInMinutes: data.expires_in_minutes || 10,
      };
    }
    if (res.status === 'nim_not_found') return { kind: 'invalid', ref: res.ref };
    if (res.status === 'account_not_found') return { kind: 'no_account', ref: res.ref };
    if (res.httpStatus === 429 || res.status === 'too_many_requests') {
      return { kind: 'throttled', ref: res.ref };
    }
    return { kind: 'unknown', ref: res.ref, detail: res.message || res.status || `HTTP ${res.httpStatus}` };
  } catch (err) {
    return { kind: 'error', ref: err.ref, detail: err.message };
  }
}

async function confirmReset(nim, code, newPassword) {
  try {
    const res = await post(PATHS.otpConfirm, { nim, code, new_password: newPassword });
    if (res.success && res.status === 'password_updated') return { kind: 'updated' };
    if (res.status === 'invalid_code') return { kind: 'invalid_code', ref: res.ref };
    if (res.status === 'weak_password') return { kind: 'weak_password', ref: res.ref };
    return { kind: 'unknown', ref: res.ref, detail: res.message || res.status || `HTTP ${res.httpStatus}` };
  } catch (err) {
    return { kind: 'error', ref: err.ref, detail: err.message };
  }
}

module.exports = { registerByNim, requestOtp, confirmReset };
