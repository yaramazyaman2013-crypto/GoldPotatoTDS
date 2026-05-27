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
  PLAYER_SPEED: 4.8,
  BULLET_SPEED: 14,
  PLAYER_R: 14,
  BULLET_R: 3,
  FIRE_COOLDOWN: 80,
  HP_PER_LIFE: 10,
  START_LIVES: 3,
  MAX_LIVES: 5,
  MAG_SIZE: 30,
  RELOAD_MS: 1500,
  TICK_MS: 25,
  BROADCAST_EVERY: 2,        // state broadcast every N ticks (~50ms)
  // Rocket
  ROCKET_SPAWN_MS: 35 * 1000,
  MAX_ROCKET_PICKUPS: 3,
  ROCKET_CHARGES: 2,
  ROCKET_SPEED: 11,
  ROCKET_R: 6,
  ROCKET_FIRE_COOLDOWN: 320,
  ROCKET_AOE_R: 70,
  // Classes
  CYBER_ROCKET_INTERVAL: 150 * 1000,
  ENGINEER_TURRET_CD:    180 * 1000,
  MEDIC_PET_CD:          210 * 1000,
  TANK_KILLS_REQUIRED:   5,
  TANK_DURATION:         20 * 1000,
  // Turret
  TURRET_HP: 8,
  TURRET_RANGE: 280,
  TURRET_FIRE_CD: 600,
  TURRET_BULLET_SPEED: 12,
  // Pet (heal totem)
  PET_DURATION: 60 * 1000,
  PET_HEAL_R: 35,
  PET_HEAL_PER_TICK: 1,      // hp per server tick (~25ms) → fast regen
  PET_HEAL_EVERY: 250,       // ms between heal ticks
};

// ============================================================
// MAP — outdoor stone buildings with dirt paths
// ============================================================
// Building helper: outline a rectangle with optional gaps for entrances.
// gaps: { t:[start,end], b:[start,end], l:[start,end], r:[start,end] }
function building(x, y, w, h, gaps) {
  const T = 20, out = [];
  gaps = gaps || {};
  // top wall (horizontal at y)
  function hWall(x1, y1, x2) { if (x2 > x1) out.push({x:x1, y:y1, w:x2-x1, h:T}); }
  function vWall(x1, y1, y2) { if (y2 > y1) out.push({x:x1, y:y1, w:T, h:y2-y1}); }
  // top
  if (!gaps.t) hWall(x, y, x+w);
  else { hWall(x, y, gaps.t[0]); hWall(gaps.t[1], y, x+w); }
  // bottom
  if (!gaps.b) hWall(x, y+h-T, x+w);
  else { hWall(x, y+h-T, gaps.b[0]); hWall(gaps.b[1], y+h-T, x+w); }
  // left
  if (!gaps.l) vWall(x, y, y+h);
  else { vWall(x, y, gaps.l[0]); vWall(x, gaps.l[1], y+h); }
  // right
  if (!gaps.r) vWall(x+w-T, y, y+h);
  else { vWall(x+w-T, y, gaps.r[0]); vWall(x+w-T, gaps.r[1], y+h); }
  return out;
}

function buildWalls() {
  const W = C.MAP_W, H = C.MAP_H;
  const w = [];
  // outer border
  w.push({x:0,y:0,w:W,h:20});
  w.push({x:0,y:H-20,w:W,h:20});
  w.push({x:0,y:0,w:20,h:H});
  w.push({x:W-20,y:0,w:20,h:H});

  // Buildings (outlined rectangles with entrances)
  const buildings = [
    // NW big building — entrance south
    building(200, 150, 280, 240, { b: [310, 380] }),
    // N small building — entrance south
    building(720, 100, 200, 180, { b: [790, 850] }),
    // NE big building — entrance west + south
    building(1140, 150, 280, 260, { l: [220, 290], b: [1240, 1320] }),
    // SW building — entrance north
    building(180, 780, 280, 260, { t: [260, 330] }),
    // S center building — entrance north and east
    building(700, 880, 220, 200, { t: [770, 840], r: [950, 1020] }),
    // SE building — entrance west
    building(1140, 780, 280, 260, { l: [870, 940] }),
  ];
  for (const arr of buildings) for (const wall of arr) w.push(wall);

  // Scattered pillars / small obstacles
  const pillars = [
    [580, 460, 50, 50],
    [1000, 500, 50, 50],
    [820, 600, 40, 40],
    [560, 720, 40, 40],
    [1040, 700, 40, 40],
    [380, 540, 40, 40],
    [1220, 560, 40, 40],
  ];
  for (const p of pillars) w.push({x:p[0], y:p[1], w:p[2], h:p[3]});

  return w;
}
const DEFAULT_WALLS = buildWalls();

// Custom maps shared between clients (in-memory; the room host can save+share).
// Map: name -> walls array
const savedMaps = new Map();
savedMaps.set('default', DEFAULT_WALLS);

function getMapWalls(mapName) {
  return savedMaps.get(mapName) || DEFAULT_WALLS;
}

function sanitizeWalls(walls) {
  const out = [];
  for (const w of walls) {
    if (!w || typeof w.x !== 'number' || typeof w.y !== 'number'
      || typeof w.w !== 'number' || typeof w.h !== 'number') continue;
    if (w.w <= 0 || w.h <= 0 || w.w > 1600 || w.h > 1200) continue;
    out.push({x: w.x|0, y: w.y|0, w: w.w|0, h: w.h|0});
    if (out.length > 2000) break;
  }
  return out;
}

function circleRect(cx, cy, cr, r) {
  const nx = Math.max(r.x, Math.min(cx, r.x + r.w));
  const ny = Math.max(r.y, Math.min(cy, r.y + r.h));
  const dx = cx - nx, dy = cy - ny;
  return dx*dx + dy*dy < cr*cr;
}
function hitsWallList(walls, x, y, r) {
  for (const w of walls) if (circleRect(x, y, r, w)) return true;
  return false;
}
function randomSpawnIn(walls) {
  for (let i = 0; i < 200; i++) {
    const x = 60 + Math.random() * (C.MAP_W - 120);
    const y = 60 + Math.random() * (C.MAP_H - 120);
    if (!hitsWallList(walls, x, y, C.PLAYER_R + 4)) return {x, y};
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

function newRoom(ownerSocketId, ownerName, ownerColor, ownerCls, mapName) {
  let code;
  do { code = makeCode(); } while (rooms.has(code));
  const room = {
    code, ownerId: ownerSocketId,
    started: false,
    mapName: mapName || 'default',
    walls: getMapWalls(mapName),
    players: new Map(),
    bullets: [], hearts: [], rocketPickups: [],
    turrets: [], pets: [],
    roundEndsAt: 0, lastHeartSpawn: 0, lastRocketSpawn: 0,
    nextBulletId: 1, nextHeartId: 1, nextRocketId: 1,
    nextTurretId: 1, nextPetId: 1,
    tickHandle: null, pendingRestart: null,
    tickCount: 0,
  };
  addPlayer(room, ownerSocketId, ownerName, ownerColor, ownerCls);
  rooms.set(code, room);
  return room;
}

const VALID_CLASSES = ['cyber','engineer','medic','tank'];

function addPlayer(room, id, name, color, cls) {
  const s = randomSpawnIn(room.walls);
  const safeCls = VALID_CLASSES.includes(cls) ? cls : 'cyber';
  const player = {
    _room: room,
    id, name: (name||'Player').slice(0,16),
    color: color || '#ff5577',
    cls: safeCls,
    x: s.x, y: s.y, angle: 0,
    hp: C.HP_PER_LIFE, lives: C.START_LIVES,
    alive: true,
    ammo: C.MAG_SIZE, reloading: false, reloadEndsAt: 0,
    rockets: 0,
    kills: 0,
    keys: {w:false,a:false,s:false,d:false},
    leftDown: false, rightDown: false, fireCd: 0,
    // Class state
    lastCyberRocketAt: Date.now(),
    turretReadyAt: Date.now(),
    petReadyAt: Date.now(),
    tankUntil: 0,
    tankKills: 0, // resets each round; counts kills since last tank form
  };
  room.players.set(id, player);
}

function publicRoom(room) {
  return {
    id: room.code, ownerId: room.ownerId,
    started: room.started,
    mapName: room.mapName,
    count: room.players.size, max: C.MAX_PLAYERS,
    players: [...room.players.values()].map(p => ({
      id: p.id, name: p.name, color: p.color, cls: p.cls,
    })),
  };
}

function spawnHeart(room) {
  if (room.hearts.length >= C.MAX_HEARTS) return;
  for (let i = 0; i < 50; i++) {
    const x = 60 + Math.random() * (C.MAP_W - 120);
    const y = 60 + Math.random() * (C.MAP_H - 120);
    if (!hitsWallList(room.walls,x, y, 10)) { room.hearts.push({id: room.nextHeartId++, x, y}); return; }
  }
}

function spawnRocketPickup(room) {
  if (room.rocketPickups.length >= C.MAX_ROCKET_PICKUPS) return;
  for (let i = 0; i < 50; i++) {
    const x = 60 + Math.random() * (C.MAP_W - 120);
    const y = 60 + Math.random() * (C.MAP_H - 120);
    if (!hitsWallList(room.walls,x, y, 12)) { room.rocketPickups.push({id: room.nextRocketId++, x, y}); return; }
  }
}

function startRound(room) {
  room.started = true;
  room.bullets = []; room.hearts = []; room.rocketPickups = [];
  room.turrets = []; room.pets = [];
  room.roundEndsAt = Date.now() + C.ROUND_MS;
  const now = Date.now();
  room.lastHeartSpawn = now;
  room.lastRocketSpawn = now;
  room.nextBulletId = 1; room.nextHeartId = 1; room.nextRocketId = 1;
  room.nextTurretId = 1; room.nextPetId = 1;
  room.tickCount = 0;
  for (const p of room.players.values()) {
    const s = randomSpawnIn(room.walls);
    p.x = s.x; p.y = s.y;
    p.hp = C.HP_PER_LIFE; p.lives = C.START_LIVES;
    p.alive = true; p.kills = 0; p.angle = 0; p.fireCd = 0;
    p.ammo = C.MAG_SIZE; p.reloading = false; p.reloadEndsAt = 0;
    p.rockets = 0;
    p.lastCyberRocketAt = now;
    p.turretReadyAt = now + 30000; // 30sn warmup
    p.petReadyAt = now + 30000;
    p.tankUntil = 0; p.tankKills = 0;
  }
  for (let i = 0; i < 4; i++) spawnHeart(room);
  spawnRocketPickup(room);
  io.to(room.code).emit('roundStart', {
    endsAt: room.roundEndsAt,
    mapW: C.MAP_W, mapH: C.MAP_H, walls: room.walls,
    mapName: room.mapName,
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

function tryMove(p, dx, dy, r) {
  const rr = r || C.PLAYER_R;
  const walls = p._room.walls;
  let nx = p.x+dx, ny = p.y+dy;
  nx = Math.max(rr, Math.min(C.MAP_W-rr, nx));
  ny = Math.max(rr, Math.min(C.MAP_H-rr, ny));
  if (!hitsWallList(walls, nx, p.y, rr)) p.x = nx;
  if (!hitsWallList(walls, p.x, ny, rr)) p.y = ny;
}

function tick(room) {
  if (!room.started) return;
  const now = Date.now();
  room.tickCount++;

  if (now - room.lastHeartSpawn >= C.HEART_SPAWN_MS) {
    spawnHeart(room); room.lastHeartSpawn = now;
  }
  if (now - room.lastRocketSpawn >= C.ROCKET_SPAWN_MS) {
    spawnRocketPickup(room); room.lastRocketSpawn = now;
  }

  for (const p of room.players.values()) {
    if (!p.alive) continue;

    // Class passive: Cyber auto-rockets
    if (p.cls === 'cyber' && now - p.lastCyberRocketAt >= C.CYBER_ROCKET_INTERVAL) {
      p.rockets += 1;
      p.lastCyberRocketAt = now;
    }
    // Tank mode expiry
    const isTank = now < p.tankUntil;
    const speedMul = isTank ? 0.7 : 1;
    const playerR = isTank ? C.PLAYER_R + 6 : C.PLAYER_R;

    let dx = 0, dy = 0;
    if (p.keys.w) dy -= 1; if (p.keys.s) dy += 1;
    if (p.keys.a) dx -= 1; if (p.keys.d) dx += 1;
    if (dx || dy) {
      const len = Math.hypot(dx, dy);
      tryMove(p, dx/len*C.PLAYER_SPEED*speedMul, dy/len*C.PLAYER_SPEED*speedMul, playerR);
    }
    p.fireCd -= C.TICK_MS;
    if (p.reloading && now >= p.reloadEndsAt) {
      p.reloading = false; p.ammo = C.MAG_SIZE;
    }

    // Right click = rocket (if available)
    if (p.rightDown && p.fireCd <= 0 && p.rockets > 0) {
      p.fireCd = C.ROCKET_FIRE_COOLDOWN; p.rockets--;
      const m = 22;
      room.bullets.push({
        id: room.nextBulletId++, owner: p.id, type: 'rocket',
        x: p.x+Math.cos(p.angle)*m, y: p.y+Math.sin(p.angle)*m,
        vx: Math.cos(p.angle)*C.ROCKET_SPEED, vy: Math.sin(p.angle)*C.ROCKET_SPEED,
        angle: p.angle, life: 120,
      });
    }
    // Left click = bullet
    if (p.leftDown && p.fireCd <= 0 && p.ammo > 0 && !p.reloading) {
      p.fireCd = isTank ? Math.floor(C.FIRE_COOLDOWN * 0.6) : C.FIRE_COOLDOWN;
      p.ammo--;
      const m = 20;
      const bulletDmg = isTank ? 2 : 1;
      room.bullets.push({
        id: room.nextBulletId++, owner: p.id, type: 'bullet', dmg: bulletDmg,
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
    for (let i = room.rocketPickups.length-1; i >= 0; i--) {
      const r = room.rocketPickups[i];
      if ((r.x-p.x)**2+(r.y-p.y)**2 < (C.PLAYER_R+12)**2) {
        p.rockets += C.ROCKET_CHARGES;
        room.rocketPickups.splice(i, 1);
      }
    }
  }

  // Pets: heal nearby allies, expire after duration
  for (let pi = room.pets.length-1; pi >= 0; pi--) {
    const pet = room.pets[pi];
    if (now >= pet.expiresAt) { room.pets.splice(pi, 1); continue; }
    if (now - (pet.lastHealAt||0) >= C.PET_HEAL_EVERY) {
      pet.lastHealAt = now;
      for (const pl of room.players.values()) {
        if (!pl.alive) continue;
        const d2 = (pl.x-pet.x)**2 + (pl.y-pet.y)**2;
        if (d2 < (C.PLAYER_R + C.PET_HEAL_R)**2 && pl.hp < C.HP_PER_LIFE) {
          pl.hp = Math.min(C.HP_PER_LIFE, pl.hp + C.PET_HEAL_PER_TICK);
        }
      }
    }
  }

  // Turrets: target nearest enemy in range, fire
  for (let ti = room.turrets.length-1; ti >= 0; ti--) {
    const t = room.turrets[ti];
    if (t.hp <= 0) { room.turrets.splice(ti, 1); continue; }
    let target = null, bestD = C.TURRET_RANGE * C.TURRET_RANGE;
    for (const pl of room.players.values()) {
      if (!pl.alive || pl.id === t.owner) continue;
      const d2 = (pl.x-t.x)**2 + (pl.y-t.y)**2;
      if (d2 < bestD) { bestD = d2; target = pl; }
    }
    if (target) {
      t.angle = Math.atan2(target.y-t.y, target.x-t.x);
      if (now >= (t.nextFireAt || 0)) {
        t.nextFireAt = now + C.TURRET_FIRE_CD;
        room.bullets.push({
          id: room.nextBulletId++, owner: t.owner, type: 'turret', dmg: 2,
          x: t.x + Math.cos(t.angle)*16, y: t.y + Math.sin(t.angle)*16,
          vx: Math.cos(t.angle)*C.TURRET_BULLET_SPEED,
          vy: Math.sin(t.angle)*C.TURRET_BULLET_SPEED,
          life: 70,
        });
      }
    }
  }

  function applyDamage(victim, dmg, killerId) {
    victim.hp -= dmg;
    if (victim.hp <= 0) {
      victim.lives--;
      const killer = room.players.get(killerId);
      if (killer && killer !== victim) {
        killer.kills++;
        // Tank class: counts kills, transforms at threshold
        if (killer.cls === 'tank' && Date.now() >= killer.tankUntil) {
          killer.tankKills++;
          if (killer.tankKills >= C.TANK_KILLS_REQUIRED) {
            killer.tankKills = 0;
            killer.tankUntil = Date.now() + C.TANK_DURATION;
            killer.hp = C.HP_PER_LIFE;
            io.to(room.code).emit('tankMode', {id: killer.id, until: killer.tankUntil});
          }
        }
      }
      io.to(room.code).emit('kill', {killer: killer?killer.name:'?', victim: victim.name});
      if (victim.lives <= 0) { victim.alive = false; }
      else { const s=randomSpawnIn(room.walls); victim.x=s.x; victim.y=s.y; victim.hp=C.HP_PER_LIFE; }
    }
  }

  for (let i = room.bullets.length-1; i >= 0; i--) {
    const b = room.bullets[i];
    b.x += b.vx; b.y += b.vy; b.life--;
    const isRocket = b.type === 'rocket';
    const r = isRocket ? C.ROCKET_R : C.BULLET_R;
    let detonated = false;

    if (b.life<=0||b.x<0||b.y<0||b.x>C.MAP_W||b.y>C.MAP_H) {
      if (isRocket) detonated = true;
      else { room.bullets.splice(i,1); continue; }
    }
    if (!detonated && hitsWallList(room.walls,b.x, b.y, r)) {
      if (isRocket) detonated = true;
      else { room.bullets.splice(i,1); continue; }
    }

    if (!detonated) {
      let hitSomething = false;
      // hit players
      for (const p of room.players.values()) {
        if (!p.alive || p.id===b.owner) continue;
        const pr = (Date.now() < p.tankUntil ? C.PLAYER_R + 6 : C.PLAYER_R);
        if ((p.x-b.x)**2+(p.y-b.y)**2 < (pr + r)**2) {
          if (isRocket) { detonated = true; }
          else {
            applyDamage(p, b.dmg || 1, b.owner);
            room.bullets.splice(i,1);
            hitSomething = true;
          }
          break;
        }
      }
      // hit turrets (skip own)
      if (!detonated && !hitSomething) {
        for (const tu of room.turrets) {
          if (tu.owner === b.owner) continue;
          if ((tu.x-b.x)**2+(tu.y-b.y)**2 < (14 + r)**2) {
            if (isRocket) { detonated = true; }
            else {
              tu.hp -= (b.dmg || 1);
              room.bullets.splice(i,1);
              hitSomething = true;
            }
            break;
          }
        }
      }
      if (hitSomething) continue;
    }

    if (detonated && isRocket) {
      // splash damage
      io.to(room.code).emit('explosion', {x: b.x, y: b.y, r: C.ROCKET_AOE_R});
      for (const p of room.players.values()) {
        if (!p.alive) continue;
        const d2 = (p.x-b.x)**2 + (p.y-b.y)**2;
        if (d2 < C.ROCKET_AOE_R**2) {
          // direct hit center = 1-shot kill; falloff with distance
          const dist = Math.sqrt(d2);
          const dmg = dist < 30 ? (C.HP_PER_LIFE + 1) : Math.ceil(C.HP_PER_LIFE * (1 - dist/C.ROCKET_AOE_R));
          if (dmg > 0) applyDamage(p, dmg, b.owner);
        }
      }
      room.bullets.splice(i, 1);
    }
  }

  if (room.tickCount % C.BROADCAST_EVERY === 0) {
    io.to(room.code).emit('state', {
      t: now, endsAt: room.roundEndsAt,
      players: [...room.players.values()].map(p => ({
        id:p.id, name:p.name, color:p.color, cls:p.cls,
        x:p.x, y:p.y, angle:p.angle,
        hp:p.hp, lives:p.lives, maxHp:C.HP_PER_LIFE,
        ammo:p.ammo, maxAmmo:C.MAG_SIZE,
        reloading:p.reloading, reloadEndsAt:p.reloadEndsAt,
        rockets:p.rockets,
        tank: now < p.tankUntil, tankUntil: p.tankUntil,
        turretReadyAt: p.turretReadyAt,
        petReadyAt: p.petReadyAt,
        alive:p.alive, kills:p.kills,
      })),
      bullets: room.bullets.map(b=>({x:b.x, y:b.y, type:b.type||'bullet', angle:b.angle})),
      hearts:  room.hearts.map(h=>({x:h.x, y:h.y})),
      rocketPickups: room.rocketPickups.map(r=>({x:r.x, y:r.y})),
      turrets: room.turrets.map(t=>({x:t.x, y:t.y, angle:t.angle||0, hp:t.hp, owner:t.owner})),
      pets:    room.pets.map(pt=>({x:pt.x, y:pt.y, expiresAt:pt.expiresAt, owner:pt.owner})),
    });
  }
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

  socket.on('createRoom', ({name, color, cls, mapName, customMap}, ack) => {
    leaveCurrentRoom(socket);
    // If host provided a custom map, save it under the chosen name
    if (customMap && Array.isArray(customMap) && mapName) {
      savedMaps.set(mapName, sanitizeWalls(customMap));
    }
    const room = newRoom(socket.id, name, color, cls, mapName);
    socketRoom.set(socket.id, room.code);
    socket.join(room.code);
    ack && ack({
      ok: true, roomId: room.code,
      ownerId: socket.id, selfId: socket.id,
      room: publicRoom(room),
    });
    console.log('[createRoom]', room.code, name, 'cls=', cls, 'map=', mapName);
  });

  socket.on('joinRoom', ({roomId, name, color, cls}, ack) => {
    const code = String(roomId||'').trim().toUpperCase();
    const room = rooms.get(code);
    if (!room)               return ack && ack({ok:false, error:'Oda bulunamadı (kod yanlış?)'});
    if (room.players.size >= C.MAX_PLAYERS) return ack && ack({ok:false, error:'Oda dolu'});
    if (room.started)        return ack && ack({ok:false, error:'Oyun zaten başladı'});
    leaveCurrentRoom(socket);
    addPlayer(room, socket.id, name, color, cls);
    socketRoom.set(socket.id, room.code);
    socket.join(room.code);
    ack && ack({
      ok: true, roomId: room.code,
      ownerId: room.ownerId, selfId: socket.id,
      room: publicRoom(room),
    });
    io.to(room.code).emit('roomUpdate', publicRoom(room));
    console.log('[joinRoom]', code, name, 'cls=', cls);
  });

  socket.on('changeClass', ({cls}) => {
    const code = socketRoom.get(socket.id);
    const room = code && rooms.get(code);
    if (!room || room.started) return;
    const p = room.players.get(socket.id);
    if (p && VALID_CLASSES.includes(cls)) {
      p.cls = cls;
      io.to(room.code).emit('roomUpdate', publicRoom(room));
    }
  });

  socket.on('placeTurret', () => {
    const code = socketRoom.get(socket.id);
    const room = code && rooms.get(code);
    if (!room || !room.started) return;
    const p = room.players.get(socket.id);
    if (!p || !p.alive || p.cls !== 'engineer') return;
    if (Date.now() < p.turretReadyAt) return;
    if (hitsWallList(room.walls, p.x, p.y, 14)) return;
    room.turrets.push({
      id: room.nextTurretId++,
      owner: p.id, x: p.x, y: p.y,
      hp: C.TURRET_HP, angle: 0, nextFireAt: 0,
    });
    p.turretReadyAt = Date.now() + C.ENGINEER_TURRET_CD;
  });

  socket.on('placePet', () => {
    const code = socketRoom.get(socket.id);
    const room = code && rooms.get(code);
    if (!room || !room.started) return;
    const p = room.players.get(socket.id);
    if (!p || !p.alive || p.cls !== 'medic') return;
    if (Date.now() < p.petReadyAt) return;
    room.pets.push({
      id: room.nextPetId++,
      owner: p.id, x: p.x, y: p.y,
      expiresAt: Date.now() + C.PET_DURATION, lastHealAt: 0,
    });
    p.petReadyAt = Date.now() + C.MEDIC_PET_CD;
  });

  // Map editor: save custom map, list maps
  socket.on('saveMap', ({name, walls}, ack) => {
    if (!name || !Array.isArray(walls)) return ack && ack({ok:false, error:'bad input'});
    if (name === 'default') return ack && ack({ok:false, error:'isim ayrılmış'});
    savedMaps.set(String(name).slice(0,32), sanitizeWalls(walls));
    ack && ack({ok:true});
  });
  socket.on('listMaps', (ack) => {
    ack && ack({ok:true, names: [...savedMaps.keys()]});
  });
  socket.on('getMap', ({name}, ack) => {
    const walls = savedMaps.get(name);
    if (!walls) return ack && ack({ok:false, error:'yok'});
    ack && ack({ok:true, walls});
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
    if (typeof input.leftDown === 'boolean') p.leftDown = input.leftDown;
    if (typeof input.rightDown === 'boolean') p.rightDown = input.rightDown;
    // Legacy compat
    if (typeof input.mouseDown === 'boolean') p.leftDown = input.mouseDown;
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
