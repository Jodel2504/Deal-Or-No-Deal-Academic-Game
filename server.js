/**
 * ============================================================================
 * DEAL OR NO DEAL – ACADEMIC EDITION
 * THE SERVER (works for BOTH Offline/LAN and Online/Internet)
 * ============================================================================
 *
 * AUTHOR: Jodel
 *
 * v3 — GROUPS NOW WORK LIKE A CLASS
 * ----------------------------------------------------------------------------
 *  • A GROUP is a class (e.g. "Grade 9 – Rizal"). It is saved in the database.
 *  • Every student joins on their OWN device, types the room code, then types
 *    their NAME. Each student plays their own game and gets their own score.
 *  • Each time the teacher generates a code they choose:
 *        – create a NEW group, or
 *        – use an EXISTING group (the code is simply added to that group).
 *  • Students and every finished game are written to  dond-database.json
 *    (in the same folder as this file).
 *
 * WEBSOCKET PROTOCOL
 * ----------------------------------------------------------------------------
 *  Teacher → server
 *    host_create   { roomId, groupMode:'new'|'existing', groupName?, groupId? }
 *    host_broadcast{ payload, targetId? }           (targetId = one student)
 *    host_end      {}                               (close the room now)
 *
 *  Student → server
 *    room_check    { roomId }                        (step 1: is the code valid?)
 *    player_join   { roomId, playerName, inGame? }   (step 2: my name)
 *    player_update { status, opened, totalCases, round, errors, offer, ... }
 *    player_result { gameId, caseVal, deal, final, pts, ptsNum, errors, winner }
 *    player_alert  { alertType, at }
 *
 *  Server → teacher
 *    host_created  { roomId, group, info }
 *    room_info     { info }                          (any change in the room)
 *    player_alert  { playerId, playerName, count, at }
 *    error         { code, msg }
 *
 *  Server → student
 *    room_ok       { roomId, groupName }
 *    player_joined { playerId, playerName, groupName, roomId }
 *    host_message  { payload }
 *    error         { code, msg }
 *
 *  HTTP (database)
 *    GET  /api/db                 → whole database (groups, players, results)
 *    GET  /api/groups             → list of groups (for the "existing group" picker)
 *    POST /api/groups/delete      { id }  → delete one group
 *    POST /api/db/clear           → delete every group
 * ============================================================================
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const os = require('os');
const WebSocket = require('ws');

// ──────────────────────────────────────────────────────────────────────────
// CONFIG
// ──────────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const DB_FILE = process.env.DOND_DB || path.join(__dirname, 'dond-database.json');
const HOST_GRACE_MS = 20000;   // teacher Wi-Fi blip: keep the room alive this long

const HTML_CANDIDATES = ['DealOrNoDeal.html', 'DealOrNoDeal_Offline_Hotspot.html', 'index.html'];
const HTML_FILE = (function () {
  for (const name of HTML_CANDIDATES) {
    const p = path.join(__dirname, name);
    if (fs.existsSync(p)) return p;
  }
  return path.join(__dirname, HTML_CANDIDATES[0]);
})();

function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address;
    }
  }
  return 'localhost';
}
const localIP = getLocalIP();

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.css': 'text/css',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
};

// ──────────────────────────────────────────────────────────────────────────
// DATABASE  (a single JSON file — no extra installs needed)
// ──────────────────────────────────────────────────────────────────────────
// {
//   version: 3,
//   groups: {
//     [groupId]: {
//       id, name, createdAt,
//       codes:   [ { code, createdAt } ],
//       players: { [nameKey]: { name, firstJoined, lastJoined } },
//       results: [ { gameId, roomCode, playerName, datetime, caseVal, deal,
//                    final, pts, ptsNum, errors, winner, alerts } ]
//     }
//   }
// }
let db = { version: 3, groups: {} };

function loadDb() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
      if (parsed && parsed.groups && typeof parsed.groups === 'object') db = parsed;
    }
  } catch (e) {
    console.error('[DB] could not read database, starting empty:', e.message);
    try { fs.copyFileSync(DB_FILE, DB_FILE + '.broken-' + Date.now()); } catch (_) {}
  }
}

let saveTimer = null;
function saveDb() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveDbNow, 300);
}
function saveDbNow() {
  clearTimeout(saveTimer);
  try {
    const tmp = DB_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
    fs.renameSync(tmp, DB_FILE);
  } catch (e) {
    console.error('[DB] save failed:', e.message);
  }
}

const nameKey = (s) => String(s || '').trim().replace(/\s+/g, ' ').toLowerCase();
const cleanName = (s, max) => String(s || '').trim().replace(/\s+/g, ' ').slice(0, max || 40);
const genId = (prefix) => prefix + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-3);

function findGroupByName(name) {
  const k = nameKey(name);
  return Object.values(db.groups).find(g => nameKey(g.name) === k) || null;
}

function groupSummary(g) {
  const lastCode = g.codes && g.codes.length ? g.codes[g.codes.length - 1] : null;
  return {
    id: g.id,
    name: g.name,
    createdAt: g.createdAt,
    playerCount: Object.keys(g.players || {}).length,
    gameCount: (g.results || []).length,
    codeCount: (g.codes || []).length,
    lastCode: lastCode ? lastCode.code : null,
    lastUsed: lastCode ? lastCode.createdAt : g.createdAt,
  };
}

// ──────────────────────────────────────────────────────────────────────────
// ROOMS (live sessions, in memory)
// ──────────────────────────────────────────────────────────────────────────
const rooms = new Map();

function roomInfo(room) {
  const g = db.groups[room.groupId];
  return {
    roomId: room.roomId,
    groupId: room.groupId,
    groupName: g ? g.name : '',
    rosterCount: g ? Object.keys(g.players).length : 0,
    started: !!room.started,
    players: Array.from(room.players.values()).map(p => ({
      id: p.id,
      name: p.name,
      status: p.status,
      errors: p.errors || 0,
      opened: p.opened || 0,
      totalCases: p.totalCases || 0,
      round: p.round || 0,
      offer: p.offer || null,
      dealValue: p.dealValue || null,
      finalValue: p.finalValue || null,
      caseValue: p.caseValue || null,
      pts: p.pts || null,
      ptsNum: typeof p.ptsNum === 'number' ? p.ptsNum : null,
      winner: p.winner || null,
      alerts: p.alerts || 0,
      gamesDone: p.gamesDone || 0,
    })),
  };
}

function sendTo(ws, msg) {
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
}
function notifyHost(room, msg) { if (room && room.hostWs) sendTo(room.hostWs, msg); }
function pushInfo(room) { notifyHost(room, { type: 'room_info', info: roomInfo(room) }); }

function closeRoom(roomId, reason) {
  const room = rooms.get(roomId);
  if (!room) return;
  clearTimeout(room.hostTimer);
  for (const p of room.players.values()) {
    sendTo(p.ws, { type: 'error', code: 'room_closed', msg: reason || 'The teacher ended the session.' });
  }
  notifyHost(room, { type: 'error', code: 'room_closed', msg: reason || 'The room was closed.' });
  rooms.delete(roomId);
  console.log(`[ROOM] "${roomId}" closed`);
}

// ──────────────────────────────────────────────────────────────────────────
// HTTP SERVER
// ──────────────────────────────────────────────────────────────────────────
function sendJson(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
}
function readBody(req, cb) {
  let data = '';
  req.on('data', c => { data += c; if (data.length > 1e5) req.destroy(); });
  req.on('end', () => { try { cb(JSON.parse(data || '{}')); } catch (e) { cb({}); } });
}

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

  const parsedUrl = url.parse(req.url, true);
  let pathname = parsedUrl.pathname;

  if (pathname === '/health' || pathname === '/api/status') {
    return sendJson(res, 200, { status: 'online', rooms: rooms.size, groups: Object.keys(db.groups).length, localIP, port: PORT, time: new Date().toISOString() });
  }
  if (pathname === '/api/db' && req.method === 'GET') {
    return sendJson(res, 200, db);
  }
  if (pathname === '/api/groups' && req.method === 'GET') {
    const list = Object.values(db.groups).map(groupSummary)
      .sort((a, b) => String(b.lastUsed).localeCompare(String(a.lastUsed)));
    return sendJson(res, 200, { groups: list });
  }
  if (pathname === '/api/groups/delete' && req.method === 'POST') {
    return readBody(req, body => {
      const id = String(body.id || '');
      if (!db.groups[id]) return sendJson(res, 404, { ok: false, msg: 'Group not found.' });
      for (const [rid, room] of Array.from(rooms)) if (room.groupId === id) closeRoom(rid, 'This group was deleted by the teacher.');
      delete db.groups[id];
      saveDbNow();
      sendJson(res, 200, { ok: true });
    });
  }
  if (pathname === '/api/db/clear' && req.method === 'POST') {
    for (const rid of Array.from(rooms.keys())) closeRoom(rid, 'All group records were cleared by the teacher.');
    db = { version: 3, groups: {} };
    saveDbNow();
    return sendJson(res, 200, { ok: true });
  }

  if (pathname === '/' || pathname === '') pathname = '/index.html';

  // Only the game page and plain assets are served — never the database or server files.
  const ext = path.extname(pathname).toLowerCase();
  const safeName = path.basename(pathname);
  const isAsset = MIME_TYPES[ext] && !/^(server\.js|package\.json)$/i.test(safeName) && ext !== '.json';
  const filePath = (pathname === '/index.html' || !isAsset) ? HTML_FILE : path.join(__dirname, safeName);

  fs.readFile(filePath, (err, data) => {
    if (err) {
      fs.readFile(HTML_FILE, (err2, data2) => {
        if (err2) {
          res.writeHead(500, { 'Content-Type': 'text/plain' });
          res.end('Error loading game. Put DealOrNoDeal.html in the same folder as server.js.');
          return;
        }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(data2);
      });
      return;
    }
    res.writeHead(200, { 'Content-Type': MIME_TYPES[path.extname(filePath).toLowerCase()] || 'text/html; charset=utf-8' });
    res.end(data);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// WEBSOCKET SERVER
// ──────────────────────────────────────────────────────────────────────────
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws, req) => {
  console.log(`[WS] connection from ${req.socket.remoteAddress}`);

  let boundRoomId = null;
  let boundPlayerId = null;
  let isHost = false;

  const err = (code, msg) => sendTo(ws, { type: 'error', code, msg });

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch (e) { return err('bad_message', 'Malformed message.'); }

    switch (msg.type) {

      // ── Teacher creates (or re-attaches to) a room ─────────────────────
      case 'host_create': {
        const roomId = cleanName(msg.roomId, 8).toUpperCase();
        if (!/^[A-Z0-9]{3,8}$/.test(roomId)) return err('bad_code', 'Room code must be 3–8 letters or numbers.');

        const existingRoom = rooms.get(roomId);
        if (existingRoom) {
          const hostAlive = existingRoom.hostWs && existingRoom.hostWs.readyState === WebSocket.OPEN && existingRoom.hostWs !== ws;
          if (hostAlive || !msg.reattach) return err('code_in_use', `Room code "${roomId}" is already in use. Generate a new code.`);
          // Teacher reconnecting after a Wi-Fi blip → reattach
          clearTimeout(existingRoom.hostTimer);
          existingRoom.hostWs = ws;
          boundRoomId = roomId; isHost = true;
          const g = db.groups[existingRoom.groupId];
          console.log(`[ROOM] host re-attached to "${roomId}"`);
          sendTo(ws, { type: 'host_created', roomId, group: g ? groupSummary(g) : null, info: roomInfo(existingRoom), reattached: true });
          return;
        }
        if (msg.reattach) return err('room_closed', 'The room closed while you were disconnected. Create a new room.');

        // Resolve the group
        let group = null;
        if (msg.groupMode === 'existing') {
          group = db.groups[String(msg.groupId || '')];
          if (!group) return err('group_missing', 'That group no longer exists. Pick another group or create a new one.');
        } else {
          const name = cleanName(msg.groupName, 60);
          if (!name) return err('group_name', 'Type a name for the new group (e.g. "Grade 9 – Rizal").');
          if (findGroupByName(name)) return err('group_exists', `A group named "${name}" already exists. Choose it under USE EXISTING GROUP, or type a different name.`);
          const id = genId('grp_');
          group = db.groups[id] = { id, name, createdAt: new Date().toISOString(), codes: [], players: {}, results: [] };
          console.log(`[DB] new group "${name}"`);
        }
        group.codes.push({ code: roomId, createdAt: new Date().toISOString() });
        saveDb();

        const room = { roomId, groupId: group.id, hostWs: ws, hostTimer: null, started: false, startPayload: null, kicked: new Set(), players: new Map() };
        rooms.set(roomId, room);
        boundRoomId = roomId; isHost = true;

        console.log(`[ROOM] "${roomId}" opened for group "${group.name}"`);
        sendTo(ws, { type: 'host_created', roomId, group: groupSummary(group), info: roomInfo(room) });
        break;
      }

      // ── Student step 1: check the code ─────────────────────────────────
      case 'room_check': {
        const roomId = cleanName(msg.roomId, 8).toUpperCase();
        const room = rooms.get(roomId);
        if (!room) return err('room_not_found', `Room code "${roomId}" was not found. Check the code with your teacher.`);
        const g = db.groups[room.groupId];
        sendTo(ws, { type: 'room_ok', roomId, groupName: g ? g.name : '' });
        break;
      }

      // ── Student step 2: join with a name ───────────────────────────────
      case 'player_join': {
        const roomId = cleanName(msg.roomId, 8).toUpperCase();
        const room = rooms.get(roomId);
        if (!room) return err('room_not_found', `Room code "${roomId}" was not found. Check the code with your teacher.`);
        const group = db.groups[room.groupId];
        if (!group) return err('group_missing', 'This group no longer exists.');

        const name = cleanName(msg.playerName, 40);
        if (name.length < 2) return err('name_short', 'Please type your name (at least 2 letters).');
        const key = nameKey(name);
        if (room.kicked.has(key)) return err('kicked', 'You were removed from this room by your teacher.');

        // Same name already in this room?
        let player = Array.from(room.players.values()).find(p => p.key === key);
        if (player && player.ws && player.ws.readyState === WebSocket.OPEN && player.ws !== ws) {
          return err('name_taken', `"${name}" is already playing in this room. If that isn't you, add your surname or last initial.`);
        }

        if (player) {
          player.ws = ws;                       // reconnecting student
          if (player.status === 'disconnected') player.status = msg.inGame ? 'playing' : 'waiting';
        } else {
          player = {
            id: genId('p_'), ws, name, key, status: 'waiting',
            errors: 0, opened: 0, totalCases: 0, round: 0, offer: null,
            dealValue: null, finalValue: null, caseValue: null, pts: null, ptsNum: null, winner: null,
            alerts: 0, gamesDone: 0,
          };
          room.players.set(player.id, player);
        }

        // Add the student to the group in the database
        const now = new Date().toISOString();
        if (!group.players[key]) group.players[key] = { name, firstJoined: now, lastJoined: now };
        else { group.players[key].lastJoined = now; group.players[key].name = name; }
        saveDb();

        boundRoomId = roomId;
        boundPlayerId = player.id;

        console.log(`[ROOM] "${name}" joined "${roomId}" (${group.name})`);
        sendTo(ws, { type: 'player_joined', playerId: player.id, playerName: player.name, groupName: group.name, roomId, started: !!room.started });

        // Late joiner: the teacher already pressed START → start them too
        if (room.started && room.startPayload && !msg.inGame && player.status !== 'done') {
          sendTo(ws, { type: 'host_message', payload: room.startPayload });
        }
        pushInfo(room);
        break;
      }

      // ── Student live progress ─────────────────────────────────────────
      case 'player_update': {
        const room = rooms.get(boundRoomId);
        if (!room) return;
        const p = room.players.get(boundPlayerId);
        if (!p) return;
        if (msg.newGame) {
          // A fresh game started → clear the previous result on the card
          p.finalValue = null; p.caseValue = null; p.pts = null; p.ptsNum = null; p.winner = null; p.dealValue = null; p.offer = null;
        }
        for (const f of ['status', 'errors', 'opened', 'totalCases', 'round', 'offer', 'dealValue']) {
          if (msg[f] !== undefined) p[f] = msg[f];
        }
        pushInfo(room);
        break;
      }

      // ── Student finished a game → save the score ───────────────────────
      case 'player_result': {
        const room = rooms.get(boundRoomId);
        if (!room) return;
        const p = room.players.get(boundPlayerId);
        if (!p) return;
        const group = db.groups[room.groupId];

        const gameId = cleanName(msg.gameId, 40) || genId('game_');
        p.status = 'done';
        p.finalValue = msg.final || null;
        p.caseValue = msg.caseVal || null;
        p.dealValue = msg.deal || null;
        p.pts = msg.pts || null;
        p.ptsNum = Number(msg.ptsNum) || 0;
        p.errors = Number(msg.errors) || 0;
        p.winner = msg.winner || null;

        if (group && !group.results.some(r => r.gameId === gameId)) {
          group.results.push({
            gameId,
            roomCode: room.roomId,
            playerName: p.name,
            datetime: new Date().toISOString(),
            caseVal: String(msg.caseVal || '—'),
            deal: String(msg.deal || 'No Deal'),
            final: String(msg.final || '—'),
            pts: String(msg.pts || '—'),
            ptsNum: Number(msg.ptsNum) || 0,
            errors: Number(msg.errors) || 0,
            winner: String(msg.winner || '—'),
            alerts: p.alerts || 0,
          });
          p.gamesDone = (p.gamesDone || 0) + 1;
          saveDb();
          console.log(`[DB] result saved: ${p.name} — ${msg.pts} (${group.name})`);
        }
        pushInfo(room);
        break;
      }

      // ── Teacher sends a command ────────────────────────────────────────
      case 'host_broadcast': {
        const room = rooms.get(boundRoomId);
        if (!room || !isHost) return;
        const payload = msg.payload || {};
        const targetId = msg.targetId ? String(msg.targetId) : null;

        if (!targetId && payload.cmd === 'start_game') {
          room.started = true;
          room.startPayload = payload;
        }

        let sent = 0;
        for (const p of Array.from(room.players.values())) {
          if (targetId && p.id !== targetId) continue;
          sendTo(p.ws, { type: 'host_message', payload });
          sent++;
          if (payload.cmd === 'kick') {
            room.kicked.add(p.key);
            room.players.delete(p.id);
            const sock = p.ws;
            setTimeout(() => { try { sock && sock.close(); } catch (e) {} }, 400);
          }
        }
        console.log(`[ROOM] "${boundRoomId}" host → ${targetId || 'all'} (${sent}):`, payload.cmd);
        pushInfo(room);
        break;
      }

      // ── Student left the tab ───────────────────────────────────────────
      case 'player_alert': {
        const room = rooms.get(boundRoomId);
        if (!room) return;
        const p = room.players.get(boundPlayerId);
        if (!p) return;
        p.alerts = (p.alerts || 0) + 1;
        console.log(`[ALERT] "${p.name}" left the tab (${p.alerts}x) in "${boundRoomId}"`);
        notifyHost(room, { type: 'player_alert', playerId: p.id, playerName: p.name, alertType: msg.alertType || 'tab_leave', count: p.alerts, at: msg.at || '' });
        pushInfo(room);
        break;
      }

      // ── Teacher ends the room on purpose ───────────────────────────────
      case 'host_end': {
        const room = rooms.get(boundRoomId);
        if (!room || !isHost || room.hostWs !== ws) return;
        room.hostWs = null;                       // don't send the teacher their own "closed" error
        closeRoom(boundRoomId, 'The teacher ended the session.');
        boundRoomId = null; isHost = false;
        break;
      }

      default:
        console.log('[WS] unknown message type:', msg.type);
    }
  });

  ws.on('close', () => {
    if (!boundRoomId) return;
    const room = rooms.get(boundRoomId);
    if (!room) return;

    if (isHost && room.hostWs === ws) {
      console.log(`[ROOM] "${boundRoomId}" host disconnected — waiting ${HOST_GRACE_MS / 1000}s`);
      const rid = boundRoomId;
      room.hostWs = null;
      room.hostTimer = setTimeout(() => closeRoom(rid, 'The teacher ended the session.'), HOST_GRACE_MS);
      return;
    }

    if (boundPlayerId && room.players.has(boundPlayerId)) {
      const p = room.players.get(boundPlayerId);
      if (p.ws === ws) {
        if (p.status !== 'done') p.status = 'disconnected';
        p.ws = null;
        pushInfo(room);
      }
    }
  });

  ws.on('error', (e) => console.error('[WS] error:', e.message));
});

// ──────────────────────────────────────────────────────────────────────────
// STARTUP
// ──────────────────────────────────────────────────────────────────────────
loadDb();

server.listen(PORT, HOST, () => {
  const isCloud = !!process.env.PORT;
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║   DEAL OR NO DEAL – SERVER RUNNING                        ║');
  console.log('║                 © 2026 JODEL                               ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
  if (isCloud) {
    console.log('☁️  Running in ONLINE (cloud) mode.');
    console.log('   Your hosting provider will show your public https:// link.');
  } else {
    console.log('📶 Running in OFFLINE (LAN/hotspot) mode.');
    console.log(`   Teacher (this computer): http://localhost:${PORT}`);
    console.log(`   Students (same WiFi):    http://${localIP}:${PORT}`);
  }
  console.log(`\n🗂  Database: ${DB_FILE}  (${Object.keys(db.groups).length} group(s))\n`);
});

function shutdown() {
  console.log('\n✓ Shutting down — saving database, closing rooms.');
  saveDbNow();
  for (const rid of Array.from(rooms.keys())) closeRoom(rid, 'The server was stopped.');
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 1500);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
