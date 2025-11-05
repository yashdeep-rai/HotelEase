import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load .env relative to this file so DB credentials are available even if the
// process was started from a different CWD or before server-level dotenv runs.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, '.env');
dotenv.config({ path: envPath });

// Read DB configuration from environment variables
// Avoid hardcoding secrets here; prefer setting them in a .env
const DB_HOST = process.env.DB_HOST || '127.0.0.1';
const DB_USER = process.env.DB_USER || 'root';
const DB_PASSWORD = process.env.DB_PASSWORD || '';
const DB_NAME = process.env.DB_NAME || 'hotel_management';
const DB_PORT = process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306;

// Create a connection pool
const pool = mysql.createPool({
  host: DB_HOST,
  port: DB_PORT,
  user: DB_USER,
  password: DB_PASSWORD,
  database: DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Basic runtime sanity check: attempt a single quick connection to surface auth errors early
(async () => {
  try {
    // Mask password presence in logs
    const pwPresent = DB_PASSWORD && DB_PASSWORD.length > 0;
    //console.log(`DB config -> host=${DB_HOST} port=${DB_PORT} user=${DB_USER} passwordSet=${pwPresent}`);
    const conn = await pool.getConnection();
    await conn.query('SELECT 1');
    conn.release();
    console.log('✅ Database connection test succeeded');
  } catch (err) {
    console.error('❌ Database connection test failed:');
    console.error(err && err.message ? err.message : err);
    console.error('Please verify your DB credentials in backend/.env and that the MySQL server is running and accessible.');
  }
})();

export default pool;