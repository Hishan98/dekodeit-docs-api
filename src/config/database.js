const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'dekodeit_docs',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 50,          // cap queued requests — prevents memory exhaustion under load
  connectTimeout: 10000,   // 10s connection timeout
  enableKeepAlive: true,
  keepAliveInitialDelay: 30000,
});

// Test connection and run safe migrations
pool.getConnection()
  .then(async (connection) => {
    console.log('Database connected successfully');
    // Make customer_id nullable so customers can be deleted while keeping
    // linked invoices/proposals/projects as unassigned records.
    const migrations = [
      'ALTER TABLE projects  MODIFY COLUMN customer_id INT NULL',
      'ALTER TABLE invoices  MODIFY COLUMN customer_id INT NULL',
      'ALTER TABLE proposals MODIFY COLUMN customer_id INT NULL',
      "ALTER TABLE customers ADD COLUMN IF NOT EXISTS status ENUM('active','inactive','archived') NOT NULL DEFAULT 'active'",
      'CREATE INDEX IF NOT EXISTS idx_customers_status ON customers (status)',
    ];
    for (const sql of migrations) {
      try { await connection.execute(sql); } catch (_) { /* already applied */ }
    }
    connection.release();
  })
  .catch(err => {
    console.error('Database connection error:', err);
  });

module.exports = pool;

