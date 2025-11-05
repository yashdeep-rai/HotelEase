// save as create-admin.js in backend/ then: node create-admin.js
import bcrypt from 'bcrypt';
import pool from './db.js';

async function createAdmin() {
  const first_name = 'Admin';
  const last_name = 'User';
  const email = 'admin@hotelease.com';
  const phone = '1234567890';
  const password = 'Tachyon@1234';

  const salt = await bcrypt.genSalt(10);
  const password_hash = await bcrypt.hash(password, salt);

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [guestResult] = await conn.query(
      'INSERT INTO Guests (FirstName, LastName, Email, Phone) VALUES (?, ?, ?, ?)',
      [first_name, last_name, email, phone]
    );
    const guestId = guestResult.insertId;
    const [userResult] = await conn.query(
      'INSERT INTO users (guest_id, email, password_hash, role) VALUES (?, ?, ?, ?)',
      [guestId, email, password_hash, 'admin']
    );
    await conn.commit();
    //console.log('Admin created:', { userId: userResult.insertId, email });
  } catch (err) {
    await conn.rollback();
    console.error('Failed to create admin:', err);
  } finally {
    conn.release();
    process.exit(0);
  }
}

createAdmin();