const express = require('express');
const db = require('../config/database');
const { verifyToken, requireRole } = require('../middleware/auth');
const upload = require('../middleware/upload');

const router = express.Router();

router.use(verifyToken);
router.use(requireRole(['admin', 'student']));

// Get dashboard stats
router.get('/stats', async (req, res) => {
    try {
        const [pendingBookings] = await db.query('SELECT COUNT(*) as count FROM bookings WHERE user_id = ? AND status = "pending"', [req.userId]);
        const [activeExperiments] = await db.query('SELECT COUNT(*) as count FROM experiments WHERE user_id = ? AND status = "active"', [req.userId]);
        const [submittedAssignments] = await db.query('SELECT COUNT(*) as count FROM experiment_results WHERE experiment_id IN (SELECT id FROM experiments WHERE user_id = ?)', [req.userId]);
        
        res.json({
            success: true,
            stats: {
                pendingBookings: pendingBookings[0].count,
                activeExperiments: activeExperiments[0].count,
                submittedAssignments: submittedAssignments[0].count
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// Get available lab stations (all equipment for booking)
router.get('/stations', async (req, res) => {
    try {
        const [stations] = await db.query(`
            SELECT id, name, category, location, status 
            FROM equipment 
            ORDER BY name
        `);
        res.json({ success: true, stations });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// Check equipment availability
router.post('/check-availability', async (req, res) => {
    const { equipment_id, start_time, end_time } = req.body;
    
    try {
        const [overlapping] = await db.query(
            `SELECT b.*, u.full_name as booked_by 
             FROM bookings b
             JOIN users u ON b.user_id = u.id
             WHERE b.equipment_id = ? 
             AND b.status IN ('pending', 'approved')
             AND (
                 (start_time BETWEEN ? AND ?) OR 
                 (end_time BETWEEN ? AND ?) OR 
                 (start_time <= ? AND end_time >= ?)
             )`,
            [equipment_id, start_time, end_time, start_time, end_time, start_time, end_time]
        );
        
        if (overlapping.length > 0) {
            res.json({ 
                success: true, 
                available: false, 
                conflicts: overlapping,
                message: `Equipment is already booked for this time slot by ${overlapping[0].booked_by}`
            });
        } else {
            res.json({ success: true, available: true, message: 'Equipment is available for this time slot.' });
        }
    } catch (error) {
        console.error('Availability check error:', error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// Get all equipment for booking with status
router.get('/equipment-for-booking', async (req, res) => {
    try {
        const [equipment] = await db.query(`
            SELECT id, name, category, location, status, description 
            FROM equipment 
            ORDER BY name
        `);
        res.json({ success: true, equipment });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// Create desk booking with conflict check
router.post('/bookings', async (req, res) => {
    const { equipment_id, start_time, end_time, purpose } = req.body;
    
    if (!equipment_id || !start_time || !end_time) {
        return res.status(400).json({ success: false, message: 'Equipment, start time, and end time are required.' });
    }
    
    if (new Date(start_time) >= new Date(end_time)) {
        return res.status(400).json({ success: false, message: 'Start time must be before end time.' });
    }
    
    try {
        const [equipment] = await db.query('SELECT id, status FROM equipment WHERE id = ?', [equipment_id]);
        if (equipment.length === 0) {
            return res.status(400).json({ success: false, message: 'Selected equipment not found.' });
        }
        
        if (equipment[0].status === 'maintenance') {
            return res.status(400).json({ success: false, message: 'This equipment is under maintenance and cannot be booked.' });
        }
        
        const [overlapping] = await db.query(
            `SELECT id FROM bookings 
             WHERE equipment_id = ? AND status IN ('pending', 'approved')
             AND (
                 (start_time BETWEEN ? AND ?) OR 
                 (end_time BETWEEN ? AND ?) OR 
                 (start_time <= ? AND end_time >= ?)
             )`,
            [equipment_id, start_time, end_time, start_time, end_time, start_time, end_time]
        );
        
        if (overlapping.length > 0) {
            return res.status(400).json({ 
                success: false, 
                message: 'Equipment already booked for this time slot. Please choose a different time.'
            });
        }
        
        const [result] = await db.query(
            'INSERT INTO bookings (user_id, equipment_id, start_time, end_time, purpose) VALUES (?, ?, ?, ?, ?)',
            [req.userId, equipment_id, start_time, end_time, purpose || 'Lab work']
        );
        
        res.json({ success: true, message: 'Desk booking request submitted.', bookingId: result.insertId });
    } catch (error) {
        console.error('Booking error:', error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// Get my desk bookings
router.get('/my-bookings', async (req, res) => {
    try {
        const [bookings] = await db.query(`
            SELECT b.*, e.name as station_name, e.status as equipment_status
            FROM bookings b
            JOIN equipment e ON b.equipment_id = e.id
            WHERE b.user_id = ?
            ORDER BY b.created_at DESC
        `, [req.userId]);
        
        res.json({ success: true, bookings });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// Get my experiments/assignments
router.get('/my-experiments', async (req, res) => {
    try {
        const [experiments] = await db.query(`
            SELECT e.*, b.equipment_id, eq.name as equipment_name
            FROM experiments e
            LEFT JOIN bookings b ON e.booking_id = b.id
            LEFT JOIN equipment eq ON b.equipment_id = eq.id
            WHERE e.user_id = ?
            ORDER BY e.started_at DESC
        `, [req.userId]);
        
        res.json({ success: true, experiments });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// Create/Update student experiment
router.post('/experiments', async (req, res) => {
    const { booking_id, title, equipment_used, progress, notes } = req.body;
    
    try {
        if (booking_id) {
            const [booking] = await db.query('SELECT id FROM bookings WHERE id = ? AND user_id = ?', [booking_id, req.userId]);
            if (booking.length === 0) {
                return res.status(400).json({ success: false, message: 'Invalid booking selected.' });
            }
        }
        
        const [existing] = await db.query('SELECT id FROM experiments WHERE booking_id = ? AND user_id = ?', [booking_id, req.userId]);
        
        let status = 'active';
        let completedAt = null;
        if (progress >= 100) {
            status = 'completed';
            completedAt = new Date();
        }
        
        if (existing.length > 0) {
            await db.query(
                'UPDATE experiments SET progress = ?, status = ?, notes = ?, completed_at = ? WHERE id = ?',
                [progress, status, notes, completedAt, existing[0].id]
            );
        } else {
            await db.query(
                'INSERT INTO experiments (user_id, booking_id, title, equipment_used, progress, status, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [req.userId, booking_id, title, equipment_used, progress, status, notes]
            );
        }
        
        res.json({ success: true, message: 'Assignment progress saved.' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// Upload assignment
router.post('/upload-assignment', upload.single('assignFile'), async (req, res) => {
    const { experiment_id, title, conclusion } = req.body;
    const filePath = req.file ? req.file.path : null;
    const fileName = req.file ? req.file.originalname : null;
    
    try {
        const [experiment] = await db.query('SELECT id FROM experiments WHERE id = ? AND user_id = ?', [experiment_id, req.userId]);
        if (experiment.length === 0) {
            return res.status(400).json({ success: false, message: 'Invalid experiment selected.' });
        }
        
        await db.query(
            'INSERT INTO experiment_results (experiment_id, title, file_path, file_name, conclusion) VALUES (?, ?, ?, ?, ?)',
            [experiment_id, title, filePath, fileName, conclusion]
        );
        
        res.json({ success: true, message: 'Assignment submitted successfully.' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// Get submitted assignments
router.get('/my-submissions', async (req, res) => {
    try {
        const [results] = await db.query(`
            SELECT er.*, e.title as experiment_title
            FROM experiment_results er
            JOIN experiments e ON er.experiment_id = e.id
            WHERE e.user_id = ?
            ORDER BY er.uploaded_at DESC
        `, [req.userId]);
        
        res.json({ success: true, results });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// Get SOP documents (lab manuals)
router.get('/manuals', async (req, res) => {
    try {
        const [manuals] = await db.query(`
            SELECT s.*, e.name as equipment_name, e.id as equipment_id
            FROM sop_documents s
            LEFT JOIN equipment e ON s.equipment_id = e.id
            ORDER BY s.uploaded_at DESC
        `);
        console.log('Manuals loaded for student:', manuals.length);
        res.json({ success: true, manuals });
    } catch (error) {
        console.error('Manuals error:', error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// Download SOP file
router.get('/manuals/:id/download', async (req, res) => {
    try {
        const [manuals] = await db.query('SELECT file_path, file_name, title FROM sop_documents WHERE id = ?', [req.params.id]);
        
        if (manuals.length === 0 || !manuals[0].file_path) {
            return res.status(404).json({ success: false, message: 'File not found.' });
        }
        
        const filePath = manuals[0].file_path;
        const fileName = manuals[0].file_name;
        
        if (require('fs').existsSync(filePath)) {
            res.download(filePath, fileName);
        } else {
            res.status(404).json({ success: false, message: 'File not found on server.' });
        }
    } catch (error) {
        console.error('Download error:', error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// Report issue
router.post('/issues', async (req, res) => {
    const { equipment_id, severity, description } = req.body;
    
    if (!equipment_id || !severity || !description) {
        return res.status(400).json({ success: false, message: 'All fields are required.' });
    }
    
    try {
        const [equipment] = await db.query('SELECT id FROM equipment WHERE id = ?', [equipment_id]);
        if (equipment.length === 0) {
            return res.status(400).json({ success: false, message: 'Selected equipment not found.' });
        }
        
        await db.query(
            'INSERT INTO damage_reports (equipment_id, reported_by, severity, description) VALUES (?, ?, ?, ?)',
            [equipment_id, req.userId, severity, description]
        );
        
        res.json({ success: true, message: 'Issue reported successfully.' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// Get my reported issues
router.get('/my-issues', async (req, res) => {
    try {
        const [issues] = await db.query(`
            SELECT dr.*, e.name as equipment_name
            FROM damage_reports dr
            JOIN equipment e ON dr.equipment_id = e.id
            WHERE dr.reported_by = ?
            ORDER BY dr.reported_at DESC
        `, [req.userId]);
        
        res.json({ success: true, issues });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// ========== MESSAGES - FULL TWO-WAY CHAT ==========

// Send message to supervisor
router.post('/messages', async (req, res) => {
    const { message } = req.body;
    
    if (!message || message.trim() === '') {
        return res.status(400).json({ success: false, message: 'Message is required.' });
    }
    
    try {
        // Get supervisor user ID (first supervisor or admin)
        const [supervisor] = await db.query(`
            SELECT id FROM users 
            WHERE role = 'supervisor' OR role = 'admin' 
            LIMIT 1
        `);
        
        if (supervisor.length === 0) {
            return res.status(400).json({ success: false, message: 'No supervisor available.' });
        }
        
        const [result] = await db.query(
            `INSERT INTO messages (sender_id, receiver_id, message, is_read, created_at) 
             VALUES (?, ?, ?, FALSE, NOW())`,
            [req.userId, supervisor[0].id, message.trim()]
        );
        
        console.log(`Student ${req.userId} sent message to supervisor ${supervisor[0].id}`);
        
        res.json({ success: true, message: 'Message sent successfully.', id: result.insertId });
    } catch (error) {
        console.error('Message error:', error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// Get all messages (both sent and received)
router.get('/messages', async (req, res) => {
    try {
        const [messages] = await db.query(`
            SELECT 
                m.*,
                u1.full_name as sender_name,
                u1.role as sender_role,
                u2.full_name as receiver_name,
                u2.role as receiver_role
            FROM messages m
            JOIN users u1 ON m.sender_id = u1.id
            LEFT JOIN users u2 ON m.receiver_id = u2.id
            WHERE m.receiver_id = ? OR m.sender_id = ?
            ORDER BY m.created_at ASC
        `, [req.userId, req.userId]);
        
        res.json({ success: true, messages });
    } catch (error) {
        console.error('Messages error:', error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// Mark messages as read
router.put('/messages/mark-read', async (req, res) => {
    try {
        const [result] = await db.query(
            'UPDATE messages SET is_read = TRUE WHERE receiver_id = ? AND is_read = FALSE',
            [req.userId]
        );
        res.json({ success: true, message: 'Messages marked as read.', count: result.affectedRows });
    } catch (error) {
        console.error('Mark read error:', error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// Get unread message count
router.get('/messages/unread-count', async (req, res) => {
    try {
        const [result] = await db.query(
            'SELECT COUNT(*) as count FROM messages WHERE receiver_id = ? AND is_read = FALSE',
            [req.userId]
        );
        res.json({ success: true, count: result[0].count });
    } catch (error) {
        console.error('Unread count error:', error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

module.exports = router;