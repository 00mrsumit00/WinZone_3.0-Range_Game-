const path = require('path');
const express = require('express');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const bodyParser = require('body-parser');
const session = require('express-session');
const cors = require('cors');
const pool = require('./db_pool'); // Uses your existing db_pool.js

// --- CONFIGURATION ---
const PORT = process.env.PORT || 3000;

// --- 🕒 OPERATING HOURS LOGIC (IST) ---
function isShopOpen() {
    // return true;
    const now = new Date();
    const istString = now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
    const istDate = new Date(istString);
    const currentHour = istDate.getHours();
    // Open from 6:00 AM to 11: 59 PM
    if (currentHour >= 6 && currentHour <= 23) {
        return true;
    }
    return false;
}

// --- HELPER: Format Date to MySQL String (IST) ---
function toMysqlDateTime(dateInput) {
    const date = new Date(dateInput);
    // Add 5.5 hours (IST Offset)
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istDate = new Date(date.getTime() + istOffset);

    // Format: YYYY-MM-DD HH:MM:SS
    return istDate.toISOString().slice(0, 19).replace('T', ' ');
}


// --- SETUP APP ---
const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/updates', express.static(path.join(__dirname, 'public/updates')));

app.use(session({
    secret: 'super_secure_winzone_live_key',
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 3600000 }
}));

// --- MIDDLEWARE ---
function requireAdmin(req, res, next) {
    if (req.session.isAdmin) next();
    else res.status(401).json({ success: false, message: 'Unauthorized' });
}

// ==========================================
// 1. RETAILER API 
// ==========================================


// 3.---- Login -----
app.post('/api/retailer/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const [rows] = await pool.execute("SELECT * FROM users WHERE username = ?", [username]);
        if (rows.length > 0) {
            const user = rows[0];
            const isMatch = await bcrypt.compare(password, user.password_hash);
            if (isMatch) {
                if (!user.is_active) return res.json({ success: false, message: 'Account Blocked' });
                delete user.password_hash;
                return res.json({ success: true, user: user });
            }
        }
        res.json({ success: false, message: 'Invalid Credentials' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
});

// Submit Ticket (Multi-Mode Support)
app.post('/api/retailer/submit-ticket', async (req, res) => {
    if (!isShopOpen()) {
        return res.json({ success: false, message: 'Shop is Closed! Hours: 6AM - 12AM' });
    }

    // ✅ Get gameMode AND gameType from request
    const { username, ticketData, gameMode = 5, gameType = 'classic' } = req.body;

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        // 1. Get User & Lock Row
        const [rows] = await connection.execute("SELECT user_id, balance FROM users WHERE username = ? FOR UPDATE", [username]);
        const user = rows[0];

        // 2. Calc Balance
        const commissionRate = 0.09;
        const deduction = ticketData.totalAmount - (ticketData.totalAmount * commissionRate);
        const newBalance = user.balance - deduction;

        if (newBalance < 0) {
            await connection.rollback();
            return res.json({ success: false, message: 'Insufficient balance!' });
        }

        // 3. Get/Create Draw (Specific to Game Mode & Type)
        const formattedDrawTime = toMysqlDateTime(ticketData.drawEndTime);

        // ✅ Check for draw with specific GAME MODE & TYPE
        let [drawRows] = await connection.execute(
            "SELECT draw_id FROM draws WHERE end_time = ? AND game_mode = ? AND game_type = ?",
            [formattedDrawTime, gameMode, gameType]
        );

        let draw_id;

        if (drawRows.length > 0) {
            draw_id = drawRows[0].draw_id;
        } else {
            // ✅ Create draw with specific GAME MODE & TYPE
            const [insert] = await connection.execute(
                "INSERT INTO draws (end_time, game_mode, game_type, winning_spot, total_collection, total_payout, is_processed) VALUES (?, ?, ?, 'PENDING', 0, 0, 0)",
                [formattedDrawTime, gameMode, gameType]
            );
            draw_id = insert.insertId;
        }

        // 4. Insert Ticket (Save Game Mode & Type)
        const currentIstTime = toMysqlDateTime(new Date());

        // ✅ Save game_mode & game_type in tickets table
        const [ticketResult] = await connection.execute(
            "INSERT INTO tickets (draw_id, user_id, bet_details, total_amount, game_mode, game_type, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
            [draw_id, user.user_id, JSON.stringify(ticketData.betDetails), ticketData.totalAmount, gameMode, gameType, currentIstTime]
        );

        // 4.5 Update Draw Collection
        await connection.execute(
            "UPDATE draws SET total_collection = total_collection + ? WHERE draw_id = ?",
            [ticketData.totalAmount, draw_id]
        );

        // 5. Update Balance
        await connection.execute("UPDATE users SET balance = ? WHERE user_id = ?", [newBalance, user.user_id]);
        await connection.commit();

        res.json({
            success: true,
            message: 'Ticket Confirmed!',
            newBalance: newBalance,
            newTicketId: ticketResult.insertId,
            drawId: draw_id
        });

    } catch (err) {
        await connection.rollback();
        console.error(err);
        res.json({ success: false, message: 'Transaction Failed' });
    } finally {
        connection.release();
    }
});



// --- 5. CLAIM PRIZE (OPTIMIZED: NO PRE-LOCK ON USER) ---
app.post('/api/retailer/claim', async (req, res) => {
    const { ticketId, username } = req.body;
    const connection = await pool.getConnection();

    try {
        // 1. Get User ID (No Lock yet - Fast Read)
        const [users] = await connection.execute("SELECT user_id FROM users WHERE username = ?", [username]);
        if (users.length === 0) {
            connection.release();
            return res.json({ success: false, message: 'User not found' });
        }
        const userId = users[0].user_id;

        await connection.beginTransaction();

        // 2. Lock ONLY the Ticket Row (Prevents Double Claim)
        const [ticketRows] = await connection.execute(
            "SELECT * FROM tickets WHERE ticket_id = ? AND user_id = ? FOR UPDATE",
            [ticketId, userId]
        );

        if (ticketRows.length === 0) {
            await connection.rollback();
            return res.json({ success: false, message: 'Invalid Ticket' });
        }
        const ticket = ticketRows[0];

        // 3. Check Claim Status
        if (ticket.is_claimed) {
            await connection.rollback();
            return res.json({ success: false, message: 'Ticket already claimed!' });
        }

        if (ticket.is_cancelled) {
            await connection.rollback();
            return res.json({ success: false, message: 'Ticket is Cancelled!' });
        }

        // 4. Get Draw Info
        const [drawRows] = await connection.execute(
            "SELECT winning_spot, DATE_FORMAT(end_time, '%Y-%m-%d %H:%i:%s') as draw_end_str FROM draws WHERE draw_id = ?",
            [ticket.draw_id]
        );

        if (drawRows.length === 0) {
            await connection.rollback();
            return res.json({ success: false, message: 'Draw not found' });
        }
        const draw = drawRows[0];

        // 5. Time Gate Check
        const now = new Date();
        const istOffset = 5.5 * 60 * 60 * 1000;
        const currentTimeStr = new Date(now.getTime() + istOffset).toISOString().slice(0, 19).replace('T', ' ');

        if (currentTimeStr < draw.draw_end_str) {
            await connection.rollback();
            return res.json({ success: false, message: 'Draw Running... Please Wait!' });
        }

        // 6. Verify Win & Update
        const betDetails = JSON.parse(ticket.bet_details);
        const winQty = parseFloat(betDetails[draw.winning_spot] || 0);

        if (winQty > 0) {
            const winAmount = winQty * 90;

            // A. Mark Ticket as Claimed
            await connection.execute("UPDATE tickets SET is_claimed = 1 WHERE ticket_id = ?", [ticketId]);

            // B. Add Balance (Atomic Update - No Lock Needed)
            await connection.execute("UPDATE users SET balance = balance + ? WHERE user_id = ?", [winAmount, userId]);

            // C. Commit Transaction
            await connection.commit();

            // D. Fetch New Balance for Display (Read After Commit)
            const [balanceRows] = await connection.execute("SELECT balance FROM users WHERE user_id = ?", [userId]);
            const newBalance = parseFloat(balanceRows[0].balance).toFixed(2);

            res.json({
                success: true,
                message: `🎉 Claimed ₹${winAmount}!`,
                data: {
                    winAmount: winAmount,
                    ticketId: ticket.ticket_id,
                    spot: draw.winning_spot,
                    qty: winQty,
                    newBalance: newBalance
                }
            });
        } else {
            await connection.rollback();
            res.json({ success: false, message: 'Better luck next time!' });
        }

    } catch (err) {
        console.error("Claim Error:", err);
        if (connection) await connection.rollback();
        res.json({ success: false, message: 'Server Error' });
    } finally {
        if (connection) connection.release();
    }
});


// Get Public Results (Filtered by Mode AND Time)
app.get('/api/public/results', async (req, res) => {
    try {
        const gameMode = req.query.gameMode || 5;
        const gameType = req.query.gameType || 'classic'; // ✅ Default to classic

        // 1. Get Current IST Time (To match your DB timezone)
        const now = new Date();
        const istOffset = 5.5 * 60 * 60 * 1000;
        const istDate = new Date(now.getTime() + istOffset);
        const currentTimeStr = istDate.toISOString().slice(0, 19).replace('T', ' ');

        // 2. Updated Query: Check Game Mode AND Time AND Game Type
        const [rows] = await pool.execute(
            `SELECT draw_id, winning_spot, DATE_FORMAT(end_time, '%Y-%m-%d %H:%i:%s') as end_time 
            FROM draws 
            WHERE winning_spot != 'PENDING' 
            AND game_mode = ? 
            AND game_type = ? 
            AND end_time <= ? 
            ORDER BY end_time DESC LIMIT 7`,
            [gameMode, gameType, currentTimeStr] // ✅ Pass gameType
        );

        res.json({ success: true, results: rows });
    } catch (err) {
        console.error(err);
        res.json({ success: false });
    }
});

// Ticket History (Filtered by Mode)
app.post('/api/retailer/history', async (req, res) => {
    const { username, date, gameMode, gameType = 'classic' } = req.body; // ✅ Accept gameMode & gameType
    try {
        const [users] = await pool.execute("SELECT user_id FROM users WHERE username = ?", [username]);
        if (!users.length) return res.json({ success: false, message: 'User not found' });
        const userId = users[0].user_id;

        let sql = `
            SELECT t.ticket_id, t.draw_id, t.bet_details, t.total_amount, 
            DATE_FORMAT(t.created_at, '%Y-%m-%d %H:%i:%s') as created_at, 
            DATE_FORMAT(d.end_time, '%Y-%m-%d %H:%i:%s') as end_time
            FROM tickets t
            JOIN draws d ON t.draw_id = d.draw_id
            WHERE t.user_id = ? AND t.is_cancelled = 0
        `;
        const params = [userId];

        // ✅ Filter by Game Mode if provided
        if (gameMode) {
            sql += ` AND t.game_mode = ?`;
            params.push(gameMode);
        }

        // ✅ Filter by Game Type if provided
        if (gameType) {
            sql += ` AND t.game_type = ?`;
            params.push(gameType);
        }

        if (date) {
            sql += ` AND DATE(t.created_at) = ?`;
            params.push(date);
        }
        sql += ` ORDER BY t.created_at DESC`;

        const [rows] = await pool.execute(sql, params);
        res.json({ success: true, tickets: rows });
    } catch (e) {
        console.error(e);
        res.json({ success: false, message: 'Server Error' });
    }
});

// --- 5. CANCEL TICKET ---
app.post('/api/retailer/cancel', async (req, res) => {
    const { ticketId, username } = req.body;
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        // Check User
        const [users] = await connection.execute("SELECT user_id, balance FROM users WHERE username = ? FOR UPDATE", [username]);
        const user = users[0];

        // Check Ticket
        const [tickets] = await connection.execute(`
            SELECT t.*, d.end_time FROM tickets t 
            JOIN draws d ON t.draw_id = d.draw_id
            WHERE t.ticket_id = ? AND t.user_id = ?
        `, [ticketId, user.user_id]);

        if (!tickets.length) { await connection.rollback(); return res.json({ success: false, message: "Ticket not found" }); }
        const ticket = tickets[0];

        if (ticket.is_cancelled) { await connection.rollback(); return res.json({ success: false, message: "Already cancelled" }); }

        // Time Check (Server Side = Secure)
        const [timeRows] = await connection.execute(`SELECT DATE_FORMAT(DATE_ADD(UTC_TIMESTAMP(), INTERVAL '05:30' HOUR_MINUTE), '%Y-%m-%d %H:%i:%s') as ist`);
        const serverTime = new Date(timeRows[0].ist);
        const drawTime = new Date(ticket.end_time);

        if ((drawTime - serverTime) < 60000) { // Less than 1 min
            await connection.rollback();
            return res.json({ success: false, message: "Time over! Cannot cancel." });
        }

        // Refund
        const newBalance = parseFloat(user.balance) + parseFloat(ticket.total_amount);
        await connection.execute("UPDATE users SET balance = ? WHERE user_id = ?", [newBalance, user.user_id]);
        await connection.execute("UPDATE tickets SET is_cancelled = 1 WHERE ticket_id = ?", [ticketId]);

        await connection.commit();
        res.json({ success: true, message: "Cancelled Successfully", newBalance: newBalance });

    } catch (e) {
        await connection.rollback();
        res.json({ success: false, message: "Server Error" });
    } finally {
        connection.release();
    }
});

// --- 6. ACCOUNT LEDGER ---
app.post('/api/retailer/ledger', async (req, res) => {
    const { username, startDate, endDate } = req.body;
    try {
        const [users] = await pool.execute("SELECT user_id FROM users WHERE username = ?", [username]);
        if (!users.length) return res.json({ success: false });
        const userId = users[0].user_id;

        let sql = `
            SELECT DATE(t.created_at) as sale_date, t.total_amount, t.bet_details, d.winning_spot, t.is_claimed
            FROM tickets t JOIN draws d ON t.draw_id = d.draw_id
            WHERE t.user_id = ? AND t.is_cancelled = 0
        `;
        const params = [userId];
        if (startDate && endDate) {
            sql += ` AND DATE(t.created_at) BETWEEN ? AND ?`;
            params.push(startDate, endDate);
        }
        sql += ` ORDER BY t.created_at DESC`;

        const [rows] = await pool.execute(sql, params);

        // Group Data by Date
        const ledgerMap = {};
        rows.forEach(row => {
            const dateKey = new Date(row.sale_date).toISOString().split('T')[0];
            if (!ledgerMap[dateKey]) {
                ledgerMap[dateKey] = { date: dateKey, totalSale: 0, totalWinning: 0 };
            }
            ledgerMap[dateKey].totalSale += parseFloat(row.total_amount);

            // Only add winning if claimed
            if (row.winning_spot && row.winning_spot !== 'PENDING' && row.is_claimed) {
                const bets = JSON.parse(row.bet_details);
                if (bets[row.winning_spot]) {
                    ledgerMap[dateKey].totalWinning += (bets[row.winning_spot] * 90);
                }
            }
        });

        res.json({ success: true, data: Object.values(ledgerMap).sort((a, b) => new Date(b.date) - new Date(a.date)) });

    } catch (e) {
        console.error(e);
        res.json({ success: false, message: 'Server Error' });
    }
});

// --- 7. CHANGE PASSWORD ---
app.post('/api/retailer/change-password', async (req, res) => {
    const { username, currentPassword, newPassword } = req.body;

    // 1. Server-side Validation
    if (!newPassword || newPassword.length < 6) {
        return res.json({ success: false, message: 'New password must be at least 6 characters.' });
    }

    try {
        const [rows] = await pool.execute("SELECT * FROM users WHERE username = ?", [username]);
        if (rows.length === 0) return res.json({ success: false, message: 'User not found' });

        const user = rows[0];

        // 2. Verify CURRENT Password (Security Check)
        const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
        if (!isMatch) {
            return res.json({ success: false, message: 'Incorrect Current Password' });
        }

        // 3. Hash NEW Password (Same logic as create_hash.js)
        const newHash = await bcrypt.hash(newPassword, 10);

        // 4. Update Database
        await pool.execute("UPDATE users SET password_hash = ? WHERE user_id = ?", [newHash, user.user_id]);

        res.json({ success: true, message: 'Password updated successfully!' });

    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
});


// ==========================================
// 2. ADMIN API
// ==========================================

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const [rows] = await pool.execute('SELECT * FROM users WHERE username = ? AND role = "admin"', [username]);
        if (rows.length > 0) {
            const user = rows[0];
            const match = await bcrypt.compare(password, user.password_hash);
            if (match) {
                req.session.isAdmin = true;
                return res.json({ success: true });
            }
        }
        res.json({ success: false, message: 'Invalid credentials' });
    } catch (err) { res.status(500).json({ success: false }); }
});

app.get('/api/stats', requireAdmin, async (req, res) => {
    try {
        const [users] = await pool.execute('SELECT COUNT(*) as count FROM users WHERE role="retailer"');
        const [sales] = await pool.execute(`SELECT SUM(total_amount) as total FROM tickets WHERE DATE(created_at) = CURDATE()`);
        const [payouts] = await pool.execute(`SELECT SUM(total_payout) as total FROM draws WHERE DATE(end_time) = CURDATE() AND is_processed = 1`);

        const totalSales = parseFloat(sales[0].total || 0);
        const totalPayout = parseFloat(payouts[0].total || 0);

        res.json({
            success: true,
            totalUsers: users[0].count,
            todaySale: totalSales,
            todayProfit: totalSales - totalPayout,
            nextDraw: "Running..."
        });
    } catch (err) { res.status(500).json({ success: false }); }
});

app.post('/api/add-balance', requireAdmin, async (req, res) => {
    const { userId, amount } = req.body;
    await pool.execute('UPDATE users SET balance = balance + ? WHERE user_id = ?', [amount, userId]);
    res.json({ success: true });
});

app.post('/api/create-user', requireAdmin, async (req, res) => {
    const { username, password, store_address, contact_no } = req.body;
    const hash = await bcrypt.hash(password, 10);
    try {
        await pool.execute(
            'INSERT INTO users (username, password_hash, role, balance, is_active, store_address, contact_no) VALUES (?, ?, "retailer", 0, 1, ?, ?)',
            [username, hash, store_address, contact_no]
        );
        res.json({ success: true });
    } catch (e) { res.json({ success: false, message: 'Error' }); }
});

app.get('/api/settings', async (req, res) => {
    const [rows] = await pool.execute('SELECT * FROM game_settings WHERE id = 1');
    res.json({ success: true, settings: rows[0] });
});

app.post('/api/settings', requireAdmin, async (req, res) => {
    const { draw_time, profit_min, profit_max, target_percent } = req.body;
    try {
        await pool.execute(
            'UPDATE game_settings SET draw_time_minutes=?, profit_min=?, profit_max=?, target_percent=? WHERE id=1',
            [draw_time, profit_min, profit_max, target_percent]
        );
        res.json({ success: true });
    } catch (err) { res.status(500).json({ success: false }); }
});

app.get('/api/users', requireAdmin, async (req, res) => {
    try {
        const [rows] = await pool.execute(`SELECT user_id, username, balance, role, is_active, created_at FROM users WHERE role="retailer" ORDER BY user_id DESC`);
        res.json({ success: true, users: rows });
    } catch (err) { res.status(500).json({ success: false }); }
});

// Admin Draw History (Filtered by Mode)
app.get('/api/draw-history', requireAdmin, async (req, res) => {
    try {
        const { date, gameMode } = req.query; // ✅ Accept gameMode

        let query = `SELECT draw_id, winning_spot, total_collection, total_payout, is_processed, DATE_FORMAT(end_time, '%Y-%m-%d %H:%i:%s') as end_time FROM draws WHERE is_processed = 1`;
        const params = [];

        // ✅ Filter by Mode
        if (gameMode) {
            query += ' AND game_mode = ?';
            params.push(gameMode);
        }

        if (date) {
            query += ' AND DATE(end_time) = ?';
            params.push(date);
        }
        query += ' ORDER BY end_time DESC';
        const [rows] = await pool.execute(query, params);
        res.json({ success: true, results: rows });
    } catch (err) { res.status(500).json({ success: false }); }
});

app.post('/api/toggle-user', requireAdmin, async (req, res) => {
    const { userId, status } = req.body;
    try {
        await pool.execute('UPDATE users SET is_active = ? WHERE user_id = ?', [status, userId]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ success: false }); }
});

// --- NEW: Update User Specific RTP ---
app.post('/api/update-user-rtp', requireAdmin, async (req, res) => {
    const { userId, rtp } = req.body;
    try {
        await pool.execute("UPDATE users SET target_rtp = ? WHERE user_id = ?", [rtp, userId]);
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Database Error" });
    }
});

// --- UPDATE USER GAME SETTINGS (RTP + Engagement) ---
app.post('/api/update-user-settings', requireAdmin, async (req, res) => {
    const { userId, target_rtp, engagement_chance, boost_multiplier } = req.body;
    try {
        await pool.execute(
            "UPDATE users SET target_rtp = ?, engagement_chance = ?, boost_multiplier = ? WHERE user_id = ?",
            [target_rtp, engagement_chance, boost_multiplier, userId]
        );
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Database Error" });
    }
});

// --- SERVE PAGES ---
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/admin_dashboard', (req, res) => {
    if (req.session.isAdmin) res.sendFile(path.join(__dirname, 'views', 'admin_dashboard.html'));
    else res.redirect('/');
});

app.get('/api/check-session', (req, res) => {
    res.json({ loggedIn: !!req.session.isAdmin });
});

app.post('/api/logout', (req, res) => {
    req.session.destroy(() => {
        res.clearCookie('connect.sid');
        res.json({ success: true });
    });
});

// --- FORCE WINNER ENDPOINT ---
app.post('/api/force-winner', requireAdmin, async (req, res) => {
    const { spot, gameMode = 5, gameType = 'classic' } = req.body; // ✅ Accept gameType

    // Basic Validation (Expanded for Range Game if needed, or remove for flexibility)
    // if (!['A0', 'B1', 'C2', 'D3', 'E4', 'F5', 'G6', 'H7', 'I8', 'J9'].includes(spot)) {
    //    return res.json({ success: false, message: 'Invalid Spot Name' });
    // }

    try {
        // 1. Calculate the current/next draw time based on Game Mode
        const now = new Date();
        const durationMs = gameMode * 60 * 1000;
        const currentMs = now.getTime();
        const remainder = currentMs % durationMs;
        const nextDrawMs = (currentMs - remainder) + durationMs;

        // Format to MySQL Date String
        const istOffset = 5.5 * 60 * 60 * 1000;
        const nextDrawDate = new Date(nextDrawMs + istOffset);
        const drawTimeStr = nextDrawDate.toISOString().slice(0, 19).replace('T', ' ');

        // 2. Check if draw exists (with game_type)
        const [rows] = await pool.execute(
            "SELECT * FROM draws WHERE end_time = ? AND game_mode = ? AND game_type = ?",
            [drawTimeStr, gameMode, gameType]
        );

        if (rows.length > 0) {
            const draw = rows[0];
            if (draw.is_processed) {
                return res.json({ success: false, message: 'Draw already finished! Cannot override.' });
            }
            // UPDATE existing draw
            await pool.execute(
                "UPDATE draws SET winning_spot = ? WHERE draw_id = ?",
                [spot, draw.draw_id]
            );
        } else {
            // INSERT new draw with forced spot (Pending processing) - Save Game Type
            await pool.execute(
                "INSERT INTO draws (end_time, game_mode, game_type, winning_spot, total_collection, total_payout, is_processed) VALUES (?, ?, ?, ?, 0, 0, 0)",
                [drawTimeStr, gameMode, gameType, spot]
            );
        }

        res.json({ success: true, message: `Next Result Set to: ${spot} for ${drawTimeStr}` });

    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
});

// --- NEW: Get Single User Details + Lifetime Stats ---
app.get('/api/user-details/:id', requireAdmin, async (req, res) => {
    try {
        const userId = req.params.id;

        // 1. Get User Profile
        const [userRows] = await pool.execute(
            "SELECT user_id, username, balance, role, is_active, contact_no, store_address, created_at, target_rtp, engagement_chance, boost_multiplier FROM users WHERE user_id = ?",
            [userId]
        );
        if (userRows.length === 0) return res.json({ success: false, message: "User not found" });

        // 2. Get Lifetime Sales (Total Tickets Sold)
        const [ticketRows] = await pool.execute(
            "SELECT SUM(total_amount) as lifetime_sales FROM tickets WHERE user_id = ? AND is_cancelled = 0",
            [userId]
        );

        res.json({
            success: true,
            user: userRows[0],
            stats: {
                lifetimeSales: parseFloat(ticketRows[0].lifetime_sales || 0)
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false });
    }
});

// --- NEW: Clear User Balance ---
app.post('/api/clear-balance', requireAdmin, async (req, res) => {
    const { userId } = req.body;
    try {
        // Set balance to 0 directly
        await pool.execute("UPDATE users SET balance = 0.00 WHERE user_id = ?", [userId]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});

// --- ADMIN LEDGER API ---
app.get('/api/admin/ledger', requireAdmin, async (req, res) => {
    const { userId, startDate, endDate } = req.query;
    try {
        let sql = `
            SELECT DATE(t.created_at) as date, 
                   SUM(t.total_amount) as totalSale,
                   SUM(CASE 
                       WHEN d.winning_spot != 'PENDING' AND t.is_claimed = 1 THEN
                           JSON_UNQUOTE(JSON_EXTRACT(t.bet_details, CONCAT('$."', d.winning_spot, '"'))) * 90
                       ELSE 0 
                   END) as totalWinning
            FROM tickets t 
            JOIN draws d ON t.draw_id = d.draw_id
            WHERE t.user_id = ? AND t.is_cancelled = 0
        `;
        const params = [userId];

        if (startDate && endDate) {
            sql += ` AND DATE(t.created_at) BETWEEN ? AND ?`;
            params.push(startDate, endDate);
        }

        sql += ` GROUP BY DATE(t.created_at) ORDER BY date DESC`;

        const [rows] = await pool.execute(sql, params);
        res.json({ success: true, ledger: rows });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false });
    }
});

// --- NEW: ANALYTICS ENDPOINT ---
app.get('/api/analytics', requireAdmin, async (req, res) => {
    try {
        // 1. Weekly Revenue (Last 7 Days)
        const [weeklyData] = await pool.execute(`
            SELECT DATE(created_at) as date, SUM(total_amount) as sales
            FROM tickets
            WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
            GROUP BY DATE(created_at)
            ORDER BY date ASC
        `);

        // Calculate weekly revenue and profit
        let weeklyRevenue = 0;
        let weeklyProfit = 0;
        const salesData = [];

        for (const row of weeklyData) {
            weeklyRevenue += parseFloat(row.sales || 0);

            // Get payouts for this date
            const [payoutData] = await pool.execute(`
                SELECT SUM(total_payout) as payout
                FROM draws
                WHERE DATE(end_time) = ? AND is_processed = 1
            `, [row.date]);

            const payout = parseFloat(payoutData[0]?.payout || 0);
            const profit = parseFloat(row.sales) - payout;
            weeklyProfit += profit;

            salesData.push({
                date: row.date,
                sales: parseFloat(row.sales),
                profit: profit
            });
        }

        // 2. Average Daily Profit (Last 30 Days)
        const [profitData] = await pool.execute(`
            SELECT 
                SUM(t.total_amount) as totalSales,
                (SELECT SUM(total_payout) FROM draws WHERE DATE(end_time) >= DATE_SUB(CURDATE(), INTERVAL 30 DAY) AND is_processed = 1) as totalPayout
            FROM tickets t
            WHERE t.created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
        `);

        const totalSales = parseFloat(profitData[0]?.totalSales || 0);
        const totalPayout = parseFloat(profitData[0]?.totalPayout || 0);
        const avgDailyProfit = (totalSales - totalPayout) / 30;

        // 3. Game Mode Distribution (Today)
        const [modeData] = await pool.execute(`
            SELECT game_mode, COUNT(*) as count
            FROM tickets
            WHERE DATE(created_at) = CURDATE()
            GROUP BY game_mode
        `);

        const totalTickets = modeData.reduce((sum, row) => sum + row.count, 0);
        const modeDistribution = {};
        modeData.forEach(row => {
            const percentage = totalTickets > 0 ? ((row.count / totalTickets) * 100).toFixed(1) : 0;
            modeDistribution[`${row.game_mode} Min`] = parseFloat(percentage);
        });

        // Ensure all modes are represented
        ['5 Min', '10 Min', '15 Min'].forEach(mode => {
            if (!modeDistribution[mode]) {
                modeDistribution[mode] = 0;
            }
        });

        // 4. Hourly Pattern (Today)
        const [hourlyData] = await pool.execute(`
            SELECT HOUR(created_at) as hour, SUM(total_amount) as sales
            FROM tickets
            WHERE DATE(created_at) = CURDATE()
            GROUP BY HOUR(created_at)
            ORDER BY hour ASC
        `);

        const hourlyPattern = new Array(24).fill(0);
        hourlyData.forEach(row => {
            hourlyPattern[row.hour] = parseFloat(row.sales || 0);
        });

        // 5. Top Retailers (Last 7 Days)
        const [retailerData] = await pool.execute(`
            SELECT u.username as name, SUM(t.total_amount) as sales
            FROM tickets t
            JOIN users u ON t.user_id = u.user_id
            WHERE t.created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
            GROUP BY t.user_id
            ORDER BY sales DESC
            LIMIT 5
        `);

        const topRetailers = retailerData.map(row => ({
            name: row.name,
            sales: parseFloat(row.sales || 0)
        }));

        res.json({
            success: true,
            weeklyRevenue,
            avgDailyProfit,
            salesData,
            modeDistribution,
            hourlyPattern,
            topRetailers
        });

    } catch (err) {
        console.error('Analytics Error:', err);
        res.status(500).json({ success: false, message: 'Analytics error' });
    }
});

// --- SERVE ADMIN DASHBOARD V2 ---
app.get('/admin_dashboard_v2', (req, res) => {
    if (req.session.isAdmin) res.sendFile(path.join(__dirname, 'views', 'admin_dashboard_v2.html'));
    else res.redirect('/');
});

app.listen(PORT, () => {
    console.log(`🚀 API Server running on port ${PORT}`);
});

