import express from 'express';
import cors from 'cors';
import pool from './db.js';
import { authRoutes } from './routes/auth.js'; // Import auth routes
import { authenticateToken, authorizeRole } from './middleware/auth.js'; // Import middleware
import { suggestPrice } from './forecast.js';
import { get as cacheGet, set as cacheSet } from './cache.js';
import { startPrecompute } from './pricePrecompute.js';

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
        const cacheKey = `availability:${check_in}:${check_out}`;
        const cached = await cacheGet(cacheKey);
        if (cached) return res.json(cached);

        const query = `
            SELECT r.RoomID, r.RoomNumber, rt.TypeName AS room_type, rt.BasePricePerNight AS rate, r.Status
            FROM Rooms r
            JOIN RoomTypes rt ON r.RoomTypeID = rt.RoomTypeID
            WHERE r.RoomID NOT IN (
                    SELECT b.RoomID FROM Bookings b
                    WHERE b.Status != 'Cancelled' AND (
                            (b.CheckInDate <= ? AND b.CheckOutDate > ?) OR
                            (b.CheckInDate < ? AND b.CheckOutDate >= ?) OR
                            (b.CheckInDate >= ? AND b.CheckOutDate <= ?)
                    )
            ) AND r.Status = 'Available';
        `;
        const [rows] = await pool.query(query, [check_in, check_in, check_out, check_out, check_in, check_out]);
        // cache for short time (60s)
        await cacheSet(cacheKey, rows, 60);
        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Database query failed' });
    }
});

// POST: Create a new booking (for the logged-in user)
app.post('/api/bookings', authenticateToken, async (req, res) => {
    const { room_id, check_in_date, check_out_date, total_amount, num_guests } = req.body;
    const user_id = req.user.id; // Get user ID from the authenticated token

    if (!user_id || !room_id || !check_in_date || !check_out_date) {
        return res.status(400).json({ error: 'Missing required booking information' });
    }

    try {
        // Find associated GuestID for this user (users.GuestID)
        const [uRows] = await pool.query('SELECT GuestID FROM users WHERE user_id = ?', [user_id]);
        if (uRows.length === 0 || !uRows[0].GuestID) {
            return res.status(400).json({ error: 'No linked guest profile found for this user' });
        }
        const primaryGuestId = uRows[0].GuestID;

        const insertQuery = `
            INSERT INTO Bookings (PrimaryGuestID, UserID, RoomID, CheckInDate, CheckOutDate, NumGuests, TotalAmount, Status)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'Confirmed')
        `;
        const [result] = await pool.query(insertQuery, [primaryGuestId, user_id, room_id, check_in_date, check_out_date, num_guests || 1, total_amount]);

        // Update room status
        await pool.query("UPDATE Rooms SET Status = 'Occupied' WHERE RoomID = ?", [room_id]);

        res.status(201).json({ message: 'Booking created!', booking_id: result.insertId });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Database insert failed' });
    }
});


// GET: Get all bookings for the currently logged-in user
app.get('/api/bookings/mybookings', authenticateToken, async (req, res) => {
        const user_id = req.user.id; // Get user ID from the token

        try {
                const query = `
                        SELECT
                                b.BookingID AS booking_id,
                                b.CheckInDate AS check_in_date,
                                b.CheckOutDate AS check_out_date,
                                b.TotalAmount AS total_amount,
                                b.Status AS status,
                                r.RoomNumber AS room_number,
                                rt.TypeName AS room_type,
                                rt.BasePricePerNight AS rate
                        FROM Bookings b
                        JOIN Rooms r ON b.RoomID = r.RoomID
                        JOIN RoomTypes rt ON r.RoomTypeID = rt.RoomTypeID
                        WHERE b.UserID = ?
                        ORDER BY b.CheckInDate DESC;
                `;
                const [rows] = await pool.query(query, [user_id]);
                res.json(rows);
        } catch (error) {
                console.error('Database query failed:', error);
                res.status(500).json({ error: 'Failed to fetch your bookings' });
        }
});


// --- ADMIN-ONLY ROUTES ---
// All routes below require both a valid token AND an 'admin' role

// NEW: GET Dashboard Stats
app.get('/api/dashboard/stats', authenticateToken, authorizeRole('admin'), async (req, res) => {
    try {
        // Run all count queries in parallel (use normalized table names)
        const [occupiedRooms] = await pool.query("SELECT COUNT(*) as count FROM Rooms WHERE Status = 'Occupied'");
        const [availableRooms] = await pool.query("SELECT COUNT(*) as count FROM Rooms WHERE Status = 'Available'");
        const [checkInsToday] = await pool.query("SELECT COUNT(*) as count FROM Bookings WHERE CheckInDate = CURDATE() AND Status != 'Cancelled'");
        const [totalGuests] = await pool.query("SELECT COUNT(*) as count FROM users WHERE role = 'guest'");

        res.json({
            occupiedRooms: occupiedRooms[0].count,
            availableRooms: availableRooms[0].count,
            checkInsToday: checkInsToday[0].count,
            totalGuests: totalGuests[0].count,
        });

    } catch (error) {
        console.error('Dashboard Stats Error:', error);
        res.status(500).json({ error: 'Failed to fetch dashboard statistics' });
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

        // 2. Get the booking details (normalized names)
        const [rows] = await connection.query('SELECT UserID, RoomID, Status FROM Bookings WHERE BookingID = ?', [id]);

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
    await connection.query('DELETE FROM Bookings WHERE BookingID = ?', [id]);

    // 4. If the booking was active, set the room back to 'Available'
    if (status === 'Confirmed' || status === 'Checked-In') {
        await connection.query("UPDATE Rooms SET Status = 'Available' WHERE RoomID = ?", [room_id]);
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
                b.BookingID AS booking_id,
                b.CheckInDate AS check_in_date,
                b.CheckOutDate AS check_out_date,
                b.TotalAmount AS total_amount,
                b.Status AS status,
                g.FirstName AS first_name,
                g.LastName AS last_name,
                u.email,
                r.RoomNumber AS room_number,
                rt.TypeName AS room_type
            FROM Bookings b
            JOIN users u ON b.UserID = u.user_id
            LEFT JOIN Guests g ON u.guest_id = g.GuestID
            JOIN Rooms r ON b.RoomID = r.RoomID
            JOIN RoomTypes rt ON r.RoomTypeID = rt.RoomTypeID
            ORDER BY b.CheckInDate DESC;
        `;
        const [rows] = await pool.query(query);
        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Database query failed' });
    }
});

// PUT: Update a booking's status (Check-in/Check-out)
app.put('/api/bookings/:id/status', authenticateToken, authorizeRole('admin'), async (req, res) => {
    const { id } = req.params;
    const { status: newStatus } = req.body;

    // Validate the new status
    if (!newStatus || !['Checked-In', 'Checked-Out'].includes(newStatus)) {
        return res.status(400).json({ error: 'Invalid or missing status. Must be "Checked-In" or "Checked-Out".' });
    }

    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        // 1. Get current booking status and room ID (normalized names)
        const [rows] = await connection.query('SELECT Status as status, RoomID as room_id FROM Bookings WHERE BookingID = ?', [id]);
        if (rows.length === 0) {
            await connection.rollback();
            return res.status(404).json({ error: 'Booking not found' });
        }
        const currentStatus = rows[0].status;
        const roomId = rows[0].room_id;

        // 2. Perform validation based on current status
        if (newStatus === 'Checked-In' && currentStatus !== 'Confirmed') {
            await connection.rollback();
            return res.status(400).json({ error: `Cannot check-in a booking with status: ${currentStatus}` });
        }
        if (newStatus === 'Checked-Out' && currentStatus !== 'Checked-In') {
             await connection.rollback();
             // Allow checkout from Confirmed (No-show scenario, but room needs freeing)
             // Or allow checkout from Checked-Out (idempotent)
             if (currentStatus !== 'Confirmed' && currentStatus !== 'Checked-Out') {
                 return res.status(400).json({ error: `Cannot check-out a booking with status: ${currentStatus}` });
             }
        }
        
        // 3. Update booking status
        await connection.query('UPDATE Bookings SET Status = ? WHERE BookingID = ?', [newStatus, id]);

        // 4. Update room status based on the action
        let roomStatusUpdate = null;
        if (newStatus === 'Checked-In') {
            roomStatusUpdate = 'Occupied'; // Should already be Occupied, but enforce it
        } else if (newStatus === 'Checked-Out') {
             // For simplicity, we set it back to Available.
             // A real system might set it to 'Needs Cleaning'.
            roomStatusUpdate = 'Available'; 
        }

        if (roomStatusUpdate) {
            await connection.query('UPDATE Rooms SET Status = ? WHERE RoomID = ?', [roomStatusUpdate, roomId]);
        }

        // 5. Commit
        await connection.commit();
        res.json({ message: `Booking status updated to ${newStatus}` });

    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Booking status update error:', error);
        res.status(500).json({ error: 'Database transaction failed' });
    } finally {
        if (connection) connection.release();
    }
});

// GET: Get all users (replaces old 'guests' route)
app.get('/api/users', authenticateToken, authorizeRole('admin'), async (req, res) => {
    try {
        const query = `
            SELECT u.user_id, g.FirstName AS first_name, g.LastName AS last_name, u.email, g.Phone AS phone, u.role
            FROM users u
            LEFT JOIN Guests g ON u.guest_id = g.GuestID
        `;
        const [rows] = await pool.query(query);
        res.json(rows);
    } catch (error) {
        console.error('Users query failed:', error);
        res.status(500).json({ error: 'Database query failed' });
    }
});


// ... after app.get('/api/users', ... )

// PUT: Update a user's role
app.put('/api/users/:id/role', authenticateToken, authorizeRole('admin'), async (req, res) => {
    const { id } = req.params;
    const { role } = req.body;

    // Safety check: Ensure role is valid
    if (!role || !['admin', 'guest'].includes(role)) {
        return res.status(400).json({ error: 'Invalid role specified' });
    }

    // Safety check: Prevent admin from changing their own role
    if (req.user.id.toString() === id.toString()) {
        return res.status(403).json({ error: 'Cannot change your own role' });
    }

    try {
        const [result] = await pool.query('UPDATE users SET role = ? WHERE user_id = ?', [role, id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json({ message: 'User role updated successfully' });
    } catch (error) {
        console.error('Role update error:', error);
        res.status(500).json({ error: 'Database update failed' });
    }
});

// DELETE: Delete a user
app.delete('/api/users/:id', authenticateToken, authorizeRole('admin'), async (req, res) => {
    const { id } = req.params;

    // Safety check: Prevent admin from deleting themselves
    if (req.user.id.toString() === id.toString()) {
        return res.status(403).json({ error: 'Cannot delete your own account' });
    }

    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

    // 1. Delete all bookings associated with the user
    // We must do this first to avoid foreign key constraint errors
    await connection.query('DELETE FROM Bookings WHERE UserID = ?', [id]);

    // 2. Delete the user
    const [result] = await connection.query('DELETE FROM users WHERE user_id = ?', [id]);
        
        if (result.affectedRows === 0) {
            await connection.rollback();
            return res.status(404).json({ error: 'User not found' });
        }

        // 3. Commit the transaction
        await connection.commit();
        res.json({ message: 'User and all associated bookings have been deleted' });

    } catch (error) {
        if (connection) await connection.rollback();
        console.error('User deletion error:', error);
        res.status(500).json({ error: 'Database transaction failed' });
    } finally {
        if (connection) connection.release();
    }
});


// ... before app.get('/api/rooms', ... )

// GET: Get ALL rooms (not just available)
app.get('/api/rooms', authenticateToken, authorizeRole('admin'), async (req, res) => {
    try {
        const query = `
            SELECT r.RoomID as room_id, r.RoomNumber as room_number, rt.TypeName as room_type, rt.BasePricePerNight as rate, r.Status as status
            FROM Rooms r
            JOIN RoomTypes rt ON r.RoomTypeID = rt.RoomTypeID
            ORDER BY r.RoomNumber
        `;
        const [rows] = await pool.query(query);
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
        const query = 'UPDATE Rooms SET Status = ? WHERE RoomID = ?';
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
// Start scheduled precompute (non-blocking)
try {
    startPrecompute();
} catch (err) {
    console.error('Failed to start precompute:', err);
}

// Forecasting endpoint: suggest price for a room type over a date range
// Example: GET /api/forecast/price?roomTypeID=2&from=2024-12-01&to=2024-12-31
app.get('/api/forecast/price', authenticateToken, authorizeRole('admin'), async (req, res) => {
    const roomTypeID = parseInt(req.query.roomTypeID || req.query.roomTypeId || req.query.roomType, 10);
    const from = req.query.from;
    const to = req.query.to;

    if (!roomTypeID || !from || !to) {
        return res.status(400).json({ error: 'Missing roomTypeID, from or to query parameters' });
    }

    try {
        // If the request is for a single day (to = next day), prefer cached precomputed daily suggestion
        const [daysRow] = await pool.query('SELECT GREATEST(DATEDIFF(?, ?), 0) as days', [to, from]);
        const days = daysRow && daysRow[0] ? Number(daysRow[0].days) : null;

        if (days === 1) {
            const cacheKey = `price_suggestion:${roomTypeID}:${from}`;
            const cached = await cacheGet(cacheKey);
            if (cached) return res.json(cached);
        }

        // fallback: compute on demand and cache a short-lived entry
        const result = await suggestPrice(pool, roomTypeID, from, to);
        const cacheKeyRange = `forecast:${roomTypeID}:${from}:${to}`;
        await cacheSet(cacheKeyRange, result, 300); // cache 5 minutes
        res.json(result);
    } catch (err) {
        console.error('Forecast error:', err);
        res.status(500).json({ error: 'Failed to compute forecast' });
    }
});