const mysql = require('mysql2');

// 1. Create the Pool (Robust Configuration)
const pool = mysql.createPool({
    host: 'winzone-mumbai.cjwkco8y22at.ap-south-1.rds.amazonaws.com',
    user: 'winzone_user',
    password: 'Sumit848587',
    database: 'winzone',
    port: 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    connectTimeout: 60000,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
    dateStrings: true,     // Return dates as strings
    typeCast: function (field, next) {
        if (field.type === 'BIT' && field.length === 1) {
            var bit = field.buffer();
            return (bit === null) ? null : bit[0] === 1;
        }
        return next();
    }
});

// 2. Test Connection on Load
pool.getConnection((err, connection) => {
    if (err) {
        console.error('❌ POOL ERROR:', err.message);
    } else {
        console.log('✅ DATABASE POOL CONNECTED SUCCESSFULLY');
        connection.release();
    }
});

// 3. Export
module.exports = pool.promise();
