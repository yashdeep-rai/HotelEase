// backend/routes/auth.js
import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import pool from '../db.js';

const router = express.Router();
const JWT_SECRET = 'your_super_secret_key_change_this'; // IMPORTANT: Change this!

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

        // 1) Insert into Guests table and get GuestID
        const guestInsert = 'INSERT INTO Guests (FirstName, LastName, Email, Phone) VALUES (?, ?, ?, ?)';
        const [guestResult] = await pool.query(guestInsert, [first_name, last_name, email, phone]);
        const guestId = guestResult.insertId;

        // 2) Insert into users table referencing the created guest
        const userInsert = 'INSERT INTO users (guest_id, email, password_hash, role) VALUES (?, ?, ?, ?)';
        const [result] = await pool.query(userInsert, [guestId, email, password_hash, userRole]);

        res.status(201).json({ message: 'User created!', user_id: result.insertId });

    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ error: 'Email already exists' });
        }
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Database insert failed' });
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
                first_name: user.FirstName || null
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