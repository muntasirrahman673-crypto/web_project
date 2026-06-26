const express = require('express');
const db = require('../config/database');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

// Get all equipment (public for authenticated users)
router.get('/', verifyToken, async (req, res) => {
    try {
        const [equipment] = await db.query('SELECT * FROM equipment ORDER BY name');
        res.json({ success: true, equipment });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

// Get single equipment
router.get('/:id', verifyToken, async (req, res) => {
    try {
        const [equipment] = await db.query('SELECT * FROM equipment WHERE id = ?', [req.params.id]);
        
        if (equipment.length === 0) {
            return res.status(404).json({ success: false, message: 'Equipment not found.' });
        }
        
        res.json({ success: true, equipment: equipment[0] });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error.' });
    }
});

module.exports = router;