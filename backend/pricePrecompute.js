// backend/pricePrecompute.js
// Scheduled precompute job: for each RoomType, compute suggested price multiplier for next N days
// and store results in Redis for fast reads by the forecast endpoint.

import cron from 'node-cron';
import pool from './db.js';
import { suggestPrice } from './forecast.js';
import { set as cacheSet } from './cache.js';

// A small list of example holiday dates (YYYY-MM-DD) to boost prices.
// In production, store holidays in a table or external API.
const HOLIDAYS = [
  // sample
  '2024-12-25',
  '2024-12-31'
];

function isHoliday(dateStr) {
  return HOLIDAYS.includes(dateStr);
}

async function precomputeForDate(roomTypeId, dateStr) {
  const nextDay = new Date(dateStr);
  nextDay.setDate(nextDay.getDate() + 1);
  const toDate = nextDay.toISOString().slice(0, 10);

  const result = await suggestPrice(pool, roomTypeId, dateStr, toDate);

  // Apply holiday boost (simple extra multiplier)
  if (isHoliday(dateStr)) {
    result.multiplier = +(result.multiplier * 1.1).toFixed(2);
    result.suggestedPrice = +(result.basePrice * result.multiplier).toFixed(2);
    result.holiday = true;
  }

  // Cache key per day per room type
  const key = `price_suggestion:${roomTypeId}:${dateStr}`;
  // Store for 24 hours (86400 sec)
  await cacheSet(key, result, 86400);
  return result;
}

async function precomputeNextNDays(n = 30) {
  // Get room types
  const [rows] = await pool.query('SELECT RoomTypeID FROM RoomTypes');
  const roomTypes = rows.map(r => r.RoomTypeID);

  const today = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const dateStr = d.toISOString().slice(0, 10);
    for (const rt of roomTypes) {
      try {
        await precomputeForDate(rt, dateStr);
      } catch (err) {
        console.error('Precompute error for', rt, dateStr, err.message || err);
      }
    }
  }
}

export function startPrecompute() {
  // Run once at startup (non-blocking)
  precomputeNextNDays(14).catch(err => console.error('Initial precompute failed', err));

  // Schedule to run every day at 02:00 AM server time
  cron.schedule('0 2 * * *', () => {
    console.log('Running scheduled precompute for next 30 days...');
    precomputeNextNDays(30).catch(err => console.error('Scheduled precompute failed', err));
  });
}
