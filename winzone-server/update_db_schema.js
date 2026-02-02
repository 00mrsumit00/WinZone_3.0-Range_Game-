const pool = require('./db_pool');

async function updateSchema() {
    console.log("🔄 Starting Database Schema Update...");
    const connection = await pool.getConnection();

    try {
        // 1. Update TASKS table
        /*
        try {
             await connection.query("ALTER TABLE draws ADD COLUMN game_type VARCHAR(50) DEFAULT 'classic'");
             console.log("✅ Added 'game_type' column to 'draws' table.");
        } catch (e) {
            if (e.code === 'ER_DUP_FIELDNAME') console.log("ℹ️ 'game_type' column already exists in 'draws'. Skipping.");
            else console.error("❌ Error updating 'draws':", e.message);
        }
        */

        // We use direct query executions

        // TABLE: DRAWS
        try {
            await connection.query("ALTER TABLE draws ADD COLUMN game_type VARCHAR(50) DEFAULT 'classic'");
            console.log("✅ Added column: game_type to table: draws");
        } catch (err) {
            if (err.code === 'ER_DUP_FIELDNAME') {
                console.log("ℹ️ Column 'game_type' already exists in 'draws'");
            } else {
                console.error("❌ Error updating draws:", err.message);
            }
        }

        // TABLE: TICKETS
        try {
            await connection.query("ALTER TABLE tickets ADD COLUMN game_type VARCHAR(50) DEFAULT 'classic'");
            console.log("✅ Added column: game_type to table: tickets");
        } catch (err) {
            if (err.code === 'ER_DUP_FIELDNAME') {
                console.log("ℹ️ Column 'game_type' already exists in 'tickets'");
            } else {
                console.error("❌ Error updating tickets:", err.message);
            }
        }

        console.log("\n✨ Database Schema Update Complete!");

    } catch (err) {
        console.error("❌ Fatal Error:", err);
    } finally {
        connection.release();
        process.exit();
    }
}

updateSchema();
