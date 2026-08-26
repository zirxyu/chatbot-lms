const config = require('../config');

const hits = new Map();

function prune(list, windowMs) {
  const now = Date.now();
  return list.filter((timestamp) => now - timestamp < windowMs);
}

function isBlocked(key) {
  const windowMs = config.limits.windowMinutes * 60000;
  const list = prune(hits.get(key) || [], windowMs);
  hits.set(key, list);
  return list.length >= config.limits.maxAttempts;
}

function record(key) {
  const list = hits.get(key) || [];
  list.push(Date.now());
  hits.set(key, list);
}

function reset(key) {
  hits.delete(key);
}

setInterval(() => {
  const windowMs = config.limits.windowMinutes * 60000;
  for (const [key, list] of hits) {
    const kept = prune(list, windowMs);
    if (kept.length > 0) hits.set(key, kept);
    else hits.delete(key);
  }
}, 120000).unref();

module.exports = { isBlocked, record, reset };
