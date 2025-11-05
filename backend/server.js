import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
// Load .env variables as early as possible so other imports can use them.
// Use an explicit path (the backend folder) so running npm from a different CWD still loads the correct .env.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, '.env');
dotenv.config({ path: envPath });
//console.log(`dotenv loaded from: ${envPath}`);

import express from 'express';
import cors from 'cors';
import pool from './db.js';
import { authRoutes } from './routes/auth.js'; // Import auth routes
import { authenticateToken, authorizeRole } from './middleware/auth.js'; // Import middleware

import { get as cacheGet, set as cacheSet, del as cacheDel } from './cache.js';
import { startPrecompute, suggestPrice } from './pricePrecompute.js';


const app = express();
const PORT = process.env.PORT || 3001;

// Minimal checks for required env vars
if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
    console.error('FATAL: JWT_SECRET is required in production. Exiting.');
    process.exit(1);
}

// Middleware
app.use(cors());
app.use(express.json());

// === PUBLIC AUTH ROUTES ===
// Handles /api/auth/register and /api/auth/login
app.use('/api/auth', authRoutes);

// === PROTECTED ROUTES ===
// All routes below this require a valid token

// Ensure AppSettings table exists and provide helpers
async function ensureSettingsTable() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS AppSettings (
                s_key VARCHAR(100) PRIMARY KEY,
                s_value TEXT
            ) ENGINE=InnoDB;
        `);
        // Seed defaults if missing
        const [rows] = await pool.query(`SELECT s_key FROM AppSettings WHERE s_key IN ('dynamic_pricing_enabled','dynamic_pricing_multiplier')`);
        const keys = rows.map(r=>r.s_key);
        if (!keys.includes('dynamic_pricing_enabled')) {
            await pool.query(`INSERT INTO AppSettings (s_key, s_value) VALUES ('dynamic_pricing_enabled', '1') ON DUPLICATE KEY UPDATE s_value = s_value`);
        }
        if (!keys.includes('dynamic_pricing_multiplier')) {
            await pool.query(`INSERT INTO AppSettings (s_key, s_value) VALUES ('dynamic_pricing_multiplier', '1.0') ON DUPLICATE KEY UPDATE s_value = s_value`);
        }
    } catch (e) {
        console.warn('Failed to ensure AppSettings table:', e.message || e);
    }
}
ensureSettingsTable().catch(() => {});

async function getSetting(key, defaultVal = null) {
    try {
        const [rows] = await pool.query('SELECT s_value FROM AppSettings WHERE s_key = ?', [key]);
        if (rows.length === 0) return defaultVal;
        return rows[0].s_value;
    } catch (e) {
        console.warn('getSetting error', key, e.message || e);
        return defaultVal;
    }
}

async function setSetting(key, value) {
    try {
        await pool.query('INSERT INTO AppSettings (s_key, s_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE s_value = VALUES(s_value)', [key, String(value)]);
        return true;
    } catch (e) {
        console.warn('setSetting error', key, e.message || e);
        return false;
    }
}

// --- Guest & Admin Routes ---

let availableRoomRequestCount = 0;
let usersWhoRequested = new Set();  // stores unique users in current interval
let requestTimestamps = [];         // timestamps of availability requests
// Per-room-type request timestamps (map roomTypeID -> Array of timestamps)
const roomTypeRequests = {};

// Last pricing update times
const lastPricingUpdate = {
    global: null,
    perRoomType: {} // roomTypeID -> timestamp
};

// Configurable dynamic-pricing tuning (seconds & threshold)
const PRICING_WINDOW_SECONDS = process.env.PRICING_WINDOW_SECONDS ? parseInt(process.env.PRICING_WINDOW_SECONDS, 10) : 60; // default 60s
const PRICING_TRIGGER_THRESHOLD = process.env.PRICING_TRIGGER_THRESHOLD ? parseInt(process.env.PRICING_TRIGGER_THRESHOLD, 10) : 2; // default 2 requests

// ---------- Helper: clean old timestamps ----------
function cleanOldRequests(intervalMs) {
    const cutoff = Date.now() - intervalMs;
    requestTimestamps = requestTimestamps.filter(ts => ts >= cutoff);
}

function cleanOldRoomTypeRequests(intervalMs) {
    const cutoff = Date.now() - intervalMs;
    for (const rt in roomTypeRequests) {
        if (!Array.isArray(roomTypeRequests[rt])) continue;
        roomTypeRequests[rt] = roomTypeRequests[rt].filter(ts => ts >= cutoff);
        if (roomTypeRequests[rt].length === 0) delete roomTypeRequests[rt];
    }
}

// Compute and apply pricing update for a single room type (JS-side calculation)
async function computeAndApplyRoomTypePricing(roomTypeId, windowSeconds = PRICING_WINDOW_SECONDS, threshold = PRICING_TRIGGER_THRESHOLD) {
    try {
        // Clean recent entries then compute
        cleanOldRoomTypeRequests(windowSeconds * 1000);
        const recent = (roomTypeRequests[roomTypeId] || []).length;

        // Count available rooms for this room type (and not under maintenance)
        const [availRows] = await pool.query(`
            SELECT COUNT(*) AS count FROM Rooms r
            WHERE r.RoomTypeID = ? AND r.Status = 'Available'
              AND r.RoomID NOT IN (
                SELECT rm.RoomID FROM RoomMaintenance rm
                WHERE (rm.StartDate <= CURDATE() AND rm.EndDate >= CURDATE())
              )
        `, [roomTypeId]);
        const availableRooms = (availRows && availRows[0] && availRows[0].count) ? availRows[0].count : 0;

        const multiplier = calculateSurgeMultiplier(recent, availableRooms);

        // Night-time boost (reuse logic from stored proc)
        const currentHour = new Date().getHours();
        let finalMultiplier = multiplier;
        if (currentHour >= 21 || currentHour < 4) finalMultiplier = +(finalMultiplier * 1.15).toFixed(2);

        if (recent >= threshold) {
            // Apply computed multiplier to this room type
            await pool.query(`UPDATE RoomTypes SET CurrentPricePerNight = ROUND(BasePricePerNight * ?, 2) WHERE RoomTypeID = ?`, [finalMultiplier, roomTypeId]);
            lastPricingUpdate.perRoomType[roomTypeId] = Date.now();
            //console.log(`Applied pricing for roomType ${roomTypeId} multiplier=${finalMultiplier} (recent=${recent}, available=${availableRooms})`);
            // Invalidate today's cached suggestion for this room type so forecast reflects the new price
            try {
                const todayKey = `price_suggestion:${roomTypeId}:${new Date().toISOString().slice(0,10)}`;
                await cacheDel(todayKey);
            } catch (e) {
                console.warn('Failed to delete cache for roomType', roomTypeId, e.message || e);
            }
        } else {
            // Reset to base price when low demand
            await pool.query(`UPDATE RoomTypes SET CurrentPricePerNight = BasePricePerNight WHERE RoomTypeID = ?`, [roomTypeId]);
            lastPricingUpdate.perRoomType[roomTypeId] = Date.now();
            //console.log(`Reset pricing for roomType ${roomTypeId} to base (recent=${recent})`);
            // Invalidate today's cached suggestion so forecast recomputes the base value
            try {
                const todayKey = `price_suggestion:${roomTypeId}:${new Date().toISOString().slice(0,10)}`;
                await cacheDel(todayKey);
            } catch (e) {
                console.warn('Failed to delete cache for roomType', roomTypeId, e.message || e);
            }
        }
    } catch (err) {
        console.warn('computeAndApplyRoomTypePricing failed for', roomTypeId, err.message || err);
    }
}

// ---------- Helper: surge calculation ----------
function calculateSurgeMultiplier(requests, availableRooms) {
    if (availableRooms === 0) return 2.0; // max surge if none available
    // avoid dividing by zero and use availableRooms as provided
    if (!availableRooms || availableRooms <= 0) availableRooms = 1;
    const demandRatio = requests / availableRooms;

    if (demandRatio < 1) return 1.0;
    if (demandRatio < 2) return 1.1;
    if (demandRatio < 3) return 1.25;
    if (demandRatio < 5) return 1.5;
    return 2.0;
}

// ---------- Private Dynamic Pricing Function ----------
// ---------- Private Dynamic Pricing Function ----------
async function performDynamicPricing(pool, interval_seconds = 60) {
    try {
        const intervalMs = interval_seconds * 1000;

        cleanOldRequests(intervalMs);
        const recentRequests = requestTimestamps.length;

        // Determine simple available-rooms metric (rooms marked Available and not under maintenance today)
        const [availRows] = await pool.query(`
            SELECT COUNT(*) AS count FROM Rooms r
            WHERE r.Status = 'Available'
              AND r.RoomID NOT IN (
                SELECT rm.RoomID FROM RoomMaintenance rm
                WHERE (rm.StartDate <= CURDATE() AND rm.EndDate >= CURDATE())
              )
        `);
        const availableRooms = (availRows && availRows[0] && availRows[0].count) ? availRows[0].count : 0;

        // Call stored procedure to update prices based on demand and availability
        await pool.query('CALL UpdateDynamicRoomPrices(?, ?)', [recentRequests, availableRooms]);

        // Compute a local surge multiplier for quick reporting
        const surgeMultiplier = calculateSurgeMultiplier(recentRequests, availableRooms);

        // Also compute per-room-type pricing updates (periodic JS-based fallback)
        try {
            const [rtRows] = await pool.query('SELECT RoomTypeID FROM RoomTypes');
            const rtIds = rtRows.map(r => r.RoomTypeID);
            for (const rt of rtIds) {
                // fire-and-forget per-room-type compute (await to keep DB load controlled)
                await computeAndApplyRoomTypePricing(rt, interval_seconds, PRICING_TRIGGER_THRESHOLD);
            }
        } catch (e) {
            console.warn('Periodic per-room-type pricing update failed:', e.message || e);
        }

        // Reset for next window
        usersWhoRequested.clear();
        availableRoomRequestCount = 0;
        requestTimestamps = [];

        return { recentRequests, availableRooms, surgeMultiplier };
    } catch (err) {
        console.error('❌ Dynamic pricing update failed:', err);
    }
}


// ---------- API Route: Get Available Rooms ----------
app.get('/api/rooms/available', authenticateToken, async (req, res) => {
    const userId = req.user?.id;
    const { check_in, check_out } = req.query;

    if (!check_in || !check_out) {
        return res.status(400).json({ error: 'Missing check_in or check_out' });
    }

    try {
        // Log demand for dynamic pricing (optionally scoped to a room type)
        const { room_type_id } = req.query;
        const searchDate = check_in; // store the requested check-in as the search date
        if (userId) {
            await pool.query(
                `INSERT INTO DemandLog (RoomTypeID, SearchDate, SearchCount)
                 VALUES (?, ?, 1)
                 ON DUPLICATE KEY UPDATE SearchCount = SearchCount + 1, LastSearchedAt = CURRENT_TIMESTAMP`,
                [room_type_id || null, searchDate]
            );
        }

        const query = `
            SELECT r.RoomID AS room_id, r.RoomNumber AS room_number, r.RoomTypeID AS room_type_id,
                   rt.TypeName AS room_type, rt.CurrentPricePerNight AS rate, r.Status AS status
            FROM Rooms r
            JOIN RoomTypes rt ON r.RoomTypeID = rt.RoomTypeID
            WHERE r.Status = 'Available'
            AND r.RoomID NOT IN (
                -- Bookings that overlap with the requested period, considering cleaning buffer
                SELECT b.RoomID FROM Bookings b
                JOIN Rooms r_b ON b.RoomID = r_b.RoomID
                JOIN RoomTypes rt_b ON r_b.RoomTypeID = rt_b.RoomTypeID
                WHERE b.Status != 'Cancelled' AND (
                    (DATE_SUB(b.CheckInDate, INTERVAL rt_b.CleaningBufferMinutes MINUTE) < ? AND DATE_ADD(b.CheckOutDate, INTERVAL rt_b.CleaningBufferMinutes MINUTE) > ?)
                )
            )
            AND r.RoomID NOT IN (
                -- Rooms under maintenance during the requested period
                SELECT rm.RoomID FROM RoomMaintenance rm
                WHERE (rm.StartDate <= ? AND rm.EndDate >= ?)
            );
        `;

        // booking-overlap check uses: requested_check_out, requested_check_in
        // maintenance overlap uses: requested_check_out, requested_check_in
        const [rows] = await pool.query(query, [
            check_out, check_in, // for booking overlap condition
            check_out, check_in  // for maintenance overlap condition
        ]);

        // Record demand signals for dynamic pricing
        try {
            requestTimestamps.push(Date.now());
            if (userId) usersWhoRequested.add(userId);
            availableRoomRequestCount += (rows && rows.length) ? rows.length : 0;
        } catch (e) {
            console.warn('Failed to record demand signal', e);
        }

        // Also record per-room-type requests: prefer explicit query param, otherwise mark each returned room's type
        try {
            const now = Date.now();
            if (room_type_id) {
                roomTypeRequests[room_type_id] = roomTypeRequests[room_type_id] || [];
                roomTypeRequests[room_type_id].push(now);
            } else if (Array.isArray(rows)) {
                for (const r of rows) {
                    const rt = r.room_type_id || r.roomTypeID || r.RoomTypeID;
                    if (!rt) continue;
                    roomTypeRequests[rt] = roomTypeRequests[rt] || [];
                    roomTypeRequests[rt].push(now);
                }
            }
        } catch (e) {
            console.warn('Failed to record per-room-type demand signal', e);
        }

        // If there is a recent surge in availability searches, trigger an immediate pricing update
        try {
            // Consider the last 60 seconds as the recent window for surge detection
            cleanOldRequests(60 * 1000);
            const recentRequests = requestTimestamps.length;

            if (recentRequests >= 2) { // threshold: at least 2 recent searches
                // Compute available rooms metric (same as used by the periodic job)
                const [availRows] = await pool.query(`
                    SELECT COUNT(*) AS count FROM Rooms r
                    WHERE r.Status = 'Available'
                      AND r.RoomID NOT IN (
                        SELECT rm.RoomID FROM RoomMaintenance rm
                        WHERE (rm.StartDate <= CURDATE() AND rm.EndDate >= CURDATE())
                      )
                `);
                const availableRooms = (availRows && availRows[0] && availRows[0].count) ? availRows[0].count : 0;

                try {
                    await pool.query('CALL UpdateDynamicRoomPrices(?, ?)', [recentRequests, availableRooms]);
                    //console.log(`Immediate pricing update triggered | requests=${recentRequests} | available=${availableRooms}`);
                } catch (updErr) {
                    console.warn('Immediate pricing update failed:', updErr.message || updErr);
                }
                    // Invalidate cached suggestions for all room types for the search date so frontend sees updated prices
                    try {
                        const [rtRows] = await pool.query('SELECT RoomTypeID FROM RoomTypes');
                        const dateKey = searchDate || new Date().toISOString().slice(0,10);
                        for (const rtr of rtRows) {
                            const rtId = rtr.RoomTypeID;
                            const key = `price_suggestion:${rtId}:${dateKey}`;
                            try { await cacheDel(key); } catch (e) { /* ignore per-key errors */ }
                        }
                    } catch (cacheErr) {
                        console.warn('Failed to invalidate forecast cache after immediate pricing update', cacheErr.message || cacheErr);
                    }
                // Additionally, compute/apply per-room-type pricing updates for room types with recent signals
                try {
                    cleanOldRoomTypeRequests(PRICING_WINDOW_SECONDS * 1000);
                    const rts = Object.keys(roomTypeRequests);
                    for (const rt of rts) {
                        const recentForType = (roomTypeRequests[rt] || []).length;
                        if (recentForType >= PRICING_TRIGGER_THRESHOLD) {
                            // run JS-based per-room-type pricing
                            await computeAndApplyRoomTypePricing(rt, PRICING_WINDOW_SECONDS, PRICING_TRIGGER_THRESHOLD);
                            // clear after applying
                            delete roomTypeRequests[rt];
                        }
                    }
                } catch (typeErr) {
                    console.warn('Per-room-type pricing update error:', typeErr.message || typeErr);
                }
                // Reset request window to avoid repeatedly triggering on same burst
                usersWhoRequested.clear();
                availableRoomRequestCount = 0;
                requestTimestamps = [];
            }
        } catch (e) {
            console.warn('Error while checking for immediate pricing update', e);
        }

        res.json({ rooms: rows });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Database query failed' });
    }
});

// ---------- Automatic Dynamic Pricing Every 60s ----------
// API: Get suggested price for a room type on a given date (checks cache first)
app.get('/api/forecast/price', async (req, res) => {
    const { roomTypeID, from, to } = req.query;
    if (!roomTypeID || !from) return res.status(400).json({ error: 'Missing roomTypeID or from date' });
    const dateFrom = from;
    // default to next day if 'to' not provided
    const dateTo = to || new Date(new Date(dateFrom).getTime() + 10 * 1000).toISOString().slice(0, 10);

    const key = `price_suggestion:${roomTypeID}:${dateFrom}`;
    try {
        const cached = await cacheGet(key);
        if (cached) return res.json(cached);

        // compute suggestion on-demand and cache it for 24h
        const suggestion = await suggestPrice(pool, roomTypeID, dateFrom, dateTo);
        await cacheSet(key, suggestion, 86400);
        return res.json(suggestion);
    } catch (err) {
        console.error('Forecast endpoint error:', err);
        return res.status(500).json({ error: 'Failed to compute price suggestion' });
    }
});

// Run dynamic pricing periodically (non-overlapping)
setInterval(() => {
    performDynamicPricing(pool, 10)
        // .then(data => {
        //     if (data)
        //        //console.log(`✅ Pricing recalculated | Requests: ${data.recentRequests} | Available: ${data.availableRooms} | Surge: ${data.surgeMultiplier}`);
        // })
        // .catch(err => console.error('Dynamic pricing failed:', err));
}, 10000);





// POST: Create a new booking (for the logged-in user)
app.post('/api/bookings', authenticateToken, async (req, res) => {
    // Use authenticated user id to avoid trusting client-sent user_id
    const authenticatedUserId = req.user?.id;
    const { room_id, check_in_date, check_out_date, total_amount, num_guests } = req.body;

    // Basic presence checks with clearer errors
    if (!authenticatedUserId) {
        console.warn('Booking attempt without authenticated user. Headers:', req.headers && req.headers.authorization);
        return res.status(401).json({ error: 'Authentication required' });
    }
    const missing = [];
    if (!room_id) missing.push('room_id');
    if (!check_in_date) missing.push('check_in_date');
    if (!check_out_date) missing.push('check_out_date');
    if (missing.length > 0) {
        console.warn('Booking attempt missing fields:', missing, 'body:', req.body);
        return res.status(400).json({ error: 'Missing required booking information', missing });
    }

    let connection;
    try {
        //console.log('Booking attempt by user:', authenticatedUserId, 'body:', { room_id, check_in_date, check_out_date, total_amount, num_guests });
        // Start a transaction and lock the room row to avoid race conditions
        connection = await pool.getConnection();
        await connection.beginTransaction();

        // 1) Ensure user has a linked guest profile
        const [uRows] = await connection.query('SELECT guest_id FROM users WHERE user_id = ? FOR SHARE', [authenticatedUserId]);
        if (uRows.length === 0 || !uRows[0].guest_id) {
            await connection.rollback();
            connection.release();
            return res.status(400).json({ error: 'No linked guest profile found for this user' });
        }
        const primaryGuestId = uRows[0].guest_id;

        // 2) Lock the room row for update and verify availability
        const [roomRows] = await connection.query('SELECT RoomID, Status FROM Rooms WHERE RoomID = ? FOR UPDATE', [room_id]);
        if (roomRows.length === 0) {
            await connection.rollback();
            connection.release();
            return res.status(404).json({ error: 'Room not found' });
        }
        if (roomRows[0].Status !== 'Available') {
            await connection.rollback();
            connection.release();
            return res.status(409).json({ error: 'Room no longer available' });
        }

        // 3) Verify no overlapping bookings exist for the requested period (simple overlap check)
        const [overlapRows] = await connection.query(
            `SELECT COUNT(*) AS cnt FROM Bookings WHERE RoomID = ? AND Status != 'Cancelled' AND NOT (CheckOutDate <= ? OR CheckInDate >= ?)`,
            [room_id, check_in_date, check_out_date]
        );
        if (overlapRows[0].cnt > 0) {
            await connection.rollback();
            connection.release();
            return res.status(409).json({ error: 'Room already booked for the selected dates' });
        }

        // 4) Create booking
        const insertQuery = `
            INSERT INTO Bookings (PrimaryGuestID, UserID, RoomID, CheckInDate, CheckOutDate, NumGuests, TotalAmount, Status)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'Confirmed')
        `;
        const [result] = await connection.query(insertQuery, [primaryGuestId, authenticatedUserId, room_id, check_in_date, check_out_date, num_guests || 1, total_amount]);

        // 5) Update room status to Occupied
        await connection.query("UPDATE Rooms SET Status = 'Occupied' WHERE RoomID = ?", [room_id]);

        await connection.commit();
        connection.release();

        res.status(201).json({ message: 'Booking created!', booking_id: result.insertId });
    } catch (error) {
        if (connection) {
            try { await connection.rollback(); } catch (e) { /* ignore */ }
            connection && connection.release();
        }
        console.error('Booking transaction failed:', error);
        // If we recognize a constraint/conflict, return 409, otherwise 500
        const message = error && error.message ? error.message : 'Database insert failed';
        res.status(500).json({ error: message });
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
                                rt.CurrentPricePerNight AS rate
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
        const [rows] = await connection.query('SELECT UserID as user_id, RoomID as room_id, Status as status FROM Bookings WHERE BookingID = ?', [id]);

        if (rows.length === 0) {
            await connection.rollback();
            connection.release(); 
            return res.status(404).json({ error: 'Booking not found' });
        }

        const { room_id, status } = rows[0];

    // Optional: Check if user is admin OR the owner of the booking
    if (req.user.role !== 'admin' && req.user.id !== rows[0].user_id) {
      await connection.rollback();
      connection.release();
      return res.status(403).json({ error: 'Access denied: You do not own this booking' });
    }

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

// ADMIN: Pricing & Demand stats for observability
app.get('/api/admin/pricing-stats', authenticateToken, authorizeRole('admin'), async (req, res) => {
    try {
        // Clean recent windows first
        cleanOldRequests(PRICING_WINDOW_SECONDS * 1000);
        cleanOldRoomTypeRequests(PRICING_WINDOW_SECONDS * 1000);

        const perType = {};
        for (const rt of Object.keys(roomTypeRequests)) {
            perType[rt] = {
                recentRequests: roomTypeRequests[rt].length,
                lastUpdated: lastPricingUpdate.perRoomType[rt] || null
            };
        }

        res.json({
            pricingWindowSeconds: PRICING_WINDOW_SECONDS,
            pricingTriggerThreshold: PRICING_TRIGGER_THRESHOLD,
            recentGlobalRequests: requestTimestamps.length,
            availableRoomRequestCount,
            uniqueRequestingUsers: usersWhoRequested.size,
            perRoomType: perType,
            lastPricingUpdate
        });
    } catch (err) {
        console.error('Pricing stats error:', err);
        res.status(500).json({ error: 'Failed to fetch pricing stats' });
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

    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        // set session var for triggers
        await connection.query('SET @current_admin_user_id = ?', [req.user.id]);

        const [result] = await connection.query('UPDATE users SET role = ? WHERE user_id = ?', [role, id]);
        if (result.affectedRows === 0) {
            await connection.rollback();
            return res.status(404).json({ error: 'User not found' });
        }

        await connection.commit();
        res.json({ message: 'User role updated successfully' });
    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Role update error:', error);
        res.status(500).json({ error: 'Database update failed' });
    } finally {
        if (connection) connection.release();
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

        // set session var for triggers
        await connection.query('SET @current_admin_user_id = ?', [req.user.id]);

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
            SELECT r.RoomID as room_id, r.RoomNumber as room_number, rt.TypeName as room_type, rt.RoomTypeID as room_type_id, rt.CurrentPricePerNight as rate, r.Status as status
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

// POST: Add a new room
app.post('/api/admin/rooms', authenticateToken, authorizeRole('admin'), async (req, res) => {
    const { room_number, room_type_id } = req.body;

    if (!room_number || !room_type_id) {
        return res.status(400).json({ error: 'Missing room_number or room_type_id' });
    }

    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        // Set session variable for triggers
        await connection.query('SET @current_admin_user_id = ?', [req.user.id]);

                const query = "INSERT INTO Rooms (RoomNumber, RoomTypeID, Status) VALUES (?, ?, 'Available')";
        await connection.query(query, [room_number, room_type_id]);

        await connection.commit();
        res.status(201).json({ message: 'Room added successfully' });

    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Error adding room:', error);
        res.status(500).json({ error: 'Database insert failed' });
    } finally {
        if (connection) connection.release();
    }
});

// DELETE: Delete all rooms on a specific floor
app.delete('/api/admin/rooms/floor/:floor', authenticateToken, authorizeRole('admin'), async (req, res) => {
    const { floor } = req.params;

    if (!floor) {
        return res.status(400).json({ error: 'Missing floor number' });
    }

    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        // Set session variable for triggers
        await connection.query('SET @current_admin_user_id = ?', [req.user.id]);

        const query = 'DELETE FROM Rooms WHERE LEFT(RoomNumber, 1) = ?';
        const [result] = await connection.query(query, [floor]);

        await connection.commit();
        res.json({ message: `${result.affectedRows} rooms deleted from floor ${floor}` });

    } catch (error) {
        if (connection) await connection.rollback();
        console.error(`Error deleting floor ${floor}:`, error);
        res.status(500).json({ error: 'Database delete failed' });
    } finally {
        if (connection) connection.release();
    }
});

// DELETE: Delete a specific room
app.delete('/api/admin/rooms/:id', authenticateToken, authorizeRole('admin'), async (req, res) => {
    const { id } = req.params;

    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        // Set session variable for triggers
        await connection.query('SET @current_admin_user_id = ?', [req.user.id]);

        const query = 'DELETE FROM Rooms WHERE RoomID = ?';
        const [result] = await connection.query(query, [id]);

        if (result.affectedRows === 0) {
            await connection.rollback();
            return res.status(404).json({ error: 'Room not found' });
        }

        await connection.commit();
        res.json({ message: 'Room deleted successfully' });

    } catch (error) {
        if (connection) await connection.rollback();
        console.error(`Error deleting room ${id}:`, error);
        res.status(500).json({ error: 'Database delete failed' });
    } finally {
        if (connection) connection.release();
    }
});

// PUT: Update a room's status
app.put('/api/rooms/:id/status', authenticateToken, authorizeRole('admin'), async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    if (!status || !['Available', 'Occupied', 'Maintenance'].includes(status)) {
        return res.status(400).json({ error: 'Invalid or missing status' });
    }

    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        // set session var for triggers
        await connection.query('SET @current_admin_user_id = ?', [req.user.id]);

        const query = 'UPDATE Rooms SET Status = ? WHERE RoomID = ?';
        const [result] = await connection.query(query, [status, id]);

        if (result.affectedRows === 0) {
            await connection.rollback();
            return res.status(404).json({ error: 'Room not found' });
        }

        await connection.commit();
        res.json({ message: 'Room status updated successfully' });

    } catch (error) {
        if (connection) await connection.rollback();
        console.error(error);
        res.status(500).json({ error: 'Database update failed' });
    } finally {
        if (connection) connection.release();
    }
});

// --- ADMIN-ONLY ROOM MAINTENANCE ROUTES ---

// GET: Get all room maintenance records
app.get('/api/maintenance', authenticateToken, authorizeRole('admin'), async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT rm.MaintenanceID, rm.RoomID, r.RoomNumber, rm.StartDate, rm.EndDate, rm.Reason, rm.CreatedAt
            FROM RoomMaintenance rm
            JOIN Rooms r ON rm.RoomID = r.RoomID
            ORDER BY rm.StartDate DESC
        `);
        res.json(rows);
    } catch (error) {
        console.error('Error fetching maintenance records:', error);
        res.status(500).json({ error: 'Failed to fetch maintenance records' });
    }
});

// POST: Add a new room maintenance record
app.post('/api/maintenance', authenticateToken, authorizeRole('admin'), async (req, res) => {
    const { room_id, start_date, end_date, reason } = req.body;

    if (!room_id || !start_date || !end_date) {
        return res.status(400).json({ error: 'Missing required maintenance information' });
    }

    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        // tell triggers who is performing this action
        await connection.query('SET @current_admin_user_id = ?', [req.user.id]);

        // Insert maintenance record
        const [result] = await connection.query(
            'INSERT INTO RoomMaintenance (RoomID, StartDate, EndDate, Reason) VALUES (?, ?, ?, ?)',
            [room_id, start_date, end_date, reason]
        );

        // Optionally, update room status to 'Maintenance' if it's within the maintenance period
        // This is a simplified approach; a more robust system might handle this with scheduled tasks
        await connection.query(
            'UPDATE Rooms SET Status = \'Maintenance\' WHERE RoomID = ? AND Status != \'Occupied\'',
            [room_id]
        );

        await connection.commit();
        res.status(201).json({ message: 'Maintenance record added successfully', maintenance_id: result.insertId });

    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Error adding maintenance record:', error);
        res.status(500).json({ error: 'Failed to add maintenance record' });
    } finally {
        if (connection) connection.release();
    }
});

// PUT: Update an existing room maintenance record
app.put('/api/maintenance/:id', authenticateToken, authorizeRole('admin'), async (req, res) => {
    const { id } = req.params;
    const { room_id, start_date, end_date, reason } = req.body;

    if (!room_id || !start_date || !end_date) {
        return res.status(400).json({ error: 'Missing required maintenance information' });
    }

    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        // set session var for triggers
        await connection.query('SET @current_admin_user_id = ?', [req.user.id]);

        const [result] = await connection.query(
            'UPDATE RoomMaintenance SET RoomID = ?, StartDate = ?, EndDate = ?, Reason = ? WHERE MaintenanceID = ?',
            [room_id, start_date, end_date, reason, id]
        );

        if (result.affectedRows === 0) {
            await connection.rollback();
            return res.status(404).json({ error: 'Maintenance record not found' });
        }

        await connection.commit();
        res.json({ message: 'Maintenance record updated successfully' });

    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Error updating maintenance record:', error);
        res.status(500).json({ error: 'Failed to update maintenance record' });
    } finally {
        if (connection) connection.release();
    }
});

// DELETE: Delete a room maintenance record
app.delete('/api/maintenance/:id', authenticateToken, authorizeRole('admin'), async (req, res) => {
    const { id } = req.params;

    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        // set session var for triggers
        await connection.query('SET @current_admin_user_id = ?', [req.user.id]);

        const [result] = await connection.query('DELETE FROM RoomMaintenance WHERE MaintenanceID = ?', [id]);

        if (result.affectedRows === 0) {
            await connection.rollback();
            return res.status(404).json({ error: 'Maintenance record not found' });
        }

        await connection.commit();
        res.json({ message: 'Maintenance record deleted successfully' });

    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Error deleting maintenance record:', error);
        res.status(500).json({ error: 'Failed to delete maintenance record' });
    } finally {
        if (connection) connection.release();
    }
});

// --- ADMIN-ONLY PROMOTIONS ROUTES ---

// GET: Get all promotions
app.get('/api/promotions', authenticateToken, authorizeRole('admin'), async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT PromoID, PromoCode, DiscountType, DiscountValue, StartDate, EndDate, RoomTypeID, MinStayNights, MaxUses, CurrentUses, IsActive, CreatedAt
            FROM Promotions
            ORDER BY CreatedAt DESC
        `);
        res.json(rows);
    } catch (error) {
        console.error('Error fetching promotions:', error);
        res.status(500).json({ error: 'Failed to fetch promotions' });
    }
});

// POST: Create a new promotion
app.post('/api/promotions', authenticateToken, authorizeRole('admin'), async (req, res) => {
    const { promo_code, discount_type, discount_value, start_date, end_date, room_type_id, min_stay_nights, max_uses, is_active } = req.body;

    if (!promo_code || !discount_type || discount_value === undefined || !start_date || !end_date) {
        return res.status(400).json({ error: 'Missing required promotion information' });
    }

    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        // set session var for triggers
        await connection.query('SET @current_admin_user_id = ?', [req.user.id]);

        const [result] = await connection.query(
            'INSERT INTO Promotions (PromoCode, DiscountType, DiscountValue, StartDate, EndDate, RoomTypeID, MinStayNights, MaxUses, IsActive, CurrentUses) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [promo_code, discount_type, discount_value, start_date, end_date, room_type_id, min_stay_nights, max_uses, is_active, 0]
        );

        await connection.commit();
        res.status(201).json({ message: 'Promotion created successfully', promo_id: result.insertId });
    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Error creating promotion:', error);
        res.status(500).json({ error: 'Failed to create promotion' });
    } finally {
        if (connection) connection.release();
    }
});

// PUT: Update an existing promotion
app.put('/api/promotions/:id', authenticateToken, authorizeRole('admin'), async (req, res) => {
    const { id } = req.params;
    const { promo_code, discount_type, discount_value, start_date, end_date, room_type_id, min_stay_nights, max_uses, is_active } = req.body;

    if (!promo_code || !discount_type || discount_value === undefined || !start_date || !end_date) {
        return res.status(400).json({ error: 'Missing required promotion information' });
    }

    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        // set session var for triggers
        await connection.query('SET @current_admin_user_id = ?', [req.user.id]);

        const [result] = await connection.query(
            'UPDATE Promotions SET PromoCode = ?, DiscountType = ?, DiscountValue = ?, StartDate = ?, EndDate = ?, RoomTypeID = ?, MinStayNights = ?, MaxUses = ?, IsActive = ? WHERE PromoID = ?',
            [promo_code, discount_type, discount_value, start_date, end_date, room_type_id, min_stay_nights, max_uses, is_active, id]
        );

        if (result.affectedRows === 0) {
            await connection.rollback();
            return res.status(404).json({ error: 'Promotion not found' });
        }

        await connection.commit();
        res.json({ message: 'Promotion updated successfully' });
    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Error updating promotion:', error);
        res.status(500).json({ error: 'Failed to update promotion' });
    } finally {
        if (connection) connection.release();
    }
});

// DELETE: Delete a promotion
app.delete('/api/promotions/:id', authenticateToken, authorizeRole('admin'), async (req, res) => {
    const { id } = req.params;

    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        await connection.query('SET @current_admin_user_id = ?', [req.user.id]);

        const [result] = await connection.query('DELETE FROM Promotions WHERE PromoID = ?', [id]);

        if (result.affectedRows === 0) {
            await connection.rollback();
            return res.status(404).json({ error: 'Promotion not found' });
        }

        await connection.commit();
        res.json({ message: 'Promotion deleted successfully' });
    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Error deleting promotion:', error);
        res.status(500).json({ error: 'Failed to delete promotion' });
    } finally {
        if (connection) connection.release();
    }
});

// --- ADMIN-ONLY DASHBOARD ANALYTICS ROUTES ---

// GET: Get occupancy rates
app.get('/api/analytics/occupancy', authenticateToken, authorizeRole('admin'), async (req, res) => {
    try {
        const query = `
            SELECT
                DATE_FORMAT(CheckInDate, '%Y-%m') AS month,
                COUNT(BookingID) AS total_bookings,
                SUM(DATEDIFF(CheckOutDate, CheckInDate)) AS total_nights_booked,
                (SUM(DATEDIFF(CheckOutDate, CheckInDate)) / (COUNT(DISTINCT r.RoomID) * 30)) * 100 AS occupancy_rate -- Assuming 30 days/month for simplicity
            FROM Bookings
            JOIN Rooms r ON Bookings.RoomID = r.RoomID
            WHERE Status != 'Cancelled'
            GROUP BY month
            ORDER BY month;
        `;
        const [rows] = await pool.query(query);
        res.json(rows);
    } catch (error) {
        console.error('Error fetching occupancy analytics:', error);
        res.status(500).json({ error: 'Failed to fetch occupancy analytics' });
    }
});

// GET: Get revenue by room type
app.get('/api/analytics/revenue-by-room-type', authenticateToken, authorizeRole('admin'), async (req, res) => {
    try {
        const query = `
            SELECT
                rt.TypeName AS room_type,
                SUM(b.TotalAmount) AS total_revenue,
                COUNT(b.BookingID) AS total_bookings
            FROM Bookings b
            JOIN Rooms r ON b.RoomID = r.RoomID
            JOIN RoomTypes rt ON r.RoomTypeID = rt.RoomTypeID
            WHERE b.Status != 'Cancelled'
            GROUP BY rt.TypeName
            ORDER BY total_revenue DESC;
        `;
        const [rows] = await pool.query(query);
        res.json(rows);
    } catch (error) {
        console.error('Error fetching revenue by room type analytics:', error);
        res.status(500).json({ error: 'Failed to fetch revenue by room type analytics' });
    }
});

// GET: Get guest booking patterns (e.g., average stay duration)
app.get('/api/analytics/guest-patterns', authenticateToken, authorizeRole('admin'), async (req, res) => {
    try {
        const query = `
            SELECT
                g.FirstName,
                g.LastName,
                COUNT(b.BookingID) AS total_bookings,
                AVG(DATEDIFF(b.CheckOutDate, b.CheckInDate)) AS average_stay_duration,
                SUM(b.TotalAmount) AS total_spent
            FROM Guests g
            JOIN Bookings b ON g.GuestID = b.PrimaryGuestID
            WHERE b.Status != 'Cancelled'
            GROUP BY g.GuestID
            ORDER BY total_spent DESC;
        `;
        const [rows] = await pool.query(query);
        res.json(rows);
    } catch (error) {
        console.error('Error fetching guest patterns analytics:', error);
        res.status(500).json({ error: 'Failed to fetch guest patterns analytics' });
    }
});

// Start the server
app.listen(PORT, () => {
  //console.log(`Backend server running on http://localhost:${PORT}`);
});
// Start scheduled precompute (non-blocking)
try {
    startPrecompute();
} catch (err) {
    console.error('Failed to start precompute:', err);
}
