// backend/routes/auth.js
import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import pool from '../db.js';

const router = express.Router();
// Use an environment-provided JWT secret. In production this MUST be set.
let JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    if (process.env.NODE_ENV === 'production') {
        // Fail-fast in production
        throw new Error('JWT_SECRET must be set in production environment');
    } else {
        // Developer convenience fallback (not for production)
        console.warn('Warning: JWT_SECRET not set. Using insecure dev fallback. Set JWT_SECRET in .env for production.');
        JWT_SECRET = 'dev_fallback_secret_change_me';
    }
}

// POST: Register a new user
router.post('/register', async (req, res) => {
    const { first_name, last_name, email, phone, password, role } = req.body;

    if (!first_name || !last_name || !email || !password) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
        // Hash the password
        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(password, salt);

        // Determine the role
        const userRole = role === 'admin' ? 'admin' : 'guest';

        // Use a transaction: insert into Guests and users together to avoid orphan guests
        const conn = await pool.getConnection();
        try {
            await conn.beginTransaction();

            const guestInsert = 'INSERT INTO Guests (FirstName, LastName, Email, Phone) VALUES (?, ?, ?, ?)';
            const [guestResult] = await conn.query(guestInsert, [first_name, last_name, email, phone]);
            const guestId = guestResult.insertId;

            const userInsert = 'INSERT INTO users (guest_id, email, password_hash, role) VALUES (?, ?, ?, ?)';
            const [result] = await conn.query(userInsert, [guestId, email, password_hash, userRole]);

            await conn.commit();
            res.status(201).json({ message: 'User created!', user_id: result.insertId });
        } catch (txErr) {
            await conn.rollback();
            throw txErr;
        } finally {
            conn.release();
        }

    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ error: 'Email already exists' });
        }
        console.error('Registration error:', error);
        // Return the DB error message in development to help debugging
        const errMsg = process.env.NODE_ENV === 'production' ? 'Database insert failed' : (error.message || 'Database insert failed');
        res.status(500).json({ error: errMsg });
    }
});

// POST: Login a user
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }

    try {
        // Join users -> guests to fetch guest details alongside auth row
        const [rows] = await pool.query(
            'SELECT u.user_id, u.guest_id, u.email, u.password_hash, u.role, g.FirstName, g.LastName FROM users u LEFT JOIN Guests g ON u.guest_id = g.GuestID WHERE u.email = ?',
            [email]
        );
        if (rows.length === 0) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        const user = rows[0];

        // Compare password
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        // Create JWT
        const payload = {
            user: {
                id: user.user_id,
                guest_id: user.guest_id,
                email: user.email,
                role: user.role,
                first_name: user.FirstName || null,
                last_name: user.LastName || null
            }
        };

        jwt.sign(
            payload,
            JWT_SECRET,
            { expiresIn: '3h' }, // Token expires in 3 hours
            (err, token) => {
                if (err) throw err;
                res.json({ token, user: payload.user });
            }
        );

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

export { router as authRoutes, JWT_SECRET };