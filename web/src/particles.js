// Pooled GPU point particles (additive), CPU-simulated.
import * as THREE from 'three';

export class Particles {
  constructor(scene, max, tex) {
    this.max = max;
    this.pos = new Float32Array(max * 3);
    this.vel = new Float32Array(max * 3);
    this.col = new Float32Array(max * 3);
    this.size = new Float32Array(max);
    this.alpha = new Float32Array(max);
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max);
    this.grav = new Float32Array(max);
    this.drag = new Float32Array(max);
    this.size0 = new Float32Array(max);
    this.count = 0;
    const geo = new THREE.BufferGeometry();
    this.aPos = new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage);
    this.aCol = new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage);
    this.aSize = new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage);
    this.aAlpha = new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', this.aPos);
    geo.setAttribute('color', this.aCol);
    geo.setAttribute('size', this.aSize);
    geo.setAttribute('alpha', this.aAlpha);
    geo.setDrawRange(0, 0);
    this.uScale = { value: 30 };
    const mat = new THREE.ShaderMaterial({
      uniforms: { map: { value: tex }, uScale: this.uScale },
      vertexShader: `attribute float size; attribute float alpha; attribute vec3 color; varying vec3 vC; varying float vA; uniform float uScale;
        void main(){ vC=color; vA=alpha; vec4 mv=modelViewMatrix*vec4(position,1.0); gl_PointSize=size*uScale; gl_Position=projectionMatrix*mv; }`,
      fragmentShader: `uniform sampler2D map; varying vec3 vC; varying float vA;
        void main(){ vec4 t=texture2D(map, gl_PointCoord); gl_FragColor=vec4(vC*t.rgb*vA, t.a*vA); }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 10;
    scene.add(this.points);
    this.geo = geo;
  }

  emit(x, y, z, vx, vy, vz, r, g, b, size, life, grav = 0, drag = 0.98) {
    if (this.count >= this.max) return;
    const i = this.count++;
    const i3 = i * 3;
    this.pos[i3] = x; this.pos[i3 + 1] = y; this.pos[i3 + 2] = z;
    this.vel[i3] = vx; this.vel[i3 + 1] = vy; this.vel[i3 + 2] = vz;
    this.col[i3] = r; this.col[i3 + 1] = g; this.col[i3 + 2] = b;
    this.size[i] = size; this.size0[i] = size;
    this.life[i] = life; this.maxLife[i] = life;
    this.grav[i] = grav; this.drag[i] = drag;
    this.alpha[i] = 1;
  }

  burst(x, y, z, n, color, speed, size, life, grav = -6, spread = 1) {
    const c = new THREE.Color(color);
    for (let k = 0; k < n; k++) {
      const a = Math.random() * Math.PI * 2, u = Math.random() * 2 - 1;
      const s = speed * (0.3 + Math.random() * 0.7);
      const h = Math.sqrt(1 - u * u);
      this.emit(x, y, z, Math.cos(a) * h * s * spread, Math.abs(u) * s + speed * 0.3, Math.sin(a) * h * s * spread,
        c.r, c.g, c.b, size * (0.6 + Math.random() * 0.8), life * (0.6 + Math.random() * 0.6), grav, 0.96);
    }
  }

  ring(x, y, z, n, color, speed, size, life) {
    const c = new THREE.Color(color);
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2;
      this.emit(x, y, z, Math.cos(a) * speed, 0.3, Math.sin(a) * speed, c.r, c.g, c.b, size, life, 0, 0.94);
    }
  }

  update(dt) {
    let i = 0;
    while (i < this.count) {
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        // swap-remove
        const last = --this.count;
        if (i !== last) {
          const i3 = i * 3, l3 = last * 3;
          for (let k = 0; k < 3; k++) { this.pos[i3 + k] = this.pos[l3 + k]; this.vel[i3 + k] = this.vel[l3 + k]; this.col[i3 + k] = this.col[l3 + k]; }
          this.size[i] = this.size[last]; this.size0[i] = this.size0[last]; this.alpha[i] = this.alpha[last];
          this.life[i] = this.life[last]; this.maxLife[i] = this.maxLife[last]; this.grav[i] = this.grav[last]; this.drag[i] = this.drag[last];
        }
        continue;
      }
      const i3 = i * 3;
      const d = Math.pow(this.drag[i], dt * 60);
      this.vel[i3] *= d; this.vel[i3 + 1] = this.vel[i3 + 1] * d + this.grav[i] * dt; this.vel[i3 + 2] *= d;
      this.pos[i3] += this.vel[i3] * dt; this.pos[i3 + 1] += this.vel[i3 + 1] * dt; this.pos[i3 + 2] += this.vel[i3 + 2] * dt;
      if (this.pos[i3 + 1] < 0.02) { this.pos[i3 + 1] = 0.02; this.vel[i3 + 1] *= -0.3; }
      const t = this.life[i] / this.maxLife[i];
      this.alpha[i] = Math.min(1, t * 2.5);
      this.size[i] = this.size0[i] * (0.4 + 0.6 * t);
      i++;
    }
    this.geo.setDrawRange(0, this.count);
    this.aPos.needsUpdate = true; this.aCol.needsUpdate = true; this.aSize.needsUpdate = true; this.aAlpha.needsUpdate = true;
  }

  clear() { this.count = 0; this.geo.setDrawRange(0, 0); }
}
