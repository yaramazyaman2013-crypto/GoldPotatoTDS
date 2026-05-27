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
  roomId: null, ownerId: null, selfId: null,
  isHost: false,
  inLobby: false, inGame: false,
  walls: [], mapW: 1600, mapH: 1200,
  endsAt: 0, serverState: null, killfeed: [],
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

$('btnCreateRoom').addEventListener('click', () => {
  if (connecting) return;
  setConnecting(true);
  setNetStatus(I18N[currentLang].connecting);
  socket.emit('createRoom', { name: state.name, color: state.color }, (res) => {
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
  socket.emit('joinRoom', { roomId: code, name: state.name, color: state.color }, (res) => {
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
  const root = $('lobbyPlayers');
  root.innerHTML = '';
  room.players.forEach(p => {
    const chip = document.createElement('div');
    chip.className = 'player-chip';
    chip.innerHTML = `<span class="swatch" style="background:${p.color}"></span><span>${p.name}${p.id===room.ownerId?' (host)':''}</span>`;
    root.appendChild(chip);
  });
  const isHost = room.ownerId === socket.id;
  $('btnStart').classList.toggle('hidden', !isHost);
  $('waitMsg').classList.toggle('hidden', isHost);
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
let mouseX = 0, mouseY = 0, mouseDown = false;

window.addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  if (k in keys) keys[k] = true;
  if (k === 'r' && state.inGame) {
    const me = state.serverState && state.serverState.players.find(p => p.id === socket.id);
    if (me && me.alive && !me.reloading && me.ammo < (me.maxAmmo || 30)) {
      socket.emit('reload');
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
gameCanvas.addEventListener('mousedown', e => { if (e.button===0) mouseDown = true; });
window.addEventListener('mouseup', e => { if (e.button===0) mouseDown = false; });
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
  socket.emit('input', { keys, angle: computeAngle(), mouseDown });
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
  lastAmmo = null; wasReloading = false;
  $('dead').classList.add('hidden');
  $('roundEnd').classList.add('hidden');
  show('game');
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
  // ammo
  if (me) {
    $('ammoCur').textContent = me.reloading ? '...' : me.ammo;
    const maxEl = $('ammo').querySelector('.max');
    if (maxEl) maxEl.textContent = '/' + (me.maxAmmo || 30);
    $('ammo').classList.toggle('reloading', !!me.reloading);
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
  gctx.fillStyle = '#3a4a4a';
  gctx.fillRect(0,0,W,H);
  const ts = 40;
  const sx = -(camX % ts), sy = -(camY % ts);
  for (let y = sy; y < H; y += ts) {
    for (let x = sx; x < W; x += ts) {
      const tx = Math.floor((x+camX)/ts), ty = Math.floor((y+camY)/ts);
      gctx.fillStyle = (tx+ty)%2===0 ? '#3a4a4a' : '#324242';
      gctx.fillRect(x, y, ts, ts);
    }
  }

  for (const w of state.walls) {
    const x = w.x-camX, y = w.y-camY;
    if (x+w.w<0||y+w.h<0||x>W||y>H) continue;
    gctx.fillStyle = '#5a3a1a'; gctx.fillRect(x,y,w.w,w.h);
    gctx.fillStyle = '#8a5a2a'; gctx.fillRect(x,y,w.w,4); gctx.fillRect(x,y,4,w.h);
    gctx.fillStyle = '#2a1a0a'; gctx.fillRect(x,y+w.h-3,w.w,3); gctx.fillRect(x+w.w-3,y,3,w.h);
  }

  for (const h of ss.hearts) drawHeart(gctx, h.x-camX, h.y-camY);

  for (const b of ss.bullets) {
    const x=b.x-camX, y=b.y-camY;
    gctx.fillStyle='#000'; gctx.fillRect(x-3,y-3,6,6);
    gctx.fillStyle='#ffd24a'; gctx.fillRect(x-2,y-2,4,4);
  }

  for (const p of ss.players) {
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
  const W=MM_MAP_W, H=MM_MAP_H, w=[];
  w.push({x:0,y:0,w:W,h:20}); w.push({x:0,y:H-20,w:W,h:20});
  w.push({x:0,y:0,w:20,h:H}); w.push({x:W-20,y:0,w:20,h:H});
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
    [1000,260,140,20],[1120,260,20,100],[740,540,160,50],
  ];
  for (const b of blocks) w.push({x:b[0],y:b[1],w:b[2],h:b[3]});
  return w;
}
const menuWalls = buildMenuWalls();
let mmScanY = 0;

function renderMenuMinimap() {
  menuMMctx.imageSmoothingEnabled = false;
  menuMMctx.fillStyle = '#1e2a2a'; menuMMctx.fillRect(0,0,MM_W,MM_H);
  const ts = Math.round(40*mmSx);
  if (ts >= 2) {
    for (let y=0;y<MM_H;y+=ts) for (let x=0;x<MM_W;x+=ts) {
      if (((x/ts)+(y/ts))%2===0) {
        menuMMctx.fillStyle='#182020'; menuMMctx.fillRect(x,y,ts,ts);
      }
    }
  }
  for (const wall of menuWalls) {
    const wx=Math.floor(wall.x*mmSx), wy=Math.floor(wall.y*mmSy);
    const ww=Math.max(1,Math.ceil(wall.w*mmSx)), wh=Math.max(1,Math.ceil(wall.h*mmSy));
    menuMMctx.fillStyle='#1a0e06'; menuMMctx.fillRect(wx+2,wy+2,ww,wh);
    menuMMctx.fillStyle='#6b4820'; menuMMctx.fillRect(wx,wy,ww,wh);
    menuMMctx.fillStyle='#9a6a30';
    menuMMctx.fillRect(wx,wy,ww,Math.max(1,Math.ceil(mmSy*3)));
    menuMMctx.fillRect(wx,wy,Math.max(1,Math.ceil(mmSx*3)),wh);
  }
  menuMMctx.fillStyle='rgba(122,252,255,0.06)'; menuMMctx.fillRect(0,mmScanY,MM_W,4);
  menuMMctx.fillStyle='rgba(122,252,255,0.20)'; menuMMctx.fillRect(0,mmScanY,MM_W,1);
  mmScanY = (mmScanY+1)%MM_H;
}
setInterval(renderMenuMinimap, 40);
