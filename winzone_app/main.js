const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
// const pool = require(path.join(__dirname, 'Partials', 'connect_db.js'));
const bcrypt = require('bcryptjs');
const axios = require('axios');
const log = require('electron-log');

// Configure Logging
log.info('App starting...');

// 🟢 CONFIGURATION
const API_URL = "http://13.126.96.197:3000/api";

// --- IPC HANDLERS ---

// 1. LOGIN
ipcMain.handle('login', async (event, username, password) => {
    try {
        const res = await axios.post(`${API_URL}/retailer/login`, { username, password });
        return res.data;
    } catch (e) {
        console.error("Login Error:", e.message);
        return { success: false, message: "Connection Error. Check Internet or Server." };
    }
});

// 2. TICKET SUBMISSION (Updated for Game Mode & Type)
ipcMain.handle('submit-ticket', async (event, payload) => {
    try {
        // payload contains { username, ticketData, gameMode, gameType }
        const res = await axios.post(`${API_URL}/retailer/submit-ticket`, payload);
        return res.data;
    } catch (e) {
        console.error("Submit Error:", e.message);
        return { success: false, message: "Server Error during submission." };
    }
});

// 3. CLAIM PRIZE
ipcMain.handle('claim-prize', async (event, ticketId, username) => {
    try {
        const res = await axios.post(`${API_URL}/retailer/claim`, { ticketId, username }, { timeout: 10000 });
        return res.data;
    } catch (e) {
        return { success: false, message: "Connection Error" };
    }
});

// 4. GET LATEST RESULTS (Updated for Game Mode & Type)
ipcMain.handle('get-latest-results', async (event, gameMode, gameType = 'classic') => {
    try {
        // Pass gameMode and gameType as query params
        const res = await axios.get(`${API_URL}/public/results?gameMode=${gameMode}&gameType=${gameType}`);
        return res.data;
    } catch (e) {
        return { success: false, message: "Connection Error" };
    }
});

// 5. GET FILTERED RESULTS (History)
ipcMain.handle('get-filtered-results', async (event, dateString, gameMode, gameType = 'classic') => {
    try {
        // Call public results with date, gameMode, and gameType
        const res = await axios.get(`${API_URL}/public/results?date=${dateString}&gameMode=${gameMode}&gameType=${gameType}`);
        return res.data;
    } catch (e) {
        return { success: false, message: "Connection Error" };
    }
});


// 6. GET TICKET HISTORY
ipcMain.handle('get-ticket-history', async (event, username, dateString, gameMode, gameType = 'classic') => {
    try {
        // Pass gameMode and gameType in the body
        const res = await axios.post(`${API_URL}/retailer/history`, { username, date: dateString, gameMode, gameType });
        return res.data;
    } catch (e) {
        return { success: false, message: "Connection Error" };
    }
});

// 7. CANCEL TICKET
ipcMain.handle('cancel-ticket', async (event, ticketId, username) => {
    try {
        // Requires the '/api/retailer/cancel' endpoint we discussed
        const res = await axios.post(`${API_URL}/retailer/cancel`, { ticketId, username });
        return res.data;
    } catch (e) {
        return { success: false, message: "Connection Error" };
    }
});



// 8. GET ACCOUNT LEDGER
ipcMain.handle('get-account-ledger', async (event, username, startDate, endDate) => {
    try {
        // Requires the '/api/retailer/ledger' endpoint
        const res = await axios.post(`${API_URL}/retailer/ledger`, { username, startDate, endDate });
        return res.data;
    } catch (e) {
        return { success: false, message: "Connection Error" };
    }
});

// 9. GET GAME SETTINGS (Timer)
ipcMain.handle('get-game-settings', async () => {
    try {
        const res = await axios.get(`${API_URL}/settings`); // Reuse admin settings endpoint or public
        return res.data;
    } catch (e) {
        // Fallback defaults if offline
        return { success: true, settings: { draw_time_minutes: 10 } };
    }
});

// 10. CHANGE PASSWORD
ipcMain.handle('change-password', async (event, username, currentPassword, newPassword) => {
    try {
        const res = await axios.post(`${API_URL}/retailer/change-password`, {
            username,
            currentPassword,
            newPassword
        });
        return res.data;
    } catch (e) {
        return { success: false, message: "Connection Error" };
    }
});


// --- LOCAL FEATURES (No Server Needed) ---

ipcMain.on('print-ticket', (event, receiptHtml) => {
    const printWindow = new BrowserWindow({
        show: false, // Hide the window
        width: 302,  // Width of a standard 80mm thermal receipt
        webPreferences: {
        }
    });

    printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(receiptHtml)}`);

    printWindow.webContents.on('did-finish-load', () => {
        printWindow.webContents.print({
            silent: true,
            printBackground: true,
            deviceName: ''     // '' means use the default printer
        }, (success, errorType) => {
            if (!success) console.error('Printing failed:', errorType);
            printWindow.close();
        });
    });
});

// --- WINDOW MANAGEMENT ---

function createWindow() {
    const mainWindow = new BrowserWindow({
        width: 1960,
        height: 1080,
        fullscreen: true,
        autoHideMenuBar: true,
        icon: path.join(__dirname, 'icon2.png'),
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    mainWindow.loadFile(path.join(__dirname, './Renderer/index.html'));
}

app.whenReady().then(() => {
    createWindow();
    setupAutoUpdater();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// --- AUTO UPDATE LOGIC ---
function setupAutoUpdater() {
    // Auto-updater disabled - not needed for dev build
    /*
    // 1. Check for updates immediately on startup
    autoUpdater.checkForUpdatesAndNotify();

    // 2. Events
    autoUpdater.on('checking-for-update', () => {
        log.info('Checking for update...');
    });

    autoUpdater.on('update-available', (info) => {
        log.info('Update available.');
        // Optional: Send message to Dashboard to show a spinner
    });
    */
}