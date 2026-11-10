// Procedural dungeon: rooms + wide corridors + liquid pools, BFS utilities.
export const WALL = 0, FLOOR = 1, LIQUID = 2;
export const TILE = 2; // world units per cell

export function mulberry(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export class Dungeon {
  constructor(seed, floor, style = 'halls') {
    this.style = style;
    this.rand = mulberry(seed);
    const size = Math.min(40 + floor * 2, 60);
    this.w = size; this.h = size;
    this.grid = new Uint8Array(this.w * this.h);
    this.explored = new Uint8Array(this.w * this.h);
    this.rooms = [];
    this.traps = [];
    this.shrine = null;
    this.generate(floor);
  }
  idx(x, y) { return y * this.w + x; }
  get(x, y) { if (x < 0 || y < 0 || x >= this.w || y >= this.h) return WALL; return this.grid[y * this.w + x]; }
  set(x, y, v) { if (x > 0 && y > 0 && x < this.w - 1 && y < this.h - 1) this.grid[y * this.w + x] = v; }
  walkable(x, y) { return this.get(x, y) === FLOOR; }
  ri(a, b) { return a + Math.floor(this.rand() * (b - a + 1)); }

  generate(floor) {
    const target = Math.min(7 + Math.floor(floor / 2), 13);
    for (let tries = 0; tries < 400 && this.rooms.length < target; tries++) {
      const w = this.ri(6, 11), h = this.ri(6, 11);
      const x = this.ri(2, this.w - w - 3), y = this.ri(2, this.h - h - 3);
      let ok = true;
      for (const r of this.rooms) {
        if (x < r.x + r.w + 3 && x + w + 3 > r.x && y < r.y + r.h + 3 && y + h + 3 > r.y) { ok = false; break; }
      }
      if (!ok) continue;
      this.rooms.push({ x, y, w, h, cx: Math.floor(x + w / 2), cy: Math.floor(y + h / 2) });
    }
    const shapes = {
      halls: ['rect', 'rect', 'pillars', 'octagon'],
      caves: ['cave', 'cave', 'round', 'cave'],
      round: ['round', 'octagon', 'round', 'pillars'],
      organic: ['cave', 'round', 'cave', 'rect'],
      temple: ['cross', 'octagon', 'pillars', 'cross'],
    }[this.style] || ['rect'];
    this.rooms.forEach((r, k) => {
      r.shape = k === 0 ? (this.style === 'caves' || this.style === 'organic' ? 'round' : 'rect') : shapes[Math.floor(this.rand() * shapes.length)];
      this.carveRoom(r);
    });
    // liquid pools in bigger rooms (skip first room = spawn)
    for (let k = 1; k < this.rooms.length; k++) {
      const r = this.rooms[k];
      if (r.w >= 8 && r.h >= 8 && r.shape !== 'pillars' && this.rand() < (this.style === 'organic' || this.style === 'caves' ? 0.8 : 0.55)) {
        const pw = this.ri(2, r.w - 5), ph = this.ri(2, r.h - 5);
        const px = this.ri(r.x + 2, r.x + r.w - pw - 2), py = this.ri(r.y + 2, r.y + r.h - ph - 2);
        for (let j = py; j < py + ph; j++) for (let i = px; i < px + pw; i++) if (this.get(i, j) === FLOOR) this.set(i, j, LIQUID);
        r.pool = { x: px, y: py, w: pw, h: ph };
      }
    }
    // connect rooms: each room to its nearest already-connected room (Prim-like) + few loops
    const connected = [0];
    const rest = this.rooms.map((_, i) => i).slice(1);
    while (rest.length) {
      let best = null;
      for (const a of connected) for (const b of rest) {
        const ra = this.rooms[a], rb = this.rooms[b];
        const d = Math.abs(ra.cx - rb.cx) + Math.abs(ra.cy - rb.cy);
        if (!best || d < best.d) best = { a, b, d };
      }
      this.corridor(this.rooms[best.a], this.rooms[best.b]);
      connected.push(best.b); rest.splice(rest.indexOf(best.b), 1);
    }
    for (let k = 0; k < 2; k++) {
      const a = this.rooms[this.ri(0, this.rooms.length - 1)], b = this.rooms[this.ri(0, this.rooms.length - 1)];
      if (a !== b) this.corridor(a, b);
    }
    // start = room 0, exit = farthest room by path distance
    this.start = this.rooms[0];
    const dist = this.bfs(this.start.cx, this.start.cy, null, 9999);
    let far = this.rooms[1] || this.rooms[0], fd = -1;
    for (const r of this.rooms) {
      // keep exit tile free of liquid
      const d = dist[this.idx(r.cx, r.cy)];
      if (d > fd && this.get(r.cx, r.cy) === FLOOR) { fd = d; far = r; }
    }
    this.exit = far;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) this.set(far.cx + dx, far.cy + dy, FLOOR);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) this.set(this.start.cx + dx, this.start.cy + dy, FLOOR);
    // drop floor pockets that cannot be reached (cave noise can leave them)
    const reach = this.bfs(this.start.cx, this.start.cy, null, 9999);
    for (let i = 0; i < this.grid.length; i++) if (this.grid[i] === FLOOR && reach[i] < 0) this.grid[i] = WALL;
    // shrine: a quiet room with no pool
    const quiet = this.rooms.filter((r) => r !== this.start && r !== far && !r.pool && this.get(r.cx, r.cy) === FLOOR);
    if (quiet.length && this.rand() < 0.75) {
      const r = quiet[Math.floor(this.rand() * quiet.length)];
      r.shrine = true; this.shrine = { x: r.cx, y: r.cy };
    }
    // spike traps: mostly in corridors, a few inside rooms
    const want = Math.min(3 + floor, 12);
    for (let tries = 0; tries < 300 && this.traps.length < want; tries++) {
      const x = this.ri(2, this.w - 3), y = this.ri(2, this.h - 3);
      if (this.get(x, y) !== FLOOR) continue;
      const room = this.roomAt(x, y);
      if (room === this.start || (room && this.rand() < 0.7)) continue;
      if (Math.abs(x - far.cx) < 3 && Math.abs(y - far.cy) < 3) continue;
      if (this.shrine && Math.abs(x - this.shrine.x) < 2 && Math.abs(y - this.shrine.y) < 2) continue;
      if (this.traps.some((t) => Math.abs(t.x - x) + Math.abs(t.y - y) < 3)) continue;
      this.traps.push({ x, y });
    }
  }

  carveRoom(r) {
    const cx = r.x + (r.w - 1) / 2, cy = r.y + (r.h - 1) / 2, rx = r.w / 2, ry = r.h / 2;
    const cut = Math.max(2, Math.floor(Math.min(r.w, r.h) / 3.2));
    for (let j = r.y; j < r.y + r.h; j++) for (let i = r.x; i < r.x + r.w; i++) {
      const u = (i - cx) / rx, v = (j - cy) / ry;
      const li = i - r.x, lj = j - r.y, ri = r.x + r.w - 1 - i, rj = r.y + r.h - 1 - j;
      let ok = true;
      if (r.shape === 'round') ok = u * u + v * v <= 1.02;
      else if (r.shape === 'cave') ok = u * u + v * v <= 0.72 + this.rand() * 0.5;
      else if (r.shape === 'octagon') ok = li + lj >= cut && ri + lj >= cut && li + rj >= cut && ri + rj >= cut;
      else if (r.shape === 'cross') ok = !((li < cut || ri < cut) && (lj < cut || rj < cut));
      if (ok) this.set(i, j, FLOOR);
    }
    if (r.shape === 'cave') {
      // one smoothing pass so caves have no single-cell spikes
      for (let j = r.y; j < r.y + r.h; j++) for (let i = r.x; i < r.x + r.w; i++) {
        let n = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (this.get(i + dx, j + dy) === FLOOR) n++;
        if (n >= 6) this.set(i, j, FLOOR);
      }
    }
    if (r.shape === 'pillars' && r.w >= 7 && r.h >= 7) {
      const xs = [r.x + 2, r.x + r.w - 3], ys = [r.y + 2, r.y + r.h - 3];
      if (r.w >= 11) xs.push(r.cx);
      if (r.h >= 11) ys.push(r.cy);
      for (const px of xs) for (const py of ys) if (!(px === r.cx && py === r.cy)) this.grid[this.idx(px, py)] = WALL;
    }
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) this.set(r.cx + dx, r.cy + dy, FLOOR);
  }

  corridor(a, b) {
    let x = a.cx, y = a.cy;
    const horizFirst = this.rand() < 0.5;
    const carve = (cx, cy) => {
      for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
        const v = this.get(cx + dx, cy + dy);
        if (v !== FLOOR) this.set(cx + dx, cy + dy, FLOOR);
      }
    };
    const stepX = () => { while (x !== b.cx) { carve(x, y); x += Math.sign(b.cx - x); } };
    const stepY = () => { while (y !== b.cy) { carve(x, y); y += Math.sign(b.cy - y); } };
    if (horizFirst) { stepX(); stepY(); } else { stepY(); stepX(); }
    carve(x, y);
  }

  bfs(sx, sy, out, maxD = 60) {
    const d = out || new Int16Array(this.w * this.h);
    d.fill(-1);
    const q = new Int32Array(this.w * this.h);
    let h = 0, t = 0;
    if (!this.walkable(sx, sy)) return d;
    d[this.idx(sx, sy)] = 0; q[t++] = this.idx(sx, sy);
    while (h < t) {
      const c = q[h++]; const cx = c % this.w, cy = (c / this.w) | 0;
      const nd = d[c] + 1;
      if (nd > maxD) continue;
      const nb = [c - 1, c + 1, c - this.w, c + this.w];
      const nx = [cx - 1, cx + 1, cx, cx], ny = [cy, cy, cy - 1, cy + 1];
      for (let k = 0; k < 4; k++) {
        if (nx[k] < 0 || ny[k] < 0 || nx[k] >= this.w || ny[k] >= this.h) continue;
        const n = nb[k];
        if (d[n] === -1 && this.grid[n] === FLOOR) { d[n] = nd; q[t++] = n; }
      }
    }
    return d;
  }

  isWallVisible(x, y) {
    if (this.get(x, y) !== WALL) return false;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const v = this.get(x + dx, y + dy);
      if (v !== WALL) return true;
    }
    return false;
  }

  roomAt(x, y) {
    for (const r of this.rooms) if (x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) return r;
    return null;
  }

  randomFloorIn(r, avoidPool = true) {
    for (let i = 0; i < 40; i++) {
      const x = this.ri(r.x + 1, r.x + r.w - 2), y = this.ri(r.y + 1, r.y + r.h - 2);
      if (this.get(x, y) === FLOOR) {
        if (avoidPool && r.pool && x >= r.pool.x - 1 && x <= r.pool.x + r.pool.w && y >= r.pool.y - 1 && y <= r.pool.y + r.pool.h) continue;
        return { x, y };
      }
    }
    return { x: r.cx, y: r.cy };
  }

  // world <-> grid (cell centre at (i+0.5)*TILE)
  static toWorld(i) { return (i + 0.5) * TILE; }
  static toCell(v) { return Math.floor(v / TILE); }

  // line-of-sight over grid, liquids don't block sight
  los(ax, az, bx, bz) {
    const dx = bx - ax, dz = bz - az;
    const dist = Math.hypot(dx, dz);
    const steps = Math.ceil(dist / (TILE * 0.35));
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      if (this.get(Math.floor((ax + dx * t) / TILE), Math.floor((az + dz * t) / TILE)) === WALL) return false;
    }
    return true;
  }
}
