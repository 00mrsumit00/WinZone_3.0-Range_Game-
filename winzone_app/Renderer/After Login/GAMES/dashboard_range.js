document.addEventListener('DOMContentLoaded', () => {

    let ACTIVE_GAME_MODE = 5; // Default

    // --- HELPER: Read String directly from DB ---
    function formatDBTime(dbTime) {
        if (!dbTime) return "00:00 AM";
        try {
            // Grab the "HH:MM:SS" part from the string
            let match = dbTime.toString().match(/(\d{2}):(\d{2}):(\d{2})/);

            if (match) {
                let h = parseInt(match[1]);
                let m = match[2];

                // Convert 24hr to 12hr (AM/PM)
                let ampm = h >= 12 ? 'PM' : 'AM';
                h = h % 12;
                h = h ? h : 12;

                return `${h.toString().padStart(2, '0')}:${m} ${ampm}`;
            }
            return "--:--";
        } catch (e) {
            console.error("Time Error:", e);
            return "Error";
        }
    }

    // --- NEW: Function to load user data ---
    function loadUserData() {
        // Get the data we saved during login
        const username = sessionStorage.getItem('username');
        const balance = sessionStorage.getItem('balance');
        const userId = sessionStorage.getItem('userId');

        if (!username) {
            window.showAlert('You are not logged in. Redirecting to login page.');
            window.location.href = '../index.html';
            return;
        }

        const usernameElement = document.getElementById('display-username');
        const balanceElement = document.getElementById('display-balance');

        if (usernameElement) {
            const numericUserId = parseInt(userId) || 0;
            const formattedUserId = `S${900 + numericUserId}`;
            const displayString = `${username.toUpperCase()} SKILL GAME CENTER ${formattedUserId}`;
            usernameElement.textContent = displayString;
        }

        if (balanceElement) {
            const formattedBalance = parseFloat(balance).toFixed(2);
            balanceElement.textContent = `₹ ${formattedBalance}`;
        }
    }

    // --- 1. CONFIGURATION --- //
    const DRAW_DURATION_MINUTES = 10;
    const DRAW_DURATION_MS = DRAW_DURATION_MINUTES * 60 * 1000;

    // Fetch real settings from Admin
    try {
        const settingsRes = window.electronAPI.getGameSettings();
        if (settingsRes.success) {
            DRAW_DURATION_MINUTES = settingsRes.settings.draw_time_minutes;
            DRAW_DURATION_MS = DRAW_DURATION_MINUTES * 60 * 1000;
            console.log(`Draw Time Set to: ${DRAW_DURATION_MINUTES} mins`);
        }
    } catch (e) {
        console.error("Could not load settings, using default 10 mins");
    }

    // --- 2. Element References --- //
    const drawEndTimeElement = document.getElementById('draw-end-time');
    const countdownElement = document.getElementById('countdown-timer');
    const spotInputs = document.querySelectorAll('.spot-input');
    const totalSpotsElement = document.getElementById('total-spots');
    const prizePoolElement = document.getElementById('prize-pool');
    const serviceChargeElement = document.getElementById('service-charge');
    const totalAmountElement = document.getElementById('total-amount');
    const resetBtn = document.getElementById('reset-btn');
    const submitBtn = document.getElementById('submit-btn');
    const refreshBtn = document.getElementById('refresh-btn');
    const reprintBtn = document.getElementById('reprint-btn');
    const claimBtn = document.getElementById('claim-btn');
    const barcodeInput = document.getElementById('barcode-input');
    const modal = document.getElementById('submit-modal');
    const claimModal = document.getElementById('claim-modal');
    const modalCloseBtn = document.getElementById('modal-close-btn');
    const modalPrintBtn = document.getElementById('modal-print-btn');
    const modalConfirmBtn = document.getElementById('modal-confirm-btn');
    const ticketDetailsContent = document.getElementById('ticket-details-content');

    const resultsBtn = document.getElementById('result-btn');
    const resultsModal = document.getElementById('results-modal');
    const resultsModalCloseBtn = document.getElementById('results-modal-close-btn');
    const resultsBody = document.getElementById('results-table-body');
    const dateFilter = document.getElementById('date-filter');
    const todayBtn = document.getElementById('today-btn');

    // --- TICKET MODAL ELEMENTS --- //
    const ticketModal = document.getElementById('ticket-history-modal');
    const ticketModalCloseBtn = document.getElementById('ticket-modal-close-btn');
    const ticketTableBody = document.getElementById('ticket-table-body');
    const ticketDateFilter = document.getElementById('ticket-date-filter');
    const ticketTodayBtn = document.getElementById('ticket-today-btn');

    // --- PASSWORD RESET LOGIC ---
    const pwdModal = document.getElementById('password-modal');
    const pwdBtn = document.getElementById('password-btn');
    const pwdCloseBtn = document.getElementById('password-modal-close-btn');
    const pwdCancelBtn = document.getElementById('pwd-cancel-btn');
    const pwdSaveBtn = document.getElementById('pwd-save-btn');
    const pwdErrorMsg = document.getElementById('pwd-error-msg');

    // Loading Modal
    const loadingModal = document.getElementById('loading-modal');

    // --- CUSTOM ALERT SYSTEM ---
    const msgModal = document.getElementById('message-modal');
    const msgText = document.getElementById('msg-text');
    const msgIcon = document.getElementById('msg-icon');
    const msgCloseBtn = document.getElementById('msg-close-btn');

    // Override the default browser alert
    window.showAlert = function (message, type = 'error') {
        msgText.textContent = message;

        if (type === 'success') {
            msgIcon.textContent = '✅';
            document.querySelector('#message-modal .modal-content').style.borderTopColor = 'var(--accent-green)';
        } else {
            msgIcon.textContent = '⚠️'; // Warning/Error
            document.querySelector('#message-modal .modal-content').style.borderTopColor = 'var(--accent-orange)';
        }

        msgModal.style.display = 'flex';
        setTimeout(() => msgModal.classList.add('show'), 10);

        // Auto focus the OK button so Enter key closes it
        setTimeout(() => msgCloseBtn.focus(), 50);
    };

    // Close Logic
    function closeMsgModal() {
        msgModal.classList.remove('show');
        setTimeout(() => msgModal.style.display = 'none', 300);
        // Return focus to barcode input after error
        if (barcodeInput) barcodeInput.focus();
    }

    msgCloseBtn.addEventListener('click', closeMsgModal);

    // Allow Enter key to close the modal
    msgModal.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') closeMsgModal();
    });

    // --- CUSTOM CONFIRM SYSTEM ---
    const confirmModal = document.getElementById('confirm-modal');
    const confirmMsgText = document.getElementById('confirm-msg-text');
    const confirmOkBtn = document.getElementById('confirm-ok-btn');
    const confirmCancelBtn = document.getElementById('confirm-cancel-btn');

    let confirmResolve = null; // Variable to hold the Promise resolution

    // This function creates a Promise that waits for a click
    window.showConfirm = function (message) {
        confirmMsgText.textContent = message;
        confirmModal.style.display = 'flex';
        setTimeout(() => confirmModal.classList.add('show'), 10);

        // Focus the "Cancel" button by default for safety
        setTimeout(() => confirmCancelBtn.focus(), 50);

        return new Promise((resolve) => {
            confirmResolve = resolve;
        });
    };

    function closeConfirmModal(result) {
        confirmModal.classList.remove('show');
        setTimeout(() => confirmModal.style.display = 'none', 300);
        if (confirmResolve) {
            confirmResolve(result); // Return true or false
            confirmResolve = null;
        }
    }

    // Button Listeners
    confirmOkBtn.addEventListener('click', () => closeConfirmModal(true));
    confirmCancelBtn.addEventListener('click', () => closeConfirmModal(false));

    // Allow Escape key to cancel
    confirmModal.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeConfirmModal(false);
    });


    let lastDrawCheck = 0;
    let isReloading = false;

    // --- 3. NEW SYNCHRONIZED TIMER SYSTEM --- //
    function updateTimers() {
        if (isReloading) return;

        // Dynamic Calculation based on Active Mode
        const drawDurationMs = ACTIVE_GAME_MODE * 60 * 1000;

        const now = new Date();
        const timeSinceEpochMs = now.getTime();
        const timeRemainingMs = drawDurationMs - (timeSinceEpochMs % drawDurationMs);
        let totalSeconds = Math.floor(timeRemainingMs / 1000);

        // ... (Keep existing Lock Logic here) ...
        if (timeRemainingMs <= 10000 && timeRemainingMs > 500) {
            if (loadingModal.style.display !== 'flex') {
                loadingModal.style.display = 'flex';
                loadingModal.classList.add('show');
                const submitModal = document.getElementById('submit-modal');
                if (submitModal) submitModal.style.display = 'none';
            }
        } else {
            if (!isReloading && loadingModal.style.display === 'flex') {
                loadingModal.classList.remove('show');
                loadingModal.style.display = 'none';
            }
        }

        const drawEndTimeMs = timeSinceEpochMs + timeRemainingMs;
        const drawEndDate = new Date(drawEndTimeMs);

        // Update Clocks
        let hours = drawEndDate.getHours();
        const minutes = drawEndDate.getMinutes().toString().padStart(2, '0');
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12;
        hours = hours ? hours : 12;
        drawEndTimeElement.textContent = `${hours.toString().padStart(2, '0')}:${minutes} ${ampm}`;

        const displayMinutes = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
        const displaySeconds = (totalSeconds % 60).toString().padStart(2, '0');
        countdownElement.textContent = `${displayMinutes}:${displaySeconds}`;

        if (totalSeconds <= 60) countdownElement.classList.add('warning');
        else countdownElement.classList.remove('warning');

        // --- DRAW ENDED LOGIC ---
        if (totalSeconds <= 0 && lastDrawCheck !== drawEndDate.getTime()) {
            if (isReloading) return;
            isReloading = true;
            lastDrawCheck = drawEndDate.getTime();

            countdownElement.textContent = "RSLT...";
            countdownElement.style.color = "#ffc107";

            const checkInterval = setInterval(async () => {
                try {
                    // ✅ FETCH RESULTS FOR ACTIVE MODE
                    const res = await window.electronAPI.getLatestResults(ACTIVE_GAME_MODE);

                    if (res.success && res.results.length > 0) {
                        const latestDraw = res.results[0];
                        const latestDrawTime = new Date(latestDraw.end_time).getTime();
                        const timeDiff = Math.abs(latestDrawTime - drawEndDate.getTime());

                        // Allow 2 min buffer
                        if (timeDiff < 120000) {
                            clearInterval(checkInterval);
                            updateTopSpotsUI(res.results);
                            countdownElement.style.color = "white";
                            setTimeout(() => {
                                isReloading = false;
                                // We don't need full reload, just clear board
                                resetSelections();
                                // Or location.reload() if you prefer
                            }, 2000);
                        }
                    }
                } catch (err) { console.error(err); }
            }, 1000);

            setTimeout(() => { isReloading = false; }, 45000); // Safety timeout
        }
    }

    // --- 4. TOP SPOTS / RESULTS UI --- //
    function updateTopSpotsUI(results = []) {
        const spotCardElements = document.querySelectorAll('.top-spots .spot-card');

        spotCardElements.forEach((card, index) => {
            const spotIdElement = card.querySelector('.spot-id');
            const spotTimeElement = card.querySelector('.spot-time');

            // Removed: const spotImgElement = card.querySelector('img'); 

            if (results[index]) {
                const result = results[index];
                const winningSpot = result.winning_spot;

                // ✅ USE HELPER: Direct String Display (No Timezone Math)
                const timeString = formatDBTime(result.end_time);

                spotIdElement.textContent = winningSpot;
                spotTimeElement.textContent = timeString;

                // Removed: spotImgElement.src = ...

                // Highlight the latest result
                if (index === 0) {
                    card.style.border = "2px solid #ffd700";
                    card.style.boxShadow = "0 0 15px rgba(255, 215, 0, 0.3)";
                } else {
                    card.style.border = "1px solid var(--border-color)";
                    card.style.boxShadow = "none";
                }

            } else {
                spotIdElement.textContent = '--';
                spotTimeElement.textContent = '00:00 AM';
                // Removed: spotImgElement.src = ...
            }
        });
    }

    // --- 5. Spot Input & Calculation System ---
    function calculateTotals() {
        let totalSpots = 0;
        spotInputs.forEach(input => {
            const value = parseInt(input.value) || 0;
            totalSpots += value;
            if (value > 0) input.classList.add('has-value');
            else input.classList.remove('has-value');
        });
        const prizePool = totalSpots * 9;
        const serviceCharge = totalSpots * 1;
        const totalAmount = prizePool + serviceCharge;
        totalSpotsElement.textContent = totalSpots;
        prizePoolElement.textContent = `₹${prizePool}`;
        serviceChargeElement.textContent = `₹${serviceCharge}`;
        totalAmountElement.textContent = `₹${totalAmount}`;
    }

    // Helper to format today's date for SQL (YYYY-MM-DD)
    function getTodayDateString() {
        const now = new Date();
        return now.getFullYear() + '-' +
            (now.getMonth() + 1).toString().padStart(2, '0') + '-' +
            now.getDate().toString().padStart(2, '0');
    }

    // Function to fetch and display results in the modal table
    async function fetchAndDisplayResults(dateString) {
        resultsBody.innerHTML = '<tr><td colspan="5" class="no-results"><i class="fa-solid fa-spinner fa-spin"></i> Loading results...</td></tr>';

        try {
            const result = await window.electronAPI.getFilteredResults(dateString, ACTIVE_GAME_MODE);

            if (result.success && result.results.length > 0) {
                let html = '';
                result.results.forEach(draw => {

                    // ✅ USE HELPER: Direct String Display
                    const timeString = formatDBTime(draw.end_time);

                    // Calculate profit for quick display (optional)
                    const profit = draw.total_collection - draw.total_payout;

                    html += `
                    <tr>
                        <td>${draw.draw_id}</td>
                        <td class="winning-spot">${draw.winning_spot}</td>
                        <td>${timeString}</td>
                    </tr>
                `;
                });
                resultsBody.innerHTML = html;
            } else {
                resultsBody.innerHTML = '<tr><td colspan="5" class="no-results">No finalized results found for this selection.</td></tr>';
            }
        } catch (err) {
            console.error("Error fetching results:", err);
            resultsBody.innerHTML = '<tr><td colspan="5" class="no-results"><i class="fa-solid fa-triangle-exclamation"></i> Error connecting to server.</td></tr>';
        }
    }

    // --- RESULT MODAL EVENT LISTENERS ---

    const navResultBtn = Array.from(document.querySelectorAll('.main-nav button'))
        .find(btn => btn.textContent.includes('Result'));

    if (navResultBtn) {
        navResultBtn.addEventListener('click', () => {
            // Open the modal
            resultsModal.style.display = 'flex';
            setTimeout(() => resultsModal.classList.add('show'), 10);

            // Load today's results automatically
            todayBtn.click();
        });
    }

    // Close listeners for the Results Modal
    resultsModalCloseBtn.addEventListener('click', () => {
        resultsModal.classList.remove('show');
        setTimeout(() => resultsModal.style.display = 'none', 300);
    });
    resultsModal.addEventListener('click', (e) => {
        if (e.target === resultsModal) {
            resultsModal.classList.remove('show');
            setTimeout(() => resultsModal.style.display = 'none', 300);
        }
    });

    // Filter Listeners
    todayBtn.addEventListener('click', () => {
        const today = getTodayDateString();
        dateFilter.value = today; // Set the filter control
        fetchAndDisplayResults(today);
    });

    dateFilter.addEventListener('change', (e) => {
        fetchAndDisplayResults(e.target.value);
    });

    spotInputs.forEach(input => {
        input.addEventListener('input', calculateTotals);
        input.addEventListener('change', calculateTotals);
    });

    // --- 6. Button Logic (Reset, Refresh) ---
    function resetSelections() {
        spotInputs.forEach(input => {
            input.value = '';
            input.classList.remove('has-value');
        });
        calculateTotals();
    }
    resetBtn.addEventListener('click', resetSelections);
    refreshBtn.addEventListener('click', () => { location.reload(); });

    // --- LOGOUT LOGIC ---
    const logoutBtn = document.querySelector('.main-nav button.logout');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            // 1. Clear session storage (user data for this session)
            sessionStorage.clear();
            localStorage.removeItem('rememberedUser');

            // 3. Redirect to the login page
            window.location.href = '../index.html';
        });
    }

    // --- 7. Submit Modal Logic (NEW WORKFLOW) ---
    submitBtn.addEventListener('click', () => {
        const totalSpots = parseInt(totalSpotsElement.textContent);
        if (totalSpots <= 0) {
            window.showAlert('Please select at least one spot!');
            return;
        }

        spotInputs.forEach(input => input.disabled = true); // Disable inputs
        modal.style.display = 'flex';

        const username = sessionStorage.getItem('username');
        const userId = parseInt(sessionStorage.getItem('userId')) || 0;
        const totalAmount = parseFloat(totalAmountElement.textContent.replace('₹', ''));
        const spotPrice = 10;
        const formattedUserId = `S${900 + userId}`;
        const storeName = `${username.toUpperCase()} SKILL GAME CENTER`;

        const now = new Date();
        const timeSinceEpochMs = now.getTime();
        const currentModeDurationMs = ACTIVE_GAME_MODE * 60 * 1000;

        const timeRemainingMs = currentModeDurationMs - (timeSinceEpochMs % currentModeDurationMs);
        const drawEndTimeMs = timeSinceEpochMs + timeRemainingMs;
        const drawEndTime = new Date(drawEndTimeMs);
        const timestamp = now.toLocaleString('en-IN', {
            day: '2-digit', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true
        });
        const drawId = `${drawEndTime.getFullYear()}${(drawEndTime.getMonth() + 1).toString().padStart(2, '0')}${drawEndTime.getDate().toString().padStart(2, '0')}${drawEndTime.getHours().toString().padStart(2, '0')}${drawEndTime.getMinutes().toString().padStart(2, '0')}`;

        let receiptHTML = `<div class="ticket-receipt">`;
        receiptHTML += `<div class="header">${storeName}</div>`;
        receiptHTML += `<div class="divider"></div>`;
        receiptHTML += `<div class="info-line"><span>ID: ${formattedUserId}</span> <span>${timestamp}</span></div>`;
        // ADDED THE ID HERE:
        receiptHTML += `<div class="info-line"><span>DRAW ID: <span id="draw-id-display">${drawId}</span></span> <span id="ticket-id-display">TICKET: Pending...</span></div>`;
        receiptHTML += `<table><thead><tr><th class="col-spot">SPOT</th><th class="col-qty">QTY</th><th class="col-amt">AMOUNT</th></tr></thead><tbody>`;

        spotInputs.forEach(input => {
            const value = parseInt(input.value) || 0;
            if (value > 0) {
                const spotName = input.dataset.spot;
                const spotTotal = spotPrice * value;
                receiptHTML += `<tr><td class="col-spot">${spotName}</td><td class="col-qty">${value}</td><td class="col-amt">₹${spotTotal.toFixed(2)}</td></tr>`;
            }
        });

        receiptHTML += `</tbody></table>`;
        receiptHTML += `<div class="total-line"><span>TOTAL:</span> ₹${totalAmount.toFixed(2)}</div>`;
        receiptHTML += `</div>`;

        ticketDetailsContent.innerHTML = receiptHTML;

        // Reset buttons to initial state
        modalConfirmBtn.style.display = 'inline-block';
        modalPrintBtn.style.display = 'none';
        modalConfirmBtn.disabled = false;

        modal.style.display = 'flex';
        setTimeout(() => modal.classList.add('show'), 10);
    });

    // THIS IS THE NEW CLOSE MODAL LOGIC
    function closeModal() {
        modal.classList.remove('show');
        setTimeout(() => {
            modal.style.display = 'none';
            spotInputs.forEach(input => input.disabled = false); // Re-enable inputs
            if (modalPrintBtn.style.display === 'inline-block') {
                resetSelections();
            }
        }, 300);
    }
    modalCloseBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    // --- TICKET HISTORY FUNCTIONS --- //
    async function fetchTicketHistory(dateString) {
        const username = sessionStorage.getItem('username');
        ticketTableBody.innerHTML = '<tr><td colspan="6" class="no-results"><i class="fa-solid fa-spinner fa-spin"></i> Loading tickets...</td></tr>';

        try {
            const result = await window.electronAPI.getTicketHistory(username, dateString, ACTIVE_GAME_MODE);

            if (result.success && result.tickets.length > 0) {
                let html = '';

                // Current time for comparison
                const now = new Date();

                result.tickets.forEach(ticket => {
                    // 1. Format Purchase Time
                    const purchaseTime = formatDBTime(ticket.created_at);

                    // 2. Format Draw Time (New!)
                    // We use the helper to turn "2026-01-03 12:10:00" into "12:10 PM"
                    const drawTimeFormatted = formatDBTime(ticket.end_time);

                    // --- CHECK TIME LIMIT (Existing Logic) ---
                    const drawEndTime = new Date(ticket.end_time);
                    const now = new Date(); // This relies on PC time, but server blocks cheating
                    const timeDiffMs = drawEndTime - now;
                    const minutesRemaining = timeDiffMs / 1000 / 60;

                    let deleteButtonHtml = '';
                    if (minutesRemaining > 1) {
                        deleteButtonHtml = `
                        <button onclick="window.deleteTicket(${ticket.ticket_id})" 
                                style="padding: 5px 10px; background-color: var(--accent-red); border: none; border-radius: 4px; color: white; cursor: pointer;"
                                title="Delete Ticket">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    `;
                    } else {
                        deleteButtonHtml = `<span style="color: #777; font-size: 0.9rem;"><i class="fa-solid fa-lock"></i> Locked</span>`;
                    }
                    // -----------------------------------

                    html += `
                <tr>
                    <td>${ticket.ticket_id}</td>
                    
                    <td style="font-weight: bold; color: var(--accent-yellow);">${drawTimeFormatted}</td>
                    
                    <td style="font-weight: bold; color: var(--accent-green);">₹${parseFloat(ticket.total_amount).toFixed(2)}</td>
                    <td>${purchaseTime}</td>
                    <td>
                        <button class="reprint-btn" data-ticket='${JSON.stringify(ticket)}' style="padding: 5px 10px; margin-right:5px; background-color: var(--accent-orange); border: none; border-radius: 4px; color: white; cursor: pointer;">
                            <i class="fa-solid fa-print"></i>
                        </button>
                        ${deleteButtonHtml}
                    </td>
                </tr>
                `;
                });
                ticketTableBody.innerHTML = html;

                // Re-attach listeners for reprint buttons
                document.querySelectorAll('.reprint-btn').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        const ticketData = JSON.parse(e.currentTarget.dataset.ticket);
                        reprintTicket(ticketData);
                    });
                });

            } else {
                ticketTableBody.innerHTML = '<tr><td colspan="6" class="no-results">No tickets found for this date.</td></tr>';
            }
        } catch (err) {
            console.error("Error:", err);
            ticketTableBody.innerHTML = '<tr><td colspan="6" class="no-results">Error loading data.</td></tr>';
        }
    }

    // --- UPDATED REPRINT FUNCTION --- //
    function reprintTicket(ticket) {
        // 1. Get User/Store Details
        const username = sessionStorage.getItem('username');
        const userId = parseInt(sessionStorage.getItem('userId')) || 0;
        const formattedUserId = `S${900 + userId}`;
        const storeName = `${username.toUpperCase()} SKILL GAME CENTER`;

        // 2. Format Date
        const ticketDate = new Date(ticket.created_at);
        const timestamp = ticketDate.toLocaleString('en-IN', {
            day: '2-digit', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true
        });

        // 3. Parse Bets (Database stores them as a JSON string)
        let bets = {};
        try {
            bets = JSON.parse(ticket.bet_details);
        } catch (e) {
            console.error("Error parsing bet details", e);
            window.showAlert('Error reading ticket data.');
            return;
        }

        // 4. Generate Receipt HTML (Same style as new ticket)
        let receiptHTML = `<div class="ticket-receipt">`;
        receiptHTML += `<div class="header">${storeName}</div>`;
        receiptHTML += `<div class="header" style="font-size:0.8rem;">(DUPLICATE COPY)</div>`; // Mark as duplicate
        receiptHTML += `<div class="divider"></div>`;

        receiptHTML += `<div class="info-line"><span>ID: ${formattedUserId}</span> <span>${timestamp}</span></div>`;
        receiptHTML += `<div class="info-line"><span>DRAW ID: ${ticket.draw_id}</span> <span>TICKET: ${ticket.ticket_id}</span></div>`;

        receiptHTML += `<table><thead><tr><th class="col-spot">SPOT</th><th class="col-qty">QTY</th><th class="col-amt">AMOUNT</th></tr></thead><tbody>`;

        // Loop through the bets to make rows
        for (const [spot, qty] of Object.entries(bets)) {
            const amount = qty * 10; // Assuming 10 Rs per qty
            receiptHTML += `<tr><td class="col-spot">${spot}</td><td class="col-qty">${qty}</td><td class="col-amt">₹${amount.toFixed(2)}</td></tr>`;
        }

        receiptHTML += `</tbody></table>`;
        receiptHTML += `<div class="total-line"><span>TOTAL:</span> ₹${parseFloat(ticket.total_amount).toFixed(2)}</div>`;
        receiptHTML += `</div>`;

        // 5. Add CSS (Styles)
        const printCss = `
            <style>
                body { font-family: 'Courier New', Courier, monospace; color: #000; margin: 0; width: 300px; }
                .ticket-receipt { padding: 10px; }
                .divider { border-top: 2px dashed #000; margin: 10px 0; }
                .header { text-align: center; font-size: 1.1rem; font-weight: bold; }
                .info-line { display: flex; justify-content: space-between; font-size: 0.85rem; margin-bottom: 5px;}
                table { width: 100%; border-collapse: collapse; font-size: 0.95rem; }
                th { border-top: 2px dashed #000; border-bottom: 2px dashed #000; padding: 5px 0; }
                td { padding: 5px 0; }
                .col-spot { text-align: left; } .col-qty { text-align: center; } .col-amt { text-align: right; }
                .total-line { font-size: 1.4rem; font-weight: bold; text-align: right; border-top: 2px dashed #000; padding-top: 10px; margin-top: 5px; }
                .total-line span { font-size: 1rem; }
            </style>
        `;

        const completeHtml = `<html><head><title>Reprint Ticket</title>${printCss}</head><body>${receiptHTML}</body></html>`;

        // 6. Send to Backend to Print
        window.electronAPI.printTicket(completeHtml);
    }

    // --- TICKET HISTORY LISTENERS ---

    // 1. "Re-Print" Button in Nav
    const navReprintBtn = Array.from(document.querySelectorAll('.main-nav button'))
        .find(btn => btn.textContent.includes('Re-Print'));

    if (navReprintBtn) {
        navReprintBtn.addEventListener('click', () => {
            ticketModal.style.display = 'flex';
            setTimeout(() => ticketModal.classList.add('show'), 10);
            ticketTodayBtn.click(); // Load today's data
        });
    }

    // 3. Close Modal
    ticketModalCloseBtn.addEventListener('click', () => {
        ticketModal.classList.remove('show');
        setTimeout(() => ticketModal.style.display = 'none', 300);
    });
    ticketModal.addEventListener('click', (e) => {
        if (e.target === ticketModal) {
            ticketModal.classList.remove('show');
            setTimeout(() => ticketModal.style.display = 'none', 300);
        }
    });

    // 4. Filters
    ticketTodayBtn.addEventListener('click', () => {
        const today = getTodayDateString();
        ticketDateFilter.value = today;
        fetchTicketHistory(today);
    });

    ticketDateFilter.addEventListener('change', (e) => {
        fetchTicketHistory(e.target.value);
    });
    // --- ACCOUNT MODAL ELEMENTS ---
    const accModal = document.getElementById('account-modal');
    const accModalCloseBtn = document.getElementById('account-modal-close-btn');
    const accDateStart = document.getElementById('acc-date-start');
    const accDateEnd = document.getElementById('acc-date-end');
    const accFetchBtn = document.getElementById('acc-fetch-btn');
    const accTableBody = document.getElementById('account-table-body');
    const accDisplayId = document.getElementById('acc-display-id');
    const accDisplayName = document.getElementById('acc-display-name');

    // --- ACCOUNT FUNCTIONS ---
    async function fetchAccountLedger(isToday = false) {
        const username = sessionStorage.getItem('username');
        const userId = sessionStorage.getItem('userId');

        let startDate = accDateStart.value;
        let endDate = accDateEnd.value;

        // Logic: If "Today's Sale" button clicked, force today's date
        if (isToday) {
            const today = getTodayDateString();
            startDate = today;
            endDate = today;
            // Update inputs visually
            accDateStart.value = today;
            accDateEnd.value = today;
        }

        // Set Header Info
        if (accDisplayId) accDisplayId.textContent = `S${900 + parseInt(userId)}`;
        if (accDisplayName) accDisplayName.textContent = `${username.toUpperCase()} SKILL GAME CENTER`;

        accTableBody.innerHTML = '<tr><td colspan="4" class="no-results"><i class="fa-solid fa-spinner fa-spin"></i> Loading...</td></tr>';

        try {
            const result = await window.electronAPI.getAccountLedger(username, startDate, endDate);

            if (result.success) {
                const rows = result.data;

                if (rows.length === 0) {
                    accTableBody.innerHTML = '<tr><td colspan="5" class="no-results">No sales found for this period.</td></tr>';
                    return;
                }

                let html = '';

                // 1. Initialize Grand Totals
                let grandTotalSale = 0;
                let grandTotalWinning = 0;
                let grandTotalCommission = 0;
                let grandTotalNet = 0;

                rows.forEach(row => {
                    // Date Formatting
                    const dateObj = new Date(row.date);
                    const dateStr = dateObj.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });

                    // Values
                    const sale = parseFloat(row.totalSale) || 0;
                    const winning = parseFloat(row.totalWinning) || 0; // Already coming from backend
                    const commission = sale * 0.09; // 9% Commission
                    const netToPay = sale - (winning + commission);

                    // 2. Add to Grand Totals
                    grandTotalSale += sale;
                    grandTotalWinning += winning;
                    grandTotalCommission += commission;
                    grandTotalNet += netToPay;

                    // 3. Generate Row HTML (Added Winning Column)
                    html += `
                        <tr>
                            <td>${dateStr}</td>
                            <td style="color: var(--accent-green); font-weight: bold;">${Math.round(sale)}</td>
                            <td style="color: var(--accent-red); font-weight: bold;">${Math.round(winning)}</td>
                            <td style="color: var(--accent-yellow); font-weight: bold;">${Math.round(commission)}</td>
                            <td style="color: var(--accent-orange); font-weight: bold;">${Math.round(netToPay)}</td>
                        </tr>
                    `;
                });

                // 4. Generate Total Row (With all Grand Totals)
                html += `
                    <tr style="background-color: #444; font-weight: bold; border-top: 2px solid #fff;">
                        <td style="text-align: center; color: #fff;">TOTAL:</td>
                        <td style="color: var(--accent-green); font-size: 1.1rem;">₹ ${Math.round(grandTotalSale)}</td>
                        <td style="color: var(--accent-red); font-size: 1.1rem;">₹ ${Math.round(grandTotalWinning)}</td>
                        <td style="color: var(--accent-yellow); font-size: 1.1rem;">₹ ${Math.round(grandTotalCommission)}</td>
                        <td style="color: #fff; font-size: 1.2rem;">₹ ${Math.round(grandTotalNet)}</td>
                    </tr>
                `;

                accTableBody.innerHTML = html;
            } else {
                accTableBody.innerHTML = '<tr><td colspan="5" class="no-results">Error loading data.</td></tr>';
            }
        } catch (err) {
            console.error(err);
            accTableBody.innerHTML = '<tr><td colspan="5" class="no-results">Connection error.</td></tr>';
        }
    }

    // --- ACCOUNT LISTENERS ---

    // 1. "Today's Sale" Button (New)
    const accTodayBtn = document.getElementById('acc-today-btn');
    if (accTodayBtn) {
        accTodayBtn.addEventListener('click', () => fetchAccountLedger(true));
    }

    // 2. "Search History" Button (Existing renamed)
    if (accFetchBtn) {
        accFetchBtn.addEventListener('click', () => fetchAccountLedger(false));
    }

    const navAccountBtn = Array.from(document.querySelectorAll('.main-nav button'))
        .find(btn => btn.textContent.includes('Account'));

    // 3. Open Account Modal (from Nav)
    if (navAccountBtn) {
        navAccountBtn.addEventListener('click', () => {
            if (ticketModal) ticketModal.classList.remove('show');
            accModal.style.display = 'flex';
            setTimeout(() => accModal.classList.add('show'), 10);

            // Automatically load Today's Sale on open
            fetchAccountLedger(true);
        });
    }

    // 4. Close Modal
    accModalCloseBtn.addEventListener('click', () => {
        accModal.classList.remove('show');
        setTimeout(() => accModal.style.display = 'none', 300);
    });
    accModal.addEventListener('click', (e) => {
        if (e.target === accModal) {
            accModal.classList.remove('show');
            setTimeout(() => accModal.style.display = 'none', 300);
        }
    });

    // THIS IS THE NEW CONFIRM BUTTON LOGIC
    modalConfirmBtn.addEventListener('click', async () => {
        if (modalConfirmBtn.disabled) return; // Prevent double clicks

        modalConfirmBtn.disabled = true;
        modalConfirmBtn.textContent = "Processing...";

        const username = sessionStorage.getItem('username');
        const totalAmount = parseFloat(totalAmountElement.textContent.replace('₹', ''));

        // Prepare Ticket Data
        const now = new Date();
        const timeSinceEpochMs = now.getTime();

        const currentModeDurationMs = ACTIVE_GAME_MODE * 60 * 1000;

        const timeRemainingMs = currentModeDurationMs - (timeSinceEpochMs % currentModeDurationMs);
        const drawEndTimeMs = timeSinceEpochMs + timeRemainingMs;
        const drawEndTime = new Date(drawEndTimeMs);

        const betDetails = {};
        spotInputs.forEach(input => {
            const value = parseInt(input.value) || 0;
            if (value > 0) betDetails[input.dataset.spot] = value;
        });

        const payload = {
            username: username,
            ticketData: {
                totalAmount: totalAmount,
                betDetails: betDetails,
                drawEndTime: drawEndTime // Calculated in existing code based on timer
            },
            gameMode: ACTIVE_GAME_MODE // ✅ SEND GAME MODE
        };

        try {
            const result = await window.electronAPI.submitTicket(payload);

            if (result.success) {
                // 1. Update Balance immediately
                const balanceElement = document.getElementById('display-balance');
                const newBalanceFormatted = parseFloat(result.newBalance).toFixed(2);
                balanceElement.textContent = `₹ ${newBalanceFormatted}`;
                sessionStorage.setItem('balance', result.newBalance);

                // 2. Update Receipt with Real Ticket ID
                if (result.newTicketId) {
                    document.getElementById('ticket-id-display').textContent = `TICKET: ${result.newTicketId}`;
                }
                if (result.drawId) {
                    document.getElementById('draw-id-display').textContent = result.drawId;
                }

                // 3. AUTO PRINT LOGIC
                // Generate Print HTML from the updated receipt
                const receiptHtml = document.getElementById('ticket-details-content').innerHTML;
                const printCss = `
                    <style>
                        body { font-family: 'Courier New', Courier, monospace; color: #000; margin: 0; width: 300px; }
                        .ticket-receipt { padding: 0; }
                        .divider { border-top: 2px dashed #000; margin: 10px 0; }
                        .header { text-align: center; font-size: 1.1rem; font-weight: bold; }
                        .info-line { display: flex; justify-content: space-between; font-size: 0.85rem; }
                        table { width: 100%; border-collapse: collapse; font-size: 0.95rem; }
                        th { border-top: 2px dashed #000; border-bottom: 2px dashed #000; }
                        .col-spot { text-align: left; } .col-qty { text-align: center; } .col-amt { text-align: right; }
                        .total-line { font-size: 1.4rem; font-weight: bold; text-align: right; border-top: 2px dashed #000; padding-top: 10px; margin-top: 5px; }
                        .total-line span { font-size: 1rem; }
                    </style>
                `;
                const completeHtml = `<html><head><title>Print Receipt</title>${printCss}</head><body>${receiptHtml}</body></html>`;

                // Send to Electron to print silently
                window.electronAPI.printTicket(completeHtml);

                // 4. Close Modal & Reset Form (Speed!)
                closeModal();
                resetSelections();

            } else {
                window.showAlert(`Error: ${result.message}`);
            }
        } catch (err) {
            console.error('Error submitting ticket:', err);
            window.showAlert('System Error. Please check connection.');
        } finally {
            // Reset Button State
            modalConfirmBtn.disabled = false;
            modalConfirmBtn.innerHTML = '<i class="fa-solid fa-check"></i> Confirm';
        }
    });

    // PASSWORD RESET BUTTON LOGIC
    // 1. Open Modal
    if (pwdBtn) {
        pwdBtn.addEventListener('click', () => {
            // Clear previous inputs
            document.getElementById('pwd-current').value = '';
            document.getElementById('pwd-new').value = '';
            document.getElementById('pwd-confirm').value = '';
            pwdErrorMsg.style.display = 'none';

            pwdModal.style.display = 'flex';
            setTimeout(() => pwdModal.classList.add('show'), 10);
        });
    }

    // 2. Close Modal Functions
    function closePwdModal() {
        pwdModal.classList.remove('show');
        setTimeout(() => pwdModal.style.display = 'none', 300);
    }

    if (pwdCloseBtn) pwdCloseBtn.addEventListener('click', closePwdModal);
    if (pwdCancelBtn) pwdCancelBtn.addEventListener('click', closePwdModal);

    // 3. Toggle Password Visibility (Eye Icon)
    document.querySelectorAll('.toggle-password').forEach(icon => {
        icon.addEventListener('click', (e) => {
            const targetId = e.target.dataset.target;
            const input = document.getElementById(targetId);
            if (input.type === "password") {
                input.type = "text";
                e.target.classList.remove('fa-eye');
                e.target.classList.add('fa-eye-slash');
            } else {
                input.type = "password";
                e.target.classList.remove('fa-eye-slash');
                e.target.classList.add('fa-eye');
            }
        });
    });

    // 4. Submit Logic
    if (pwdSaveBtn) {
        pwdSaveBtn.addEventListener('click', async () => {
            const currentPass = document.getElementById('pwd-current').value;
            const newPass = document.getElementById('pwd-new').value;
            const confirmPass = document.getElementById('pwd-confirm').value;
            const username = sessionStorage.getItem('username');

            // Basic Validation
            if (!currentPass || !newPass || !confirmPass) {
                pwdErrorMsg.textContent = "All fields are required!";
                pwdErrorMsg.style.display = 'block';
                return;
            }

            if (newPass !== confirmPass) {
                pwdErrorMsg.textContent = "New passwords do not match!";
                pwdErrorMsg.style.display = 'block';
                return;
            }

            if (newPass.length < 6) {
                pwdErrorMsg.textContent = "Password must be at least 6 characters!";
                pwdErrorMsg.style.display = 'block';
                return;
            }

            // Button Loading State
            pwdSaveBtn.textContent = "Updating...";
            pwdSaveBtn.disabled = true;

            try {
                const result = await window.electronAPI.changePassword(username, currentPass, newPass);

                if (result.success) {
                    window.showAlert("✅ " + result.message, 'success');
                    closePwdModal();
                } else {
                    pwdErrorMsg.textContent = "❌ " + result.message;
                    pwdErrorMsg.style.display = 'block';
                }
            } catch (err) {
                console.error(err);
                window.showAlert("System Error");
            } finally {
                pwdSaveBtn.innerHTML = '<i class="fa-solid fa-save"></i> Update Password';
                pwdSaveBtn.disabled = false;
            }
        });
    }

    // Print button logic (this was already correct)
    modalPrintBtn.addEventListener('click', () => {
        const receiptHtml = document.getElementById('ticket-details-content').innerHTML;
        const printCss = `
            <style>
                body { font-family: 'Courier New', Courier, monospace; color: #000; margin: 0; width: 300px; }
                .ticket-receipt { padding: 0; }
                .divider { border-top: 2px dashed #000; margin: 10px 0; }
                .header { text-align: center; font-size: 1.1rem; font-weight: bold; }
                .info-line { display: flex; justify-content: space-between; font-size: 0.85rem; }
                table { width: 100%; border-collapse: collapse; font-size: 0.95rem; }
                th { border-top: 2px dashed #000; border-bottom: 2px dashed #000; }
                .col-spot { text-align: left; } .col-qty { text-align: center; } .col-amt { text-align: right; }
                .total-line { font-size: 1.4rem; font-weight: bold; text-align: right; border-top: 2px dashed #000; padding-top: 10px; margin-top: 5px; }
                .total-line span { font-size: 1rem; }
            </style>
        `;
        const completeHtml = `<html><head><title>Print Receipt</title>${printCss}</head><body>${receiptHtml}</body></html>`;
        window.electronAPI.printTicket(completeHtml);
    });

    // Make this function global or accessible
    window.deleteTicket = async function (ticketId) {
        const isConfirmed = await window.showConfirm("Are you sure you want to DELETE this ticket? Amount will be refunded.");

        if (!isConfirmed) {
            return; // Stop if user clicked Cancel
        }

        const username = sessionStorage.getItem('username');

        try {
            // Use the new electronAPI we created in preload.js
            const result = await window.electronAPI.cancelTicket(ticketId, username);

            if (result.success) {
                window.showAlert('✅ ' + result.message);

                // 1. Update Balance on Screen
                const balanceElement = document.getElementById('display-balance');
                const newBalanceFormatted = parseFloat(result.newBalance).toFixed(2);
                balanceElement.textContent = `₹ ${newBalanceFormatted}`;
                sessionStorage.setItem('balance', result.newBalance);

                // 2. Refresh the table
                const todayBtn = document.getElementById('ticket-today-btn');
                if (todayBtn) todayBtn.click();

            } else {
                window.showAlert('❌ ' + result.message);
            }
        } catch (err) {
            console.error(err);
            window.showAlert('System error during cancellation.');
        }
    };

    // --- 8. KEYBOARD SHORTCUTS --- //
    document.addEventListener('keydown', (e) => {
        // Global Shortcuts
        if (e.key === 'F6') { e.preventDefault(); submitBtn.click(); }
        if (e.key === 'F2') { e.preventDefault(); resetBtn.click(); }
        if (e.key === 'F7') { e.preventDefault(); claimBtn.click(); }
        if (e.key === 'F5') { e.preventDefault(); refreshBtn.click(); }
        if (e.key === 'F9') { e.preventDefault(); resultsBtn.click(); } // Fixed typo (e.kay -> e.key)
        if (e.key === 'F8') { e.preventDefault(); reprintBtn.click(); }

        // Escape to close ANY modal
        if (e.key === 'Escape') {
            e.preventDefault();
            closeModal(); // Close ticket modal
            claimModal.classList.remove('show'); // Close claim modal
            setTimeout(() => claimModal.style.display = 'none', 300);
            document.getElementById('results-modal').style.display = 'none'; // Close result modal
        }

        // 'Enter' Shortcut for Confirm (Only works if Submit Modal is open)
        if (e.key === 'Enter') {
            // Check if the submit modal is actually visible
            if (modal.style.display === 'flex' || modal.classList.contains('show')) {
                e.preventDefault();
                modalConfirmBtn.click();
            }
        }
    });

    // --- CLAIM SYSTEM LOGIC ---

    // 🔒 Fix: Add a locking variable to prevent double-claims
    let isClaiming = false;

    // 1. Key Enter for Claim Tickets
    if (barcodeInput) {
        barcodeInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault(); // Stop default form submit
                if (!isClaiming) {  // Only click if not already claiming
                    claimBtn.click();
                }
            }
        });
    }

    // 2. Claim Button Logic
    claimBtn.addEventListener('click', async () => {
        // 🔒 Security Check: Stop if already running
        if (isClaiming) return;

        const barcode = barcodeInput.value.trim();
        const username = sessionStorage.getItem('username');

        if (!barcode) {
            window.showAlert('Please enter or scan a Ticket Number!');
            return;
        }

        // Lock the function
        isClaiming = true;

        // Update UI
        const originalText = claimBtn.textContent;
        claimBtn.textContent = "Checking...";
        claimBtn.disabled = true;

        try {
            const result = await window.electronAPI.claimPrize(barcode, username);

            if (result.success) {
                // 1. Populate Modal Data
                document.getElementById('claim-win-amount').textContent = `₹ ${result.data.winAmount}`;
                document.getElementById('claim-ticket-id').textContent = result.data.ticketId;
                document.getElementById('claim-spot').textContent = result.data.spot;
                document.getElementById('claim-qty').textContent = result.data.qty;

                // 2. Update Balance Immediately
                const balanceElement = document.getElementById('display-balance');
                balanceElement.textContent = `₹ ${parseFloat(result.data.newBalance).toFixed(2)}`;
                sessionStorage.setItem('balance', result.data.newBalance);

                // 3. Show Modal
                claimModal.style.display = 'flex';
                setTimeout(() => claimModal.classList.add('show'), 10);

                // Clear input
                barcodeInput.value = '';
            } else {
                window.showAlert(result.message);
            }

        } catch (err) {
            console.error(err);
            window.showAlert('System Error during claim process.');
        } finally {
            // Unlock the function and reset UI
            isClaiming = false;
            claimBtn.textContent = "Claim"; // Reset text (was "Claim" or originalText)
            claimBtn.disabled = false;

            // Refocus for next scan
            setTimeout(() => barcodeInput.focus(), 100);
        }
    });

    // Close Claim Modal on Background Click
    claimModal.addEventListener('click', (e) => {
        // If clicking the overlay (background), close it
        if (e.target === claimModal) {
            claimModal.classList.remove('show');
            setTimeout(() => claimModal.style.display = 'none', 300);
        }
    });

    window.switchGameMode = function (mode) {
        if (isReloading) return; // Don't switch during result declaration

        ACTIVE_GAME_MODE = mode;
        console.log("Switched to Game Mode:", mode);

        // Update UI Buttons
        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.classList.remove('active');

            // Extract the number from the text "5 Min" -> 5
            const btnValue = parseInt(btn.textContent);

            // Compare strict equality (5 === 5)
            if (btnValue === mode) {
                btn.classList.add('active');
            }
        });

        // Reset UI
        resetSelections();

        // Force Timer Update Immediately
        updateTimers();

        // Refresh Results for this mode
        window.electronAPI.getLatestResults(ACTIVE_GAME_MODE).then(res => {
            if (res.success) updateTopSpotsUI(res.results);
        });
    };

    // --- 9. Initial Load ---
    calculateTotals();
    loadUserData();

    // Load results for default 5 min mode
    window.electronAPI.getLatestResults(5).then(res => {
        if (res.success) updateTopSpotsUI(res.results);
    });

    setInterval(updateTimers, 1000);
    updateTimers();
});