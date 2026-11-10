// Procedural PBR texture synthesis (albedo + normal + roughness) on canvas.
import * as THREE from 'three';

function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

function makeNoise(size, seed) {
  // tileable value-noise lattice
  const r = rng(seed);
  const grids = [];
  for (let o = 0; o < 6; o++) {
    const n = 4 << o;
    const g = new Float32Array(n * n);
    for (let i = 0; i < g.length; i++) g[i] = r();
    grids.push({ n, g });
  }
  const smooth = (t) => t * t * (3 - 2 * t);
  return function fbm(x, y, octaves = 5, start = 0) {
    let v = 0, amp = 0.5, tot = 0;
    for (let o = start; o < Math.min(start + octaves, grids.length); o++) {
      const { n, g } = grids[o];
      const fx = (x / size) * n, fy = (y / size) * n;
      const ix = Math.floor(fx), iy = Math.floor(fy);
      const tx = smooth(fx - ix), ty = smooth(fy - iy);
      const x0 = ((ix % n) + n) % n, y0 = ((iy % n) + n) % n;
      const x1 = (x0 + 1) % n, y1 = (y0 + 1) % n;
      const a = g[y0 * n + x0], b = g[y0 * n + x1], c = g[y1 * n + x0], d = g[y1 * n + x1];
      v += amp * (a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty);
      tot += amp; amp *= 0.5;
    }
    return v / tot;
  };
}

function toTex(canvas, srgb, aniso) {
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = aniso || 4;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.needsUpdate = true;
  return t;
}

function build(size, heightFn, colorFn, roughFn, strength, aniso, emissiveFn) {
  const H = new Float32Array(size * size);
  const extra = new Float32Array(size * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const res = heightFn(x, y);
    H[y * size + x] = res.h; extra[y * size + x] = res.m;
  }
  const mk = () => { const c = document.createElement('canvas'); c.width = c.height = size; return c; };
  const cA = mk(), cN = mk(), cR = mk(), cE = emissiveFn ? mk() : null;
  const xA = cA.getContext('2d'), xN = cN.getContext('2d'), xR = cR.getContext('2d'), xE = cE ? cE.getContext('2d') : null;
  const dA = xA.createImageData(size, size), dN = xN.createImageData(size, size), dR = xR.createImageData(size, size);
  const dE = xE ? xE.createImageData(size, size) : null;
  const at = (x, y) => H[((y + size) % size) * size + ((x + size) % size)];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = y * size + x, p = i * 4;
    const h = H[i], m = extra[i];
    const col = colorFn(x, y, h, m);
    dA.data[p] = col[0]; dA.data[p + 1] = col[1]; dA.data[p + 2] = col[2]; dA.data[p + 3] = 255;
    const dx = (at(x + 1, y) - at(x - 1, y)) * strength;
    const dy = (at(x, y + 1) - at(x, y - 1)) * strength;
    const len = Math.hypot(dx, dy, 1);
    dN.data[p] = ((-dx / len) * 0.5 + 0.5) * 255;
    dN.data[p + 1] = ((dy / len) * 0.5 + 0.5) * 255;
    dN.data[p + 2] = ((1 / len) * 0.5 + 0.5) * 255;
    dN.data[p + 3] = 255;
    const r = roughFn(x, y, h, m) * 255;
    dR.data[p] = r; dR.data[p + 1] = r; dR.data[p + 2] = r; dR.data[p + 3] = 255;
  }
  xA.putImageData(dA, 0, 0); xN.putImageData(dN, 0, 0); xR.putImageData(dR, 0, 0);
  const out = { map: toTex(cA, true, aniso), normalMap: toTex(cN, false, aniso), roughnessMap: toTex(cR, false, aniso) };
  if (cE) out.emissiveMap = toTex(cE, true, aniso);
  return out;
}

const mix = (a, b, t) => a + (b - a) * t;
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));

// Stone slab floor: Voronoi-ish slabs with grout, wear and cracks.
export function floorTextures(biome, size, aniso) {
  const P = biome.floor;
  const n = makeNoise(size, biome.seed * 13 + 1);
  const n2 = makeNoise(size, biome.seed * 17 + 5);
  const r = rng(biome.seed * 31 + 7);
  // jittered grid seeds (tileable, 3x3 slabs per tile)
  const cells = 3, pts = [];
  for (let j = 0; j < cells; j++) for (let i = 0; i < cells; i++) pts.push([(i + 0.2 + r() * 0.6) / cells * size, (j + 0.2 + r() * 0.6) / cells * size, r()]);
  const heightFn = (x, y) => {
    let d1 = 1e9, d2 = 1e9, id = 0;
    for (let k = 0; k < pts.length; k++) {
      for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
        const dx = x - (pts[k][0] + ox * size), dy = y - (pts[k][1] + oy * size);
        // manhattan-ish metric for blockier slabs
        const d = Math.max(Math.abs(dx), Math.abs(dy)) * 0.7 + Math.hypot(dx, dy) * 0.3;
        if (d < d1) { d2 = d1; d1 = d; id = k; } else if (d < d2) d2 = d;
      }
    }
    const edge = d2 - d1;
    const grout = clamp(edge / (size * 0.018));
    const crack = Math.abs(n2(x * 1.0, y * 1.0, 3, 2) - 0.5) < 0.012 ? 1 : 0;
    const surf = n(x, y, 5, 1);
    const h = grout * (0.65 + surf * 0.35 + pts[id][2] * 0.08) - crack * 0.25;
    return { h, m: id + pts[id][2] * 0.99 + (grout < 0.5 ? 100 : 0) + crack * 1000 };
  };
  const colorFn = (x, y, h, m) => {
    const isGrout = m >= 100 && m < 1000;
    const slabVar = (m % 1);
    const dirt = n2(x, y, 4, 0);
    const c = [0, 0, 0];
    for (let k = 0; k < 3; k++) {
      let v = mix(P.a[k], P.b[k], clamp(slabVar * 0.6 + n(x, y, 4, 2) * 0.6));
      v = mix(v, P.dirt[k], clamp((dirt - 0.45) * 2.2) * 0.6);
      if (isGrout) v = P.grout[k];
      if (m >= 1000) v *= 0.5;
      v *= 0.85 + h * 0.25;
      c[k] = clamp(v, 0, 255);
    }
    return c;
  };
  const roughFn = (x, y, h, m) => {
    const isGrout = m >= 100 && m < 1000;
    const wet = n2(x + 50, y + 90, 3, 0);
    return clamp(isGrout ? 0.95 : mix(P.rough, P.rough - 0.35, clamp((wet - 0.55) * 3)) + n(x, y, 2, 4) * 0.1);
  };
  const emissiveFn = P.glow ? (x, y, h, m) => {
    const g = (m >= 100 && m < 1000) || m >= 1000 ? 1 : 0;
    const pulse = 0.6 + n(x, y, 3, 1) * 0.6;
    return [P.glow[0] * g * pulse, P.glow[1] * g * pulse, P.glow[2] * g * pulse];
  } : null;
  return build(size, heightFn, colorFn, roughFn, 6 * (size / 512) * 3, aniso, emissiveFn);
}

// Brick / block wall with mortar.
export function wallTextures(biome, size, aniso) {
  const P = biome.wall;
  const n = makeNoise(size, biome.seed * 7 + 3);
  const r = rng(biome.seed * 19 + 11);
  const rows = 6, cols = 3;
  const brickTone = [];
  for (let i = 0; i < rows * cols * 2; i++) brickTone.push(r());
  const heightFn = (x, y) => {
    const by = size / rows, bx = size / cols;
    const row = Math.floor(y / by);
    const off = (row % 2) * bx * 0.5;
    const xx = (x + off) % size;
    const col = Math.floor(xx / bx);
    const lx = xx - col * bx, ly = y - row * by;
    const mortar = size * 0.02;
    const ex = Math.min(lx, bx - lx), ey = Math.min(ly, by - ly);
    const e = clamp(Math.min(ex, ey) / mortar);
    const chip = n(x, y, 4, 2);
    const h = e * (0.7 + chip * 0.3) - (chip < 0.3 ? 0.15 : 0);
    return { h, m: (e < 0.6 ? 100 : 0) + brickTone[row * cols + col] };
  };
  const colorFn = (x, y, h, m) => {
    const isM = m >= 100;
    const tone = m % 100;
    const c = [0, 0, 0];
    const moss = n(x + 300, y + 100, 4, 1);
    for (let k = 0; k < 3; k++) {
      let v = mix(P.a[k], P.b[k], clamp(tone * 0.7 + n(x, y, 4, 2) * 0.5));
      if (P.moss) v = mix(v, P.moss[k], clamp((moss - 0.55) * 3) * 0.8);
      if (isM) v = P.mortar[k];
      v *= 0.75 + h * 0.35;
      // grime at the bottom of the texture (towards floor)
      v *= mix(1, 0.6, clamp((y / size - 0.75) * 4) * 0.6);
      c[k] = clamp(v, 0, 255);
    }
    return c;
  };
  const roughFn = (x, y, h, m) => clamp((m >= 100 ? 0.95 : P.rough) + (n(x, y, 2, 3) - 0.5) * 0.2);
  return build(size, heightFn, colorFn, roughFn, 5 * (size / 512) * 3, aniso);
}

// Small radial gradient sprite used for particles / glows.
export function glowTexture() {
  const s = 64, c = document.createElement('canvas'); c.width = c.height = s;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.25, 'rgba(255,255,255,0.6)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, s, s);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Soft circular blob shadow decal
export function blobTexture() {
  const s = 64, c = document.createElement('canvas'); c.width = c.height = s;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  gr.addColorStop(0, 'rgba(0,0,0,0.7)');
  gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, s, s);
  return new THREE.CanvasTexture(c);
}
