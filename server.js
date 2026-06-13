// Gold Wave — Socket.IO game server
// Deploy to Railway (railway.app): connect GitHub repo → deploy.
// npm install  →  npm start  →  everyone connects to the same URL.
process.on('uncaughtException', (e) => console.error('uncaughtException', e));
process.on('unhandledRejection', (e) => console.error('unhandledRejection', e));

const express = require('express');
const http    = require('http');
const { Server } = require('socket.io');
const path    = require('path');
const fs      = require('fs');
// Map persistence runs in the browser (Supabase REST). The server just
// receives walls inline on createRoom and relays save/delete notifications.

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, {
  cors: { origin: '*' },
  transports: ['websocket', 'polling'],
});

app.use(express.static(path.join(__dirname, 'public')));

// List available hats — any .png in public/hats/
app.get('/api/hats', (req, res) => {
  res.set('Cache-Control', 'no-store');
  const dir = path.join(__dirname, 'public', 'hats');
  fs.readdir(dir, (err, files) => {
    if (err) return res.json([]);
    res.json(files.filter(f => /\.png$/i.test(f)).sort());
  });
});

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
  BROADCAST_EVERY: 2,        // state broadcast every 2nd tick (~50ms = 20Hz)
  // Rocket
  ROCKET_SPAWN_MS: 35 * 1000,
  MAX_ROCKET_PICKUPS: 3,
  ROCKET_CHARGES: 2,
  ROCKET_SPEED: 11,
  CYBER_ROCKET_SPEED: 14,
  ROCKET_R: 6,
  ROCKET_FIRE_COOLDOWN: 320,
  ROCKET_AOE_R: 70,
  // Classes
  CYBER_ROCKET_INTERVAL: 50 * 1000,
  CYBER_ROCKET_PER_INTERVAL: 3,
  CYBER_START_ROCKETS: 1,
  ENGINEER_TURRET_CD:    70 * 1000,
  MEDIC_PET_CD:          65 * 1000,
  MEDIC_HEART_CD:        150 * 1000,
  TANK_KILLS_REQUIRED:   3,
  TANK_DURATION:         30 * 1000,
  TANK_HP_BOOST:         25,
  // Pyro flame weapon
  PYRO_FLAME_CD: 90,             // ms between flame chunks
  PYRO_FLAME_SPEED: 13,
  PYRO_FLAME_LIFE: 25,           // ~25 ticks * 13 speed = ~325px range
  PYRO_FLAME_DMG: 1,
  PYRO_HP_PER_LIFE: 12,          // pyro has more HP per life than others
  PYRO_FUEL_MAX: 30,             // max fuel shots
  PYRO_REFUEL_MS: 2000,          // refuel time when empty
  // Sniper class
  SNIPER_DMG: 15,
  SNIPER_BULLET_SPEED: 34,
  SNIPER_BULLET_HIT_R: 7,        // larger hitbox to prevent tunneling at high speed
  SNIPER_BULLET_LIFE: 115,       // ~115 * 28 = 3220px (whole map)
  SNIPER_RELOAD_MS: 6000,
  SNIPER_FIRE_CD: 200,
  KNIFE_RANGE: 55,
  KNIFE_ARC: Math.PI * 0.55,     // ~99° front cone
  KNIFE_DMG: 4,
  KNIFE_CD: 600,                 // ms between swings
  // Soda pickup (rare, +3 HP)
  SODA_SPAWN_MS:   45 * 1000,
  MAX_SODAS:       2,
  SODA_HEAL:       3,
  SODA_SPAWN_CHANCE: 0.87,
  // Power-ups (temporary buffs) — picked up off the ground
  POWERUP_SPAWN_MS:     28 * 1000,
  MAX_POWERUPS:         2,
  POWERUP_SPAWN_CHANCE: 0.85,
  POWERUP_TYPES:        ['speed', 'damage', 'shield'],
  SPEED_BUFF_MS:        8000,
  SPEED_BUFF_MUL:       1.6,
  DAMAGE_BUFF_MS:       8000,
  DAMAGE_BUFF_MUL:      2,
  SHIELD_BUFF_MS:       6000,
  // Survival mode (Vampire-Survivors-like co-op vs endless monster waves)
  SURV_SPAWN_START_MS:  1400,   // initial gap between spawn batches
  SURV_SPAWN_MIN_MS:    260,    // fastest spawn gap
  SURV_MAX_MONSTERS:    240,
  SURV_MON_SPEED:       1.7,
  SURV_MON_HP:          3,
  SURV_MON_DMG:         1,
  SURV_MON_CONTACT_CD:  650,    // ms between contact hits from one monster
  SURV_MON_R:           12,
  SURV_MON_XP:          1,
  SURV_GEM_MAGNET_R:    140,
  SURV_LEVEL_BASE_XP:   5,      // xp needed for level 2
  SURV_LEVEL_GROWTH:    1.35,   // xp curve multiplier per level
  // Turret
  TURRET_HP: 32,
  TURRET_MOVE_SPEED: 3.2,
  TURRET_RANGE: 460,
  TURRET_FIRE_CD: 120,
  TURRET_MAG_SIZE: 35,
  TURRET_RELOAD_MS: 4500,
  TURRET_BULLET_DMG: 2,
  TURRET_BULLET_SPEED: 12,
  // Pet
  PET_HP: 30,
  PET_DURATION: 10 * 1000,
  PET_HEAL_R: 35,
  PET_HEAL_PER_TICK: 1,
  PET_HEAL_EVERY: 250,
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

// ============================================================
// IMPOSTER (Among-Us-like) MODE — constants + dedicated ship map
// ============================================================
const IMP = {
  SPEED: 4.6,
  KILL_RANGE2: 66 * 66,
  KILL_COOLDOWN_MS: 25000,
  REPORT_RANGE2: 95 * 95,
  EMERGENCY_RANGE2: 95 * 95,
  EMERGENCY_PER_PLAYER: 1,
  USE_RANGE2: 72 * 72,         // task / sabotage-fix interaction range
  VENT_RANGE2: 56 * 56,
  DISCUSS_MS: 10000,
  VOTE_MS: 25000,
  MEETING_END_MS: 5000,        // result reveal before resuming
  TASKS_PER_PLAYER: 4,
  SABO_COOLDOWN_MS: 28000,
  REACTOR_MS: 32000,
};

// Ship map: outlined rooms with door gaps, plus task/vent/button metadata.
function buildImposterMap() {
  const W = C.MAP_W, H = C.MAP_H;
  const w = [];
  w.push({x:0,y:0,w:W,h:20}, {x:0,y:H-20,w:W,h:20}, {x:0,y:0,w:20,h:H}, {x:W-20,y:0,w:20,h:H});
  const rooms = [
    building(120, 120, 360, 260, { r:[220,300], b:[260,340] }),        // upper-left (Electrical)
    building(600, 110, 400, 300, { l:[200,280], r:[200,280], b:[760,840] }), // cafeteria (center-top)
    building(1120,120, 360, 260, { l:[220,300], b:[260,340] }),        // upper-right (Reactor)
    building(120, 820, 360, 260, { r:[900,980], t:[900,980] }),        // lower-left
    building(640, 860, 320, 240, { t:[760,840], l:[940,1020] }),       // lower-center
    building(1120,820, 360, 260, { l:[900,980], t:[900,980] }),        // lower-right (O2)
  ];
  for (const arr of rooms) for (const wall of arr) w.push(wall);
  w.forEach(x => { x.kind = 'stone'; });
  return {
    walls: w,
    groundColor: '#2b2f3a',
    spawn: { x: 800, y: 300, r: 90 },
    emergency: { x: 800, y: 250 },
    tasks: [
      {id:1,  x:200, y:200}, {id:2,  x:420, y:320},
      {id:3,  x:700, y:200}, {id:4,  x:900, y:330},
      {id:5,  x:1200,y:200}, {id:6,  x:1400,y:320},
      {id:7,  x:200, y:900}, {id:8,  x:420, y:1000},
      {id:9,  x:760, y:980}, {id:10, x:1200,y:900},
      {id:11, x:1400,y:1000},{id:12, x:800, y:600},
    ],
    // vents grouped — impostor can travel between vents sharing a group
    vents: [
      {id:1, x:250,  y:330, group:'A'}, {id:2, x:760, y:360, group:'A'},
      {id:3, x:1300, y:330, group:'B'}, {id:4, x:1300,y:880, group:'B'},
      {id:5, x:250,  y:880, group:'C'}, {id:6, x:780, y:1000,group:'C'},
    ],
    // lights sabotage fix panel
    lightsFix: { x:200, y:330 },
    // reactor sabotage — both points must be activated to resolve
    reactorFix: [ {x:1170, y:240}, {x:1440, y:240} ],
  };
}
const IMP_MAP = buildImposterMap();

// Custom maps shared between clients (in-memory; the room host can save+share).
// Map: name -> walls. Filled when a host creates a room with a custom map
// (inline walls), then used for that room's collision/spawn. Browsers
// own the durable list (Supabase).
const savedMaps = new Map();
savedMaps.set('default', DEFAULT_WALLS);

// In-memory cache only. Browsers are the source of truth (Supabase).
// Walls travel inline with createRoom; the room uses them for collision
// and bullet propagation. Names alone are forwarded to lobbies via roomUpdate.

function getMapWalls(mapName) {
  const walls = savedMaps.get(mapName) || DEFAULT_WALLS;
  if (!walls.__index) {
    Object.defineProperty(walls, '__index', {
      value: buildWallIndex(walls), enumerable: false, configurable: true,
    });
  }
  return walls;
}

const WALL_KINDS = ['stone','wood','brick','mesh','tree','water'];
// Water blocks players but bullets/rockets fly over it.
const PASSABLE_FOR_BULLETS = new Set(['water']);
const MESH_HP = 4;
function sanitizeWalls(walls) {
  const out = [];
  for (const w of walls) {
    if (!w || typeof w.x !== 'number' || typeof w.y !== 'number'
      || typeof w.w !== 'number' || typeof w.h !== 'number') continue;
    if (w.w <= 0 || w.h <= 0 || w.w > 1600 || w.h > 1200) continue;
    const kind = WALL_KINDS.includes(w.kind) ? w.kind : 'stone';
    out.push({x: w.x|0, y: w.y|0, w: w.w|0, h: w.h|0, kind});
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
// Spatial bucket index — turns O(walls) hit-tests into O(walls-in-cell).
// Helps a lot with custom maps that have many wall rects.
const SPATIAL_CELL = 80;
function buildWallIndex(walls) {
  const idx = new Map();
  for (const w of walls) {
    const x0 = Math.floor(w.x / SPATIAL_CELL);
    const y0 = Math.floor(w.y / SPATIAL_CELL);
    const x1 = Math.floor((w.x + w.w - 1) / SPATIAL_CELL);
    const y1 = Math.floor((w.y + w.h - 1) / SPATIAL_CELL);
    for (let cy = y0; cy <= y1; cy++)
      for (let cx = x0; cx <= x1; cx++) {
        const k = cx * 65536 + cy;
        let bucket = idx.get(k);
        if (!bucket) { bucket = []; idx.set(k, bucket); }
        bucket.push(w);
      }
  }
  return idx;
}

function hitsWallList(walls, x, y, r) {
  return !!findWallHit(walls, x, y, r);
}

// `skip` (optional Set) — wall kinds to ignore. Used for bullets so they
// can fly over water while players are still blocked by it.
function findWallHit(walls, x, y, r, skip) {
  if (walls.__index) {
    const idx = walls.__index;
    const cx = Math.floor(x / SPATIAL_CELL);
    const cy = Math.floor(y / SPATIAL_CELL);
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const bucket = idx.get((cx+dx) * 65536 + (cy+dy));
        if (!bucket) continue;
        for (const w of bucket) {
          if (skip && skip.has(w.kind)) continue;
          if (circleRect(x, y, r, w)) return w;
        }
      }
    return null;
  }
  for (const w of walls) {
    if (skip && skip.has(w.kind)) continue;
    if (circleRect(x, y, r, w)) return w;
  }
  return null;
}

function breakWall(room, wall) {
  const i = room.walls.indexOf(wall);
  if (i >= 0) room.walls.splice(i, 1);
  Object.defineProperty(room.walls, '__index', {
    value: buildWallIndex(room.walls), enumerable: false, configurable: true, writable: true,
  });
  io.to(room.code).emit('wallBroken', { id: wall.id });
}
function randomSpawnIn(walls) {
  for (let i = 0; i < 500; i++) {
    const x = 60 + Math.random() * (C.MAP_W - 120);
    const y = 60 + Math.random() * (C.MAP_H - 120);
    if (!hitsWallList(walls, x, y, C.PLAYER_R + 4)) return {x, y};
  }
  // Grid scan fallback: walk across the map in a grid to find any free cell
  const step = 80;
  for (let gy = step; gy < C.MAP_H - step; gy += step) {
    for (let gx = step; gx < C.MAP_W - step; gx += step) {
      if (!hitsWallList(walls, gx, gy, C.PLAYER_R + 4)) return {x: gx, y: gy};
    }
  }
  return {x: 800, y: 600};
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

const VALID_MODES = ['ffa', 'survival', 'imposter'];

function newRoom(ownerSocketId, ownerName, ownerColor, ownerCls, mapName, mode) {
  let code;
  do { code = makeCode(); } while (rooms.has(code));
  const room = {
    code, ownerId: ownerSocketId,
    started: false,
    mode: VALID_MODES.includes(mode) ? mode : 'ffa',
    mapName: mapName || 'default',
    walls: getMapWalls(mapName),
    players: new Map(),
    bullets: [], hearts: [], rocketPickups: [], sodas: [], powerups: [],
    monsters: [], gems: [],
    turrets: [], pets: [],
    // Imposter mode
    phase: 'play', corpses: [], meeting: null, sabotage: null,
    nextCorpseId: 1, lastSaboAt: 0, taskTotal: 0, taskDone: 0,
    roundEndsAt: 0, remainingMs: 0, lastHeartSpawn: 0, lastRocketSpawn: 0,
    lastPowerupSpawn: 0, lastMonsterSpawn: 0, survStartAt: 0,
    nextBulletId: 1, nextHeartId: 1, nextRocketId: 1, nextPowerupId: 1,
    nextMonsterId: 1, nextGemId: 1,
    nextTurretId: 1, nextPetId: 1,
    tickHandle: null, pendingRestart: null,
    tickCount: 0,
  };
  addPlayer(room, ownerSocketId, ownerName, ownerColor, ownerCls);
  rooms.set(code, room);
  return room;
}

const VALID_CLASSES = ['cyber','engineer','medic','tank','pyro','sniper'];

function addPlayer(room, id, name, color, cls) {
  const s = randomSpawnIn(room.walls);
  const safeCls = VALID_CLASSES.includes(cls) ? cls : 'cyber';
  const player = {
    _room: room,
    id, name: (name||'Player').slice(0,16),
    color: color || '#ff5577',
    cls: safeCls,
    hat: '',
    hatCfg: null,
    x: s.x, y: s.y, angle: 0,
    hp: cls === 'pyro' ? C.PYRO_HP_PER_LIFE : C.HP_PER_LIFE, lives: C.START_LIVES,
    alive: true,
    ammo: cls === 'pyro' ? C.PYRO_FUEL_MAX : (cls === 'sniper' ? 1 : C.MAG_SIZE), reloading: false, reloadEndsAt: 0,
    rockets: 0,
    kills: 0,
    keys: {w:false,a:false,s:false,d:false},
    leftDown: false, rightDown: false, fireCd: 0,
    // Class state
    lastCyberRocketAt: Date.now(),
    turretReadyAt: Date.now(),
    petReadyAt: Date.now(),
    heartReadyAt: Date.now() + 150 * 1000,
    tankUntil: 0,
    tankKills: 0, // resets each round; counts kills since last tank form
    // Power-up buff timers (epoch ms; buff active while now < value)
    speedUntil: 0, dmgUntil: 0, shieldUntil: 0,
    // Survival mode progression
    xp: 0, level: 1, xpToNext: C.SURV_LEVEL_BASE_XP,
    // Imposter mode
    role: 'crew', tasks: [], killReadyAt: 0, emergencyUsed: 0,
    vented: false, ventGroup: null, ventId: 0,
  };
  room.players.set(id, player);
}

function publicRoom(room) {
  return {
    id: room.code, ownerId: room.ownerId,
    started: room.started,
    mode: room.mode,
    mapName: room.mapName,
    count: room.players.size, max: C.MAX_PLAYERS,
    players: [...room.players.values()].map(p => ({
      id: p.id, name: p.name, color: p.color, cls: p.cls, hat: p.hat, hatCfg: p.hatCfg,
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

const MAGNET_R = 90, MAGNET_R2 = MAGNET_R * MAGNET_R, MAGNET_SPEED = 5;
function magnetTo(p, item) {
  const dx = p.x - item.x, dy = p.y - item.y;
  const d2 = dx*dx + dy*dy;
  if (d2 > MAGNET_R2 || d2 < 1) return;
  const d = Math.sqrt(d2);
  const step = d < MAGNET_SPEED ? d : MAGNET_SPEED;
  const inv = 1 / d;
  item.x += dx * inv * step;
  item.y += dy * inv * step;
}

function spawnSoda(room) {
  if (room.sodas.length >= C.MAX_SODAS) return;
  if (Math.random() > C.SODA_SPAWN_CHANCE) return;
  for (let i = 0; i < 50; i++) {
    const x = 60 + Math.random() * (C.MAP_W - 120);
    const y = 60 + Math.random() * (C.MAP_H - 120);
    if (!hitsWallList(room.walls, x, y, 12)) { room.sodas.push({id: room.nextSodaId++, x, y}); return; }
  }
}

function spawnPowerup(room) {
  if (room.powerups.length >= C.MAX_POWERUPS) return;
  if (Math.random() > C.POWERUP_SPAWN_CHANCE) return;
  const type = C.POWERUP_TYPES[Math.floor(Math.random() * C.POWERUP_TYPES.length)];
  for (let i = 0; i < 50; i++) {
    const x = 60 + Math.random() * (C.MAP_W - 120);
    const y = 60 + Math.random() * (C.MAP_H - 120);
    if (!hitsWallList(room.walls, x, y, 12)) {
      room.powerups.push({ id: room.nextPowerupId++, x, y, type });
      return;
    }
  }
}

// Survival: per-level stat multipliers derived from a player's level.
function survBonus(level) {
  const l = Math.max(1, level || 1);
  return {
    dmgMul:   1 + 0.15 * (l - 1),                 // +15% damage / level
    fireMul:  Math.max(0.45, 1 - 0.045 * (l - 1)),// faster fire (down to ~2.2x)
    speedMul: Math.min(1.5, 1 + 0.02 * (l - 1)),  // +2% move / level (cap +50%)
  };
}

// Survival: difficulty scales with minutes elapsed.
function survDifficulty(room, now) {
  const mins = Math.max(0, (now - room.survStartAt) / 60000);
  return {
    mins,
    hp:    C.SURV_MON_HP + Math.floor(mins * 2),
    speed: C.SURV_MON_SPEED + mins * 0.14,
    dmg:   C.SURV_MON_DMG + Math.floor(mins / 3),
    interval: Math.max(C.SURV_SPAWN_MIN_MS, C.SURV_SPAWN_START_MS - mins * 110),
    batch: 1 + Math.floor(mins / 1.5),
  };
}

// Spawn one monster just inside a random map edge.
function spawnMonster(room, diff) {
  if (room.monsters.length >= C.SURV_MAX_MONSTERS) return;
  const edge = Math.floor(Math.random() * 4);
  let x, y;
  const m = 24;
  if (edge === 0)      { x = m + Math.random() * (C.MAP_W - 2*m); y = m; }
  else if (edge === 1) { x = m + Math.random() * (C.MAP_W - 2*m); y = C.MAP_H - m; }
  else if (edge === 2) { x = m; y = m + Math.random() * (C.MAP_H - 2*m); }
  else                 { x = C.MAP_W - m; y = m + Math.random() * (C.MAP_H - 2*m); }
  // Occasional tougher "elite" (bigger, more hp, more xp)
  const elite = diff.mins > 1 && Math.random() < 0.06;
  room.monsters.push({
    id: room.nextMonsterId++, x, y,
    hp: elite ? diff.hp * 4 : diff.hp,
    maxHp: elite ? diff.hp * 4 : diff.hp,
    speed: elite ? diff.speed * 0.8 : diff.speed,
    dmg: elite ? diff.dmg * 2 : diff.dmg,
    r: elite ? C.SURV_MON_R + 7 : C.SURV_MON_R,
    xp: elite ? 6 : C.SURV_MON_XP,
    elite, nextHitAt: 0,
  });
}

function dropGem(room, x, y, val) {
  room.gems.push({ id: room.nextGemId++, x, y, val });
}

// Outgoing damage from a shooter to a monster, including buffs & survival level.
function outgoingDmg(room, ownerId, baseDmg) {
  const killer = room.players.get(ownerId);
  let dmg = baseDmg || 1;
  if (killer) {
    if (Date.now() < killer.dmgUntil) dmg *= C.DAMAGE_BUFF_MUL;
    if (room.mode === 'survival') dmg *= survBonus(killer.level).dmgMul;
  }
  return Math.max(1, Math.ceil(dmg));
}

// Apply damage to a monster; on death drop an XP gem and credit the killer.
function damageMonster(room, mo, dmg, ownerId) {
  mo.hp -= dmg;
  if (mo.hp <= 0) {
    const idx = room.monsters.indexOf(mo);
    if (idx >= 0) room.monsters.splice(idx, 1);
    dropGem(room, mo.x, mo.y, mo.xp);
    const killer = room.players.get(ownerId);
    if (killer) killer.kills++;
    return true;
  }
  return false;
}

// Award xp and handle level-ups for a survival player.
function grantXp(room, p, amount) {
  p.xp += amount;
  while (p.xp >= p.xpToNext) {
    p.xp -= p.xpToNext;
    p.level++;
    p.xpToNext = Math.round(C.SURV_LEVEL_BASE_XP * Math.pow(C.SURV_LEVEL_GROWTH, p.level - 1));
    io.to(room.code).emit('levelUp', { id: p.id, level: p.level });
  }
}

function cloneWalls(src) {
  // Per-round room copy: mesh walls get hp; assign ids; build spatial index.
  // Mesh rects (legacy maps saved before NO_MERGE) get split into 1-cell
  // pieces so destroying one cell doesn't take out the whole row.
  const MESH_CELL = 24;
  const out = [];
  let nextId = 1;
  for (const w of src) {
    if (w.kind === 'mesh' && (w.w > MESH_CELL || w.h > MESH_CELL)) {
      const cols = Math.max(1, Math.round(w.w / MESH_CELL));
      const rows = Math.max(1, Math.round(w.h / MESH_CELL));
      const cw = w.w / cols, ch = w.h / rows;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          out.push({
            id: nextId++, x: w.x + c*cw, y: w.y + r*ch, w: cw, h: ch,
            kind: 'mesh', hp: MESH_HP,
          });
        }
      }
    } else {
      out.push({
        id: nextId++, x: w.x, y: w.y, w: w.w, h: w.h,
        kind: w.kind || 'stone',
        hp: w.kind === 'mesh' ? MESH_HP : Infinity,
      });
    }
  }
  Object.defineProperty(out, '__index', {
    value: buildWallIndex(out), enumerable: false, configurable: true, writable: true,
  });
  return out;
}

function startRound(room) {
  if (room.mode === 'imposter') return startImposterRound(room);
  room.started = true;
  // Fresh per-round walls so mesh hp is room-local
  room.walls = cloneWalls(getMapWalls(room.mapName));
  room.bullets = []; room.hearts = []; room.rocketPickups = []; room.sodas = [];
  room.powerups = [];
  room.monsters = []; room.gems = [];
  room.turrets = []; room.pets = [];
  room.roundEndsAt = Date.now() + C.ROUND_MS;
  room.remainingMs = C.ROUND_MS;
  const now = Date.now();
  room.survStartAt = now;
  room.lastMonsterSpawn = now;
  room.nextMonsterId = 1; room.nextGemId = 1;
  room.lastHeartSpawn = now;
  room.lastRocketSpawn = now;
  room.lastSodaSpawn = now;
  room.lastPowerupSpawn = now;
  room.nextBulletId = 1; room.nextHeartId = 1; room.nextRocketId = 1;
  room.nextSodaId = 1; room.nextPowerupId = 1;
  room.nextTurretId = 1; room.nextPetId = 1;
  room.tickCount = 0;
  for (const p of room.players.values()) {
    const s = randomSpawnIn(room.walls);
    p.x = s.x; p.y = s.y;
    p.hp = p.cls === 'pyro' ? C.PYRO_HP_PER_LIFE : C.HP_PER_LIFE; p.lives = C.START_LIVES;
    p.alive = true; p.kills = 0; p.angle = 0; p.fireCd = 0;
    p.ammo = p.cls === 'pyro' ? C.PYRO_FUEL_MAX : (p.cls === 'sniper' ? 1 : C.MAG_SIZE); p.reloading = false; p.reloadEndsAt = 0;
    p.rockets = (p.cls === 'cyber') ? C.CYBER_START_ROCKETS : 0;
    p.lastCyberRocketAt = now;
    p.turretReadyAt = now;
    p.petReadyAt = now;
    p.heartReadyAt = now + C.MEDIC_HEART_CD;
    p.tankUntil = 0; p.tankKills = 0;
    p.speedUntil = 0; p.dmgUntil = 0; p.shieldUntil = 0;
    p.xp = 0; p.level = 1; p.xpToNext = C.SURV_LEVEL_BASE_XP;
  }
  for (let i = 0; i < 4; i++) spawnHeart(room);
  spawnRocketPickup(room);
  io.to(room.code).emit('roundStart', {
    endsAt: room.roundEndsAt,
    mode: room.mode,
    mapW: C.MAP_W, mapH: C.MAP_H, walls: room.walls,
    mapName: room.mapName,
    groundColor: room.groundColor || '#4a6a3a',
  });
  if (room.tickHandle) clearInterval(room.tickHandle);
  room.tickHandle = setInterval(() => { try { tick(room); } catch(e) { console.error('tick error', e); } }, C.TICK_MS);
}

function endRound(room) {
  if (!room.started) return;
  room.started = false;
  if (room.tickHandle) { clearInterval(room.tickHandle); room.tickHandle = null; }
  const board = [...room.players.values()]
    .map(p => ({id:p.id,name:p.name,kills:p.kills,color:p.color,level:p.level}))
    .sort((a,b)=>b.kills-a.kills);
  const survivalMs = room.mode === 'survival' ? Math.max(0, Date.now() - room.survStartAt) : 0;
  io.to(room.code).emit('roundEnd', {board, winner: board[0]||null, mode: room.mode, survivalMs});
  if (room.pendingRestart) clearTimeout(room.pendingRestart);
  room.pendingRestart = setTimeout(() => {
    if (rooms.has(room.code) && room.players.size > 0) startRound(room);
  }, 6000);
}

function checkRoundOver(room) {
  if (!room.started) return;
  if (room.mode === 'imposter') return; // imposter mode has its own win checks
  const alive = [...room.players.values()].filter(p=>p.alive);
  if (room.mode === 'survival') {
    // Co-op: round only ends when everyone is down (endless otherwise).
    if (alive.length === 0) return endRound(room);
    return;
  }
  if (alive.length <= 1 && room.players.size > 1) return endRound(room);
  if (alive.length === 0) return endRound(room);
  if (room.remainingMs <= 0) return endRound(room);
}

// ============================================================
// IMPOSTER MODE LOGIC
// ============================================================
function impAssignRolesAndTasks(room) {
  const ids = [...room.players.keys()];
  for (let i = ids.length-1; i > 0; i--) { const j = Math.floor(Math.random()*(i+1)); [ids[i],ids[j]]=[ids[j],ids[i]]; }
  const impCount = ids.length >= 7 ? 2 : 1;
  const impSet = new Set(ids.slice(0, Math.min(impCount, Math.max(1, ids.length-1))));
  for (const id of ids) {
    const p = room.players.get(id);
    p.role = impSet.has(id) ? 'imposter' : 'crew';
    p.tasks = [];
    if (p.role === 'crew') {
      const pts = [...IMP_MAP.tasks];
      for (let i = pts.length-1; i > 0; i--) { const j = Math.floor(Math.random()*(i+1)); [pts[i],pts[j]]=[pts[j],pts[i]]; }
      const n = Math.min(IMP.TASKS_PER_PLAYER, pts.length);
      p.tasks = pts.slice(0, n).map(pt => ({ id: pt.id, x: pt.x, y: pt.y, done: false }));
    }
  }
}

function startImposterRound(room) {
  room.started = true;
  room.phase = 'play';
  room.walls = cloneWalls(IMP_MAP.walls);
  room.groundColor = IMP_MAP.groundColor;
  room.bullets=[]; room.hearts=[]; room.rocketPickups=[]; room.sodas=[]; room.powerups=[];
  room.monsters=[]; room.gems=[]; room.turrets=[]; room.pets=[];
  room.corpses=[]; room.meeting=null; room.sabotage=null; room.nextCorpseId=1; room.lastSaboAt=0;
  room.roundEndsAt=0; room.remainingMs=0; room.tickCount=0;
  const now = Date.now();
  impAssignRolesAndTasks(room);
  let i = 0; const n = Math.max(1, room.players.size);
  for (const p of room.players.values()) {
    const a = (i/n) * Math.PI*2;
    p.x = IMP_MAP.spawn.x + Math.cos(a)*IMP_MAP.spawn.r;
    p.y = IMP_MAP.spawn.y + Math.sin(a)*IMP_MAP.spawn.r;
    p.angle=0; p.alive=true; p.vented=false; p.ventGroup=null; p.ventId=0;
    p.killReadyAt = now + IMP.KILL_COOLDOWN_MS; p.emergencyUsed=0;
    p.keys = {w:false,a:false,s:false,d:false};
    i++;
  }
  room.taskTotal = 0; room.taskDone = 0;
  for (const p of room.players.values()) if (p.role==='crew') room.taskTotal += p.tasks.length;
  io.to(room.code).emit('roundStart', {
    mode:'imposter', mapW:C.MAP_W, mapH:C.MAP_H, walls:room.walls,
    groundColor:room.groundColor,
    imp: { tasks: IMP_MAP.tasks, vents: IMP_MAP.vents, emergency: IMP_MAP.emergency,
           reactorFix: IMP_MAP.reactorFix, lightsFix: IMP_MAP.lightsFix },
  });
  for (const p of room.players.values()) {
    const teammates = p.role==='imposter'
      ? [...room.players.values()].filter(q=>q.role==='imposter'&&q.id!==p.id).map(q=>({id:q.id,name:q.name}))
      : [];
    io.to(p.id).emit('imposterRole', { role:p.role, tasks:p.tasks, teammates });
  }
  if (room.tickHandle) clearInterval(room.tickHandle);
  room.tickHandle = setInterval(()=>{ try{ tick(room);}catch(e){console.error('imp tick',e);} }, C.TICK_MS);
}

function impStartMeeting(room, reason, reportedBy) {
  if (room.phase !== 'play') return;
  room.phase = 'meeting';
  room.sabotage = null; room.corpses = [];
  const now = Date.now();
  room.meeting = { phase:'discuss', endsAt: now+IMP.DISCUSS_MS, votes:new Map(), reason, reportedBy: reportedBy||null };
  const living = [...room.players.values()].filter(p=>p.alive);
  let i = 0;
  for (const p of living) { const a=(i/Math.max(1,living.length))*Math.PI*2; p.x=IMP_MAP.spawn.x+Math.cos(a)*70; p.y=IMP_MAP.spawn.y+Math.sin(a)*70; p.vented=false; i++; }
  io.to(room.code).emit('meetingStart', { reason, reportedBy: reportedBy||null, endsAt: room.meeting.endsAt, phase:'discuss' });
}

function impTallyVotes(room) {
  const m = room.meeting; if (!m) return;
  const counts = {};
  for (const tgt of m.votes.values()) counts[tgt] = (counts[tgt]||0) + 1;
  let best=null, bestN=0, tie=false;
  for (const k in counts) {
    if (counts[k] > bestN) { best=k; bestN=counts[k]; tie=false; }
    else if (counts[k] === bestN) tie = true;
  }
  let ejected = null;
  if (best && best !== 'skip' && !tie) {
    const p = room.players.get(best);
    if (p) { p.alive=false; ejected={id:p.id,name:p.name,wasImposter:p.role==='imposter'}; }
  }
  m.phase = 'result'; m.endsAt = Date.now() + IMP.MEETING_END_MS;
  io.to(room.code).emit('meetingResult', {
    ejected, tie, skip: best==='skip',
    votes: Object.fromEntries(m.votes), endsAt: m.endsAt,
  });
}

function impCheckWin(room) {
  if (room.phase === 'ended') return;
  const players = [...room.players.values()];
  const livingImp  = players.filter(p=>p.alive && p.role==='imposter').length;
  const livingCrew = players.filter(p=>p.alive && p.role==='crew').length;
  if (livingImp === 0) return impEndRound(room, 'crew');
  if (livingImp >= livingCrew) return impEndRound(room, 'imposter');
  if (room.taskTotal > 0 && room.taskDone >= room.taskTotal) return impEndRound(room, 'crew');
}

function impEndRound(room, winnerSide) {
  if (!room.started) return;
  room.started = false; room.phase = 'ended';
  if (room.tickHandle) { clearInterval(room.tickHandle); room.tickHandle = null; }
  const roles = [...room.players.values()].map(p=>({id:p.id,name:p.name,color:p.color,role:p.role}));
  io.to(room.code).emit('roundEnd', { mode:'imposter', winnerSide, roles, board:[], winner:null });
  if (room.pendingRestart) clearTimeout(room.pendingRestart);
  room.pendingRestart = setTimeout(()=>{ if (rooms.has(room.code) && room.players.size>0) startRound(room); }, 8000);
}

function broadcastImposter(room) {
  if (room.tickCount % C.BROADCAST_EVERY !== 0) return;
  const now = Date.now();
  const common = {
    mode:'imposter', phase: room.phase,
    taskDone: room.taskDone, taskTotal: room.taskTotal,
    corpses: room.corpses.map(c=>({id:c.id,x:c.x,y:c.y,color:c.color})),
    sabotage: room.sabotage ? { type:room.sabotage.type, endsAt:room.sabotage.endsAt||0,
      fixPoints:(room.sabotage.fixPoints||[]).map(f=>({x:f.x,y:f.y,fixed:f.fixed})) } : null,
    meeting: room.meeting ? { phase:room.meeting.phase, endsAt:room.meeting.endsAt,
      reason:room.meeting.reason, reportedBy:room.meeting.reportedBy,
      voted:[...room.meeting.votes.keys()] } : null,
  };
  for (const viewer of room.players.values()) {
    const viewerGhost = !viewer.alive;
    const players = [];
    for (const p of room.players.values()) {
      if (!p.alive && !viewerGhost && p.id !== viewer.id) continue;        // ghosts seen only by ghosts
      if (p.vented && p.id !== viewer.id && viewer.role !== 'imposter') continue; // vented hidden
      players.push({ id:p.id,name:p.name,color:p.color,x:p.x,y:p.y,angle:p.angle,alive:p.alive,vented:p.vented });
    }
    const self = {
      role: viewer.role, alive: viewer.alive, vented: viewer.vented,
      tasks: viewer.tasks.map(t=>({id:t.id,x:t.x,y:t.y,done:t.done})),
      killReadyIn: viewer.role==='imposter' ? Math.max(0, viewer.killReadyAt-now) : 0,
      emergencyUsed: viewer.emergencyUsed,
      saboReadyIn: viewer.role==='imposter' ? Math.max(0, (room.lastSaboAt+IMP.SABO_COOLDOWN_MS)-now) : 0,
    };
    io.to(viewer.id).emit('impState', { ...common, players, self, t: now });
  }
}

function imposterTick(room) {
  const now = Date.now();
  room.tickCount++;
  if (room.phase === 'meeting') {
    const m = room.meeting;
    if (m) {
      if (m.phase === 'discuss' && now >= m.endsAt) {
        m.phase = 'vote'; m.endsAt = now + IMP.VOTE_MS;
        io.to(room.code).emit('meetingPhase', { phase:'vote', endsAt:m.endsAt });
      } else if (m.phase === 'vote') {
        const living = [...room.players.values()].filter(p=>p.alive).length;
        if (now >= m.endsAt || m.votes.size >= living) { impTallyVotes(room); }
      } else if (m.phase === 'result' && now >= m.endsAt) {
        room.meeting = null; room.phase = 'play';
        for (const p of room.players.values()) p.killReadyAt = now + IMP.KILL_COOLDOWN_MS;
        impCheckWin(room);
      }
    }
    broadcastImposter(room);
    return;
  }
  // play phase: reactor sabotage countdown
  if (room.sabotage && room.sabotage.type === 'reactor') {
    if (room.sabotage.fixPoints.every(f=>f.fixed)) { room.sabotage = null; io.to(room.code).emit('sabotageEnd',{}); }
    else if (now >= room.sabotage.endsAt) { return impEndRound(room, 'imposter'); }
  }
  // movement (ghosts move too, to finish tasks; vented impostors teleport instead)
  for (const p of room.players.values()) {
    if (p.vented) continue;
    let dx=0, dy=0;
    if (p.keys.w) dy-=1; if (p.keys.s) dy+=1; if (p.keys.a) dx-=1; if (p.keys.d) dx+=1;
    if (dx||dy) { const len=Math.hypot(dx,dy); tryMove(p, dx/len*IMP.SPEED, dy/len*IMP.SPEED, C.PLAYER_R); }
  }
  impCheckWin(room);
  broadcastImposter(room);
}

// ---- imposter actions (called from socket handlers) ----
function impDoKill(room, p) {
  if (room.phase!=='play' || p.role!=='imposter' || !p.alive || p.vented) return;
  const now = Date.now(); if (now < p.killReadyAt) return;
  let victim=null, best=IMP.KILL_RANGE2;
  for (const q of room.players.values()) {
    if (!q.alive || q.role==='imposter' || q.vented) continue;
    const d2=(q.x-p.x)**2+(q.y-p.y)**2; if (d2<best) { best=d2; victim=q; }
  }
  if (!victim) return;
  victim.alive = false;
  room.corpses.push({ id:room.nextCorpseId++, x:victim.x, y:victim.y, color:victim.color });
  p.killReadyAt = now + IMP.KILL_COOLDOWN_MS;
  p.x = victim.x; p.y = victim.y;
  io.to(room.code).emit('impKillFx', { x:victim.x, y:victim.y });
  io.to(victim.id).emit('impYouDied', {});
  impCheckWin(room);
}
function impDoReport(room, p) {
  if (room.phase!=='play' || !p.alive) return;
  let near=false; for (const c of room.corpses) { if ((c.x-p.x)**2+(c.y-p.y)**2<IMP.REPORT_RANGE2) { near=true; break; } }
  if (!near) return;
  impStartMeeting(room, 'report', p.id);
}
function impDoEmergency(room, p) {
  if (room.phase!=='play' || !p.alive) return;
  const e=IMP_MAP.emergency; if ((e.x-p.x)**2+(e.y-p.y)**2>IMP.EMERGENCY_RANGE2) return;
  if (p.emergencyUsed >= IMP.EMERGENCY_PER_PLAYER) return;
  p.emergencyUsed++; impStartMeeting(room, 'emergency', p.id);
}
function impDoVote(room, p, targetId) {
  const m=room.meeting;
  if (room.phase!=='meeting' || !m || m.phase!=='vote' || !p.alive) return;
  if (m.votes.has(p.id)) return;
  const ok = targetId==='skip' || (room.players.has(targetId) && room.players.get(targetId).alive);
  if (!ok) return;
  m.votes.set(p.id, targetId);
}
function impDoTask(room, p, pointId) {
  if (room.phase!=='play') return;
  const t = p.tasks.find(t=>t.id===pointId && !t.done);
  if (!t) return;
  if ((t.x-p.x)**2+(t.y-p.y)**2 > IMP.USE_RANGE2) return;
  t.done = true; room.taskDone++;
  impCheckWin(room);
}
function impDoSabotage(room, p, type) {
  if (room.phase!=='play' || p.role!=='imposter' || !p.alive) return;
  const now=Date.now(); if (now < room.lastSaboAt+IMP.SABO_COOLDOWN_MS || room.sabotage) return;
  if (type==='lights') room.sabotage = { type:'lights', fixPoints:[{x:IMP_MAP.lightsFix.x,y:IMP_MAP.lightsFix.y,fixed:false}] };
  else if (type==='reactor') room.sabotage = { type:'reactor', endsAt:now+IMP.REACTOR_MS, fixPoints:IMP_MAP.reactorFix.map(f=>({x:f.x,y:f.y,fixed:false})) };
  else return;
  room.lastSaboAt = now;
  io.to(room.code).emit('sabotageStart', { type });
}
function impDoFix(room, p) {
  if (room.phase!=='play' || !room.sabotage || !p.alive || p.role==='imposter') return;
  for (const f of room.sabotage.fixPoints) if (!f.fixed && (f.x-p.x)**2+(f.y-p.y)**2<IMP.USE_RANGE2) f.fixed=true;
  if (room.sabotage.fixPoints.every(f=>f.fixed)) { room.sabotage=null; io.to(room.code).emit('sabotageEnd',{}); }
}
function impDoVent(room, p, action) {
  if (room.phase!=='play' || p.role!=='imposter' || !p.alive) return;
  if (action==='enter') {
    if (p.vented) return;
    for (const v of IMP_MAP.vents) if ((v.x-p.x)**2+(v.y-p.y)**2<IMP.VENT_RANGE2) { p.vented=true; p.ventGroup=v.group; p.ventId=v.id; p.x=v.x; p.y=v.y; return; }
  } else if (action==='exit') {
    if (p.vented) { p.vented=false; p.ventGroup=null; }
  } else if (action==='move') {
    if (!p.vented) return;
    const group = IMP_MAP.vents.filter(v=>v.group===p.ventGroup);
    const idx = group.findIndex(v=>v.id===p.ventId);
    const next = group[(idx+1)%group.length];
    if (next) { p.ventId=next.id; p.x=next.x; p.y=next.y; }
  }
}

function tryMove(p, dx, dy, r) {
  const rr = r || C.PLAYER_R;
  const walls = p._room.walls;
  let nx = p.x+dx, ny = p.y+dy;
  nx = Math.max(rr, Math.min(C.MAP_W-rr, nx));
  ny = Math.max(rr, Math.min(C.MAP_H-rr, ny));
  // If already inside a wall (bad spawn), always allow movement so player can escape
  const stuck = hitsWallList(walls, p.x, p.y, rr);
  if (stuck || !hitsWallList(walls, nx, p.y, rr)) p.x = nx;
  if (stuck || !hitsWallList(walls, p.x, ny, rr)) p.y = ny;
}

function applyDamage(room, victim, dmg, killerId) {
  const nowD = Date.now();
  // Shield power-up: fully absorbs incoming damage while active.
  if (nowD < victim.shieldUntil) return;
  // Damage power-up: attacker deals extra damage while active.
  const killerD = room.players.get(killerId);
  if (killerD && killerD !== victim && nowD < killerD.dmgUntil) {
    dmg = Math.ceil(dmg * C.DAMAGE_BUFF_MUL);
  }
  victim.hp -= dmg;
  if (victim.hp <= 0) {
    victim.lives--;
    const killer = room.players.get(killerId);
    if (killer && killer !== victim) {
      killer.kills++;
      if (killer.cls === 'tank' && Date.now() >= killer.tankUntil) {
        killer.tankKills++;
        if (killer.tankKills >= C.TANK_KILLS_REQUIRED) {
          killer.tankKills = 0;
          killer.tankUntil = Date.now() + C.TANK_DURATION;
          killer.hp = C.TANK_HP_BOOST;
          io.to(room.code).emit('tankMode', {id: killer.id, until: killer.tankUntil});
        }
      }
    }
    io.to(room.code).emit('kill', {killer: killer ? killer.name : (room.mode === 'survival' ? '🧟' : '?'), victim: victim.name});
    if (victim.lives <= 0) { victim.alive = false; }
    else {
      const s = randomSpawnIn(room.walls);
      victim.x = s.x; victim.y = s.y;
      victim.hp = victim.cls === 'pyro' ? C.PYRO_HP_PER_LIFE : C.HP_PER_LIFE;
      const nowR = Date.now();
      if (victim.turretReadyAt > nowR + C.ENGINEER_TURRET_CD) victim.turretReadyAt = nowR + C.ENGINEER_TURRET_CD;
      if (victim.petReadyAt    > nowR + C.MEDIC_PET_CD)       victim.petReadyAt    = nowR + C.MEDIC_PET_CD;
    }
  }
}

function tick(room) {
  if (!room.started) return;
  if (room.mode === 'imposter') return imposterTick(room);
  const now = Date.now();
  room.tickCount++;
  // Tick-driven round timer: pauses naturally if tick skipped due to error
  room.remainingMs = Math.max(0, room.remainingMs - C.TICK_MS);

  if (now - room.lastHeartSpawn >= C.HEART_SPAWN_MS) {
    spawnHeart(room); room.lastHeartSpawn = now;
  }
  if (now - room.lastRocketSpawn >= C.ROCKET_SPAWN_MS) {
    spawnRocketPickup(room); room.lastRocketSpawn = now;
  }
  if (now - (room.lastSodaSpawn||0) >= C.SODA_SPAWN_MS) {
    spawnSoda(room); room.lastSodaSpawn = now;
  }
  if (now - (room.lastPowerupSpawn||0) >= C.POWERUP_SPAWN_MS) {
    spawnPowerup(room); room.lastPowerupSpawn = now;
  }

  // Survival: spawn monster waves whose rate & strength ramp over time.
  let survDiff = null;
  if (room.mode === 'survival') {
    survDiff = survDifficulty(room, now);
    if (now - room.lastMonsterSpawn >= survDiff.interval) {
      const alivePlayers = [...room.players.values()].filter(p => p.alive).length || 1;
      const n = survDiff.batch + (alivePlayers - 1);
      for (let i = 0; i < n; i++) spawnMonster(room, survDiff);
      room.lastMonsterSpawn = now;
    }
  }

  for (const p of room.players.values()) {
    if (!p.alive) continue;

    // Class passive: Cyber auto-rockets
    if (p.cls === 'cyber' && now - p.lastCyberRocketAt >= C.CYBER_ROCKET_INTERVAL) {
      p.rockets += C.CYBER_ROCKET_PER_INTERVAL;
      p.lastCyberRocketAt = now;
    }
    // Class passive: Medic auto-heart (every 2.5min, if lives < max)
    if (p.cls === 'medic' && now >= p.heartReadyAt && p.lives < C.MAX_LIVES) {
      p.lives++;
      p.heartReadyAt = now + C.MEDIC_HEART_CD;
    }
    // Tank mode expiry
    const isTank = now < p.tankUntil;
    const sb = room.mode === 'survival' ? survBonus(p.level) : null;
    const fireMul = sb ? sb.fireMul : 1;
    const speedBuff = now < p.speedUntil ? C.SPEED_BUFF_MUL : 1;
    const speedMul = speedBuff * (sb ? sb.speedMul : 1) * (isTank ? 0.7 : (p.cls === 'pyro' ? 1.2 : (p.cls === 'sniper' ? 1.5 : 1)));
    const playerR = isTank ? C.PLAYER_R + 12 : C.PLAYER_R;

    let dx = 0, dy = 0;
    if (p.keys.w) dy -= 1; if (p.keys.s) dy += 1;
    if (p.keys.a) dx -= 1; if (p.keys.d) dx += 1;
    if (dx || dy) {
      const len = Math.hypot(dx, dy);
      tryMove(p, dx/len*C.PLAYER_SPEED*speedMul, dy/len*C.PLAYER_SPEED*speedMul, playerR);
    }
    p.fireCd -= C.TICK_MS;
    if (p.reloading && now >= p.reloadEndsAt) {
      p.reloading = false;
      p.ammo = p.cls === 'pyro' ? C.PYRO_FUEL_MAX : (p.cls === 'sniper' ? 1 : C.MAG_SIZE);
    }

    // Right click = rocket (if available)
    if (p.rightDown && p.fireCd <= 0 && p.rockets > 0) {
      p.fireCd = C.ROCKET_FIRE_COOLDOWN * fireMul; p.rockets--;
      const rspeed = p.cls === 'cyber' ? C.CYBER_ROCKET_SPEED : C.ROCKET_SPEED;
      const m = 22;
      room.bullets.push({
        id: room.nextBulletId++, owner: p.id, type: 'rocket', ownerCls: p.cls,
        x: p.x+Math.cos(p.angle)*m, y: p.y+Math.sin(p.angle)*m,
        vx: Math.cos(p.angle)*rspeed, vy: Math.sin(p.angle)*rspeed,
        angle: p.angle, life: 70,
      });
    }
    // Left click = bullet (pyro uses flame instead)
    if (p.leftDown && p.fireCd <= 0 && !p.reloading) {
      if (p.cls === 'pyro' && p.ammo > 0) {
        p.fireCd = C.PYRO_FLAME_CD * fireMul;
        p.ammo--;
        const m = 20;
        room.bullets.push({
          id: room.nextBulletId++, owner: p.id, type: 'flame', dmg: C.PYRO_FLAME_DMG,
          x: p.x+Math.cos(p.angle)*m, y: p.y+Math.sin(p.angle)*m,
          vx: Math.cos(p.angle)*C.PYRO_FLAME_SPEED, vy: Math.sin(p.angle)*C.PYRO_FLAME_SPEED,
          angle: p.angle, life: C.PYRO_FLAME_LIFE,
        });
        if (p.ammo === 0) { p.reloading = true; p.reloadEndsAt = now + C.PYRO_REFUEL_MS; }
      } else if (p.cls === 'sniper' && p.ammo > 0) {
        p.fireCd = C.SNIPER_FIRE_CD * fireMul;
        p.ammo--;
        const m = 20;
        room.bullets.push({
          id: room.nextBulletId++, owner: p.id, type: 'sniper', dmg: C.SNIPER_DMG,
          x: p.x+Math.cos(p.angle)*m, y: p.y+Math.sin(p.angle)*m,
          vx: Math.cos(p.angle)*C.SNIPER_BULLET_SPEED, vy: Math.sin(p.angle)*C.SNIPER_BULLET_SPEED,
          angle: p.angle, life: C.SNIPER_BULLET_LIFE,
        });
        p.reloading = true; p.reloadEndsAt = now + C.SNIPER_RELOAD_MS;
      } else if (p.ammo > 0) {
        p.fireCd = (isTank ? Math.floor(C.FIRE_COOLDOWN * 0.6) : C.FIRE_COOLDOWN) * fireMul;
        p.ammo--;
        const m = 20;
        const bulletDmg = isTank ? 2 : 1;
        room.bullets.push({
          id: room.nextBulletId++, owner: p.id, type: 'bullet', dmg: bulletDmg,
          x: p.x+Math.cos(p.angle)*m, y: p.y+Math.sin(p.angle)*m,
          vx: Math.cos(p.angle)*C.BULLET_SPEED, vy: Math.sin(p.angle)*C.BULLET_SPEED,
          life: 45,
        });
        if (p.ammo === 0) { p.reloading = true; p.reloadEndsAt = now + C.RELOAD_MS; }
      }
    }
    for (let i = room.hearts.length-1; i >= 0; i--) {
      const h = room.hearts[i];
      if (p.lives < C.MAX_LIVES) magnetTo(p, h);
      if ((h.x-p.x)**2+(h.y-p.y)**2 < (C.PLAYER_R+10)**2 && p.lives < C.MAX_LIVES) {
        p.lives++; room.hearts.splice(i,1);
      }
    }
    for (let i = room.rocketPickups.length-1; i >= 0; i--) {
      const r = room.rocketPickups[i];
      magnetTo(p, r);
      if ((r.x-p.x)**2+(r.y-p.y)**2 < (C.PLAYER_R+12)**2) {
        p.rockets += C.ROCKET_CHARGES;
        room.rocketPickups.splice(i, 1);
      }
    }
    for (let i = room.sodas.length-1; i >= 0; i--) {
      const s = room.sodas[i];
      const maxHp = (now < p.tankUntil ? C.TANK_HP_BOOST : C.HP_PER_LIFE);
      if (p.hp < maxHp) magnetTo(p, s);
      if ((s.x-p.x)**2+(s.y-p.y)**2 < (C.PLAYER_R+12)**2 && p.hp < maxHp) {
        const before = p.hp;
        p.hp = Math.min(maxHp, p.hp + C.SODA_HEAL);
        io.to(room.code).emit('heal', { id: p.id, amount: p.hp - before });
        room.sodas.splice(i, 1);
      }
    }
    for (let i = room.powerups.length-1; i >= 0; i--) {
      const pu = room.powerups[i];
      magnetTo(p, pu);
      if ((pu.x-p.x)**2+(pu.y-p.y)**2 < (C.PLAYER_R+12)**2) {
        if (pu.type === 'speed')       p.speedUntil  = now + C.SPEED_BUFF_MS;
        else if (pu.type === 'damage') p.dmgUntil    = now + C.DAMAGE_BUFF_MS;
        else if (pu.type === 'shield') p.shieldUntil = now + C.SHIELD_BUFF_MS;
        io.to(room.code).emit('powerup', { id: p.id, type: pu.type });
        room.powerups.splice(i, 1);
      }
    }
    // Survival: collect XP gems (wide magnet range)
    if (room.mode === 'survival') {
      for (let i = room.gems.length-1; i >= 0; i--) {
        const g = room.gems[i];
        const dx = p.x - g.x, dy = p.y - g.y;
        const d2 = dx*dx + dy*dy;
        if (d2 < C.SURV_GEM_MAGNET_R * C.SURV_GEM_MAGNET_R) {
          const d = Math.sqrt(d2) || 1;
          const step = Math.min(d, 7);
          g.x += dx/d*step; g.y += dy/d*step;
        }
        if (d2 < (C.PLAYER_R+10)**2) {
          grantXp(room, p, g.val || 1);
          room.gems.splice(i, 1);
        }
      }
    }
  }

  // Survival: monster AI — chase nearest alive player, deal contact damage.
  if (room.mode === 'survival') {
    const alive = [...room.players.values()].filter(pl => pl.alive);
    for (let mi = room.monsters.length-1; mi >= 0; mi--) {
      const mo = room.monsters[mi];
      let target = null, bestD = Infinity;
      for (const pl of alive) {
        const d2 = (pl.x-mo.x)**2 + (pl.y-mo.y)**2;
        if (d2 < bestD) { bestD = d2; target = pl; }
      }
      if (target) {
        const d = Math.sqrt(bestD) || 1;
        // ghosts ignore walls; just walk straight at the target
        mo.x += (target.x-mo.x)/d * mo.speed;
        mo.y += (target.y-mo.y)/d * mo.speed;
        const hitR = mo.r + C.PLAYER_R;
        if (bestD < hitR*hitR && now >= mo.nextHitAt) {
          mo.nextHitAt = now + C.SURV_MON_CONTACT_CD;
          applyDamage(room, target, mo.dmg, null);
        }
      }
    }
    // Defensive cap on gems
    if (room.gems.length > 400) room.gems.splice(0, room.gems.length - 400);
  }

  // Pets: heal nearby allies, expire after duration
  for (let pi = room.pets.length-1; pi >= 0; pi--) {
    const pet = room.pets[pi];
    if (pet.hp <= 0) {
      io.to(room.code).emit('explosion', {x: pet.x, y: pet.y, r: 28});
      room.pets.splice(pi, 1); continue;
    }
    if (now >= pet.expiresAt) { room.pets.splice(pi, 1); continue; }
    if (now - (pet.lastHealAt||0) >= C.PET_HEAL_EVERY) {
      pet.lastHealAt = now;
      for (const pl of room.players.values()) {
        if (!pl.alive) continue;
        const d2 = (pl.x-pet.x)**2 + (pl.y-pet.y)**2;
        const plMaxHp = pl.cls === 'pyro' ? C.PYRO_HP_PER_LIFE : C.HP_PER_LIFE;
        if (d2 < (C.PLAYER_R + C.PET_HEAL_R)**2 && pl.hp < plMaxHp) {
          pl.hp = Math.min(plMaxHp, pl.hp + C.PET_HEAL_PER_TICK);
        }
      }
    }
  }

  // Turrets: walk toward target point if relocating, then target/fire.
  for (let ti = room.turrets.length-1; ti >= 0; ti--) {
    const t = room.turrets[ti];
    if (t.hp <= 0) {
      io.to(room.code).emit('explosion', {x: t.x, y: t.y, r: 32});
      room.turrets.splice(ti, 1); continue;
    }
    if (t.targetX !== undefined) {
      const dx = t.targetX - t.x, dy = t.targetY - t.y;
      const dist = Math.hypot(dx, dy);
      if (dist <= C.TURRET_MOVE_SPEED) {
        t.x = t.targetX; t.y = t.targetY;
        t.targetX = undefined; t.targetY = undefined;
      } else {
        const nx = t.x + (dx / dist) * C.TURRET_MOVE_SPEED;
        const ny = t.y + (dy / dist) * C.TURRET_MOVE_SPEED;
        // step axis-by-axis so a wall on one side doesn't fully halt us
        if (!hitsWallList(room.walls, nx, t.y, 14)) t.x = nx;
        if (!hitsWallList(room.walls, t.x, ny, 14)) t.y = ny;
      }
    }
    let target = null, bestD = C.TURRET_RANGE * C.TURRET_RANGE;
    if (room.mode === 'survival') {
      for (const mo of room.monsters) {
        const d2 = (mo.x-t.x)**2 + (mo.y-t.y)**2;
        if (d2 < bestD) { bestD = d2; target = mo; }
      }
    } else {
      for (const pl of room.players.values()) {
        if (!pl.alive || pl.id === t.owner) continue;
        const d2 = (pl.x-t.x)**2 + (pl.y-t.y)**2;
        if (d2 < bestD) { bestD = d2; target = pl; }
      }
    }
    if (target) {
      t.angle = Math.atan2(target.y-t.y, target.x-t.x);
      // Finish reload
      if (t.ammo <= 0 && now >= (t.reloadEndsAt || 0)) {
        t.ammo = C.TURRET_MAG_SIZE;
      }
      if (t.ammo > 0 && now >= (t.nextFireAt || 0)) {
        t.nextFireAt = now + C.TURRET_FIRE_CD;
        t.ammo--;
        room.bullets.push({
          id: room.nextBulletId++, owner: t.owner, type: 'turret', dmg: C.TURRET_BULLET_DMG,
          x: t.x + Math.cos(t.angle)*16, y: t.y + Math.sin(t.angle)*16,
          vx: Math.cos(t.angle)*C.TURRET_BULLET_SPEED,
          vy: Math.sin(t.angle)*C.TURRET_BULLET_SPEED,
          life: 40,
        });
        if (t.ammo === 0) t.reloadEndsAt = now + C.TURRET_RELOAD_MS;
      }
    }
  }

  // Defensive cap: keep newest bullets if list ever explodes
  if (room.bullets.length > 800) room.bullets.splice(0, room.bullets.length - 800);

  for (let i = room.bullets.length-1; i >= 0; i--) {
    const b = room.bullets[i];
    b.x += b.vx; b.y += b.vy; b.life--;
    const isRocket = b.type === 'rocket';
    const r = isRocket ? C.ROCKET_R : (b.type === 'sniper' ? C.SNIPER_BULLET_HIT_R : C.BULLET_R);
    let detonated = false;

    if (b.life<=0||b.x<0||b.y<0||b.x>C.MAP_W||b.y>C.MAP_H) {
      if (isRocket) detonated = true;
      else { room.bullets.splice(i,1); continue; }
    }
    if (!detonated) {
      const w = findWallHit(room.walls, b.x, b.y, r, PASSABLE_FOR_BULLETS);
      if (w) {
        if (w.kind === 'mesh' && w.hp !== Infinity) {
          w.hp -= (b.dmg || 1);
          if (w.hp <= 0) breakWall(room, w);
        }
        if (isRocket) detonated = true;
        else { room.bullets.splice(i,1); continue; }
      }
    }

    if (!detonated) {
      let hitSomething = false;
      // Survival: bullets hit monsters (co-op, no PvP)
      if (room.mode === 'survival') {
        for (const mo of room.monsters) {
          if ((mo.x-b.x)**2+(mo.y-b.y)**2 < (mo.r + r)**2) {
            if (isRocket) { detonated = true; }
            else {
              damageMonster(room, mo, outgoingDmg(room, b.owner, b.dmg || 1), b.owner);
              room.bullets.splice(i,1);
              hitSomething = true;
            }
            break;
          }
        }
        if (hitSomething) continue;
      }
      // hit players (PvP disabled in survival)
      if (room.mode !== 'survival') for (const p of room.players.values()) {
        if (!p.alive || p.id===b.owner) continue;
        const pr = (Date.now() < p.tankUntil ? C.PLAYER_R + 12 : C.PLAYER_R);
        if ((p.x-b.x)**2+(p.y-b.y)**2 < (pr + r)**2) {
          if (isRocket) { detonated = true; }
          else {
            applyDamage(room, p, b.dmg || 1, b.owner);
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
      // hit pets (skip own)
      if (!detonated && !hitSomething) {
        for (const pt of room.pets) {
          if (pt.owner === b.owner) continue;
          if ((pt.x-b.x)**2+(pt.y-b.y)**2 < (10 + r)**2) {
            if (isRocket) { detonated = true; }
            else {
              pt.hp -= (b.dmg || 1);
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
      io.to(room.code).emit('explosion', {x: b.x, y: b.y, r: C.ROCKET_AOE_R, color: b.ownerCls === 'cyber' ? 'cyber' : null});
      if (room.mode === 'survival') {
        const splash = outgoingDmg(room, b.owner, 10);
        for (let mi = room.monsters.length-1; mi >= 0; mi--) {
          const mo = room.monsters[mi];
          if ((mo.x-b.x)**2 + (mo.y-b.y)**2 < C.ROCKET_AOE_R**2) {
            damageMonster(room, mo, splash, b.owner);
          }
        }
      } else for (const p of room.players.values()) {
        if (!p.alive) continue;
        const d2 = (p.x-b.x)**2 + (p.y-b.y)**2;
        if (d2 < C.ROCKET_AOE_R**2) {
          // Fixed 10 damage regardless of distance
          applyDamage(room, p, 10, b.owner);
        }
      }
      // splash damage to turrets (sabit ~%30 hasar, 3-4 roket dayanır)
      for (const tu of room.turrets) {
        const d2 = (tu.x-b.x)**2 + (tu.y-b.y)**2;
        if (d2 < C.ROCKET_AOE_R**2) tu.hp -= 12;
      }
      // splash damage to pets
      for (const pt of room.pets) {
        const d2 = (pt.x-b.x)**2 + (pt.y-b.y)**2;
        if (d2 < C.ROCKET_AOE_R**2) pt.hp -= 10;
      }
      room.bullets.splice(i, 1);
    }
  }

  if (room.tickCount % C.BROADCAST_EVERY === 0) {
    io.to(room.code).emit('state', {
      t: now, endsAt: room.roundEndsAt, msLeft: room.remainingMs,
      mode: room.mode,
      survivalMs: room.mode === 'survival' ? Math.max(0, now - room.survStartAt) : 0,
      players: [...room.players.values()].map(p => ({
        id:p.id, name:p.name, color:p.color, cls:p.cls, hat:p.hat, hatCfg:p.hatCfg,
        x:p.x, y:p.y, angle:p.angle,
        hp:p.hp, lives:p.lives, maxHp: (now < p.tankUntil ? C.TANK_HP_BOOST : (p.cls==='pyro' ? C.PYRO_HP_PER_LIFE : C.HP_PER_LIFE)),
        ammo:p.ammo, maxAmmo: p.cls === 'pyro' ? C.PYRO_FUEL_MAX : (p.cls === 'sniper' ? 1 : C.MAG_SIZE),
        reloading:p.reloading, reloadEndsAt:p.reloadEndsAt,
        rockets:p.rockets,
        tank: now < p.tankUntil, tankUntil: p.tankUntil, tankKills: p.tankKills,
        turretReadyAt: p.turretReadyAt,
        petReadyAt: p.petReadyAt,
        turretReadyIn: Math.max(0, p.turretReadyAt - now),
        petReadyIn: Math.max(0, p.petReadyAt - now),
        heartReadyIn: Math.max(0, p.heartReadyAt - now),
        cyberReadyIn: p.cls === 'cyber' ? Math.max(0, (p.lastCyberRocketAt + C.CYBER_ROCKET_INTERVAL) - now) : 0,
        tankRemaining: Math.max(0, p.tankUntil - now),
        speedMs:  Math.max(0, p.speedUntil  - now),
        dmgMs:    Math.max(0, p.dmgUntil    - now),
        shieldMs: Math.max(0, p.shieldUntil - now),
        xp:p.xp, level:p.level, xpToNext:p.xpToNext,
        alive:p.alive, kills:p.kills,
      })),
      bullets: room.bullets.map(b=>({id:b.id, x:b.x, y:b.y, type:b.type||'bullet', angle:b.angle})),
      hearts:  room.hearts.map(h=>({x:h.x, y:h.y})),
      rocketPickups: room.rocketPickups.map(r=>({x:r.x, y:r.y})),
      sodas:   room.sodas.map(s=>({x:s.x, y:s.y})),
      powerups: room.powerups.map(pu=>({x:pu.x, y:pu.y, type:pu.type})),
      monsters: room.monsters.map(m=>({id:m.id, x:m.x, y:m.y, hp:m.hp, maxHp:m.maxHp, r:m.r, elite:m.elite})),
      gems: room.gems.map(g=>({x:g.x, y:g.y, val:g.val})),
      turrets: room.turrets.map(t=>({x:t.x, y:t.y, angle:t.angle||0, hp:t.hp, maxHp:C.TURRET_HP, owner:t.owner})),
      pets:    room.pets.map(pt=>({x:pt.x, y:pt.y, hp:pt.hp, maxHp:C.PET_HP, msLeft: Math.max(0, pt.expiresAt - now), owner:pt.owner})),
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

  socket.on('createRoom', ({name, color, cls, mapName, customMap, groundColor, mode}, ack) => {
    leaveCurrentRoom(socket);
    // Host may ship a custom map's walls inline (fetched from Supabase).
    if (customMap && Array.isArray(customMap) && mapName) {
      savedMaps.set(mapName, sanitizeWalls(customMap));
    }
    const room = newRoom(socket.id, name, color, cls, mapName, mode);
    if (typeof groundColor === 'string' && /^#[0-9a-fA-F]{6}$/.test(groundColor)) {
      room.groundColor = groundColor;
    }
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
    if (!room || !room.started || room.mode === 'imposter') return;
    const p = room.players.get(socket.id);
    if (!p || !p.alive || p.cls !== 'engineer') return;
    if (Date.now() < p.turretReadyAt) return;
    if (hitsWallList(room.walls, p.x, p.y, 14)) return;
    // Remove existing turret(s) owned by this engineer; 2. taret çıkınca eskisi yok olur
    for (let i = room.turrets.length - 1; i >= 0; i--) {
      if (room.turrets[i].owner === p.id) {
        const old = room.turrets[i];
        io.to(room.code).emit('explosion', {x: old.x, y: old.y, r: 40});
        room.turrets.splice(i, 1);
      }
    }
    room.turrets.push({
      id: room.nextTurretId++,
      owner: p.id, x: p.x, y: p.y,
      hp: C.TURRET_HP, angle: 0, nextFireAt: 0,
      ammo: C.TURRET_MAG_SIZE, reloadEndsAt: 0,
    });
    p.turretReadyAt = Date.now() + C.ENGINEER_TURRET_CD;
  });

  // Engineer commands their own turret to walk toward a point. The turret
  // doesn't teleport — its tick loop steps it toward (targetX, targetY).
  socket.on('moveTurret', ({x, y}) => {
   try {
    const code = socketRoom.get(socket.id);
    const room = code && rooms.get(code);
    if (!room || !room.started || room.mode === 'imposter') return;
    const p = room.players.get(socket.id);
    if (!p || !p.alive || p.cls !== 'engineer') return;
    if (typeof x !== 'number' || typeof y !== 'number') return;
    const tx = Math.max(20, Math.min(C.MAP_W - 20, x));
    const ty = Math.max(20, Math.min(C.MAP_H - 20, y));
    const mine = room.turrets.filter(t => t.owner === p.id);
    if (!mine.length) return;
    const dx = p.x - tx, dy = p.y - ty;
    if (dx*dx + dy*dy > 260*260) return;
    if (hitsWallList(room.walls, tx, ty, 14)) return;
    for (const t of mine) { t.targetX = tx; t.targetY = ty; }
   } catch (e) { console.error('moveTurret error', e); }
  });

  socket.on('placePet', () => {
    const code = socketRoom.get(socket.id);
    const room = code && rooms.get(code);
    if (!room || !room.started || room.mode === 'imposter') return;
    const p = room.players.get(socket.id);
    if (!p || !p.alive || p.cls !== 'medic') return;
    if (Date.now() < p.petReadyAt) return;
    room.pets.push({
      id: room.nextPetId++,
      owner: p.id, x: p.x, y: p.y,
      hp: C.PET_HP,
      expiresAt: Date.now() + C.PET_DURATION, lastHealAt: 0,
    });
    p.petReadyAt = Date.now() + C.MEDIC_PET_CD;
  });

  // Map editor: save custom map, list maps, delete
  // Browsers persist maps directly to Supabase. The server only relays
  // a notification so every open lobby picker refreshes its list.
  socket.on('mapSaved', ({name}) => {
    if (!name) return;
    io.emit('mapsUpdated', { trigger: 'save', name });
  });
  socket.on('mapDeleted', ({name}) => {
    if (!name) return;
    io.emit('mapsUpdated', { trigger: 'delete', name });
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

  // ---- Imposter mode actions ----
  function impRoomPlayer() {
    const code = socketRoom.get(socket.id);
    const room = code && rooms.get(code);
    if (!room || room.mode !== 'imposter' || !room.started) return null;
    const p = room.players.get(socket.id);
    return p ? { room, p } : null;
  }
  socket.on('impKill',      () => { const c=impRoomPlayer(); if (c) impDoKill(c.room, c.p); });
  socket.on('impReport',    () => { const c=impRoomPlayer(); if (c) impDoReport(c.room, c.p); });
  socket.on('impEmergency', () => { const c=impRoomPlayer(); if (c) impDoEmergency(c.room, c.p); });
  socket.on('impVote',  ({target}) => { const c=impRoomPlayer(); if (c) impDoVote(c.room, c.p, target); });
  socket.on('impTask',  ({id})     => { const c=impRoomPlayer(); if (c) impDoTask(c.room, c.p, id); });
  socket.on('impSabotage', ({type})=> { const c=impRoomPlayer(); if (c) impDoSabotage(c.room, c.p, type); });
  socket.on('impFix',   () => { const c=impRoomPlayer(); if (c) impDoFix(c.room, c.p); });
  socket.on('impVent',  ({action}) => { const c=impRoomPlayer(); if (c) impDoVent(c.room, c.p, action); });

  socket.on('knifeSwing', () => {
   try {
    const code = socketRoom.get(socket.id);
    const room = code && rooms.get(code);
    if (!room || room.mode === 'imposter') return;
    const p = room.players.get(socket.id);
    if (!p || !p.alive || p.cls !== 'sniper') return;
    const now = Date.now();
    if (p.knifeReadyAt && now < p.knifeReadyAt) return;
    p.knifeReadyAt = now + C.KNIFE_CD;
    io.to(room.code).emit('knifeFx', { x: p.x, y: p.y, angle: p.angle });
    const halfArc = C.KNIFE_ARC / 2;
    const ang = Number.isFinite(p.angle) ? p.angle : 0;
    for (const target of room.players.values()) {
      if (!target.alive || target.id === p.id) continue;
      const dx = target.x - p.x, dy = target.y - p.y;
      const dist = Math.hypot(dx, dy);
      if (dist > C.KNIFE_RANGE + C.PLAYER_R) continue;
      const targetAng = Math.atan2(dy, dx);
      let da = targetAng - ang;
      // Normalize to [-PI, PI] without while-loops (guards against NaN/inf infinite loops)
      da = ((da + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
      if (Math.abs(da) > halfArc) continue;
      applyDamage(room, target, C.KNIFE_DMG, p.id);
    }
   } catch (e) { console.error('knifeSwing error', e); }
  });

  socket.on('reload', () => {
    const code = socketRoom.get(socket.id);
    const room = code && rooms.get(code);
    if (!room || room.mode === 'imposter') return;
    const p = room.players.get(socket.id);
    const maxA = p.cls === 'pyro' ? C.PYRO_FUEL_MAX : (p.cls === 'sniper' ? 1 : C.MAG_SIZE);
    if (!p || !p.alive || p.reloading || p.ammo === maxA || p.cls === 'pyro') return;
    p.reloading = true;
    p.reloadEndsAt = Date.now() + (p.cls === 'sniper' ? C.SNIPER_RELOAD_MS : C.RELOAD_MS);
  });

  socket.on('changeColor', ({color}) => {
    const code = socketRoom.get(socket.id);
    const room = code && rooms.get(code);
    if (!room) return;
    const p = room.players.get(socket.id);
    if (p) p.color = color;
    io.to(room.code).emit('roomUpdate', publicRoom(room));
  });

  socket.on('setHat', ({hat, cfg}) => {
    const code = socketRoom.get(socket.id);
    const room = code && rooms.get(code);
    if (!room) return;
    const p = room.players.get(socket.id);
    if (!p) return;
    const safe = typeof hat === 'string' && /^[^/\\]+\.png$/i.test(hat) ? hat : '';
    p.hat = safe;
    let onlyCfg = false;
    if (cfg && typeof cfg === 'object') {
      const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, Number(v) || 0));
      const nextCfg = {
        ox: clamp(cfg.ox, -1.1, 1.1),
        oy: clamp(cfg.oy, -2.0, 0.6),
        scale: clamp(cfg.scale, 0.3, 4),
        rot: clamp(cfg.rot, -Math.PI * 2, Math.PI * 2),
      };
      onlyCfg = p.hat === safe && !!p.hatCfg;
      p.hatCfg = nextCfg;
    }
    // Coalesce roomUpdate during rapid hat drag/wheel: max once per ~120ms per player
    const now = Date.now();
    if (!onlyCfg || !p._lastHatBroadcast || now - p._lastHatBroadcast > 120) {
      p._lastHatBroadcast = now;
      io.to(room.code).emit('roomUpdate', publicRoom(room));
    }
  });

  socket.on('lobbyChat', ({text}) => {
    const code = socketRoom.get(socket.id);
    const room = code && rooms.get(code);
    if (!room) return;
    const p = room.players.get(socket.id);
    if (!p) return;
    const now = Date.now();
    if (p._lastChatAt && now - p._lastChatAt < 350) return; // rate limit
    p._lastChatAt = now;
    const msg = String(text || '').slice(0, 120).trim();
    if (!msg) return;
    io.to(room.code).emit('lobbyChat', { id: p.id, name: p.name, color: p.color, text: msg, t: now });
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
  if (room.started) {
    if (room.mode === 'imposter') impCheckWin(room);
    else checkRoundOver(room);
  }
  if (rooms.has(code)) io.to(code).emit('roomUpdate', publicRoom(room));
}

// ============================================================
// START
// ============================================================
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log('Gold Wave server on port ' + PORT));
