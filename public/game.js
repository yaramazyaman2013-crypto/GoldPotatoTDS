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
  mapName: 'default',
  roomId: null, ownerId: null, selfId: null,
  isHost: false,
  inLobby: false, inGame: false,
  walls: [], mapW: 1600, mapH: 1200,
  endsAt: 0, serverState: null, killfeed: [],
};

const CLASS_INFO = {
  cyber:    { label: 'CYBER',    desc: 'Her 55sn +1 füze',          color: '#7afcff' },
  engineer: { label: 'MUHENDIS', desc: '3dk: Taret koy (B tuşu)',    color: '#4a8aff' },
  medic:    { label: 'DOKTOR',   desc: '3.5dk: Heal pet (V tuşu)',   color: '#7ad24a' },
  tank:     { label: 'TANK',     desc: '5 kill → 20sn tank modu',    color: '#ff5577' },
};

// ===== Robot pixel art =====
const ROBOT_SPRITE = [
  "0000000505000000","0000000515000000",
  "0000011111100000","0000122222210000",
  "0001222222221000","0012233333322100",
  "0122334444332210","0122334444332210",
  "0122333333332210","0122222222222210",
  "0122222222222210","0112222222222110",
  "0011222222221100","0001122222110000",
  "0001212222121000","0001212222121000",
  "0001210000121000","0001210000121000",
  "0000110000110000","0000110000110000",
];

function drawRobot(ctx, ox, oy, scale, color) {
  const cell = scale, w = 16, h = 20;
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
      else if (c==='3') fill='#1a1a2a';
      else if (c==='4') fill='#7afcff';
      else if (c==='5') fill='#ff3050';
      ctx.fillStyle = fill;
      ctx.fillRect(-((w*cell)/2)+x*cell, -((h*cell)/2)+y*cell, cell, cell);
    }
  }
  ctx.restore();
}

// Cache robot body sprites per color. Each is drawn once to an offscreen
// canvas; the render loop then does a single drawImage + rotate instead
// of 15+ fillRect calls + ctx.ellipse per player per frame.
const _robotBodyCache = new Map();
const _ROBOT_CX = 22, _ROBOT_CY = 20, _ROBOT_CW = 50, _ROBOT_CH = 40;
function getRobotBody(color) {
  if (_robotBodyCache.has(color)) return _robotBodyCache.get(color);
  const cv = document.createElement('canvas');
  cv.width = _ROBOT_CW; cv.height = _ROBOT_CH;
  const c = cv.getContext('2d');
  c.imageSmoothingEnabled = false;
  const r = 14, cx = _ROBOT_CX, cy = _ROBOT_CY;
  c.fillStyle = '#0a0a0a'; c.fillRect(cx-r, cy-r+2, r*2, r*2-4);
  c.fillStyle = color;     c.fillRect(cx-r+2, cy-r+4, r*2-4, r*2-8);
  c.fillStyle = '#1a1a2a'; c.fillRect(cx, cy-r/2, r-2, r);
  c.fillStyle = '#7afcff'; c.fillRect(cx+r-8, cy-3, 2, 2); c.fillRect(cx+r-8, cy+1, 2, 2);
  c.fillStyle = '#ff3050'; c.fillRect(cx-r-2, cy-1, 3, 3);
  c.fillStyle = '#222';    c.fillRect(cx+r-2, cy-2, 14, 4);
  c.fillStyle = '#555';    c.fillRect(cx+r-2, cy-3, 4, 6);
  c.fillStyle = '#ffd24a'; c.fillRect(cx+r+8, cy-1, 4, 2);
  _robotBodyCache.set(color, cv);
  return cv;
}

function drawRobotTopDown(ctx, x, y, color, angle, alive=true) {
  ctx.save();
  ctx.translate(Math.floor(x), Math.floor(y));
  // cheap shadow rectangle (avoids expensive ctx.ellipse + beginPath)
  ctx.fillStyle = 'rgba(0,0,0,0.38)';
  ctx.fillRect(-18, -6, 36, 10);
  if (!alive) ctx.globalAlpha = 0.35;
  ctx.rotate(angle);
  ctx.drawImage(getRobotBody(color), -_ROBOT_CX, -_ROBOT_CY);
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

const previewCanvas = $('charPreview');
const previewCtx = previewCanvas.getContext('2d');
previewCanvas.width = 180; previewCanvas.height = 230;
function renderPreview() {
  previewCtx.imageSmoothingEnabled = false;
  previewCtx.fillStyle = '#2a1f44';
  previewCtx.fillRect(0,0,180,230);
  previewCtx.fillStyle = '#3a2a5a';
  for (let i=0;i<180;i+=16) previewCtx.fillRect(i,210,8,8);
  drawRobot(previewCtx, 18, 20, 9, state.color);
}
renderPreview();
drawShirt($('shirtIcon').getContext('2d'));

const palette = $('colorPalette');
COLORS.forEach(c => {
  const cv = document.createElement('canvas');
  cv.width = 16; cv.height = 20;
  drawRobot(cv.getContext('2d'), 0, 0, 1, c);
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

socket.on('roomUpdate', (room) => {
  if (!state.roomId || room.id !== state.roomId) return;
  renderLobby(room);
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
let mouseX = 0, mouseY = 0, leftDown = false, rightDown = false;

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
});
window.addEventListener('mouseup', e => {
  if (e.button === 0) leftDown = false;
  if (e.button === 2) rightDown = false;
});
gameCanvas.addEventListener('contextmenu', e => e.preventDefault());

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
  $('setVolume').value = Math.round(v * 100);
  $('pauseVolume').value = Math.round(v * 100);
  // Music volume: 25% of master so it stays as background
  if (bgMusic) bgMusic.volume = Math.max(0, Math.min(1, v * 0.25));
}
$('setVolume').addEventListener('input', (e) => syncVolume(parseInt(e.target.value,10)/100));
$('pauseVolume').addEventListener('input', (e) => syncVolume(parseInt(e.target.value,10)/100));

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
    state.walls.splice(i, 1);
    rebuildGroundCache();
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

function getInterpState() {
  if (!interpBuf.cur) return state.serverState;
  if (!interpBuf.prev) return interpBuf.cur;
  const dt = interpBuf.curAt - interpBuf.prevAt;
  if (dt <= 0) return interpBuf.cur;
  // renderTime is 40ms behind "now" so it falls between prev and cur
  const renderTime = performance.now() - INTERP_BUFFER_MS;
  const t = (renderTime - interpBuf.prevAt) / dt;
  if (t <= 0) return interpBuf.prev;
  if (t >= 1) return interpBuf.cur;
  // Fast lookup map — avoids O(n²) find() per frame
  if (!interpBuf._prevMap) {
    interpBuf._prevMap = new Map();
    for (const p of interpBuf.prev.players) interpBuf._prevMap.set(p.id, p);
  }
  const prevMap = interpBuf._prevMap;
  const players = interpBuf.cur.players.map(cp => {
    const pp = prevMap.get(cp.id);
    if (!pp || !pp.alive || !cp.alive) return cp;
    return {
      ...cp,
      x: pp.x + (cp.x - pp.x) * t,
      y: pp.y + (cp.y - pp.y) * t,
    };
  });
  return { ...interpBuf.cur, players };
}

let lastAmmo = null, wasReloading = false, lastRocketCount = 0;
socket.on('state', (s) => {
  // Advance interpolation buffer; clear cached prevMap so it rebuilds next frame
  interpBuf.prev = interpBuf.cur;
  interpBuf.prevAt = interpBuf.curAt;
  interpBuf._prevMap = null;
  interpBuf.cur = s;
  interpBuf.curAt = performance.now();

  state.serverState = s;
  state.endsAt = s.endsAt;
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
  // dead overlay
  $('dead').classList.toggle('hidden', !me || me.alive);
  // ammo (bullets) — rockets shown separately (right click)
  if (me) {
    $('ammoCur').textContent = me.reloading ? '...' : me.ammo;
    const maxEl = $('ammo').querySelector('.max');
    if (maxEl) maxEl.textContent = '/' + (me.maxAmmo || 30);
    $('ammo').classList.toggle('reloading', !!me.reloading);
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
    const now = Date.now();
    let label = '', ready = false, action = null;
    if (me.cls === 'engineer') {
      const rem = Math.max(0, (me.turretReadyAt||0) - now);
      ready = rem === 0; action = 'placeTurret';
      label = ready ? 'TARET KOY (B)' : 'TARET ' + Math.ceil(rem/1000) + 's';
    } else if (me.cls === 'medic') {
      const rem = Math.max(0, (me.petReadyAt||0) - now);
      ready = rem === 0; action = 'placePet';
      label = ready ? 'PET KOY (V)' : 'PET ' + Math.ceil(rem/1000) + 's';
    } else if (me.cls === 'cyber') {
      const rem = Math.max(0, 55000 - (now - (state.cyberAnchor||now)));
      label = 'FUZE ' + Math.ceil(rem/1000) + 's';
    } else if (me.cls === 'tank') {
      label = me.tank ? 'TANK ' + Math.ceil((me.tankUntil-now)/1000) + 's' : 'KILLS ' + (me.tankKills||0) + '/5';
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

// Stone texture (webp). Loaded once, scaled to a small tile, then used as
// repeating pattern so it actually reads as bricks at wall scale (40px cells).
const stoneImg = new Image();
let stonePattern = null;
const STONE_TILE = 64;
stoneImg.onload = () => {
  const tile = document.createElement('canvas');
  tile.width = STONE_TILE; tile.height = STONE_TILE;
  const tctx = tile.getContext('2d');
  tctx.imageSmoothingEnabled = false;
  tctx.drawImage(stoneImg, 0, 0, STONE_TILE, STONE_TILE);
  stonePattern = tctx.createPattern(tile, 'repeat');
  if (state.inGame) rebuildGroundCache();
};
stoneImg.onerror = () => console.warn('[stone] texture failed to load');
stoneImg.src = 'stone.webp';

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
  const s = WALL_STYLES[kind] || WALL_STYLES.stone;
  if (kind === 'stone' && stonePattern) {
    // Tile the webp texture; keep light/dark edges on top for chunky 3D look
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = stonePattern;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
    ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(x, y, w, 2); ctx.fillRect(x, y, 2, h);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';       ctx.fillRect(x, y+h-2, w, 2); ctx.fillRect(x+w-2, y, 2, h);
    return;
  }
  ctx.fillStyle = s.base; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = s.light; ctx.fillRect(x, y, w, 3); ctx.fillRect(x, y, 3, h);
  ctx.fillStyle = s.dark;  ctx.fillRect(x, y+h-3, w, 3); ctx.fillRect(x+w-3, y, 3, h);
  if (kind === 'brick') {
    // brick courses
    ctx.fillStyle = s.dark;
    for (let by = 10; by < h-2; by += 14) ctx.fillRect(x, y+by, w, 1);
    for (let by = 0; by < h; by += 14) {
      const offset = ((by/14)|0) % 2 === 0 ? 0 : 24;
      for (let bx = offset+12; bx < w-2; bx += 48) ctx.fillRect(x+bx, y+by+1, 1, 12);
    }
  } else if (kind === 'wood') {
    // wood planks (horizontal)
    ctx.fillStyle = s.dark;
    for (let by = 10; by < h-2; by += 12) ctx.fillRect(x, y+by, w, 1);
    // knots
    ctx.fillStyle = s.dark;
    for (let bx = 8; bx < w; bx += 28) { ctx.fillRect(x+bx, y+5, 2, 2); }
  } else if (kind === 'mesh') {
    // rusty wire mesh — diagonal cross-hatch
    ctx.fillStyle = '#2a1f10';
    for (let by = 0; by < h; by += 4) ctx.fillRect(x+3, y+by, w-6, 1);
    for (let bx = 0; bx < w; bx += 4) ctx.fillRect(x+bx, y+3, 1, h-6);
    // rust spots
    ctx.fillStyle = '#7a3a14';
    for (let bx = 6; bx < w-4; bx += 18) for (let by = 6; by < h-4; by += 18) {
      ctx.fillRect(x+bx, y+by, 2, 2);
    }
  } else {
    // stone seams
    ctx.fillStyle = s.dark;
    for (let bx = 12; bx < w-4; bx += 16) ctx.fillRect(x+bx, y+3, 1, h-6);
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
socket.on('explosion', ({x, y, r}) => {
  explosions.push({x, y, r, t: Date.now()});
});
function drawExplosions() {
  const now = Date.now();
  for (let i = explosions.length-1; i >= 0; i--) {
    const e = explosions[i];
    const age = now - e.t;
    if (age > 400) { explosions.splice(i, 1); continue; }
    const a = 1 - age/400;
    const rr = e.r * (0.3 + 0.7 * (age/400));
    gctx.fillStyle = `rgba(255, 200, 60, ${a * 0.6})`;
    gctx.beginPath(); gctx.arc(e.x - camX, e.y - camY, rr, 0, Math.PI*2); gctx.fill();
    gctx.fillStyle = `rgba(255, 100, 40, ${a * 0.9})`;
    gctx.beginPath(); gctx.arc(e.x - camX, e.y - camY, rr*0.6, 0, Math.PI*2); gctx.fill();
  }
}

function drawHeart(ctx, x, y) {
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
  // walls
  for (const w of state.walls) {
    drawWall(c, w.x, w.y, w.w, w.h, w.kind || 'stone');
  }
  groundCache = cv;
}

// ===== Player sprite cache =====
// Pre-render the life-pip row (most expensive player draw) onto a tiny
// offscreen canvas once per player-lives value so the render loop just
// calls drawImage instead of 130+ fillRect calls per player per frame.
const pipCache = new Map(); // key = `${lives}/${maxPips}` → ImageBitmap or canvas
const heartShape = ["01010","11111","11111","01110","00100"];
function getPipRow(lives, maxPips) {
  const key = `${lives}|${maxPips}`;
  if (pipCache.has(key)) return pipCache.get(key);
  const cell = 2, heartW = 5*cell, heartH = 5*cell, gap = 3;
  const totalW = maxPips*heartW + (maxPips-1)*gap;
  const cv = document.createElement('canvas');
  cv.width = totalW; cv.height = heartH;
  const c = cv.getContext('2d');
  c.imageSmoothingEnabled = false;
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

  // bullets / rockets
  for (const b of ss.bullets) {
    const x=b.x-camX, y=b.y-camY;
    if (x < -8 || y < -8 || x > W+8 || y > H+8) continue;
    if (b.type === 'rocket') drawRocket(gctx, x, y, b.angle||0);
    else {
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
    }
  }
  // turrets
  if (ss.turrets) {
    for (const tu of ss.turrets) {
      const x = tu.x - camX, y = tu.y - camY;
      // base
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
      // hp bar
      const hpw = 18, hpf = Math.max(0, tu.hp / 8) * hpw;
      gctx.fillStyle = '#000'; gctx.fillRect(x-9, y-14, hpw, 3);
      gctx.fillStyle = '#7ad24a'; gctx.fillRect(x-9, y-14, hpf, 3);
    }
  }

  for (const p of ss.players) {
    const px = p.x - camX, py = p.y - camY;
    if (px < -40 || py < -40 || px > W+40 || py > H+40) continue;
    if (p.tank) {
      const pulse = 0.6 + 0.4 * Math.sin(Date.now()/120);
      gctx.fillStyle = `rgba(255,80,90,${pulse*0.35})`;
      gctx.beginPath(); gctx.arc(p.x-camX, p.y-camY, 28, 0, Math.PI*2); gctx.fill();
    }
    drawRobotTopDown(gctx, p.x-camX, p.y-camY, p.color, p.angle, p.alive);
    gctx.fillStyle='#000'; gctx.fillRect(p.x-camX-30, p.y-camY-30, 60, 12);
    gctx.fillStyle = p.id===socket.id ? '#ffd24a' : '#fff';
    gctx.font='10px "Press Start 2P",monospace'; gctx.textAlign='center';
    gctx.fillText(p.name.slice(0,8), p.x-camX, p.y-camY-20);
    // life pips — cached offscreen canvas avoids 130+ fillRect per player/frame
    const lives = typeof p.lives==='number' ? p.lives : 0;
    const maxPips = 5, heartW = 10, gap = 3;
    const totalW = maxPips*heartW + (maxPips-1)*gap;
    const pipImg = getPipRow(lives, maxPips);
    const py2 = Math.floor(p.y-camY+22);
    gctx.drawImage(pipImg, Math.floor(p.x-camX-totalW/2), py2);
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
    const b = document.createElement('button');
    b.className = 'pixel-btn small map-btn';
    b.textContent = name;
    if (state.mapName === name) b.classList.add('selected');
    b.addEventListener('click', () => {
      state.mapName = name;
      renderMapList();
    });
    root.appendChild(b);
  });
}

// ===== Editor =====
const WALL_STYLES = {
  stone: { base: '#3a3a4a', light: '#6a6a7a', dark: '#1a1a24', label: 'TAS',  swatch: '#5a5a6a' },
  wood:  { base: '#6b4220', light: '#a06030', dark: '#3a2010', label: 'AHSAP', swatch: '#8a5a2a' },
  brick: { base: '#a33c20', light: '#d05a30', dark: '#5a1a10', label: 'TUGLA', swatch: '#c4502a' },
  mesh:  { base: '#5a4a30', light: '#8a7050', dark: '#2a2018', label: 'TEL',  swatch: '#a08050' },
  tree:  { base: '#2a5a20', light: '#4a8a30', dark: '#1a3a14', label: 'AGAC', swatch: '#2a7a30' },
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
  const used = grid.map(row => row.map(() => false));
  const out = [];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const kind = grid[y][x];
      if (!kind || used[y][x]) continue;
      let w = 1;
      while (x + w < W && grid[y][x+w] === kind && !used[y][x+w]) w++;
      let h = 1;
      outer: while (y + h < H) {
        for (let xx = 0; xx < w; xx++) {
          if (grid[y+h][x+xx] !== kind || used[y+h][x+xx]) break outer;
        }
        h++;
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
  const cs = 16; // px per cell on screen
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
    if (kind === 'tree') {
      drawTree(ctx, x*cs, y*cs, cs, cs);
      continue;
    }
    const s = WALL_STYLES[kind] || WALL_STYLES.stone;
    ctx.fillStyle = s.base;  ctx.fillRect(x*cs, y*cs, cs, cs);
    ctx.fillStyle = s.light; ctx.fillRect(x*cs, y*cs, cs, 2);
    ctx.fillStyle = s.dark;  ctx.fillRect(x*cs, y*cs+cs-2, cs, 2);
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
    // Use canvas internal pixel size so CSS scaling can't break clicks
    const sx = cv.width / r.width, sy = cv.height / r.height;
    const x = Math.floor(((e.clientX - r.left) * sx) / 16);
    const y = Math.floor(((e.clientY - r.top)  * sy) / 16);
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
  for (const kind of ['stone','wood','brick','mesh','tree','erase']) {
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
