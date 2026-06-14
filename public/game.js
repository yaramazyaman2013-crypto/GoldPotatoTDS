// ============ i18n ============
const I18N = {
  tr: {
    play: 'OYNA', settings: 'AYARLAR', rooms: 'ODALAR', back: 'GERI',
    createRoom: 'ODA OLUSTUR', roomCode: 'ODA KODU', join: 'KATIL',
    openRooms: 'ACIK ODALAR', lobby: 'LOBI', roomCode2: 'Oda Kodu:',
    start: 'BASLAT', waitHost: 'Oda sahibinin baslatmasini bekle',
    leave: 'CIK', settingsTitle: 'AYARLAR', volume: 'Ses',
    crosshair: 'Nisan', language: 'Dil', resume: 'DEVAM ET',
    leaveGame: 'OYUNDAN CIK', escHint: 'ESC ile kapatabilirsin',
    roundEnd: 'TUR BITTI', nextRound: 'Yeni tur birazdan...',
    eliminated: 'ELENDIN', winner: 'KAZANAN', noWinner: 'KAZANAN YOK',
    kills: 'kill', leaderboard: 'LIDERLIK',
    codeHint: 'Oda kodunu arkadaşına ver, o da KATIL butonuyla bağlansın.',
    connecting: 'Bağlanılıyor...',
  },
  en: {
    play: 'PLAY', settings: 'SETTINGS', rooms: 'ROOMS', back: 'BACK',
    createRoom: 'CREATE ROOM', roomCode: 'ROOM CODE', join: 'JOIN',
    openRooms: 'OPEN ROOMS', lobby: 'LOBBY', roomCode2: 'Room Code:',
    start: 'START', waitHost: 'Waiting for host to start',
    leave: 'LEAVE', settingsTitle: 'SETTINGS', volume: 'Volume',
    crosshair: 'Crosshair', language: 'Language', resume: 'RESUME',
    leaveGame: 'LEAVE GAME', escHint: 'Press ESC to close',
    roundEnd: 'ROUND OVER', nextRound: 'Next round soon...',
    eliminated: 'ELIMINATED', winner: 'WINNER', noWinner: 'NO WINNER',
    kills: 'kills', leaderboard: 'LEADERBOARD',
    codeHint: 'Share the room code with your friend so they can join.',
    connecting: 'Connecting...',
  },
};

let currentLang = localStorage.getItem('gwLang') || 'tr';

function applyLang(lang) {
  currentLang = lang;
  localStorage.setItem('gwLang', lang);
  const dict = I18N[lang];
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (dict[key] !== undefined) el.textContent = dict[key];
  });
  document.querySelectorAll('[data-i18n-ph]').forEach(el => {
    const key = el.getAttribute('data-i18n-ph');
    if (dict[key] !== undefined) el.placeholder = dict[key];
  });
  ['btnLangTR','btnLangEN','pauseLangTR','pauseLangEN'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const isActive = (id.endsWith('TR') && lang === 'tr') || (id.endsWith('EN') && lang === 'en');
    el.classList.toggle('active-lang', isActive);
  });
}

// ============ AUDIO (procedural) ============
const AUD = {
  ctx: null, master: null, musicGain: null, sfxGain: null,
  musicTimer: null, started: false, volume: 0.5,
  ensure() {
    if (this.ctx) return;
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return;
    this.ctx = new C();
    this.master = this.ctx.createGain(); this.master.gain.value = this.volume;
    this.master.connect(this.ctx.destination);
    this.musicGain = this.ctx.createGain(); this.musicGain.gain.value = 0.35;
    this.musicGain.connect(this.master);
    this.sfxGain = this.ctx.createGain(); this.sfxGain.gain.value = 0.9;
    this.sfxGain.connect(this.master);
  },
  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); },
  setVolume(v) { this.volume = v; if (this.master) this.master.gain.value = v; },
  muted: false,
  setMusicMute(m) {
    this.muted = m;
    if (this.musicGain) this.musicGain.gain.value = m ? 0 : 0.35;
  },
  playNote(midi, when, dur, type, dest, peakGain) {
    if (!this.ctx || !midi) return;
    const freq = 440 * Math.pow(2, (midi - 69) / 12);
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type; osc.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(peakGain, when + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    osc.connect(g); g.connect(dest);
    osc.start(when); osc.stop(when + dur + 0.05);
  },
  startMusic() {
    if (!this.ctx || this.musicTimer) return;
    const tempo = 110;
    const beat = 60 / tempo;
    const lead = [60,0,64,0, 67,0,64,0, 65,0,69,0, 67,0,64,0,
                  62,0,65,0, 69,0,65,0, 64,0,67,0, 60,0,0,0];
    const bass = [48,0,0,0, 55,0,0,0, 53,0,0,0, 55,0,0,0,
                  50,0,0,0, 57,0,0,0, 52,0,0,0, 48,0,0,0];
    let step = 0;
    const interval = (beat / 2) * 1000;
    const tick = () => {
      if (!this.ctx) return;
      const t = this.ctx.currentTime + 0.02;
      this.playNote(lead[step], t, beat * 0.4, 'square', this.musicGain, 0.18);
      this.playNote(bass[step], t, beat * 0.6, 'triangle', this.musicGain, 0.22);
      step = (step + 1) % lead.length;
    };
    tick();
    this.musicTimer = setInterval(tick, interval);
  },
  shoot(gainMul) {
    if (!this.ctx) return;
    const gm = typeof gainMul === 'number' ? gainMul : 1;
    if (gm <= 0.01) return;
    const t = this.ctx.currentTime;
    const buf = this.ctx.createBuffer(1, 3200, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random()*2-1) * Math.pow(1 - i/d.length, 2);
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass'; filter.frequency.value = 1200; filter.Q.value = 0.8;
    const g = this.ctx.createGain(); g.gain.value = 0.5 * gm;
    src.connect(filter); filter.connect(g); g.connect(this.sfxGain);
    src.start(t);
    const osc = this.ctx.createOscillator();
    const og = this.ctx.createGain();
    osc.type = 'square'; osc.frequency.setValueAtTime(120, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.08);
    og.gain.setValueAtTime(0.3 * gm, t);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    osc.connect(og); og.connect(this.sfxGain);
    osc.start(t); osc.stop(t + 0.1);
  },
  reload() {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime;
    const click = (when, freq) => {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'square'; osc.frequency.value = freq;
      g.gain.setValueAtTime(0.4, when);
      g.gain.exponentialRampToValueAtTime(0.001, when + 0.06);
      osc.connect(g); g.connect(this.sfxGain);
      osc.start(when); osc.stop(when + 0.07);
    };
    click(t0, 220); click(t0 + 0.5, 180); click(t0 + 1.2, 260);
  },
  step() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const buf = this.ctx.createBuffer(1, 1100, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random()*2-1) * Math.pow(1 - i/d.length, 3);
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass'; filter.frequency.value = 280;
    const g = this.ctx.createGain(); g.gain.value = 0.25;
    src.connect(filter); filter.connect(g); g.connect(this.sfxGain);
    src.start(t);
  },
  explode() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    // noise burst (body of explosion)
    const sr = this.ctx.sampleRate;
    const buf = this.ctx.createBuffer(1, sr * 0.6, sr);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random()*2-1) * Math.pow(1 - i/d.length, 1.5);
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 600;
    const ng = this.ctx.createGain();
    ng.gain.setValueAtTime(1.2, t);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
    src.connect(lp); lp.connect(ng); ng.connect(this.sfxGain);
    src.start(t);
    // low thump
    const osc = this.ctx.createOscillator();
    const og = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(80, t);
    osc.frequency.exponentialRampToValueAtTime(22, t + 0.35);
    og.gain.setValueAtTime(1.0, t);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    osc.connect(og); og.connect(this.sfxGain);
    osc.start(t); osc.stop(t + 0.4);
  },
};

function startAudioOnGesture() {
  AUD.ensure(); AUD.resume();
  if (!AUD.started) { AUD.started = true; }
  // Keep trying until the browser lets us play (policy: must be after gesture)
  if (bgMusic && bgMusic.paused && !bgMusic.muted) {
    bgMusic.play().catch(() => {});
  }
}
document.addEventListener('click', startAudioOnGesture);
document.addEventListener('keydown', startAudioOnGesture);

// ============ HTML5 background music ============
const bgMusic = document.getElementById('bgMusic');
if (bgMusic) {
  bgMusic.volume = 0.25; // gentle background level
  if (localStorage.getItem('gwMute') === '1') bgMusic.muted = true;
}

// ============ SOCKET.IO ============
let socket;
try {
  socket = io();
  socket.on('connect_error', () => console.warn('[Net] Sunucuya bağlanılamıyor.'));
  socket.on('connect', () => console.log('[Net] Bağlandı:', socket.id));
} catch (e) {
  console.warn('[Net] Socket.IO yüklenemedi. Sunucu çalışıyor mu?');
  socket = { id: 'offline', emit: () => {}, on: () => {} };
}

function setNetStatus(msg) {
  const el = document.getElementById('netStatus');
  if (el) el.textContent = msg || '';
}

// ============ COLORS & NAMES ============
const COLORS = [
  '#ff5577', '#ff8a3c', '#ffd24a', '#7ad24a',
  '#4ad2c2', '#4a8aff', '#a44aff', '#ff4ad2',
  '#ffffff', '#888888', '#222222', '#cc6633',
  '#33cc66', '#3366cc', '#ff3030', '#22dd22'
];
const NAME_POOL = [
  'KARTOFEL','PIXEL','NEON','BOLT','ECHO','ZAP','BYTE','GLITCH',
  'ROBO','SPARK','CHIP','TURBO','HEX','VOLT','FLUX','RUST'
];

const state = {
  name: NAME_POOL[Math.floor(Math.random()*NAME_POOL.length)] + Math.floor(Math.random()*1000),
  color: COLORS[Math.floor(Math.random()*8)],
  cls: localStorage.getItem('gwClass') || 'cyber',
  hat: localStorage.getItem('gwHat') || '',
  mapName: 'default',
  mode: 'ffa',
  roomId: null, ownerId: null, selfId: null,
  isHost: false,
  inLobby: false, inGame: false,
  walls: [], mapW: 1600, mapH: 1200,
  endsAt: 0, serverState: null, killfeed: [],
  imp: null,
};

const CLASS_INFO = {
  cyber:    { label: 'CYBER',    desc: '1 füze ile başlar<br>Her 50sn: +3 füze (mavi)',    color: '#7afcff' },
  engineer: { label: 'MUHENDIS', desc: '70sn: Taret koy (B)<br>35 mermi, 4.5sn reload',   color: '#4a8aff' },
  medic:    { label: 'DOKTOR',   desc: '65sn: Pet (V, 10sn ömür)<br>2.5dk: +1 can',       color: '#7ad24a' },
  tank:     { label: 'TANK',     desc: '3 kill: 30sn tank modu<br>25 HP, büyük, x2 hasar',color: '#ff5577' },
  pyro:     { label: 'PYRO',     desc: 'Alev silahı (50 yakıt)<br>Yakın mesafe, 2sn dolum', color: '#ff7a1a' },
  sniper:   { label: 'SNIPER',   desc: '15 hasar, çok uzun menzil<br>1 mermi, 6sn reload<br>Orta tuş: bıçak (4 hasar)', color: '#c8ff5c' },
};

// ===== Robot pixel art =====
// Cute round blob with two big eyes. Perfectly symmetric (col i mirrors col 15-i).
// Legend:
//   0=empty, 1=outline (dark), 2=body color, 3=highlight (lighter shade),
//   4=eye white, 5=eye pupil (dark), 6=cheek blush, 7=mouth
const ROBOT_SPRITE = [
  "0000001111000000","0000112222110000",
  "0001223333221000","0012333333332100",
  "0123333333333210","1233333333333321",
  "1221113333111221","1214441221444121",
  "1214451221544121","1214551221554121",
  "1221113333111221","1222222222222221",
  "1262227777222621","1262277777722621",
  "1222222772222221","0122222222222210",
  "0011222222221100","0001112222111000",
  "0000111111110000","0000000000000000",
];

function drawRobot(ctx, ox, oy, scale, color) {
  const cell = scale, w = 16, h = 20;
  // derive a lighter highlight tint from the body color
  const n = parseInt((color||'#ff5577').slice(1), 16);
  const r = Math.min(255, ((n>>16)&255) + 40);
  const g = Math.min(255, ((n>>8)&255) + 40);
  const b = Math.min(255, (n&255) + 40);
  const light = '#' + ((r<<16)|(g<<8)|b).toString(16).padStart(6,'0');
  ctx.save();
  ctx.translate(ox + (w*cell)/2, oy + (h*cell)/2);
  ctx.imageSmoothingEnabled = false;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const c = ROBOT_SPRITE[y][x];
      if (c === '0') continue;
      let fill;
      if (c==='1') fill='#0a0a0a';
      else if (c==='2') fill=color;
      else if (c==='3') fill=light;
      else if (c==='4') fill='#ffffff';
      else if (c==='5') fill='#0a0a14';
      else if (c==='6') fill='#ff8aa0';
      else if (c==='7') fill='#2a1010';
      ctx.fillStyle = fill;
      ctx.fillRect(-((w*cell)/2)+x*cell, -((h*cell)/2)+y*cell, cell, cell);
    }
  }
  ctx.restore();
}

// Cache robot body sprites per color. Each is drawn once to an offscreen
// canvas; the render loop then does a single drawImage + rotate instead
// of 15+ fillRect calls + ctx.ellipse per player per frame.
// In-game cute character: drawn once per color into an offscreen canvas
// using the same high-fidelity drawCuteCharacter function as the menu.
// Top-down view doesn't rotate (creature always "faces forward").
const _robotBodyCache = new Map();
const _ROBOT_CW = 60, _ROBOT_CH = 80;
const _ROBOT_CX = 30, _ROBOT_CY = 46;  // body center within the cache canvas
function getRobotBody(color, withAntenna = true) {
  const key = color + (withAntenna ? '|a' : '|n');
  if (_robotBodyCache.has(key)) return _robotBodyCache.get(key);
  const cv = document.createElement('canvas');
  cv.width = _ROBOT_CW; cv.height = _ROBOT_CH;
  const c = cv.getContext('2d');
  c.imageSmoothingEnabled = true;
  drawCuteCharacter(c, _ROBOT_CX, _ROBOT_CY, 36, color, withAntenna);
  _robotBodyCache.set(key, cv);
  return cv;
}

// Pyro fire sound — loops while firing, stops ~300ms after last shot
const _pyroFireAudios = new Map(); // playerId → { audio, stopId }
function _pyroFireTrigger(playerId, volMul) {
  const vm = typeof volMul === 'number' ? volMul : 1;
  if (vm <= 0.02) return;
  let entry = _pyroFireAudios.get(playerId);
  if (!entry) {
    entry = { audio: new Audio('fire.mp3'), stopId: null };
    entry.audio.loop = true;
    _pyroFireAudios.set(playerId, entry);
  }
  entry.audio.volume = Math.min(1, (AUD.volume || 0.5) * 0.125 * vm);
  if (entry.audio.paused) entry.audio.play().catch(() => {});
  clearTimeout(entry.stopId);
  entry.stopId = setTimeout(() => { if (entry.audio) entry.audio.pause(); }, 320);
}

const _gunImg = new Image();
_gunImg.src = 'gun.png';
const _flameImg = new Image();
_flameImg.src = 'flame.png';
const _sniperImg = new Image();
_sniperImg.src = 'sniper.png';

// Hat image cache (key: filename, value: Image)
const _hatImgCache = new Map();
function getHatImg(name) {
  if (!name) return null;
  let img = _hatImgCache.get(name);
  if (img) return img;
  img = new Image();
  img.src = 'hats/' + encodeURIComponent(name);
  _hatImgCache.set(name, img);
  return img;
}

// Per-hat user adjustments persisted in localStorage as {ox, oy, scale, rot}.
// ox/oy are character-radius-relative offsets, scale multiplies base size, rot in radians.
const HAT_DEFAULT = { ox: 0.18, oy: -0.35, scale: 1.5, rot: 0 };
const HAT_DEFAULTS = {
  'şapka2.png': { ox: 0.18, oy: -0.35, scale: 0.95, rot: 0 },
};
function getHatCfg(name) {
  const def = (name && HAT_DEFAULTS[name]) || HAT_DEFAULT;
  if (!name) return { ...def };
  try {
    const raw = localStorage.getItem('gwHatCfg_' + name);
    if (raw) return { ...def, ...JSON.parse(raw) };
  } catch (e) {}
  return { ...def };
}
function setHatCfg(name, cfg) {
  if (!name) return;
  localStorage.setItem('gwHatCfg_' + name, JSON.stringify(cfg));
}

// Draw a hat sitting on top of a character at the given scale.
// size = character diameter (e.g., 36 in-game, 220 in preview).
// cfg overrides per-hat tunings: {ox, oy, scale}.
function drawHat(ctx, name, size, cfgOverride) {
  const img = getHatImg(name);
  if (!img || !img.complete || img.naturalWidth === 0) return;
  const r = size / 2;
  const aspect = img.naturalWidth / img.naturalHeight;
  const cfg = cfgOverride || getHatCfg(name);
  const hatW = Math.round(r * cfg.scale);
  const hatH = Math.round(hatW / aspect);
  const cx = r * cfg.ox;
  const cy = r * cfg.oy - hatH / 2;
  const rot = cfg.rot || 0;
  const prevSmooth = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  if (rot) {
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.translate(cx, cy);
    ctx.rotate(rot);
    ctx.drawImage(img, -hatW / 2, -hatH / 2, hatW, hatH);
    ctx.restore();
  } else {
    ctx.drawImage(img, Math.round(cx - hatW / 2), Math.round(cy - hatH / 2), hatW, hatH);
  }
  ctx.imageSmoothingEnabled = prevSmooth;
}

// Per-player roll state: tracks world position for smooth velocity
const _rollState = new Map();
function updateRoll(id, wx, wy) {
  let s = _rollState.get(id);
  const now = Date.now();
  if (!s) { s = { x: wx, y: wy, lastT: now, vx: 0, vy: 0 }; _rollState.set(id, s); return s; }
  const dt = Math.max(1, now - s.lastT);
  const rvx = (wx - s.x) / dt * 16, rvy = (wy - s.y) / dt * 16;
  s.vx = s.vx * 0.7 + rvx * 0.3;
  s.vy = s.vy * 0.7 + rvy * 0.3;
  s.x = wx; s.y = wy; s.lastT = now;
  s.speed = Math.hypot(s.vx, s.vy);
  return s;
}

function drawRobotTopDown(ctx, x, y, color, angle, alive=true, id=null, wx=0, wy=0, hat='', hatCfg=null, cls='') {
  ctx.save();
  ctx.translate(x, y);
  if (!alive) ctx.globalAlpha = 0.35;
  // Walking bob animation — translate only (no rotation to avoid pixelation)
  const rs = id ? updateRoll(id, wx, wy) : null;
  if (rs && rs.speed > 0.5 && alive) {
    const now = Date.now();
    const bob = Math.abs(Math.sin(now / 130)) * 2;
    ctx.translate(0, -bob);
  }
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(getRobotBody(color, !hat), -_ROBOT_CX, -_ROBOT_CY);
  if (hat) {
    // For other players: never use local localStorage cfg — use server hatCfg or plain default
    const isLocalPlayer = id && id === (typeof socket !== 'undefined' ? socket.id : null);
    const resolvedCfg = hatCfg || (isLocalPlayer ? null : ((hat && HAT_DEFAULTS[hat]) || HAT_DEFAULT));
    drawHat(ctx, hat, 36, resolvedCfg);
  }
  // draw weapon rotated toward cursor
  const weaponImg = cls === 'pyro' ? _flameImg : (cls === 'sniper' ? _sniperImg : _gunImg);
  if (weaponImg.complete && weaponImg.naturalWidth > 0) {
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.translate(0, 8);
    ctx.rotate(angle);
    if (cls === 'pyro') {
      ctx.drawImage(weaponImg, 2, -10, 36, 20);
    } else if (cls === 'sniper') {
      ctx.drawImage(weaponImg, 0, -9, 44, 18);
    } else {
      ctx.drawImage(weaponImg, 2, -8, 32, 16);
    }
    ctx.restore();
  }
  ctx.restore();
}

function drawShirt(ctx) {
  ctx.clearRect(0,0,40,40); ctx.imageSmoothingEnabled = false;
  const map = [
    "01100011000110","11110111101111","12221333312221",
    "12222311132221","01222222222210","00122222222100",
    "00122222222100","00122222222100","00122222222100",
    "00122222222100","00111111111100",
  ];
  const s = 2;
  const ox = Math.floor((40 - map[0].length * s) / 2);
  const oy = Math.floor((40 - map.length * s) / 2);
  for (let y=0;y<map.length;y++) for (let x=0;x<map[y].length;x++) {
    const c = map[y][x];
    if (c==='0') continue;
    let col = c==='1' ? '#0a0a0a' : c==='2' ? '#ffd24a' : '#caa030';
    ctx.fillStyle = col;
    ctx.fillRect(ox+x*s, oy+y*s, s, s);
  }
}

// ===== Menu =====
const $ = id => document.getElementById(id);
const screens = ['menu','rooms','lobby','settings','game','editor'];
function show(id) {
  screens.forEach(s => $(s).classList.toggle('hidden', s !== id));
}

const nameInput = $('nameInput');
nameInput.value = state.name;
nameInput.addEventListener('input', () => {
  state.name = nameInput.value.slice(0,16) || 'Player';
  if (state.roomId) socket.emit('chatName', { name: state.name });
});

// High-fidelity ("128-bit") cute character: smooth gradients, anti-aliased
// arcs, antenna, glints — used for menu preview + palette swatches.
function drawCuteCharacter(ctx, cx, cy, size, color, withAntenna = true) {
  const r = size / 2;
  ctx.save();
  ctx.translate(cx, cy);
  // shadow
  ctx.fillStyle = 'rgba(0,0,0,0.32)';
  ctx.beginPath();
  ctx.ellipse(0, r*0.92, r*0.95, r*0.22, 0, 0, Math.PI*2);
  ctx.fill();
  // derive shades from color
  const n = parseInt((color||'#ff5577').slice(1), 16);
  const cR = (n>>16)&255, cG = (n>>8)&255, cB = n&255;
  const lr = Math.min(255, cR + 70), lg = Math.min(255, cG + 70), lb = Math.min(255, cB + 70);
  const dr = Math.max(0, cR - 50),  dg = Math.max(0, cG - 50),  db = Math.max(0, cB - 50);
  const light = `rgb(${lr},${lg},${lb})`;
  const dark  = `rgb(${dr},${dg},${db})`;
  // body with radial gradient
  const grad = ctx.createRadialGradient(-r*0.35, -r*0.45, r*0.05, 0, 0, r*1.05);
  grad.addColorStop(0, light);
  grad.addColorStop(0.55, color);
  grad.addColorStop(1, dark);
  ctx.fillStyle = grad;
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI*2); ctx.fill();
  ctx.strokeStyle = '#0a0a14';
  ctx.lineWidth = Math.max(2, r*0.07);
  ctx.stroke();
  // top shiny highlight
  ctx.fillStyle = 'rgba(255,255,255,0.28)';
  ctx.beginPath();
  ctx.ellipse(-r*0.32, -r*0.5, r*0.4, r*0.18, -0.35, 0, Math.PI*2);
  ctx.fill();
  // cheek blushes (under eyes)
  ctx.fillStyle = 'rgba(255,138,160,0.85)';
  ctx.beginPath(); ctx.arc(-r*0.55, r*0.2, r*0.16, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc( r*0.55, r*0.2, r*0.16, 0, Math.PI*2); ctx.fill();
  // eyes (symmetric)
  const eyeX = r*0.32, eyeY = -r*0.1, eyeR = r*0.3;
  // whites
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(-eyeX, eyeY, eyeR, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc( eyeX, eyeY, eyeR, 0, Math.PI*2); ctx.fill();
  ctx.strokeStyle = '#0a0a14';
  ctx.lineWidth = Math.max(1.5, r*0.045);
  ctx.beginPath(); ctx.arc(-eyeX, eyeY, eyeR, 0, Math.PI*2); ctx.stroke();
  ctx.beginPath(); ctx.arc( eyeX, eyeY, eyeR, 0, Math.PI*2); ctx.stroke();
  // pupils (slightly off-center toward face center — adorable cross-look)
  const pupilR = eyeR * 0.62;
  const pupilOffX = r*0.06, pupilOffY = r*0.04;
  ctx.fillStyle = '#0a0a14';
  ctx.beginPath(); ctx.arc(-eyeX + pupilOffX, eyeY + pupilOffY, pupilR, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc( eyeX - pupilOffX, eyeY + pupilOffY, pupilR, 0, Math.PI*2); ctx.fill();
  // big glint upper-outer of each pupil (symmetric)
  ctx.fillStyle = '#fff';
  const glintR = pupilR * 0.42;
  ctx.beginPath(); ctx.arc(-eyeX - r*0.04, eyeY - r*0.06, glintR, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc( eyeX + r*0.04, eyeY - r*0.06, glintR, 0, Math.PI*2); ctx.fill();
  // tiny secondary glints
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.beginPath(); ctx.arc(-eyeX + r*0.1, eyeY + r*0.1, glintR*0.5, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc( eyeX - r*0.1, eyeY + r*0.1, glintR*0.5, 0, Math.PI*2); ctx.fill();
  // smile
  ctx.strokeStyle = '#2a1010';
  ctx.lineWidth = Math.max(2, r*0.075);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(0, r*0.32, r*0.2, 0.25, Math.PI - 0.25);
  ctx.stroke();
  // antenna with golden bulb (centered for symmetry)
  if (withAntenna) {
    ctx.strokeStyle = '#0a0a14';
    ctx.lineWidth = Math.max(2, r*0.06);
    ctx.beginPath();
    ctx.moveTo(0, -r + r*0.05);
    ctx.quadraticCurveTo(-r*0.04, -r*1.18, 0, -r*1.32);
    ctx.stroke();
    const bulbGrad = ctx.createRadialGradient(-r*0.04, -r*1.38, r*0.02, 0, -r*1.35, r*0.14);
    bulbGrad.addColorStop(0, '#fff5b8');
    bulbGrad.addColorStop(0.5, '#ffd24a');
    bulbGrad.addColorStop(1, '#c08020');
    ctx.fillStyle = bulbGrad;
    ctx.beginPath(); ctx.arc(0, -r*1.42, r*0.14, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle = '#0a0a14';
    ctx.lineWidth = Math.max(1.5, r*0.045);
    ctx.beginPath(); ctx.arc(0, -r*1.42, r*0.14, 0, Math.PI*2); ctx.stroke();
  }
  ctx.restore();
}

const previewCanvas = $('charPreview');
const previewCtx = previewCanvas.getContext('2d');
previewCanvas.width = 360; previewCanvas.height = 460;
function renderPreview() {
  previewCtx.imageSmoothingEnabled = true;
  // background panel
  const bg = previewCtx.createLinearGradient(0, 0, 0, 460);
  bg.addColorStop(0, '#3a2a5a');
  bg.addColorStop(1, '#2a1f44');
  previewCtx.fillStyle = bg;
  previewCtx.fillRect(0,0,360,460);
  // soft floor checker
  previewCtx.fillStyle = '#1f1530';
  for (let y = 380; y < 460; y += 16) {
    for (let x = 0; x < 360; x += 16) {
      if (((x/16)+(y/16))%2===0) previewCtx.fillRect(x, y, 16, 16);
    }
  }
  // floor shadow gradient
  const sh = previewCtx.createLinearGradient(0, 360, 0, 460);
  sh.addColorStop(0, 'rgba(0,0,0,0)');
  sh.addColorStop(1, 'rgba(0,0,0,0.35)');
  previewCtx.fillStyle = sh;
  previewCtx.fillRect(0, 360, 360, 100);
  // character centered, large
  drawCuteCharacter(previewCtx, 180, 240, 220, state.color, !state.hat);
  if (state.hat) {
    previewCtx.save();
    previewCtx.translate(180, 240);
    drawHat(previewCtx, state.hat, 220);
    previewCtx.restore();
    previewCtx.fillStyle = 'rgba(255,210,74,0.8)';
    previewCtx.font = '10px "Press Start 2P", monospace';
    previewCtx.textAlign = 'center';
    previewCtx.fillText('SURUKLE • TEKERLEK = DONDUR', 180, 450);
  }
}
renderPreview();
drawShirt($('shirtIcon').getContext('2d'));

// ===== Hat drag/scale in preview =====
(function () {
  const PR = 110;          // character radius in preview (size 220 / 2)
  const CX = 180, CY = 240;
  let dragging = false;
  let dragStart = null;
  function localCoords(e) {
    const r = previewCanvas.getBoundingClientRect();
    const sx = previewCanvas.width / r.width;
    const sy = previewCanvas.height / r.height;
    return { mx: (e.clientX - r.left) * sx - CX, my: (e.clientY - r.top) * sy - CY };
  }
  previewCanvas.addEventListener('mousedown', e => {
    if (!state.hat) return;
    dragging = true;
    dragStart = { ...localCoords(e), cfg: { ...getHatCfg(state.hat) } };
    e.preventDefault();
  });
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  window.addEventListener('mousemove', e => {
    if (!dragging) return;
    const { mx, my } = localCoords(e);
    const cfg = {
      ...dragStart.cfg,
      ox: clamp(dragStart.cfg.ox + (mx - dragStart.mx) / PR, -1.1, 1.1),
      oy: clamp(dragStart.cfg.oy + (my - dragStart.my) / PR, -2.0, 0.6),
    };
    setHatCfg(state.hat, cfg);
    renderPreview();
  });
  window.addEventListener('mouseup', () => {
    if (!dragging) return;
    dragging = false;
    if (state.hat && state.roomId) {
      const c = getHatCfg(state.hat);
      socket.emit('setHat', { hat: state.hat, cfg: c });
    }
  });
  previewCanvas.addEventListener('wheel', e => {
    if (!state.hat) return;
    e.preventDefault();
    const cfg = getHatCfg(state.hat);
    const dir = e.deltaY > 0 ? 1 : -1;
    cfg.rot = ((cfg.rot || 0) + dir * 0.1) % (Math.PI * 2);
    setHatCfg(state.hat, cfg);
    renderPreview();
    if (state.roomId) socket.emit('setHat', { hat: state.hat, cfg });
  }, { passive: false });
})();

const palette = $('colorPalette');
function addCloseBtn(el) {
  const btn = document.createElement('button');
  btn.className = 'palette-close';
  btn.textContent = 'X';
  btn.addEventListener('click', () => el.classList.add('hidden'));
  el.appendChild(btn);
}
addCloseBtn(palette);
COLORS.forEach(c => {
  const cv = document.createElement('canvas');
  cv.width = 56; cv.height = 70;
  const cctx = cv.getContext('2d');
  cctx.imageSmoothingEnabled = true;
  drawCuteCharacter(cctx, 28, 38, 42, c);
  if (c === state.color) cv.classList.add('selected');
  cv.addEventListener('click', () => {
    state.color = c;
    palette.querySelectorAll('canvas').forEach(x => x.classList.remove('selected'));
    cv.classList.add('selected');
    renderPreview();
    if (state.roomId) socket.emit('changeColor', { color: c });
  });
  palette.appendChild(cv);
});

$('btnWardrobe').addEventListener('click', () => palette.classList.toggle('hidden'));

// ===== Hat picker =====
const hatPalette = $('hatPalette');
function makeHatSwatch(name) {
  const cv = document.createElement('canvas');
  cv.width = 64; cv.height = 64;
  const cctx = cv.getContext('2d');
  cctx.imageSmoothingEnabled = true;
  // mini character with hat preview (no antenna under hat)
  drawCuteCharacter(cctx, 32, 40, 36, state.color, false);
  const img = getHatImg(name);
  const drawHatPreview = () => {
    cctx.save(); cctx.translate(32, 40);
    drawHat(cctx, name, 36);
    cctx.restore();
  };
  if (img.complete && img.naturalWidth > 0) drawHatPreview();
  else img.addEventListener('load', drawHatPreview, { once: true });
  if (state.hat === name) cv.classList.add('selected');
  cv.addEventListener('click', () => {
    state.hat = name;
    localStorage.setItem('gwHat', name);
    hatPalette.querySelectorAll('canvas, .none-opt').forEach(x => x.classList.remove('selected'));
    cv.classList.add('selected');
    renderPreview();
    if (state.roomId) socket.emit('setHat', { hat: name });
  });
  return cv;
}
function loadHats() {
  hatPalette.innerHTML = '';
  addCloseBtn(hatPalette);
  const hint = document.createElement('div');
  hint.className = 'hat-hint';
  hint.textContent = 'SURUKLE = KONUMLA • TEKERLEK = DONDUR';
  hatPalette.appendChild(hint);
  const none = document.createElement('div');
  none.className = 'none-opt';
  none.textContent = 'YOK';
  if (!state.hat) none.classList.add('selected');
  none.addEventListener('click', () => {
    state.hat = '';
    localStorage.setItem('gwHat', '');
    hatPalette.querySelectorAll('canvas, .none-opt').forEach(x => x.classList.remove('selected'));
    none.classList.add('selected');
    renderPreview();
    if (state.roomId) socket.emit('setHat', { hat: '' });
  });
  hatPalette.appendChild(none);
  fetch('/api/hats?t=' + Date.now(), { cache: 'no-store' }).then(r => r.json()).then(list => {
    for (const name of list) hatPalette.appendChild(makeHatSwatch(name));
  }).catch(() => {});
}
loadHats();
$('btnHat').addEventListener('click', () => hatPalette.classList.toggle('hidden'));
applyLang(currentLang);

$('btnPlay').addEventListener('click', () => { show('rooms'); setNetStatus(''); });
$('btnSettings').addEventListener('click', () => show('settings'));
$('btnBack1').addEventListener('click', () => show('menu'));
$('btnBack2').addEventListener('click', () => show('menu'));

function setLang(lang) { applyLang(lang); }
$('btnLangTR').addEventListener('click', () => setLang('tr'));
$('btnLangEN').addEventListener('click', () => setLang('en'));
$('pauseLangTR').addEventListener('click', () => setLang('tr'));
$('pauseLangEN').addEventListener('click', () => setLang('en'));

// ===== Rooms =====
let connecting = false;
function setConnecting(v) {
  connecting = v;
  $('btnCreateRoom').disabled = v;
  $('btnJoinCode').disabled = v;
}

// Game mode selector (rooms screen)
const MODE_HINTS = {
  ffa: 'Son kalan kazanir. Oyuncular birbirine ates eder.',
  survival: 'Co-op: sonsuz canavar dalgalarina karsi birlikte hayatta kal. Canavar oldur, XP topla, seviye atla.',
  imposter: 'Gizli katil(ler) vs masumlar. Masumlar gorev yapar, katil gizlice oldurur. Ceset bul -> rapor -> oylama. (4+ oyuncu onerilir)',
};
document.querySelectorAll('.mode-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    state.mode = btn.dataset.mode;
    document.querySelectorAll('.mode-btn').forEach(b => b.classList.toggle('selected', b === btn));
    const mh = $('modeHint');
    if (mh) mh.textContent = MODE_HINTS[state.mode] || '';
  });
});

$('btnCreateRoom').addEventListener('click', async () => {
  if (connecting) return;
  setConnecting(true);
  setNetStatus(I18N[currentLang].connecting);
  const payload = { name: state.name, color: state.color, cls: state.cls, mapName: state.mapName, mode: state.mode };
  // Custom map: fetch walls from Supabase and ship them inline so server knows them
  if (state.mapName && state.mapName !== 'default') {
    try {
      const walls = await sbGetMap(state.mapName);
      if (Array.isArray(walls)) {
        payload.customMap = stripMeta(walls);
        payload.groundColor = extractGroundColor(walls);
      }
    } catch (e) { console.warn('[maps] getMap failed:', e.message); }
  }
  socket.emit('createRoom', payload, (res) => {
    setConnecting(false);
    setNetStatus('');
    if (res && res.ok) {
      state.isHost = true;
      state.selfId = socket.id;
      enterLobby(res.roomId, res.ownerId);
      if (state.hat) socket.emit('setHat', { hat: state.hat, cfg: getHatCfg(state.hat) });
      if (res.room) renderLobby(res.room);
    } else {
      alert((res && res.error) || 'Bağlanılamadı');
    }
  });
});

$('btnJoinCode').addEventListener('click', () => {
  if (connecting) return;
  const code = $('joinCode').value.trim().toUpperCase();
  if (code) joinRoom(code);
});

function joinRoom(code) {
  setConnecting(true);
  setNetStatus(I18N[currentLang].connecting);
  socket.emit('joinRoom', { roomId: code, name: state.name, color: state.color, cls: state.cls }, (res) => {
    setConnecting(false);
    setNetStatus('');
    if (res && res.ok) {
      state.isHost = false;
      state.selfId = res.selfId || socket.id;
      enterLobby(res.roomId, res.ownerId);
      if (state.hat) socket.emit('setHat', { hat: state.hat, cfg: getHatCfg(state.hat) });
      if (res.room) renderLobby(res.room);
    } else {
      alert((res && res.error) || 'Bağlanılamadı');
    }
  });
}

function renderLobby(room) {
  state.ownerId = room.ownerId;
  if (room.mapName) state.mapName = room.mapName;
  const root = $('lobbyPlayers');
  root.innerHTML = '';
  room.players.forEach(p => {
    const chip = document.createElement('div');
    chip.className = 'player-chip';
    const cinfo = CLASS_INFO[p.cls] || { label: p.cls || '?', color: '#fff' };
    chip.innerHTML =
      `<span class="swatch" style="background:${p.color}"></span>` +
      `<span>${p.name}${p.id===room.ownerId?' (host)':''}</span>` +
      `<span class="cls-tag" style="color:${cinfo.color}">[${cinfo.label}]</span>`;
    root.appendChild(chip);
  });
  const isHost = room.ownerId === socket.id;
  $('btnStart').classList.toggle('hidden', !isHost);
  $('waitMsg').classList.toggle('hidden', isHost);
  const mapEl = $('lobbyMap');
  if (mapEl) {
    const modeLabel = room.mode === 'survival' ? 'HAYATTA KALMA 🧟'
                    : room.mode === 'imposter' ? 'KATIL (AMONG) 🔪' : 'HERKESE KARSI';
    mapEl.textContent = 'Mod: ' + modeLabel + '  •  Harita: ' + (room.mapName || 'default');
  }
}

function enterLobby(roomId, ownerId) {
  state.roomId = roomId; state.ownerId = ownerId;
  $('lobbyCode').textContent = roomId;
  const cm = $('chatMessages'); if (cm) cm.innerHTML = '';
  $('lobbyStatus').textContent = state.isHost
    ? 'Oda aktif. Kodu arkadaşına ver, sonra BASLAT.'
    : 'Lobiye bağlandın. Host başlatmasını bekle.';
  show('lobby');
}

$('btnLeave').addEventListener('click', () => {
  socket.emit('leaveRoom');
  state.roomId = null; state.ownerId = null; state.isHost = false;
  show('menu');
});
$('btnStart').addEventListener('click', () => socket.emit('startGame'));

function _sendChat() {
  const input = $('chatInput');
  const text = (input.value || '').trim();
  if (!text || !state.roomId) return;
  socket.emit('lobbyChat', { text });
  input.value = '';
}
$('btnChatSend').addEventListener('click', _sendChat);
$('chatInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); _sendChat(); }
});
socket.on('lobbyChat', ({name, color, text}) => {
  const box = $('chatMessages');
  if (!box) return;
  const div = document.createElement('div');
  div.className = 'msg';
  const who = document.createElement('span');
  who.className = 'who';
  who.style.color = color || '#ffd24a';
  who.textContent = (name || '?') + ':';
  div.appendChild(who);
  div.appendChild(document.createTextNode(' ' + text));
  box.appendChild(div);
  while (box.children.length > 60) box.removeChild(box.firstChild);
  box.scrollTop = box.scrollHeight;
});

let _pendingLobbyRoom = null;
let _lobbyRaf = 0;
socket.on('roomUpdate', (room) => {
  if (!state.roomId || room.id !== state.roomId) return;
  // Coalesce rapid updates (e.g. hat resize wheel spam) into one render per frame
  _pendingLobbyRoom = room;
  if (!_lobbyRaf) {
    _lobbyRaf = requestAnimationFrame(() => {
      _lobbyRaf = 0;
      const r = _pendingLobbyRoom; _pendingLobbyRoom = null;
      if (r) renderLobby(r);
    });
  }
});

socket.on('hostDisconnected', () => {
  if (!state.roomId) return;
  alert('Host bağlantıyı kesti');
  state.roomId = null; state.ownerId = null; state.isHost = false;
  state.inGame = false; state.serverState = null;
  $('pauseMenu').classList.add('hidden');
  $('roundEnd').classList.add('hidden');
  $('dead').classList.add('hidden');
  show('menu');
});

// ===== Game =====
const gameCanvas = $('gameCanvas');
const gctx = gameCanvas.getContext('2d');
let camX = 0, camY = 0;
function resize() {
  gameCanvas.width = window.innerWidth;
  gameCanvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

const keys = { w:false,a:false,s:false,d:false };
let mouseX = 0, mouseY = 0, leftDown = false, rightDown = false, middleDown = false;

window.addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  if (k in keys) keys[k] = true;
  if (state.inGame && state.mode === 'imposter') {
    // ignore movement/actions while a modal (meeting/task/role) is open
    const modalOpen = !$('meetingModal').classList.contains('hidden') ||
                      !$('taskModal').classList.contains('hidden') ||
                      !$('roleReveal').classList.contains('hidden');
    if (e.key === 'Escape') { togglePause(); e.preventDefault(); return; }
    if (modalOpen) return;
    if (k === 'e') impUse();
    else if (k === 'q') socket.emit('impKill');
    else if (k === 'r') socket.emit('impReport');
    else if (k === 'f') impVentToggle();
    else if (k === 'g') impToggleSaboMenu();
    return;
  }
  if (k === 'r' && state.inGame) {
    const me = state.serverState && state.serverState.players.find(p => p.id === socket.id);
    if (me && me.alive && !me.reloading && me.ammo < (me.maxAmmo || 30)) {
      socket.emit('reload');
    }
  }
  if (k === 'b' && state.inGame) socket.emit('placeTurret');
  if (k === 'v' && state.inGame) socket.emit('placePet');
  if (k === 'c' && state.inGame && state.serverState) {
    const me = state.serverState.players.find(p => p.id === socket.id);
    if (me && me.alive && me.cls === 'engineer') {
      socket.emit('moveTurret', { x: mouseX + camX, y: mouseY + camY });
    } else if (me && me.alive && me.cls === 'sniper') {
      socket.emit('knifeSwing');
    }
  }
  if (e.key === 'Escape' && state.inGame) { togglePause(); e.preventDefault(); }
});
window.addEventListener('keyup', e => {
  const k = e.key.toLowerCase();
  if (k in keys) keys[k] = false;
});
gameCanvas.addEventListener('mousemove', e => {
  const r = gameCanvas.getBoundingClientRect();
  mouseX = e.clientX - r.left; mouseY = e.clientY - r.top;
});
gameCanvas.addEventListener('mousedown', e => {
  if (e.button === 0) leftDown = true;
  if (e.button === 2) { rightDown = true; e.preventDefault(); }
  if (e.button === 1) {
    middleDown = true;
    if (state.inGame && state.serverState) {
      const me = state.serverState.players.find(p => p.id === socket.id);
      if (me && me.alive && me.cls === 'engineer') {
        socket.emit('moveTurret', { x: mouseX + camX, y: mouseY + camY });
      } else if (me && me.alive && me.cls === 'sniper') {
        socket.emit('knifeSwing');
      }
    }
    e.preventDefault();
  }
});
window.addEventListener('mouseup', e => {
  if (e.button === 0) leftDown = false;
  if (e.button === 2) rightDown = false;
  if (e.button === 1) middleDown = false;
});
gameCanvas.addEventListener('contextmenu', e => e.preventDefault());
gameCanvas.addEventListener('auxclick', e => { if (e.button === 1) e.preventDefault(); });

function computeAngle() {
  // Use real server state (not interpolated) for aim so server knows
  // accurate angle at the time of the input packet.
  const ss = state.serverState;
  if (!ss) return 0;
  const me = ss.players.find(p => p.id === socket.id);
  if (!me) return 0;
  const sx = me.x - camX, sy = me.y - camY;
  return Math.atan2(mouseY - sy, mouseX - sx);
}

function syncVolume(v) {
  AUD.setVolume(v);
  localStorage.setItem('gwVol', String(v));
  $('setVolume').value = Math.round(v * 100);
  $('pauseVolume').value = Math.round(v * 100);
}
function syncMusicVolume(v) {
  v = Math.max(0, Math.min(1, v));
  localStorage.setItem('gwMusicVol', String(v));
  if (bgMusic) bgMusic.volume = v;
  $('setMusicVolume').value = Math.round(v * 100);
  $('pauseMusicVolume').value = Math.round(v * 100);
}
$('setVolume').addEventListener('input', (e) => syncVolume(parseInt(e.target.value,10)/100));
$('pauseVolume').addEventListener('input', (e) => syncVolume(parseInt(e.target.value,10)/100));
$('setMusicVolume').addEventListener('input', (e) => syncMusicVolume(parseInt(e.target.value,10)/100));
$('pauseMusicVolume').addEventListener('input', (e) => syncMusicVolume(parseInt(e.target.value,10)/100));
// Restore saved
(function () {
  const v = parseFloat(localStorage.getItem('gwVol'));
  if (!isNaN(v)) syncVolume(v);
  const mv = parseFloat(localStorage.getItem('gwMusicVol'));
  syncMusicVolume(isNaN(mv) ? 0.25 : mv);
})();

// Music mute toggle (saved across sessions)
function applyMute(m) {
  AUD.setMusicMute(m);
  if (bgMusic) {
    bgMusic.muted = m;
    // If unmuting and we haven't started playing yet, start now
    if (!m && AUD.started) bgMusic.play().catch(() => {});
  }
  localStorage.setItem('gwMute', m ? '1' : '0');
  for (const id of ['btnMute','pauseMute']) {
    const el = $(id);
    if (el) el.textContent = m ? '🎵 KAPALI' : '🎵 ACIK';
  }
}
applyMute(localStorage.getItem('gwMute') === '1');
const btnMute = $('btnMute'); if (btnMute) btnMute.addEventListener('click', () => applyMute(!AUD.muted));
const pauseMute = $('pauseMute'); if (pauseMute) pauseMute.addEventListener('click', () => applyMute(!AUD.muted));

function togglePause() { $('pauseMenu').classList.toggle('hidden'); }
$('btnResume').addEventListener('click', togglePause);
$('btnLeaveGame').addEventListener('click', () => {
  socket.emit('leaveRoom');
  state.roomId = null; state.ownerId = null; state.isHost = false;
  state.inGame = false; state.serverState = null;
  $('pauseMenu').classList.add('hidden');
  $('roundEnd').classList.add('hidden');
  $('dead').classList.add('hidden');
  show('menu');
});

// Input loop: ~50 Hz for responsive controls
setInterval(() => {
  if (!state.inGame) return;
  // Imposter mode: freeze movement while a modal (meeting/task/role) is open
  if (state.mode === 'imposter') {
    const modalOpen = !$('meetingModal').classList.contains('hidden') ||
                      !$('taskModal').classList.contains('hidden') ||
                      !$('roleReveal').classList.contains('hidden') ||
                      !$('pauseMenu').classList.contains('hidden');
    socket.emit('input', { keys: modalOpen ? {w:false,a:false,s:false,d:false} : keys, angle: 0 });
    return;
  }
  socket.emit('input', { keys, angle: computeAngle(), leftDown, rightDown });
  if (middleDown && state.serverState) {
    const me = state.serverState.players.find(p => p.id === socket.id);
    if (me && me.alive && me.cls === 'engineer') {
      socket.emit('moveTurret', { x: mouseX + camX, y: mouseY + camY });
    }
  }
}, 20);

// Footstep sounds
let lastStepAt = 0;
setInterval(() => {
  if (!state.inGame || !state.serverState) return;
  const me = state.serverState.players.find(p => p.id === socket.id);
  if (!me || !me.alive) return;
  if (!(keys.w||keys.a||keys.s||keys.d)) return;
  const now = Date.now();
  if (now - lastStepAt > 330) { AUD.step(); lastStepAt = now; }
}, 160);

// ===== Socket events =====
socket.on('roundStart', (data) => {
  state.walls = data.walls;
  state.mapW = data.mapW; state.mapH = data.mapH;
  state.groundColor = data.groundColor || '#4a6a3a';
  state.mode = data.mode || 'ffa';
  state.endsAt = data.endsAt;
  state.inGame = true; state.killfeed = [];
  state.cyberAnchor = Date.now();
  lastAmmo = null; wasReloading = false;
  $('dead').classList.add('hidden');
  $('roundEnd').classList.add('hidden');
  $('perkModal').classList.add('hidden');
  // Imposter mode: store map metadata, toggle its HUD, hide FFA HUD bits
  const isImp = state.mode === 'imposter';
  $('hud').classList.toggle('hidden', isImp);
  $('impHud').classList.toggle('hidden', !isImp);
  if (isImp) {
    state.imp = { map: data.imp || {}, role: null, tasks: [], teammates: [], st: null };
    impCloseAllModals();
  } else {
    state.imp = null;
  }
  rebuildGroundCache();
  show('game');
});

socket.on('wallBroken', ({id}) => {
  const i = state.walls.findIndex(w => w.id === id);
  if (i >= 0) {
    const w = state.walls[i];
    state.walls.splice(i, 1);
    patchGroundCache(w.x, w.y, w.w, w.h);
  }
});

// ===== Client-side interpolation buffer =====
// We keep the last two server states + their arrival timestamps.
// The render loop interpolates player positions between them so that
// even at 25ms server updates, movement looks 60fps-smooth.
const interpBuf = { prev: null, prevAt: 0, cur: null, curAt: 0 };

// Render delay: we intentionally look at the world 40ms in the past so we
// always have two bracketing server snapshots to interpolate between.
// Without this delay, performance.now() > curAt always → t >= 1 always →
// interpolation never fires → positions snap every server tick.
const INTERP_BUFFER_MS = 40;

// Mutates `cur` in place: writes interpolated x/y onto each player and
// returns `cur` directly. Avoids per-frame allocation of a new snapshot
// + per-player spread, which were causing GC pauses ("freeze") at 60fps.
// The cur snapshot is only used by the renderer this frame, then the next
// 'state' event replaces it entirely — mutation is safe.
function getInterpState() {
  if (!interpBuf.cur) return state.serverState;
  if (!interpBuf.prev) return interpBuf.cur;
  const dt = interpBuf.curAt - interpBuf.prevAt;
  if (dt <= 0) return interpBuf.cur;
  const renderTime = performance.now() - INTERP_BUFFER_MS;
  const t = (renderTime - interpBuf.prevAt) / dt;
  if (t <= 0) return interpBuf.prev;
  if (t >= 1) return interpBuf.cur;
  if (!interpBuf._prevMap) {
    interpBuf._prevMap = new Map();
    for (const p of interpBuf.prev.players) interpBuf._prevMap.set(p.id, p);
  }
  const prevMap = interpBuf._prevMap;
  const players = interpBuf.cur.players;
  for (let i = 0; i < players.length; i++) {
    const cp = players[i];
    if (cp._baseX === undefined) { cp._baseX = cp.x; cp._baseY = cp.y; }
    const pp = prevMap.get(cp.id);
    if (!pp || !pp.alive || !cp.alive) continue;
    cp.x = pp.x + (cp._baseX - pp.x) * t;
    cp.y = pp.y + (cp._baseY - pp.y) * t;
  }
  return interpBuf.cur;
}

let lastAmmo = null, wasReloading = false, lastRocketCount = 0;
const _lastAmmoMap = new Map(); // playerId → last seen ammo
const _lastHp = new Map();        // player id → last seen hp
const damageNumbers = [];         // { id, dmg, t }
socket.on('state', (s) => {
  // Track server-client clock offset so absolute server timestamps stay accurate
  if (typeof s.t === 'number') {
    const off = s.t - Date.now();
    state.serverTimeOffset = state.serverTimeOffset == null ? off : state.serverTimeOffset * 0.9 + off * 0.1;
  }
  // Advance interpolation buffer; clear cached prevMap so it rebuilds next frame
  interpBuf.prev = interpBuf.cur;
  interpBuf.prevAt = interpBuf.curAt;
  interpBuf._prevMap = null;
  interpBuf.cur = s;
  interpBuf.curAt = performance.now();

  state.serverState = s;
  state.endsAt = s.endsAt;
  // Detect HP drops on all players → spawn floating damage numbers
  for (const p of s.players) {
    const prev = _lastHp.get(p.id);
    if (prev !== undefined && p.alive && p.hp < prev) {
      damageNumbers.push({ id: p.id, dmg: prev - p.hp, t: Date.now(), seed: Math.random() });
    }
    _lastHp.set(p.id, p.alive ? p.hp : (p.maxHp || 10));
  }
  const me = s.players.find(p => p.id === socket.id);
  if (me) {
    if (state.cls === 'cyber' && me.rockets > lastRocketCount) state.cyberAnchor = Date.now();
    lastRocketCount = me.rockets;
    if (me.reloading && !wasReloading) AUD.reload();
    wasReloading = me.reloading;
  }
  // Per-player gunshot audio with distance-based volume falloff
  for (const p of s.players) {
    const prevA = _lastAmmoMap.get(p.id);
    if (prevA !== undefined && typeof p.ammo === 'number' && p.ammo < prevA) {
      let volMul = 1;
      if (me && p.id !== me.id) {
        const dx = p.x - me.x, dy = p.y - me.y;
        const dist = Math.hypot(dx, dy);
        const MAX_HEAR = 1200;
        volMul = Math.max(0, 1 - dist / MAX_HEAR);
        volMul = volMul * volMul; // quadratic falloff
      }
      if (p.cls === 'pyro') {
        _pyroFireTrigger(p.id, volMul);
      } else {
        const shots = Math.min(prevA - p.ammo, 6); // cap per-frame burst to avoid audio storm
        for (let i = 0; i < shots; i++) AUD.shoot(volMul);
      }
    }
    if (typeof p.ammo === 'number') _lastAmmoMap.set(p.id, p.ammo);
  }
  if (me) lastAmmo = me.ammo;
  // Hygiene (every ~2s): drop tracking entries for players no longer in state
  _hygieneCounter = (_hygieneCounter + 1) % 40;
  if (_hygieneCounter === 0) {
    const ids = new Set(s.players.map(p => p.id));
    for (const id of _lastAmmoMap.keys()) if (!ids.has(id)) _lastAmmoMap.delete(id);
    for (const id of _pyroFireAudios.keys()) {
      if (!ids.has(id)) {
        const e = _pyroFireAudios.get(id);
        try { e.audio.pause(); } catch {}
        clearTimeout(e.stopId);
        _pyroFireAudios.delete(id);
      }
    }
  }
});
let _hygieneCounter = 0;

socket.on('heal', ({ id, amount }) => {
  if (!amount) return;
  damageNumbers.push({ id, dmg: -amount, t: Date.now(), seed: Math.random() });
});

socket.on('powerup', ({ id, type }) => {
  // Rising 3-note arpeggio when anyone grabs a power-up (louder for self).
  if (AUD.ctx && !AUD.muted) {
    const t = AUD.ctx.currentTime + 0.01;
    const self = id === socket.id;
    const base = type === 'damage' ? 60 : (type === 'shield' ? 64 : 67);
    const gain = self ? 0.28 : 0.12;
    [0, 4, 7].forEach((semi, i) => {
      AUD.playNote(base + semi, t + i * 0.06, 0.18, 'square', AUD.sfxGain, gain);
    });
  }
  if (id === socket.id) {
    const label = type === 'speed' ? '⚡ HIZ' : (type === 'damage' ? '⨯2 HASAR' : '🛡 KALKAN');
    state.killfeed.unshift({ killer: '', victim: '', t: Date.now(), note: label });
    if (state.killfeed.length > 6) state.killfeed.pop();
  }
});

socket.on('kill', ({ killer, victim }) => {
  state.killfeed.unshift({ killer, victim, t: Date.now() });
  if (state.killfeed.length > 6) state.killfeed.pop();
});

socket.on('levelUp', ({ id, level }) => {
  if (id !== socket.id) return;
  if (AUD.ctx && !AUD.muted) {
    const t = AUD.ctx.currentTime + 0.01;
    [60, 64, 67, 72].forEach((midi, i) => {
      AUD.playNote(midi, t + i * 0.07, 0.2, 'square', AUD.sfxGain, 0.3);
    });
  }
  state.killfeed.unshift({ note: '⭐ SEVIYE ' + level, t: Date.now() });
  if (state.killfeed.length > 6) state.killfeed.pop();
});

// Survival: server offers 3 perks to choose from on level-up.
socket.on('levelUpChoices', ({ choices, level }) => {
  const modal = $('perkModal');
  const cards = $('perkCards');
  const lvlEl = $('perkLevel');
  if (!modal || !cards) return;
  if (lvlEl) lvlEl.textContent = level ? ('LV ' + level) : '';
  cards.innerHTML = '';
  (choices || []).forEach(c => {
    const btn = document.createElement('button');
    btn.className = 'perk-card';
    btn.innerHTML = `<div class="perk-icon">${c.icon || '⭐'}</div>`
      + `<div class="perk-name">${c.name}</div>`
      + `<div class="perk-desc">${c.desc}</div>`;
    btn.onclick = () => {
      socket.emit('pickPerk', { id: c.id });
      modal.classList.add('hidden');
    };
    cards.appendChild(btn);
  });
  modal.classList.remove('hidden');
  if (AUD.ctx && !AUD.muted) {
    const t = AUD.ctx.currentTime + 0.01;
    [72, 76, 79].forEach((midi, i) => AUD.playNote(midi, t + i * 0.06, 0.18, 'square', AUD.sfxGain, 0.25));
  }
});

// Survival: a player came back from the dead.
socket.on('respawn', ({ id }) => {
  if (id === socket.id) $('dead').classList.add('hidden');
});
// Survival: revival passive (Tiragisú) triggered.
socket.on('revive', ({ id }) => {
  if (id === socket.id) {
    $('dead').classList.add('hidden');
    state.killfeed.unshift({ note: '🍰 DIRILDIN!', t: Date.now() });
    if (state.killfeed.length > 6) state.killfeed.pop();
  }
});

// Survival: special pickup collected.
socket.on('survItem', ({ type }) => {
  if (AUD.ctx && !AUD.muted) {
    const t = AUD.ctx.currentTime + 0.01;
    const notes = type === 'bomb' ? [48, 43, 36] : [72, 79, 84];
    notes.forEach((n, i) => AUD.playNote(n, t + i*0.06, 0.2, 'square', AUD.sfxGain, 0.3));
  }
  const label = type === 'chicken' ? '🍗 CAN DOLDU' : (type === 'magnet' ? '🧲 XP TOPLANDI' : (type === 'clock' ? '⏱️ ZAMAN DURDU' : '💣 EKRAN TEMIZLENDI'));
  state.killfeed.unshift({ note: label, t: Date.now() });
  if (state.killfeed.length > 6) state.killfeed.pop();
});
// Survival: boss appeared.
socket.on('bossSpawn', () => {
  if (AUD.ctx && !AUD.muted) {
    const t = AUD.ctx.currentTime + 0.01;
    [36, 36, 39].forEach((n, i) => AUD.playNote(n, t + i*0.12, 0.4, 'sawtooth', AUD.sfxGain, 0.3));
  }
  state.killfeed.unshift({ note: '👑 BOSS GELDI!', t: Date.now() });
  if (state.killfeed.length > 6) state.killfeed.pop();
});

// Survival: whip slash visual effect.
const whips = [];
socket.on('whip', (d) => { whips.push({ ...d, t: Date.now() }); if (whips.length > 20) whips.shift(); });
function drawWhips() {
  const now = Date.now();
  for (let i = whips.length-1; i >= 0; i--) {
    const wp = whips[i]; const age = now - wp.t;
    if (age > 160) { whips.splice(i, 1); continue; }
    const a = 1 - age/160;
    const x = wp.x - camX, y = wp.y - camY;
    gctx.fillStyle = `rgba(255,255,255,${a*0.5})`;
    gctx.fillRect(x - wp.w, y - wp.h*0.5, wp.w*2, wp.h);
    gctx.strokeStyle = `rgba(255,230,160,${a})`; gctx.lineWidth = 3;
    gctx.beginPath(); gctx.moveTo(x - wp.w, y); gctx.lineTo(x + wp.w, y); gctx.stroke();
  }
}
// Survival: time-freeze (Clock pickup) — tint screen while active.
let freezeUntil = 0;
socket.on('freeze', ({ ms }) => { freezeUntil = Date.now() + (ms || 3000); });

// Survival: chain-lightning visual effect.
const zaps = [];
socket.on('zap', ({ from, hits }) => {
  zaps.push({ from, hits, t: Date.now() });
  if (zaps.length > 40) zaps.shift();
});
function drawZaps() {
  const now = Date.now();
  for (let i = zaps.length-1; i >= 0; i--) {
    const z = zaps[i]; const age = now - z.t;
    if (age > 220) { zaps.splice(i, 1); continue; }
    const a = 1 - age/220;
    const path = () => {
      gctx.beginPath();
      gctx.moveTo(z.from[0]-camX, z.from[1]-camY);
      for (const h of z.hits) gctx.lineTo(h[0]-camX, h[1]-camY);
      gctx.stroke();
    };
    gctx.strokeStyle = `rgba(120,200,255,${a})`; gctx.lineWidth = 4; path();
    gctx.strokeStyle = `rgba(255,255,255,${a})`; gctx.lineWidth = 1.3; path();
  }
}

socket.on('roundEnd', ({ board, winner, mode, survivalMs, winnerSide, roles }) => {
  state.inGame = false;
  $('perkModal').classList.add('hidden');
  $('roundEnd').classList.remove('hidden');
  const d = I18N[currentLang];
  if (mode === 'imposter') {
    impCloseAllModals();
    $('winnerLine').textContent = winnerSide === 'imposter' ? '🔪 KATILLER KAZANDI' : '🛠️ MASUMLAR KAZANDI';
    const fb = $('finalBoard'); fb.innerHTML = '';
    (roles || []).forEach(r => {
      const div = document.createElement('div'); div.className = 'row';
      const tag = r.role === 'imposter' ? '<span style="color:#ff3b50">KATIL</span>' : '<span style="color:#4ad2ff">MASUM</span>';
      div.innerHTML = `<span style="color:${r.color}">${r.name}</span>${tag}`;
      fb.appendChild(div);
    });
    return;
  }
  if (mode === 'survival') {
    const mm = Math.floor((survivalMs||0)/60000);
    const sec = Math.floor(((survivalMs||0)%60000)/1000);
    const totalKills = board.reduce((s, p) => s + (p.kills||0), 0);
    $('winnerLine').textContent = `Hayatta kalinan sure: ${String(mm).padStart(2,'0')}:${String(sec).padStart(2,'0')}  •  ${totalKills} canavar`;
  } else {
    $('winnerLine').textContent = winner
      ? `${d.winner}: ${winner.name} (${winner.kills} ${d.kills})`
      : d.noWinner;
  }
  const fb = $('finalBoard');
  fb.innerHTML = '';
  board.forEach(p => {
    const div = document.createElement('div');
    div.className = 'row';
    const stat = mode === 'survival'
      ? `${p.kills} canavar · LV${p.level||1}`
      : `${p.kills} ${d.kills}`;
    div.innerHTML = `<span style="color:${p.color}">${p.name}</span><span>${stat}</span>`;
    fb.appendChild(div);
  });
});

// ===== HUD + Render =====
let lastHUDAt = 0;
let lastKillfeedLen = -1, lastBoardKey = '';
function renderHUD() {
  const ss = state.serverState;
  if (!ss) return;
  const now = Date.now();
  if (now - lastHUDAt < 100) return; // throttle DOM updates to ~10Hz
  lastHUDAt = now;
  const me = ss.players.find(p => p.id === socket.id);
  // Timer: survival counts UP (time survived); FFA counts DOWN (round time left)
  let shown;
  if (ss.mode === 'survival') {
    shown = Math.max(0, ss.survivalMs || 0);
  } else if (typeof ss.msLeft === 'number') {
    shown = Math.max(0, ss.msLeft);
  } else {
    const off = state.serverTimeOffset || 0;
    shown = Math.max(0, state.endsAt - (Date.now() + off));
  }
  const mm = Math.floor(shown/60000);
  const sec = Math.floor((shown%60000)/1000);
  $('timer').textContent = String(mm).padStart(2,'0')+':'+String(sec).padStart(2,'0');
  // hp bar (current life HP)
  const hp = me ? Math.max(0, me.hp) : 0;
  const maxHp = me && me.maxHp ? me.maxHp : 10;
  $('hpfill').style.width = Math.min(100, hp/maxHp*100) + '%';
  const hpR = Math.round(hp * 10) / 10;
  $('hptext').textContent = (Number.isInteger(hpR) ? hpR : hpR.toFixed(1)) + ' / ' + maxHp;
  // dead overlay (survival shows a respawn countdown instead of elimination)
  const deadEl = $('dead');
  if (me && !me.alive && ss.mode === 'survival') {
    deadEl.classList.remove('hidden');
    const secs = Math.ceil((me.respawnIn || 0) / 1000);
    deadEl.textContent = secs > 0 ? ('OLDUN — ' + secs + 's sonra dirilis') : 'DIRILIYOR...';
  } else {
    deadEl.classList.toggle('hidden', !me || me.alive);
    if (me && me.alive) deadEl.textContent = 'ELENDIN';
  }
  // ammo (bullets) — rockets shown separately (right click)
  if (me) {
    if (me.cls === 'pyro') {
      $('ammoCur').textContent = me.reloading ? '...' : '🔥' + me.ammo;
      const maxEl = $('ammo').querySelector('.max');
      if (maxEl) maxEl.textContent = '/' + (me.maxAmmo || 50);
      $('ammo').classList.toggle('reloading', !!me.reloading);
    } else {
      $('ammoCur').textContent = me.reloading ? '...' : me.ammo;
      const maxEl = $('ammo').querySelector('.max');
      if (maxEl) maxEl.textContent = '/' + (me.maxAmmo || 30);
      $('ammo').classList.toggle('reloading', !!me.reloading);
    }
  }
  // rocket count badge
  const rb = $('rocketBadge');
  if (rb) {
    if (me && me.rockets > 0) { rb.textContent = '🚀 ' + me.rockets + '  (R-CLICK)'; rb.classList.remove('hidden'); }
    else rb.classList.add('hidden');
  }
  // class ability cooldown
  const ab = $('abilityBtn');
  if (ab && me) {
    let label = '', ready = false, action = null;
    if (me.cls === 'engineer') {
      const rem = me.turretReadyIn || 0;
      ready = rem === 0; action = 'placeTurret';
      label = ready ? 'TARET KOY (B)' : 'TARET ' + Math.ceil(rem/1000) + 's';
    } else if (me.cls === 'medic') {
      const rem = me.petReadyIn || 0;
      ready = rem === 0; action = 'placePet';
      label = ready ? 'PET KOY (V)' : 'PET ' + Math.ceil(rem/1000) + 's';
    } else if (me.cls === 'cyber') {
      const rem = me.cyberReadyIn || 0;
      label = 'FUZE ' + Math.ceil(rem/1000) + 's';
    } else if (me.cls === 'tank') {
      label = me.tank ? 'TANK ' + Math.ceil((me.tankRemaining||0)/1000) + 's' : 'KILLS ' + (me.tankKills||0) + '/3';
    } else if (me.cls === 'pyro') {
      label = '🔥 ALEV';
    } else if (me.cls === 'sniper') {
      label = '🔪 BICAK (orta tuş)';
    }
    if (label) {
      ab.textContent = label;
      ab.classList.remove('hidden');
      ab.dataset.action = action || '';
      ab.classList.toggle('ready', ready);
    } else ab.classList.add('hidden');
  }
  // leaderboard — only rebuild if scores changed
  const sorted = [...ss.players].sort((a,b)=>b.kills-a.kills);
  const boardKey = sorted.map(p => p.id+':'+p.kills+':'+(p.alive?1:0)).join('|');
  if (boardKey !== lastBoardKey) {
    lastBoardKey = boardKey;
    let html = `<h4>${I18N[currentLang].leaderboard}</h4>`;
    sorted.forEach(p => {
      html += `<div class="row" style="color:${p.alive?'#f0e8d8':'#777'}"><span>${p.name}</span><span>${p.kills}</span></div>`;
    });
    $('leaderboard').innerHTML = html;
  }
  // killfeed — only rebuild if list size changed
  if (state.killfeed.length !== lastKillfeedLen) {
    lastKillfeedLen = state.killfeed.length;
    const kf = $('killfeed');
    kf.innerHTML = '';
    state.killfeed.forEach(k => {
      const d = document.createElement('div');
      d.textContent = k.note ? k.note : `${k.killer} > ${k.victim}`;
      kf.appendChild(d);
    });
  }
}

// Texture loader: each image is downscaled into a tile then turned into a
// repeating CanvasPattern. Per-kind tile size lets chunky pixel-art bricks
// stay readable while smaller noise textures (wood/rust) stay tight.
const TEXTURES = {};
function loadTexture(key, src, tileSize) {
  const ts = tileSize || 64;
  const img = new Image();
  img.onload = () => {
    const tile = document.createElement('canvas');
    tile.width = ts; tile.height = ts;
    const tctx = tile.getContext('2d');
    tctx.imageSmoothingEnabled = false;
    tctx.drawImage(img, 0, 0, ts, ts);
    TEXTURES[key] = { img, tile, pattern: tctx.createPattern(tile, 'repeat') };
    if (state.inGame) rebuildGroundCache();
  };
  img.onerror = () => console.warn('[tex]', key, 'failed:', src);
  img.src = src;
}
loadTexture('stone', 'stone.webp', 160); // chunky brick — preserve detail
loadTexture('wood',  'wood.jpg',   64);
loadTexture('brick', 'brick.jpg',  96);
loadTexture('mesh',  'rusty.png',  64);
loadTexture('water', 'water.png',  64);

function drawTree(ctx, x, y, w, h) {
  // foliage circle + trunk; sized to the cell rect
  const cx = x + w/2, cy = y + h/2;
  const fr = Math.min(w, h) * 0.46;
  // shadow
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath(); ctx.ellipse(cx+2, y+h-4, fr*0.85, fr*0.35, 0, 0, Math.PI*2); ctx.fill();
  // trunk
  const tw = Math.max(4, Math.floor(w*0.18));
  ctx.fillStyle = '#3a2010'; ctx.fillRect(Math.floor(cx-tw/2), Math.floor(cy), tw, Math.floor(h*0.45));
  ctx.fillStyle = '#5a3018'; ctx.fillRect(Math.floor(cx-tw/2), Math.floor(cy), 2, Math.floor(h*0.45));
  // foliage (3 stacked circles for pixelart look)
  ctx.fillStyle = '#1a3a14'; ctx.beginPath(); ctx.arc(cx, cy-2, fr, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#2a5a20'; ctx.beginPath(); ctx.arc(cx-fr*0.25, cy-fr*0.3, fr*0.78, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#4a8a30'; ctx.beginPath(); ctx.arc(cx-fr*0.4, cy-fr*0.5, fr*0.45, 0, Math.PI*2); ctx.fill();
  // highlight pixel
  ctx.fillStyle = '#7ad24a'; ctx.fillRect(Math.floor(cx-fr*0.5), Math.floor(cy-fr*0.6), 3, 3);
}

function drawWall(ctx, x, y, w, h, kind) {
  if (kind === 'tree') { drawTree(ctx, x, y, w, h); return; }
  if (kind === 'water') { drawWater(ctx, x, y, w, h); return; }
  const s = WALL_STYLES[kind] || WALL_STYLES.stone;
  const tex = TEXTURES[kind];
  if (tex && tex.pattern) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = tex.pattern;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
    // chunky 3D bevel on top
    ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(x, y, w, 2); ctx.fillRect(x, y, 2, h);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';       ctx.fillRect(x, y+h-2, w, 2); ctx.fillRect(x+w-2, y, 2, h);
    return;
  }
  // Procedural fallback (used until images load, or for kinds without textures)
  ctx.fillStyle = s.base; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = s.light; ctx.fillRect(x, y, w, 3); ctx.fillRect(x, y, 3, h);
  ctx.fillStyle = s.dark;  ctx.fillRect(x, y+h-3, w, 3); ctx.fillRect(x+w-3, y, 3, h);
  ctx.fillStyle = s.dark;
  for (let bx = 12; bx < w-4; bx += 16) ctx.fillRect(x+bx, y+3, 1, h-6);
}

function drawWater(ctx, x, y, w, h) {
  const tex = TEXTURES.water;
  if (tex && tex.pattern) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = tex.pattern;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  } else {
    ctx.fillStyle = '#2a6a9a'; ctx.fillRect(x, y, w, h);
  }
  // Soft dark edge so water reads as a sunken area
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(x, y, w, 2); ctx.fillRect(x, y, 2, h);
  ctx.fillRect(x, y+h-2, w, 2); ctx.fillRect(x+w-2, y, 2, h);
}

const _sodaImg = new Image();
_sodaImg.src = 'soda.png';
function drawSoda(ctx, x, y) {
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath(); ctx.ellipse(x, y+10, 12, 4, 0, 0, Math.PI*2); ctx.fill();
  if (_sodaImg.complete && _sodaImg.naturalWidth > 0) {
    const sh = 30, sw = sh * (_sodaImg.naturalWidth / _sodaImg.naturalHeight);
    const bob = Math.sin(Date.now() / 350) * 1.5;
    ctx.drawImage(_sodaImg, x - sw/2, y - sh/2 + bob, sw, sh);
  } else {
    ctx.fillStyle = '#c43030'; ctx.fillRect(x-6, y-10, 12, 20);
    ctx.fillStyle = '#fff'; ctx.fillRect(x-6, y-2, 12, 4);
  }
  ctx.restore();
}

// Power-up visual config: color + a simple pixel glyph drawn on a floating orb.
const POWERUP_STYLE = {
  speed:  { color: '#34d6ff', glow: '#0090d0' },
  damage: { color: '#ff5a3c', glow: '#c02000' },
  shield: { color: '#5aa0ff', glow: '#2050c0' },
};
function drawPowerup(ctx, x, y, type) {
  const st = POWERUP_STYLE[type] || POWERUP_STYLE.speed;
  const bob = Math.sin(Date.now() / 300) * 2;
  const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 200);
  ctx.save();
  // ground shadow
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath(); ctx.ellipse(x, y+11, 11, 4, 0, 0, Math.PI*2); ctx.fill();
  const cy = y + bob;
  // outer glow ring
  ctx.globalAlpha = 0.25 + pulse * 0.25;
  ctx.fillStyle = st.glow;
  ctx.beginPath(); ctx.arc(x, cy, 15 + pulse * 3, 0, Math.PI*2); ctx.fill();
  // orb body
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#11131c';
  ctx.beginPath(); ctx.arc(x, cy, 11, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = st.color;
  ctx.beginPath(); ctx.arc(x, cy, 9, 0, Math.PI*2); ctx.fill();
  // glyph
  ctx.fillStyle = '#0a0a12';
  if (type === 'speed') {
    // lightning bolt
    ctx.beginPath();
    ctx.moveTo(x+1, cy-6); ctx.lineTo(x-4, cy+1); ctx.lineTo(x-1, cy+1);
    ctx.lineTo(x-1, cy+6); ctx.lineTo(x+4, cy-1); ctx.lineTo(x+1, cy-1);
    ctx.closePath(); ctx.fill();
  } else if (type === 'damage') {
    // up-arrow (power)
    ctx.beginPath();
    ctx.moveTo(x, cy-6); ctx.lineTo(x+5, cy+1); ctx.lineTo(x+2, cy+1);
    ctx.lineTo(x+2, cy+6); ctx.lineTo(x-2, cy+6); ctx.lineTo(x-2, cy+1);
    ctx.lineTo(x-5, cy+1); ctx.closePath(); ctx.fill();
  } else {
    // shield outline
    ctx.beginPath();
    ctx.moveTo(x, cy-6); ctx.lineTo(x+5, cy-4); ctx.lineTo(x+5, cy+1);
    ctx.quadraticCurveTo(x+5, cy+5, x, cy+7);
    ctx.quadraticCurveTo(x-5, cy+5, x-5, cy+1);
    ctx.lineTo(x-5, cy-4); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

// XP gem dropped by monsters (small glowing diamond)
function drawGem(ctx, x, y) {
  const t = Date.now() * 0.004;
  const pulse = 0.6 + 0.4 * Math.sin(t + (x + y) * 0.05);
  ctx.save();
  ctx.translate(x, y);
  // glow
  ctx.globalAlpha = 0.35 + pulse * 0.3;
  ctx.fillStyle = '#9ef542';
  ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI*2); ctx.fill();
  ctx.globalAlpha = 1;
  // faceted crystal: dark outline + two-tone facets
  ctx.fillStyle = '#2f6e10';
  ctx.beginPath(); ctx.moveTo(0,-7); ctx.lineTo(5,0); ctx.lineTo(0,7); ctx.lineTo(-5,0); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#7ddb2a'; // left facet
  ctx.beginPath(); ctx.moveTo(0,-6); ctx.lineTo(0,6); ctx.lineTo(-4,0); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#aef55a'; // right facet (brighter)
  ctx.beginPath(); ctx.moveTo(0,-6); ctx.lineTo(4,0); ctx.lineTo(0,6); ctx.closePath(); ctx.fill();
  // sparkle
  ctx.fillStyle = '#eaffc0'; ctx.fillRect(-1, -3, 2, 2);
  ctx.restore();
}

// Survival special pickup (chicken heal / magnet vacuum / bomb nuke)
function drawSurvItem(ctx, x, y, type) {
  const bob = Math.sin(Date.now()/300) * 2;
  const pulse = 0.5 + 0.5*Math.sin(Date.now()/180);
  const cy = y + bob;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath(); ctx.ellipse(x, y+12, 12, 4, 0, 0, Math.PI*2); ctx.fill();
  const col = type === 'chicken' ? '#ffcf6a' : (type === 'magnet' ? '#ff5566' : (type === 'clock' ? '#6ad0ff' : '#ffae20'));
  ctx.globalAlpha = 0.25 + pulse*0.25; ctx.fillStyle = col;
  ctx.beginPath(); ctx.arc(x, cy, 16 + pulse*3, 0, Math.PI*2); ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#11131c'; ctx.beginPath(); ctx.arc(x, cy, 13, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, cy, 11, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#10141c'; ctx.lineWidth = 2.4; ctx.strokeStyle = '#10141c'; ctx.lineCap = 'round';
  if (type === 'chicken') {
    // drumstick: bone + meat
    ctx.beginPath(); ctx.arc(x-2, cy-1, 5, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x+1, cy+1); ctx.lineTo(x+6, cy+6); ctx.stroke();
  } else if (type === 'magnet') {
    // horseshoe magnet
    ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, cy-1, 5, Math.PI, 0); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x-5, cy-1); ctx.lineTo(x-5, cy+5); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x+5, cy-1); ctx.lineTo(x+5, cy+5); ctx.stroke();
  } else if (type === 'clock') {
    // clock face + hands
    ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, cy, 6, 0, Math.PI*2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x, cy); ctx.lineTo(x, cy-4); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x, cy); ctx.lineTo(x+3, cy+1); ctx.stroke();
  } else {
    // bomb: circle + fuse
    ctx.beginPath(); ctx.arc(x, cy+1, 5, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x+3, cy-3); ctx.lineTo(x+6, cy-6); ctx.stroke();
  }
  ctx.restore();
}

// Breakable wooden crate (shows damage as it's shot)
function drawCrate(ctx, x, y, frac) {
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath(); ctx.ellipse(x, y+13, 14, 4, 0, 0, Math.PI*2); ctx.fill();
  const s = 14;
  ctx.fillStyle = '#3a2410'; ctx.fillRect(x-s, y-s, s*2, s*2);
  ctx.fillStyle = '#8a5a2a'; ctx.fillRect(x-s+2, y-s+2, s*2-4, s*2-4);
  ctx.strokeStyle = '#5a3818'; ctx.lineWidth = 2;
  ctx.strokeRect(x-s+2, y-s+2, s*2-4, s*2-4);
  // diagonal planks
  ctx.beginPath(); ctx.moveTo(x-s+2, y-s+2); ctx.lineTo(x+s-2, y+s-2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x+s-2, y-s+2); ctx.lineTo(x-s+2, y+s-2); ctx.stroke();
  // cracks as it takes damage
  if (frac < 0.66) { ctx.strokeStyle = '#2a1808'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(x-4, y-s+2); ctx.lineTo(x-1, y); ctx.lineTo(x-5, y+s-2); ctx.stroke(); }
  if (frac < 0.34) {
    ctx.beginPath(); ctx.moveTo(x+s-2, y-3); ctx.lineTo(x+2, y+1); ctx.lineTo(x+s-2, y+6); ctx.stroke(); }
  ctx.restore();
}

// Pre-rendered zombie body sprite cache (huge perf win with big swarms):
// the static body/head/eyes/mouth/crown is baked once per tier+size, then the
// render loop just drawImage()s it and adds cheap animated arms + hp bar.
const monsterSprites = new Map(); // key `${tier}|${r}` -> canvas
function getMonsterSprite(tier, r) {
  const key = tier + '|' + r;
  if (monsterSprites.has(key)) return monsterSprites.get(key);
  const skin  = tier==='boss' ? '#9b59ff' : (tier==='elite' ? '#c63a48' : '#6e9a45');
  const skinD = tier==='boss' ? '#5a2bb0' : (tier==='elite' ? '#7e1c26' : '#456a2a');
  const skinL = tier==='boss' ? '#c9a6ff' : (tier==='elite' ? '#e3737d' : '#9bc46a');
  const eyeC  = (tier==='elite'||tier==='boss') ? '#ffe24a' : '#ff3a2a';
  const pad = 18;
  const cv = document.createElement('canvas');
  cv.width = cv.height = (r + pad) * 2;
  const c = cv.getContext('2d');
  c.translate(cv.width/2, cv.height/2);
  // body
  c.fillStyle = skinD; c.beginPath(); c.arc(0, 1, r, 0, Math.PI*2); c.fill();
  c.fillStyle = skin;  c.beginPath(); c.arc(0, 0, r - 2, 0, Math.PI*2); c.fill();
  c.fillStyle = skinD;
  c.beginPath(); c.arc(-r*0.35, r*0.3, r*0.18, 0, Math.PI*2); c.fill();
  c.beginPath(); c.arc( r*0.4, -r*0.1, r*0.14, 0, Math.PI*2); c.fill();
  c.fillStyle = skinL;
  c.beginPath(); c.arc(-r*0.25, -r*0.45, r*0.28, 0, Math.PI*2); c.fill();
  const ew = Math.max(2.2, r*0.24), ey = -r*0.22;
  c.fillStyle = 'rgba(0,0,0,0.5)';
  c.fillRect(-r*0.46-1, ey-1, ew+2, ew+2); c.fillRect(r*0.46-ew-1, ey-1, ew+2, ew+2);
  c.fillStyle = eyeC;
  c.fillRect(-r*0.46, ey, ew, ew); c.fillRect(r*0.46-ew, ey, ew, ew);
  c.strokeStyle = '#1a0a0a'; c.lineWidth = Math.max(1.4, r*0.12);
  c.beginPath();
  c.moveTo(-r*0.4, r*0.42); c.lineTo(-r*0.13, r*0.28); c.lineTo(0, r*0.46);
  c.lineTo(r*0.13, r*0.28); c.lineTo(r*0.4, r*0.42); c.stroke();
  if (tier==='boss') {
    c.fillStyle = '#ffd24a';
    c.beginPath();
    c.moveTo(-r*0.6, -r*0.62); c.lineTo(-r*0.6, -r*1.02); c.lineTo(-r*0.2, -r*0.72);
    c.lineTo(0, -r*1.08); c.lineTo(r*0.2, -r*0.72); c.lineTo(r*0.6, -r*1.02);
    c.lineTo(r*0.6, -r*0.62); c.closePath(); c.fill();
  }
  monsterSprites.set(key, cv);
  return cv;
}

// Survival monster: cached body sprite + cheap animated arms + hp bar.
function drawMonster(ctx, x, y, m) {
  const t = Date.now() * 0.006;
  const id = m.id || 0;
  const wob = Math.sin(t + id) * 1.6;
  const lurch = Math.sin(t*1.4 + id);
  const r = m.r || 12;
  const tier = m.boss ? 'boss' : (m.elite ? 'elite' : 'normal');
  const cy = y + wob;
  // shadow
  ctx.fillStyle = 'rgba(0,0,0,0.32)';
  ctx.beginPath(); ctx.ellipse(x, y + r, r*0.95, 3.5, 0, 0, Math.PI*2); ctx.fill();
  // boss aura
  if (m.boss) {
    const gp = 0.4 + 0.3*Math.sin(Date.now()/180);
    ctx.fillStyle = `rgba(180,80,255,${gp*0.4})`;
    ctx.beginPath(); ctx.arc(x, cy, r+12, 0, Math.PI*2); ctx.fill();
  }
  // animated arms
  const skinD = tier==='boss' ? '#5a2bb0' : (tier==='elite' ? '#7e1c26' : '#456a2a');
  ctx.strokeStyle = skinD; ctx.lineWidth = Math.max(3, r*0.32); ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x-r*0.5, cy); ctx.lineTo(x-r*0.95, cy + r*0.55 + lurch*2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x+r*0.5, cy); ctx.lineTo(x+r*0.95, cy + r*0.55 - lurch*2); ctx.stroke();
  // baked body
  const spr = getMonsterSprite(tier, r);
  ctx.drawImage(spr, x - spr.width/2, cy - spr.height/2);
  // hp bar if hurt
  if (m.hp < m.maxHp) {
    const bw = r*2, bf = Math.max(0, m.hp/m.maxHp) * bw;
    ctx.fillStyle = '#000'; ctx.fillRect(x-r, cy-r-8, bw, 3);
    ctx.fillStyle = m.boss ? '#d29bff' : (m.elite ? '#ffcf3a' : '#9ce04a'); ctx.fillRect(x-r, cy-r-8, bf, 3);
  }
}

function drawRocketPickup(ctx, x, y) {
  // pixel rocket lying on ground
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.fillRect(x-12, y-3, 24, 6);
  // body
  ctx.fillStyle = '#2a2a36'; ctx.fillRect(x-10, y-4, 18, 8);
  ctx.fillStyle = '#a4a4b8'; ctx.fillRect(x-10, y-4, 18, 2);
  ctx.fillStyle = '#1a1a22'; ctx.fillRect(x-10, y+2, 18, 2);
  // nose cone (red)
  ctx.fillStyle = '#ff3050'; ctx.fillRect(x+8, y-3, 4, 6);
  ctx.fillStyle = '#ff8090'; ctx.fillRect(x+8, y-3, 4, 1);
  // fins
  ctx.fillStyle = '#5a5a6a';
  ctx.fillRect(x-12, y-5, 3, 3);
  ctx.fillRect(x-12, y+2, 3, 3);
  ctx.restore();
}

function drawRocket(ctx, x, y, angle) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle || 0);
  // flame tail
  ctx.fillStyle = '#ffd24a'; ctx.fillRect(-12, -2, 6, 4);
  ctx.fillStyle = '#ff8a3c'; ctx.fillRect(-10, -1, 4, 2);
  // body
  ctx.fillStyle = '#2a2a36'; ctx.fillRect(-6, -3, 10, 6);
  ctx.fillStyle = '#a4a4b8'; ctx.fillRect(-6, -3, 10, 1);
  // nose
  ctx.fillStyle = '#ff3050'; ctx.fillRect(4, -2, 4, 4);
  ctx.restore();
}

// Explosions (visual only, server emits 'explosion')
const explosions = [];
let lastExplodeSoundAt = 0;
const knifeFx = [];
socket.on('knifeFx', ({x, y, angle}) => {
  knifeFx.push({ x, y, angle, t: Date.now() });
});
socket.on('explosion', ({x, y, r, color}) => {
  explosions.push({x, y, r, color: color || null, t: Date.now()});
  const now = Date.now();
  if (now - lastExplodeSoundAt > 70) {
    lastExplodeSoundAt = now;
    AUD.explode();
  }
});
function drawDamageNumbers(ss) {
  const now = Date.now();
  const DUR = 800;
  gctx.font = 'bold 16px "Press Start 2P", monospace';
  gctx.textAlign = 'center';
  for (let i = damageNumbers.length - 1; i >= 0; i--) {
    const d = damageNumbers[i];
    const age = now - d.t;
    if (age > DUR) { damageNumbers.splice(i, 1); continue; }
    const p = ss.players.find(pl => pl.id === d.id);
    if (!p) continue;
    const f = age / DUR;
    const a = 1 - f;
    const dx = (d.seed - 0.5) * 20;
    const dy = -30 - f * 30;
    const x = p.x - camX + dx;
    const y = p.y - camY + dy;
    const isHeal = d.dmg < 0;
    const fmt = (n) => {
      const r = Math.round(n * 10) / 10;
      return Number.isInteger(r) ? String(r) : r.toFixed(1);
    };
    const text = isHeal ? '+' + fmt(-d.dmg) : '-' + fmt(d.dmg);
    const color = isHeal ? '90,255,130' : '255,90,90';
    gctx.fillStyle = `rgba(0,0,0,${a})`;
    gctx.fillText(text, x + 1, y + 1);
    gctx.fillStyle = `rgba(${color},${a})`;
    gctx.fillText(text, x, y);
  }
}

function drawKnifeFx() {
  const now = Date.now();
  const DUR = 250;
  for (let i = knifeFx.length-1; i >= 0; i--) {
    const k = knifeFx[i];
    const age = now - k.t;
    if (age > DUR) { knifeFx.splice(i, 1); continue; }
    const f = age / DUR;
    const a = 1 - f;
    const range = 55;
    const arc = Math.PI * 0.55;
    const startA = k.angle - arc/2 + arc * f;
    const x = k.x - camX, y = k.y - camY;
    gctx.save();
    gctx.strokeStyle = `rgba(255,255,255,${a})`;
    gctx.lineWidth = 3;
    gctx.beginPath();
    gctx.arc(x, y, range, startA - 0.3, startA + 0.1);
    gctx.stroke();
    gctx.strokeStyle = `rgba(200,230,255,${a * 0.5})`;
    gctx.lineWidth = 1.5;
    gctx.beginPath();
    gctx.arc(x, y, range - 8, startA - 0.4, startA + 0.15);
    gctx.stroke();
    gctx.restore();
  }
}

function drawExplosions() {
  const now = Date.now();
  for (let i = explosions.length-1; i >= 0; i--) {
    const e = explosions[i];
    const age = now - e.t;
    if (age > 400) { explosions.splice(i, 1); continue; }
    const a = 1 - age/400;
    const rr = e.r * (0.3 + 0.7 * (age/400));
    const isCyber = e.color === 'cyber';
    gctx.fillStyle = isCyber ? `rgba(40, 180, 255, ${a * 0.6})` : `rgba(255, 200, 60, ${a * 0.6})`;
    gctx.beginPath(); gctx.arc(e.x - camX, e.y - camY, rr, 0, Math.PI*2); gctx.fill();
    gctx.fillStyle = isCyber ? `rgba(120, 230, 255, ${a * 0.9})` : `rgba(255, 100, 40, ${a * 0.9})`;
    gctx.beginPath(); gctx.arc(e.x - camX, e.y - camY, rr*0.6, 0, Math.PI*2); gctx.fill();
  }
}

const _heartImg = new Image();
_heartImg.src = 'heart.png';
function drawHeart(ctx, x, y) {
  if (_heartImg.complete && _heartImg.naturalWidth > 0) {
    const bob = Math.sin(Date.now() / 350) * 1.2;
    ctx.drawImage(_heartImg, x - 14, y - 14 + bob, 28, 28);
    return;
  }
  // Fallback pixel heart
  const map = ["0110110","1111111","1111111","0111110","0011100","0001000"];
  const s = 3;
  ctx.fillStyle = '#000';
  ctx.fillRect(x-11, y-10, 22, 21);
  for (let yy=0;yy<map.length;yy++) {
    for (let xx=0;xx<map[0].length;xx++) {
      if (map[yy][xx]==='1') {
        ctx.fillStyle = (yy<2) ? '#ff5577' : '#ff3050';
        ctx.fillRect(x-10+xx*s, y-9+yy*s, s, s);
      }
    }
  }
}

// Offscreen full-map canvas with grass + walls baked in. Built once per
// round (and on wallBroken). Saves 1000+ rect draws per frame.
let groundCache = null;
function rebuildGroundCache() {
  if (!state.mapW || !state.mapH) return;
  const cv = document.createElement('canvas');
  cv.width = state.mapW; cv.height = state.mapH;
  const c = cv.getContext('2d');
  c.imageSmoothingEnabled = false;
  // ground base (chosen color, with slight checker variation + sparse detail)
  const base = state.groundColor || '#4a6a3a';
  // derive a slightly darker shade for the checker
  function shade(hex, f) {
    const n = parseInt(hex.slice(1), 16);
    const r = Math.max(0, Math.min(255, ((n>>16)&255) + f|0));
    const g = Math.max(0, Math.min(255, ((n>>8)&255) + f|0));
    const b = Math.max(0, Math.min(255, (n&255) + f|0));
    return '#' + ((r<<16)|(g<<8)|b).toString(16).padStart(6,'0');
  }
  const dark = shade(base, -16);
  c.fillStyle = base; c.fillRect(0, 0, state.mapW, state.mapH);
  const ts = 32;
  for (let ty = 0; ty < Math.ceil(state.mapH/ts); ty++) {
    for (let tx = 0; tx < Math.ceil(state.mapW/ts); tx++) {
      const hash = ((tx*73856093) ^ (ty*19349663)) >>> 0;
      const isDirt = (hash % 17) === 0;
      let col;
      if (isDirt) col = '#6b4a2a';
      else col = (tx+ty)%2===0 ? base : dark;
      c.fillStyle = col;
      c.fillRect(tx*ts, ty*ts, ts, ts);
      if (!isDirt && (hash % 23) === 0) {
        c.fillStyle = shade(base, +24);
        c.fillRect(tx*ts+6, ty*ts+10, 2, 4);
        c.fillRect(tx*ts+10, ty*ts+8, 2, 6);
        c.fillRect(tx*ts+14, ty*ts+12, 2, 4);
      }
    }
  }
  // walls baked in once; broken walls are patched via patchGroundCache
  for (const w of (state.walls || [])) {
    drawWall(c, w.x, w.y, w.w, w.h, w.kind || 'stone');
  }
  groundCache = cv;
}

// Erase a broken wall from the cache without rebuilding the whole canvas:
// repaint just the ground tiles over the wall's rect, then repaint any
// remaining walls that overlap that area.
function patchGroundCache(wx, wy, ww, wh) {
  if (!groundCache) return;
  const c = groundCache.getContext('2d');
  const base = state.groundColor || '#4a6a3a';
  function shade(hex, f) {
    const n = parseInt(hex.slice(1), 16);
    const r = Math.max(0, Math.min(255, ((n>>16)&255) + f|0));
    const g = Math.max(0, Math.min(255, ((n>>8)&255) + f|0));
    const b = Math.max(0, Math.min(255, (n&255) + f|0));
    return '#' + ((r<<16)|(g<<8)|b).toString(16).padStart(6,'0');
  }
  const dark = shade(base, -16);
  const ts = 32;
  const tx0 = Math.floor(wx / ts), ty0 = Math.floor(wy / ts);
  const tx1 = Math.ceil((wx + ww) / ts), ty1 = Math.ceil((wy + wh) / ts);
  for (let ty = ty0; ty < ty1; ty++) {
    for (let tx = tx0; tx < tx1; tx++) {
      const hash = ((tx*73856093) ^ (ty*19349663)) >>> 0;
      const isDirt = (hash % 17) === 0;
      let col = isDirt ? '#6b4a2a' : ((tx+ty)%2===0 ? base : dark);
      c.fillStyle = col;
      c.fillRect(tx*ts, ty*ts, ts, ts);
      if (!isDirt && (hash % 23) === 0) {
        c.fillStyle = shade(base, +24);
        c.fillRect(tx*ts+6, ty*ts+10, 2, 4);
        c.fillRect(tx*ts+10, ty*ts+8, 2, 6);
        c.fillRect(tx*ts+14, ty*ts+12, 2, 4);
      }
    }
  }
  // repaint any walls that overlap the patched region
  for (const w of (state.walls || [])) {
    if (w.x + w.w < wx || w.x > wx + ww) continue;
    if (w.y + w.h < wy || w.y > wy + wh) continue;
    drawWall(c, w.x, w.y, w.w, w.h, w.kind || 'stone');
  }
}

// ===== Player sprite cache =====
// Pre-render the life-pip row (most expensive player draw) onto a tiny
// offscreen canvas once per player-lives value so the render loop just
// calls drawImage instead of 130+ fillRect calls per player per frame.
const pipCache = new Map(); // key = `${lives}/${maxPips}` → canvas
const heartShape = ["01010","11111","11111","01110","00100"];
// Re-render pips when heart image finishes loading (no-op if already loaded)
if (!_heartImg.complete) _heartImg.addEventListener('load', () => pipCache.clear(), { once: true });
function getPipRow(lives, maxPips) {
  const key = `${lives}|${maxPips}`;
  if (pipCache.has(key)) return pipCache.get(key);
  const heartW = 10, heartH = 10, gap = 3;
  const totalW = maxPips*heartW + (maxPips-1)*gap;
  const cv = document.createElement('canvas');
  cv.width = totalW; cv.height = heartH;
  const c = cv.getContext('2d');
  c.imageSmoothingEnabled = true;
  if (_heartImg.complete && _heartImg.naturalWidth > 0) {
    for (let i = 0; i < maxPips; i++) {
      const hx = i*(heartW+gap), filled = i < lives;
      c.globalAlpha = filled ? 1 : 0.25;
      c.drawImage(_heartImg, hx, 0, heartW, heartH);
    }
    c.globalAlpha = 1;
  } else {
    // Pixel fallback
    const cell = 2;
    for (let i = 0; i < maxPips; i++) {
      const hx = i*(heartW+gap), filled = i < lives;
      for (let yy = 0; yy < 5; yy++) for (let xx = 0; xx < 5; xx++) {
        if (heartShape[yy][xx] !== '1') continue;
        c.fillStyle = '#000'; c.fillRect(hx+xx*cell-1, yy*cell-1, cell+2, cell+2);
      }
      for (let yy = 0; yy < 5; yy++) for (let xx = 0; xx < 5; xx++) {
        if (heartShape[yy][xx] !== '1') continue;
        c.fillStyle = filled ? (yy < 2 ? '#ff6080' : '#ff3050') : '#3a1018';
        c.fillRect(hx+xx*cell, yy*cell, cell, cell);
      }
    }
  }
  pipCache.set(key, cv);
  return cv;
}

function render() {
  requestAnimationFrame(render);
  if (state.inGame && state.mode === 'imposter') {
    // Skip the world render when a full-screen overlay covers it (saves CPU and
    // stops the map churning behind meeting/task/pause screens).
    const covered = !$('pauseMenu').classList.contains('hidden')
      || !$('meetingModal').classList.contains('hidden')
      || !$('taskModal').classList.contains('hidden')
      || !$('roundEnd').classList.contains('hidden');
    if (!covered) renderImposter();
    return;
  }
  if (!state.inGame || !state.serverState) return;
  // Skip world render when fully occluded (pause/round-end overlay open)
  if (!$('pauseMenu').classList.contains('hidden')) return;
  if (!$('roundEnd').classList.contains('hidden')) return;
  // Use interpolated state for smooth visual positions
  const ss = getInterpState();
  const me = ss.players.find(p => p.id === socket.id);
  const W = gameCanvas.width, H = gameCanvas.height;

  // Camera follows our local player; use interpolated position for smooth tracking
  const cx = me ? me.x : state.mapW/2, cy = me ? me.y : state.mapH/2;
  const targetCamX = Math.max(0, Math.min(state.mapW - W, cx - W/2));
  const targetCamY = Math.max(0, Math.min(state.mapH - H, cy - H/2));
  // Smooth camera: lerp toward target so it never jumps even if server snaps
  const CAM_LERP = 0.18;
  camX += (targetCamX - camX) * CAM_LERP;
  camY += (targetCamY - camY) * CAM_LERP;
  if (state.mapW < W) camX = (state.mapW - W)/2;
  if (state.mapH < H) camY = (state.mapH - H)/2;

  gctx.imageSmoothingEnabled = false;
  // Always clear first so off-map areas don't show leftover pixels (cursor trails etc.)
  gctx.fillStyle = '#0a0a14';
  gctx.fillRect(0, 0, W, H);
  if (groundCache) {
    // Integer camera coords for pixel-perfect blit (avoids sub-pixel blur)
    const icx = Math.floor(camX), icy = Math.floor(camY);
    const srcX = Math.max(0, icx), srcY = Math.max(0, icy);
    const srcW = Math.min(W, state.mapW - srcX);
    const srcH = Math.min(H, state.mapH - srcY);
    const dstX = srcX - icx, dstY = srcY - icy;
    if (srcW > 0 && srcH > 0) {
      gctx.drawImage(groundCache, srcX, srcY, srcW, srcH, dstX, dstY, srcW, srcH);
    }
  }
  // hearts and rocket pickups
  for (const h of ss.hearts) drawHeart(gctx, h.x-camX, h.y-camY);
  if (ss.rocketPickups) {
    for (const r of ss.rocketPickups) drawRocketPickup(gctx, r.x-camX, r.y-camY);
  }
  if (ss.sodas) {
    for (const s of ss.sodas) drawSoda(gctx, s.x-camX, s.y-camY);
  }
  if (ss.powerups) {
    for (const pu of ss.powerups) drawPowerup(gctx, pu.x-camX, pu.y-camY, pu.type);
  }
  // survival: XP gems (ground) + monsters
  if (ss.gems) {
    for (const g of ss.gems) {
      const gx = g.x-camX, gy = g.y-camY;
      if (gx < -10 || gy < -10 || gx > W+10 || gy > H+10) continue;
      drawGem(gctx, gx, gy);
    }
  }
  if (ss.survItems) {
    for (const it of ss.survItems) {
      const ix = it.x-camX, iy = it.y-camY;
      if (ix < -20 || iy < -20 || ix > W+20 || iy > H+20) continue;
      drawSurvItem(gctx, ix, iy, it.type);
    }
  }
  if (ss.crates) {
    for (const cr of ss.crates) {
      const cx = cr.x-camX, cy = cr.y-camY;
      if (cx < -24 || cy < -24 || cx > W+24 || cy > H+24) continue;
      drawCrate(gctx, cx, cy, cr.hp/cr.maxHp);
    }
  }
  if (ss.zones) {
    for (const z of ss.zones) {
      const zx = z.x-camX, zy = z.y-camY;
      const wob = 0.12 + 0.05*Math.sin(Date.now()/150);
      gctx.fillStyle = `rgba(90,170,255,${wob})`;
      gctx.beginPath(); gctx.arc(zx, zy, z.r, 0, Math.PI*2); gctx.fill();
      gctx.strokeStyle = 'rgba(120,200,255,0.4)'; gctx.lineWidth = 2;
      gctx.beginPath(); gctx.arc(zx, zy, z.r, 0, Math.PI*2); gctx.stroke();
    }
  }
  if (ss.monsters) {
    for (const m of ss.monsters) {
      const mx = m.x-camX, my = m.y-camY;
      if (mx < -30 || my < -30 || mx > W+30 || my > H+30) continue;
      drawMonster(gctx, mx, my, m);
    }
  }

  // bullets / rockets
  for (const b of ss.bullets) {
    const x=b.x-camX, y=b.y-camY;
    if (x < -8 || y < -8 || x > W+8 || y > H+8) continue;
    if (b.type === 'rocket') drawRocket(gctx, x, y, b.angle||0);
    else if (b.type === 'flame') {
      const seed = (b.id || 0) * 1.618;
      const t = Date.now() * 0.001;
      const ang = b.angle || 0;
      gctx.save();
      gctx.translate(x, y);
      gctx.rotate(ang);
      // a chunk of fire = multiple offset blobs, each with own flicker
      const blobs = [
        { ox: -6, oy: -3, r: 6.5, freq: 11, ph: 0.3 },
        { ox: -2, oy:  3, r: 7.5, freq: 13, ph: 1.1 },
        { ox:  3, oy: -2, r: 6.0, freq: 17, ph: 2.4 },
        { ox:  5, oy:  3, r: 5.0, freq: 19, ph: 0.7 },
        { ox:  0, oy:  0, r: 8.0, freq:  9, ph: 1.8 },
      ];
      // outer red glow (one big soft puff)
      const gflick = Math.sin(t * 8 + seed) * 0.5 + 0.5;
      gctx.globalAlpha = 0.22 + gflick * 0.13;
      gctx.fillStyle = '#ff2a00';
      gctx.beginPath(); gctx.arc(0, 0, 16 + gflick * 4, 0, Math.PI*2); gctx.fill();
      // orange flame body — multiple blobs
      gctx.globalAlpha = 0.75;
      for (const bl of blobs) {
        const f = Math.sin(t * bl.freq + seed + bl.ph) * 0.5 + 0.5;
        gctx.fillStyle = `rgb(255,${Math.floor(70 + f * 110)},0)`;
        gctx.beginPath(); gctx.arc(bl.ox, bl.oy, bl.r + f * 2.5, 0, Math.PI*2); gctx.fill();
      }
      // hot yellow inner blobs
      gctx.globalAlpha = 0.9;
      for (let i = 0; i < 3; i++) {
        const f = Math.sin(t * (14 + i*3) + seed + i) * 0.5 + 0.5;
        const ox = (i - 1) * 3;
        gctx.fillStyle = `rgb(255,${Math.floor(200 + f * 50)},${Math.floor(f * 70)})`;
        gctx.beginPath(); gctx.arc(ox, (f - 0.5) * 2, 2.5 + f * 1.5, 0, Math.PI*2); gctx.fill();
      }
      // white-hot core
      gctx.globalAlpha = 0.85;
      gctx.fillStyle = '#ffeebb';
      gctx.beginPath(); gctx.arc(0, 0, 2 + gflick, 0, Math.PI*2); gctx.fill();
      gctx.globalAlpha = 1;
      gctx.restore();
    } else if (b.type === 'sniper') {
      const ang = b.angle || 0;
      gctx.save();
      gctx.translate(x, y);
      gctx.rotate(ang);
      // long bright tracer
      gctx.fillStyle = 'rgba(200,255,120,0.9)';
      gctx.fillRect(-24, -1.5, 28, 3);
      gctx.fillStyle = '#fff';
      gctx.fillRect(-4, -1, 8, 2);
      gctx.restore();
    } else if (b.type === 'missile') {
      const ang = b.angle || 0;
      gctx.save(); gctx.translate(x, y); gctx.rotate(ang);
      // flame trail
      gctx.fillStyle = 'rgba(255,150,40,0.7)';
      gctx.beginPath(); gctx.arc(-8, 0, 4, 0, Math.PI*2); gctx.fill();
      // body
      gctx.fillStyle = '#d8d8e0'; gctx.fillRect(-5, -3, 10, 6);
      gctx.fillStyle = '#ff4654'; gctx.beginPath();
      gctx.moveTo(5, -3); gctx.lineTo(10, 0); gctx.lineTo(5, 3); gctx.fill();
      gctx.restore();
    } else if (b.type === 'wand') {
      gctx.fillStyle = 'rgba(120,220,255,0.5)'; gctx.beginPath(); gctx.arc(x, y, 6, 0, Math.PI*2); gctx.fill();
      gctx.fillStyle = '#bfefff'; gctx.beginPath(); gctx.arc(x, y, 3, 0, Math.PI*2); gctx.fill();
    } else if (b.type === 'knife') {
      gctx.save(); gctx.translate(x, y); gctx.rotate(b.angle||0);
      gctx.fillStyle = '#dfe4ec'; gctx.fillRect(-7, -1.5, 14, 3);
      gctx.fillStyle = '#9aa3b2'; gctx.fillRect(-7, -1.5, 4, 3);
      gctx.restore();
    } else if (b.type === 'axe') {
      gctx.save(); gctx.translate(x, y); gctx.rotate(b.angle||0);
      gctx.fillStyle = '#6a4a2a'; gctx.fillRect(-1.5, -8, 3, 16);
      gctx.fillStyle = '#cfd6e0'; gctx.beginPath();
      gctx.moveTo(0,-8); gctx.lineTo(8,-5); gctx.lineTo(8,-1); gctx.lineTo(0,-2); gctx.fill();
      gctx.beginPath(); gctx.moveTo(0,-8); gctx.lineTo(-8,-5); gctx.lineTo(-8,-1); gctx.lineTo(0,-2); gctx.fill();
      gctx.restore();
    } else if (b.type === 'fireball') {
      const fp = 0.5 + 0.5*Math.sin(Date.now()/80);
      gctx.fillStyle = `rgba(255,120,20,${0.5+fp*0.3})`; gctx.beginPath(); gctx.arc(x, y, 9+fp*2, 0, Math.PI*2); gctx.fill();
      gctx.fillStyle = '#ffe070'; gctx.beginPath(); gctx.arc(x, y, 4, 0, Math.PI*2); gctx.fill();
    } else if (b.type === 'cross') {
      gctx.save(); gctx.translate(x, y); gctx.rotate(Date.now()/120);
      gctx.fillStyle = '#ffd24a'; gctx.fillRect(-2, -8, 4, 16); gctx.fillRect(-8, -2, 16, 4);
      gctx.restore();
    } else {
      gctx.fillStyle='#000'; gctx.fillRect(x-3,y-3,6,6);
      gctx.fillStyle='#ffd24a'; gctx.fillRect(x-2,y-2,4,4);
    }
  }
  drawExplosions();
  drawZaps();
  drawWhips();
  if (Date.now() < freezeUntil) { gctx.fillStyle = 'rgba(120,200,255,0.13)'; gctx.fillRect(0, 0, W, H); }
  drawKnifeFx();

  // pets (heal totems)
  if (ss.pets) {
    for (const pt of ss.pets) {
      const x = pt.x - camX, y = pt.y - camY;
      const pulse = (Date.now() / 200) % (Math.PI*2);
      gctx.fillStyle = 'rgba(122,210,74,0.18)';
      gctx.beginPath(); gctx.arc(x, y, 35 + Math.sin(pulse)*3, 0, Math.PI*2); gctx.fill();
      // body
      gctx.fillStyle = '#0a0a0a'; gctx.fillRect(x-8, y-8, 16, 16);
      gctx.fillStyle = '#7ad24a'; gctx.fillRect(x-6, y-6, 12, 12);
      gctx.fillStyle = '#fff'; gctx.fillRect(x-1, y-4, 2, 8); gctx.fillRect(x-4, y-1, 8, 2);
      // hp bar
      if (typeof pt.hp === 'number' && pt.maxHp) {
        const hpw = 22, hpf = Math.max(0, pt.hp / pt.maxHp) * hpw;
        gctx.fillStyle = '#000'; gctx.fillRect(x-11, y-15, hpw, 4);
        gctx.fillStyle = '#7ad24a'; gctx.fillRect(x-11, y-15, hpf, 4);
      }
      // countdown timer
      if (typeof pt.msLeft === 'number') {
        const secsLeft = Math.max(0, Math.ceil(pt.msLeft / 1000));
        gctx.font = 'bold 9px "Press Start 2P", monospace';
        gctx.textAlign = 'center';
        gctx.fillStyle = 'rgba(0,0,0,0.7)';
        gctx.fillText(secsLeft + 's', x + 1, y - 19);
        gctx.fillStyle = secsLeft <= 3 ? '#ff5555' : '#ffffaa';
        gctx.fillText(secsLeft + 's', x, y - 20);
      }
    }
  }
  // turrets
  if (ss.turrets) {
    for (const tu of ss.turrets) {
      const x = tu.x - camX, y = tu.y - camY;
      // wheels (left + right), drawn under the chassis
      gctx.fillStyle = '#0a0a0a';
      gctx.fillRect(x-13, y-9, 4, 18); gctx.fillRect(x+9, y-9, 4, 18);
      gctx.fillStyle = '#2a2a30';
      gctx.fillRect(x-12, y-8, 2, 16); gctx.fillRect(x+10, y-8, 2, 16);
      // wheel hubs
      gctx.fillStyle = '#6a6a7a';
      gctx.fillRect(x-12, y-1, 2, 2); gctx.fillRect(x+10, y-1, 2, 2);
      // wheel tread marks
      gctx.fillStyle = '#1a1a22';
      for (let wy = -7; wy <= 6; wy += 4) {
        gctx.fillRect(x-13, y+wy, 4, 1);
        gctx.fillRect(x+9,  y+wy, 4, 1);
      }
      // base / chassis
      gctx.fillStyle = '#0a0a0a'; gctx.fillRect(x-10, y-10, 20, 20);
      gctx.fillStyle = '#5a5a6a'; gctx.fillRect(x-9, y-9, 18, 18);
      gctx.fillStyle = '#8a8a9a'; gctx.fillRect(x-9, y-9, 18, 2);
      // dome
      gctx.fillStyle = '#1a1a24'; gctx.fillRect(x-5, y-5, 10, 10);
      // barrel
      gctx.save(); gctx.translate(x, y); gctx.rotate(tu.angle||0);
      gctx.fillStyle = '#1a1a24'; gctx.fillRect(0, -2, 14, 4);
      gctx.fillStyle = '#3a3a4a'; gctx.fillRect(0, -2, 14, 1);
      gctx.restore();
      // hp bar (use server-broadcast maxHp for accurate scaling)
      const maxHp = tu.maxHp || 25;
      const hpw = 22, hpf = Math.max(0, tu.hp / maxHp) * hpw;
      gctx.fillStyle = '#000'; gctx.fillRect(x-11, y-16, hpw, 4);
      gctx.fillStyle = '#7ad24a'; gctx.fillRect(x-11, y-16, hpf, 4);
    }
  }

  gctx.font='10px "Press Start 2P",monospace';
  gctx.textAlign='center';
  const tankPulse = 0.6 + 0.4 * Math.sin(Date.now()/120);
  const tankAlpha = tankPulse * 0.35;
  for (const p of ss.players) {
    const px = p.x - camX, py = p.y - camY;
    if (px < -40 || py < -40 || px > W+40 || py > H+40) continue;
    if (p.tank) {
      gctx.fillStyle = `rgba(255,80,90,${tankAlpha})`;
      gctx.beginPath(); gctx.arc(px, py, 36, 0, Math.PI*2); gctx.fill();
    }
    // Power-up auras (ring around buffed players)
    if (p.shieldMs > 0) {
      const a = 0.5 + 0.4 * Math.sin(Date.now()/140);
      gctx.strokeStyle = `rgba(90,160,255,${a})`;
      gctx.lineWidth = 3;
      gctx.beginPath(); gctx.arc(px, py, 24, 0, Math.PI*2); gctx.stroke();
    }
    if (p.dmgMs > 0) {
      gctx.fillStyle = `rgba(255,90,60,${tankPulse*0.22})`;
      gctx.beginPath(); gctx.arc(px, py, 22, 0, Math.PI*2); gctx.fill();
    }
    if (p.speedMs > 0) {
      gctx.strokeStyle = `rgba(52,214,255,${0.4+0.3*tankPulse})`;
      gctx.lineWidth = 2;
      gctx.beginPath(); gctx.arc(px, py, 20, 0, Math.PI*2); gctx.stroke();
    }
    // Survival garlic aura
    if (p.auraR > 0) {
      const ap = 0.10 + 0.05 * Math.sin(Date.now()/200);
      gctx.fillStyle = `rgba(150,255,120,${ap})`;
      gctx.beginPath(); gctx.arc(px, py, p.auraR, 0, Math.PI*2); gctx.fill();
      gctx.strokeStyle = 'rgba(150,255,120,0.35)'; gctx.lineWidth = 2;
      gctx.beginPath(); gctx.arc(px, py, p.auraR, 0, Math.PI*2); gctx.stroke();
    }
    // Survival orbiting orbs (King Bible)
    if (p.orbs) {
      for (const o of p.orbs) {
        const ox = o[0]-camX, oy = o[1]-camY;
        gctx.fillStyle = 'rgba(180,140,255,0.95)';
        gctx.beginPath(); gctx.arc(ox, oy, 8, 0, Math.PI*2); gctx.fill();
        gctx.fillStyle = '#fff';
        gctx.beginPath(); gctx.arc(ox, oy, 3, 0, Math.PI*2); gctx.fill();
      }
    }
    if (p.tank) {
      gctx.save();
      gctx.translate(px, py);
      gctx.scale(1.5, 1.5);
      drawRobotTopDown(gctx, 0, 0, p.color, p.angle, p.alive, p.id, p.x, p.y, p.hat||'', p.hatCfg, p.cls||'');
      gctx.restore();
    } else {
      drawRobotTopDown(gctx, px, py, p.color, p.angle, p.alive, p.id, p.x, p.y, p.hat||'', p.hatCfg, p.cls||'');
    }
    // life pips — cached offscreen canvas avoids 130+ fillRect per player/frame
    const lives = typeof p.lives==='number' ? p.lives : 0;
    const totalW = 5*10 + 4*3;
    const pipImg = getPipRow(lives, 5);
    gctx.drawImage(pipImg, Math.floor(px-totalW/2), Math.floor(py+22));
    // name below hearts
    gctx.fillStyle='#000'; gctx.fillRect(px-30, py+38, 60, 12);
    gctx.fillStyle = p.id===socket.id ? '#ffd24a' : '#fff';
    gctx.fillText(p.name.slice(0,8), px, py+48);
  }

  drawDamageNumbers(ss);

  // Active power-up buffs for the local player (bottom-left badges)
  const meBuff = ss.players.find(p => p.id === socket.id);
  if (meBuff) {
    const buffs = [];
    if (meBuff.speedMs  > 0) buffs.push({ c: '#34d6ff', t: '⚡', ms: meBuff.speedMs });
    if (meBuff.dmgMs    > 0) buffs.push({ c: '#ff5a3c', t: '⨯2', ms: meBuff.dmgMs });
    if (meBuff.shieldMs > 0) buffs.push({ c: '#5aa0ff', t: '🛡', ms: meBuff.shieldMs });
    let bx = 16, by = H - 60;
    gctx.textAlign = 'left';
    gctx.font = '12px "Press Start 2P",monospace';
    for (const b of buffs) {
      gctx.fillStyle = 'rgba(0,0,0,0.55)';
      gctx.fillRect(bx, by, 74, 22);
      gctx.fillStyle = b.c;
      gctx.fillRect(bx, by, 4, 22);
      gctx.fillText(b.t + ' ' + Math.ceil(b.ms/1000) + 's', bx + 10, by + 16);
      by -= 28;
    }
    gctx.textAlign = 'center';

    // Survival: XP bar + level (bottom-center)
    if (ss.mode === 'survival') {
      const barW = 320, barH = 16;
      const bx2 = (W - barW) / 2, by2 = H - 34;
      const frac = meBuff.xpToNext ? Math.min(1, (meBuff.xp || 0) / meBuff.xpToNext) : 0;
      gctx.fillStyle = 'rgba(0,0,0,0.6)';
      gctx.fillRect(bx2 - 2, by2 - 2, barW + 4, barH + 4);
      gctx.fillStyle = '#1a2410';
      gctx.fillRect(bx2, by2, barW, barH);
      gctx.fillStyle = '#7ad24a';
      gctx.fillRect(bx2, by2, barW * frac, barH);
      gctx.fillStyle = '#fff';
      gctx.font = '10px "Press Start 2P",monospace';
      gctx.textAlign = 'center';
      gctx.fillText('LV ' + (meBuff.level || 1), W/2, by2 - 8);
    }
  }

  // crosshair
  gctx.strokeStyle='#ffd24a'; gctx.lineWidth=2;
  gctx.beginPath();
  gctx.moveTo(mouseX-8,mouseY); gctx.lineTo(mouseX-2,mouseY);
  gctx.moveTo(mouseX+2,mouseY); gctx.lineTo(mouseX+8,mouseY);
  gctx.moveTo(mouseX,mouseY-8); gctx.lineTo(mouseX,mouseY-2);
  gctx.moveTo(mouseX,mouseY+2); gctx.lineTo(mouseX,mouseY+8);
  gctx.stroke();

  renderHUD();
}
requestAnimationFrame(render);

// ===== MENU MAP PREVIEW =====
const menuMM = $('menuMinimap');
const menuMMctx = menuMM.getContext('2d');
const MM_W=400, MM_H=300, MM_MAP_W=1600, MM_MAP_H=1200;
const mmSx=MM_W/MM_MAP_W, mmSy=MM_H/MM_MAP_H;

function buildMenuWalls() {
  const W=MM_MAP_W, H=MM_MAP_H, T=20, out=[];
  out.push({x:0,y:0,w:W,h:T}); out.push({x:0,y:H-T,w:W,h:T});
  out.push({x:0,y:0,w:T,h:H}); out.push({x:W-T,y:0,w:T,h:H});
  function hWall(x1,y1,x2){ if(x2>x1) out.push({x:x1,y:y1,w:x2-x1,h:T}); }
  function vWall(x1,y1,y2){ if(y2>y1) out.push({x:x1,y:y1,w:T,h:y2-y1}); }
  function building(x, y, w, h, g) {
    g = g || {};
    if (!g.t) hWall(x, y, x+w); else { hWall(x,y,g.t[0]); hWall(g.t[1],y,x+w); }
    if (!g.b) hWall(x, y+h-T, x+w); else { hWall(x,y+h-T,g.b[0]); hWall(g.b[1],y+h-T,x+w); }
    if (!g.l) vWall(x, y, y+h); else { vWall(x,y,g.l[0]); vWall(x,g.l[1],y+h); }
    if (!g.r) vWall(x+w-T, y, y+h); else { vWall(x+w-T,y,g.r[0]); vWall(x+w-T,g.r[1],y+h); }
  }
  building(200, 150, 280, 240, { b: [310, 380] });
  building(720, 100, 200, 180, { b: [790, 850] });
  building(1140, 150, 280, 260, { l: [220, 290], b: [1240, 1320] });
  building(180, 780, 280, 260, { t: [260, 330] });
  building(700, 880, 220, 200, { t: [770, 840], r: [950, 1020] });
  building(1140, 780, 280, 260, { l: [870, 940] });
  const pillars = [
    [580,460,50,50],[1000,500,50,50],[820,600,40,40],
    [560,720,40,40],[1040,700,40,40],[380,540,40,40],[1220,560,40,40],
  ];
  for (const p of pillars) out.push({x:p[0],y:p[1],w:p[2],h:p[3]});
  return out;
}
const menuWalls = buildMenuWalls();
let mmScanY = 0;

function renderMenuMinimap() {
  menuMMctx.imageSmoothingEnabled = false;
  // grass base
  menuMMctx.fillStyle = '#3e5a30'; menuMMctx.fillRect(0,0,MM_W,MM_H);
  const ts = Math.round(32*mmSx);
  if (ts >= 2) {
    for (let y=0;y<MM_H;y+=ts) for (let x=0;x<MM_W;x+=ts) {
      if (((x/ts)+(y/ts))%2===0) {
        menuMMctx.fillStyle='#4a6a3a'; menuMMctx.fillRect(x,y,ts,ts);
      }
    }
  }
  // stone walls
  for (const wall of menuWalls) {
    const wx=Math.floor(wall.x*mmSx), wy=Math.floor(wall.y*mmSy);
    const ww=Math.max(1,Math.ceil(wall.w*mmSx)), wh=Math.max(1,Math.ceil(wall.h*mmSy));
    menuMMctx.fillStyle='#1a1a24'; menuMMctx.fillRect(wx+2,wy+2,ww,wh);
    menuMMctx.fillStyle='#3a3a4a'; menuMMctx.fillRect(wx,wy,ww,wh);
    menuMMctx.fillStyle='#6a6a7a';
    menuMMctx.fillRect(wx,wy,ww,Math.max(1,Math.ceil(mmSy*3)));
    menuMMctx.fillRect(wx,wy,Math.max(1,Math.ceil(mmSx*3)),wh);
  }
  menuMMctx.fillStyle='rgba(122,252,255,0.06)'; menuMMctx.fillRect(0,mmScanY,MM_W,4);
  menuMMctx.fillStyle='rgba(122,252,255,0.20)'; menuMMctx.fillRect(0,mmScanY,MM_W,1);
  mmScanY = (mmScanY+1)%MM_H;
}
// Only render minimap when menu is visible — saves CPU during gameplay
setInterval(() => {
  if (!$('menu').classList.contains('hidden')) renderMenuMinimap();
}, 100);

// ============================================================
// CLASS PICKER (menu)
// ============================================================
function renderClassPicker() {
  const root = $('classPicker');
  if (!root) return;
  root.innerHTML = '';
  for (const [key, info] of Object.entries(CLASS_INFO)) {
    const b = document.createElement('button');
    b.className = 'class-btn pixel-btn small';
    b.innerHTML = `<div class="cls-label" style="color:${info.color}">${info.label}</div><div class="cls-desc">${info.desc}</div>`;
    if (state.cls === key) b.classList.add('selected');
    b.addEventListener('click', () => {
      state.cls = key;
      localStorage.setItem('gwClass', key);
      renderClassPicker();
      if (state.roomId) socket.emit('changeClass', { cls: key });
    });
    root.appendChild(b);
  }
}
renderClassPicker();

// ============================================================
// MAP PICKER + EDITOR (browser ↔ Supabase REST; shared across all clients)
// ============================================================
const SB = window.SUPABASE_CONFIG || {};
const SB_HEADERS = {
  'apikey': SB.key,
  'Authorization': 'Bearer ' + SB.key,
  'Content-Type': 'application/json',
};

async function sbListMaps() {
  const r = await fetch(`${SB.url}/rest/v1/maps?select=name&order=name`, { headers: SB_HEADERS });
  if (!r.ok) throw new Error('list ' + r.status);
  return (await r.json()).map(row => row.name);
}
async function sbGetMap(name) {
  const r = await fetch(`${SB.url}/rest/v1/maps?name=eq.${encodeURIComponent(name)}&select=walls`, { headers: SB_HEADERS });
  if (!r.ok) throw new Error('get ' + r.status);
  const rows = await r.json();
  return rows[0] ? rows[0].walls : null;
}
async function sbSaveMap(name, walls) {
  const r = await fetch(`${SB.url}/rest/v1/rpc/save_map`, {
    method: 'POST',
    headers: SB_HEADERS,
    body: JSON.stringify({
      p_name: name, p_walls: walls,
      p_password: window.MAP_EDITOR_PASSWORD || '',
    }),
  });
  if (!r.ok) throw new Error('save ' + r.status + ' ' + (await r.text()));
}
async function sbDeleteMap(name) {
  const r = await fetch(`${SB.url}/rest/v1/rpc/delete_map`, {
    method: 'POST',
    headers: SB_HEADERS,
    body: JSON.stringify({
      p_name: name,
      p_password: window.MAP_EDITOR_PASSWORD || '',
    }),
  });
  if (!r.ok) throw new Error('delete ' + r.status + ' ' + (await r.text()));
}

let serverMaps = ['default'];
async function refreshMapsFromSupabase() {
  try {
    const names = await sbListMaps();
    serverMaps = ['default', ...names.filter(n => n !== 'default')];
    if (!serverMaps.includes(state.mapName)) state.mapName = 'default';
    renderMapList();
  } catch (e) {
    console.warn('[maps] list failed:', e.message);
  }
}
// Server relays a hint when someone else saves/deletes — refetch the list.
socket.on('mapsUpdated', () => { refreshMapsFromSupabase(); });
// Initial load (independent of socket connection).
refreshMapsFromSupabase();

function renderMapList() {
  const root = $('mapList');
  if (!root) return;
  root.innerHTML = '';
  serverMaps.forEach(name => {
    const wrap = document.createElement('span');
    wrap.className = 'map-item';
    const b = document.createElement('button');
    b.className = 'pixel-btn small map-btn';
    b.textContent = name;
    if (state.mapName === name) b.classList.add('selected');
    b.addEventListener('click', () => {
      state.mapName = name;
      renderMapList();
    });
    wrap.appendChild(b);
    // Per-map delete (default is protected)
    if (name !== 'default') {
      const x = document.createElement('button');
      x.className = 'pixel-btn small map-del';
      x.textContent = '×';
      x.title = 'Haritayı sil';
      x.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (!requireMapPassword()) return;
        if (!confirm(name + ' haritasını silmek istediğine emin misin?')) return;
        try {
          await sbDeleteMap(name);
          if (state.mapName === name) state.mapName = 'default';
          socket.emit('mapDeleted', { name });
          await refreshMapsFromSupabase();
        } catch (err) {
          alert('Silinemedi: ' + err.message);
        }
      });
      wrap.appendChild(x);
    }
    root.appendChild(wrap);
  });
}

// ===== Editor =====
const WALL_STYLES = {
  stone: { base: '#3a3a4a', light: '#6a6a7a', dark: '#1a1a24', label: 'TAS',  swatch: '#5a5a6a' },
  wood:  { base: '#6b4220', light: '#a06030', dark: '#3a2010', label: 'AHSAP', swatch: '#8a5a2a' },
  brick: { base: '#a33c20', light: '#d05a30', dark: '#5a1a10', label: 'TUGLA', swatch: '#c4502a' },
  mesh:  { base: '#5a4a30', light: '#8a7050', dark: '#2a2018', label: 'TEL',  swatch: '#a08050' },
  tree:  { base: '#2a5a20', light: '#4a8a30', dark: '#1a3a14', label: 'AGAC', swatch: '#2a7a30' },
  water: { base: '#2a6a9a', light: '#4aa0d0', dark: '#1a4060', label: 'SU',   swatch: '#3a8ac0' },
};
// Available ground (grass/dirt) colors for the editor + custom maps
const GROUND_COLORS = [
  { name: 'cimen',   color: '#4a6a3a' },
  { name: 'kuruot',  color: '#9a8a3a' },
  { name: 'kum',     color: '#d0b070' },
  { name: 'kar',     color: '#d8e0e8' },
  { name: 'cam',     color: '#0a8a8a' },
  { name: 'kayal',   color: '#5a5a6a' },
  { name: 'lav',     color: '#a04020' },
  { name: 'mor',     color: '#5a2a6a' },
];
const EDITOR = {
  gridW: 40, gridH: 30, cellSize: 40,
  grid: null,            // 2D array: null or kind string
  brush: 'stone',        // currently selected paint kind, or 'erase'
  active: false,
  groundColor: '#4a6a3a',
};
// In-memory per-map ground color (used when host creates room with custom map).
// Encoded into walls array as a sentinel rect (w=0,h=0) so server's
// sanitizeWalls filters it out of collision but Supabase persists it.
function encodeGroundMeta(walls, groundColor) {
  return [...walls, { x:0, y:0, w:0, h:0, kind:'_meta', groundColor }];
}
function extractGroundColor(walls) {
  if (!Array.isArray(walls)) return '#4a6a3a';
  const meta = walls.find(w => w && w.kind === '_meta');
  return (meta && meta.groundColor) || '#4a6a3a';
}
function stripMeta(walls) {
  return Array.isArray(walls) ? walls.filter(w => w && w.kind !== '_meta') : walls;
}
function newGrid() {
  return Array.from({length: EDITOR.gridH}, () => Array(EDITOR.gridW).fill(null));
}
// Greedy merge: combine adjacent filled cells into the largest possible
// rectangles. A fully-filled 40x30 grid becomes ~1 rect instead of 1200,
// which is huge for both server collision and client rendering.
// Merge consecutive cells of the same kind only.
function gridToWalls(grid) {
  const W = EDITOR.gridW, H = EDITOR.gridH, CS = EDITOR.cellSize;
  // Breakable kinds (mesh) keep one rect per cell so destroying one cell
  // doesn't take out the whole row. Solid kinds get merged for perf.
  const NO_MERGE = new Set(['mesh']);
  const MAX_HEIGHT = { tree: 2 };
  const used = grid.map(row => row.map(() => false));
  const out = [];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const kind = grid[y][x];
      if (!kind || used[y][x]) continue;
      let w = 1, h = 1;
      if (!NO_MERGE.has(kind)) {
        while (x + w < W && grid[y][x+w] === kind && !used[y][x+w]) w++;
        const maxH = MAX_HEIGHT[kind] || Infinity;
        outer: while (y + h < H && h < maxH) {
          for (let xx = 0; xx < w; xx++) {
            if (grid[y+h][x+xx] !== kind || used[y+h][x+xx]) break outer;
          }
          h++;
        }
      }
      for (let yy = 0; yy < h; yy++)
        for (let xx = 0; xx < w; xx++) used[y+yy][x+xx] = true;
      out.push({x: x*CS, y: y*CS, w: w*CS, h: h*CS, kind});
    }
  }
  return out;
}
function wallsToGrid(walls) {
  const g = newGrid();
  for (const w of walls) {
    if (!w || w.w <= 0 || w.h <= 0) continue;
    const x0 = Math.max(0, Math.floor(w.x / EDITOR.cellSize));
    const y0 = Math.max(0, Math.floor(w.y / EDITOR.cellSize));
    const x1 = Math.min(EDITOR.gridW, Math.ceil((w.x+w.w) / EDITOR.cellSize));
    const y1 = Math.min(EDITOR.gridH, Math.ceil((w.y+w.h) / EDITOR.cellSize));
    const kind = WALL_STYLES[w.kind] ? w.kind : 'stone';
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) g[y][x] = kind;
  }
  return g;
}

function openEditor(name) {
  EDITOR.active = true;
  function withBlank() {
    EDITOR.grid = newGrid();
    EDITOR.groundColor = '#4a6a3a';
    for (let x = 0; x < EDITOR.gridW; x++) { EDITOR.grid[0][x] = 'stone'; EDITOR.grid[EDITOR.gridH-1][x] = 'stone'; }
    for (let y = 0; y < EDITOR.gridH; y++) { EDITOR.grid[y][0] = 'stone'; EDITOR.grid[y][EDITOR.gridW-1] = 'stone'; }
    $('editorName').value = name || 'map' + Math.floor(Math.random()*100);
    renderGroundPicker();
    show('editor'); drawEditor();
  }
  if (name && name !== 'default' && serverMaps.includes(name)) {
    sbGetMap(name).then(walls => {
      if (Array.isArray(walls)) {
        EDITOR.groundColor = extractGroundColor(walls);
        EDITOR.grid = wallsToGrid(stripMeta(walls));
        $('editorName').value = name;
        renderGroundPicker();
        show('editor'); drawEditor();
      } else withBlank();
    }).catch(() => withBlank());
  } else {
    withBlank();
  }
}

function drawEditor() {
  const cv = $('editorCanvas');
  if (!cv) return;
  const ctx = cv.getContext('2d');
  const cs = 24; // px per cell on screen — bigger editor (was 16)
  cv.width = EDITOR.gridW * cs;
  cv.height = EDITOR.gridH * cs;
  ctx.imageSmoothingEnabled = false;
  // ground (chosen color)
  ctx.fillStyle = EDITOR.groundColor || '#4a6a3a';
  ctx.fillRect(0,0,cv.width,cv.height);
  // grid
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  for (let x = 0; x <= EDITOR.gridW; x++) { ctx.beginPath(); ctx.moveTo(x*cs,0); ctx.lineTo(x*cs,cv.height); ctx.stroke(); }
  for (let y = 0; y <= EDITOR.gridH; y++) { ctx.beginPath(); ctx.moveTo(0,y*cs); ctx.lineTo(cv.width,y*cs); ctx.stroke(); }
  // walls — per cell by kind
  for (let y = 0; y < EDITOR.gridH; y++) for (let x = 0; x < EDITOR.gridW; x++) {
    const kind = EDITOR.grid[y][x];
    if (!kind) continue;
    if (kind === 'tree') { drawTree(ctx, x*cs, y*cs, cs, cs); continue; }
    if (kind === 'water') { drawWater(ctx, x*cs, y*cs, cs, cs); continue; }
    const s = WALL_STYLES[kind] || WALL_STYLES.stone;
    const tex = TEXTURES[kind];
    if (tex && tex.pattern) {
      ctx.save();
      ctx.translate(x*cs, y*cs);
      ctx.fillStyle = tex.pattern;
      ctx.fillRect(0, 0, cs, cs);
      ctx.restore();
    } else {
      ctx.fillStyle = s.base;  ctx.fillRect(x*cs, y*cs, cs, cs);
      ctx.fillStyle = s.light; ctx.fillRect(x*cs, y*cs, cs, 2);
      ctx.fillStyle = s.dark;  ctx.fillRect(x*cs, y*cs+cs-2, cs, 2);
    }
  }
}

function renderGroundPicker() {
  const root = $('groundPicker');
  if (!root) return;
  root.innerHTML = '';
  for (const g of GROUND_COLORS) {
    const b = document.createElement('button');
    b.className = 'pixel-btn small brush-btn';
    b.innerHTML = `<span class="brush-swatch" style="background:${g.color}"></span> ${g.name.toUpperCase()}`;
    if (EDITOR.groundColor === g.color) b.classList.add('selected');
    b.addEventListener('click', () => {
      EDITOR.groundColor = g.color;
      renderGroundPicker();
      drawEditor();
    });
    root.appendChild(b);
  }
}

(function setupEditorEvents(){
  const cv = $('editorCanvas');
  if (!cv) return;
  let dragMode = null;
  function cellAt(e) {
    const r = cv.getBoundingClientRect();
    const x = Math.floor((e.clientX - r.left) / (r.width  / EDITOR.gridW));
    const y = Math.floor((e.clientY - r.top)  / (r.height / EDITOR.gridH));
    if (x<0||y<0||x>=EDITOR.gridW||y>=EDITOR.gridH) return null;
    return {x, y};
  }
  cv.addEventListener('pointerdown', (e) => {
    const c = cellAt(e); if (!c) return;
    const target = EDITOR.brush === 'erase' ? null : EDITOR.brush;
    // If clicking an existing cell of same kind → erase that path; else paint
    if (target === null) dragMode = null;
    else if (EDITOR.grid[c.y][c.x] === target) dragMode = null;
    else dragMode = target;
    EDITOR.grid[c.y][c.x] = dragMode;
    drawEditor();
    cv.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  cv.addEventListener('pointermove', (e) => {
    if (e.buttons === 0) return;
    const c = cellAt(e); if (!c) return;
    if (EDITOR.grid[c.y][c.x] !== dragMode) {
      EDITOR.grid[c.y][c.x] = dragMode;
      drawEditor();
    }
  });
  function endDrag() { dragMode = null; }
  cv.addEventListener('pointerup', endDrag);
  cv.addEventListener('pointercancel', endDrag);
  cv.addEventListener('lostpointercapture', endDrag);
  cv.addEventListener('contextmenu', e => e.preventDefault());
})();

function renderBrushPicker() {
  const root = $('brushPicker');
  if (!root) return;
  root.innerHTML = '';
  for (const kind of ['stone','wood','brick','mesh','tree','water','erase']) {
    const b = document.createElement('button');
    b.className = 'pixel-btn small brush-btn';
    if (kind === 'erase') {
      b.textContent = 'SIL';
    } else {
      const s = WALL_STYLES[kind];
      b.innerHTML = `<span class="brush-swatch" style="background:${s.swatch}"></span> ${s.label}`;
    }
    if (EDITOR.brush === kind) b.classList.add('selected');
    b.addEventListener('click', () => { EDITOR.brush = kind; renderBrushPicker(); });
    root.appendChild(b);
  }
}
renderBrushPicker();

// Password gate for map create/delete. Caches the correct entry per session
// so the user is only prompted once.
function requireMapPassword() {
  const expected = window.MAP_EDITOR_PASSWORD;
  if (!expected) return true;
  if (sessionStorage.getItem('gwMapAuth') === expected) return true;
  const got = prompt('Harita şifresi:');
  if (got === expected) { sessionStorage.setItem('gwMapAuth', expected); return true; }
  if (got !== null) alert('Şifre yanlış');
  return false;
}

const btnEditMap = $('btnEditMap');
if (btnEditMap) btnEditMap.addEventListener('click', () => {
  if (!requireMapPassword()) return;
  openEditor(state.mapName !== 'default' ? state.mapName : null);
});
const btnClearEditor = $('btnClearEditor');
if (btnClearEditor) btnClearEditor.addEventListener('click', () => { EDITOR.grid = newGrid(); drawEditor(); });
const btnSaveMap = $('btnSaveMap');
if (btnSaveMap) btnSaveMap.addEventListener('click', async () => {
  if (!requireMapPassword()) return;
  const name = ($('editorName').value || '').trim().slice(0, 24);
  if (!name || name === 'default') return alert('Geçerli bir isim gir');
  const walls = encodeGroundMeta(gridToWalls(EDITOR.grid), EDITOR.groundColor);
  try {
    await sbSaveMap(name, walls);
    state.mapName = name;
    socket.emit('mapSaved', { name });
    await refreshMapsFromSupabase();
    show('rooms');
  } catch (e) {
    alert('Kaydedilemedi: ' + e.message);
  }
});
const btnCancelEditor = $('btnCancelEditor');
if (btnCancelEditor) btnCancelEditor.addEventListener('click', () => show('rooms'));
const btnDeleteMap = $('btnDeleteMap');
if (btnDeleteMap) btnDeleteMap.addEventListener('click', async () => {
  if (!requireMapPassword()) return;
  const name = ($('editorName').value || '').trim();
  if (!name || name === 'default') return;
  if (!confirm(name + ' haritasını silmek istediğine emin misin?')) return;
  try {
    await sbDeleteMap(name);
    if (state.mapName === name) state.mapName = 'default';
    socket.emit('mapDeleted', { name });
    await refreshMapsFromSupabase();
    show('rooms');
  } catch (e) {
    alert('Silinemedi: ' + e.message);
  }
});

renderMapList();

// ===== Ability button (HUD) =====
const abilityBtn = $('abilityBtn');
if (abilityBtn) abilityBtn.addEventListener('click', () => {
  const action = abilityBtn.dataset.action;
  if (action === 'placeTurret') socket.emit('placeTurret');
  else if (action === 'placePet') socket.emit('placePet');
});

// Track cyber rocket cooldown anchor (server sends timestamps via state — derive locally)
socket.on('tankMode', ({id, until}) => {
  // (visual handled via state.tank flag)
});

// =====================================================================
// IMPOSTER (Among-Us-like) MODE — client
// =====================================================================
let impWireTaskId = 0;
const IMP_USE_R2 = 80 * 80;       // client interaction range (a bit > server)
const IMP_REPORT_R2 = 100 * 100;
const IMP_VENT_R2 = 64 * 64;

function impCloseAllModals() {
  for (const id of ['roleReveal','taskModal','meetingModal','saboMenu']) {
    const el = $(id); if (el) el.classList.add('hidden');
  }
}
function impMe() {
  const st = state.imp && state.imp.st;
  if (!st) return null;
  return st.players.find(p => p.id === socket.id) || null;
}
function impNearestTask() {
  const me = impMe(); if (!me || !state.imp) return null;
  const map = state.imp.map.tasks || [];
  const myTasks = (state.imp.st.self.tasks || []).filter(t => !t.done);
  let best = null, bestD = IMP_USE_R2;
  for (const t of myTasks) {
    const d = (t.x-me.x)**2 + (t.y-me.y)**2;
    if (d < bestD) { bestD = d; best = t; }
  }
  return best;
}
function impNearVent() {
  const me = impMe(); if (!me || !state.imp) return null;
  for (const v of (state.imp.map.vents||[])) {
    if ((v.x-me.x)**2 + (v.y-me.y)**2 < IMP_VENT_R2) return v;
  }
  return null;
}
function impNearCorpse() {
  const me = impMe(); const st = state.imp && state.imp.st; if (!me || !st) return false;
  return (st.corpses||[]).some(c => (c.x-me.x)**2 + (c.y-me.y)**2 < IMP_REPORT_R2);
}
function impNearEmergency() {
  const me = impMe(); if (!me || !state.imp) return false;
  const e = state.imp.map.emergency; if (!e) return false;
  return (e.x-me.x)**2 + (e.y-me.y)**2 < IMP_USE_R2;
}
function impNearFix() {
  const me = impMe(); const st = state.imp && state.imp.st; if (!me || !st || !st.sabotage) return false;
  return (st.sabotage.fixPoints||[]).some(f => !f.fixed && (f.x-me.x)**2 + (f.y-me.y)**2 < IMP_USE_R2);
}

// Context action (E)
function impUse() {
  const me = impMe(); const st = state.imp && state.imp.st; if (!me || !st) return;
  if (st.self.vented) { socket.emit('impVent', { action: 'exit' }); return; }
  const task = impNearestTask();
  if (task) { impOpenWire(task.id); return; }
  if (st.sabotage && st.self.role === 'crew' && impNearFix()) { socket.emit('impFix'); return; }
  if (impNearEmergency()) { socket.emit('impEmergency'); return; }
  if (impNearVent() && st.self.role === 'imposter') { socket.emit('impVent', { action: 'enter' }); return; }
  if (impNearCorpse()) { socket.emit('impReport'); return; }
}
function impVentToggle() {
  const st = state.imp && state.imp.st; if (!st || st.self.role !== 'imposter') return;
  if (st.self.vented) socket.emit('impVent', { action: 'move' });
  else if (impNearVent()) socket.emit('impVent', { action: 'enter' });
}
function impToggleSaboMenu() {
  const st = state.imp && state.imp.st; if (!st || st.self.role !== 'imposter') return;
  $('saboMenu').classList.toggle('hidden');
}

// ---- socket handlers ----
socket.on('imposterRole', ({ role, tasks, teammates }) => {
  if (!state.imp) state.imp = { map:{}, st:null };
  state.imp.role = role; state.imp.tasks = tasks || []; state.imp.teammates = teammates || [];
  const t = $('roleTitle'), d = $('roleDesc'), m = $('roleMates');
  t.className = role === 'imposter' ? 'imp' : 'crew';
  if (role === 'imposter') {
    t.textContent = 'KATILSIN';
    d.textContent = 'Masumları sezdirmeden öldür. Sabotaj yap, ventlerden kaç. Oylamada yakalanma.';
    m.textContent = (teammates && teammates.length) ? 'Suç ortakların: ' + teammates.map(x=>x.name).join(', ') : 'Tek katil sensin.';
  } else {
    t.textContent = 'MASUMSUN';
    d.textContent = 'Görevlerini tamamla. Katili bul, ceset görünce rapor et, oylamada doğru kişiyi at.';
    m.textContent = '';
  }
  $('roleReveal').classList.remove('hidden');
  setTimeout(() => $('roleReveal').classList.add('hidden'), 4500);
});

socket.on('impState', (s) => {
  if (typeof s.t === 'number') {
    const off = s.t - Date.now();
    state.serverTimeOffset = state.serverTimeOffset == null ? off : state.serverTimeOffset*0.9 + off*0.1;
  }
  if (!state.imp) state.imp = { map:{}, st:null };
  state.imp.st = s;
  // meeting modal open/close driven by phase
  if (s.phase === 'meeting') {
    if ($('meetingModal').classList.contains('hidden')) impOpenMeeting();
    impRefreshMeeting();
  } else {
    if (!$('meetingModal').classList.contains('hidden')) $('meetingModal').classList.add('hidden');
  }
  impUpdateHud();
});

socket.on('meetingStart', () => { impOpenMeeting(); });
socket.on('meetingPhase', () => { impRefreshMeeting(); });
socket.on('meetingResult', ({ ejected, tie, skip }) => {
  let txt;
  if (tie || (!ejected && !skip)) txt = 'Oylama berabere — kimse atılmadı.';
  else if (skip || !ejected) txt = 'Kimse atılmadı (atlandı).';
  else txt = `${ejected.name} atıldı — ${ejected.wasImposter ? 'KATILDI! 🔪' : 'masumdu... 😢'}`;
  $('meetingResult2').textContent = txt;
  $('voteList').innerHTML = '';
  $('voteSkip').classList.add('hidden');
  _voteSig = '';
});

socket.on('sabotageStart', ({ type }) => {
  if (AUD.ctx && !AUD.muted) {
    const t = AUD.ctx.currentTime;
    AUD.playNote(48, t, 0.5, 'sawtooth', AUD.sfxGain, 0.25);
    AUD.playNote(43, t+0.25, 0.5, 'sawtooth', AUD.sfxGain, 0.25);
  }
});
socket.on('sabotageEnd', () => {});
socket.on('impKillFx', ({ x, y }) => {
  if (AUD.ctx && !AUD.muted) {
    const t = AUD.ctx.currentTime;
    AUD.playNote(72, t, 0.08, 'square', AUD.sfxGain, 0.3);
    AUD.playNote(48, t+0.05, 0.25, 'sawtooth', AUD.sfxGain, 0.3);
  }
});
socket.on('impYouDied', () => {
  $('impGhost').classList.remove('hidden');
});

// ---- HUD update ----
function impUpdateHud() {
  const st = state.imp && state.imp.st; if (!st) return;
  $('impTaskFill').style.width = (st.taskTotal ? (st.taskDone/st.taskTotal*100) : 0) + '%';
  $('impTaskTxt').textContent = 'Gorevler ' + st.taskDone + '/' + st.taskTotal;
  $('impGhost').classList.toggle('hidden', st.self.alive);
  const isImp = st.self.role === 'imposter';
  const killBtn = $('impKillBtn'), saboBtn = $('impSaboBtn'), ventBtn = $('impVentBtn');
  killBtn.classList.toggle('hidden', !isImp);
  saboBtn.classList.toggle('hidden', !isImp);
  ventBtn.classList.toggle('hidden', !isImp);
  if (isImp) {
    const cd = Math.ceil((st.self.killReadyIn||0)/1000);
    killBtn.disabled = cd > 0;
    killBtn.textContent = cd > 0 ? ('OLDUR ' + cd + 's') : 'OLDUR (Q)';
    const scd = Math.ceil((st.self.saboReadyIn||0)/1000);
    saboBtn.disabled = scd > 0;
    saboBtn.textContent = scd > 0 ? ('SABOTAJ ' + scd + 's') : 'SABOTAJ (G)';
    ventBtn.textContent = st.self.vented ? 'VENT GEZ (F)' : 'VENT (F)';
  }
  // report enabled near corpse
  $('impReportBtn').disabled = !impNearCorpse();
}

// ---- meeting voting UI ----
function impOpenMeeting() {
  $('meetingModal').classList.remove('hidden');
  $('meetingResult2').textContent = '';
  $('voteSkip').classList.remove('hidden');
  $('taskModal').classList.add('hidden');
  $('saboMenu').classList.add('hidden');
  _voteSig = '';
  impRefreshMeeting();
}
let _voteSig = '';
function impRefreshMeeting() {
  const st = state.imp && state.imp.st; if (!st || !st.meeting) return;
  const m = st.meeting;
  $('meetingTitle').textContent = m.reason === 'report' ? 'CESET BULUNDU' : 'ACIL TOPLANTI';
  const off = state.serverTimeOffset || 0;
  const rem = Math.max(0, Math.ceil((m.endsAt - (Date.now()+off))/1000));
  const phaseLbl = m.phase === 'vote' ? 'OYLAMA: ' : (m.phase === 'result' ? 'SONUC: ' : 'TARTISMA: ');
  $('meetingTimer').textContent = phaseLbl + rem + 's';   // cheap: update every frame
  if (m.phase === 'result') { _voteSig = ''; return; }
  const me = impMe();
  const canVote = m.phase === 'vote' && me && me.alive && !(m.voted||[]).includes(socket.id);
  // Rebuild the vote rows ONLY when something relevant changes — rebuilding
  // every frame destroyed the button you were clicking (voting felt broken)
  // and caused stutter.
  const voted = m.voted || [];
  const aliveIds = st.players.filter(p => p.alive).map(p => p.id);
  const sig = m.phase + '|' + canVote + '|' + voted.join(',') + '|' + aliveIds.join(',');
  if (sig === _voteSig) return;
  _voteSig = sig;
  const list = $('voteList'); list.innerHTML = '';
  for (const p of st.players) {
    if (!p.alive) continue;
    const row = document.createElement('div'); row.className = 'vote-row';
    const hasVoted = voted.includes(p.id) ? ' ✓' : '';
    row.innerHTML = `<span class="vname"><span class="vchip" style="background:${p.color}"></span>${p.name}${hasVoted}</span>`;
    const btn = document.createElement('button');
    btn.textContent = 'OY VER';
    btn.disabled = !canVote;
    btn.onclick = () => { socket.emit('impVote', { target: p.id }); };
    row.appendChild(btn);
    list.appendChild(row);
  }
  $('voteSkip').disabled = !canVote;
}
$('voteSkip').addEventListener('click', () => socket.emit('impVote', { target: 'skip' }));

// ---- HUD button bindings ----
$('impUseBtn').addEventListener('click', impUse);
$('impReportBtn').addEventListener('click', () => socket.emit('impReport'));
$('impKillBtn').addEventListener('click', () => socket.emit('impKill'));
$('impVentBtn').addEventListener('click', impVentToggle);
$('impSaboBtn').addEventListener('click', impToggleSaboMenu);
$('saboLights').addEventListener('click', () => { socket.emit('impSabotage', { type:'lights' }); $('saboMenu').classList.add('hidden'); });
$('saboReactor').addEventListener('click', () => { socket.emit('impSabotage', { type:'reactor' }); $('saboMenu').classList.add('hidden'); });
$('saboCancel').addEventListener('click', () => $('saboMenu').classList.add('hidden'));

// ---- wires minigame ----
let _wireState = null;
const wireCanvas = $('wireCanvas');
const wctx = wireCanvas.getContext('2d');
const WIRE_COLORS = ['#ff4040','#40d040','#4080ff','#ffd24a'];
function impOpenWire(taskId) {
  impWireTaskId = taskId;
  const left = WIRE_COLORS.map((c,i) => ({ c, y: 50+i*60, on:false }));
  const order = [0,1,2,3].sort(() => Math.random()-0.5);
  const right = order.map((idx,i) => ({ c: WIRE_COLORS[idx], y: 50+i*60, on:false, ci: idx }));
  _wireState = { left, right, sel: -1, links: 0 };
  $('taskModal').classList.remove('hidden');
  drawWire();
}
function drawWire() {
  if (!_wireState) return;
  const W = wireCanvas.width, H = wireCanvas.height;
  wctx.clearRect(0,0,W,H);
  wctx.fillStyle = '#0a0c12'; wctx.fillRect(0,0,W,H);
  const ws = _wireState;
  // draw established links
  for (const l of ws.left) {
    if (l.linkY != null) {
      wctx.strokeStyle = l.c; wctx.lineWidth = 8;
      wctx.beginPath(); wctx.moveTo(50, l.y); wctx.lineTo(W-50, l.linkY); wctx.stroke();
    }
  }
  // dots
  for (const l of ws.left) { wctx.fillStyle = l.c; wctx.fillRect(30, l.y-14, 28, 28); }
  for (const r of ws.right) { wctx.fillStyle = r.c; wctx.fillRect(W-58, r.y-14, 28, 28); }
  if (ws.sel >= 0) {
    const l = ws.left[ws.sel];
    wctx.strokeStyle = '#fff'; wctx.lineWidth = 2; wctx.strokeRect(28, l.y-16, 32, 32);
  }
}
wireCanvas.addEventListener('click', (e) => {
  if (!_wireState) return;
  const r = wireCanvas.getBoundingClientRect();
  const x = (e.clientX - r.left) * (wireCanvas.width / r.width);
  const y = (e.clientY - r.top) * (wireCanvas.height / r.height);
  const ws = _wireState;
  if (x < wireCanvas.width/2) {
    // pick a left dot
    for (let i=0;i<ws.left.length;i++) if (Math.abs(ws.left[i].y - y) < 24 && ws.left[i].linkY == null) { ws.sel = i; }
  } else if (ws.sel >= 0) {
    // connect to right dot of same color
    for (const rr of ws.right) {
      if (Math.abs(rr.y - y) < 24 && !rr.on && rr.c === ws.left[ws.sel].c) {
        rr.on = true; ws.left[ws.sel].linkY = rr.y; ws.links++; ws.sel = -1;
        if (AUD.ctx && !AUD.muted) AUD.playNote(72, AUD.ctx.currentTime, 0.1, 'square', AUD.sfxGain, 0.2);
        break;
      }
    }
  }
  drawWire();
  if (ws.links >= 4) {
    socket.emit('impTask', { id: impWireTaskId });
    if (AUD.ctx && !AUD.muted) [60,64,67].forEach((n,i)=>AUD.playNote(n, AUD.ctx.currentTime+i*0.06, 0.18,'square',AUD.sfxGain,0.25));
    setTimeout(() => $('taskModal').classList.add('hidden'), 350);
    _wireState = null;
  }
});
$('taskClose').addEventListener('click', () => { $('taskModal').classList.add('hidden'); _wireState = null; });

// ---- rendering ----
// Clean vector icons for ship objectives (no pixel font — renders crisply).
// type: 'task' | 'vent' | 'emergency' | 'fix'
function impDrawMarker(ctx, x, y, type, highlight) {
  ctx.save();
  if (highlight) {
    const pulse = 0.5 + 0.5*Math.sin(Date.now()/250);
    ctx.globalAlpha = 0.35 + pulse*0.45;
    ctx.fillStyle = '#ffd24a';
    ctx.beginPath(); ctx.arc(x, y, 22 + pulse*5, 0, Math.PI*2); ctx.fill();
    ctx.globalAlpha = 1;
  }
  const colors = { task:'#2fd6c0', vent:'#7a8090', emergency:'#ff4654', fix:'#ffae20' };
  const base = colors[type] || '#888';
  // token: outer ring + filled disc
  ctx.beginPath(); ctx.arc(x, y, 15, 0, Math.PI*2);
  ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fill();
  ctx.beginPath(); ctx.arc(x, y, 13, 0, Math.PI*2);
  ctx.fillStyle = base; ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.stroke();
  ctx.fillStyle = '#10141c'; ctx.strokeStyle = '#10141c';
  if (type === 'task') {
    // checkmark
    ctx.lineWidth = 2.6; ctx.lineCap = 'round'; ctx.beginPath();
    ctx.moveTo(x-5, y); ctx.lineTo(x-1, y+4); ctx.lineTo(x+6, y-5); ctx.stroke();
  } else if (type === 'vent') {
    // grate bars
    ctx.lineWidth = 2;
    for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(x-6, y+i*4); ctx.lineTo(x+6, y+i*4); ctx.stroke(); }
  } else if (type === 'emergency') {
    // exclamation
    ctx.fillRect(x-1.5, y-6, 3, 7); ctx.fillRect(x-1.5, y+3, 3, 3);
  } else if (type === 'fix') {
    // wrench cross
    ctx.lineWidth = 2.6; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x-5, y-5); ctx.lineTo(x+5, y+5); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x+5, y-5); ctx.lineTo(x-5, y+5); ctx.stroke();
  }
  ctx.restore();
}

function renderImposter() {
  const st = state.imp && state.imp.st;
  const W = gameCanvas.width, H = gameCanvas.height;
  gctx.imageSmoothingEnabled = false;
  gctx.fillStyle = '#0a0a14'; gctx.fillRect(0,0,W,H);
  if (!st) return;
  const me = impMe();
  const cx = me ? me.x : state.mapW/2, cy = me ? me.y : state.mapH/2;
  const targetCamX = Math.max(0, Math.min(state.mapW - W, cx - W/2));
  const targetCamY = Math.max(0, Math.min(state.mapH - H, cy - H/2));
  camX += (targetCamX - camX) * 0.18;
  camY += (targetCamY - camY) * 0.18;
  if (state.mapW < W) camX = (state.mapW - W)/2;
  if (state.mapH < H) camY = (state.mapH - H)/2;
  if (groundCache) {
    const icx = Math.floor(camX), icy = Math.floor(camY);
    const srcX = Math.max(0, icx), srcY = Math.max(0, icy);
    const srcW = Math.min(W, state.mapW - srcX), srcH = Math.min(H, state.mapH - srcY);
    const dstX = srcX - icx, dstY = srcY - icy;
    if (srcW > 0 && srcH > 0) gctx.drawImage(groundCache, srcX, srcY, srcW, srcH, dstX, dstY, srcW, srcH);
  }
  const map = state.imp.map || {};
  const myUndone = new Set((st.self.tasks||[]).filter(t=>!t.done).map(t=>t.id));
  // task points (only show your own remaining tasks for crew clarity)
  for (const t of (map.tasks||[])) {
    if (st.self.role === 'crew' && !myUndone.has(t.id)) continue;
    impDrawMarker(gctx, t.x-camX, t.y-camY, 'task', myUndone.has(t.id));
  }
  // vents (only shown to the impostor)
  if (st.self.role === 'imposter')
    for (const v of (map.vents||[])) impDrawMarker(gctx, v.x-camX, v.y-camY, 'vent', false);
  // emergency button
  if (map.emergency) impDrawMarker(gctx, map.emergency.x-camX, map.emergency.y-camY, 'emergency', impNearEmergency());
  // sabotage fix points
  if (st.sabotage) for (const f of st.sabotage.fixPoints) if (!f.fixed)
    impDrawMarker(gctx, f.x-camX, f.y-camY, 'fix', st.self.role==='crew');
  // corpses
  for (const c of (st.corpses||[])) {
    const x = c.x-camX, y = c.y-camY;
    gctx.save();
    gctx.fillStyle = 'rgba(120,0,0,0.5)'; gctx.beginPath(); gctx.ellipse(x, y+4, 20, 8, 0, 0, Math.PI*2); gctx.fill();
    gctx.fillStyle = c.color; gctx.beginPath(); gctx.arc(x, y, 12, 0, Math.PI*2); gctx.fill();
    gctx.fillStyle = '#fff'; gctx.fillRect(x-6, y-3, 4, 4); gctx.fillRect(x+2, y-3, 4, 4);
    gctx.restore();
  }
  // players
  for (const p of st.players) {
    const x = p.x-camX, y = p.y-camY;
    if (x < -40 || y < -40 || x > W+40 || y > H+40) continue;
    gctx.save();
    if (!p.alive || p.vented) gctx.globalAlpha = 0.5;
    drawRobotTopDown(gctx, x, y, p.color, p.angle||0, true, p.id, p.x, p.y, '', null, '');
    gctx.restore();
    gctx.fillStyle = '#000'; gctx.fillRect(x-30, y+22, 60, 12);
    gctx.fillStyle = p.id===socket.id ? '#ffd24a' : '#fff';
    gctx.font='10px "Press Start 2P",monospace'; gctx.textAlign='center';
    gctx.fillText((p.name||'').slice(0,8), x, y+32);
  }
  // vision mask / fog-of-war (ghosts see the whole ship). Fully opaque beyond
  // the light radius so you genuinely cannot see outside your view.
  if (me && st.self.alive) {
    const lightsOut = st.sabotage && st.sabotage.type === 'lights';
    const vis = lightsOut ? 170 : 340;
    const mx = me.x-camX, my = me.y-camY;
    const grad = gctx.createRadialGradient(mx, my, vis*0.6, mx, my, vis);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(0.85, lightsOut ? 'rgba(2,2,6,0.85)' : 'rgba(2,2,6,0.7)');
    grad.addColorStop(1, 'rgba(2,2,6,1)');     // solid black at the edge
    gctx.fillStyle = grad; gctx.fillRect(0,0,W,H);
  }
}
