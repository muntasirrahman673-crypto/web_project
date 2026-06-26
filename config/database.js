const mysql = require('mysql2/promise');
require('dotenv').config();

// Create connection pool
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'lab_management_systems',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Test the connection
async function testConnection() {
    try {
        const connection = await pool.getConnection();
        console.log('✅ Database connected successfully to:', process.env.DB_NAME || 'lab_management_systems');
        connection.release();
        return true;
    } catch (error) {
        console.error('❌ Database connection failed:', error.message);
        console.error('Please check:');
        console.error('  1. MySQL is running');
        console.error('  2. Database credentials in .env file are correct');
        console.error('  3. lab_management_systems" exists');
        return false;
    }
}

// Test connection on module load
testConnection();

module.exports = pool;