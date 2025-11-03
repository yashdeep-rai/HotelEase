import mysql from 'mysql2/promise';

// Read DB configuration from environment variables with sensible defaults
const DB_HOST = process.env.DB_HOST || '127.0.0.1';
const DB_USER = process.env.DB_USER || 'root';
const DB_PASSWORD = process.env.DB_PASSWORD || 'tachyon';
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

export default pool;