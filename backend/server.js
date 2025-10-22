import express from 'express';
import cors from 'cors';
import pool from './db.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// === API ROUTES ===

// GET: Find available rooms
app.get('/api/rooms/available', async (req, res) => {
  const { check_in, check_out } = req.query;

  if (!check_in || !check_out) {
    return res.status(400).json({ error: 'Missing check_in or check_out dates' });
  }

  try {
    const query = `
      SELECT * FROM rooms
      WHERE room_id NOT IN (
          SELECT room_id FROM bookings
          WHERE status != 'Cancelled' AND (
              (check_in_date <= ? AND check_out_date > ?) OR
              (check_in_date < ? AND check_out_date >= ?) OR
              (check_in_date >= ? AND check_out_date <= ?)
          )
      ) AND status = 'Available';
    `;
    const [rows] = await pool.query(query, [check_in, check_in, check_out, check_out, check_in, check_out]);
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Database query failed' });
  }
});

// GET: Get all guests
app.get('/api/guests', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM guests');
        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Database query failed' });
    }
});

// POST: Create a new booking
app.post('/api/bookings', async (req, res) => {
  const { guest_id, room_id, check_in_date, check_out_date, total_amount } = req.body;

  if (!guest_id || !room_id || !check_in_date || !check_out_date) {
    return res.status(400).json({ error: 'Missing required booking information' });
  }

  try {
    const query = `
      INSERT INTO bookings (guest_id, room_id, check_in_date, check_out_date, total_amount, status)
      VALUES (?, ?, ?, ?, ?, 'Confirmed')
    `;
    const [result] = await pool.query(query, [guest_id, room_id, check_in_date, check_out_date, total_amount]);
    
    // Update room status
    await pool.query("UPDATE rooms SET status = 'Occupied' WHERE room_id = ?", [room_id]);
    
    res.status(201).json({ message: 'Booking created!', booking_id: result.insertId });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Database insert failed' });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});