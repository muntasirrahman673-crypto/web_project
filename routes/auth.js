const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/database');
const { body, validationResult } = require('express-validator');

const router = express.Router();

// Register
router.post('/register', [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 6 }),
    body('fullName').notEmpty(),
    body('role').isIn(['admin', 'supervisor', 'researcher', 'student'])
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ 
                success: false, 
                message: errors.array()[0].msg 
            });
        }
        
        const { email, password, fullName, role, department } = req.body;
        
        // Check if user exists
        const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
        if (existing.length > 0) {
            return res.status(400).json({ 
                success: false, 
                message: 'User already exists' 
            });
        }
        
        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        
        // Insert user
        const [result] = await pool.query(
            'INSERT INTO users (full_name, email, password_hash, role, department, is_approved) VALUES (?, ?, ?, ?, ?, ?)',
            [fullName, email, hashedPassword, role, department, role === 'admin']
        );
        
        // Create token
        const token = jwt.sign(
            { id: result.insertId, role: role },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRE }
        );
        
        res.status(201).json({
            success: true,
            message: 'Registration successful! Please wait for admin approval.',
            token,
            user: {
                id: result.insertId,
                name: fullName,
                full_name: fullName,
                email: email,
                role: role
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error during registration' 
        });
    }
});

// Login
router.post('/login', [
    body('email').isEmail(),
    body('password').notEmpty()
], async (req, res) => {
    try {
        const { email, password } = req.body;
        
        const [rows] = await pool.query(
            'SELECT id, full_name, email, password_hash, role, is_approved FROM users WHERE email = ?',
            [email]
        );
        
        if (rows.length === 0) {
            return res.status(401).json({ 
                success: false, 
                message: 'Invalid email or password' 
            });
        }
        
        const user = rows[0];
        
        if (!user.is_approved && user.role !== 'admin') {
            return res.status(401).json({ 
                success: false, 
                message: 'Account pending approval. Please wait for admin approval.' 
            });
        }
        
        const isValidPassword = await bcrypt.compare(password, user.password_hash);
        if (!isValidPassword) {
            return res.status(401).json({ 
                success: false, 
                message: 'Invalid email or password' 
            });
        }
        
        // Update last login
        await pool.query('UPDATE users SET last_login = NOW() WHERE id = ?', [user.id]);
        
        const token = jwt.sign(
            { id: user.id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRE }
        );
        
        res.json({
            success: true,
            message: 'Login successful!',
            token,
            user: {
                id: user.id,
                name: user.full_name,
                full_name: user.full_name,
                email: user.email,
                role: user.role
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error during login' 
        });
    }
});

// Protect middleware
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
                return res.status(401).json({ 
                    success: false, 
                    message: 'User not found' 
                });
            }
            
            req.user = rows[0];
            next();
        } catch (error) {
            return res.status(401).json({ 
                success: false, 
                message: 'Not authorized. Invalid or expired token.' 
            });
        }
    }
    
    if (!token) {
        return res.status(401).json({ 
            success: false, 
            message: 'No token provided. Please login.' 
        });
    }
};

// Get current user
router.get('/me', protect, async (req, res) => {
    try {
        const [rows] = await pool.query(
            'SELECT id, full_name, email, role, department, is_approved, created_at FROM users WHERE id = ?',
            [req.user.id]
        );
        res.json({ 
            success: true, 
            user: rows[0] 
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: 'Server error' 
        });
    }
});

module.exports = router;