// backend/cache.js
// Simple in-memory cache implementation
const cache = new Map();
const timeouts = new Map();

// wrapper helpers
async function get(key) {
  return cache.get(key) || null;
}

async function set(key, value, ttlSeconds = 300) {
  cache.set(key, value);
  
  // Clear any existing timeout for this key
  if (timeouts.has(key)) {
    clearTimeout(timeouts.get(key));
  }

  // Set expiration if ttl > 0
  if (ttlSeconds > 0) {
    const timeout = setTimeout(() => {
      cache.delete(key);
      timeouts.delete(key);
    }, ttlSeconds * 1000);
    timeouts.set(key, timeout);
  }
}

async function del(key) {
  cache.delete(key);
  if (timeouts.has(key)) {
    clearTimeout(timeouts.get(key));
    timeouts.delete(key);
  }
}

export { get, set, del };
