// preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    login: (username, password) => ipcRenderer.invoke('login', username, password),
    submitTicket: (payload) => ipcRenderer.invoke('submit-ticket', payload),
    printTicket: (receiptHtml) => ipcRenderer.send('print-ticket', receiptHtml),

    getLatestResults: (gameMode, gameType = 'classic') => ipcRenderer.invoke('get-latest-results', gameMode, gameType),
    getFilteredResults: (dateString, gameMode, gameType = 'classic') => ipcRenderer.invoke('get-filtered-results', dateString, gameMode, gameType),
    getTicketHistory: (username, dateString, gameMode, gameType = 'classic') => ipcRenderer.invoke('get-ticket-history', username, dateString, gameMode, gameType),
    getAccountLedger: (username, startDate, endDate) => ipcRenderer.invoke('get-account-ledger', username, startDate, endDate),
    claimPrize: (ticketId, username) => ipcRenderer.invoke('claim-prize', ticketId, username),
    getGameSettings: () => ipcRenderer.invoke('get-game-settings'),
    changePassword: (username, currentPass, newPass) => ipcRenderer.invoke('change-password', username, currentPass, newPass),
    cancelTicket: (ticketId, username) => ipcRenderer.invoke('cancel-ticket', ticketId, username)
});