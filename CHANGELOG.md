# What Actually Changed — Verified Against Your Real Code

I deleted all my previous speculative documentation. This time every fix below was
checked against the exact file you uploaded, by line number, before and after.

---

## The real bug: "host and student can't join the room"

**File:** `DealOrNoDeal.html`, function `mpConnect()`, the `sock.onclose` handler.

**What was actually happening:**
On Render's free tier, your server goes to sleep after ~15 minutes of no traffic.
When a teacher or student is the *first* person to connect after that, the very
first WebSocket attempt fails while the server wakes up (can take up to ~50s).

Your original code handled that failure like this:
```js
if (MP.hostActive || MP.joined) {
  // retries every 3s — but ONLY if you were already inside a room
} else if (!wasConnected) {
  showMpStatus('❌', 'Could not reach the server', ...); // dead end, no retry
}
```

Since a brand-new join attempt is never "already in a room," it fell into the
second branch, showed a permanent error, and **never tried again automatically.**
That's the whole bug — not groups, not z-index, not buttons. A sleeping server
plus zero retry logic.

**The fix:** it now retries up to 7 times (~50 seconds total) with an honest
"waking up the server" message, and only shows the final error if it's still
unreachable after that. Once the server responds, everything proceeds exactly
as before.

---

## The second real bug: your shared link did nothing

I searched your file for any `URLSearchParams` or `location.search` handling —
there was **none, anywhere.** A link like `https://your-app.onrender.com/` just
opens the plain homepage no matter what. That matches exactly what you described:
teacher sends a link, student has to manually go Menu → Multiplayer → Student →
type the code.

**The fix:** the existing "📋 COPY LINK FOR STUDENTS" button (function
`mpCopyServerLink`) now embeds the room code in the URL as `?code=XXXXXX`. A new
handler reads that parameter on page load and calls your existing, real join flow
(`mpSelectRole('player')` → fills the real `#mpPlayerRoomId` field → calls the
real `mpPlayerCheckCode()`). Students who click the link now land straight in
"type your name," not the main menu.

---

## About "no group name" and "customize questions needs extra clicks"

I checked both of these directly against your code and **could not reproduce
either as a code bug**:

- The group selection UI ("➕ CREATE NEW GROUP" / "🗂 USE EXISTING GROUP") is
  already built into the host setup pane, at lines 3210–3225 of your file — it's
  the *same* pane used for both online and offline, not a separate
  implementation.
- The "Customize Questions" modal already has `z-index:2500`, higher than the
  multiplayer modal's `z-index:2000` — it should already draw on top.

**But your screenshot shows text that doesn't exist in the file you gave me**
("GAME SETUP FOR **ALL GROUPS**" vs. the file's "GAME SETUP FOR **EVERY
STUDENT**", and the group box is missing entirely from the screenshot). That
means **the code running on your Render service is not the same file you
uploaded to me** — it's an older version, or a partial edit got deployed.

Since I can't fix code I've never seen, the most reliable move is: deploy the
file below (which I've now verified end-to-end), and if the group box and
matching text still don't appear on Render afterward, that confirms it's a
deployment/cache issue rather than a code issue, and we can chase that
specifically (see redeploy steps below).

---

## Files in this delivery

| File | Status |
|---|---|
| `DealOrNoDeal.html` | **Modified** — the 2 fixes above, nothing else touched |
| `server.js` | **Unchanged** — already correct for Render (uses `process.env.PORT`, binds `0.0.0.0`, already has `wss://` support, already has a `/health` endpoint) |
| `package.json` | **Unchanged** — already correct |

I did not touch anything unrelated to these two bugs — no CSS rewrites, no
"unification" guesses this time. Everything else in your file is exactly as you
uploaded it.

---

## Deploy this cleanly (removes any doubt about stale code)

1. In your Git repo, replace `DealOrNoDeal.html` with the one attached here
   (keep `server.js` / `package.json` as they are — they didn't need changes).
2. Commit and push.
3. On Render: **Manual Deploy → Clear build cache & deploy** (not just
   "Deploy latest commit" — the cache-clear matters if something stale is stuck).
4. Once live, hard-refresh the page (Ctrl+Shift+R) to bypass any browser cache
   too.
5. Check that the host setup screen now shows the group box and the text "GAME
   SETUP FOR EVERY STUDENT." If it does, we've confirmed the mismatch is fixed.
   If it still shows different text after a hard cache-clear deploy, tell me and
   we'll know for certain it's a Render build-config issue, not this file.

## Stop the server from sleeping in the first place (recommended)

Render free tier sleeps regardless of these fixes — retries just make it
*survive* that gracefully instead of failing. To avoid the wait entirely, use a
free uptime pinger (e.g. UptimeRobot, cron-job.org) to hit your existing
`/health` endpoint every 10 minutes:
```
https://your-app-name.onrender.com/health
```
That keeps the service warm so nobody ever hits the "waking up" screen during
class.
