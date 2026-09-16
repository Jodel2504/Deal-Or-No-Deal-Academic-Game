# Deal or No Deal — Academic Edition
## New: room codes, live monitoring, group files & leaderboards

**© 2026 JODEL**

---

## Files

| File | Notes |
|---|---|
| `DealOrNoDeal.html` | The game (renamed — no longer says "Offline_Hotspot") |
| `server.js` | Works for **both** LAN and online. Accepts either HTML filename. |
| `package.json` | Unchanged |

All three must sit in the **same folder**.

---

## Running it

**Classroom / hotspot:**
```bash
npm install
npm start
```
Open the `http://192.168.x.x:3000` address it prints; students open the same address.

**Online (free hosting):** upload these three files to Glitch or Render (see the
earlier deploy guide). The public `https://` link works from any network. You do
**not** edit anything to switch modes — the game detects it.

---

## 1. Room codes

On the host screen, press **🎲 GENERATE RANDOM CODE** (one is made automatically
when the screen opens). You get a 6-character code such as `K7P2QX`.

**You and your students type the same code to enter the room.** Students enter it
in the ROOM CODE box.

The alphabet deliberately excludes `O/0` and `I/1` so the code isn't misread when
you read it out or write it on the board.

**📋 COPY LINK FOR STUDENTS** copies the address and code together, ready to paste
into a class chat.

---

## 2. Setting cases & questions for everyone

On the host screen (or from the dashboard's **⚙ CASES** button):

- **⚙ CUSTOMIZE CASES** — set total cases and the green/blue/gold mix, then press
  *USE THESE CASES FOR ALL GROUPS*. It saves the setup instead of starting a game.
- **📝 CUSTOMIZE QUESTIONS** — the normal question setup.

When you press **▶ START ALL GROUPS**, both are sent to every group, so the whole
class plays your configuration.

---

## 3. Watching each group play

Group cards on the dashboard now show a live progress bar, cases opened (e.g.
`7/30`), the current round, error count, the banker's current offer, and member
names.

**👁 VIEW** opens a detail panel for one group that keeps updating while they play.

---

## 4. Tab-leave alerts

If a student switches away from the game tab:

- **The student** sees a full-screen warning saying you've been notified, with a
  running count of how many times they've left.
- **You** get an entry in the **🚨 FOCUS ALERTS** panel and a badge on that
  group's card.

You decide what to do. Each group card has:

- **⚠ WARN** — send them a message on screen.
- **🚪 KICK** — remove them from the room.

Deducting points is a judgement call you make in your own records — the game
doesn't dock marks automatically.

**One honest limitation:** this detects that a tab lost focus. It cannot see
*what* they switched to. A notification can also fire from a notification popup,
a dropped Wi-Fi prompt, or a phone call. Treat it as a reason to look over, not
as proof of cheating.

---

## 5. History

**📋 HISTORY** now has two tabs:

- **👤 SOLO GAMES** — a table with date *and* time, case value, deal, points,
  errors, result.
- **👥 MULTIPLAYER** — a 🗂 folder icon for every group that finished. Click one
  to see that group's summary plus an organised table of member names and scores.

Students type their member names (comma-separated) when joining, which is what
fills those files.

**🗑 CLEAR THIS TAB** clears only the tab you're viewing.

---

## 6. Leaderboards

**🏆 LEADERBOARD** on the main menu, also two tabs:

- **👤 SOLO** — best score per player.
- **👥 MULTIPLAYER** — **🏅 TOP GROUPS**, then **👤 TOP MEMBERS** across all groups.

Medals for the top three.

**Note:** every member of a group carries that group's score, because a group
plays one game together. The game has no per-member score to rank by, and I'd
rather show that plainly than invent numbers.

---

## Where records are stored

In the browser's local storage, on the device that was using it:

- Solo games and each group's own result save on **that group's device**.
- The full set of group files saves on **the teacher's device** (the dashboard
  archives every group as it finishes).

So run the dashboard on the machine you want the class records on. Clearing that
browser's site data erases them.

---

## Verified before release

90 automated checks, all passing:

- 21 — server protocol (room codes, members, config broadcast, progress, alerts, targeted warn/kick, final archiving)
- 54 — client features run in a simulated browser (room code randomness, group files, de-duplication, history tab separation, both leaderboards, tab-leave flow, dashboard progress, live view)
- 11 — online vs LAN wording in both modes
-  4 — room lifecycle (unknown room rejected, host disconnect closes room, duplicate host rejected)

Plus an end-to-end smoke test: real server, real game file, full host → join →
play → alert → finish round trip.

---

**© 2026 JODEL • All Rights Reserved**
