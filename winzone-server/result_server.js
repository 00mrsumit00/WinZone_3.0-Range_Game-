const mysql = require('mysql2/promise');
const crypto = require('crypto');
const pool = require('./db_pool');

// --- CONFIGURATION: ACTIVE GAME MODES & TYPES ---
const GAME_MODES = [5, 10, 15];
const GAME_TYPES = ['classic', 'range'];

console.log('✅ Result Server Started (Multi-Game: Classic/Range | Modes: 5, 10, 15 min).');

// --- HELPER: GET IST TIME STRING ---
function getISTString(dateObj = new Date()) {
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istDate = new Date(dateObj.getTime() + istOffset);
    return istDate.toISOString().slice(0, 19).replace('T', ' ');
}

// --- 1. ENSURE DRAWS EXIST (Gap Filler for Mode & Type) ---
async function ensureDrawsExistForMode(connection, modeMinutes) {
    const now = new Date();
    const msPerDraw = modeMinutes * 60 * 1000;

    // Calculate the most recent "Draw Time" for this specific mode
    const currentMs = now.getTime();
    const remainder = currentMs % msPerDraw;
    const lastDrawMs = currentMs - remainder;

    // Check last 2 slots to catch up on gaps
    for (let i = 0; i < 2; i++) {
        const targetMs = lastDrawMs - (i * msPerDraw);
        const targetDate = new Date(targetMs);
        const targetTimeString = getISTString(targetDate);

        // Check for BOTH game types (Classic & Range)
        for (const type of GAME_TYPES) {
            const [rows] = await connection.execute(
                "SELECT draw_id FROM draws WHERE end_time = ? AND game_mode = ? AND game_type = ?",
                [targetTimeString, modeMinutes, type]
            );

            if (rows.length === 0) {
                console.log(`💡 [${modeMinutes}m | ${type}] Creating Missing Draw: ${targetTimeString}`);
                await connection.execute(
                    "INSERT INTO draws (end_time, game_mode, game_type, winning_spot, total_collection, total_payout, is_processed) VALUES (?, ?, ?, 'PENDING', 0, 0, 0)",
                    [targetTimeString, modeMinutes, type]
                );
            }
        }
    }
}

// --- 2. PROCESS PENDING DRAWS (Per Mode) ---
async function processMode(modeMinutes) {
    let connection;
    try {
        const currentTime = getISTString();
        connection = await pool.getConnection();

        // A. Ensure draws exist for this mode (both types)
        await ensureDrawsExistForMode(connection, modeMinutes);

        // B. Process Each Game Type Separately
        for (const type of GAME_TYPES) {
            const [pendingDraws] = await connection.execute(
                `SELECT * FROM draws 
                 WHERE is_processed = 0 
                 AND game_mode = ?
                 AND game_type = ?
                 AND end_time <= ? 
                 ORDER BY end_time ASC`,
                [modeMinutes, type, currentTime]
            );

            if (pendingDraws.length > 0) {
                console.log(`⚡ [${modeMinutes}m | ${type}] Processing ${pendingDraws.length} pending draws...`);
                for (const draw of pendingDraws) {
                    await runDrawLogic(connection, draw, modeMinutes, type);
                }
            }
        }

    } catch (err) {
        console.error(`❌ Error in ${modeMinutes}m Loop:`, err.message);
    } finally {
        if (connection) connection.release();
    }
}

// --- 3. DRAW LOGIC (The Brain) ---
async function runDrawLogic(connection, draw, mode, type) {
    try {
        await connection.beginTransaction();

        // 1. Fetch Tickets
        const [tickets] = await connection.execute(
            `SELECT t.*, u.target_rtp, u.engagement_chance, u.boost_multiplier 
             FROM tickets t 
             JOIN users u ON t.user_id = u.user_id 
             WHERE t.draw_id = ? AND t.is_cancelled = 0`,
            [draw.draw_id]
        );

        let winningSpot = '';
        let chosenPayout = 0;
        let drawCollection = 0;
        let spotBets = {};

        // initialize spots based on Game Type
        if (type === 'range') {
            // Ranges: 1000+, 2000+, ..., 9000+, 0000+
            ['0000', '1000', '2000', '3000', '4000', '5000', '6000', '7000', '8000', '9000'].forEach(r => spotBets[r] = 0);
        } else {
            // Classic: A0-J9
            ['A0', 'B1', 'C2', 'D3', 'E4', 'F5', 'G6', 'H7', 'I8', 'J9'].forEach(s => spotBets[s] = 0);
        }

        // 2. Calculate Totals & Aggregate Bets
        for (const ticket of tickets) {
            drawCollection += parseFloat(ticket.total_amount);
            const betDetails = JSON.parse(ticket.bet_details);
            for (const [spot, qty] of Object.entries(betDetails)) {
                if (spotBets[spot] !== undefined) spotBets[spot] += (qty * 10);
            }
        }

        // --- 3. DECISION LOGIC ---
        const spots = Object.keys(spotBets);
        let finalResultForDb = ''; // Does not have to be the betting spot key (e.g. Range result '4523')

        // A. CHECK FOR ADMIN OVERRIDE FIRST
        if (draw.winning_spot !== 'PENDING') {
            console.log(`⚠️ ADMIN OVERRIDE DETECTED: Forcing Winner ${draw.winning_spot}`);
            winningSpot = draw.winning_spot;
            finalResultForDb = winningSpot;

            // Map Result to Betting Range (for Range Game)
            let bettingKey = winningSpot;
            if (type === 'range') {
                // Try to map full number '4523' to '4000'
                const num = parseInt(winningSpot);
                if (!isNaN(num)) {
                    bettingKey = (Math.floor(num / 1000) * 1000).toString().padStart(4, '0');
                }
            }
            chosenPayout = (spotBets[bettingKey] || 0) * 9;
        }
        else {
            // --- SMART LOGIC ---
            // Calculate Global Payout Limit (Same logic as before, shared)
            let totalAllowedPayout = 0;
            const GLOBAL_RTP = 90;
            const GLOBAL_CHANCE = 15;
            const GLOBAL_BOOST = 1.3;
            const userBoostStatus = {};

            for (const ticket of tickets) {
                const amount = parseFloat(ticket.total_amount);
                const userId = ticket.user_id;
                const userRTP = ticket.target_rtp || GLOBAL_RTP;
                const userChance = ticket.engagement_chance !== null ? ticket.engagement_chance : GLOBAL_CHANCE;
                const userBoost = ticket.boost_multiplier || GLOBAL_BOOST;

                if (userBoostStatus[userId] === undefined) {
                    const isBoosted = crypto.randomInt(1, 101) <= userChance;
                    userBoostStatus[userId] = isBoosted;
                }

                let effectiveMultiplier = userRTP / 100;
                if (userBoostStatus[userId]) effectiveMultiplier *= userBoost;
                totalAllowedPayout += (amount * effectiveMultiplier);
            }

            const maxAllowedPayout = totalAllowedPayout;
            console.log(`   🎯 [${type}] Limit: ₹${maxAllowedPayout.toFixed(2)}`);

            // --- SELECTION LOGIC ---
            // We need to pick a RESULT.
            // For Classic: Result is one of the Spots (A0...J9).
            // For Range: Result is a generic Number (0000-9999), but Payout depends on Range.

            // To support Smart Logic, we analyze the *Betting Ranges*, pick the best *Range*, and then generate a random result *within* that range.

            let goldenSpots = [];
            let silverSpots = [];
            let bronzeSpots = [];
            let minPayoutVal = Infinity;

            for (const spot of spots) { // 'spot' is '4000' or 'A0'
                const potentialPayout = spotBets[spot] * 9;
                const hasBets = spotBets[spot] > 0;

                if (potentialPayout < minPayoutVal) {
                    minPayoutVal = potentialPayout;
                    bronzeSpots = [spot];
                } else if (potentialPayout === minPayoutVal) {
                    bronzeSpots.push(spot);
                }

                if (potentialPayout <= maxAllowedPayout) {
                    if (hasBets) goldenSpots.push(spot);
                    else silverSpots.push(spot);
                }
            }

            let chosenBettingSpot = '';

            if (goldenSpots.length > 0) {
                chosenBettingSpot = goldenSpots[crypto.randomInt(0, goldenSpots.length)];
                console.log(`   -> 🥇 GOLD (${chosenBettingSpot})`);
            } else if (silverSpots.length > 0) {
                chosenBettingSpot = silverSpots[crypto.randomInt(0, silverSpots.length)];
                console.log(`   -> 🥈 SILVER (${chosenBettingSpot})`);
            } else {
                chosenBettingSpot = bronzeSpots[crypto.randomInt(0, bronzeSpots.length)];
                console.log(`   -> 🥉 BRONZE (${chosenBettingSpot})`);
            }

            chosenPayout = spotBets[chosenBettingSpot] * 9;

            // --- GENERATE FINAL DISPLAY RESULT ---
            if (type === 'range') {
                // chosenBettingSpot is e.g. "4000" (representing 4000-4999)
                // Generate a random number within this range
                const rangeStart = parseInt(chosenBettingSpot);
                const randomOffset = crypto.randomInt(0, 1000); // 0-999
                const finalNum = rangeStart + randomOffset;
                finalResultForDb = finalNum.toString().padStart(4, '0'); // "4523"
            } else {
                // Classic
                finalResultForDb = chosenBettingSpot; // "A0"
            }
        }

        // 4. Update Database
        await connection.execute(
            `UPDATE draws SET winning_spot = ?, total_collection = ?, total_payout = ?, is_processed = 1 WHERE draw_id = ?`,
            [finalResultForDb, drawCollection, chosenPayout, draw.draw_id]
        );

        // 5. Payout Users (Balance Updates)
        if (chosenPayout > 0) {
            // Fetch tickets again if we want to be safe, or iterate existing
            for (const ticket of tickets) {
                const betDetails = JSON.parse(ticket.bet_details);

                // Determine what spot this ticket bet on that matches the winner
                let winningKey = '';
                if (type === 'range') {
                    // Result '4523' -> Key '4000'
                    const num = parseInt(finalResultForDb);
                    winningKey = (Math.floor(num / 1000) * 1000).toString().padStart(4, '0');
                } else {
                    winningKey = finalResultForDb;
                }

                const qty = parseFloat(betDetails[winningKey] || 0);
                if (qty > 0) {
                    const winAmount = qty * 90;
                    await connection.execute(
                        `UPDATE users SET balance = balance + ? WHERE user_id = ?`,
                        [winAmount, ticket.user_id]
                    );
                }
            }
        }

        await connection.commit();
        console.log(`✅ [${mode}m | ${type}] Result: ${finalResultForDb} (Payout: ${chosenPayout})`);

    } catch (err) {
        console.error(`❌ Draw ${draw.draw_id} Failed:`, err.message);
        await connection.rollback();
    }
}

// --- 4. START SCHEDULERS ---
GAME_MODES.forEach(mode => {
    console.log(`🚀 Starting Scheduler for ${mode} min...`);
    processMode(mode);
    setInterval(() => processMode(mode), 10000);
});