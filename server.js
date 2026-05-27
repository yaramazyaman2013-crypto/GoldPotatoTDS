const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

const MAP_W = 1600;
const MAP_H = 1200;
const TILE = 40;
const ROUND_MS = 10 * 60 * 1000;
const HEART_SPAWN_MS = 60 * 1000;
const MAX_HEARTS = 8;
const MAX_PLAYERS = 10;
const PLAYER_SPEED = 3;
const BULLET_SPEED = 9;
const PLAYER_R = 14;
const BULLET_R = 3;
const FIRE_COOLDOWN = 90;
const HP_PER_LIFE = 10;
const START_LIVES = 3;
const MAX_LIVES = 5;
const MAG_SIZE = 30;
const RELOAD_MS = 1500;

// American-office-style map: walls (desks/cubicles) as rectangles
function buildWalls() {
  const w = [];
  // outer borders
  w.push({ x: 0, y: 0, w: MAP_W, h: 20 });
  w.push({ x: 0, y: MAP_H - 20, w: MAP_W, h: 20 });
  w.push({ x: 0, y: 0, w: 20, h: MAP_H });
  w.push({ x: MAP_W - 20, y: 0, w: 20, h: MAP_H });
  // cubicle blocks (desk + partial wall) — non-flat cover layout
  const blocks = [
    // row of cubicles top
    [120, 120, 220, 20], [120, 120, 20, 100], [320, 120, 20, 100],
    [400, 120, 220, 20], [400, 120, 20, 100], [600, 120, 20, 100],
    [680, 120, 220, 20], [680, 120, 20, 100], [880, 120, 20, 100],
    [960, 120, 220, 20], [960, 120, 20, 100], [1160, 120, 20, 100],
    [1240, 120, 220, 20], [1240, 120, 20, 100], [1440, 120, 20, 100],
    // meeting room walls (center-left)
    [200, 360, 240, 20], [200, 360, 20, 180], [200, 540, 100, 20], [380, 540, 60, 20], [420, 360, 20, 200],
    // long desk row middle
    [560, 440, 300, 30],
    [920, 440, 300, 30],
    // pillars
    [720, 580, 40, 40], [880, 700, 40, 40], [1080, 580, 40, 40],
    // bottom cubicles
    [120, 800, 20, 200], [120, 980, 220, 20], [320, 800, 20, 200],
    [400, 800, 20, 200], [400, 980, 220, 20], [600, 800, 20, 200],
    [680, 800, 20, 200], [680, 980, 220, 20], [880, 800, 20, 200],
    [960, 800, 20, 200], [960, 980, 220, 20], [1160, 800, 20, 200],
    [1240, 800, 20, 200], [1240, 980, 220, 20], [1440, 800, 20, 200],
    // copier rooms
    [560, 720, 140, 20], [560, 720, 20, 100],
    [1000, 260, 140, 20], [1120, 260, 20, 100],
    // central conference table (cover)
    [740, 540, 160, 50],
  ];
  for (const b of blocks) w.push({ x: b[0], y: b[1], w: b[2], h: b[3] });
  return w;
}
const WALLS = buildWalls();

function circleRectCollide(cx, cy, cr, r) {
  const nx = Math.max(r.x, Math.min(cx, r.x + r.w));
  const ny = Math.max(r.y, Math.min(cy, r.y + r.h));
  const dx = cx - nx, dy = cy - ny;
  return dx * dx + dy * dy < cr * cr;
}
function hitsWall(x, y, r) {
  for (const w of WALLS) if (circleRectCollide(x, y, r, w)) return true;
  return false;
}
function randomSpawn() {
  for (let i = 0; i < 200; i++) {
    const x = 60 + Math.random() * (MAP_W - 120);
    const y = 60 + Math.random() * (MAP_H - 120);
    if (!hitsWall(x, y, PLAYER_R + 4)) return { x, y };
  }
  return { x: 80, y: 80 };
}

// rooms: id -> room
const rooms = new Map();

function newRoomId() {
  return Math.random().toString(36).slice(2, 7).toUpperCase();
}

function createRoom(ownerId) {
  const id = newRoomId();
  const room = {
    id,
    ownerId,
    players: new Map(), // socketId -> player
    bullets: [],
    hearts: [],
    started: false,
    roundEndsAt: 0,
    lastHeartSpawn: 0,
    nextBulletId: 1,
    nextHeartId: 1,
    leaderboard: [], // {name, kills}
    walls: WALLS,
    mapW: MAP_W,
    mapH: MAP_H,
  };
  rooms.set(id, room);
  return room;
}

function publicRoom(room) {
  return {
    id: room.id,
    ownerId: room.ownerId,
    started: room.started,
    count: room.players.size,
    max: MAX_PLAYERS,
    players: [...room.players.values()].map(p => ({ id: p.id, name: p.name, color: p.color })),
  };
}

function spawnHeart(room) {
  if (room.hearts.length >= MAX_HEARTS) return;
  for (let i = 0; i < 50; i++) {
    const x = 60 + Math.random() * (MAP_W - 120);
    const y = 60 + Math.random() * (MAP_H - 120);
    if (!hitsWall(x, y, 10)) {
      room.hearts.push({ id: room.nextHeartId++, x, y });
      return;
    }
  }
}

function startRound(room) {
  room.started = true;
  room.bullets = [];
  room.hearts = [];
  room.roundEndsAt = Date.now() + ROUND_MS;
  room.lastHeartSpawn = Date.now();
  for (const p of room.players.values()) {
    const s = randomSpawn();
    p.x = s.x; p.y = s.y;
    p.hp = HP_PER_LIFE;
    p.lives = START_LIVES;
    p.alive = true;
    p.kills = 0;
    p.angle = 0;
    p.fireCd = 0;
    p.ammo = MAG_SIZE;
    p.reloading = false;
    p.reloadEndsAt = 0;
  }
  // initial hearts
  for (let i = 0; i < 4; i++) spawnHeart(room);
  io.to(room.id).emit('roundStart', {
    endsAt: room.roundEndsAt,
    mapW: MAP_W, mapH: MAP_H, walls: WALLS,
  });
}

function endRound(room) {
  if (!room.started) return;
  room.started = false;
  const board = [...room.players.values()]
    .map(p => ({ id: p.id, name: p.name, kills: p.kills, color: p.color }))
    .sort((a, b) => b.kills - a.kills);
  const winner = board[0] || null;
  io.to(room.id).emit('roundEnd', { board, winner });
  // restart in same lobby after delay
  setTimeout(() => {
    if (rooms.has(room.id) && room.players.size > 0) {
      startRound(room);
    }
  }, 6000);
}

function checkRoundOver(room) {
  if (!room.started) return;
  const alive = [...room.players.values()].filter(p => p.alive);
  if (alive.length <= 1 && room.players.size > 1) return endRound(room);
  if (alive.length === 0) return endRound(room);
  if (Date.now() >= room.roundEndsAt) return endRound(room);
}

// movement with collision: try axis-aligned slide
function tryMove(p, dx, dy) {
  let nx = p.x + dx, ny = p.y + dy;
  nx = Math.max(PLAYER_R, Math.min(MAP_W - PLAYER_R, nx));
  ny = Math.max(PLAYER_R, Math.min(MAP_H - PLAYER_R, ny));
  if (!hitsWall(nx, p.y, PLAYER_R)) p.x = nx;
  if (!hitsWall(p.x, ny, PLAYER_R)) p.y = ny;
}

io.on('connection', (socket) => {
  socket.data.roomId = null;

  socket.on('listRooms', (cb) => {
    const list = [...rooms.values()].filter(r => !r.started && r.players.size < MAX_PLAYERS).map(publicRoom);
    cb(list);
  });

  socket.on('createRoom', ({ name, color }, cb) => {
    const room = createRoom(socket.id);
    joinRoomInternal(socket, room, name, color);
    cb({ ok: true, roomId: room.id, ownerId: room.ownerId, room: publicRoom(room) });
  });

  socket.on('joinRoom', ({ roomId, name, color }, cb) => {
    const room = rooms.get(roomId);
    if (!room) return cb({ ok: false, error: 'Oda bulunamadı' });
    if (room.started) return cb({ ok: false, error: 'Oyun başladı' });
    if (room.players.size >= MAX_PLAYERS) return cb({ ok: false, error: 'Oda dolu' });
    joinRoomInternal(socket, room, name, color);
    cb({ ok: true, roomId: room.id, ownerId: room.ownerId, room: publicRoom(room) });
  });

  function joinRoomInternal(socket, room, name, color) {
    const s = randomSpawn();
    const player = {
      id: socket.id,
      name: (name || 'Player').slice(0, 16),
      color: color || '#ff5577',
      x: s.x, y: s.y,
      angle: 0,
      hp: HP_PER_LIFE,
      lives: START_LIVES,
      alive: true,
      ammo: MAG_SIZE,
      reloading: false,
      reloadEndsAt: 0,
      kills: 0,
      keys: { w: false, a: false, s: false, d: false },
      mouseDown: false,
      fireCd: 0,
    };
    room.players.set(socket.id, player);
    socket.join(room.id);
    socket.data.roomId = room.id;
    io.to(room.id).emit('roomUpdate', publicRoom(room));
  }

  socket.on('startGame', () => {
    const room = rooms.get(socket.data.roomId);
    if (!room) return;
    if (room.ownerId !== socket.id) return;
    if (room.started) return;
    startRound(room);
  });

  socket.on('input', (data) => {
    const room = rooms.get(socket.data.roomId);
    if (!room) return;
    const p = room.players.get(socket.id);
    if (!p) return;
    if (data.keys) p.keys = data.keys;
    if (typeof data.angle === 'number') p.angle = data.angle;
    if (typeof data.mouseDown === 'boolean') p.mouseDown = data.mouseDown;
  });

  socket.on('chatName', ({ name }) => {
    const room = rooms.get(socket.data.roomId);
    if (!room) return;
    const p = room.players.get(socket.id);
    if (!p) return;
    p.name = (name || 'Player').slice(0, 16);
    io.to(room.id).emit('roomUpdate', publicRoom(room));
  });

  socket.on('changeColor', ({ color }) => {
    const room = rooms.get(socket.data.roomId);
    if (!room) return;
    const p = room.players.get(socket.id);
    if (!p) return;
    p.color = color;
    io.to(room.id).emit('roomUpdate', publicRoom(room));
  });

  socket.on('reload', () => {
    const room = rooms.get(socket.data.roomId);
    if (!room) return;
    const p = room.players.get(socket.id);
    if (!p || !p.alive) return;
    if (p.reloading || p.ammo === MAG_SIZE) return;
    p.reloading = true;
    p.reloadEndsAt = Date.now() + RELOAD_MS;
  });

  socket.on('leaveRoom', () => leave());

  socket.on('disconnect', () => leave());

  function leave() {
    const room = rooms.get(socket.data.roomId);
    if (!room) return;
    room.players.delete(socket.id);
    socket.leave(room.id);
    socket.data.roomId = null;
    if (room.players.size === 0) {
      rooms.delete(room.id);
    } else {
      if (room.ownerId === socket.id) {
        room.ownerId = [...room.players.keys()][0];
      }
      io.to(room.id).emit('roomUpdate', publicRoom(room));
      checkRoundOver(room);
    }
  }
});

// game loop ~30Hz
setInterval(() => {
  const now = Date.now();
  for (const room of rooms.values()) {
    if (!room.started) continue;

    // spawn hearts every minute
    if (now - room.lastHeartSpawn >= HEART_SPAWN_MS) {
      spawnHeart(room);
      room.lastHeartSpawn = now;
    }

    // players
    for (const p of room.players.values()) {
      if (!p.alive) continue;
      let dx = 0, dy = 0;
      if (p.keys.w) dy -= 1;
      if (p.keys.s) dy += 1;
      if (p.keys.a) dx -= 1;
      if (p.keys.d) dx += 1;
      if (dx || dy) {
        const len = Math.hypot(dx, dy);
        dx = dx / len * PLAYER_SPEED;
        dy = dy / len * PLAYER_SPEED;
        tryMove(p, dx, dy);
      }
      p.fireCd -= 33;
      // reload tick
      if (p.reloading && now >= p.reloadEndsAt) {
        p.reloading = false;
        p.ammo = MAG_SIZE;
      }
      if (p.mouseDown && p.fireCd <= 0 && p.ammo > 0 && !p.reloading) {
        p.fireCd = FIRE_COOLDOWN;
        p.ammo -= 1;
        const muzzle = 20;
        const bx = p.x + Math.cos(p.angle) * muzzle;
        const by = p.y + Math.sin(p.angle) * muzzle;
        room.bullets.push({
          id: room.nextBulletId++,
          owner: p.id,
          x: bx, y: by,
          vx: Math.cos(p.angle) * BULLET_SPEED,
          vy: Math.sin(p.angle) * BULLET_SPEED,
          life: 80,
        });
        if (p.ammo === 0) {
          p.reloading = true;
          p.reloadEndsAt = now + RELOAD_MS;
        }
      }
      // pick up hearts (add a life)
      for (let i = room.hearts.length - 1; i >= 0; i--) {
        const h = room.hearts[i];
        if ((h.x - p.x) ** 2 + (h.y - p.y) ** 2 < (PLAYER_R + 10) ** 2) {
          if (p.lives < MAX_LIVES) {
            p.lives += 1;
            room.hearts.splice(i, 1);
          }
        }
      }
    }

    // bullets
    for (let i = room.bullets.length - 1; i >= 0; i--) {
      const b = room.bullets[i];
      b.x += b.vx; b.y += b.vy; b.life--;
      if (b.life <= 0 || b.x < 0 || b.y < 0 || b.x > MAP_W || b.y > MAP_H) {
        room.bullets.splice(i, 1); continue;
      }
      if (hitsWall(b.x, b.y, BULLET_R)) { room.bullets.splice(i, 1); continue; }
      for (const p of room.players.values()) {
        if (!p.alive || p.id === b.owner) continue;
        if ((p.x - b.x) ** 2 + (p.y - b.y) ** 2 < (PLAYER_R) ** 2) {
          p.hp -= 1;
          room.bullets.splice(i, 1);
          if (p.hp <= 0) {
            p.lives -= 1;
            const killer = room.players.get(b.owner);
            if (killer) killer.kills += 1;
            io.to(room.id).emit('kill', { killer: killer ? killer.name : '?', victim: p.name });
            if (p.lives <= 0) {
              p.alive = false;
            } else {
              // respawn at safe random spot, full HP
              const s = randomSpawn();
              p.x = s.x; p.y = s.y; p.hp = HP_PER_LIFE;
            }
          }
          break;
        }
      }
    }

    // state broadcast
    const state = {
      t: now,
      endsAt: room.roundEndsAt,
      players: [...room.players.values()].map(p => ({
        id: p.id, name: p.name, color: p.color,
        x: p.x, y: p.y, angle: p.angle,
        hp: p.hp, lives: p.lives, maxHp: HP_PER_LIFE,
        ammo: p.ammo, maxAmmo: MAG_SIZE,
        reloading: p.reloading, reloadEndsAt: p.reloadEndsAt,
        alive: p.alive, kills: p.kills,
      })),
      bullets: room.bullets.map(b => ({ x: b.x, y: b.y })),
      hearts: room.hearts.map(h => ({ x: h.x, y: h.y })),
    };
    io.to(room.id).emit('state', state);

    checkRoundOver(room);
  }
}, 33);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log('Server on :' + PORT));
