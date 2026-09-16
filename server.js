/**
 * ============================================================================
 * DEAL OR NO DEAL – ACADEMIC EDITION
 * THE SERVER (works for BOTH Offline/LAN and Online/Internet)
 * ============================================================================
 *
 * AUTHOR: Jodel
 *
 * WHY THIS FILE REPLACES YOUR OLD server.js:
 * ----------------------------------------------------------------------------
 * Your game's built-in multiplayer engine (search the HTML for "MULTIPLAYER
 * ENGINE") sends these WebSocket messages:
 *
 *      host_create      { roomId }
 *      group_join       { roomId, groupId, groupName }
 *      group_update     { roomId, groupId, status, dealValue, finalValue, pts, errors }
 *      host_broadcast   { payload }
 *
 * ...and expects these back:
 *
 *      host_created         { roomId, info }
 *      group_joined         { groupId, groupName, info }   (to the joiner)
 *      group_joined/update  { info }                        (to the host, to refresh dashboard)
 *      group_disconnected   { info }
 *      host_message         { payload }
 *      error                { msg }
 *
 * Your OLD server.js only understood join_room / sync_request — messages the
 * game never sends. So the WebSocket connected fine, but the moment the game
 * asked to create/join a room, the server had nothing to say back. The screen
 * just sat on "Creating room…" / "Joining room…" forever. That was the bug.
 *
 * THIS server speaks the game's actual protocol, so Create/Join now work.
 *
 * ----------------------------------------------------------------------------
 * ONE FILE, TWO MODES — NO CODE CHANGES NEEDED BETWEEN THEM:
 * ----------------------------------------------------------------------------
 * OFFLINE (hotspot/LAN):  node server.js  → open the printed http://IP:3000
 * ONLINE  (internet):     deploy this exact file to a free host (Render,
 *                          Glitch, Railway, etc). The game auto-detects
 *                          "wss://" + the page's own domain, so the SAME
 *                          HTML works unmodified in both places.
 *
 * See DEPLOY_ONLINE_FREE.md for the free-hosting walkthrough with a
 * copy-paste live link.
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
const PORT = process.env.PORT || 3000;          // Render/Glitch/Railway set PORT for you
const HOST = process.env.HOST || '0.0.0.0';
const HTML_FILE = path.join(__dirname, 'DealOrNoDeal_Offline_Hotspot.html');

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
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

// ──────────────────────────────────────────────────────────────────────────
// HTTP SERVER (serves the game; also a tiny health/status API)
// ──────────────────────────────────────────────────────────────────────────
const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

  const parsedUrl = url.parse(req.url, true);
  let pathname = parsedUrl.pathname;

  if (pathname === '/health' || pathname === '/api/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'online',
      rooms: rooms.size,
      localIP,
      port: PORT,
      time: new Date().toISOString(),
    }));
    return;
  }

  if (pathname === '/' || pathname === '') pathname = '/index.html';

  const filePath = pathname === '/index.html'
    ? HTML_FILE
    : path.join(__dirname, pathname);

  const ext = path.extname(filePath).toLowerCase();
  const mimeType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      // SPA fallback → always serve the game itself
      fs.readFile(HTML_FILE, (err2, data2) => {
        if (err2) {
          res.writeHead(500, { 'Content-Type': 'text/plain' });
          res.end('Error loading game. Is DealOrNoDeal_Offline_Hotspot.html in this folder?');
          return;
        }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(data2);
      });
      return;
    }
    res.writeHead(200, { 'Content-Type': mimeType });
    res.end(data);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// ROOM STATE  (in-memory — resets if the server restarts, which is what
// makes "close server → link/room dies immediately" work for free)
// ──────────────────────────────────────────────────────────────────────────
// rooms: roomId -> {
//   hostWs,
//   groups: Map<groupId, { ws, name, status, errors, dealValue, finalValue, pts }>
// }
const rooms = new Map();

function roomInfo(room) {
  return {
    groups: Array.from(room.groups.values()).map(g => ({
      name: g.name,
      status: g.status,
      errors: g.errors || 0,
      dealValue: g.dealValue || null,
      finalValue: g.finalValue || null,
      pts: g.pts || null,
    })),
  };
}

function sendTo(ws, msg) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

function notifyHost(room, msg) {
  if (room && room.hostWs) sendTo(room.hostWs, msg);
}

function genGroupId() {
  return 'g_' + Math.random().toString(36).slice(2, 10);
}

// ──────────────────────────────────────────────────────────────────────────
// WEBSOCKET SERVER — speaks the game's exact protocol
// ──────────────────────────────────────────────────────────────────────────
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws, req) => {
  const clientIP = req.socket.remoteAddress;
  console.log(`[WS] connection from ${clientIP}`);

  // Track what this socket is, so we can clean up correctly on close
  let boundRoomId = null;
  let boundGroupId = null;
  let isHost = false;

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch (e) {
      sendTo(ws, { type: 'error', msg: 'Malformed message.' });
      return;
    }

    switch (msg.type) {

      // ── Host creates a room ────────────────────────────────────────────
      case 'host_create': {
        const roomId = String(msg.roomId || 'ROOM1').toUpperCase();

        if (rooms.has(roomId)) {
          // Reuse if the same host reconnects; otherwise block duplicate host
          const existing = rooms.get(roomId);
          if (existing.hostWs && existing.hostWs.readyState === WebSocket.OPEN && existing.hostWs !== ws) {
            sendTo(ws, { type: 'error', msg: `Room "${roomId}" already has an active host. Choose a different Room ID.` });
            return;
          }
        }

        const room = rooms.get(roomId) || { hostWs: null, groups: new Map() };
        room.hostWs = ws;
        rooms.set(roomId, room);

        boundRoomId = roomId;
        isHost = true;

        console.log(`[ROOM] "${roomId}" created/hosted`);
        sendTo(ws, { type: 'host_created', roomId, info: roomInfo(room) });
        break;
      }

      // ── A group joins a room ───────────────────────────────────────────
      case 'group_join': {
        const roomId = String(msg.roomId || 'ROOM1').toUpperCase();
        const room = rooms.get(roomId);

        if (!room) {
          sendTo(ws, { type: 'error', msg: `Room "${roomId}" not found. Ask your host for the correct Room ID, and make sure they clicked "CREATE ROOM" first.` });
          return;
        }

        const groupId = genGroupId();
        const groupName = String(msg.groupName || 'Group').slice(0, 40);

        room.groups.set(groupId, {
          ws,
          name: groupName,
          status: 'playing',
          errors: 0,
          dealValue: null,
          finalValue: null,
          pts: null,
        });

        boundRoomId = roomId;
        boundGroupId = groupId;

        console.log(`[ROOM] "${groupName}" joined "${roomId}"`);

        // Tell the joining group who they are
        sendTo(ws, { type: 'group_joined', groupId, groupName, info: roomInfo(room) });

        // Refresh the host's dashboard
        notifyHost(room, { type: 'group_joined', info: roomInfo(room) });
        break;
      }

      // ── A group reports a status/score update ──────────────────────────
      case 'group_update': {
        const room = rooms.get(boundRoomId);
        if (!room) return;
        const g = room.groups.get(boundGroupId || msg.groupId);
        if (!g) return;

        if (msg.status !== undefined) g.status = msg.status;
        if (msg.dealValue !== undefined) g.dealValue = msg.dealValue;
        if (msg.finalValue !== undefined) g.finalValue = msg.finalValue;
        if (msg.pts !== undefined) g.pts = msg.pts;
        if (msg.errors !== undefined) g.errors = msg.errors;

        notifyHost(room, { type: 'group_update', info: roomInfo(room) });
        break;
      }

      // ── Host broadcasts a command (e.g. start_game) to all groups ──────
      case 'host_broadcast': {
        const room = rooms.get(boundRoomId);
        if (!room || !isHost) return;
        for (const g of room.groups.values()) {
          sendTo(g.ws, { type: 'host_message', payload: msg.payload });
        }
        console.log(`[ROOM] "${boundRoomId}" host broadcast:`, msg.payload);
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
      // Host closed → tell every connected group the session ended, then
      // remove the room entirely. This is what makes the room/link "die"
      // immediately when the teacher stops the server or leaves the page.
      console.log(`[ROOM] "${boundRoomId}" host disconnected — closing room`);
      for (const g of room.groups.values()) {
        sendTo(g.ws, { type: 'error', msg: 'The host ended the session.' });
      }
      rooms.delete(boundRoomId);
      return;
    }

    if (boundGroupId && room.groups.has(boundGroupId)) {
      room.groups.get(boundGroupId).status = 'disconnected';
      notifyHost(room, { type: 'group_disconnected', info: roomInfo(room) });
      room.groups.delete(boundGroupId);
      console.log(`[ROOM] group left "${boundRoomId}"`);
    }
  });

  ws.on('error', (err) => console.error('[WS] error:', err.message));
});

// ──────────────────────────────────────────────────────────────────────────
// STARTUP
// ──────────────────────────────────────────────────────────────────────────
server.listen(PORT, HOST, () => {
  const isCloud = !!process.env.PORT; // Render/Glitch/Railway inject PORT
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
  console.log('\nBoth modes use the exact same game file and the exact same');
  console.log('multiplayer protocol — nothing else to configure.\n');
});

process.on('SIGINT', () => {
  console.log('\n✓ Shutting down — all rooms closed.');
  for (const [roomId, room] of rooms) {
    for (const g of room.groups.values()) sendTo(g.ws, { type: 'error', msg: 'The host ended the session.' });
    notifyHost(room, { type: 'error', msg: 'Server stopped.' });
  }
  server.close(() => process.exit(0));
});
process.on('SIGTERM', () => {
  server.close(() => process.exit(0));
});
