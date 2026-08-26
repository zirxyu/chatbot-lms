const config = require('../config');

const sessions = new Map();

function get(jid) {
  const current = sessions.get(jid);
  if (!current) return null;
  if (Date.now() > current.expiresAt) {
    sessions.delete(jid);
    return null;
  }
  return current;
}

function set(jid, state, data = {}) {
  sessions.set(jid, {
    state,
    data,
    expiresAt: Date.now() + config.limits.sessionTtlMinutes * 60000,
  });
}

function clear(jid) {
  sessions.delete(jid);
}

setInterval(() => {
  const now = Date.now();
  for (const [jid, value] of sessions) {
    if (now > value.expiresAt) sessions.delete(jid);
  }
}, 60000).unref();

module.exports = { get, set, clear };
