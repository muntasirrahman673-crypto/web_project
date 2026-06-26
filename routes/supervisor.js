const express = require('express');
const db = require('../config/database');
const { verifyToken, isSupervisor } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const router = express.Router();

// Configure file upload for SOP documents
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = './uploads/sop/';
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const fileFilter = (req, file, cb) => {
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type'), false);
    }
};

const upload = multer({ 
    storage: storage, 
    fileFilter: fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 }
});

router.use(verifyToken, isSupervisor);

// Get dashboard stats
router.get('/stats', async (req, res) => {
    try {
        const [pendingBookings] = await db.query('SELECT COUNT(*) as count FROM bookings WHERE status = "pending"');
        const [activeExperiments] = await db.query('SELECT COUNT(*) as count FROM experiments WHERE status = "active"');
        const [availableEquipment] = await db.query('SELECT COUNT(*) as count FROM equipment WHERE status = "available"');
        
        res.json({
            success: true,
            stats: {
                pendingBookings: pendingBookings[0].count,
                activeExperiments: activeExperiments[0].count,
                availableEquipment: availableEquipment[0].count
            }
        });
    } catch (error) {
        console.error('Stats error:', error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// Get all bookings with filters
router.get('/bookings', async (req, res) => {
    const { status } = req.query;
    
    try {
        let query = `
            SELECT b.*, u.full_name as user_name, u.email, e.name as equipment_name
            FROM bookings b
            JOIN users u ON b.user_id = u.id
            JOIN equipment e ON b.equipment_id = e.id
        `;
        const params = [];
        
        if (status && status !== 'all') {
            query += ' WHERE b.status = ?';
            params.push(status);
        }
        
        query += ' ORDER BY b.created_at DESC';
        
        const [bookings] = await db.query(query, params);
        res.json({ success: true, bookings });
    } catch (error) {
        console.error('Bookings error:', error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// Update booking status and automatically update equipment status based on time
router.put('/bookings/:id/status', async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    
    try {
        const [booking] = await db.query('SELECT equipment_id, start_time, end_time FROM bookings WHERE id = ?', [id]);
        
        if (booking.length === 0) {
            return res.status(404).json({ success: false, message: 'Booking not found.' });
        }
        
        await db.query(
            'UPDATE bookings SET status = ?, reviewed_by = ?, reviewed_at = NOW() WHERE id = ?',
            [status, req.userId, id]
        );
        
        if (status === 'approved') {
            const now = new Date();
            const startTime = new Date(booking[0].start_time);
            const endTime = new Date(booking[0].end_time);
            
            if (now >= startTime && now <= endTime) {
                await db.query('UPDATE equipment SET status = "inuse" WHERE id = ?', [booking[0].equipment_id]);
            }
        }
        
        await db.query(
            'INSERT INTO activity_logs (user_id, action) VALUES (?, ?)',
            [req.userId, `Updated booking ${id} to ${status}`]
        );
        
        res.json({ success: true, message: `Booking ${status} successfully.` });
    } catch (error) {
        console.error('Update booking status error:', error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// Get all equipment with full details
router.get('/equipment', async (req, res) => {
    try {
        const [equipment] = await db.query('SELECT * FROM equipment ORDER BY name');
        res.json({ success: true, equipment });
    } catch (error) {
        console.error('Equipment error:', error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// Update equipment status
router.put('/equipment/:id/status', async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    
    try {
        await db.query('UPDATE equipment SET status = ? WHERE id = ?', [status, id]);
        res.json({ success: true, message: 'Equipment status updated.' });
    } catch (error) {
        console.error('Update equipment status error:', error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// Get all experiments
router.get('/experiments', async (req, res) => {
    try {
        const [experiments] = await db.query(`
            SELECT e.*, u.full_name as researcher_name, eq.name as equipment_name
            FROM experiments e
            JOIN users u ON e.user_id = u.id
            LEFT JOIN bookings b ON e.booking_id = b.id
            LEFT JOIN equipment eq ON b.equipment_id = eq.id
            ORDER BY e.started_at DESC
        `);
        res.json({ success: true, experiments });
    } catch (error) {
        console.error('Experiments error:', error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// Update experiment progress
router.put('/experiments/:id/progress', async (req, res) => {
    const { id } = req.params;
    const { progress, notes } = req.body;
    
    try {
        let status = 'active';
        let completedAt = null;
        
        if (progress >= 100) {
            status = 'completed';
            completedAt = new Date();
        }
        
        await db.query(
            'UPDATE experiments SET progress = ?, status = ?, notes = ?, completed_at = ? WHERE id = ?',
            [progress, status, notes, completedAt, id]
        );
        
        res.json({ success: true, message: 'Experiment progress updated.' });
    } catch (error) {
        console.error('Update experiment error:', error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// Get SOP documents (with equipment info)
router.get('/sop', async (req, res) => {
    try {
        const [sopDocs] = await db.query(`
            SELECT s.*, e.name as equipment_name
            FROM sop_documents s
            LEFT JOIN equipment e ON s.equipment_id = e.id
            ORDER BY s.uploaded_at DESC
        `);
        res.json({ success: true, sopDocs });
    } catch (error) {
        console.error('SOP fetch error:', error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// Download SOP file
router.get('/sop/:id/download', async (req, res) => {
    try {
        const [sopDocs] = await db.query('SELECT file_path, file_name, title FROM sop_documents WHERE id = ?', [req.params.id]);
        
        if (sopDocs.length === 0 || !sopDocs[0].file_path) {
            return res.status(404).json({ success: false, message: 'File not found.' });
        }
        
        const filePath = sopDocs[0].file_path;
        const fileName = sopDocs[0].file_name || sopDocs[0].title;
        
        if (fs.existsSync(filePath)) {
            res.download(filePath, fileName);
        } else {
            res.status(404).json({ success: false, message: 'File not found on server.' });
        }
    } catch (error) {
        console.error('Download error:', error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// Upload SOP document with equipment linking - FIXED
router.post('/sop', upload.single('sopFile'), async (req, res) => {
    const { title, equipment_id, equipment_type, document_type, description } = req.body;
    const filePath = req.file ? req.file.path : null;
    const fileName = req.file ? req.file.originalname : null;
    
    console.log('SOP Upload Request:', { title, equipment_id, equipment_type, document_type, description, filePath, fileName });
    
    if (!title) {
        return res.status(400).json({ success: false, message: 'Title is required.' });
    }
    
    if (!req.file) {
        return res.status(400).json({ success: false, message: 'File is required.' });
    }
    
    try {
        const [result] = await db.query(
            `INSERT INTO sop_documents 
            (title, equipment_id, equipment_type, document_type, description, file_path, file_name, uploaded_by, uploaded_at) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
            [
                title, 
                equipment_id && equipment_id !== '' ? parseInt(equipment_id) : null, 
                equipment_type || null,
                document_type || 'sop', 
                description || null, 
                filePath, 
                fileName, 
                req.userId
            ]
        );
        
        console.log('SOP uploaded successfully:', result.insertId);
        
        res.json({ success: true, message: 'SOP document uploaded successfully.', id: result.insertId });
    } catch (error) {
        console.error('SOP upload error:', error);
        res.status(500).json({ success: false, message: 'Server error while uploading SOP: ' + error.message });
    }
});

// Get all equipment for damage report (with status)
router.get('/equipment-for-damage', async (req, res) => {
    try {
        const [equipment] = await db.query('SELECT id, name, status FROM equipment ORDER BY name');
        res.json({ success: true, equipment });
    } catch (error) {
        console.error('Equipment for damage error:', error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// Get damage reports
router.get('/damage-reports', async (req, res) => {
    try {
        const [reports] = await db.query(`
            SELECT dr.*, e.name as equipment_name, e.status as equipment_status, u.full_name as reported_by_name
            FROM damage_reports dr
            JOIN equipment e ON dr.equipment_id = e.id
            JOIN users u ON dr.reported_by = u.id
            ORDER BY dr.reported_at DESC
        `);
        res.json({ success: true, reports });
    } catch (error) {
        console.error('Error loading damage reports:', error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// Add damage report
router.post('/damage-reports', async (req, res) => {
    const { equipment_id, severity, description } = req.body;
    
    if (!equipment_id || !severity || !description) {
        return res.status(400).json({ success: false, message: 'All fields are required.' });
    }
    
    try {
        const [equipment] = await db.query('SELECT id, name FROM equipment WHERE id = ?', [equipment_id]);
        if (equipment.length === 0) {
            return res.status(400).json({ success: false, message: 'Selected equipment not found.' });
        }
        
        const [result] = await db.query(
            'INSERT INTO damage_reports (equipment_id, reported_by, severity, description, status) VALUES (?, ?, ?, ?, ?)',
            [equipment_id, req.userId, severity, description, 'pending']
        );
        
        if (severity === 'high') {
            await db.query('UPDATE equipment SET status = "maintenance" WHERE id = ?', [equipment_id]);
        }
        
        res.json({ success: true, message: 'Damage report submitted successfully.', id: result.insertId });
    } catch (error) {
        console.error('Damage report error:', error);
        res.status(500).json({ success: false, message: 'Server error while submitting damage report.' });
    }
});

// Update damage report status and restore equipment
router.put('/damage-reports/:id/status', async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    
    try {
        const [report] = await db.query('SELECT equipment_id FROM damage_reports WHERE id = ?', [id]);
        
        await db.query('UPDATE damage_reports SET status = ? WHERE id = ?', [status, id]);
        
        if (status === 'resolved' && report.length > 0) {
            const [activeIssues] = await db.query(
                'SELECT id FROM damage_reports WHERE equipment_id = ? AND status = "pending"',
                [report[0].equipment_id]
            );
            
            if (activeIssues.length === 0) {
                await db.query('UPDATE equipment SET status = "available" WHERE id = ?', [report[0].equipment_id]);
            }
        }
        
        res.json({ success: true, message: 'Damage report status updated.' });
    } catch (error) {
        console.error('Update damage report error:', error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// Auto-update equipment status based on bookings
router.post('/auto-update-equipment-status', async (req, res) => {
    try {
        const now = new Date();
        
        const [activeBookings] = await db.query(`
            SELECT DISTINCT equipment_id FROM bookings 
            WHERE status = 'approved' 
            AND start_time <= ? 
            AND end_time >= ?
        `, [now, now]);
        
        for (const booking of activeBookings) {
            await db.query('UPDATE equipment SET status = "inuse" WHERE id = ? AND status != "maintenance"', [booking.equipment_id]);
        }
        
        const [endedBookings] = await db.query(`
            SELECT DISTINCT equipment_id FROM bookings 
            WHERE status = 'approved' 
            AND end_time < ?
        `, [now]);
        
        for (const booking of endedBookings) {
            const [stillActive] = await db.query(`
                SELECT id FROM bookings 
                WHERE equipment_id = ? 
                AND status = 'approved' 
                AND start_time <= ? 
                AND end_time >= ?
            `, [booking.equipment_id, now, now]);
            
            if (stillActive.length === 0) {
                const [pendingDamages] = await db.query(
                    'SELECT id FROM damage_reports WHERE equipment_id = ? AND status = "pending"',
                    [booking.equipment_id]
                );
                
                if (pendingDamages.length === 0) {
                    await db.query('UPDATE equipment SET status = "available" WHERE id = ?', [booking.equipment_id]);
                }
            }
        }
        
        res.json({ success: true, message: 'Equipment status updated automatically.' });
    } catch (error) {
        console.error('Auto-update error:', error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// Get all users for chat
router.get('/users', async (req, res) => {
    try {
        const [users] = await db.query(`
            SELECT id, full_name, email, role 
            FROM users 
            WHERE role IN ('researcher', 'student', 'supervisor', 'admin')
            ORDER BY 
                CASE role 
                    WHEN 'admin' THEN 1 
                    WHEN 'supervisor' THEN 2 
                    WHEN 'researcher' THEN 3 
                    WHEN 'student' THEN 4 
                END,
                full_name ASC
        `);
        res.json({ success: true, users });
    } catch (error) {
        console.error('Users fetch error:', error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// Get messages for supervisor - FIXED
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
        console.error('Messages fetch error:', error);
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// Send message to user - FIXED
router.post('/messages', async (req, res) => {
    const { receiver_id, message } = req.body;
    
    if (!message || message.trim() === '') {
        return res.status(400).json({ success: false, message: 'Message is required.' });
    }
    
    try {
        const [result] = await db.query(
            'INSERT INTO messages (sender_id, receiver_id, message, is_read, created_at) VALUES (?, ?, ?, ?, NOW())',
            [req.userId, receiver_id || null, message.trim(), false]
        );
        
        res.json({ success: true, message: 'Message sent successfully.', id: result.insertId });
    } catch (error) {
        console.error('Send message error:', error);
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