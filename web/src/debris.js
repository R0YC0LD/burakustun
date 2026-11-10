// Rigid-body debris: instanced chunks with gravity, bounce, friction, spin and wall collisions.
import * as THREE from 'three';
import { TILE, WALL } from './dungeon.js';

const GRAV = -24;
const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), dq = new THREE.Quaternion(), v3 = new THREE.Vector3(), s3 = new THREE.Vector3(), ax = new THREE.Vector3();
const col = new THREE.Color();

export class Debris {
  constructor(scene, max) {
    this.max = max;
    const geo = new THREE.DodecahedronGeometry(0.5, 0);
    const mat = new THREE.MeshStandardMaterial({ roughness: 0.75, metalness: 0.05, flatShading: true });
    this.mesh = new THREE.InstancedMesh(geo, mat, max);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = true;
    this.mesh.count = 0;
    scene.add(this.mesh);
    this.items = [];
    for (let i = 0; i < max; i++) this.mesh.setColorAt(i, col.set(0xffffff));
  }

  spawn(x, y, z, n, color, speed, size, dirX = 0, dirZ = 0) {
    for (let k = 0; k < n; k++) {
      if (this.items.length >= this.max) this.items.shift();
      const a = Math.random() * Math.PI * 2, s = speed * (0.35 + Math.random() * 0.65);
      this.items.push({
        x: x + (Math.random() - 0.5) * 0.4, y: y + Math.random() * 0.5, z: z + (Math.random() - 0.5) * 0.4,
        vx: Math.cos(a) * s + dirX * speed * 0.7, vy: 3 + Math.random() * speed * 0.8, vz: Math.sin(a) * s + dirZ * speed * 0.7,
        q: new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.random() * 6, Math.random() * 6, Math.random() * 6)),
        wx: (Math.random() - 0.5) * 16, wy: (Math.random() - 0.5) * 16, wz: (Math.random() - 0.5) * 16,
        sx: size * (0.5 + Math.random()), sy: size * (0.35 + Math.random() * 0.6), sz: size * (0.5 + Math.random()),
        life: 5 + Math.random() * 3, rest: false,
        r: ((color >> 16) & 255) / 255 * (0.7 + Math.random() * 0.4), g: ((color >> 8) & 255) / 255 * (0.7 + Math.random() * 0.4), b: (color & 255) / 255 * (0.7 + Math.random() * 0.4),
      });
    }
  }

  update(dt, dungeon) {
    const it = this.items;
    let w = 0;
    for (let i = 0; i < it.length; i++) {
      const d = it[i];
      d.life -= dt;
      if (d.life <= 0) continue;
      if (!d.rest) {
        d.vy += GRAV * dt;
        const nx = d.x + d.vx * dt, nz = d.z + d.vz * dt;
        // wall collisions, axis separated so chunks slide along walls
        if (dungeon.get(Math.floor(nx / TILE), Math.floor(d.z / TILE)) === WALL) d.vx *= -0.45; else d.x = nx;
        if (dungeon.get(Math.floor(d.x / TILE), Math.floor(nz / TILE)) === WALL) d.vz *= -0.45; else d.z = nz;
        d.y += d.vy * dt;
        const ground = d.sy * 0.45;
        if (d.y < ground) {
          d.y = ground;
          if (d.vy < -2.5) { d.vy = -d.vy * 0.38; d.vx *= 0.7; d.vz *= 0.7; d.wx *= 0.6; d.wy *= 0.6; d.wz *= 0.6; }
          else { d.vy = 0; const f = Math.exp(-dt * 9); d.vx *= f; d.vz *= f; d.wx *= f; d.wy *= f; d.wz *= f; if (d.vx * d.vx + d.vz * d.vz < 0.02) d.rest = true; }
        }
        const wl = Math.hypot(d.wx, d.wy, d.wz);
        if (wl > 0.01) { ax.set(d.wx / wl, d.wy / wl, d.wz / wl); dq.setFromAxisAngle(ax, wl * dt); d.q.premultiply(dq); }
      }
      const fade = Math.min(1, d.life / 0.6);
      v3.set(d.x, d.y, d.z); s3.set(d.sx * fade, d.sy * fade, d.sz * fade);
      m4.compose(v3, d.q, s3);
      this.mesh.setMatrixAt(w, m4);
      this.mesh.setColorAt(w, col.setRGB(d.r, d.g, d.b));
      it[w++] = d;
    }
    it.length = w;
    this.mesh.count = w;
    if (w || this._had) { this.mesh.instanceMatrix.needsUpdate = true; if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true; }
    this._had = w > 0;
  }

  clear() { this.items.length = 0; this.mesh.count = 0; }
}
