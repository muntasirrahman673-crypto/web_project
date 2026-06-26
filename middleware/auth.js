const jwt = require('jsonwebtoken');
const pool = require('../config/database');

const protect = async (req, res, next) => {
    let token;
    
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            token = req.headers.authorization.split(' ')[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            
            const [rows] = await pool.query(
                'SELECT id, full_name, email, role, is_approved FROM users WHERE id = ?',
                [decoded.id]
            );
            
            if (rows.length === 0) {
                return res.status(401).json({ success: false, message: 'User not found' });
            }
            
            // Check if user is approved (unless they're admin)
            if (!rows[0].is_approved && rows[0].role !== 'admin') {
                return res.status(401).json({ success: false, message: 'Account pending approval' });
            }
            
            req.user = rows[0];
            req.userId = rows[0].id;  // Add this for compatibility with other routes
            req.userRole = rows[0].role;  // Add this for compatibility
            
            next();
        } catch (error) {
            console.error('Auth error:', error);
            return res.status(401).json({ success: false, message: 'Not authorized' });
        }
    }
    
    if (!token) {
        return res.status(401).json({ success: false, message: 'No token provided' });
    }
};

const authorize = (...roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }
        next();
    };
};

// Add these additional middleware functions for compatibility with your route files
const verifyToken = async (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ success: false, message: 'No token provided' });
    }
    
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        const [rows] = await pool.query(
            'SELECT id, full_name, email, role, is_approved FROM users WHERE id = ?',
            [decoded.id]
        );
        
        if (rows.length === 0) {
            return res.status(401).json({ success: false, message: 'User not found' });
        }
        
        if (!rows[0].is_approved && rows[0].role !== 'admin') {
            return res.status(401).json({ success: false, message: 'Account pending approval' });
        }
        
        req.userId = rows[0].id;
        req.userRole = rows[0].role;
        req.user = rows[0];
        next();
    } catch (error) {
        return res.status(401).json({ success: false, message: 'Invalid token' });
    }
};

const requireRole = (roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.userRole)) {
            return res.status(403).json({ success: false, message: 'Access denied. Required role: ' + roles.join(', ') });
        }
        next();
    };
};

const isSupervisor = async (req, res, next) => {
    try {
        if (req.userRole === 'supervisor' || req.userRole === 'admin') {
            next();
        } else {
            return res.status(403).json({ success: false, message: 'Supervisor access required' });
        }
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

module.exports = { 
    protect, 
    authorize, 
    verifyToken, 
    requireRole, 
    isSupervisor 
};