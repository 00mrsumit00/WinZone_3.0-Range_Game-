// ================================
// ULTIMATE ADMIN DASHBOARD JS
// ================================

// Utility Functions
function formatDBTime(dbTime) {
    if (!dbTime) return "00:00 AM";
    let match = dbTime.toString().match(/(\d{2}):(\d{2}):(\d{2})/);
    if (match) {
        let h = parseInt(match[1]);
        let m = match[2];
        let ampm = h >= 12 ? 'PM' : 'AM';
        h = h % 12;
        h = h ? h : 12;
        return `${h.toString().padStart(2, '0')}:${m} ${ampm}`;
    }
    return dbTime;
}

function formatCurrency(amount) {
    return `₹${parseFloat(amount).toFixed(2)}`;
}

function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 16px 24px;
        background: ${type === 'success' ? '#10b981' : '#ef4444'};
        color: white;
        border-radius: 12px;
        box-shadow: 0 10px 25px rgba(0,0,0,0.2);
        z-index: 10000;
        animation: slideInRight 0.3s ease;
        font-weight: 600;
    `;
    notification.textContent = message;
    document.body.appendChild(notification);
    setTimeout(() => {
        notification.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Security Check
fetch('/api/check-session')
    .then(res => res.json())
    .then(data => {
        if (!data.loggedIn) {
            window.location.href = '/';
        }
    })
    .catch(() => { window.location.href = '/'; });

// Initialize on Load
document.addEventListener('DOMContentLoaded', () => {
    loadStats();
    loadUsers();
    loadDashHistory(true);

    setInterval(updateAdminTimer, 1000);
    setInterval(loadStats, 30000); // Auto-refresh stats every 30s
});

// ================================
// SECTION NAVIGATION
// ================================
function showSection(sectionId, element) {
    // Hide all sections
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.getElementById(sectionId).classList.add('active');

    // Update nav active state
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    if (element) element.classList.add('active');

    // Update page title
    const titles = {
        'dashboard': 'Dashboard Overview',
        'users': 'User Management',
        'draws': 'Live Draw Control',
        'analytics': 'Advanced Analytics',
        'activity': 'Activity Logs'
    };
    const subtitles = {
        'dashboard': 'Welcome back, monitor your business in real-time',
        'users': 'Manage retailer accounts and permissions',
        'draws': 'Control live draws and force winners',
        'analytics': 'View detailed business insights',
        'activity': 'Track all system activities'
    };
    document.getElementById('page-title').textContent = titles[sectionId];
    document.getElementById('page-subtitle').textContent = subtitles[sectionId];
}

// ================================
// STATS LOADING
// ================================
async function loadStats() {
    try {
        const res = await fetch('/api/stats');
        const data = await res.json();

        if (data.success) {
            document.getElementById('total-users').textContent = data.totalUsers || 0;
            document.getElementById('today-sale').textContent = formatCurrency(data.todaySale || 0);
            document.getElementById('today-profit').textContent = formatCurrency(data.todayProfit || 0);
            document.getElementById('next-draw-time').textContent = data.nextDraw || '--:--';
        }
    } catch (err) {
        console.error('Error loading stats:', err);
    }
}

// ================================
// USER MANAGEMENT
// ================================
let allUsers = []; // Store for filtering

async function loadUsers() {
    try {
        const res = await fetch('/api/users');
        const data = await res.json();

        if (data.success) {
            allUsers = data.users || [];
            displayUsers(allUsers);
        }
    } catch (err) {
        console.error('Error loading users:', err);
    }
}

function displayUsers(users) {
    const tbody = document.querySelector('#users-table tbody');
    tbody.innerHTML = '';

    if (users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 40px; color: var(--text-muted);">No retailers found</td></tr>';
        return;
    }

    users.forEach(user => {
        const statusBadge = user.is_active
            ? '<span class="badge badge-success"><i class="fas fa-check-circle"></i> Active</span>'
            : '<span class="badge badge-danger"><i class="fas fa-ban"></i> Blocked</span>';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="font-weight: 700; color: var(--primary);">S90${user.user_id}</td>
            <td style="font-weight: 600;">${user.username}</td>
            <td style="color: var(--success); font-weight: 700;">${formatCurrency(user.balance)}</td>
            <td>${user.contact_no || 'N/A'}</td>
            <td>${statusBadge}</td>
            <td style="text-align: center;">
                <button class="btn" style="background: #2c3e50; color: white; padding: 6px 15px;" 
                        onclick="openUserProfile(${user.user_id})">
                    <i class="fas fa-cog"></i> Manage
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function filterUsers() {
    const searchTerm = document.getElementById('user-search').value.toLowerCase();
    const filtered = allUsers.filter(user =>
        user.username.toLowerCase().includes(searchTerm) ||
        user.user_id.toString().includes(searchTerm) ||
        (user.contact_no && user.contact_no.includes(searchTerm))
    );
    displayUsers(filtered);
}

// Add Balance
function openAddBalance(userId, username) {
    const amount = prompt(`💰 Add Balance to ${username}:\n\nEnter amount (e.g., 5000):`);
    if (amount) {
        if (isNaN(amount) || amount <= 0) {
            showNotification('Please enter a valid positive number', 'error');
            return;
        }
        addBalance(userId, amount);
    }
}

async function addBalance(userId, amount) {
    try {
        const res = await fetch('/api/add-balance', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, amount })
        });
        const data = await res.json();

        if (data.success) {
            showNotification('✅ Balance added successfully!');
            loadUsers();
            loadStats();
        } else {
            showNotification('Error: ' + data.message, 'error');
        }
    } catch (err) {
        console.error(err);
        showNotification('Server connection error', 'error');
    }
}

// Toggle User Status
async function toggleUser(userId, status) {
    const action = status === 0 ? "BLOCK" : "UNBLOCK";
    if (!confirm(`Are you sure you want to ${action} this user?`)) return;

    try {
        const res = await fetch('/api/toggle-user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, status })
        });
        const data = await res.json();

        if (data.success) {
            showNotification(`User ${action}ED successfully!`);
            loadUsers();
        }
    } catch (err) {
        showNotification('Error updating user status', 'error');
    }
}

// ================================
// ADD NEW USER
// ================================
function openAddUserModal() {
    document.getElementById('add-user-modal').classList.add('active');
}

function closeAddUserModal() {
    document.getElementById('add-user-modal').classList.remove('active');
    document.getElementById('add-user-form').reset();
}

async function submitNewUser(event) {
    event.preventDefault();

    const username = document.getElementById('new-username').value;
    const password = document.getElementById('new-password').value;
    const address = document.getElementById('new-address').value;
    const contact = document.getElementById('new-contact').value;

    try {
        const res = await fetch('/api/create-user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username,
                password,
                store_address: address,
                contact_no: contact
            })
        });

        const data = await res.json();

        if (data.success) {
            showNotification('✅ User created successfully!');
            closeAddUserModal();
            loadUsers();
        } else {
            showNotification('Error: ' + data.message, 'error');
        }
    } catch (err) {
        console.error(err);
        showNotification('Server connection error', 'error');
    }
}

// ================================
// DRAW HISTORY
// ================================

// 1. Add Event Listener for the new dropdown
document.getElementById('dash-mode-filter')?.addEventListener('change', () => {
    // Reload history when mode changes (keep current date selection)
    loadDashHistory(false);
});

document.getElementById('dash-date-filter')?.addEventListener('change', (e) => {
    loadDashHistory(false, e.target.value);
});

async function loadDashHistory(isToday = false, specificDate = null) {
    const tbody = document.getElementById('dash-history-body');
    const dateInput = document.getElementById('dash-date-filter');
    const modeInput = document.getElementById('dash-mode-filter'); // ✅ Get Filter

    let dateStr = specificDate;

    if (isToday) {
        const now = new Date();
        const today = now.getFullYear() + '-' +
            (now.getMonth() + 1).toString().padStart(2, '0') + '-' +
            now.getDate().toString().padStart(2, '0');
        dateInput.value = today;
        dateStr = today;
    } else if (!dateStr) {
        dateStr = dateInput.value;
    }

    if (!dateStr) return;

    // ✅ Get Selected Mode (5, 10, 15, or empty for All)
    const selectedMode = modeInput ? modeInput.value : '';

    tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 30px;"><div class="loading-spinner"></div> Loading...</td></tr>';

    try {
        // ✅ Pass gameMode to API
        const res = await fetch(`/api/draw-history?date=${dateStr}&gameMode=${selectedMode}`);
        const data = await res.json();

        tbody.innerHTML = '';

        if (data.success && data.results.length > 0) {
            data.results.forEach(row => {
                const collection = parseFloat(row.total_collection || 0);
                const payout = parseFloat(row.total_payout || 0);
                const profit = collection - payout;
                const rtp = collection > 0 ? ((payout / collection) * 100).toFixed(1) : 0;

                const profitColor = profit >= 0 ? 'var(--success)' : 'var(--danger)';
                const rtpColor = rtp < 90 ? 'var(--success)' : rtp > 100 ? 'var(--danger)' : 'var(--warning)';

                // Visual Tag for Game Mode
                let modeBadge = '';
                if (row.game_mode) {
                    const badgeColor = row.game_mode == 5 ? '#3b82f6' : (row.game_mode == 10 ? '#8b5cf6' : '#f59e0b');
                    modeBadge = `<span style="background:${badgeColor}; color:white; padding:2px 6px; border-radius:4px; font-size:0.7rem; margin-right:5px;">${row.game_mode}m</span>`;
                }

                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td style="font-weight: 700;">${modeBadge}#${row.draw_id}</td>
                    <td>${formatDBTime(row.end_time)}</td>
                    <td style="font-weight: 700; color: var(--primary); font-size: 1.1rem;">
                        ${row.winning_spot || '<span style="color: var(--warning);">Pending</span>'}
                    </td>
                    <td>${formatCurrency(collection)}</td>
                    <td>${formatCurrency(payout)}</td>
                    <td style="color: ${profitColor}; font-weight: 700;">${formatCurrency(profit)}</td>
                    <td style="color: ${rtpColor}; font-weight: 700;">${rtp}%</td>
                `;
                tbody.appendChild(tr);
            });
        } else {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 40px; color: var(--text-muted);">No draws found for this selection</td></tr>';
        }
    } catch (err) {
        console.error(err);
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--danger);">Error loading data</td></tr>';
    }
}

// ================================
// ACCOUNT LEDGER
// ================================
let currentLedgerUserId = null;

function openAccountLedger(userId, username) {
    currentLedgerUserId = userId;
    document.getElementById('ledger-username').textContent = username;
    document.getElementById('ledger-modal').classList.add('active');
    fetchLedger(true);
}

function closeLedgerModal() {
    document.getElementById('ledger-modal').classList.remove('active');
}

async function fetchLedger(isToday = false) {
    if (!currentLedgerUserId) return;

    const fromDate = document.getElementById('ledger-from');
    const toDate = document.getElementById('ledger-to');
    const tbody = document.getElementById('ledger-table-body');
    const tfoot = document.getElementById('ledger-table-footer');

    if (isToday) {
        const now = new Date();
        const today = now.getFullYear() + '-' +
            (now.getMonth() + 1).toString().padStart(2, '0') + '-' +
            now.getDate().toString().padStart(2, '0');
        fromDate.value = today;
        toDate.value = today;
    }

    const start = fromDate.value;
    const end = toDate.value;

    if (!start || !end) {
        showNotification('Please select both dates', 'error');
        return;
    }

    tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 30px;"><div class="loading-spinner"></div> Loading...</td></tr>';
    tfoot.innerHTML = '';

    try {
        const res = await fetch(`/api/admin/ledger?userId=${currentLedgerUserId}&startDate=${start}&endDate=${end}`);
        const data = await res.json();

        if (data.success && data.ledger.length > 0) {
            tbody.innerHTML = '';

            let grandSale = 0;
            let grandWin = 0;
            let grandComm = 0;
            let grandNet = 0;

            data.ledger.forEach(row => {
                const sale = parseFloat(row.totalSale || 0);
                const win = parseFloat(row.totalWinning || 0);
                const comm = sale * 0.09;
                const net = sale - (win + comm);

                grandSale += sale;
                grandWin += win;
                grandComm += comm;
                grandNet += net;

                const d = new Date(row.date);
                const dateStr = d.toLocaleDateString('en-IN', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric'
                });

                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td style="text-align: center;">${dateStr}</td>
                    <td style="text-align: center; color: var(--success); font-weight: 700;">${formatCurrency(sale)}</td>
                    <td style="text-align: center; color: var(--danger); font-weight: 700;">${formatCurrency(win)}</td>
                    <td style="text-align: center; color: var(--warning); font-weight: 700;">${formatCurrency(comm)}</td>
                    <td style="text-align: center; font-weight: 700; font-size: 1.05rem;">${formatCurrency(net)}</td>
                `;
                tbody.appendChild(tr);
            });

            tfoot.innerHTML = `
                <tr style="background: var(--bg-light); font-weight: 700;">
                    <td style="text-align: right; padding-right: 20px;">TOTAL:</td>
                    <td style="text-align: center; color: var(--success);">${formatCurrency(grandSale)}</td>
                    <td style="text-align: center; color: var(--danger);">${formatCurrency(grandWin)}</td>
                    <td style="text-align: center; color: var(--warning);">${formatCurrency(grandComm)}</td>
                    <td style="text-align: center; font-size: 1.2rem; color: var(--primary);">${formatCurrency(grandNet)}</td>
                </tr>
            `;
        } else {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 40px; color: var(--text-muted);">No sales data found for this period</td></tr>';
        }
    } catch (err) {
        console.error(err);
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--danger);">Server Error</td></tr>';
    }
}

function exportLedger() {
    showNotification('Export feature coming soon!', 'info');
}

// ================================
// ADMIN TIMER
// ================================
function updateAdminTimer() {
    const now = new Date();
    const minutes = now.getMinutes();
    const seconds = now.getSeconds();
    const DRAW_INTERVAL = 10;

    const minutesLeft = (DRAW_INTERVAL - 1) - (minutes % DRAW_INTERVAL);
    const secondsLeft = 59 - seconds;

    const displayMin = minutesLeft.toString().padStart(2, '0');
    const displaySec = secondsLeft.toString().padStart(2, '0');

    const timerEl = document.getElementById('admin-timer');
    if (timerEl) {
        timerEl.textContent = `${displayMin}:${displaySec}`;
    }
}




// ================================
// FORCE WINNER (UPDATED)
// ================================
async function forceWinner() {
    const spot = document.getElementById('manual-winner-select').value;
    const gameMode = document.getElementById('manual-mode-select').value; // ✅ Get Mode

    if (!spot) {
        showNotification('Please select a spot first', 'error');
        return;
    }

    // Confirmation Message
    if (!confirm(`⚠️ WARNING: Force Winner\n\nTarget: ${gameMode} Min Game\nWinner: ${spot}\n\nThis will override the smart algorithm. Continue?`)) {
        return;
    }

    try {
        // ✅ Send both spot AND gameMode
        const res = await fetch('/api/force-winner', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                spot: spot,
                gameMode: parseInt(gameMode)
            })
        });

        const data = await res.json();

        if (data.success) {
            showNotification(`✅ Success! ${gameMode}m Draw forced to ${spot}`);
            document.getElementById('manual-winner-select').value = ''; // Reset spot
        } else {
            showNotification('Error: ' + data.message, 'error');
        }
    } catch (err) {
        console.error(err);
        showNotification('Server connection error', 'error');
    }
}

// ================================
// LOGOUT
// ================================
async function logout() {
    if (!confirm('Are you sure you want to logout?')) return;

    try {
        const res = await fetch('/api/logout', { method: 'POST' });
        const data = await res.json();

        if (data.success) {
            sessionStorage.clear();
            window.location.href = '/';
        } else {
            showNotification('Logout failed', 'error');
        }
    } catch (err) {
        console.error('Logout error:', err);
        window.location.href = '/';
    }
}

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from {
            transform: translateX(400px);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    @keyframes slideOutRight {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(400px);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);
// ==========================================
// 10. USER 360 PROFILE LOGIC
// ==========================================

let currentUserProfileId = null;
let currentUserProfileData = null; // Store data for actions

async function openUserProfile(userId) {
    currentUserProfileId = userId;

    // Show Modal immediately (Loading state)
    document.getElementById('user-profile-modal').classList.add('active');

    try {
        const res = await fetch(`/api/user-details/${userId}`);
        const data = await res.json();

        if (data.success) {
            const user = data.user;
            currentUserProfileData = user; // Save for later usage

            // 1. Populate Header
            document.getElementById('p-avatar').textContent = user.username.charAt(0).toUpperCase();
            document.getElementById('p-username').textContent = user.username;
            document.getElementById('p-userid').textContent = `S90${user.user_id}`;

            const statusSpan = document.getElementById('p-status');
            statusSpan.textContent = user.is_active ? 'Active' : 'Blocked';
            statusSpan.style.color = user.is_active ? 'var(--success)' : 'var(--danger)';

            // 2. Populate Stats
            document.getElementById('p-balance').textContent = formatCurrency(user.balance);

            const lifetimeSales = data.stats.lifetimeSales;
            document.getElementById('p-sales').textContent = formatCurrency(lifetimeSales);

            // Approx commission calculation (9%)
            const lifetimeComm = lifetimeSales * 0.09;
            document.getElementById('p-comm').textContent = formatCurrency(lifetimeComm);

            // 3. Populate Details
            document.getElementById('p-contact').textContent = user.contact_no || 'N/A';
            document.getElementById('p-address').textContent = user.store_address || 'N/A';

            const joinDate = new Date(user.created_at).toLocaleDateString('en-IN');
            document.getElementById('p-joined').textContent = joinDate;

            // 4. Update Block Button Text
            const blockBtn = document.getElementById('p-block-btn');
            if (user.is_active) {
                blockBtn.innerHTML = '<i class="fas fa-ban"></i> Block User';
                blockBtn.style.background = 'var(--danger)';
            } else {
                blockBtn.innerHTML = '<i class="fas fa-unlock"></i> Unblock';
                blockBtn.style.background = 'var(--success)';
            }
        }
    } catch (err) {
        console.error("Profile Error", err);
        showNotification("Error loading profile", 'error');
        closeUserProfile();
    }
}

function closeUserProfile() {
    document.getElementById('user-profile-modal').classList.remove('active');
    currentUserProfileId = null;
}

// --- PROFILE ACTIONS ---

function pActionAddFunds() {
    if (!currentUserProfileData) return;
    const amount = prompt(`💰 Add Balance to ${currentUserProfileData.username}:\n\nEnter amount:`);
    if (amount && !isNaN(amount) && amount > 0) {
        addBalance(currentUserProfileId, amount).then(() => {
            // Refresh Profile
            openUserProfile(currentUserProfileId);
        });
    }
}

async function pActionClearFunds() {
    if (!currentUserProfileData) return;
    if (confirm(`⚠️ WARNING: You are about to RESET the balance for ${currentUserProfileData.username} to ₹0.00.\n\nAre you sure?`)) {
        try {
            const res = await fetch('/api/clear-balance', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: currentUserProfileId })
            });
            const data = await res.json();
            if (data.success) {
                showNotification("✅ Balance Cleared!");
                openUserProfile(currentUserProfileId); // Refresh Profile
                loadUsers(); // Refresh Main Table
                loadStats();
            }
        } catch (err) { showNotification("Error clearing funds", 'error'); }
    }
}

function pActionViewLedger() {
    if (!currentUserProfileData) return;
    // Close profile, open ledger
    closeUserProfile();
    openAccountLedger(currentUserProfileId, currentUserProfileData.username);
}

async function pActionToggleBlock() {
    if (!currentUserProfileData) return;
    const newStatus = currentUserProfileData.is_active ? 0 : 1;
    const actionName = newStatus === 0 ? "BLOCK" : "UNBLOCK";

    if (confirm(`Are you sure you want to ${actionName} this user?`)) {
        await fetch('/api/toggle-user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: currentUserProfileId, status: newStatus })
        });
        showNotification(`User ${actionName}ED successfully!`);
        openUserProfile(currentUserProfileId); // Refresh UI
        loadUsers(); // Refresh Table
    }
}

// --- NEW: Set Retailer RTP ---
async function pActionSetRTP() {
    if (!currentUserProfileData) return;

    const currentRTP = currentUserProfileData.target_rtp || 90;

    const newRTP = prompt(
        `🎯 Set Target RTP for ${currentUserProfileData.username}\n\n` +
        `Current Setting: ${currentRTP}%\n` +
        `Enter new percentage (e.g. 85 for high profit, 95 for high payout):`,
        currentRTP
    );

    if (newRTP !== null) {
        const rtpValue = parseInt(newRTP);

        if (isNaN(rtpValue) || rtpValue < 1 || rtpValue > 100) {
            showNotification('Please enter a valid number between 1-100', 'error');
            return;
        }

        try {
            const res = await fetch('/api/update-user-rtp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: currentUserProfileId, rtp: rtpValue })
            });

            const data = await res.json();
            if (data.success) {
                showNotification(`✅ RTP Updated to ${rtpValue}%`);
                openUserProfile(currentUserProfileId); // Refresh to see changes
            } else {
                showNotification('Error updating RTP', 'error');
            }
        } catch (err) {
            console.error(err);
            showNotification('Server Connection Error', 'error');
        }
    }
}
