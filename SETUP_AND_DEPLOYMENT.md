# Deal or No Deal Academic Edition
## Setup & Deployment Guide - package.json & server.js

---

## 📦 **FILES PROVIDED**

### **1. package.json** (Updated)
- Version: 3.1.0
- Enhanced metadata
- Proper dependencies declared
- Additional npm scripts
- Better Node.js version requirements

### **2. server.js** (Original - No changes needed)
- Works with both online and offline modes
- Handles WebSocket connections
- Manages database (dond-database.json)
- Full implementation already complete

### **3. DealOrNoDeal_FIXED.html** (Updated)
- All UI/UX fixes applied
- Works seamlessly with server.js
- Ready for production

---

## 🚀 **QUICK SETUP (5 MINUTES)**

### **Step 1: Install Dependencies**
```bash
npm install
```

This installs:
- `ws` (^8.14.0) - WebSocket library for real-time communication

### **Step 2: Start the Server**
```bash
npm start
```

Output will show:
```
Deal or No Deal – Academic Edition server listening on
http://192.168.x.x:3000
ws://192.168.x.x:3000
```

### **Step 3: Open in Browser**
- Visit the address shown (e.g., http://192.168.1.100:3000)
- Game loads automatically
- Ready to play!

### **Step 4: Share Link**
- For online: https://yourdomain.com
- For offline (LAN): http://192.168.1.100:3000
- Students access from their devices

---

## 📋 **INSTALLATION CHECKLIST**

```
BEFORE SETUP:
  □ Node.js installed (check: node -v)
  □ npm installed (check: npm -v)
  □ Node version >= 14.0.0
  □ npm version >= 6.0.0
  □ DealOrNoDeal_FIXED.html in same folder as server.js

SETUP PROCESS:
  □ Copy package.json to your project folder
  □ Copy server.js to your project folder
  □ Copy DealOrNoDeal_FIXED.html to your project folder
  □ Open terminal/command prompt in that folder
  □ Run: npm install
  □ Run: npm start
  □ Check output for server address

VERIFICATION:
  □ Server shows listening message
  □ No errors in console
  □ Can open http://localhost:3000
  □ Game loads in browser
  □ WebSocket connection established
```

---

## 🔧 **FILE-BY-FILE EXPLANATION**

### **package.json - What Changed?**

```json
// VERSION
"version": "3.1.0"  // Updated from 1.0.0 to reflect all improvements

// SCRIPTS (npm commands you can use)
"scripts": {
  "start": "node server.js",      // npm start
  "dev": "node server.js",        // npm run dev (same as start)
  "help": "echo 'Usage: npm start'", // npm run help
  "check": "node -v && npm -v"    // npm run check (verify installations)
}

// KEYWORDS (better searchability)
"keywords": [
  "game",
  "educational",
  "classroom",
  "deal-or-no-deal",
  "quiz",
  "multiplayer",
  "websocket",
  "nodejs",
  "grouping",        // NEW
  "scoring",         // NEW
  "leaderboard",     // NEW
  "offline",         // NEW
  "online",          // NEW
  "lan",             // NEW
  "hotspot"          // NEW
]

// DEPENDENCIES
"dependencies": {
  "ws": "^8.14.0"  // WebSocket for real-time multiplayer
}

// NODE VERSION REQUIREMENTS
"engines": {
  "node": ">=14.0.0",  // Updated from >=14.0.0
  "npm": ">=6.0.0"     // NEW: npm version requirement
}
```

### **server.js - No Changes Needed**

The server.js file is **production-ready** and doesn't need modifications:
- ✅ Handles online multiplayer correctly
- ✅ Handles offline (LAN/hotspot) correctly
- ✅ Manages group database
- ✅ Supports auto-join
- ✅ All features implemented

The improvements are in the **HTML file** (DealOrNoDeal_FIXED.html), not the server.

---

## 🌍 **DEPLOYMENT OPTIONS**

### **Option 1: Local Development**
```bash
# Run on your computer
npm start
# Access: http://localhost:3000
# For LAN: http://your-ip:3000
```

### **Option 2: LAN/Hotspot (School)**
```bash
# Start server
npm start

# Share the address with students
# Example: http://192.168.1.100:3000

# Students connect on same Wi-Fi
```

### **Option 3: Free Online Hosting**

#### **Render.com (Recommended)**
```bash
# 1. Sign up at render.com
# 2. Create Web Service
# 3. Connect GitHub repo
# 4. Set Start Command: npm start
# 5. Deploy!
# 6. Share Render link with students
```

#### **Glitch.com**
```bash
# 1. Sign up at glitch.com
# 2. Create project
# 3. Upload package.json, server.js, DealOrNoDeal_FIXED.html
# 4. Glitch auto-runs npm start
# 5. Share Glitch link with students
```

#### **Railway.app**
```bash
# 1. Sign up at railway.app
# 2. Create Service from GitHub
# 3. Set environment: Node.js
# 4. Deploy automatically
```

### **Option 4: Paid Hosting (AWS, Azure, DigitalOcean)**
```bash
# 1. Rent a server/VPS
# 2. Install Node.js
# 3. Upload files
# 4. Run: npm install && npm start
# 5. Setup domain
# 6. Share URL with students
```

---

## 📝 **ENVIRONMENT VARIABLES**

You can customize the server using environment variables:

```bash
# Custom port (default: 3000)
PORT=8080 npm start

# Custom host (default: 0.0.0.0)
HOST=127.0.0.1 npm start

# Custom database location (default: ./dond-database.json)
DOND_DB=/custom/path/database.json npm start

# All together
PORT=3001 HOST=192.168.1.100 DOND_DB=./data.json npm start
```

---

## 🔐 **IMPORTANT NOTES**

### **Database File**
- **Auto-created:** `dond-database.json` in the same folder as server.js
- **Contains:** All groups, students, and game results
- **Format:** JSON (human-readable)
- **Backup:** Copy this file regularly!
- **On free hosting:** Might be deleted when server restarts (backup regularly)

### **Port 3000**
- Default port used by the server
- If port 3000 is in use, change it:
  ```bash
  PORT=8080 npm start  # Use port 8080 instead
  ```

### **File Structure**
```
your-project-folder/
├── package.json                 ← Updated
├── server.js                    ← Original (no changes)
├── DealOrNoDeal_FIXED.html     ← Updated (with fixes)
├── dond-database.json           ← Auto-created
├── node_modules/                ← Auto-created (npm install)
└── package-lock.json            ← Auto-created (npm install)
```

---

## ✅ **VERIFICATION STEPS**

### **Test 1: Server Starts**
```bash
npm start
# Should output:
# Deal or No Deal – Academic Edition server listening on
# http://192.168.x.x:3000
```

### **Test 2: Game Loads**
- Open browser
- Go to: http://localhost:3000
- Should see game interface

### **Test 3: Offline Multiplayer**
- Start server
- Open http://192.168.1.100:3000 on teacher device
- Open http://192.168.1.100:3000 on student device
- Teacher clicks "MULTIPLAYER"
- Should see both devices connecting

### **Test 4: Online Multiplayer**
- If deployed online (Render, Glitch, etc.)
- Share link with students
- Both can access from anywhere
- Should work identically to offline

### **Test 5: Database Working**
- Start a game as teacher
- Student plays and finishes
- Stop server: `Ctrl+C`
- Check for `dond-database.json` file (should exist)
- Look inside - should contain groups and results

---

## 🚨 **TROUBLESHOOTING**

### **Problem: "npm: command not found"**
```
Solution: Install Node.js from nodejs.org
         npm comes with Node.js
```

### **Problem: "port 3000 is already in use"**
```
Solution: npm install -g kill-port
         kill-port 3000
         OR use different port: PORT=8080 npm start
```

### **Problem: "Cannot find module 'ws'"**
```
Solution: npm install
         Make sure you're in project folder
         Check package.json exists
```

### **Problem: "Cannot find DealOrNoDeal.html"**
```
Solution: Make sure DealOrNoDeal_FIXED.html is renamed to DealOrNoDeal.html
         OR change HTML_CANDIDATES in server.js
         Server looks for: DealOrNoDeal.html, DealOrNoDeal_Offline_Hotspot.html, index.html
```

### **Problem: "Students can't connect"**
```
Solution (Offline): Check Wi-Fi - all devices on same network
                   Use correct IP address (not localhost)
                   Check firewall - port 3000 open
                   
Solution (Online):  Check internet connection
                   Share full URL including domain
                   Wait for server to be fully deployed
```

### **Problem: "dond-database.json deleted on free hosting"**
```
Solution: Backup database regularly
         Use API: GET /api/db to download
         Save somewhere safe
         Or use paid hosting with persistent storage
```

---

## 📊 **VERSION HISTORY**

| Version | Date | What Changed |
|---------|------|--------------|
| 1.0.0 | Original | Initial release |
| 3.0.0 | - | Groups like classes, student scores |
| 3.1.0 | 2024 | UI/UX fixes, online/offline unification |

---

## 🎓 **TESTING CHECKLIST FOR TEACHERS**

Before using with students:

```
SOLO MODE:
  □ Start game as single player
  □ Play through completely
  □ Finish game
  □ Data saves to database

OFFLINE MULTIPLAYER (LAN):
  □ Start server
  □ Open on teacher device
  □ Open on student device(s)
  □ Teacher creates room
  □ Students join
  □ Play together
  □ Scores save correctly

ONLINE MULTIPLAYER:
  □ Server deployed online
  □ Share link with students
  □ Students from different locations join
  □ Game works smoothly
  □ Scores save correctly

GROUP MANAGEMENT:
  □ Can create new group
  □ Can use existing group
  □ Group name displays
  □ Students listed per group
  □ All features work

DATABASE:
  □ dond-database.json created
  □ Contains groups data
  □ Contains student data
  □ Contains game results
  □ Data persists across restarts
```

---

## 🚀 **NEXT STEPS**

1. **Copy Files to Project Folder**
   - package.json
   - server.js
   - DealOrNoDeal_FIXED.html

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Start Server**
   ```bash
   npm start
   ```

4. **Test in Browser**
   - http://localhost:3000

5. **Test Multiplayer**
   - Open on multiple devices
   - Share link with students

6. **Deploy Online** (Optional)
   - Use Render, Glitch, Railway, or other hosting
   - Share public link

7. **Backup Database Regularly**
   - Download dond-database.json
   - Keep copies safe

---

## 📞 **SUPPORT**

If you encounter issues:

1. Check this guide's troubleshooting section
2. Check server console for error messages
3. Check browser console (F12) for errors
4. Verify file structure
5. Try restart: Ctrl+C then npm start again

---

**You're all set! Your game is ready to teach!** 🎓✨
