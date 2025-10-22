const express = require('express');
const pool = require('../db');

const router = express.Router();

// Helper: check availability
async function isRoomAvailable(roomId, checkin, checkout) {
  const sql = `
    SELECT COUNT(*) AS cnt FROM reservation
    WHERE room_id = ?
      AND status IN ('BOOKED','CHECKED_IN')
      AND NOT (checkout_date <= ? OR checkin_date >= ?)
  `;
  const [rows] = await pool.query(sql, [roomId, checkin, checkout]);
  return rows[0].cnt === 0;
}

// POST /api/reservations
router.post('/', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { customerId, roomId, checkinDate, checkoutDate, totalAmount } = req.body;
    if (!customerId || !roomId || !checkinDate || !checkoutDate || totalAmount == null) return res.status(400).json({ error: 'Missing fields' });
    // Basic date validation
    const checkin = new Date(checkinDate);
    const checkout = new Date(checkoutDate);
    if (!(checkout > checkin)) return res.status(400).json({ error: 'checkoutDate must be after checkinDate' });

    await conn.beginTransaction();
    // Check customer exists
    const [custRows] = await conn.query('SELECT customer_id FROM customer WHERE customer_id = ?', [customerId]);
    if (custRows.length === 0) { await conn.rollback(); return res.status(404).json({ error: 'Customer not found' }); }

    // Check room exists
    const [roomRows] = await conn.query('SELECT room_id FROM room WHERE room_id = ?', [roomId]);
    if (roomRows.length === 0) { await conn.rollback(); return res.status(404).json({ error: 'Room not found' }); }

    // Availability
    const available = await isRoomAvailable(roomId, checkinDate, checkoutDate);
    if (!available) { await conn.rollback(); return res.status(409).json({ error: 'Room not available for requested dates' }); }

    const [result] = await conn.query('INSERT INTO reservation (customer_id, room_id, checkin_date, checkout_date, status, total_amount) VALUES (?, ?, ?, ?, ?, ?)', [customerId, roomId, checkinDate, checkoutDate, 'BOOKED', totalAmount]);
    await conn.commit();
    res.status(201).json({ reservationId: result.insertId, status: 'BOOKED' });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    conn.release();
  }
});

// GET /api/reservations
router.get('/', async (req, res) => {
  try {
    const { customerId, roomId, status } = req.query;
    let sql = `SELECT reservation_id AS reservationId, customer_id AS customerId, room_id AS roomId, checkin_date AS checkinDate, checkout_date AS checkoutDate, status, total_amount AS totalAmount FROM reservation WHERE 1=1`;
    const params = [];
    if (customerId) { sql += ' AND customer_id = ?'; params.push(customerId); }
    if (roomId) { sql += ' AND room_id = ?'; params.push(roomId); }
    if (status) { sql += ' AND status = ?'; params.push(status); }
    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

// GET /api/reservations/:id
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT reservation_id AS reservationId, customer_id AS customerId, room_id AS roomId, checkin_date AS checkinDate, checkout_date AS checkoutDate, status, total_amount AS totalAmount FROM reservation WHERE reservation_id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/reservations/:id
router.put('/:id', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { customerId, roomId, checkinDate, checkoutDate, status, totalAmount } = req.body;
    if (!customerId || !roomId || !checkinDate || !checkoutDate || !status || totalAmount == null) return res.status(400).json({ error: 'Missing fields' });

    await conn.beginTransaction();
    const [result] = await conn.query('UPDATE reservation SET customer_id = ?, room_id = ?, checkin_date = ?, checkout_date = ?, status = ?, total_amount = ? WHERE reservation_id = ?', [customerId, roomId, checkinDate, checkoutDate, status, totalAmount, req.params.id]);
    if (result.affectedRows === 0) { await conn.rollback(); return res.status(404).json({ error: 'Not found' }); }
    
    await conn.commit();
    res.json({ message: 'Reservation updated' });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    conn.release();
  }
});

// DELETE /api/reservations/:id
router.delete('/:id', async (req, res) => {
  try {
    const [result] = await pool.query('DELETE FROM reservation WHERE reservation_id = ?', [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Not found' });
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});
