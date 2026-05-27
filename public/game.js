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
  if (!AUD.started) { AUD.started = true; AUD.startMusic(); }
}
document.addEventListener('click', startAudioOnGesture);
document.addEventListener('keydown', startAudioOnGesture);

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
  cyber:    { label: 'CYBER',    desc: 'Her 2.5dk +1 füze',          color: '#7afcff' },
  engineer: { label: 'MUHENDIS', desc: '3dk: Taret koy (B tuşu)',    color: '#ffd24a' },
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

function drawRobotTopDown(ctx, x, y, color, angle, alive=true) {
  const r = 14;
  ctx.save(); ctx.translate(x, y);
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.beginPath(); ctx.ellipse(2, 4, r+2, r/2, 0, 0, Math.PI*2); ctx.fill();
  if (!alive) ctx.globalAlpha = 0.35;
  ctx.rotate(angle);
  function rect(cx, cy, cw, ch, col) {
    ctx.fillStyle = col;
    ctx.fillRect(Math.floor(cx), Math.floor(cy), cw, ch);
  }
  rect(-r, -r+2, r*2, r*2-4, '#0a0a0a');
  rect(-r+2, -r+4, r*2-4, r*2-8, color);
  rect(0, -r/2, r-2, r, '#1a1a2a');
  rect(r-8, -3, 2, 2, '#7afcff');
  rect(r-8,  1, 2, 2, '#7afcff');
  rect(-r-2, -1, 3, 3, '#ff3050');
  rect(r-2, -2, 14, 4, '#222');
  rect(r-2, -3, 4, 6, '#555');
  rect(r+8, -1, 4, 2, '#ffd24a');
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
const screens = ['menu','rooms','lobby','settings','game'];
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
      if (Array.isArray(walls)) payload.customMap = walls;
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
  if (!state.serverState) return 0;
  const me = state.serverState.players.find(p => p.id === socket.id);
  if (!me) return 0;
  const sx = me.x - camX, sy = me.y - camY;
  return Math.atan2(mouseY - sy, mouseX - sx);
}

function syncVolume(v) {
  AUD.setVolume(v);
  $('setVolume').value = Math.round(v * 100);
  $('pauseVolume').value = Math.round(v * 100);
}
$('setVolume').addEventListener('input', (e) => syncVolume(parseInt(e.target.value,10)/100));
$('pauseVolume').addEventListener('input', (e) => syncVolume(parseInt(e.target.value,10)/100));

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

// Input loop: ~33 Hz
setInterval(() => {
  if (!state.inGame) return;
  socket.emit('input', { keys, angle: computeAngle(), leftDown, rightDown });
}, 30);

// Footstep sounds
let lastStepAt = 0;
setInterval(() => {
  if (!state.inGame || !state.serverState) return;
  const me = state.serverState.players.find(p => p.id === socket.id);
  if (!me || !me.alive) return;
  if (!(keys.w||keys.a||keys.s||keys.d)) return;
  const now = Date.now();
  if (now - lastStepAt > 330) { AUD.step(); lastStepAt = now; }
}, 80);

// ===== Socket events =====
socket.on('roundStart', (data) => {
  state.walls = data.walls;
  state.mapW = data.mapW; state.mapH = data.mapH;
  state.endsAt = data.endsAt;
  state.inGame = true; state.killfeed = [];
  state.cyberAnchor = Date.now();
  lastAmmo = null; wasReloading = false;
  $('dead').classList.add('hidden');
  $('roundEnd').classList.add('hidden');
  show('game');
});

// Reset cyber anchor when this player auto-gains a rocket
let lastRocketCount = 0;
socket.on('state', (s) => {
  const me = s.players.find(p => p.id === socket.id);
  if (me && state.cls === 'cyber' && me.rockets > lastRocketCount) {
    state.cyberAnchor = Date.now();
  }
  if (me) lastRocketCount = me.rockets;
});

let lastAmmo = null, wasReloading = false;
socket.on('state', (s) => {
  state.serverState = s;
  state.endsAt = s.endsAt;
  const me = s.players.find(p => p.id === socket.id);
  if (me) {
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
function renderHUD() {
  const ss = state.serverState;
  if (!ss) return;
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
      const rem = Math.max(0, 150000 - (now - (state.cyberAnchor||now)));
      label = 'FUZE ' + Math.ceil(rem/1000) + 's';
    } else if (me.cls === 'tank') {
      label = me.tank ? 'TANK ' + Math.ceil((me.tankUntil-now)/1000) + 's' : 'KILLS ' + (me.kills||0) + '/5';
    }
    if (label) {
      ab.textContent = label;
      ab.classList.remove('hidden');
      ab.dataset.action = action || '';
      ab.classList.toggle('ready', ready);
    } else ab.classList.add('hidden');
  }
  // leaderboard
  const lb = $('leaderboard');
  const sorted = [...ss.players].sort((a,b)=>b.kills-a.kills);
  let html = `<h4>${I18N[currentLang].leaderboard}</h4>`;
  sorted.forEach(p => {
    html += `<div class="row" style="color:${p.alive?'#f0e8d8':'#777'}"><span>${p.name}</span><span>${p.kills}</span></div>`;
  });
  lb.innerHTML = html;
  // killfeed
  const kf = $('killfeed');
  kf.innerHTML = '';
  state.killfeed.forEach(k => {
    const d = document.createElement('div');
    d.textContent = `${k.killer} > ${k.victim}`;
    kf.appendChild(d);
  });
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

function render() {
  requestAnimationFrame(render);
  if (!state.inGame || !state.serverState) return;
  const ss = state.serverState;
  const me = ss.players.find(p => p.id === socket.id);
  const W = gameCanvas.width, H = gameCanvas.height;

  const cx = me ? me.x : state.mapW/2, cy = me ? me.y : state.mapH/2;
  camX = Math.max(0, Math.min(state.mapW - W, cx - W/2));
  camY = Math.max(0, Math.min(state.mapH - H, cy - H/2));
  if (state.mapW < W) camX = (state.mapW - W)/2;
  if (state.mapH < H) camY = (state.mapH - H)/2;

  gctx.imageSmoothingEnabled = false;
  // grass tile background
  gctx.fillStyle = '#4a6a3a';
  gctx.fillRect(0,0,W,H);
  const ts = 32;
  const sx = -(camX % ts), sy = -(camY % ts);
  for (let y = sy; y < H; y += ts) {
    for (let x = sx; x < W; x += ts) {
      const tx = Math.floor((x+camX)/ts), ty = Math.floor((y+camY)/ts);
      // checkered grass shades + occasional dirt patch (deterministic by tile)
      const hash = ((tx*73856093) ^ (ty*19349663)) >>> 0;
      const isDirt = (hash % 17) === 0;
      let col;
      if (isDirt) col = '#6b4a2a';
      else col = (tx+ty)%2===0 ? '#4a6a3a' : '#3e5a30';
      gctx.fillStyle = col;
      gctx.fillRect(x, y, ts, ts);
      // grass tuft decoration
      if (!isDirt && (hash % 23) === 0) {
        gctx.fillStyle = '#6a8a4a';
        gctx.fillRect(x+6, y+10, 2, 4);
        gctx.fillRect(x+10, y+8, 2, 6);
        gctx.fillRect(x+14, y+12, 2, 4);
      }
    }
  }

  // stone walls
  for (const w of state.walls) {
    const x = w.x-camX, y = w.y-camY;
    if (x+w.w<0||y+w.h<0||x>W||y>H) continue;
    gctx.fillStyle = '#3a3a4a'; gctx.fillRect(x,y,w.w,w.h);
    // top/left highlights (lighter stone)
    gctx.fillStyle = '#6a6a7a'; gctx.fillRect(x,y,w.w,3); gctx.fillRect(x,y,3,w.h);
    // bottom/right shadow
    gctx.fillStyle = '#1a1a24'; gctx.fillRect(x,y+w.h-3,w.w,3); gctx.fillRect(x+w.w-3,y,3,w.h);
    // brick texture: vertical seams
    gctx.fillStyle = '#2a2a36';
    for (let bx = 12; bx < w.w-4; bx += 16) gctx.fillRect(x+bx, y+3, 1, w.h-6);
  }

  // hearts and rocket pickups
  for (const h of ss.hearts) drawHeart(gctx, h.x-camX, h.y-camY);
  if (ss.rocketPickups) {
    for (const r of ss.rocketPickups) drawRocketPickup(gctx, r.x-camX, r.y-camY);
  }

  // bullets / rockets
  for (const b of ss.bullets) {
    const x=b.x-camX, y=b.y-camY;
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
    // life pips
    const lives = typeof p.lives==='number' ? p.lives : 0;
    const maxPips=5, heartShape=["01010","11111","11111","01110","00100"];
    const cell=2, heartW=5*cell, heartH=5*cell, gap=3;
    const totalW=maxPips*heartW+(maxPips-1)*gap;
    const hStartX=Math.floor(p.x-camX-totalW/2), py2=Math.floor(p.y-camY+22);
    for (let i=0;i<maxPips;i++) {
      const hx=hStartX+i*(heartW+gap), filled=i<lives;
      for (let yy=0;yy<5;yy++) for (let xx=0;xx<5;xx++) {
        if (heartShape[yy][xx]!=='1') continue;
        gctx.fillStyle='#000'; gctx.fillRect(hx+xx*cell-1,py2+yy*cell-1,cell+2,cell+2);
      }
      for (let yy=0;yy<5;yy++) for (let xx=0;xx<5;xx++) {
        if (heartShape[yy][xx]!=='1') continue;
        gctx.fillStyle = filled?(yy<2?'#ff6080':'#ff3050'):'#3a1018';
        gctx.fillRect(hx+xx*cell, py2+yy*cell, cell, cell);
      }
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
  const r = await fetch(`${SB.url}/rest/v1/maps`, {
    method: 'POST',
    headers: {...SB_HEADERS, 'Prefer': 'resolution=merge-duplicates,return=minimal'},
    body: JSON.stringify({ name, walls }),
  });
  if (!r.ok) throw new Error('save ' + r.status + ' ' + (await r.text()));
}
async function sbDeleteMap(name) {
  const r = await fetch(`${SB.url}/rest/v1/maps?name=eq.${encodeURIComponent(name)}`, {
    method: 'DELETE',
    headers: SB_HEADERS,
  });
  if (!r.ok) throw new Error('delete ' + r.status);
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
const EDITOR = {
  gridW: 40, gridH: 30, cellSize: 40, // 40*40=1600x1200
  grid: null, // 2D array boolean
  active: false,
};
function newGrid() {
  return Array.from({length: EDITOR.gridH}, () => Array(EDITOR.gridW).fill(false));
}
function gridToWalls(grid) {
  // Each filled cell becomes a 40x40 wall
  const out = [];
  for (let y = 0; y < EDITOR.gridH; y++)
    for (let x = 0; x < EDITOR.gridW; x++) {
      if (grid[y][x]) out.push({x: x*EDITOR.cellSize, y: y*EDITOR.cellSize, w: EDITOR.cellSize, h: EDITOR.cellSize});
    }
  return out;
}
function wallsToGrid(walls) {
  const g = newGrid();
  for (const w of walls) {
    const x0 = Math.max(0, Math.floor(w.x / EDITOR.cellSize));
    const y0 = Math.max(0, Math.floor(w.y / EDITOR.cellSize));
    const x1 = Math.min(EDITOR.gridW, Math.ceil((w.x+w.w) / EDITOR.cellSize));
    const y1 = Math.min(EDITOR.gridH, Math.ceil((w.y+w.h) / EDITOR.cellSize));
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) g[y][x] = true;
  }
  return g;
}

function openEditor(name) {
  EDITOR.active = true;
  function withBlank() {
    EDITOR.grid = newGrid();
    for (let x = 0; x < EDITOR.gridW; x++) { EDITOR.grid[0][x] = true; EDITOR.grid[EDITOR.gridH-1][x] = true; }
    for (let y = 0; y < EDITOR.gridH; y++) { EDITOR.grid[y][0] = true; EDITOR.grid[y][EDITOR.gridW-1] = true; }
    $('editorName').value = name || 'map' + Math.floor(Math.random()*100);
    show('editor'); drawEditor();
  }
  if (name && name !== 'default' && serverMaps.includes(name)) {
    sbGetMap(name).then(walls => {
      if (Array.isArray(walls)) {
        EDITOR.grid = wallsToGrid(walls);
        $('editorName').value = name;
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
  // grass bg
  ctx.fillStyle = '#3e5a30'; ctx.fillRect(0,0,cv.width,cv.height);
  // grid
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  for (let x = 0; x <= EDITOR.gridW; x++) { ctx.beginPath(); ctx.moveTo(x*cs,0); ctx.lineTo(x*cs,cv.height); ctx.stroke(); }
  for (let y = 0; y <= EDITOR.gridH; y++) { ctx.beginPath(); ctx.moveTo(0,y*cs); ctx.lineTo(cv.width,y*cs); ctx.stroke(); }
  // walls
  for (let y = 0; y < EDITOR.gridH; y++) for (let x = 0; x < EDITOR.gridW; x++) {
    if (!EDITOR.grid[y][x]) continue;
    ctx.fillStyle = '#3a3a4a'; ctx.fillRect(x*cs, y*cs, cs, cs);
    ctx.fillStyle = '#6a6a7a'; ctx.fillRect(x*cs, y*cs, cs, 2);
    ctx.fillStyle = '#1a1a24'; ctx.fillRect(x*cs, y*cs+cs-2, cs, 2);
  }
}

(function setupEditorEvents(){
  const cv = $('editorCanvas');
  if (!cv) return;
  let dragMode = null; // true = paint, false = erase
  function paintAt(e) {
    const r = cv.getBoundingClientRect();
    const x = Math.floor((e.clientX - r.left) / 16);
    const y = Math.floor((e.clientY - r.top)  / 16);
    if (x<0||y<0||x>=EDITOR.gridW||y>=EDITOR.gridH) return;
    EDITOR.grid[y][x] = dragMode;
    drawEditor();
  }
  cv.addEventListener('mousedown', (e) => {
    const r = cv.getBoundingClientRect();
    const x = Math.floor((e.clientX - r.left) / 16);
    const y = Math.floor((e.clientY - r.top)  / 16);
    if (x<0||y<0||x>=EDITOR.gridW||y>=EDITOR.gridH) return;
    dragMode = !EDITOR.grid[y][x];
    EDITOR.grid[y][x] = dragMode;
    drawEditor();
  });
  cv.addEventListener('mousemove', (e) => { if (e.buttons === 1 && dragMode !== null) paintAt(e); });
  window.addEventListener('mouseup', () => { dragMode = null; });
})();

const btnEditMap = $('btnEditMap');
if (btnEditMap) btnEditMap.addEventListener('click', () => openEditor(state.mapName !== 'default' ? state.mapName : null));
const btnClearEditor = $('btnClearEditor');
if (btnClearEditor) btnClearEditor.addEventListener('click', () => { EDITOR.grid = newGrid(); drawEditor(); });
const btnSaveMap = $('btnSaveMap');
if (btnSaveMap) btnSaveMap.addEventListener('click', async () => {
  const name = ($('editorName').value || '').trim().slice(0, 24);
  if (!name || name === 'default') return alert('Geçerli bir isim gir');
  const walls = gridToWalls(EDITOR.grid);
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
  const name = ($('editorName').value || '').trim();
  if (!name || name === 'default') return;
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
