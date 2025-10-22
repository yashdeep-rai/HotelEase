// backend/middleware/auth.js
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../routes/auth.js';

// Middleware to verify the token
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (token == null) {
        return res.status(401).json({ error: 'No token, authorization denied' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded.user; // Add user payload to request
        next();
    } catch (err) {
        res.status(403).json({ error: 'Token is not valid' });
    }
};

// Middleware to check for a specific role
const authorizeRole = (role) => {
    return (req, res, next) => {
        if (req.user.role !== role) {
            return res.status(403).json({ error: 'Access denied: Insufficient privileges' });
        }
        next();
    };
};

export { authenticateToken, authorizeRole };