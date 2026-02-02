// ==================== GLOBAL STATE ====================
let ACTIVE_THOUSAND = 1000;
let SELECTED_NUMBERS = {}; // Stores QUANTITY, not Amount in Rupees
let BLOCK_AMOUNT = 0; // Stores Block QUANTITY
let LP_MODE_ACTIVE = false;
let CURRENT_FILTER = 'all'; // 'all', 'even', 'odd'
const PRICE_PER_SPOT = 2; // Updated to ₹2
const ACTIVE_GAME_MODE = 10; // Fixed 10-minute draws

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', () => {
    loadSessionData();
    setupTenMinuteTimer();
    fetchAndDisplayLatestResults();
    selectThousandRange(1000); // Default to 1000-1999
    setupEventListeners();
    setupKeyboardShortcuts();

    // Auto-refresh results every 30 seconds
    setInterval(fetchAndDisplayLatestResults, 30000);
});

// ==================== SESSION DATA ====================
function loadSessionData() {
    const username = sessionStorage.getItem('username');
    const balance = sessionStorage.getItem('balance');
    const userId = sessionStorage.getItem('userId');

    if (!username) {
        alert('Session expired. Please log in again.');
        window.location.href = '../index.html';
        return;
    }

    const numericUserId = parseInt(userId) || 0;
    const formattedUserId = `S${900 + numericUserId}`;
    const displayString = `${username.toUpperCase()} SKILL GAME CENTRE ${formattedUserId}`;

    document.getElementById('display-username').textContent = displayString;
    document.getElementById('display-balance').textContent = `₹${parseFloat(balance || 0).toFixed(2)}`;
}

// ==================== 10-MINUTE TIMER (FIXED) ====================
function setupTenMinuteTimer() {
    setInterval(() => {
        updateTimerDisplay();
    }, 1000);
    updateTimerDisplay();
}

function updateTimerDisplay() {
    const now = new Date();
    const timeString = now.toLocaleTimeString('en-US', {
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true
    });
    document.getElementById('draw-end-time').textContent = timeString;

    const DRAW_INTERVAL_MS = 10 * 60 * 1000;
    const currentTimeMs = now.getTime();
    const nextDrawMs = Math.ceil(currentTimeMs / DRAW_INTERVAL_MS) * DRAW_INTERVAL_MS;
    const timeRemainingMs = nextDrawMs - currentTimeMs;

    const minutesRemaining = Math.floor(timeRemainingMs / 60000);
    const secondsRemaining = Math.floor((timeRemainingMs % 60000) / 1000);

    const countdownElement = document.getElementById('countdown-timer');
    countdownElement.textContent = `${minutesRemaining}:${secondsRemaining.toString().padStart(2, '0')}`;

    const submitBtn = document.getElementById('submit-btn-sidebar');
    const submitBtnNav = document.getElementById('submit-btn-nav');
    const inputs = document.querySelectorAll('.cell-input, .block-input');

    if (timeRemainingMs < 30000) {
        // Frozen
        countdownElement.className = 'countdown-timer frozen';
        if (submitBtn) { submitBtn.disabled = true; submitBtn.style.opacity = '0.5'; }
        if (submitBtnNav) { submitBtnNav.disabled = true; submitBtnNav.style.opacity = '0.5'; }
        inputs.forEach(input => input.disabled = true);
    } else if (timeRemainingMs < 60000) {
        // Warning
        countdownElement.className = 'countdown-timer warning';
        if (submitBtn) { submitBtn.disabled = false; submitBtn.style.opacity = '1'; }
        if (submitBtnNav) { submitBtnNav.disabled = false; submitBtnNav.style.opacity = '1'; }
        inputs.forEach(input => input.disabled = false);
    } else {
        // Normal
        countdownElement.className = 'countdown-timer';
        if (submitBtn) { submitBtn.disabled = false; submitBtn.style.opacity = '1'; }
        if (submitBtnNav) { submitBtnNav.disabled = false; submitBtnNav.style.opacity = '1'; }
        inputs.forEach(input => input.disabled = false);
    }

    if (timeRemainingMs < 1000) {
        fetchAndDisplayLatestResults();
    }
}

// ==================== RESULTS STRIP ====================
async function fetchAndDisplayLatestResults() {
    try {
        if (!window.electronAPI) return;
        const response = await window.electronAPI.getLatestResults(10, 'range');
        if (response.success && response.results && response.results.length > 0) {
            const latestDraw = response.results[0];
            const rangeStarts = [0, 1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000];
            rangeStarts.forEach((rangeStart, index) => {
                const resultElement = document.getElementById(`result-${rangeStart}`);
                if (resultElement && latestDraw.winningNumbers && latestDraw.winningNumbers[index] !== undefined) {
                    resultElement.textContent = latestDraw.winningNumbers[index];
                }
            });
        }
    } catch (error) {
        console.error('Failed to fetch results:', error);
    }
}

// ==================== THOUSAND RANGE SELECTION ====================
function selectThousandRange(rangeStart) {
    ACTIVE_THOUSAND = rangeStart;

    // Update tab styling safely
    document.querySelectorAll('.thousand-tab').forEach(tab => {
        tab.classList.remove('active');
        // Check if this tab matches the rangeStart
        if (tab.getAttribute('onclick') && tab.getAttribute('onclick').includes(rangeStart.toString())) {
            tab.classList.add('active');
        }
    });

    generateHundredCheckboxes(rangeStart);
    handleHundredCheckboxChange(); // Will trigger grid render
}

// ==================== SIDEBAR GENERATION ====================
function generateHundredCheckboxes(thousandStart) {
    const container = document.getElementById('hundred-checkboxes-container');
    container.innerHTML = '';

    for (let i = 0; i < 10; i++) {
        const hundredStart = thousandStart + (i * 100);
        const hundredEnd = hundredStart + 99;

        const label = document.createElement('label');
        label.className = 'sidebar-item';

        const input = document.createElement('input');
        input.type = 'checkbox';
        input.className = 'hundred-checkbox';
        input.dataset.hundred = hundredStart;

        // Select the first range (e.g. 1000-1099) by default
        if (i === 0) {
            input.checked = true;
        }

        // Attach event listener directly
        input.addEventListener('change', handleHundredCheckboxChange);

        const span = document.createElement('span');
        span.textContent = `${hundredStart}-${hundredEnd}`;

        label.appendChild(input);
        label.appendChild(span);
        container.appendChild(label);
    }

    const selectAll = document.getElementById('select-all-hundreds');
    if (selectAll) selectAll.checked = false;
}

function handleHundredCheckboxChange() {
    // Look for checkboxes inside the container we just populated
    const container = document.getElementById('hundred-checkboxes-container');
    const checkedBoxes = container.querySelectorAll('.hundred-checkbox:checked');
    const selectedHundreds = Array.from(checkedBoxes).map(cb => parseInt(cb.dataset.hundred));

    // Toggle scrollable class on grid container
    const gridContainer = document.getElementById('betting-grid-container');
    if (selectedHundreds.length > 1) {
        gridContainer.classList.add('scrollable');
    } else {
        gridContainer.classList.remove('scrollable');
    }

    if (selectedHundreds.length === 0) {
        gridContainer.innerHTML =
            '<div style="color:#aaa; text-align:center; padding:50px; flex:1; display:flex; align-items:center; justify-content:center;">Select a range from the sidebar</div>';
    } else {
        renderBettingGrid(selectedHundreds);
    }
}

function toggleAllHundreds() {
    const selectAll = document.getElementById('select-all-hundreds');
    document.querySelectorAll('.hundred-checkbox').forEach(cb => {
        cb.checked = selectAll.checked;
    });
    handleHundredCheckboxChange();
}

// ==================== GRID RENDERING ====================
function renderBettingGrid(hundredRanges) {
    const container = document.getElementById('betting-grid-container');
    container.innerHTML = '';

    // Create Sticky Header Row (Universal & Column Blocks)
    createHeaderRow(container);

    hundredRanges.sort((a, b) => a - b).forEach(hundredStart => {
        for (let rowIndex = 0; rowIndex < 10; rowIndex++) {
            const rowStartNumber = hundredStart + (rowIndex * 10);
            createAndAppendRow(container, rowStartNumber);
        }
    });

    // Apply current filter after rendering
    applyVisualFilter();
}

function createHeaderRow(container) {
    const headerRow = document.createElement('div');
    headerRow.className = 'header-row';

    // 1. Universal Block Wrapper (Left Side) - Spans Label + Row Block
    const uniWrapper = document.createElement('div');
    uniWrapper.className = 'universal-block-wrapper';

    const uniLabel = document.createElement('div');
    uniLabel.className = 'header-label-small header-label-universal';
    uniLabel.textContent = 'Universal Block';
    uniWrapper.appendChild(uniLabel);

    const uniInput = document.createElement('input');
    uniInput.type = 'number';
    uniInput.className = 'block-input';
    uniInput.placeholder = 'ALL';
    uniInput.style.backgroundColor = '#fff';
    uniInput.style.color = '#000';
    uniInput.style.fontWeight = '900';
    uniInput.onchange = (e) => fillAllWithAmount(e.target.value);
    uniWrapper.appendChild(uniInput);

    headerRow.appendChild(uniWrapper);

    // 2. Column Blocks Container (Right Side)
    const colsContainer = document.createElement('div');
    colsContainer.className = 'header-cols-container';

    for (let i = 0; i < 10; i++) {
        const colCell = document.createElement('div');
        colCell.className = 'col-block-cell';

        const label = document.createElement('div');
        label.className = 'header-label-small';
        label.textContent = 'Block';
        colCell.appendChild(label);

        const input = document.createElement('input');
        input.type = 'number';
        input.className = 'block-input';
        input.placeholder = '0';
        input.onchange = (e) => fillColumnWithAmount(i, e.target.value);
        colCell.appendChild(input);

        colsContainer.appendChild(colCell);
    }

    headerRow.appendChild(colsContainer);
    container.appendChild(headerRow);
}

// ==================== COLUMN & UNIVERSAL FILL LOGIC ====================

function fillColumnWithAmount(colIndex, qty) {
    qty = parseInt(qty) || 0;

    // Iterate over all visible rows in the grid
    const rows = document.querySelectorAll('.grid-row-wrapper');
    rows.forEach(row => {
        const cellsContainer = row.querySelector('.grid-cells-row');
        if (!cellsContainer) return;

        const cell = cellsContainer.children[colIndex];
        if (cell) {
            const spotNumber = parseInt(cell.dataset.spot);
            if (checkIfFiltered(spotNumber)) return; // Skip filtered

            const input = cell.querySelector('.cell-input');
            if (qty > 0) {
                input.value = qty;
                SELECTED_NUMBERS[spotNumber] = qty;
                cell.classList.add('selected');
            } else {
                if (input.value) { // Only clear if it was set
                    input.value = '';
                    delete SELECTED_NUMBERS[spotNumber];
                    cell.classList.remove('selected');
                }
            }
        }
    });
    updateCheckoutTotals();
}

function fillAllWithAmount(qty) {
    qty = parseInt(qty) || 0;

    const cells = document.querySelectorAll('.grid-cell');
    cells.forEach(cell => {
        const spotNumber = parseInt(cell.dataset.spot);
        if (checkIfFiltered(spotNumber)) return; // Skip filtered

        const input = cell.querySelector('.cell-input');
        if (qty > 0) {
            input.value = qty;
            SELECTED_NUMBERS[spotNumber] = qty;
            cell.classList.add('selected');
        } else {
            if (input.value) {
                input.value = '';
                delete SELECTED_NUMBERS[spotNumber];
                cell.classList.remove('selected');
            }
        }
    });
    updateCheckoutTotals();
}

function createAndAppendRow(container, rowStartNumber) {
    const rowDiv = document.createElement('div');
    rowDiv.className = 'grid-row-wrapper';

    const label = document.createElement('div');
    label.className = 'row-label';
    label.textContent = `${rowStartNumber}-${rowStartNumber + 9}`;
    rowDiv.appendChild(label);

    const blockCell = document.createElement('div');
    blockCell.className = 'block-input-cell';
    blockCell.innerHTML = `
        <div class="block-label-small">Block</div>
        <input 
            type="number" 
            class="block-input" 
            placeholder="0"
            onchange="fillRowWithAmount(${rowStartNumber}, this.value)"
        />
    `;
    rowDiv.appendChild(blockCell);

    const cellsContainer = document.createElement('div');
    cellsContainer.className = 'grid-cells-row';

    for (let i = 0; i < 10; i++) {
        const spotNumber = rowStartNumber + i;
        const cell = createGridCell(spotNumber);
        cellsContainer.appendChild(cell);
    }

    rowDiv.appendChild(cellsContainer);
    container.appendChild(rowDiv);
}

function createGridCell(spotNumber) {
    const cell = document.createElement('div');
    cell.className = 'grid-cell';
    cell.dataset.spot = spotNumber;

    const existingQty = SELECTED_NUMBERS[spotNumber] || '';
    if (existingQty) cell.classList.add('selected');

    cell.innerHTML = `
        <div class="cell-number">${spotNumber}</div>
        <input 
            type="number" 
            class="cell-input" 
            placeholder="0"
            value="${existingQty}"
            oninput="updateBet(${spotNumber}, this.value)"
            onclick="handleCellClick(${spotNumber}, this)"
        />
    `;
    return cell;
}

// ==================== FILTER LOGIC ====================
function applyVisualFilter() {
    const cells = document.querySelectorAll('.grid-cell');
    cells.forEach(cell => {
        const spot = parseInt(cell.dataset.spot);
        const isEven = (spot % 2 === 0);

        let shouldDim = false;
        if (CURRENT_FILTER === 'even' && !isEven) {
            shouldDim = true;
        } else if (CURRENT_FILTER === 'odd' && isEven) {
            shouldDim = true;
        } else {
            shouldDim = false;
        }

        if (shouldDim) {
            cell.classList.add('dimmed');
        } else {
            cell.classList.remove('dimmed');
        }
    });
}

// ==================== BETTING LOGIC ====================
function updateBet(spotNumber, qty) {
    if (checkIfFiltered(spotNumber)) return; // Prevent betting if filtered out

    qty = parseInt(qty) || 0;
    const cell = document.querySelector(`.grid-cell[data-spot="${spotNumber}"]`);

    if (qty > 0) {
        SELECTED_NUMBERS[spotNumber] = qty;
        if (cell) cell.classList.add('selected');
    } else {
        delete SELECTED_NUMBERS[spotNumber];
        if (cell) cell.classList.remove('selected');
    }
    updateCheckoutTotals();
}

function handleCellClick(spotNumber, inputElement) {
    if (checkIfFiltered(spotNumber)) return;

    if (LP_MODE_ACTIVE && BLOCK_AMOUNT > 0) {
        const cell = document.querySelector(`.grid-cell[data-spot="${spotNumber}"]`);
        if (cell) {
            const input = cell.querySelector('.cell-input');
            input.value = BLOCK_AMOUNT;
            updateBet(spotNumber, BLOCK_AMOUNT);
        }
    }
}

function fillRowWithAmount(rowStartNumber, qty) {
    qty = parseInt(qty) || 0;
    for (let i = 0; i < 10; i++) {
        const spotNumber = rowStartNumber + i;
        if (checkIfFiltered(spotNumber)) continue; // Skip filtered numbers

        const cell = document.querySelector(`.grid-cell[data-spot="${spotNumber}"]`);
        if (cell) {
            const input = cell.querySelector('.cell-input');
            if (qty > 0) {
                input.value = qty;
                SELECTED_NUMBERS[spotNumber] = qty;
                cell.classList.add('selected');
            } else {
                input.value = '';
                delete SELECTED_NUMBERS[spotNumber];
                cell.classList.remove('selected');
            }
        }
    }
    updateCheckoutTotals();
}

function checkIfFiltered(spotNumber) {
    const isEven = (spotNumber % 2 === 0);
    if (CURRENT_FILTER === 'even' && !isEven) return true;
    if (CURRENT_FILTER === 'odd' && isEven) return true;
    return false;
}

function updateCheckoutTotals() {
    let totalSpots = 0;
    let totalQty = 0;

    Object.values(SELECTED_NUMBERS).forEach(qty => {
        totalSpots++;
        totalQty += qty;
    });

    // Total Amount = Total Quantity * Price Per Spot (₹2)
    const totalAmount = totalQty * PRICE_PER_SPOT;

    document.getElementById('total-spots').textContent = totalSpots;
    document.getElementById('total-quantity').textContent = totalQty;
    document.getElementById('total-amount').textContent = `₹${totalAmount}`;
}

// ==================== LP MODE ====================
function toggleLP() {
    BLOCK_AMOUNT = parseInt(document.getElementById('block-amount-input').value) || 0;
    if (BLOCK_AMOUNT <= 0) {
        alert(`Please enter valid Block Quantity first`);
        LP_MODE_ACTIVE = false;
        return;
    }
    LP_MODE_ACTIVE = !LP_MODE_ACTIVE;
    const lpBtn = document.getElementById('lp-button');
    if (LP_MODE_ACTIVE) {
        lpBtn.classList.add('active');
        lpBtn.textContent = 'LP ON';
    } else {
        lpBtn.classList.remove('active');
        lpBtn.textContent = 'LP';
    }
}

// ==================== EVENT LISTENERS ====================
function setupEventListeners() {
    const blockInput = document.getElementById('block-amount-input');
    if (blockInput) {
        blockInput.addEventListener('input', (e) => {
            BLOCK_AMOUNT = parseInt(e.target.value) || 0;
        });
    }

    // Filter Radio Buttons
    const filterRadios = document.querySelectorAll('input[name="filter"]');
    filterRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            CURRENT_FILTER = e.target.value;
            applyVisualFilter();
        });
    });

    const submitBtn = document.getElementById('submit-btn-sidebar');
    const submitBtnNav = document.getElementById('submit-btn-nav');
    if (submitBtn) submitBtn.addEventListener('click', handleSubmit);
    if (submitBtnNav) submitBtnNav.addEventListener('click', handleSubmit);

    const resetBtn = document.getElementById('reset-btn');
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            if (confirm('Clear all bets?')) {
                SELECTED_NUMBERS = {};
                handleHundredCheckboxChange(); // Re-render
            }
        });
    }

    const claimBtn = document.getElementById('claim-btn');
    if (claimBtn) {
        claimBtn.addEventListener('click', handleClaimPrize);
    }
}

// ==================== TICKET SUBMISSION ====================
async function handleSubmit() {
    if (Object.keys(SELECTED_NUMBERS).length === 0) {
        alert('Please select at least one number!');
        return;
    }

    const totalAmountText = document.getElementById('total-amount').textContent.replace('₹', '').trim();
    const totalAmount = parseFloat(totalAmountText) || 0;
    const balance = parseFloat(sessionStorage.getItem('balance') || 0);

    if (totalAmount > balance) {
        alert(`Insufficient balance!\nRequired: ₹${totalAmount}\nAvailable: ₹${balance.toFixed(2)}`);
        return;
    }

    const confirmed = confirm(
        `Submit Ticket?\n\nTotal Spots: ${Object.keys(SELECTED_NUMBERS).length}\nTotal Amount: ₹${totalAmount}\n\nConfirm?`
    );
    if (!confirmed) return;

    document.getElementById('loading-modal').style.display = 'flex';

    const now = new Date();
    const DRAW_INTERVAL_MS = 10 * 60 * 1000;
    const currentTimeMs = now.getTime();
    const nextDrawMs = Math.ceil(currentTimeMs / DRAW_INTERVAL_MS) * DRAW_INTERVAL_MS;
    const drawEndTime = new Date(nextDrawMs);

    // Convert Quantity to Amount (Money) for Server
    // Server expects 'amount' to be the money to deduct
    const currentPricePerSpot = PRICE_PER_SPOT;

    const payload = {
        username: sessionStorage.getItem('username'),
        ticketData: {
            spots: Object.keys(SELECTED_NUMBERS).map(spotId => ({
                spotId: spotId,
                amount: SELECTED_NUMBERS[spotId] * currentPricePerSpot // Convers Qty to Rupees
            })),
            drawEndTime: drawEndTime.toISOString()
        },
        gameMode: 10,
        gameType: 'range'
    };

    try {
        const result = await window.electronAPI.submitTicket(payload);

        if (result.success) {
            const newBalance = result.newBalance || balance - totalAmount;
            sessionStorage.setItem('balance', newBalance);
            document.getElementById('display-balance').textContent = `₹${parseFloat(newBalance).toFixed(2)}`;

            printRangeTicket(result.newTicketId || 'PENDING', result.drawId || 'PENDING', SELECTED_NUMBERS, totalAmount);

            SELECTED_NUMBERS = {};
            handleHundredCheckboxChange(); // Clear grid

            alert(`✅ Ticket ${result.newTicketId || 'PENDING'} submitted successfully!`);
        } else {
            alert(`❌ Error: ${result.message || 'Submission failed'}`);
        }
    } catch (err) {
        console.error(err);
        alert('System Error during submission.');
    } finally {
        document.getElementById('loading-modal').style.display = 'none';
    }
}

// ==================== RECEIPT PRINTING ====================
function printRangeTicket(ticketId, drawId, bets, total) {
    const username = sessionStorage.getItem('username') || 'USER';
    const date = new Date().toLocaleString('en-IN');

    let receiptHTML = `
        <div style="font-family: 'Courier New'; width: 300px; padding: 10px; font-size: 12px; border:1px solid #000;">
            <center>
                <h3>WINZONE RANGE</h3>
                <div>${username.toUpperCase()}</div>
                <div>--------------------------------</div>
                <div style="text-align:left;">TICKET: ${ticketId}</div>
                <div style="text-align:left;">DRAW: ${drawId}</div>
                <div style="text-align:left;">DATE: ${date}</div>
                <div>--------------------------------</div>
            </center>
            <table style="width:100%; border-collapse: collapse;">
                <tr style="border-bottom:1px dashed #000;">
                    <th align="left">NUMBER</th>
                    <th align="center">QTY</th>
                    <th align="right">AMT</th>
                </tr>
    `;

    for (const [num, qty] of Object.entries(bets)) {
        const amt = qty * PRICE_PER_SPOT; // Calculate rupees for check
        receiptHTML += `<tr>
            <td>${num}</td>
            <td align="center">${qty}</td>
            <td align="right">₹${amt}</td>
        </tr>`;
    }

    receiptHTML += `
            </table>
            <div>--------------------------------</div>
            <div style="font-size: 16px; font-weight: bold; text-align: right;">TOTAL: ₹${total}</div>
            <center>
                <div style="margin-top: 10px; font-size:10px;">Prize: ₹18 per Qty</div>
                <div>THANK YOU</div>
            </center>
        </div>
    `;

    if (window.electronAPI && window.electronAPI.printTicket) {
        window.electronAPI.printTicket(receiptHTML);
    }
}

// ==================== CLAIM PRIZE ====================
async function handleClaimPrize() {
    const ticketId = document.getElementById('barcode-input').value.trim();
    if (!ticketId) { alert('Please enter a ticket ID'); return; }
    const username = sessionStorage.getItem('username');
    try {
        const response = await window.electronAPI.claimPrize(ticketId, username);
        if (response.success) {
            alert(`🎉 Prize Claimed!\n\nAmount: ₹${response.winningAmount}\nNew Balance: ₹${response.newBalance}`);
            sessionStorage.setItem('balance', response.newBalance);
            document.getElementById('display-balance').textContent = `₹${parseFloat(response.newBalance).toFixed(2)}`;
            document.getElementById('barcode-input').value = '';
        } else {
            alert(`❌ Claim Failed:\n${response.message || 'Unknown error'}`);
        }
    } catch (error) {
        console.error('Claim error:', error);
        alert('Connection error. Please try again.');
    }
}

// ==================== KEYBOARD SHORTCUTS ====================
function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT') return;
        switch (e.key) {
            case 'F6':
                e.preventDefault();
                const submitBtn = document.getElementById('submit-btn-sidebar');
                if (submitBtn && !submitBtn.disabled) submitBtn.click();
                break;
            case 'F2':
                e.preventDefault();
                const resetBtn = document.getElementById('reset-btn');
                if (resetBtn) resetBtn.click();
                break;
            case 'F5':
                e.preventDefault();
                location.reload();
                break;
            case 'F9':
                e.preventDefault();
                const resultBtn = document.getElementById('result-btn');
                if (resultBtn) resultBtn.click();
                break;
        }
    });
}