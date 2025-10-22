const express = require('express');
const pool = require('../db');

const router = express.Router();

// GET /api/rooms - list rooms with optional filters
router.get('/', async (req, res) => {
  try {
    const { status, type, minPrice, maxPrice } = req.query;
    let sql = 'SELECT room_id AS roomId, room_number AS roomNumber, room_type AS roomType, price, status, description FROM room WHERE 1=1';
    const params = [];
    if (status) { sql += ' AND status = ?'; params.push(status); }
    if (type) { sql += ' AND room_type = ?'; params.push(type); }
    if (minPrice) { sql += ' AND price >= ?'; params.push(minPrice); }
    if (maxPrice) { sql += ' AND price <= ?'; params.push(maxPrice); }
    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/rooms/:id
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT room_id AS roomId, room_number AS roomNumber, room_type AS roomType, price, status, description FROM room WHERE room_id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/rooms
router.post('/', async (req, res) => {
  try {
    const { roomNumber, roomType, price, status, description } = req.body;
    if (!roomNumber || !roomType || price == null) return res.status(400).json({ error: 'Missing required fields' });
    const [result] = await pool.query('INSERT INTO room (room_number, room_type, price, status, description) VALUES (?, ?, ?, ?, ?)', [roomNumber, roomType, price, status || 'AVAILABLE', description || null]);
    res.status(201).json({ roomId: result.insertId });
  } catch (err) {
    console.error(err);
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Room number already exists' });
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

// PUT /api/rooms/:id
router.put('/:id', async (req, res) => {
  try {
    const { roomNumber, roomType, price, status, description } = req.body;
    if (!roomNumber || !roomType || price == null) return res.status(400).json({ error: 'Missing required fields' });
    const [result] = await pool.query('UPDATE room SET room_number = ?, room_type = ?, price = ?, status = ?, description = ? WHERE room_id = ?', [roomNumber, roomType, price, status || 'AVAILABLE', description || null, req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Room updated' });
  } catch (err) {
    console.error(err);
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Room number already exists' });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/rooms/:id
router.delete('/:id', async (req, res) => {
  try {
    const [result] = await pool.query('DELETE FROM room WHERE room_id = ?', [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Not found' });
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});
