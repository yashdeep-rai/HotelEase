import express from 'express';
import cors from 'cors';
import pool from './db.js';
import { authRoutes } from './routes/auth.js'; // Import auth routes
import { authenticateToken, authorizeRole } from './middleware/auth.js'; // Import middleware

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// === PUBLIC AUTH ROUTES ===
// Handles /api/auth/register and /api/auth/login
app.use('/api/auth', authRoutes);

// === PROTECTED ROUTES ===
// All routes below this require a valid token

// --- Guest & Admin Routes ---

// GET: Find available rooms
app.get('/api/rooms/available', authenticateToken, async (req, res) => {
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

// POST: Create a new booking (for the logged-in user)
app.post('/api/bookings', authenticateToken, async (req, res) => {
  const { room_id, check_in_date, check_out_date, total_amount } = req.body;
  const user_id = req.user.id; // Get user ID from the authenticated token

  if (!user_id || !room_id || !check_in_date || !check_out_date) {
    return res.status(400).json({ error: 'Missing required booking information' });
  }

  try {
    const query = `
      INSERT INTO bookings (user_id, room_id, check_in_date, check_out_date, total_amount, status)
      VALUES (?, ?, ?, ?, ?, 'Confirmed')
    `;
    const [result] = await pool.query(query, [user_id, room_id, check_in_date, check_out_date, total_amount]);
    
    // Update room status
    await pool.query("UPDATE rooms SET status = 'Occupied' WHERE room_id = ?", [room_id]);
    
    res.status(201).json({ message: 'Booking created!', booking_id: result.insertId });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Database insert failed' });
  }
});

// DELETE: Cancel/Delete a booking
// (This route is accessible to all authenticated users,
// but you could add logic to check if req.user.id === booking.user_id)
app.delete('/api/bookings/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  let connection; // Define connection outside the try block

  try {
    // 1. Get connection
    connection = await pool.getConnection();
    await connection.beginTransaction();

    // 2. Get the booking details
    const [rows] = await connection.query('SELECT user_id, room_id, status FROM bookings WHERE booking_id = ?', [id]);
    
    if (rows.length === 0) {
      await connection.rollback();
      connection.release(); 
      return res.status(404).json({ error: 'Booking not found' });
    }

    const { room_id, status } = rows[0];

    // Optional: Check if user is admin OR the owner of the booking
    // if (req.user.role !== 'admin' && req.user.id !== rows[0].user_id) {
    //   await connection.rollback();
    //   connection.release();
    //   return res.status(403).json({ error: 'Access denied: You do not own this booking' });
    // }

    // 3. Delete the booking
    await connection.query('DELETE FROM bookings WHERE booking_id = ?', [id]);

    // 4. If the booking was active, set the room back to 'Available'
    if (status === 'Confirmed' || status === 'Checked-In') {
        await connection.query("UPDATE rooms SET status = 'Available' WHERE room_id = ?", [room_id]);
    }

    // 5. If all queries succeeded, commit the changes
    await connection.commit();
    res.json({ message: 'Booking cancelled successfully' });

  } catch (error) {
    // 6. If ANYTHING fails, roll back and send a JSON error
    if (connection) await connection.rollback(); 
    console.error(error);
    res.status(500).json({ error: 'Database transaction failed' });
  
  } finally {
    // 7. ALWAYS release the connection
    if (connection) connection.release(); 
  }
});


// --- ADMIN-ONLY ROUTES ---
// All routes below require both a valid token AND an 'admin' role

// GET: Get all bookings with details
app.get('/api/bookings', authenticateToken, authorizeRole('admin'), async (req, res) => {
  try {
    const query = `
      SELECT
        b.booking_id,
        b.check_in_date,
        b.check_out_date,
        b.total_amount,
        b.status,
        u.first_name,
        u.last_name,
        u.email,
        r.room_number,
        r.room_type
      FROM bookings b
      JOIN users u ON b.user_id = u.user_id
      JOIN rooms r ON b.room_id = r.room_id
      ORDER BY b.check_in_date DESC;
    `;
    const [rows] = await pool.query(query);
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Database query failed' });
  }
});

// GET: Get all users (replaces old 'guests' route)
app.get('/api/users', authenticateToken, authorizeRole('admin'), async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT user_id, first_name, last_name, email, phone, role FROM users');
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: 'Database query failed' });
    }
});

// GET: Get ALL rooms (not just available)
app.get('/api/rooms', authenticateToken, authorizeRole('admin'), async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM rooms ORDER BY room_number');
        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Database query failed' });
    }
});

// PUT: Update a room's status
app.put('/api/rooms/:id/status', authenticateToken, authorizeRole('admin'), async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    if (!status || !['Available', 'Occupied', 'Maintenance'].includes(status)) {
        return res.status(400).json({ error: 'Invalid or missing status' });
    }

    try {
        const query = 'UPDATE rooms SET status = ? WHERE room_id = ?';
        const [result] = await pool.query(query, [status, id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Room not found' });
        }

        res.json({ message: 'Room status updated successfully' });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Database update failed' });
    }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});