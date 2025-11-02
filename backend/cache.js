// backend/cache.js
// Redis client helper
import { createClient } from 'redis';

const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const client = createClient({ url: redisUrl });

client.on('error', (err) => console.error('Redis Client Error', err));

async function connect() {
  if (!client.isOpen) await client.connect();
}

// wrapper helpers
async function get(key) {
  await connect();
  const v = await client.get(key);
  return v ? JSON.parse(v) : null;
}

async function set(key, value, ttlSeconds = 300) {
  await connect();
  const s = JSON.stringify(value);
  if (ttlSeconds > 0) {
    await client.setEx(key, ttlSeconds, s);
  } else {
    await client.set(key, s);
  }
}

async function del(key) {
  await connect();
  await client.del(key);
}

export { client as redisClient, get, set, del };
