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
  shoot() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const buf = this.ctx.createBuffer(1, 3200, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random()*2-1) * Math.pow(1 - i/d.length, 2);
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass'; filter.frequency.value = 1200; filter.Q.value = 0.8;
    const g = this.ctx.createGain(); g.gain.value = 0.5;
    src.connect(filter); filter.connect(g); g.connect(this.sfxGain);
    src.start(t);
    const osc = this.ctx.createOscillator();
    const og = this.ctx.createGain();
    osc.type = 'square'; osc.frequency.setValueAtTime(120, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.08);
    og.gain.setValueAtTime(0.3, t);
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
  roomId: null, ownerId: null, selfId: null,
  isHost: false,
  inLobby: false, inGame: false,
  walls: [], mapW: 1600, mapH: 1200,
  endsAt: 0, serverState: null, killfeed: [],
};

const CLASS_INFO = {
  cyber:    { label: 'CYBER',    desc: '1 füze ile başlar<br>Her 50sn: +3 füze (mavi)',    color: '#7afcff' },
  engineer: { label: 'MUHENDIS', desc: '70sn: Taret koy (B)<br>25 mermi, 4.5sn reload',   color: '#4a8aff' },
  medic:    { label: 'DOKTOR',   desc: '65sn: Pet (V, 10sn ömür)<br>2.5dk: +1 can',       color: '#7ad24a' },
  tank:     { label: 'TANK',     desc: '3 kill: 30sn tank modu<br>25 HP, büyük, x2 hasar',color: '#ff5577' },
  pyro:     { label: 'PYRO',     desc: 'Alev silahı<br>Yakın mesafe, sürekli hasar',       color: '#ff7a1a' },
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

const _gunImg = new Image();
_gunImg.src = 'gun.png';
const _flameImg = new Image();
_flameImg.src = 'flame.png';

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
  if (rot) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rot);
    ctx.drawImage(img, -hatW / 2, -hatH / 2, hatW, hatH);
    ctx.restore();
  } else {
    ctx.drawImage(img, Math.round(cx - hatW / 2), Math.round(cy - hatH / 2), hatW, hatH);
  }
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
  // Rolling animation: smooth time-based wobble when moving
  const rs = id ? updateRoll(id, wx, wy) : null;
  if (rs && rs.speed > 0.5 && alive) {
    const now = Date.now();
    const moveAng = Math.atan2(rs.vy, rs.vx);
    const lean = 0.12;
    const wobble = Math.sin(now / 100) * 0.08;
    const bob = Math.abs(Math.sin(now / 100)) * 1.5;
    ctx.rotate(moveAng);
    ctx.rotate(lean + wobble);
    ctx.rotate(-moveAng);
    ctx.translate(0, -bob);
  }
  ctx.drawImage(getRobotBody(color, !hat), -_ROBOT_CX, -_ROBOT_CY);
  if (hat) drawHat(ctx, hat, 36, hatCfg);
  // draw weapon rotated toward cursor
  const weaponImg = cls === 'pyro' ? _flameImg : _gunImg;
  if (weaponImg.complete && weaponImg.naturalWidth > 0) {
    ctx.save();
    ctx.translate(0, 8);
    ctx.rotate(angle);
    if (cls === 'pyro') {
      const gw = 36, gh = 20;
      ctx.drawImage(weaponImg, 2, -gh / 2, gw, gh);
    } else {
      const gw = 32, gh = 16;
      ctx.drawImage(weaponImg, 2, -gh / 2, gw, gh);
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

$('btnCreateRoom').addEventListener('click', async () => {
  if (connecting) return;
  setConnecting(true);
  setNetStatus(I18N[currentLang].connecting);
  const payload = { name: state.name, color: state.color, cls: state.cls, mapName: state.mapName };
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
      if (state.hat) socket.emit('setHat', { hat: state.hat });
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
      if (state.hat) socket.emit('setHat', { hat: state.hat });
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
  if (mapEl) mapEl.textContent = 'Harita: ' + (room.mapName || 'default');
}

function enterLobby(roomId, ownerId) {
  state.roomId = roomId; state.ownerId = ownerId;
  $('lobbyCode').textContent = roomId;
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
  if (k === 'r' && state.inGame) {
    const me = state.serverState && state.serverState.players.find(p => p.id === socket.id);
    if (me && me.alive && !me.reloading && me.ammo < (me.maxAmmo || 30)) {
      socket.emit('reload');
    }
  }
  if (k === 'b' && state.inGame) socket.emit('placeTurret');
  if (k === 'v' && state.inGame) socket.emit('placePet');
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
  state.endsAt = data.endsAt;
  state.inGame = true; state.killfeed = [];
  state.cyberAnchor = Date.now();
  lastAmmo = null; wasReloading = false;
  $('dead').classList.add('hidden');
  $('roundEnd').classList.add('hidden');
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
const _lastHp = new Map();        // player id → last seen hp
const damageNumbers = [];         // { id, dmg, t }
socket.on('state', (s) => {
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
    if (lastAmmo !== null && me.ammo < lastAmmo) {
      const shots = lastAmmo - me.ammo;
      for (let i = 0; i < shots; i++) AUD.shoot();
    }
    if (me.reloading && !wasReloading) AUD.reload();
    lastAmmo = me.ammo; wasReloading = me.reloading;
  }
});

socket.on('heal', ({ id, amount }) => {
  if (!amount) return;
  damageNumbers.push({ id, dmg: -amount, t: Date.now(), seed: Math.random() });
});

socket.on('kill', ({ killer, victim }) => {
  state.killfeed.unshift({ killer, victim, t: Date.now() });
  if (state.killfeed.length > 6) state.killfeed.pop();
});

socket.on('roundEnd', ({ board, winner }) => {
  state.inGame = false;
  $('roundEnd').classList.remove('hidden');
  const d = I18N[currentLang];
  $('winnerLine').textContent = winner
    ? `${d.winner}: ${winner.name} (${winner.kills} ${d.kills})`
    : d.noWinner;
  const fb = $('finalBoard');
  fb.innerHTML = '';
  board.forEach(p => {
    const div = document.createElement('div');
    div.className = 'row';
    div.innerHTML = `<span style="color:${p.color}">${p.name}</span><span>${p.kills} ${d.kills}</span>`;
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
  // timer
  const remaining = Math.max(0, state.endsAt - Date.now());
  const mm = Math.floor(remaining/60000);
  const sec = Math.floor((remaining%60000)/1000);
  $('timer').textContent = String(mm).padStart(2,'0')+':'+String(sec).padStart(2,'0');
  // hp bar (current life HP)
  const hp = me ? Math.max(0, me.hp) : 0;
  const maxHp = me && me.maxHp ? me.maxHp : 10;
  $('hpfill').style.width = Math.min(100, hp/maxHp*100) + '%';
  $('hptext').textContent = hp + ' / ' + maxHp;
  // dead overlay
  $('dead').classList.toggle('hidden', !me || me.alive);
  // ammo (bullets) — rockets shown separately (right click)
  if (me) {
    if (me.cls === 'pyro') {
      $('ammoCur').textContent = '🔥';
      const maxEl = $('ammo').querySelector('.max');
      if (maxEl) maxEl.textContent = '';
      $('ammo').classList.remove('reloading');
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
      d.textContent = `${k.killer} > ${k.victim}`;
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
    const text = isHeal ? '+' + (-d.dmg) : '-' + d.dmg;
    const color = isHeal ? '90,255,130' : '255,90,90';
    gctx.fillStyle = `rgba(0,0,0,${a})`;
    gctx.fillText(text, x + 1, y + 1);
    gctx.fillStyle = `rgba(${color},${a})`;
    gctx.fillText(text, x, y);
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

  // bullets / rockets
  for (const b of ss.bullets) {
    const x=b.x-camX, y=b.y-camY;
    if (x < -8 || y < -8 || x > W+8 || y > H+8) continue;
    if (b.type === 'rocket') drawRocket(gctx, x, y, b.angle||0);
    else if (b.type === 'flame') {
      const flick = Math.random();
      gctx.fillStyle = `rgba(255,${100+Math.floor(flick*80)},0,0.85)`;
      gctx.beginPath(); gctx.arc(x, y, 4 + flick*3, 0, Math.PI*2); gctx.fill();
      gctx.fillStyle = `rgba(255,240,80,0.7)`;
      gctx.beginPath(); gctx.arc(x, y, 2, 0, Math.PI*2); gctx.fill();
    } else {
      gctx.fillStyle='#000'; gctx.fillRect(x-3,y-3,6,6);
      gctx.fillStyle='#ffd24a'; gctx.fillRect(x-2,y-2,4,4);
    }
  }
  drawExplosions();

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
      if (pt.expiresAt) {
        const secsLeft = Math.max(0, Math.ceil((pt.expiresAt - Date.now()) / 1000));
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
