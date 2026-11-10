// Procedural dungeon: rooms + wide corridors + liquid pools, BFS utilities.
export const WALL = 0, FLOOR = 1, LIQUID = 2;
export const TILE = 2; // world units per cell

export function mulberry(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export class Dungeon {
  constructor(seed, floor) {
    this.rand = mulberry(seed);
    const size = Math.min(40 + floor * 2, 60);
    this.w = size; this.h = size;
    this.grid = new Uint8Array(this.w * this.h);
    this.explored = new Uint8Array(this.w * this.h);
    this.rooms = [];
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
    for (const r of this.rooms) {
      for (let j = r.y; j < r.y + r.h; j++) for (let i = r.x; i < r.x + r.w; i++) this.set(i, j, FLOOR);
    }
    // liquid pools in bigger rooms (skip first room = spawn)
    for (let k = 1; k < this.rooms.length; k++) {
      const r = this.rooms[k];
      if (r.w >= 8 && r.h >= 8 && this.rand() < 0.65) {
        const pw = this.ri(2, r.w - 5), ph = this.ri(2, r.h - 5);
        const px = this.ri(r.x + 2, r.x + r.w - pw - 2), py = this.ri(r.y + 2, r.y + r.h - ph - 2);
        for (let j = py; j < py + ph; j++) for (let i = px; i < px + pw; i++) this.set(i, j, LIQUID);
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
    const dist = this.bfs(this.start.cx, this.start.cy);
    let far = this.rooms[1] || this.rooms[0], fd = -1;
    for (const r of this.rooms) {
      // keep exit tile free of liquid
      const d = dist[this.idx(r.cx, r.cy)];
      if (d > fd && this.get(r.cx, r.cy) === FLOOR) { fd = d; far = r; }
    }
    this.exit = far;
    this.set(far.cx, far.cy, FLOOR);
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

  bfs(sx, sy, out) {
    const d = out || new Int16Array(this.w * this.h);
    d.fill(-1);
    const q = new Int32Array(this.w * this.h);
    let h = 0, t = 0;
    if (!this.walkable(sx, sy)) return d;
    d[this.idx(sx, sy)] = 0; q[t++] = this.idx(sx, sy);
    while (h < t) {
      const c = q[h++]; const cx = c % this.w, cy = (c / this.w) | 0;
      const nd = d[c] + 1;
      if (nd > 60) continue;
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
