// HostGame — runs the authoritative game state in the host browser.
// Mirrors what server.js used to do. No network in this file; the
// network layer (game.js) feeds inputs in and pulls states/events out.

const HG_CONST = {
  MAP_W: 1600, MAP_H: 1200,
  ROUND_MS: 10 * 60 * 1000,
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

function HG_buildWalls() {
  const W = HG_CONST.MAP_W, H = HG_CONST.MAP_H;
  const w = [];
  w.push({ x: 0, y: 0, w: W, h: 20 });
  w.push({ x: 0, y: H - 20, w: W, h: 20 });
  w.push({ x: 0, y: 0, w: 20, h: H });
  w.push({ x: W - 20, y: 0, w: 20, h: H });
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
  for (const b of blocks) w.push({ x:b[0], y:b[1], w:b[2], h:b[3] });
  return w;
}

class HostGame {
  constructor(callbacks) {
    this.cb = callbacks || {};
    this.walls = HG_buildWalls();
    this.players = new Map(); // id -> player
    this.bullets = [];
    this.hearts = [];
    this.started = false;
    this.roundEndsAt = 0;
    this.lastHeartSpawn = 0;
    this.nextBulletId = 1;
    this.nextHeartId = 1;
    this.tickHandle = null;
    this.pendingRestart = null;
  }

  start() {
    if (this.tickHandle) return;
    this.tickHandle = setInterval(() => this.tick(), HG_CONST.TICK_MS);
  }
  stop() {
    if (this.tickHandle) clearInterval(this.tickHandle);
    this.tickHandle = null;
    if (this.pendingRestart) clearTimeout(this.pendingRestart);
  }

  // ===== world helpers =====
  circleRectCollide(cx, cy, cr, r) {
    const nx = Math.max(r.x, Math.min(cx, r.x + r.w));
    const ny = Math.max(r.y, Math.min(cy, r.y + r.h));
    const dx = cx - nx, dy = cy - ny;
    return dx * dx + dy * dy < cr * cr;
  }
  hitsWall(x, y, r) {
    for (const w of this.walls) if (this.circleRectCollide(x, y, r, w)) return true;
    return false;
  }
  randomSpawn() {
    const { MAP_W, MAP_H, PLAYER_R } = HG_CONST;
    for (let i = 0; i < 200; i++) {
      const x = 60 + Math.random() * (MAP_W - 120);
      const y = 60 + Math.random() * (MAP_H - 120);
      if (!this.hitsWall(x, y, PLAYER_R + 4)) return { x, y };
    }
    return { x: 80, y: 80 };
  }

  // ===== player management =====
  addPlayer(id, name, color) {
    if (this.players.size >= HG_CONST.MAX_PLAYERS) return false;
    if (this.started) return false;
    const s = this.randomSpawn();
    this.players.set(id, {
      id,
      name: (name || 'Player').slice(0, 16),
      color: color || '#ff5577',
      x: s.x, y: s.y, angle: 0,
      hp: HG_CONST.HP_PER_LIFE,
      lives: HG_CONST.START_LIVES,
      alive: true,
      ammo: HG_CONST.MAG_SIZE,
      reloading: false, reloadEndsAt: 0,
      kills: 0,
      keys: { w:false, a:false, s:false, d:false },
      mouseDown: false,
      fireCd: 0,
    });
    return true;
  }
  removePlayer(id) {
    if (!this.players.has(id)) return;
    this.players.delete(id);
    if (this.started) this.checkRoundOver();
  }
  setName(id, name) {
    const p = this.players.get(id);
    if (p) p.name = (name || 'Player').slice(0, 16);
  }
  setColor(id, color) {
    const p = this.players.get(id);
    if (p) p.color = color || p.color;
  }
  applyInput(id, input) {
    const p = this.players.get(id);
    if (!p) return;
    if (input.keys) p.keys = input.keys;
    if (typeof input.angle === 'number') p.angle = input.angle;
    if (typeof input.mouseDown === 'boolean') p.mouseDown = input.mouseDown;
  }
  tryReload(id) {
    const p = this.players.get(id);
    if (!p || !p.alive) return;
    if (p.reloading || p.ammo === HG_CONST.MAG_SIZE) return;
    p.reloading = true;
    p.reloadEndsAt = Date.now() + HG_CONST.RELOAD_MS;
  }

  // ===== rounds =====
  startRound() {
    this.started = true;
    this.bullets = [];
    this.hearts = [];
    this.roundEndsAt = Date.now() + HG_CONST.ROUND_MS;
    this.lastHeartSpawn = Date.now();
    for (const p of this.players.values()) {
      const s = this.randomSpawn();
      p.x = s.x; p.y = s.y;
      p.hp = HG_CONST.HP_PER_LIFE;
      p.lives = HG_CONST.START_LIVES;
      p.alive = true;
      p.kills = 0;
      p.angle = 0;
      p.fireCd = 0;
      p.ammo = HG_CONST.MAG_SIZE;
      p.reloading = false;
      p.reloadEndsAt = 0;
    }
    for (let i = 0; i < 4; i++) this.spawnHeart();
    this.cb.onRoundStart && this.cb.onRoundStart({
      endsAt: this.roundEndsAt,
      mapW: HG_CONST.MAP_W, mapH: HG_CONST.MAP_H,
      walls: this.walls,
    });
  }

  endRound() {
    if (!this.started) return;
    this.started = false;
    const board = [...this.players.values()]
      .map(p => ({ id: p.id, name: p.name, kills: p.kills, color: p.color }))
      .sort((a, b) => b.kills - a.kills);
    const winner = board[0] || null;
    this.cb.onRoundEnd && this.cb.onRoundEnd({ board, winner });
    if (this.pendingRestart) clearTimeout(this.pendingRestart);
    this.pendingRestart = setTimeout(() => {
      if (this.players.size > 0) this.startRound();
    }, 6000);
  }

  checkRoundOver() {
    if (!this.started) return;
    const alive = [...this.players.values()].filter(p => p.alive);
    if (alive.length <= 1 && this.players.size > 1) return this.endRound();
    if (alive.length === 0) return this.endRound();
    if (Date.now() >= this.roundEndsAt) return this.endRound();
  }

  spawnHeart() {
    if (this.hearts.length >= HG_CONST.MAX_HEARTS) return;
    const { MAP_W, MAP_H } = HG_CONST;
    for (let i = 0; i < 50; i++) {
      const x = 60 + Math.random() * (MAP_W - 120);
      const y = 60 + Math.random() * (MAP_H - 120);
      if (!this.hitsWall(x, y, 10)) {
        this.hearts.push({ id: this.nextHeartId++, x, y });
        return;
      }
    }
  }

  tryMove(p, dx, dy) {
    const { MAP_W, MAP_H, PLAYER_R } = HG_CONST;
    let nx = p.x + dx, ny = p.y + dy;
    nx = Math.max(PLAYER_R, Math.min(MAP_W - PLAYER_R, nx));
    ny = Math.max(PLAYER_R, Math.min(MAP_H - PLAYER_R, ny));
    if (!this.hitsWall(nx, p.y, PLAYER_R)) p.x = nx;
    if (!this.hitsWall(p.x, ny, PLAYER_R)) p.y = ny;
  }

  // ===== main tick =====
  tick() {
    if (!this.started) return;
    const now = Date.now();
    const C = HG_CONST;

    if (now - this.lastHeartSpawn >= C.HEART_SPAWN_MS) {
      this.spawnHeart();
      this.lastHeartSpawn = now;
    }

    for (const p of this.players.values()) {
      if (!p.alive) continue;
      let dx = 0, dy = 0;
      if (p.keys.w) dy -= 1;
      if (p.keys.s) dy += 1;
      if (p.keys.a) dx -= 1;
      if (p.keys.d) dx += 1;
      if (dx || dy) {
        const len = Math.hypot(dx, dy);
        dx = dx / len * C.PLAYER_SPEED;
        dy = dy / len * C.PLAYER_SPEED;
        this.tryMove(p, dx, dy);
      }
      p.fireCd -= C.TICK_MS;
      if (p.reloading && now >= p.reloadEndsAt) {
        p.reloading = false;
        p.ammo = C.MAG_SIZE;
      }
      if (p.mouseDown && p.fireCd <= 0 && p.ammo > 0 && !p.reloading) {
        p.fireCd = C.FIRE_COOLDOWN;
        p.ammo -= 1;
        const muzzle = 20;
        const bx = p.x + Math.cos(p.angle) * muzzle;
        const by = p.y + Math.sin(p.angle) * muzzle;
        this.bullets.push({
          id: this.nextBulletId++,
          owner: p.id,
          x: bx, y: by,
          vx: Math.cos(p.angle) * C.BULLET_SPEED,
          vy: Math.sin(p.angle) * C.BULLET_SPEED,
          life: 80,
        });
        if (p.ammo === 0) {
          p.reloading = true;
          p.reloadEndsAt = now + C.RELOAD_MS;
        }
      }
      for (let i = this.hearts.length - 1; i >= 0; i--) {
        const h = this.hearts[i];
        if ((h.x - p.x) ** 2 + (h.y - p.y) ** 2 < (C.PLAYER_R + 10) ** 2) {
          if (p.lives < C.MAX_LIVES) {
            p.lives += 1;
            this.hearts.splice(i, 1);
          }
        }
      }
    }

    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.x += b.vx; b.y += b.vy; b.life--;
      if (b.life <= 0 || b.x < 0 || b.y < 0 || b.x > C.MAP_W || b.y > C.MAP_H) {
        this.bullets.splice(i, 1); continue;
      }
      if (this.hitsWall(b.x, b.y, C.BULLET_R)) { this.bullets.splice(i, 1); continue; }
      for (const p of this.players.values()) {
        if (!p.alive || p.id === b.owner) continue;
        if ((p.x - b.x) ** 2 + (p.y - b.y) ** 2 < (C.PLAYER_R) ** 2) {
          p.hp -= 1;
          this.bullets.splice(i, 1);
          if (p.hp <= 0) {
            p.lives -= 1;
            const killer = this.players.get(b.owner);
            if (killer) killer.kills += 1;
            this.cb.onKill && this.cb.onKill({ killer: killer ? killer.name : '?', victim: p.name });
            if (p.lives <= 0) {
              p.alive = false;
            } else {
              const s = this.randomSpawn();
              p.x = s.x; p.y = s.y; p.hp = C.HP_PER_LIFE;
            }
          }
          break;
        }
      }
    }

    const state = {
      t: now,
      endsAt: this.roundEndsAt,
      players: [...this.players.values()].map(p => ({
        id: p.id, name: p.name, color: p.color,
        x: p.x, y: p.y, angle: p.angle,
        hp: p.hp, lives: p.lives, maxHp: C.HP_PER_LIFE,
        ammo: p.ammo, maxAmmo: C.MAG_SIZE,
        reloading: p.reloading, reloadEndsAt: p.reloadEndsAt,
        alive: p.alive, kills: p.kills,
      })),
      bullets: this.bullets.map(b => ({ x: b.x, y: b.y })),
      hearts: this.hearts.map(h => ({ x: h.x, y: h.y })),
    };
    this.cb.onState && this.cb.onState(state);

    this.checkRoundOver();
  }

  // ===== snapshot for lobby UI =====
  publicRoom(code, ownerId) {
    return {
      id: code,
      ownerId,
      started: this.started,
      count: this.players.size,
      max: HG_CONST.MAX_PLAYERS,
      players: [...this.players.values()].map(p => ({
        id: p.id, name: p.name, color: p.color,
      })),
    };
  }
}
