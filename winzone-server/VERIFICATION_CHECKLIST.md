# ✅ WinZone V2 Dashboard - Verification Checklist

## 📋 Pre-Flight Checklist

Use this checklist to ensure everything is working correctly before using the V2 dashboard in production.

---

## ✅ PHASE 1: Environment Setup

### 1.1 Node.js & npm
```bash
# Check Node.js version (should be 14+ or higher)
node --version

# Check npm version
npm --version
```
- [ ] Node.js is installed and version is displayed
- [ ] npm is installed and version is displayed

### 1.2 Dependencies
```bash
# Verify node_modules exists
dir node_modules
```
- [ ] `node_modules` folder exists
- [ ] If missing, run: `npm install`

---

## ✅ PHASE 2: File Structure

### 2.1 Core Files (Required - Should Already Exist)
- [ ] `db_pool.js` - Database connection
- [ ] `result_server.js` - Game engine
- [ ] `api_server.js` - API endpoints (UPDATED)
- [ ] `package.json` - Dependencies

### 2.2 Original Dashboard Files (Unchanged)
- [ ] `views/admin_dashboard.html` - Original UI
- [ ] `public/admin_dashboard.js` - Original logic

### 2.3 New V2 Dashboard Files (Added)
- [ ] `views/admin_dashboard_v2.html` - Premium UI
- [ ] `public/admin_dashboard_v2.js` - Enhanced logic

### 2.4 Documentation Files (Reference)
- [ ] `DASHBOARD_V2_README.md` - Features guide
- [ ] `INTEGRATION_GUIDE.md` - Setup instructions
- [ ] `VERIFICATION_CHECKLIST.md` - This file
- [ ] `start_winzone_v2.bat` - Auto-start script

---

## ✅ PHASE 3: Database Connectivity

### 3.1 Connection Test
```bash
# Start result_server.js and look for:
node result_server.js
```

**Expected Output:**
```
✅ DATABASE POOL CONNECTED SUCCESSFULLY
✅ Result Server Started (Multi-Mode: 5, 10, 15 min).
🚀 Starting Scheduler for 5 min game...
🚀 Starting Scheduler for 10 min game...
🚀 Starting Scheduler for 15 min game...
```

- [ ] Database pool connects successfully
- [ ] No connection errors
- [ ] All 3 schedulers start (5, 10, 15 min)

### 3.2 Database Configuration
Check `db_pool.js` settings:

```javascript
host: 'winzone-mumbai.cjwkco8y22at.ap-south-1.rds.amazonaws.com'
user: 'winzone_user'
password: 'Sumit848587'  // Your actual password
database: 'winzone'
port: 3306
```

- [ ] Host is correct
- [ ] Username is correct
- [ ] Password is correct
- [ ] Database name is 'winzone'
- [ ] RDS instance is running
- [ ] Security group allows your IP

### 3.3 Required Tables
Verify tables exist in your database:

```sql
SHOW TABLES;
```

Required tables:
- [ ] `users` table exists
- [ ] `draws` table exists
- [ ] `tickets` table exists
- [ ] `game_settings` table exists

### 3.4 Users Table Structure
```sql
DESCRIBE users;
```

Required columns:
- [ ] `user_id` (Primary Key)
- [ ] `username`
- [ ] `password_hash`
- [ ] `role`
- [ ] `balance`
- [ ] `is_active`
- [ ] `store_address`
- [ ] `contact_no`
- [ ] `target_rtp` ⭐ (NEW - should be DECIMAL(5,2))
- [ ] `created_at`

**If `target_rtp` is missing, run:**
```sql
ALTER TABLE users ADD COLUMN target_rtp DECIMAL(5,2) DEFAULT 90.00;
```

---

## ✅ PHASE 4: Server Startup

### 4.1 Result Server
```bash
# Terminal 1
node result_server.js
```

Check for:
- [ ] "✅ DATABASE POOL CONNECTED SUCCESSFULLY"
- [ ] "✅ Result Server Started"
- [ ] Three scheduler messages (5, 10, 15 min)
- [ ] No errors in red
- [ ] Process keeps running (doesn't exit)

### 4.2 API Server
```bash
# Terminal 2
node api_server.js
```

Check for:
- [ ] "✅ DATABASE POOL CONNECTED SUCCESSFULLY"
- [ ] "🚀 API Server running on port 3000"
- [ ] No errors in red
- [ ] Process keeps running

---

## ✅ PHASE 5: Original Dashboard (Backward Compatibility)

### 5.1 Access Original Dashboard
1. Open browser: `http://localhost:3000/`
2. Login with admin credentials
3. Should redirect to: `http://localhost:3000/admin_dashboard`

**Verify:**
- [ ] Login page loads
- [ ] Can login successfully
- [ ] Redirects to original dashboard
- [ ] Dashboard loads without errors
- [ ] Stats display (Total Users, Sales, Profit)
- [ ] Draw history table shows data (or empty if no draws)
- [ ] User management works
- [ ] Force winner panel visible

**Critical:** Original dashboard MUST work! Don't proceed if it doesn't.

---

## ✅ PHASE 6: New V2 Dashboard

### 6.1 Access V2 Dashboard
After logging in, navigate to: `http://localhost:3000/admin_dashboard_v2`

**Verify:**
- [ ] Page loads successfully
- [ ] No 404 error
- [ ] Premium dark theme displays
- [ ] Sidebar is visible with purple gradient
- [ ] WinZone logo with gold crown shows
- [ ] Navigation items visible

### 6.2 Dashboard Tab
Click "Dashboard" in sidebar

**Verify:**
- [ ] 4 stat cards display:
  - [ ] Total Retailers
  - [ ] Today's Sale  
  - [ ] Net Profit
  - [ ] Next Draw
- [ ] Draw history table loads
- [ ] Mode filter dropdown works (5/10/15 Min)
- [ ] Date filter works
- [ ] "Today" and "Search" buttons work
- [ ] No console errors (Press F12)

### 6.3 Analytics Tab ⭐
Click "Analytics" in sidebar

**Verify:**
- [ ] Page transitions smoothly
- [ ] 2 hero stat cards display:
  - [ ] Total Revenue (7 Days)
  - [ ] Average Daily Profit
- [ ] Sales & Profit Flow chart renders
- [ ] Game Mode Distribution (doughnut) chart renders
- [ ] Hourly Sales Pattern (bar) chart renders
- [ ] Top Retailers (horizontal bar) chart renders
- [ ] Charts are interactive (hover shows tooltips)
- [ ] No "Chart is not defined" errors

**Note:** If database is empty, charts will show demo data - this is normal!

### 6.4 User Management Tab
Click "User Management" in sidebar

**Verify:**
- [ ] User table loads
- [ ] Search box works
- [ ] "Add New User" button visible
- [ ] Each user row shows:
  - [ ] User ID (S90XXX format)
  - [ ] Username
  - [ ] Balance
  - [ ] Contact
  - [ ] Status (Active/Blocked badge)
  - [ ] "Manage" button

### 6.5 User Profile Modal
Click "Manage" on any user

**Verify:**
- [ ] Modal opens with animation
- [ ] Profile header shows:
  - [ ] Avatar with initial
  - [ ] Username
  - [ ] User ID
  - [ ] Status
- [ ] 3 stat cards display:
  - [ ] Current Balance
  - [ ] Lifetime Sales
  - [ ] Lifetime Commission
- [ ] Store details section shows:
  - [ ] Contact number
  - [ ] Joined date
  - [ ] Address
- [ ] Action buttons work:
  - [ ] Add Funds
  - [ ] View Ledger
  - [ ] Clear Balance
  - [ ] Block/Unblock
  - [ ] Set Payout % (RTP)
- [ ] Close button (X) works

### 6.6 Live Draw Control Tab
Click "Live Draw Control" in sidebar

**Verify:**
- [ ] Timer card shows countdown
- [ ] Collection amount displays
- [ ] Force Winner panel visible
- [ ] Game mode selector (5/10/15 Min)
- [ ] Spot selector (A0-J9)
- [ ] "Set Winner" button works
- [ ] Admin override warning shows

### 6.7 Activity Logs Tab
Click "Activity Logs" in sidebar

**Verify:**
- [ ] Page loads
- [ ] Table structure displays
- [ ] Shows message if no logs yet

---

## ✅ PHASE 7: Functionality Tests

### 7.1 Add New User
1. Go to User Management
2. Click "Add New User"
3. Fill form:
   - Username: Test123 (must have uppercase + number)
   - Password: test123
   - Address: Test Store
   - Contact: 9876543210
4. Click "Create User"

**Verify:**
- [ ] Modal opens
- [ ] Form validation works
- [ ] Success notification appears
- [ ] Modal closes
- [ ] New user appears in table
- [ ] Can refresh and user still exists

### 7.2 Add Balance to User
1. Click "Manage" on test user
2. Click "Add Funds"
3. Enter amount: 1000
4. Confirm

**Verify:**
- [ ] Prompt appears
- [ ] Success notification shows
- [ ] Balance updates in profile
- [ ] Balance updates in table
- [ ] Database updated (check original dashboard)

### 7.3 View Account Ledger
1. Click "Manage" on any user
2. Click "Ledger" button
3. Select date range (today to today)
4. Click "Search"

**Verify:**
- [ ] Ledger modal opens
- [ ] Date pickers work
- [ ] Table loads
- [ ] Shows data if user has sales
- [ ] Shows "No data" message if empty
- [ ] Totals row displays (if data exists)

### 7.4 Force Winner
1. Go to Live Draw Control
2. Select game mode: 10 Min
3. Select spot: D3
4. Click "Set Winner"
5. Confirm warning

**Verify:**
- [ ] Warning confirmation appears
- [ ] Success notification shows
- [ ] No errors in console
- [ ] Database updated (verify in draws table)

### 7.5 Set Custom RTP
1. Go to User Management
2. Click "Manage" on test user
3. Click "Set Payout % (RTP)"
4. Enter: 95
5. Confirm

**Verify:**
- [ ] Prompt appears
- [ ] Success notification shows
- [ ] Value saves to database
- [ ] Check database: `SELECT target_rtp FROM users WHERE username='Test123'`

---

## ✅ PHASE 8: Browser Compatibility

Test in multiple browsers:

### Chrome
- [ ] Dashboard loads
- [ ] Charts render
- [ ] Animations smooth
- [ ] No console errors

### Firefox
- [ ] Dashboard loads
- [ ] Charts render
- [ ] Animations smooth
- [ ] No console errors

### Edge
- [ ] Dashboard loads
- [ ] Charts render
- [ ] Animations smooth
- [ ] No console errors

**Recommended:** Chrome or Edge for best experience

---

## ✅ PHASE 9: Performance Tests

### 9.1 Page Load Speed
- [ ] Initial load < 3 seconds
- [ ] Chart rendering < 2 seconds
- [ ] Table with 100+ users loads smoothly
- [ ] No lag when switching tabs

### 9.2 Memory Usage
Open browser Task Manager (Shift + Esc in Chrome)
- [ ] Memory usage < 200MB
- [ ] No memory leaks after 5 minutes

### 9.3 Auto-Refresh
Leave dashboard open for 2 minutes
- [ ] Stats auto-refresh
- [ ] No errors after refresh
- [ ] Charts update if new data

---

## ✅ PHASE 10: Security Tests

### 10.1 Authentication
1. Logout from dashboard
2. Try to access: `http://localhost:3000/admin_dashboard_v2` directly

**Verify:**
- [ ] Redirects to login page
- [ ] Cannot access without login
- [ ] Session expires after inactivity

### 10.2 API Endpoints
Try accessing API endpoints directly:
```
http://localhost:3000/api/analytics
http://localhost:3000/api/users
```

**Verify:**
- [ ] Returns "Unauthorized" if not logged in
- [ ] Session check works
- [ ] No data leaks

---

## ✅ PHASE 11: Error Handling

### 11.1 Database Disconnect
1. Stop MySQL/RDS temporarily
2. Refresh dashboard

**Verify:**
- [ ] Shows error message
- [ ] Doesn't crash server
- [ ] Recovers when DB reconnects

### 11.2 Invalid Inputs
Try entering:
- Invalid username format
- Negative balance
- Invalid RTP (> 100)

**Verify:**
- [ ] Validation messages show
- [ ] Prevents submission
- [ ] No server crashes

---

## ✅ PHASE 12: Mobile Responsiveness

Open dashboard on phone/tablet or use Chrome DevTools:
1. Press F12 → Toggle device toolbar
2. Select iPhone/iPad

**Verify:**
- [ ] Layout adapts to screen size
- [ ] Sidebar collapses on mobile
- [ ] Tables scroll horizontally
- [ ] Charts resize properly
- [ ] Buttons are tappable
- [ ] No horizontal overflow

---

## ✅ PHASE 13: Production Readiness

### 13.1 Environment Variables
If using production:
- [ ] Database credentials in .env file
- [ ] No hardcoded passwords in code
- [ ] .env added to .gitignore

### 13.2 Process Management
If deploying to server:
- [ ] PM2 installed (`npm install -g pm2`)
- [ ] Servers configured in PM2
- [ ] Auto-restart on crash enabled
- [ ] Logs configured

### 13.3 Backups
- [ ] Database backup scheduled
- [ ] Code repository backed up
- [ ] Original files backed up in backup_original/

---

## 🎯 Final Checklist

Before going live:

- [ ] All Phase 1-13 tests passed
- [ ] Original dashboard still works
- [ ] V2 dashboard fully functional
- [ ] No console errors
- [ ] Database connectivity stable
- [ ] Charts render correctly
- [ ] Can manage users
- [ ] Can force winners
- [ ] Performance acceptable
- [ ] Security verified
- [ ] Backups in place

---

## 📊 Testing Summary

Total Tests: ~150+

**Status:**
- ✅ Passed: _____ / 150
- ⚠️ Warnings: _____
- ❌ Failed: _____

**Critical Issues:** 
(List any blocking issues here)

---

**Final Status:** 
- [ ] ✅ Ready for Production
- [ ] ⚠️ Needs Minor Fixes
- [ ] ❌ Needs Major Fixes

---

## 📞 Support

If any test fails:
1. Check server logs (both terminals)
2. Check browser console (F12)
3. Review INTEGRATION_GUIDE.md
4. Verify database connectivity
5. Check original dashboard works

**Date Tested:** _______________
**Tested By:** _______________
**Notes:** 
_______________________________________________
_______________________________________________
_______________________________________________
