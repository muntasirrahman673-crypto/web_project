const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

// Import routes
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const researcherRoutes = require('./routes/researcher');
const studentRoutes = require('./routes/student');
const supervisorRoutes = require('./routes/supervisor');
const equipmentRoutes = require('./routes/equipment');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/researcher', researcherRoutes);
app.use('/api/student', studentRoutes);
app.use('/api/supervisor', supervisorRoutes);
app.use('/api/equipment', equipmentRoutes);

// Test route
app.get('/api/test', (req, res) => {
    res.json({ 
        success: true, 
        message: 'API is working!', 
        timestamp: new Date(),
        endpoints: {
            auth: '/api/auth',
            admin: '/api/admin',
            researcher: '/api/researcher',
            student: '/api/student',
            supervisor: '/api/supervisor',
            equipment: '/api/equipment'
        }
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err.stack);
    res.status(500).json({ 
        success: false, 
        message: 'Something went wrong!',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ 
        success: false, 
        message: `Route not found: ${req.method} ${req.url}` 
    });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`✅ Server running on http://localhost:${PORT}`);
    console.log(`📝 Test API: http://localhost:${PORT}/api/test`);
    console.log(`🔐 Auth API: http://localhost:${PORT}/api/auth`);
    console.log(`👑 Admin API: http://localhost:${PORT}/api/admin`);
    console.log(`🔬 Researcher API: http://localhost:${PORT}/api/researcher`);
    console.log(`🎓 Student API: http://localhost:${PORT}/api/student`);
    console.log(`👔 Supervisor API: http://localhost:${PORT}/api/supervisor`);
    console.log(`🔧 Equipment API: http://localhost:${PORT}/api/equipment`);
});