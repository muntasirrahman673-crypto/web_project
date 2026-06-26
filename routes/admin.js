const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/database');

const router = express.Router();

// Custom middleware for this route file
const verifyToken = async (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ success: false, message: 'No token provided' });
    }
    
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.userId = decoded.id;
        req.userRole = decoded.role;
        next();
    } catch (error) {
        return res.status(401).json({ success: false, message: 'Invalid token' });
    }
};

const isAdmin = async (req, res, next) => {
    try {
        const [users] = await db.query('SELECT role FROM users WHERE id = ?', [req.userId]);
        
        if (users.length === 0 || users[0].role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Admin access required' });
        }
        
        next();
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

// Apply middleware to all routes in this file
router.use(verifyToken);
router.use(isAdmin);

// Get dashboard stats
router.get('/stats', async (req, res) => {
    try {
        const [totalUsers] = await db.query('SELECT COUNT(*) as count FROM users');
        const [pendingUsers] = await db.query('SELECT COUNT(*) as count FROM users WHERE is_approved = FALSE AND role != "admin"');
        const [totalEquipment] = await db.query('SELECT COUNT(*) as count FROM equipment');
        const [activeBookings] = await db.query('SELECT COUNT(*) as count FROM bookings WHERE status = "approved" AND end_time > NOW()');
        
        res.json({
            success: true,
            stats: {
                totalUsers: totalUsers[0].count,
                pendingApprovals: pendingUsers[0].count,
                totalEquipment: totalEquipment[0].count,
                activeBookings: activeBookings[0].count
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// Get all users
router.get('/users', async (req, res) => {
    try {
        const [users] = await db.query(
            'SELECT id, full_name, email, role, department, is_approved, created_at, last_login FROM users ORDER BY created_at DESC'
        );
        res.json({ success: true, users });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// Approve user
router.put('/users/:id/approve', async (req, res) => {
    const { id } = req.params;
    
    try {
        await db.query('UPDATE users SET is_approved = TRUE WHERE id = ?', [id]);
        
        // Log activity
        await db.query(
            'INSERT INTO activity_logs (user_id, action) VALUES (?, ?)',
            [req.userId, `Approved user ID: ${id}`]
        );
        
        res.json({ success: true, message: 'User approved successfully.' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// Reject/Delete user
router.delete('/users/:id', async (req, res) => {
    const { id } = req.params;
    
    try {
        await db.query('DELETE FROM users WHERE id = ?', [id]);
        res.json({ success: true, message: 'User deleted successfully.' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// Get all supervisors
router.get('/supervisors', async (req, res) => {
    try {
        const [supervisors] = await db.query(
            'SELECT id, full_name, email, department FROM users WHERE role = "supervisor" OR role = "admin"'
        );
        res.json({ success: true, supervisors });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// Add supervisor
router.post('/supervisors', async (req, res) => {
    const { full_name, email, password, department } = req.body;
    
    try {
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        
        const [result] = await db.query(
            'INSERT INTO users (full_name, email, password_hash, role, department, is_approved) VALUES (?, ?, ?, "supervisor", ?, TRUE)',
            [full_name, email, hashedPassword, department]
        );
        
        res.json({ success: true, message: 'Supervisor added successfully.', id: result.insertId });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// Get all equipment
router.get('/equipment', async (req, res) => {
    try {
        const [equipment] = await db.query('SELECT * FROM equipment ORDER BY created_at DESC');
        res.json({ success: true, equipment });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// Add equipment
router.post('/equipment', async (req, res) => {
    const { name, category, location, status, description } = req.body;
    
    try {
        const [result] = await db.query(
            'INSERT INTO equipment (name, category, location, status, description) VALUES (?, ?, ?, ?, ?)',
            [name, category, location, status || 'available', description]
        );
        
        res.json({ success: true, message: 'Equipment added successfully.', id: result.insertId });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// Update equipment
router.put('/equipment/:id', async (req, res) => {
    const { id } = req.params;
    const { name, category, location, status, description } = req.body;
    
    try {
        await db.query(
            'UPDATE equipment SET name = ?, category = ?, location = ?, status = ?, description = ? WHERE id = ?',
            [name, category, location, status, description, id]
        );
        
        res.json({ success: true, message: 'Equipment updated successfully.' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// Delete equipment
router.delete('/equipment/:id', async (req, res) => {
    const { id } = req.params;
    
    try {
        await db.query('DELETE FROM equipment WHERE id = ?', [id]);
        res.json({ success: true, message: 'Equipment deleted successfully.' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// Get all damage reports
router.get('/damage-reports', async (req, res) => {
    try {
        const [reports] = await db.query(`
            SELECT dr.*, e.name as equipment_name, u.full_name as reported_by_name
            FROM damage_reports dr
            JOIN equipment e ON dr.equipment_id = e.id
            JOIN users u ON dr.reported_by = u.id
            ORDER BY dr.reported_at DESC
        `);
        res.json({ success: true, reports });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

module.exports = router;