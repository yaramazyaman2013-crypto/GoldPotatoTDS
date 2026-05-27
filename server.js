// Gold Wave — Socket.IO game server
// Deploy to Railway (railway.app): connect GitHub repo → deploy.
// npm install  →  npm start  →  everyone connects to the same URL.

const express = require('express');
const http    = require('http');
const { Server } = require('socket.io');
const path    = require('path');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, {
  cors: { origin: '*' },
  transports: ['websocket', 'polling'],
});

app.use(express.static(path.join(__dirname, 'public')));

// ============================================================
// GAME CONSTANTS
// ============================================================
const C = {
  MAP_W: 1600, MAP_H: 1200,
  ROUND_MS:       10 * 60 * 1000,
  HEART_SPAWN_MS: 60 * 1000,
  MAX_HEARTS: 8,
  MAX_PLAYERS: 10,
  PLAYER_SPEED: 3,
  BULLET_SPEED: 9,
  PLAYER_R: 14,
  BULLET_R: 3,
  FIRE_COOLDOWN: 90,
  HP_PER_LIFE: 10,
  START_LIVES: 3,
  MAX_LIVES: 5,
  MAG_SIZE: 30,
  RELOAD_MS: 1500,
  TICK_MS: 33,
};

// ============================================================
// MAP
// ============================================================
function buildWalls() {
  const W = C.MAP_W, H = C.MAP_H;
  const w = [];
  w.push({x:0,y:0,w:W,h:20});
  w.push({x:0,y:H-20,w:W,h:20});
  w.push({x:0,y:0,w:20,h:H});
  w.push({x:W-20,y:0,w:20,h:H});
  const blocks = [
    [120,120,220,20],[120,120,20,100],[320,120,20,100],
    [400,120,220,20],[400,120,20,100],[600,120,20,100],
    [680,120,220,20],[680,120,20,100],[880,120,20,100],
    [960,120,220,20],[960,120,20,100],[1160,120,20,100],
    [1240,120,220,20],[1240,120,20,100],[1440,120,20,100],
    [200,360,240,20],[200,360,20,180],[200,540,100,20],[380,540,60,20],[420,360,20,200],
    [560,440,300,30],[920,440,300,30],
    [720,580,40,40],[880,700,40,40],[1080,580,40,40],
    [120,800,20,200],[120,980,220,20],[320,800,20,200],
    [400,800,20,200],[400,980,220,20],[600,800,20,200],
    [680,800,20,200],[680,980,220,20],[880,800,20,200],
    [960,800,20,200],[960,980,220,20],[1160,800,20,200],
    [1240,800,20,200],[1240,980,220,20],[1440,800,20,200],
    [560,720,140,20],[560,720,20,100],
    [1000,260,140,20],[1120,260,20,100],
    [740,540,160,50],
  ];
  for (const b of blocks) w.push({x:b[0],y:b[1],w:b[2],h:b[3]});
  return w;
}
const WALLS = buildWalls();

function circleRect(cx, cy, cr, r) {
  const nx = Math.max(r.x, Math.min(cx, r.x + r.w));
  const ny = Math.max(r.y, Math.min(cy, r.y + r.h));
  const dx = cx - nx, dy = cy - ny;
  return dx*dx + dy*dy < cr*cr;
}
function hitsWall(x, y, r) {
  for (const w of WALLS) if (circleRect(x, y, r, w)) return true;
  return false;
}
function randomSpawn() {
  for (let i = 0; i < 200; i++) {
    const x = 60 + Math.random() * (C.MAP_W - 120);
    const y = 60 + Math.random() * (C.MAP_H - 120);
    if (!hitsWall(x, y, C.PLAYER_R + 4)) return {x, y};
  }
  return {x: 80, y: 80};
}

// ============================================================
// ROOM STATE
// ============================================================
const rooms = new Map(); // code -> room

function makeCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 5; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

function newRoom(ownerSocketId, ownerName, ownerColor) {
  let code;
  do { code = makeCode(); } while (rooms.has(code));
  const room = {
    code, ownerId: ownerSocketId,
    started: false,
    players: new Map(),
    bullets: [], hearts: [],
    roundEndsAt: 0, lastHeartSpawn: 0,
    nextBulletId: 1, nextHeartId: 1,
    tickHandle: null, pendingRestart: null,
  };
  addPlayer(room, ownerSocketId, ownerName, ownerColor);
  rooms.set(code, room);
  return room;
}

function addPlayer(room, id, name, color) {
  const s = randomSpawn();
  room.players.set(id, {
    id, name: (name||'Player').slice(0,16),
    color: color || '#ff5577',
    x: s.x, y: s.y, angle: 0,
    hp: C.HP_PER_LIFE, lives: C.START_LIVES,
    alive: true,
    ammo: C.MAG_SIZE, reloading: false, reloadEndsAt: 0,
    kills: 0,
    keys: {w:false,a:false,s:false,d:false},
    mouseDown: false, fireCd: 0,
  });
}

function publicRoom(room) {
  return {
    id: room.code, ownerId: room.ownerId,
    started: room.started,
    count: room.players.size, max: C.MAX_PLAYERS,
    players: [...room.players.values()].map(p => ({
      id: p.id, name: p.name, color: p.color,
    })),
  };
}

function spawnHeart(room) {
  if (room.hearts.length >= C.MAX_HEARTS) return;
  for (let i = 0; i < 50; i++) {
    const x = 60 + Math.random() * (C.MAP_W - 120);
    const y = 60 + Math.random() * (C.MAP_H - 120);
    if (!hitsWall(x, y, 10)) { room.hearts.push({id: room.nextHeartId++, x, y}); return; }
  }
}

function startRound(room) {
  room.started = true;
  room.bullets = []; room.hearts = [];
  room.roundEndsAt = Date.now() + C.ROUND_MS;
  room.lastHeartSpawn = Date.now();
  room.nextBulletId = 1; room.nextHeartId = 1;
  for (const p of room.players.values()) {
    const s = randomSpawn();
    p.x = s.x; p.y = s.y;
    p.hp = C.HP_PER_LIFE; p.lives = C.START_LIVES;
    p.alive = true; p.kills = 0; p.angle = 0; p.fireCd = 0;
    p.ammo = C.MAG_SIZE; p.reloading = false; p.reloadEndsAt = 0;
  }
  for (let i = 0; i < 4; i++) spawnHeart(room);
  io.to(room.code).emit('roundStart', {
    endsAt: room.roundEndsAt,
    mapW: C.MAP_W, mapH: C.MAP_H, walls: WALLS,
  });
  if (room.tickHandle) clearInterval(room.tickHandle);
  room.tickHandle = setInterval(() => tick(room), C.TICK_MS);
}

function endRound(room) {
  if (!room.started) return;
  room.started = false;
  if (room.tickHandle) { clearInterval(room.tickHandle); room.tickHandle = null; }
  const board = [...room.players.values()]
    .map(p => ({id:p.id,name:p.name,kills:p.kills,color:p.color}))
    .sort((a,b)=>b.kills-a.kills);
  io.to(room.code).emit('roundEnd', {board, winner: board[0]||null});
  if (room.pendingRestart) clearTimeout(room.pendingRestart);
  room.pendingRestart = setTimeout(() => {
    if (rooms.has(room.code) && room.players.size > 0) startRound(room);
  }, 6000);
}

function checkRoundOver(room) {
  if (!room.started) return;
  const alive = [...room.players.values()].filter(p=>p.alive);
  if (alive.length <= 1 && room.players.size > 1) return endRound(room);
  if (alive.length === 0) return endRound(room);
  if (Date.now() >= room.roundEndsAt) return endRound(room);
}

function tryMove(p, dx, dy) {
  let nx = p.x+dx, ny = p.y+dy;
  nx = Math.max(C.PLAYER_R, Math.min(C.MAP_W-C.PLAYER_R, nx));
  ny = Math.max(C.PLAYER_R, Math.min(C.MAP_H-C.PLAYER_R, ny));
  if (!hitsWall(nx, p.y, C.PLAYER_R)) p.x = nx;
  if (!hitsWall(p.x, ny, C.PLAYER_R)) p.y = ny;
}

function tick(room) {
  if (!room.started) return;
  const now = Date.now();

  if (now - room.lastHeartSpawn >= C.HEART_SPAWN_MS) {
    spawnHeart(room); room.lastHeartSpawn = now;
  }

  for (const p of room.players.values()) {
    if (!p.alive) continue;
    let dx = 0, dy = 0;
    if (p.keys.w) dy -= 1; if (p.keys.s) dy += 1;
    if (p.keys.a) dx -= 1; if (p.keys.d) dx += 1;
    if (dx || dy) {
      const len = Math.hypot(dx, dy);
      tryMove(p, dx/len*C.PLAYER_SPEED, dy/len*C.PLAYER_SPEED);
    }
    p.fireCd -= C.TICK_MS;
    if (p.reloading && now >= p.reloadEndsAt) {
      p.reloading = false; p.ammo = C.MAG_SIZE;
    }
    if (p.mouseDown && p.fireCd <= 0 && p.ammo > 0 && !p.reloading) {
      p.fireCd = C.FIRE_COOLDOWN; p.ammo--;
      const m = 20;
      room.bullets.push({
        id: room.nextBulletId++, owner: p.id,
        x: p.x+Math.cos(p.angle)*m, y: p.y+Math.sin(p.angle)*m,
        vx: Math.cos(p.angle)*C.BULLET_SPEED, vy: Math.sin(p.angle)*C.BULLET_SPEED,
        life: 80,
      });
      if (p.ammo === 0) { p.reloading = true; p.reloadEndsAt = now + C.RELOAD_MS; }
    }
    for (let i = room.hearts.length-1; i >= 0; i--) {
      const h = room.hearts[i];
      if ((h.x-p.x)**2+(h.y-p.y)**2 < (C.PLAYER_R+10)**2 && p.lives < C.MAX_LIVES) {
        p.lives++; room.hearts.splice(i,1);
      }
    }
  }

  for (let i = room.bullets.length-1; i >= 0; i--) {
    const b = room.bullets[i];
    b.x += b.vx; b.y += b.vy; b.life--;
    if (b.life<=0||b.x<0||b.y<0||b.x>C.MAP_W||b.y>C.MAP_H) { room.bullets.splice(i,1); continue; }
    if (hitsWall(b.x, b.y, C.BULLET_R)) { room.bullets.splice(i,1); continue; }
    for (const p of room.players.values()) {
      if (!p.alive || p.id===b.owner) continue;
      if ((p.x-b.x)**2+(p.y-b.y)**2 < C.PLAYER_R**2) {
        p.hp--; room.bullets.splice(i,1);
        if (p.hp <= 0) {
          p.lives--;
          const killer = room.players.get(b.owner);
          if (killer) killer.kills++;
          io.to(room.code).emit('kill', {killer: killer?killer.name:'?', victim: p.name});
          if (p.lives <= 0) { p.alive = false; }
          else { const s=randomSpawn(); p.x=s.x; p.y=s.y; p.hp=C.HP_PER_LIFE; }
        }
        break;
      }
    }
  }

  io.to(room.code).emit('state', {
    t: now, endsAt: room.roundEndsAt,
    players: [...room.players.values()].map(p => ({
      id:p.id, name:p.name, color:p.color,
      x:p.x, y:p.y, angle:p.angle,
      hp:p.hp, lives:p.lives, maxHp:C.HP_PER_LIFE,
      ammo:p.ammo, maxAmmo:C.MAG_SIZE,
      reloading:p.reloading, reloadEndsAt:p.reloadEndsAt,
      alive:p.alive, kills:p.kills,
    })),
    bullets: room.bullets.map(b=>({x:b.x,y:b.y})),
    hearts:  room.hearts.map(h=>({x:h.x,y:h.y})),
  });
  checkRoundOver(room);
}

function destroyRoom(room) {
  if (room.tickHandle) clearInterval(room.tickHandle);
  if (room.pendingRestart) clearTimeout(room.pendingRestart);
  rooms.delete(room.code);
}

// ============================================================
// SOCKET.IO
// ============================================================
const socketRoom = new Map(); // socketId -> roomCode

io.on('connection', (socket) => {
  console.log('[+]', socket.id);

  socket.on('createRoom', ({name, color}, ack) => {
    leaveCurrentRoom(socket);
    const room = newRoom(socket.id, name, color);
    socketRoom.set(socket.id, room.code);
    socket.join(room.code);
    ack && ack({
      ok: true, roomId: room.code,
      ownerId: socket.id, selfId: socket.id,
      room: publicRoom(room),
    });
    console.log('[createRoom]', room.code, name);
  });

  socket.on('joinRoom', ({roomId, name, color}, ack) => {
    const code = String(roomId||'').trim().toUpperCase();
    const room = rooms.get(code);
    if (!room)               return ack && ack({ok:false, error:'Oda bulunamadı (kod yanlış?)'});
    if (room.players.size >= C.MAX_PLAYERS) return ack && ack({ok:false, error:'Oda dolu'});
    if (room.started)        return ack && ack({ok:false, error:'Oyun zaten başladı'});
    leaveCurrentRoom(socket);
    addPlayer(room, socket.id, name, color);
    socketRoom.set(socket.id, room.code);
    socket.join(room.code);
    ack && ack({
      ok: true, roomId: room.code,
      ownerId: room.ownerId, selfId: socket.id,
      room: publicRoom(room),
    });
    io.to(room.code).emit('roomUpdate', publicRoom(room));
    console.log('[joinRoom]', code, name);
  });

  socket.on('leaveRoom', () => leaveCurrentRoom(socket));

  socket.on('startGame', () => {
    const code = socketRoom.get(socket.id);
    const room = code && rooms.get(code);
    if (!room || room.ownerId !== socket.id || room.started) return;
    startRound(room);
  });

  socket.on('input', (input) => {
    const code = socketRoom.get(socket.id);
    const room = code && rooms.get(code);
    if (!room) return;
    const p = room.players.get(socket.id);
    if (!p) return;
    if (input.keys) p.keys = input.keys;
    if (typeof input.angle === 'number') p.angle = input.angle;
    if (typeof input.mouseDown === 'boolean') p.mouseDown = input.mouseDown;
  });

  socket.on('reload', () => {
    const code = socketRoom.get(socket.id);
    const room = code && rooms.get(code);
    if (!room) return;
    const p = room.players.get(socket.id);
    if (!p || !p.alive || p.reloading || p.ammo === C.MAG_SIZE) return;
    p.reloading = true;
    p.reloadEndsAt = Date.now() + C.RELOAD_MS;
  });

  socket.on('changeColor', ({color}) => {
    const code = socketRoom.get(socket.id);
    const room = code && rooms.get(code);
    if (!room) return;
    const p = room.players.get(socket.id);
    if (p) p.color = color;
    io.to(room.code).emit('roomUpdate', publicRoom(room));
  });

  socket.on('chatName', ({name}) => {
    const code = socketRoom.get(socket.id);
    const room = code && rooms.get(code);
    if (!room) return;
    const p = room.players.get(socket.id);
    if (p) p.name = (name||'Player').slice(0,16);
    io.to(room.code).emit('roomUpdate', publicRoom(room));
  });

  socket.on('disconnect', () => {
    console.log('[-]', socket.id);
    leaveCurrentRoom(socket);
  });
});

function leaveCurrentRoom(socket) {
  const code = socketRoom.get(socket.id);
  if (!code) return;
  socketRoom.delete(socket.id);
  const room = rooms.get(code);
  if (!room) return;
  room.players.delete(socket.id);
  socket.leave(code);
  if (room.players.size === 0) { destroyRoom(room); return; }
  if (room.ownerId === socket.id) {
    room.ownerId = room.players.keys().next().value;
    io.to(code).emit('hostChanged', {newOwnerId: room.ownerId});
  }
  if (room.started) checkRoundOver(room);
  if (rooms.has(code)) io.to(code).emit('roomUpdate', publicRoom(room));
}

// ============================================================
// START
// ============================================================
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log('Gold Wave server on port ' + PORT));
