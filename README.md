# Gold Wave

Browser-based multiplayer top-down shooter with pixel/Atari-style graphics. **Peer-to-peer (WebRTC) — no game server needed.**

## How to play with friends

Whoever creates a room becomes the host. Their browser runs the authoritative game state and other players' browsers connect to it directly via WebRTC.

You only need internet (PeerJS's free public broker is used for the initial handshake / NAT traversal). No port forwarding, no Hamachi, no Cloudflare tunnel.

### Steps
1. Open `public/index.html` in a modern browser (Chrome / Edge / Firefox). You can:
   - Run `npm start` then open `http://localhost:3000` (Node.js as a tiny static file server, no game logic).
   - Or just double-click `public/index.html` (file://) — works because PeerJS only needs internet for signaling.
   - Or host the `public/` folder on any static site (GitHub Pages, Netlify, etc.).
2. One player clicks **PLAY → ODA OLUSTUR**. A 5-letter room code appears in the lobby.
3. Share that code with friends.
4. Each friend opens the same page → **PLAY** → types the code → **KATIL**.
5. When everyone is in the lobby (max 10), the host clicks **BASLAT**.

### Controls
- **WASD** to move
- **Mouse** to aim, left click to fire (automatic rifle, 30-round mag)
- **R** to reload
- **ESC** to open pause / settings / leave

### Rounds
- 3 hearts per player, each heart = 10 HP.
- Hearts spawn on the map every 60s; pick them up to gain a life (max 5).
- 10-minute rounds, ends when only one player or zero alive.
- Same lobby auto-starts a new round.

## Architecture

- `public/peer-host.js` — `HostGame` class with the authoritative simulation (movement, bullets, collisions, ammo, hearts, rounds). Only runs on the room host's machine.
- `public/game.js` — UI, rendering, audio, i18n, and the `Net` layer that wraps PeerJS. Host mode owns a `HostGame`; joiner mode forwards inputs to the host.
- `server.js` — Optional ~30-line static file server. The game does **not** use it for networking.

## Notes
- Audio is procedural (Web Audio API), no asset files.
- TR/EN UI toggle in Settings.
- Map preview shown on the menu left-bottom.
