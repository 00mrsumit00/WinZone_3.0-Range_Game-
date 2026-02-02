// // Partials/connect_db.js

// const mysql = require('mysql2');

// // Create the database connection pool
// const pool = mysql.createPool({
//     host: '127.0.0.1',
//     user: 'root',
//     password: '',
//     database: 'winzone', // Make sure this matches your DB name
//     waitForConnections: true,
//     connectionLimit: 10,
//     queueLimit: 0
// });

// Export the pool so other files (like main.js) can use it
// module.exports = pool;

const mysql = require('mysql2');

const pool = mysql.createPool({
    host: 'winzone.c9iuy0owubes.eu-north-1.rds.amazonaws.com', //
    user: 'winzone_user',                                              //
    password: 'Sumit848587',                                    //
    database: 'winzone',
    port: 3306,
    waitForConnections: true,
    connectionLimit: 10,
    connectTimeout: 20000, // 20 seconds timeout
    timezone: '+05:30'
});

// Test the connection immediately when this file loads
pool.getConnection((err, connection) => {
    if (err) {
        console.error('❌ Database Connection Failed:', err.code);
        console.error('   Error Message:', err.message);
    } else {
        console.log('✅ Successfully connected to AWS Database!');
        connection.release();
    }
});

module.exports = pool;