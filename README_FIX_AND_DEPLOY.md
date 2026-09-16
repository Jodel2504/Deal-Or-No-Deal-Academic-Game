# Deal or No Deal — FIXED Server + Free Online Deployment
**© 2026 JODEL**

---

## 🔴 What was actually wrong

I opened your real game file and traced the multiplayer code. Your game
already has a complete multiplayer system built in (search the HTML for
`MULTIPLAYER ENGINE`) — it sends these WebSocket messages:

```
host_create      { roomId }
group_join       { roomId, groupId, groupName }
group_update     { status, dealValue, finalValue, pts, errors }
host_broadcast   { payload }
```

...and waits for these back:

```
host_created, group_joined, group_update, group_disconnected, host_message, error
```

**Your old `server.js` didn't understand any of that.** It only knew about
different message names (`join_room`, `sync_request`) — messages your game
never sends. So the WebSocket connected fine, but the moment someone clicked
"Create Room" or "Join Room," the server had nothing to say back. The screen
just sat there waiting. Forever. That's the entire bug.

**The fix:** one new `server.js` that speaks the game's actual protocol.
I did not touch your HTML file at all — it was never broken, it was just
talking to a server that couldn't understand it.

I tested this for real before sending it to you (host creates room → group
joins → group reports a score → host dashboard updates → host broadcasts
"start" → group receives it → host disconnects → room closes and connected
groups are notified → room can't be joined afterward → duplicate host on
the same Room ID is rejected). All 14 checks pass.

---

## ✅ One file, both modes — nothing to combine

You asked to put online and offline "together as one." They already are —
**this is the same `server.js` for both.** Your game auto-detects its own
address from the browser URL:

- Opened as `http://192.168.1.5:3000` → it talks to `ws://192.168.1.5:3000` (offline/LAN)
- Opened as `https://your-app.onrender.com` → it talks to `wss://your-app.onrender.com` (online)

You never edit code to switch between them. Where you *run* the file is
what decides offline vs. online.

---

## 📦 What's in this package

- `server.js` — the fixed server (replaces your old one completely)
- `DealOrNoDeal_Offline_Hotspot.html` — **your original file, unchanged**
- `package.json` — unchanged, already compatible (`npm start` → `node server.js`)

⚠️ **Delete/ignore any `server-improved.js` or `server-enhanced.js` from
earlier** — those were built against the wrong protocol and will bring the
same "stuck waiting" bug back. Use only this `server.js`.

---

## 📶 OFFLINE (classroom hotspot/LAN) — same as before

```bash
npm install
npm start
```

Console prints:
```
📶 Running in OFFLINE (LAN/hotspot) mode.
   Teacher (this computer): http://localhost:3000
   Students (same WiFi):    http://192.168.1.5:3000
```

Teacher clicks **🔌 MULTIPLAYER (OFFLINE) → I AM THE HOST → CREATE ROOM**.
Students open the printed IP, click **I AM A GROUP**, type the same Room ID,
and join. This now actually works.

---

## 🌍 ONLINE — free hosting with a copyable live link

You don't need to buy a server. Use a **free Node.js hosting service** —
the same three files above get uploaded there, and it gives you a public
`https://` link students can open from any network, anywhere.

### Option A — Glitch (easiest, no command line, edit in browser)

1. Go to **https://glitch.com** → sign up free (GitHub/Google/email).
2. Click **New Project → Import from GitHub**, OR **New Project → glitch-hello-node**
   and then use the file panel to upload/replace files with the 3 files above.
3. Glitch auto-runs `npm install` and `npm start` for you.
4. Click **Share** (top right) → you'll see your live link, e.g.:
   ```
   https://dond-yourclass.glitch.me
   ```
5. **This is your copy-paste link for students.** Give it to them directly,
   or put it in the classroom chat/board.
6. To go live again next class: just open the project — Glitch wakes it up
   automatically on the first visit.

### Option B — Render.com (faster, needs a free GitHub account)

1. Put the 3 files in a GitHub repo (create one at github.com, upload the files
   via "Add file → Upload files" in the browser — no git command line needed).
2. Go to **https://render.com** → sign up free → **New → Web Service**.
3. Connect your GitHub repo.
4. Settings:
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Instance Type:** Free
5. Click **Deploy**. Render gives you a link like:
   ```
   https://deal-or-no-deal-yourclass.onrender.com
   ```
6. **Copy that link** — that's what you share with students.

> Free tiers on both platforms "sleep" after inactivity and take ~10–50
> seconds to wake up on the first visit of the day. Open the link yourself
> a minute before class starts so it's already awake for students.

### Same steps either way, once deployed
- Open your live link yourself → **I AM THE HOST → CREATE ROOM**.
- Share the exact same link with students → they click **I AM A GROUP**,
  type the Room ID you give them, and join.
- No IP addresses to hunt down — the link works from **any network**
  (school WiFi, home internet, mobile data) since it's a real public address.

---

## 🚪 "Disable the link when the host closes" — how this actually works

You don't need to stop the whole server for this. The fix already handles
it at the room level:

- The moment the **teacher's browser tab/connection closes** (closing the
  tab, closing the browser, or losing connection), the server immediately:
  1. Tells every connected student's browser the session ended.
  2. Deletes the room from memory.
  3. Any further join attempts with that Room ID get "Room not found."

- The **public link itself** (`https://your-app.onrender.com`) stays up so
  you can reuse it next class — only the *active room* dies when you close
  it, which is what you actually want (you don't want to redeploy every day).

- If you genuinely want the whole server offline (e.g., over summer break),
  just stop/delete the service in the Glitch or Render dashboard — the link
  will then show an error page for everyone.

---

## 🧪 How I verified this before sending it to you

```
✅ host_created received
✅ roomId normalized to uppercase
✅ info.groups starts empty
✅ group received group_joined with its own groupId
✅ group received group_joined with its own groupName
✅ host notified of group_joined with info.groups length 1
✅ host sees correct group name in info
✅ host received group_update after group reported a deal
✅ host sees updated error count
✅ group received host_message with correct payload
✅ joining nonexistent room returns error
✅ group notified when host ends session
✅ room is gone from server after host closed (link truly dead)
✅ second host on same room ID is rejected

14 passed, 0 failed
```

---

## 🆘 If something still doesn't connect

1. **Offline:** student must be on the *same WiFi/hotspot* as the teacher,
   and use the teacher's printed `http://IP:3000` address — not `localhost`.
2. **Online:** make sure you opened the live link yourself first (wakes a
   sleeping free instance) before students try to join.
3. **Room ID mismatch:** Room IDs are case-insensitive (auto-uppercased),
   but must match exactly otherwise — check for typos/extra spaces.
4. **"Room already has an active host" error:** someone already created
   that Room ID and is still connected. Pick a different Room ID, or wait
   for their tab to close.
5. Check the server console/logs — every room created, joined, and closed
   is printed there (`[ROOM] ...`), which tells you exactly what's happening.

---

**© 2026 JODEL • All Rights Reserved**
