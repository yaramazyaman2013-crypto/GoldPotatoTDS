// ============ CLIENT ============
const socket = io();

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
  roomId: null,
  ownerId: null,
  selfId: null,
  inLobby: false,
  inGame: false,
  walls: [],
  mapW: 1600, mapH: 1200,
  endsAt: 0,
  serverState: null,
  killfeed: [],
};

// ===== Pixel art robot drawing =====
// 16x20 grid. 0 = transparent, 1=outline, 2=body, 3=screen, 4=eyes, 5=antenna
const ROBOT_SPRITE = [
  "0000000505000000",
  "0000000515000000",
  "0000011111100000",
  "0000122222210000",
  "0001222222221000",
  "0012233333322100",
  "0122334444332210",
  "0122334444332210",
  "0122333333332210",
  "0122222222222210",
  "0122222222222210",
  "0112222222222110",
  "0011222222221100",
  "0001122222110000",
  "0001212222121000",
  "0001212222121000",
  "0001210000121000",
  "0001210000121000",
  "0000110000110000",
  "0000110000110000",
];

function drawRobot(ctx, ox, oy, scale, color, angle = 0) {
  // angle: rotates the robot top-view. For preview pass 0.
  const cell = scale;
  const w = 16, h = 20;
  ctx.save();
  ctx.translate(ox + (w*cell)/2, oy + (h*cell)/2);
  ctx.rotate(angle);
  ctx.imageSmoothingEnabled = false;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const c = ROBOT_SPRITE[y][x];
      if (c === '0') continue;
      let fill;
      if (c === '1') fill = '#0a0a0a';
      else if (c === '2') fill = color;
      else if (c === '3') fill = '#1a1a2a';
      else if (c === '4') fill = '#7afcff';
      else if (c === '5') fill = '#ff3050';
      ctx.fillStyle = fill;
      ctx.fillRect(-((w*cell)/2) + x*cell, -((h*cell)/2) + y*cell, cell, cell);
    }
  }
  ctx.restore();
}

// Top-down robot for in-game (rotates with angle, includes weapon)
function drawRobotTopDown(ctx, x, y, color, angle, alive=true) {
  const r = 14;
  ctx.save();
  ctx.translate(x, y);
  // shadow
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.beginPath(); ctx.ellipse(2, 4, r+2, r/2, 0, 0, Math.PI*2); ctx.fill();
  if (!alive) ctx.globalAlpha = 0.35;
  ctx.rotate(angle);
  // body (pixel square chunks)
  const px = 3;
  function rect(cx, cy, cw, ch, col) {
    ctx.fillStyle = col;
    ctx.fillRect(Math.floor(cx), Math.floor(cy), cw, ch);
  }
  // outer outline
  rect(-r, -r+2, r*2, r*2-4, '#0a0a0a');
  // body fill
  rect(-r+2, -r+4, r*2-4, r*2-8, color);
  // screen face (facing forward = +x)
  rect(0, -r/2, r-2, r, '#1a1a2a');
  rect(0, -r/2, r-2, r, '#1a1a2a');
  // eyes on screen
  rect(r-8, -3, 2, 2, '#7afcff');
  rect(r-8,  1, 2, 2, '#7afcff');
  // antenna nub
  rect(-r-2, -1, 3, 3, '#ff3050');
  // weapon (rifle) — long rectangle pointing forward
  rect(r-2, -2, 14, 4, '#222');
  rect(r-2, -3, 4, 6, '#555');
  rect(r+8, -1, 4, 2, '#ffd24a');
  ctx.restore();
}

// shirt icon
function drawShirt(ctx) {
  ctx.clearRect(0,0,40,40);
  ctx.imageSmoothingEnabled = false;
  const map = [
    "0001111110000",
    "0011222211000",
    "0112222222100",
    "1122222222210",
    "1112222222110",
    "0012222222100",
    "0012222222100",
    "0012222222100",
    "0011111111100",
  ];
  const s = 3;
  for (let y=0;y<map.length;y++) for (let x=0;x<map[0].length;x++) {
    const c = map[y][x];
    if (c==='0') continue;
    ctx.fillStyle = c==='1' ? '#0a0a0a' : '#ffd24a';
    ctx.fillRect(x*s+2, y*s+4, s, s);
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

// character preview
const previewCanvas = $('charPreview');
const previewCtx = previewCanvas.getContext('2d');
previewCanvas.width = 160; previewCanvas.height = 200;
function renderPreview() {
  previewCtx.fillStyle = '#2a1f44';
  previewCtx.fillRect(0,0,160,200);
  // floor pattern
  previewCtx.fillStyle = '#3a2a5a';
  for (let i=0;i<160;i+=16) previewCtx.fillRect(i,180,8,8);
  drawRobot(previewCtx, 16, 0, 8, state.color);
}
renderPreview();

drawShirt($('shirtIcon').getContext('2d'));

// palette
const palette = $('colorPalette');
COLORS.forEach(c => {
  const cv = document.createElement('canvas');
  cv.width = 16; cv.height = 20;
  const cx = cv.getContext('2d');
  drawRobot(cx, 0, 0, 1, c);
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

$('btnPlay').addEventListener('click', () => { show('rooms'); refreshRooms(); });
$('btnSettings').addEventListener('click', () => show('settings'));
$('btnBack1').addEventListener('click', () => show('menu'));
$('btnBack2').addEventListener('click', () => show('menu'));

// ===== Rooms =====
function refreshRooms() {
  socket.emit('listRooms', (list) => {
    const root = $('roomList');
    root.innerHTML = '';
    if (!list.length) {
      root.innerHTML = '<div class="hint">Acik oda yok. Oda olustur.</div>';
      return;
    }
    list.forEach(r => {
      const row = document.createElement('div');
      row.className = 'room-row';
      row.innerHTML = `<span>${r.id}</span><span>${r.count}/${r.max}</span>`;
      const b = document.createElement('button');
      b.className = 'pixel-btn small'; b.textContent = 'KATIL';
      b.onclick = () => joinRoom(r.id);
      row.appendChild(b);
      root.appendChild(row);
    });
  });
}
$('btnCreateRoom').addEventListener('click', () => {
  socket.emit('createRoom', { name: state.name, color: state.color }, (res) => {
    if (res.ok) enterLobby(res.roomId, res.ownerId);
  });
});
$('btnJoinCode').addEventListener('click', () => {
  const code = $('joinCode').value.trim().toUpperCase();
  if (code) joinRoom(code);
});
function joinRoom(code) {
  socket.emit('joinRoom', { roomId: code, name: state.name, color: state.color }, (res) => {
    if (res.ok) enterLobby(res.roomId, res.ownerId);
    else alert(res.error);
  });
}

setInterval(() => { if (!$('rooms').classList.contains('hidden')) refreshRooms(); }, 3000);

function enterLobby(roomId, ownerId) {
  state.roomId = roomId; state.ownerId = ownerId;
  state.selfId = socket.id;
  $('lobbyCode').textContent = roomId;
  show('lobby');
}
$('btnLeave').addEventListener('click', () => {
  socket.emit('leaveRoom');
  state.roomId = null; state.ownerId = null;
  show('menu');
});
$('btnStart').addEventListener('click', () => socket.emit('startGame'));

socket.on('roomUpdate', (room) => {
  if (!state.roomId || room.id !== state.roomId) return;
  state.ownerId = room.ownerId;
  state.selfId = socket.id;
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
  if (k in keys) { keys[k] = true; sendInput(); }
});
window.addEventListener('keyup', e => {
  const k = e.key.toLowerCase();
  if (k in keys) { keys[k] = false; sendInput(); }
});
gameCanvas.addEventListener('mousemove', e => {
  const r = gameCanvas.getBoundingClientRect();
  mouseX = e.clientX - r.left;
  mouseY = e.clientY - r.top;
});
gameCanvas.addEventListener('mousedown', e => {
  if (e.button === 0) { mouseDown = true; sendInput(); }
});
window.addEventListener('mouseup', e => {
  if (e.button === 0) { mouseDown = false; sendInput(); }
});
gameCanvas.addEventListener('contextmenu', e => e.preventDefault());

let lastSent = 0;
function sendInput() {
  // computed on every animation frame too, this is for key events
}

function computeAngle() {
  if (!state.serverState) return 0;
  const me = state.serverState.players.find(p => p.id === socket.id);
  if (!me) return 0;
  const sx = me.x - camX, sy = me.y - camY;
  return Math.atan2(mouseY - sy, mouseX - sx);
}

setInterval(() => {
  if (!state.inGame) return;
  const angle = computeAngle();
  socket.emit('input', { keys, angle, mouseDown });
}, 50);

socket.on('roundStart', (data) => {
  state.walls = data.walls;
  state.mapW = data.mapW;
  state.mapH = data.mapH;
  state.endsAt = data.endsAt;
  state.inGame = true;
  state.killfeed = [];
  $('dead').classList.add('hidden');
  $('roundEnd').classList.add('hidden');
  show('game');
});

socket.on('state', (s) => {
  state.serverState = s;
  state.endsAt = s.endsAt;
});

socket.on('kill', ({ killer, victim }) => {
  state.killfeed.unshift({ killer, victim, t: Date.now() });
  if (state.killfeed.length > 6) state.killfeed.pop();
});

socket.on('roundEnd', ({ board, winner }) => {
  state.inGame = false;
  const overlay = $('roundEnd');
  overlay.classList.remove('hidden');
  $('winnerLine').textContent = winner ? `KAZANAN: ${winner.name} (${winner.kills} kill)` : 'KAZANAN YOK';
  const fb = $('finalBoard');
  fb.innerHTML = '';
  board.forEach(p => {
    const d = document.createElement('div');
    d.className = 'row';
    d.innerHTML = `<span>${p.name}</span><span>${p.kills}</span>`;
    fb.appendChild(d);
  });
});

// ===== Render loop =====
function renderHUD() {
  const ss = state.serverState;
  if (!ss) return;
  const me = ss.players.find(p => p.id === socket.id);
  // timer
  const remaining = Math.max(0, state.endsAt - Date.now());
  const mm = Math.floor(remaining/60000);
  const sec = Math.floor((remaining%60000)/1000);
  $('timer').textContent = String(mm).padStart(2,'0') + ':' + String(sec).padStart(2,'0');
  // hp bar
  const hp = me ? Math.max(0,me.hp) : 0;
  $('hpfill').style.width = (hp/3*100) + '%';
  // dead overlay
  $('dead').classList.toggle('hidden', !me || me.alive);
  // leaderboard
  const lb = $('leaderboard');
  const sorted = [...ss.players].sort((a,b)=>b.kills-a.kills);
  let html = '<h4>LIDERLIK</h4>';
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

function render() {
  requestAnimationFrame(render);
  if (!state.inGame || !state.serverState) return;
  const ss = state.serverState;
  const me = ss.players.find(p => p.id === socket.id);
  const W = gameCanvas.width, H = gameCanvas.height;

  // camera follows player (or center if dead)
  const cx = me ? me.x : state.mapW/2;
  const cy = me ? me.y : state.mapH/2;
  camX = cx - W/2;
  camY = cy - H/2;
  camX = Math.max(0, Math.min(state.mapW - W, camX));
  camY = Math.max(0, Math.min(state.mapH - H, camY));
  if (state.mapW < W) camX = (state.mapW - W)/2;
  if (state.mapH < H) camY = (state.mapH - H)/2;

  gctx.imageSmoothingEnabled = false;
  // floor (office carpet tiles)
  gctx.fillStyle = '#3a4a4a';
  gctx.fillRect(0,0,W,H);
  // tile grid
  const ts = 40;
  const sx = -((camX) % ts), sy = -((camY) % ts);
  for (let y = sy; y < H; y += ts) {
    for (let x = sx; x < W; x += ts) {
      const tx = Math.floor((x+camX)/ts), ty = Math.floor((y+camY)/ts);
      gctx.fillStyle = (tx+ty)%2===0 ? '#3a4a4a' : '#324242';
      gctx.fillRect(x, y, ts, ts);
    }
  }

  // walls (office desks/cubicles)
  for (const w of state.walls) {
    const x = w.x - camX, y = w.y - camY;
    if (x + w.w < 0 || y + w.h < 0 || x > W || y > H) continue;
    // base
    gctx.fillStyle = '#5a3a1a';
    gctx.fillRect(x, y, w.w, w.h);
    // top highlight
    gctx.fillStyle = '#8a5a2a';
    gctx.fillRect(x, y, w.w, 4);
    gctx.fillRect(x, y, 4, w.h);
    // shadow
    gctx.fillStyle = '#2a1a0a';
    gctx.fillRect(x, y+w.h-3, w.w, 3);
    gctx.fillRect(x+w.w-3, y, 3, w.h);
  }

  // hearts
  for (const h of ss.hearts) {
    drawHeart(gctx, h.x - camX, h.y - camY);
  }

  // bullets
  for (const b of ss.bullets) {
    const x = b.x - camX, y = b.y - camY;
    gctx.fillStyle = '#000';
    gctx.fillRect(x-3, y-3, 6, 6);
    gctx.fillStyle = '#ffd24a';
    gctx.fillRect(x-2, y-2, 4, 4);
  }

  // players
  for (const p of ss.players) {
    drawRobotTopDown(gctx, p.x - camX, p.y - camY, p.color, p.angle, p.alive);
    // name
    gctx.fillStyle = '#000';
    gctx.fillRect(p.x - camX - 30, p.y - camY - 30, 60, 12);
    gctx.fillStyle = p.id === socket.id ? '#ffd24a' : '#fff';
    gctx.font = '10px "Press Start 2P", monospace';
    gctx.textAlign = 'center';
    gctx.fillText(p.name.slice(0,8), p.x - camX, p.y - camY - 20);
    // hp pips
    for (let i = 0; i < 3; i++) {
      gctx.fillStyle = i < p.hp ? '#ff3050' : '#330000';
      gctx.fillRect(p.x - camX - 12 + i*9, p.y - camY + 18, 6, 6);
    }
  }

  // crosshair
  gctx.strokeStyle = '#ffd24a';
  gctx.lineWidth = 2;
  gctx.beginPath();
  gctx.moveTo(mouseX-8, mouseY); gctx.lineTo(mouseX-2, mouseY);
  gctx.moveTo(mouseX+2, mouseY); gctx.lineTo(mouseX+8, mouseY);
  gctx.moveTo(mouseX, mouseY-8); gctx.lineTo(mouseX, mouseY-2);
  gctx.moveTo(mouseX, mouseY+2); gctx.lineTo(mouseX, mouseY+8);
  gctx.stroke();

  renderHUD();
}
requestAnimationFrame(render);

function drawHeart(ctx, x, y) {
  // pixel heart
  const map = [
    "0110110",
    "1111111",
    "1111111",
    "0111110",
    "0011100",
    "0001000",
  ];
  const s = 3;
  ctx.fillStyle = '#000';
  ctx.fillRect(x - 11, y - 10, 22, 21);
  for (let yy=0; yy<map.length; yy++) {
    for (let xx=0; xx<map[0].length; xx++) {
      if (map[yy][xx] === '1') {
        ctx.fillStyle = (yy<2) ? '#ff5577' : '#ff3050';
        ctx.fillRect(x - 10 + xx*s, y - 9 + yy*s, s, s);
      }
    }
  }
}
