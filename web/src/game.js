import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

import { Dungeon, TILE, WALL, FLOOR, LIQUID } from './dungeon.js';
import { biomeForFloor, isBossFloor, BIOMES, TOTAL_FLOORS } from './biomes.js';
import { floorTextures, wallTextures, glowTexture, blobTexture } from './textures.js';
import { makePlayer, makeEnemyModel, makeProp, makeTorch, makeChest, makePortal, makePickup, M } from './models.js';
import { Particles } from './particles.js';
import { sfx, playMusic, playAmbience } from './audio.js';
import { settings, QUALITY, meta, saveMeta } from './settings.js';

const WALL_H = 2.6;
const ISO = new THREE.Vector3(1, 1.05, 1).normalize();
const SCREEN_RIGHT = new THREE.Vector2(1, -1).normalize(); // world xz for screen +x
const SCREEN_UP = new THREE.Vector2(-1, -1).normalize();   // world xz for screen -y

const ENEMY_DEFS = {
  skeleton: { hp: 32, dmg: 10, speed: 3.3, r: 0.45, ai: 'melee', range: 1.7, xp: 8, color: 0xd8ccb0, death: 'bones' },
  archer:   { hp: 22, dmg: 8, speed: 2.9, r: 0.45, ai: 'ranged', cd: 1.9, pspeed: 13, pcolor: 0x60ff90, xp: 10, color: 0x60ff90, death: 'bones' },
  spider:   { hp: 18, dmg: 7, speed: 5.2, r: 0.5, ai: 'lunger', range: 1.4, xp: 8, color: 0x60ff30, death: 'splat' },
  slime:    { hp: 40, dmg: 9, speed: 2.3, r: 0.6, ai: 'melee', range: 1.5, xp: 10, color: 0x7aff30, split: 'slimeSmall', death: 'splat' },
  slimeSmall: { hp: 14, dmg: 5, speed: 3.4, r: 0.35, ai: 'melee', range: 1.2, xp: 3, color: 0x7aff30, death: 'splat' },
  imp:      { hp: 26, dmg: 10, speed: 3.6, r: 0.45, ai: 'ranged', cd: 2.2, pspeed: 10, pcolor: 0xff6010, xp: 11, color: 0xff6010, death: 'death', fly: true },
  golem:    { hp: 95, dmg: 22, speed: 1.9, r: 0.85, ai: 'charger', range: 2.0, xp: 22, color: 0xff6020, death: 'explode' },
  wraith:   { hp: 34, dmg: 11, speed: 3.4, r: 0.5, ai: 'blinker', cd: 2.0, pspeed: 11, pcolor: 0x70d8ff, xp: 13, color: 0x70d8ff, death: 'frost', fly: true },
  voideye:  { hp: 46, dmg: 9, speed: 2.6, r: 0.6, ai: 'spread', cd: 2.4, pspeed: 9, pcolor: 0xc050ff, xp: 15, color: 0xc050ff, death: 'death', fly: true },
};
const BOSS_DEFS = {
  lich:        { name: 'Kemik Lordu Valkar', hp: 650, dmg: 16, speed: 2.6, r: 1.1, scale: 2.0, pcolor: 0x50a8ff },
  magma:       { name: 'Magma Devi Ignar', hp: 900, dmg: 24, speed: 2.0, r: 1.5, scale: 1.8, pcolor: 0xff5010 },
  frostqueen:  { name: 'Buz Kraliçesi Sylva', hp: 800, dmg: 18, speed: 3.0, r: 1.1, scale: 1.9, pcolor: 0x80e8ff },
  broodmother: { name: 'Kuluçka Anası Ra\'kesh', hp: 950, dmg: 20, speed: 3.4, r: 1.6, scale: 2.4, pcolor: 0x80ff30 },
  overseer:    { name: 'Gözcü Ne\'thal', hp: 1300, dmg: 22, speed: 2.2, r: 1.4, scale: 2.2, pcolor: 0xc050ff },
};

export const PERKS = [
  { id: 'hp', name: 'Titan Kalbi', desc: '+25 Maks. Can ve tamamen iyileş', apply: (p) => { p.maxHp += 25; p.hp = p.maxHp; } },
  { id: 'dmg', name: 'Keskin Çelik', desc: '+20% hasar', apply: (p) => { p.dmg *= 1.2; } },
  { id: 'as', name: 'Kılıç Dansı', desc: '+18% saldırı hızı', apply: (p) => { p.attackCd *= 0.82; } },
  { id: 'spd', name: 'Rüzgâr Adımı', desc: '+12% hareket hızı', apply: (p) => { p.speed *= 1.12; } },
  { id: 'crit', name: 'Ölümcül Nişan', desc: '+10% kritik şansı', apply: (p) => { p.crit += 0.1; } },
  { id: 'critd', name: 'Cellat', desc: '+50% kritik hasarı', apply: (p) => { p.critMult += 0.5; } },
  { id: 'ls', name: 'Vampir Çeliği', desc: 'Hasarın %6\'sı kadar can çal', apply: (p) => { p.lifesteal += 0.06; } },
  { id: 'regen', name: 'Troll Kanı', desc: 'Saniyede +1.5 can yenile', apply: (p) => { p.regen += 1.5; } },
  { id: 'armor', name: 'Ejder Pulu', desc: 'Alınan hasar -12%', apply: (p) => { p.armor = 1 - (1 - p.armor) * 0.88; } },
  { id: 'dash', name: 'Gölge Adımı', desc: 'Atılma bekleme süresi -30%', apply: (p) => { p.dashCd *= 0.7; } },
  { id: 'nova', name: 'Kor Halkası', desc: 'Nova hasarı +50%, bekleme -15%', apply: (p) => { p.novaDmg *= 1.5; p.novaCd *= 0.85; } },
  { id: 'reach', name: 'Uzun Kılıç', desc: '+20% saldırı menzili', apply: (p) => { p.reach *= 1.2; } },
  { id: 'thorns', name: 'Diken Zırh', desc: 'Yakın saldırganlara 15 hasar yansıt', apply: (p) => { p.thorns += 15; } },
  { id: 'potion', name: 'Simyacı', desc: '+2 iksir, iksirler %50 daha güçlü', apply: (p) => { p.potions = Math.min(p.potions + 2, 9); p.potionPow *= 1.5; } },
  { id: 'magnet', name: 'Açgözlülük', desc: '+40% altın, mıknatıs menzili x2', apply: (p) => { p.goldMult += 0.4; p.magnet *= 2; } },
];

const tmpV = new THREE.Vector3();
const tmpV2 = new THREE.Vector3();
const rnd = (a, b) => a + Math.random() * (b - a);

export class Game {
  constructor(canvas, ui, input) {
    this.ui = ui; this.input = input; this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false });
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x020203);
    const pm = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.18;
    pm.dispose();

    this.camera = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 200);
    this.camTarget = new THREE.Vector3();
    this.shake = 0;

    this.ambient = new THREE.AmbientLight(0xffffff, 0.3); this.scene.add(this.ambient);
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x000000, 0.3); this.scene.add(this.hemi);
    this.key = new THREE.DirectionalLight(0xffffff, 0.5);
    this.key.shadow.camera.left = -20; this.key.shadow.camera.right = 20; this.key.shadow.camera.top = 20; this.key.shadow.camera.bottom = -20;
    this.key.shadow.camera.near = 1; this.key.shadow.camera.far = 60;
    this.key.shadow.bias = -0.0008; this.key.shadow.normalBias = 0.03;
    this.scene.add(this.key); this.scene.add(this.key.target);

    this.glowTex = glowTexture();
    this.blobTex = blobTexture();
    this.particles = new Particles(this.scene, 2500, this.glowTex);
    this.world = new THREE.Group(); this.scene.add(this.world);
    this.texCache = {};
    this.time = 0;
    this.state = 'none';
    this.timeScale = 1; this.hitstop = 0;
    this.fpsAcc = 0; this.fpsFrames = 0; this.fps = 60; this.dynScale = 1; this.dynTimer = 0;
    this.cutaway = { uPlayer: { value: new THREE.Vector3() }, uCamDir: { value: ISO.clone() }, uTime: { value: 0 } };
    this.liquidUniforms = { uTime: this.cutaway.uTime };
    this.decals = [];
    this.applyQuality();
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  // ----------------------------------------------------------- quality / rendering
  applyQuality() {
    let q = settings.quality;
    if (q === 'auto') q = this.autoQ || 'medium';
    this.qName = q;
    this.Q = QUALITY[q];
    const r = this.renderer;
    r.shadowMap.enabled = this.Q.shadows;
    this.key.castShadow = this.Q.shadows;
    this.key.shadow.mapSize.set(this.Q.shadowSize, this.Q.shadowSize);
    if (this.key.shadow.map) { this.key.shadow.map.dispose(); this.key.shadow.map = null; }
    // player torch + light pool (fixed count → no shader recompiles during play)
    if (this.torchLight) this.scene.remove(this.torchLight);
    this.torchLight = new THREE.PointLight(0xffb070, 30, 16, 1.6);
    this.torchLight.castShadow = this.Q.torchShadow;
    this.torchLight.shadow.mapSize.set(512, 512);
    this.torchLight.shadow.bias = -0.002; this.torchLight.shadow.camera.near = 0.3;
    this.scene.add(this.torchLight);
    if (this.pool) this.pool.forEach((l) => this.scene.remove(l));
    this.pool = [];
    for (let i = 0; i < this.Q.lights; i++) {
      const l = new THREE.PointLight(0xff8a3a, 0, 11, 1.8);
      this.scene.add(l); this.pool.push(l);
    }
    this.setupComposer();
    this.resize();
    this.scene.traverse((o) => { if (o.material) { const m = Array.isArray(o.material) ? o.material : [o.material]; m.forEach((mm) => { mm.needsUpdate = true; }); } });
  }

  setupComposer() {
    if (this.composer) { this.composer.dispose(); this.composer = null; }
    if (!this.Q.bloom) return;
    const size = this.renderer.getSize(new THREE.Vector2());
    const rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: this.qName === 'ultra' || this.qName === 'high' ? 4 : 0 });
    const c = new EffectComposer(this.renderer, rt);
    c.addPass(new RenderPass(this.scene, this.camera));
    if (this.Q.ao) {
      const ao = new GTAOPass(this.scene, this.camera, size.x, size.y);
      ao.output = GTAOPass.OUTPUT.Default;
      ao.blendIntensity = 0.9;
      ao.updateGtaoMaterial({ radius: 1.2, distanceExponent: 1.5, thickness: 2, scale: 1, samples: 12 });
      this.aoPass = ao;
      c.addPass(ao);
    }
    this.bloom = new UnrealBloomPass(new THREE.Vector2(size.x / 2, size.y / 2), 0.75, 0.55, 0.82);
    c.addPass(this.bloom);
    c.addPass(new OutputPass());
    this.finalPass = new ShaderPass({
      uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uHurt: { value: 0 }, uVig: { value: 1.0 } },
      vertexShader: 'varying vec2 vUv; void main(){vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
      fragmentShader: `uniform sampler2D tDiffuse; uniform float uTime; uniform float uHurt; uniform float uVig; varying vec2 vUv;
        float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)) + uTime*7.0) * 43758.5453); }
        void main(){
          vec2 d = vUv - 0.5; float r = dot(d,d);
          float ca = 0.0018 + uHurt*0.006;
          vec3 col = vec3(texture2D(tDiffuse, vUv + d*ca).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - d*ca).b);
          col *= mix(1.0, smoothstep(0.85, 0.15, r*uVig*1.6), 0.85);
          col = mix(col, col*vec3(1.4,0.3,0.3), uHurt*0.5*smoothstep(0.05,0.5,r));
          col += (h(vUv*1000.0)-0.5)*0.025;
          gl_FragColor = vec4(col, 1.0);
        }`,
    });
    c.addPass(this.finalPass);
    this.composer = c;
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    const pr = Math.min(window.devicePixelRatio || 1, this.Q.pixelRatio) * this.dynScale;
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(w, h, false);
    this.canvas.style.width = w + 'px'; this.canvas.style.height = h + 'px';
    const aspect = w / h;
    this.viewH = aspect > 1 ? 13.5 : 21;
    this.camera.left = -this.viewH * aspect / 2; this.camera.right = this.viewH * aspect / 2;
    this.camera.top = this.viewH / 2; this.camera.bottom = -this.viewH / 2;
    this.camera.updateProjectionMatrix();
    if (this.composer) {
      this.composer.setPixelRatio(pr);
      this.composer.setSize(w, h);
      if (this.bloom) this.bloom.resolution.set(w * pr / 2, h * pr / 2);
    }
    this.particles.uScale.value = (h * pr) / this.viewH;
  }

  // ----------------------------------------------------------- materials
  biomeMaterials(biome) {
    if (this.texCache[biome.id + this.Q.texSize]) return this.texCache[biome.id + this.Q.texSize];
    const aniso = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
    const ft = floorTextures(biome, this.Q.texSize, aniso);
    const wt = wallTextures(biome, this.Q.texSize, aniso);
    const floorMat = new THREE.MeshStandardMaterial({ ...ft, metalness: biome.id === 'ice' || biome.id === 'void' ? 0.15 : 0.0, roughness: 1, normalScale: new THREE.Vector2(1.2, 1.2), emissive: ft.emissiveMap ? 0xffffff : 0x000000, emissiveIntensity: ft.emissiveMap ? 1.4 : 0 });
    const wallMat = new THREE.MeshStandardMaterial({ ...wt, metalness: 0, roughness: 1, normalScale: new THREE.Vector2(1.4, 1.4) });
    const cut = this.cutaway;
    wallMat.onBeforeCompile = (s) => {
      s.uniforms.uPlayer = cut.uPlayer; s.uniforms.uCamDir = cut.uCamDir;
      s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
        .replace('#include <project_vertex>', '#include <project_vertex>\nvWPos = (modelMatrix * vec4(transformed,1.0)).xyz;');
      s.fragmentShader = s.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vWPos; uniform vec3 uPlayer; uniform vec3 uCamDir;')
        .replace('void main() {', `void main() {
          vec3 v = vWPos - uPlayer; float along = dot(v, uCamDir); vec3 perp = v - along*uCamDir; float pd = length(perp);
          if (along > 0.4) { float fade = smoothstep(3.6, 2.2, pd) * smoothstep(0.4, 1.4, along);
            float dither = fract(dot(gl_FragCoord.xy, vec2(0.5, 0.25)) + fract(gl_FragCoord.y*0.5)*0.5);
            if (fade > dither * 0.98 + 0.01) discard; }`);
    };
    wallMat.customProgramCacheKey = () => 'cutawayWall';
    const capMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0c, roughness: 1 });
    capMat.onBeforeCompile = wallMat.onBeforeCompile; capMat.customProgramCacheKey = () => 'cutawayCap';
    const L = biome.liquid;
    const liquidMat = new THREE.MeshStandardMaterial({ color: L.color, emissive: L.emissive, emissiveIntensity: L.ei, roughness: L.rough, metalness: L.metal, transparent: !L.lava, opacity: L.lava ? 1 : 0.88 });
    const lu = this.liquidUniforms;
    liquidMat.onBeforeCompile = (s) => {
      s.uniforms.uTime = lu.uTime;
      s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWPos2;')
        .replace('#include <project_vertex>', '#include <project_vertex>\nvWPos2 = (modelMatrix * vec4(transformed,1.0)).xyz;');
      s.fragmentShader = s.fragmentShader.replace('#include <common>', `#include <common>
        varying vec3 vWPos2; uniform float uTime;
        float wv(vec2 p){ return sin(p.x*1.7+uTime*1.3)*cos(p.y*1.3-uTime*0.9) + sin((p.x+p.y)*2.9+uTime*2.1)*0.5 + sin(p.x*5.1-p.y*4.3+uTime*3.0)*0.25; }`)
        .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
          vec2 pp = vWPos2.xz; float e=0.05; float h0=wv(pp);
          vec3 wn = normalize(vec3(-(wv(pp+vec2(e,0.0))-h0)/e*0.08, 1.0, -(wv(pp+vec2(0.0,e))-h0)/e*0.08));
          normal = normalize((viewMatrix * vec4(wn,0.0)).xyz);`)
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
          float ph = wv(vWPos2.xz*0.7)*0.5+0.5; totalEmissiveRadiance *= 0.45 + ph*ph*1.3;`);
    };
    liquidMat.customProgramCacheKey = () => 'liquid' + (L.lava ? 1 : 0);
    const pitMat = new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 1, emissive: L.emissive, emissiveIntensity: L.lava ? 0.6 : 0.1 });
    const res = { floorMat, wallMat, capMat, liquidMat, pitMat };
    this.texCache[biome.id + this.Q.texSize] = res;
    return res;
  }

  // ----------------------------------------------------------- build world
  clearWorld() {
    this.world.traverse((o) => { if (o.isMesh && o.geometry && o.userData.ownGeo) o.geometry.dispose(); });
    this.scene.remove(this.world);
    this.world = new THREE.Group(); this.scene.add(this.world);
    this.particles.clear();
    this.enemies = []; this.projectiles = []; this.pickups = []; this.chests = []; this.torches = []; this.glows = []; this.obstacles = []; this.decals = [];
    this.boss = null; this.bossSpawned = false;
  }

  buildFloor(floor, attract = false) {
    this.clearWorld();
    this.floor = floor;
    const biome = biomeForFloor(floor);
    this.biome = biome;
    const seed = (Math.random() * 1e9) | 0;
    const d = new Dungeon(seed, floor);
    this.dungeon = d;
    this.flow = new Int16Array(d.w * d.h);
    this.flowTimer = 0;
    const mats = this.biomeMaterials(biome);

    // lighting palette
    this.ambient.color.setHex(biome.ambient); this.ambient.intensity = biome.ambientI * 0.6;
    this.hemi.color.setHex(biome.hemiSky); this.hemi.groundColor.setHex(biome.hemiGround); this.hemi.intensity = biome.ambientI * 0.7;
    this.key.color.setHex(biome.key); this.key.intensity = biome.keyI;
    this.scene.background.setHex(biome.fog);

    // ---- merged floor geometry (world-space UVs)
    const fp = [], fn = [], fu = [], fi = [];
    const lp = [], ln = [], lu = [], li = [];
    const pp = [], pn = [], pu = [], pi = [];
    const UVS = 4;
    const quad = (P, N, U, I, a, b, c, dd, n) => {
      const base = P.length / 3;
      [a, b, c, dd].forEach((v) => { P.push(v[0], v[1], v[2]); N.push(n[0], n[1], n[2]); });
      U.push(...uvFor(a, n), ...uvFor(b, n), ...uvFor(c, n), ...uvFor(dd, n));
      I.push(base, base + 1, base + 2, base, base + 2, base + 3);
    };
    const uvFor = (v, n) => n[1] !== 0 ? [v[0] / UVS, -v[2] / UVS] : (n[0] !== 0 ? [v[2] / UVS, v[1] / WALL_H] : [v[0] / UVS, v[1] / WALL_H]);
    const LY = -0.3;
    for (let y = 0; y < d.h; y++) for (let x = 0; x < d.w; x++) {
      const v = d.get(x, y);
      const x0 = x * TILE, x1 = x0 + TILE, z0 = y * TILE, z1 = z0 + TILE;
      if (v === FLOOR) quad(fp, fn, fu, fi, [x0, 0, z1], [x1, 0, z1], [x1, 0, z0], [x0, 0, z0], [0, 1, 0]);
      else if (v === LIQUID) {
        quad(lp, ln, lu, li, [x0, LY, z1], [x1, LY, z1], [x1, LY, z0], [x0, LY, z0], [0, 1, 0]);
        // pit side faces where neighbour is floor
        if (d.get(x - 1, y) === FLOOR) quad(pp, pn, pu, pi, [x0, LY, z1], [x0, LY, z0], [x0, 0, z0], [x0, 0, z1], [1, 0, 0]);
        if (d.get(x + 1, y) === FLOOR) quad(pp, pn, pu, pi, [x1, LY, z0], [x1, LY, z1], [x1, 0, z1], [x1, 0, z0], [-1, 0, 0]);
        if (d.get(x, y - 1) === FLOOR) quad(pp, pn, pu, pi, [x1, LY, z0], [x0, LY, z0], [x0, 0, z0], [x1, 0, z0], [0, 0, 1]);
        if (d.get(x, y + 1) === FLOOR) quad(pp, pn, pu, pi, [x0, LY, z1], [x1, LY, z1], [x1, 0, z1], [x0, 0, z1], [0, 0, -1]);
      }
    }
    const mkMesh = (P, N, U, I, mat, cast, recv) => {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
      g.setIndex(I);
      const m = new THREE.Mesh(g, mat); m.castShadow = cast; m.receiveShadow = recv; m.userData.ownGeo = true;
      this.world.add(m); return m;
    };
    mkMesh(fp, fn, fu, fi, mats.floorMat, false, true);
    if (lp.length) { mkMesh(lp, ln, lu, li, mats.liquidMat, false, true).renderOrder = 1; mkMesh(pp, pn, pu, pi, mats.pitMat, false, true); }

    // ---- merged walls (exposed faces only) + caps
    const wp = [], wn = [], wu = [], wi = [];
    const cp = [], cn = [], cu = [], ci = [];
    for (let y = 0; y < d.h; y++) for (let x = 0; x < d.w; x++) {
      if (!d.isWallVisible(x, y)) continue;
      const x0 = x * TILE, x1 = x0 + TILE, z0 = y * TILE, z1 = z0 + TILE, H = WALL_H;
      quad(cp, cn, cu, ci, [x0, H, z1], [x1, H, z1], [x1, H, z0], [x0, H, z0], [0, 1, 0]);
      const open = (xx, yy) => d.get(xx, yy) !== WALL;
      const bot = -0.31;
      if (open(x + 1, y)) quad(wp, wn, wu, wi, [x1, bot, z1], [x1, bot, z0], [x1, H, z0], [x1, H, z1], [1, 0, 0]);
      if (open(x - 1, y)) quad(wp, wn, wu, wi, [x0, bot, z0], [x0, bot, z1], [x0, H, z1], [x0, H, z0], [-1, 0, 0]);
      if (open(x, y + 1)) quad(wp, wn, wu, wi, [x0, bot, z1], [x1, bot, z1], [x1, H, z1], [x0, H, z1], [0, 0, 1]);
      if (open(x, y - 1)) quad(wp, wn, wu, wi, [x1, bot, z0], [x0, bot, z0], [x0, H, z0], [x1, H, z0], [0, 0, -1]);
      // outer faces (towards void) so shadows are closed
      if (!open(x + 1, y) && !d.isWallVisible(x + 1, y)) quad(wp, wn, wu, wi, [x1, 0, z1], [x1, 0, z0], [x1, H, z0], [x1, H, z1], [1, 0, 0]);
      if (!open(x, y + 1) && !d.isWallVisible(x, y + 1)) quad(wp, wn, wu, wi, [x0, 0, z1], [x1, 0, z1], [x1, H, z1], [x0, H, z1], [0, 0, 1]);
    }
    mkMesh(wp, wn, wu, wi, mats.wallMat, true, true);
    mkMesh(cp, cn, cu, ci, mats.capMat, true, false);

    // ---- torches on visible walls (faces pointing +x / +z, toward camera side)
    const torchCol = new THREE.Color(biome.torch);
    for (const r of d.rooms) {
      const cand = [];
      for (let x = r.x; x < r.x + r.w; x++) if (d.get(x, r.y - 1) === WALL && d.get(x, r.y) === FLOOR) cand.push({ x, y: r.y - 1, dir: 'z' });
      for (let y = r.y; y < r.y + r.h; y++) if (d.get(r.x - 1, y) === WALL && d.get(r.x, y) === FLOOR) cand.push({ x: r.x - 1, y, dir: 'x' });
      const n = Math.min(cand.length, 1 + Math.floor(d.rand() * 3));
      for (let k = 0; k < n; k++) {
        const c = cand.splice(Math.floor(d.rand() * cand.length), 1)[0];
        const t = makeTorch();
        let px, pz;
        if (c.dir === 'z') { px = (c.x + 0.5) * TILE; pz = (c.y + 1) * TILE; t.rotation.y = 0; }
        else { px = (c.x + 1) * TILE; pz = (c.y + 0.5) * TILE; t.rotation.y = Math.PI / 2; }
        t.position.set(px, 1.8, pz);
        this.world.add(t);
        const fx = c.dir === 'z' ? px : px + 0.55, fz = c.dir === 'z' ? pz + 0.55 : pz;
        this.torches.push({ x: fx, y: 2.15, z: fz, color: torchCol, i: 16 * biome.torchI, seed: Math.random() * 100 });
      }
    }

    // ---- props
    const propKinds = biome.props;
    for (let ri = 0; ri < d.rooms.length; ri++) {
      const r = d.rooms[ri];
      const n = 1 + Math.floor(d.rand() * 4);
      for (let k = 0; k < n; k++) {
        // near room edges to keep the middle clear
        const edge = d.rand() < 0.5;
        const x = edge ? (d.rand() < 0.5 ? r.x : r.x + r.w - 1) : r.x + 1 + Math.floor(d.rand() * (r.w - 2));
        const y = !edge ? (d.rand() < 0.5 ? r.y : r.y + r.h - 1) : r.y + 1 + Math.floor(d.rand() * (r.h - 2));
        if (d.get(x, y) !== FLOOR) continue;
        if (Math.abs(x - r.cx) < 2 && Math.abs(y - r.cy) < 2) continue;
        // keep corridor mouths clear
        let nearCorr = false;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { if (!d.roomAt(x + dx, y + dy) && d.get(x + dx, y + dy) === FLOOR) nearCorr = true; }
        if (nearCorr) continue;
        const kind = propKinds[Math.floor(d.rand() * propKinds.length)];
        const p = makeProp(kind, d.rand);
        p.position.set((x + 0.5) * TILE + (d.rand() - 0.5) * 0.6, 0, (y + 0.5) * TILE + (d.rand() - 0.5) * 0.6);
        p.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
        this.world.add(p);
        if (p.userData.solid) this.obstacles.push({ x: p.position.x, z: p.position.z, r: p.userData.solid });
        if (p.userData.glow) this.glows.push({ x: p.position.x, y: 1.2, z: p.position.z, color: new THREE.Color(p.userData.glow), i: 6, seed: Math.random() * 10, fire: p.userData.fire });
      }
    }
    // liquid glows (a light per pool)
    for (const r of d.rooms) if (r.pool) {
      this.glows.push({ x: (r.pool.x + r.pool.w / 2) * TILE, y: 0.8, z: (r.pool.y + r.pool.h / 2) * TILE, color: new THREE.Color(biome.liquid.emissive), i: biome.liquid.lava ? 22 : 8, seed: Math.random() * 10, pool: true });
    }

    // ---- portal
    const ex = d.exit;
    this.portal = makePortal(biome.torch);
    this.portal.position.set((ex.cx + 0.5) * TILE, 0, (ex.cy + 0.5) * TILE);
    this.portal.traverse((o) => { if (o.isMesh) o.receiveShadow = true; });
    this.world.add(this.portal);
    this.portalOpen = !isBossFloor(floor);
    this.glows.push({ x: this.portal.position.x, y: 1.0, z: this.portal.position.z, color: new THREE.Color(biome.torch), i: 14, seed: 0, portal: true });

    // ---- chests
    const chestRooms = d.rooms.slice(1).filter((r) => r !== ex);
    const nChests = Math.min(chestRooms.length, 1 + Math.floor(d.rand() * 2) + (floor > 4 ? 1 : 0));
    for (let k = 0; k < nChests; k++) {
      const r = chestRooms.splice(Math.floor(d.rand() * chestRooms.length), 1)[0];
      const c = d.randomFloorIn(r);
      const ch = makeChest();
      ch.position.set((c.x + 0.5) * TILE, 0, (c.y + 0.5) * TILE);
      ch.rotation.y = Math.PI / 4;
      ch.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      this.world.add(ch);
      this.chests.push({ mesh: ch, x: ch.position.x, z: ch.position.z, open: false, t: 0 });
      this.obstacles.push({ x: ch.position.x, z: ch.position.z, r: 0.55 });
    }

    // ---- enemies
    {
      const roster = biome.enemies;
      for (let ri = 1; ri < d.rooms.length; ri++) {
        const r = d.rooms[ri];
        if (r === ex && isBossFloor(floor)) continue;
        const area = r.w * r.h;
        const count = Math.min(1 + Math.floor(area / 26) + Math.floor(floor / 3) + Math.floor(d.rand() * 2), 7);
        for (let k = 0; k < count; k++) {
          const c = d.randomFloorIn(r);
          const type = roster[Math.floor(d.rand() * roster.length)];
          this.spawnEnemy(type, (c.x + 0.5) * TILE + rnd(-0.4, 0.4), (c.y + 0.5) * TILE + rnd(-0.4, 0.4));
        }
      }
    }

    // ---- player placement
    const s = d.start;
    this.spawnX = (s.cx + 0.5) * TILE; this.spawnZ = (s.cy + 0.5) * TILE;
    this.camTarget.set(this.spawnX, 0, this.spawnZ);
    this.ambientTimer = 0;
  }

  spawnEnemy(type, x, z, opts = {}) {
    const def = ENEMY_DEFS[type];
    const f = this.floor || 1;
    const hpMul = 1 + 0.24 * (f - 1);
    const dmgMul = 1 + 0.12 * (f - 1);
    const model = makeEnemyModel(type, this.biome.id);
    model.position.set(x, 0, z);
    model.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    this.world.add(model);
    const blob = new THREE.Mesh(this.blobGeo || (this.blobGeo = new THREE.PlaneGeometry(1, 1)), this.blobMat || (this.blobMat = new THREE.MeshBasicMaterial({ map: this.blobTex, transparent: true, depthWrite: false })));
    blob.rotation.x = -Math.PI / 2; blob.position.y = 0.03; blob.scale.setScalar(def.r * 2.6);
    model.add(blob);
    const e = {
      type, def, model, x, z, vx: 0, vz: 0, r: def.r,
      hp: def.hp * hpMul, maxHp: def.hp * hpMul, dmg: def.dmg * dmgMul,
      speed: def.speed * rnd(0.9, 1.1), state: 'idle', t: 0, cd: rnd(0.5, 2), anim: Math.random() * 10,
      aggro: false, face: Math.random() * 6, hitT: 0, scale: 1, kx: 0, kz: 0, ...opts,
    };
    this.enemies.push(e);
    return e;
  }

  spawnBoss() {
    const type = this.biome.boss;
    const bd = BOSS_DEFS[type];
    const ex = this.dungeon.exit;
    const x = (ex.cx + 0.5) * TILE + 3, z = (ex.cy + 0.5) * TILE - 3;
    const model = makeEnemyModel(type, this.biome.id);
    model.scale.setScalar(bd.scale);
    model.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    model.position.set(x, 0, z);
    this.world.add(model);
    const f = this.floor;
    const mul = 1 + 0.25 * Math.floor((f - 1) / 2);
    const e = {
      type, boss: true, def: { ...bd, ai: 'boss', color: bd.pcolor, pcolor: bd.pcolor, pspeed: 9, death: 'explode', xp: 120, fly: type === 'frostqueen' || type === 'overseer' },
      model, x, z, vx: 0, vz: 0, r: bd.r, hp: bd.hp * mul, maxHp: bd.hp * mul, dmg: bd.dmg * (1 + 0.1 * (f - 1)), speed: bd.speed,
      state: 'intro', t: 1.8, cd: 2, anim: 0, aggro: true, face: 0, hitT: 0, scale: bd.scale, kx: 0, kz: 0, phase: 0, pattern: 0,
    };
    this.enemies.push(e);
    this.boss = e;
    this.bossSpawned = true;
    this.ui.bossBar(bd.name, 1);
    this.particles.burst(x, 1, z, 80, bd.pcolor, 8, 0.5, 1.2, -2);
    this.shakeIt(0.6);
    sfx('boss');
    playMusic('boss');
  }

  // ----------------------------------------------------------- run lifecycle
  startAttract() {
    this.state = 'attract';
    const floor = 1 + Math.floor(Math.random() * BIOMES.length) * 2;
    this.buildFloor(floor, true);
    this.attractRoom = 0;
    if (this.player) this.player.model.visible = false;
    this.cutaway.uPlayer.value.set(-999, -999, -999);
  }

  newRun() {
    meta.runs++; saveMeta();
    this.stats = { kills: 0, gold: 0, start: performance.now(), dmgDealt: 0 };
    if (this.player) this.world.remove(this.player.model);
    const model = makePlayer();
    model.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    this.player = {
      model, x: 0, z: 0, r: 0.42, face: 0, vx: 0, vz: 0,
      hp: 100, maxHp: 100, dmg: 18, attackCd: 0.42, speed: 6.2, crit: 0.08, critMult: 2.0, reach: 2.5,
      dashCd: 1.5, novaCd: 9, novaDmg: 45, lifesteal: 0, regen: 0, armor: 0, thorns: 0, potions: 2, potionPow: 1, goldMult: 1, magnet: 3,
      tAttack: 0, tDash: 0, tNova: 0, dashing: 0, inv: 0, swing: 0, swingSide: 1, level: 1, xp: 0, xpNext: 30, gold: 0, stepT: 0, perks: [],
    };
    this.enterFloor(1);
  }

  enterFloor(floor) {
    this.buildFloor(floor);
    const p = this.player;
    p.x = this.spawnX; p.z = this.spawnZ; p.vx = p.vz = 0;
    p.model.position.set(p.x, 0, p.z);
    p.model.visible = true;
    this.world.add(p.model);
    if (!this.pBlob) {
      this.pBlob = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.4), new THREE.MeshBasicMaterial({ map: this.blobTex, transparent: true, depthWrite: false }));
      this.pBlob.rotation.x = -Math.PI / 2; this.pBlob.position.y = 0.03;
      p.model.add(this.pBlob);
    }
    this.camTarget.set(p.x, 0, p.z);
    this.state = 'play';
    this.ui.hideBossBar();
    this.ui.floorBanner(`KAT ${floor}` + (isBossFloor(floor) ? ' · BOSS' : ''), this.biome.name, this.biome.sub);
    playMusic(this.biome.id);
    playAmbience(this.biome.id);
    if (floor > meta.bestFloor) { meta.bestFloor = floor; saveMeta(); }
    this.particles.ring(p.x, 0.3, p.z, 40, this.biome.torch, 6, 0.5, 0.8);
  }

  // ----------------------------------------------------------- helpers
  shakeIt(a) { if (settings.shake) this.shake = Math.max(this.shake, a); }

  blocked(x, z, r, isFlying) {
    const d = this.dungeon;
    const x0 = Math.floor((x - r) / TILE), x1 = Math.floor((x + r) / TILE);
    const z0 = Math.floor((z - r) / TILE), z1 = Math.floor((z + r) / TILE);
    for (let cz = z0; cz <= z1; cz++) for (let cx = x0; cx <= x1; cx++) {
      const v = d.get(cx, cz);
      if (v === FLOOR || (v === LIQUID && isFlying)) continue;
      const nx = Math.max(cx * TILE, Math.min(x, (cx + 1) * TILE));
      const nz = Math.max(cz * TILE, Math.min(z, (cz + 1) * TILE));
      const dx = x - nx, dz = z - nz;
      if (dx * dx + dz * dz < r * r) return true;
    }
    for (let i = 0; i < this.obstacles.length; i++) {
      const o = this.obstacles[i];
      const dx = x - o.x, dz = z - o.z, rr = r + o.r;
      if (dx * dx + dz * dz < rr * rr) return true;
    }
    return false;
  }

  move(ent, dx, dz, fly) {
    const steps = Math.ceil(Math.max(Math.abs(dx), Math.abs(dz)) / 0.3) || 1;
    const sx = dx / steps, sz = dz / steps;
    let hit = false;
    for (let i = 0; i < steps; i++) {
      if (!this.blocked(ent.x + sx, ent.z, ent.r, fly)) ent.x += sx; else hit = true;
      if (!this.blocked(ent.x, ent.z + sz, ent.r, fly)) ent.z += sz; else hit = true;
    }
    return hit;
  }

  damageEnemy(e, amount, kx, kz, crit, source) {
    if (e.dead) return;
    e.hp -= amount;
    e.hitT = 0.15;
    e.aggro = true;
    if (!e.boss) { e.kx += kx; e.kz += kz; }
    this.stats.dmgDealt += amount;
    const p = this.player;
    if (p.lifesteal > 0 && source !== 'thorns') p.hp = Math.min(p.maxHp, p.hp + amount * p.lifesteal);
    this.ui.damageNumber(e.x, 1.6 * e.scale + 0.4, e.z, Math.round(amount), crit ? 'crit' : 'hit', this.camera);
    this.particles.burst(e.x, 1.0 * e.scale, e.z, crit ? 18 : 10, e.def.color, 6, 0.35, 0.45, -10);
    this.particles.burst(e.x, 1.0 * e.scale, e.z, 4, 0xffffff, 8, 0.25, 0.15, 0);
    if (crit) { sfx('crit'); this.hitstop = 0.06; this.shakeIt(0.25); } else sfx('hit');
    if (e.hp <= 0) this.killEnemy(e);
    else if (e.boss) this.ui.bossBar(null, e.hp / e.maxHp);
  }

  killEnemy(e) {
    e.dead = true;
    this.stats.kills++;
    meta.kills++;
    const s = e.scale;
    this.particles.burst(e.x, 0.8 * s, e.z, e.boss ? 160 : 30, e.def.color, e.boss ? 12 : 7, 0.45, 1.0, -8);
    this.particles.burst(e.x, 0.8 * s, e.z, e.boss ? 60 : 12, 0xffffff, 5, 0.3, 0.5, -2);
    sfx(e.def.death || 'death');
    if (e.def.death !== 'death') sfx('death');
    this.world.remove(e.model);
    this.gainXp(e.def.xp || 5);
    if (e.def.split) {
      for (let k = 0; k < 2; k++) {
        const c = this.spawnEnemy(e.def.split, e.x + rnd(-0.6, 0.6), e.z + rnd(-0.6, 0.6));
        c.aggro = true; c.kx = rnd(-6, 6); c.kz = rnd(-6, 6);
      }
    }
    // drops
    if (Math.random() < (e.boss ? 1 : 0.55)) {
      const n = e.boss ? 14 : 1 + Math.floor(Math.random() * 2);
      for (let k = 0; k < n; k++) this.spawnPickup('gold', e.x, e.z, (e.boss ? 12 : 3) + Math.floor(Math.random() * 4 * this.floor));
    }
    if (Math.random() < (e.boss ? 1 : 0.06)) this.spawnPickup('potion', e.x, e.z);
    if (e.boss) {
      this.boss = null;
      this.ui.hideBossBar();
      this.portalOpen = true;
      this.shakeIt(1.0);
      sfx('portal');
      this.ui.toast('Portal açıldı! Derinliklere in.');
      playMusic(this.biome.id);
      this.pendingPerk = (this.pendingPerk || 0) + 1;
    }
  }

  spawnPickup(kind, x, z, value = 1) {
    const m = makePickup(kind);
    m.position.set(x, 0.3, z);
    this.world.add(m);
    const a = Math.random() * Math.PI * 2, s = rnd(2, 5);
    this.pickups.push({ kind, mesh: m, x, z, y: 0.6, vx: Math.cos(a) * s, vz: Math.sin(a) * s, vy: rnd(4, 7), value, t: 0 });
  }

  gainXp(n) {
    const p = this.player;
    p.xp += n;
    while (p.xp >= p.xpNext) {
      p.xp -= p.xpNext; p.level++;
      p.xpNext = Math.round(30 * Math.pow(1.32, p.level - 1));
      this.pendingPerk = (this.pendingPerk || 0) + 1;
      p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.2);
    }
  }

  hurtPlayer(amount, sx, sz) {
    const p = this.player;
    if (p.inv > 0 || p.dashing > 0 || this.state !== 'play') return;
    const dmg = amount * (1 - p.armor);
    p.hp -= dmg;
    p.inv = 0.5;
    this.hurtFlash = 1;
    this.shakeIt(0.35);
    sfx('playerHurt');
    this.ui.damageNumber(p.x, 2.2, p.z, Math.round(dmg), 'player', this.camera);
    this.particles.burst(p.x, 1.1, p.z, 14, 0xff2030, 5, 0.3, 0.5, -10);
    if (sx !== undefined) { const dx = p.x - sx, dz = p.z - sz, l = Math.hypot(dx, dz) || 1; p.vx += dx / l * 7; p.vz += dz / l * 7; }
    if (p.hp <= 0) { p.hp = 0; this.die(); }
  }

  die() {
    this.state = 'dead';
    sfx('gameover');
    this.particles.burst(this.player.x, 1, this.player.z, 80, 0xff2030, 6, 0.4, 1.4, -6);
    this.player.model.visible = false;
    const score = this.score();
    const best = score > meta.bestScore;
    if (best) meta.bestScore = score;
    saveMeta();
    setTimeout(() => this.ui.gameOver({ floor: this.floor, kills: this.stats.kills, gold: this.player.gold, level: this.player.level, score, best, time: (performance.now() - this.stats.start) / 1000 }), 1200);
  }

  score() { return Math.round(this.player.gold + this.stats.kills * 10 + (this.floor - 1) * 250 + this.player.level * 50); }

  shoot(x, z, dirx, dirz, speed, dmg, color, owner, size = 0.22) {
    const geo = this.projGeo || (this.projGeo = new THREE.SphereGeometry(1, 10, 8));
    const m = new THREE.Mesh(geo, M('proj' + color, { color: 0x000000, emissive: color, emissiveIntensity: 5 }));
    m.scale.setScalar(size);
    m.position.set(x, 1.1, z);
    this.world.add(m);
    this.projectiles.push({ x, z, vx: dirx * speed, vz: dirz * speed, dmg, color: new THREE.Color(color), owner, life: 4, mesh: m, r: size + 0.15 });
  }

  addDecal(x, z, radius, color, time, onDone) {
    const ring = new THREE.Mesh(this.decalGeo || (this.decalGeo = new THREE.RingGeometry(0.85, 1, 48)), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending }));
    const fill = new THREE.Mesh(this.decalFill || (this.decalFill = new THREE.CircleGeometry(1, 48)), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.25, depthWrite: false, blending: THREE.AdditiveBlending }));
    ring.rotation.x = fill.rotation.x = -Math.PI / 2;
    ring.position.set(x, 0.05, z); fill.position.set(x, 0.04, z);
    ring.scale.setScalar(radius); fill.scale.setScalar(0.01);
    this.world.add(ring, fill);
    this.decals.push({ ring, fill, x, z, radius, t: 0, time, onDone });
  }

  // ----------------------------------------------------------- per-frame
  update(dtRaw) {
    let dt = Math.min(dtRaw, 0.05);
    this.time += dt;
    this.cutaway.uTime.value = this.time;
    // dynamic resolution + auto quality
    this.fpsAcc += dtRaw; this.fpsFrames++;
    if (this.fpsAcc >= 1) {
      this.fps = this.fpsFrames / this.fpsAcc; this.fpsAcc = 0; this.fpsFrames = 0;
      this.ui.fps(this.fps, this.dynScale, this.qName);
      if (this.state === 'play' || this.state === 'attract') {
        if (this.fps < 45 && this.dynScale > 0.6) { this.dynScale = Math.max(0.6, this.dynScale - 0.1); this.resize(); }
        else if (this.fps > 58 && this.dynScale < 1) { this.dynScale = Math.min(1, this.dynScale + 0.05); this.resize(); }
      }
    }
    if (this.hitstop > 0) { this.hitstop -= dt; dt *= 0.08; }

    if (this.state === 'play') this.updatePlay(dt);
    else if (this.state === 'attract') this.updateAttract(dt);
    else if (this.state === 'dead') { this.updateWorld(dt, false); }

    if (this.state === 'play' || this.state === 'dead' || this.state === 'attract') this.updateLightsAndCamera(dt);
    this.particles.update(dt);
  }

  updateAttract(dt) {
    const d = this.dungeon;
    const r = d.rooms[this.attractRoom % d.rooms.length];
    tmpV.set((r.cx + 0.5) * TILE, 0, (r.cy + 0.5) * TILE);
    this.camTarget.lerp(tmpV, 1 - Math.exp(-dt * 0.35));
    if (this.camTarget.distanceTo(tmpV) < 1.5) this.attractRoom++;
    this.attractLight = this.camTarget;
    for (const e of this.enemies) this.animateEnemy(e, dt, 0);
    this.updateWorld(dt, false);
  }

  updatePlay(dt) {
    const p = this.player, inp = this.input;
    // timers
    p.tAttack -= dt; p.tDash -= dt; p.tNova -= dt; p.inv -= dt; p.swing -= dt;
    if (p.regen > 0) p.hp = Math.min(p.maxHp, p.hp + p.regen * dt);
    this.hurtFlash = Math.max(0, (this.hurtFlash || 0) - dt * 2);

    // movement input (screen → world)
    let mx = inp.mx * SCREEN_RIGHT.x + (-inp.my) * SCREEN_UP.x;
    let mz = inp.mx * SCREEN_RIGHT.y + (-inp.my) * SCREEN_UP.y;
    const ml = Math.hypot(mx, mz);
    if (ml > 1) { mx /= ml; mz /= ml; }

    // auto-target nearest enemy
    let target = null, td = 1e9;
    for (const e of this.enemies) {
      if (e.dead) continue;
      const dx = e.x - p.x, dz = e.z - p.z, d2 = dx * dx + dz * dz;
      if (d2 < td && d2 < 64 && this.dungeon.los(p.x, p.z, e.x, e.z)) { td = d2; target = e; }
    }

    if (p.dashing > 0) {
      p.dashing -= dt;
      this.move(p, p.dvx * dt, p.dvz * dt);
      if (Math.random() < 0.9) this.particles.emit(p.x, rnd(0.5, 1.6), p.z, 0, 0.5, 0, 0.5, 0.7, 1, 0.5, 0.35, 0, 0.9);
    } else {
      const spd = p.speed * (p.swing > 0 ? 0.55 : 1);
      p.vx += (mx * spd - p.vx) * Math.min(1, dt * 14);
      p.vz += (mz * spd - p.vz) * Math.min(1, dt * 14);
      this.move(p, p.vx * dt, p.vz * dt);
    }
    const moving = ml > 0.1;
    if (moving && p.swing <= 0) p.face = Math.atan2(mx, mz);
    if (target && (p.swing > 0 || (!moving && td < 30))) p.face = Math.atan2(target.x - p.x, target.z - p.z);

    // actions
    if (inp.attack && p.tAttack <= 0) this.playerAttack(target, td);
    if (inp.dash) { inp.dash = false; if (p.tDash <= 0) this.playerDash(mx, mz, ml); }
    if (inp.nova) { inp.nova = false; if (p.tNova <= 0) this.playerNova(); }
    if (inp.potion) { inp.potion = false; this.drinkPotion(); }

    // footsteps
    if (moving && p.dashing <= 0) {
      p.stepT -= dt * ml;
      if (p.stepT <= 0) { p.stepT = 0.32; sfx('step', this.biome.step); this.particles.emit(p.x, 0.1, p.z, rnd(-0.5, 0.5), 0.6, rnd(-0.5, 0.5), 0.35, 0.32, 0.3, 0.35, 0.5, -1, 0.9); }
    }

    this.animatePlayer(dt, ml);

    // explore
    this.exploreTimer = (this.exploreTimer || 0) - dt;
    if (this.exploreTimer <= 0) {
      this.exploreTimer = 0.2;
      const d = this.dungeon, cx = Math.floor(p.x / TILE), cz = Math.floor(p.z / TILE);
      for (let y = cz - 7; y <= cz + 7; y++) for (let x = cx - 7; x <= cx + 7; x++) {
        if (x < 0 || y < 0 || x >= d.w || y >= d.h) continue;
        if ((x - cx) ** 2 + (y - cz) ** 2 <= 49) d.explored[y * d.w + x] = 1;
      }
      // boss trigger
      if (isBossFloor(this.floor) && !this.bossSpawned) {
        const ex = d.exit;
        if (cx >= ex.x - 1 && cx <= ex.x + ex.w && cz >= ex.y - 1 && cz <= ex.y + ex.h) this.spawnBoss();
      }
    }

    // flow field toward player
    this.flowTimer -= dt;
    if (this.flowTimer <= 0) { this.flowTimer = 0.25; this.dungeon.bfs(Math.floor(p.x / TILE), Math.floor(p.z / TILE), this.flow); }

    this.updateEnemies(dt);
    this.updateWorld(dt, true);

    // portal
    if (this.portalOpen) {
      const dx = p.x - this.portal.position.x, dz = p.z - this.portal.position.z;
      if (dx * dx + dz * dz < 1.4) this.descend();
    }
    if (this.pendingPerk > 0 && this.state === 'play' && !this.perkOpen) this.offerPerk();
    this.ui.hud(p, this);
  }

  playerAttack(target, td) {
    const p = this.player;
    p.tAttack = p.attackCd;
    p.swing = 0.26; p.swingSide *= -1;
    sfx('swing');
    if (target && td < (p.reach + 1.5) ** 2) p.face = Math.atan2(target.x - p.x, target.z - p.z);
    const fx = Math.sin(p.face), fz = Math.cos(p.face);
    // slash arc particles
    for (let k = 0; k < 14; k++) {
      const a = p.face + (k / 13 - 0.5) * 1.9 * p.swingSide;
      const rr = p.reach * 0.85;
      this.particles.emit(p.x + Math.sin(a) * rr, 1.0, p.z + Math.cos(a) * rr, Math.sin(a) * 2, 0, Math.cos(a) * 2, 0.6, 0.85, 1.0, 0.45, 0.22, 0, 0.9);
    }
    let hitAny = false;
    for (const e of this.enemies) {
      if (e.dead) continue;
      const dx = e.x - p.x, dz = e.z - p.z, d = Math.hypot(dx, dz);
      if (d > p.reach + e.r) continue;
      const dot = (dx * fx + dz * fz) / (d || 1);
      if (dot < Math.cos(1.05) && d > e.r + 0.4) continue;
      const crit = Math.random() < p.crit;
      const dmg = p.dmg * rnd(0.9, 1.1) * (crit ? p.critMult : 1);
      this.damageEnemy(e, dmg, dx / (d || 1) * 9, dz / (d || 1) * 9, crit);
      hitAny = true;
    }
    if (hitAny) this.shakeIt(0.12);
  }

  playerDash(mx, mz, ml) {
    const p = this.player;
    let dx = mx, dz = mz;
    if (ml < 0.1) { dx = Math.sin(p.face); dz = Math.cos(p.face); } else { dx /= ml; dz /= ml; }
    p.dvx = dx * 22; p.dvz = dz * 22; p.dashing = 0.18; p.tDash = p.dashCd; p.inv = 0.3;
    p.face = Math.atan2(dx, dz);
    sfx('dash');
    this.particles.burst(p.x, 0.3, p.z, 16, 0x9ad0ff, 4, 0.4, 0.4, 0);
  }

  playerNova() {
    const p = this.player;
    p.tNova = p.novaCd;
    sfx('nova');
    this.shakeIt(0.45);
    this.particles.ring(p.x, 0.5, p.z, 90, 0xff7020, 16, 0.7, 0.55);
    this.particles.ring(p.x, 1.0, p.z, 60, 0xffd080, 11, 0.5, 0.5);
    this.particles.burst(p.x, 1, p.z, 40, 0xffa040, 6, 0.5, 0.6, 2);
    this.novaFlash = 1;
    for (const e of this.enemies) {
      if (e.dead) continue;
      const dx = e.x - p.x, dz = e.z - p.z, d = Math.hypot(dx, dz);
      if (d < 6 + e.r) this.damageEnemy(e, p.novaDmg * (1 - d / 12), dx / (d || 1) * 16, dz / (d || 1) * 16, false);
    }
    for (const pr of this.projectiles) if (pr.owner === 'enemy') {
      const dx = pr.x - p.x, dz = pr.z - p.z; if (dx * dx + dz * dz < 40) pr.life = 0;
    }
  }

  drinkPotion() {
    const p = this.player;
    if (p.potions <= 0 || p.hp >= p.maxHp) { sfx('click'); return; }
    p.potions--;
    p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.4 * p.potionPow);
    sfx('potion');
    this.particles.burst(p.x, 1.2, p.z, 30, 0xff3050, 3, 0.4, 0.9, 3);
  }

  descend() {
    this.state = 'transition';
    sfx('portal');
    this.ui.fade(true);
    setTimeout(() => {
      const next = this.floor + 1;
      if (this.floor === TOTAL_FLOORS && !this.endless) {
        meta.wins++; saveMeta();
        const score = this.score();
        if (score > meta.bestScore) { meta.bestScore = score; saveMeta(); }
        this.state = 'victory';
        this.ui.fade(false);
        this.ui.victory({ floor: this.floor, kills: this.stats.kills, gold: this.player.gold, level: this.player.level, score, time: (performance.now() - this.stats.start) / 1000 });
        return;
      }
      p_heal(this.player);
      this.enterFloor(next);
      this.ui.fade(false);
    }, 700);
    function p_heal(p) { p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.25); }
  }

  continueEndless() {
    this.endless = true;
    this.player.hp = this.player.maxHp;
    this.enterFloor(this.floor + 1);
  }

  offerPerk() {
    this.pendingPerk--;
    this.perkOpen = true;
    const pool = PERKS.slice();
    const opts = [];
    for (let i = 0; i < 3; i++) opts.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    sfx('levelup');
    this.particles.ring(this.player.x, 0.3, this.player.z, 50, 0xffd060, 5, 0.5, 1.0);
    this.ui.showPerks(opts, this.player.level, (perk) => {
      perk.apply(this.player);
      this.player.perks.push(perk.id);
      this.perkOpen = false;
      sfx('click');
    });
  }

  animatePlayer(dt, ml) {
    const p = this.player, u = p.model.userData;
    p.model.position.set(p.x, 0, p.z);
    let diff = p.face - p.model.rotation.y;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    p.model.rotation.y += diff * Math.min(1, dt * 18);
    p.anim = (p.anim || 0) + dt * (4 + ml * 8);
    const sw = Math.sin(p.anim) * 0.6 * Math.min(1, ml);
    u.legL.rotation.x = sw; u.legR.rotation.x = -sw;
    u.body.position.y = Math.abs(Math.cos(p.anim)) * 0.06 * Math.min(1, ml);
    u.cape.rotation.x = 0.15 + Math.min(1, ml) * 0.45 + Math.sin(this.time * 3) * 0.05;
    u.armL.rotation.x = -sw * 0.5;
    if (p.swing > 0) {
      const t = 1 - p.swing / 0.26;
      const e = t < 0.3 ? t / 0.3 : 1;
      u.armR.rotation.x = -1.2 * (1 - e) - 0.3;
      u.armR.rotation.z = 0;
      u.armR.rotation.y = 0;
      u.body.rotation.y = p.swingSide * (1.2 - e * 2.4) * 0.6;
    } else {
      u.armR.rotation.x += (sw * 0.5 - u.armR.rotation.x) * Math.min(1, dt * 10);
      u.body.rotation.y *= 1 - Math.min(1, dt * 10);
    }
    u.blade.material.emissiveIntensity = 0.25 + (p.swing > 0 ? 1.5 : 0) + Math.sin(this.time * 2) * 0.1;
    p.model.visible = !(p.inv > 0 && p.dashing <= 0 && Math.floor(this.time * 20) % 2 === 0);
  }

  updateEnemies(dt) {
    const p = this.player, d = this.dungeon;
    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i];
      if (e.dead) continue;
      const dx = p.x - e.x, dz = p.z - e.z, dist = Math.hypot(dx, dz);
      const nx = dx / (dist || 1), nz = dz / (dist || 1);
      if (!e.aggro && dist < 11 && (dist < 4 || d.los(e.x, e.z, p.x, p.z))) { e.aggro = true; if (Math.random() < 0.4) sfx('growl'); }
      e.cd -= dt; e.t -= dt; e.hitT -= dt;
      let mvx = 0, mvz = 0;
      const fly = !!e.def.fly;
      if (e.aggro && this.state === 'play') {
        const ai = e.def.ai;
        const los = dist < 14 && d.los(e.x, e.z, p.x, p.z);
        const chase = () => {
          if (los && dist < 7) { mvx = nx; mvz = nz; return; }
          const cx = Math.floor(e.x / TILE), cz = Math.floor(e.z / TILE);
          const cur = this.flow[cz * d.w + cx];
          let best = cur, bx = 0, bz = 0;
          for (let oz = -1; oz <= 1; oz++) for (let ox = -1; ox <= 1; ox++) {
            if (!ox && !oz) continue;
            const v = this.flow[(cz + oz) * d.w + cx + ox];
            if (v >= 0 && (best < 0 || v < best)) {
              if (ox && oz && (d.get(cx + ox, cz) !== FLOOR || d.get(cx, cz + oz) !== FLOOR)) continue;
              best = v; bx = ox; bz = oz;
            }
          }
          if (bx || bz) {
            const tx = (cx + bx + 0.5) * TILE - e.x, tz = (cz + bz + 0.5) * TILE - e.z, l = Math.hypot(tx, tz) || 1;
            mvx = tx / l; mvz = tz / l;
          } else { mvx = nx; mvz = nz; }
        };
        if (ai === 'melee' || ai === 'lunger') {
          if (e.state === 'windup') {
            if (e.t <= 0) {
              if (ai === 'lunger') { e.state = 'lunge'; e.t = 0.3; e.lx = nx; e.lz = nz; sfx('dash'); }
              else {
                e.state = 'recover'; e.t = 0.45;
                if (dist < e.def.range + 0.5 + p.r) { this.hurtPlayer(e.dmg, e.x, e.z); if (p.thorns) this.damageEnemy(e, p.thorns, -nx * 3, -nz * 3, false, 'thorns'); }
                this.particles.burst(e.x + nx * 1.2, 0.8, e.z + nz * 1.2, 8, 0xffffff, 4, 0.25, 0.25, 0);
              }
            }
          } else if (e.state === 'lunge') {
            this.move(e, e.lx * 13 * dt, e.lz * 13 * dt, fly);
            if (dist < e.r + p.r + 0.3 && !e.lungeHit) { e.lungeHit = true; this.hurtPlayer(e.dmg, e.x, e.z); }
            if (e.t <= 0) { e.state = 'recover'; e.t = 0.6; e.lungeHit = false; }
          } else if (e.state === 'recover') {
            if (e.t <= 0) e.state = 'chase';
          } else {
            const trig = ai === 'lunger' ? 4.5 : e.def.range;
            if (dist < trig && e.cd <= 0 && los) { e.state = 'windup'; e.t = ai === 'lunger' ? 0.45 : 0.42; e.cd = rnd(0.9, 1.5); sfx('telegraph'); }
            else chase();
          }
        } else if (ai === 'ranged' || ai === 'spread' || ai === 'blinker') {
          if (e.state === 'windup') {
            if (e.t <= 0) {
              e.state = 'chase';
              const n = ai === 'spread' ? 5 : 1;
              for (let k = 0; k < n; k++) {
                const a = Math.atan2(nx, nz) + (n > 1 ? (k / (n - 1) - 0.5) * 0.9 : 0);
                this.shoot(e.x + nx * 0.6, e.z + nz * 0.6, Math.sin(a), Math.cos(a), e.def.pspeed, e.dmg, e.def.pcolor, 'enemy', ai === 'spread' ? 0.2 : 0.24);
              }
              sfx(ai === 'blinker' ? 'frost' : 'shoot');
            }
          } else {
            if (ai === 'blinker' && e.cd <= 0 && Math.random() < 0.012 && dist < 12) {
              // teleport near player
              for (let tries = 0; tries < 8; tries++) {
                const a = Math.random() * Math.PI * 2, r = rnd(4, 6);
                const tx = p.x + Math.cos(a) * r, tz = p.z + Math.sin(a) * r;
                if (!this.blocked(tx, tz, e.r, false) && d.los(tx, tz, p.x, p.z)) {
                  this.particles.burst(e.x, 1.2, e.z, 25, e.def.color, 5, 0.4, 0.5, 0);
                  e.x = tx; e.z = tz; sfx('frost');
                  this.particles.burst(e.x, 1.2, e.z, 25, e.def.color, 5, 0.4, 0.5, 0);
                  e.cd = 0.6; break;
                }
              }
            }
            if (los && dist < 10 && e.cd <= 0) { e.state = 'windup'; e.t = 0.5; e.cd = e.def.cd * rnd(0.85, 1.2); }
            else if (!los || dist > 8.5) chase();
            else if (dist < 4.5) { mvx = -nx; mvz = -nz; }
            else { mvx = -nz * 0.6 * Math.sin(this.time + i); mvz = nx * 0.6 * Math.sin(this.time + i); }
          }
        } else if (ai === 'charger') {
          if (e.state === 'windup') {
            if (e.t <= 0) { e.state = 'charge'; e.t = 1.2; e.lx = nx; e.lz = nz; sfx('growl'); }
          } else if (e.state === 'charge') {
            const hit = this.move(e, e.lx * 14 * dt, e.lz * 14 * dt, false);
            if (Math.random() < 0.6) this.particles.emit(e.x, 0.2, e.z, rnd(-1, 1), 1, rnd(-1, 1), 0.6, 0.5, 0.4, 0.6, 0.5, -2, 0.95);
            if (dist < e.r + p.r + 0.4 && !e.lungeHit) { e.lungeHit = true; this.hurtPlayer(e.dmg, e.x, e.z); }
            if (hit || e.t <= 0) { e.state = 'recover'; e.t = 1.0; e.lungeHit = false; if (hit) { this.shakeIt(0.3); sfx('explode'); this.particles.burst(e.x + e.lx, 1, e.z + e.lz, 20, 0x8a7a6a, 6, 0.4, 0.6, -10); } }
          } else if (e.state === 'recover') {
            if (e.t <= 0) e.state = 'chase';
          } else if (e.state === 'slam') {
            if (e.t <= 0) { e.state = 'recover'; e.t = 0.8; }
          } else {
            if (dist < 2.4 && e.cd <= 0) {
              e.state = 'slam'; e.t = 0.9; e.cd = 2.5; sfx('telegraph');
              this.addDecal(e.x, e.z, 3, 0xff3010, 0.8, () => {
                if (e.dead) return;
                sfx('explode'); this.shakeIt(0.4);
                this.particles.ring(e.x, 0.3, e.z, 40, e.def.color, 8, 0.5, 0.5);
                if (Math.hypot(p.x - e.x, p.z - e.z) < 3 + p.r) this.hurtPlayer(e.dmg, e.x, e.z);
              });
            } else if (dist < 9 && dist > 3.5 && los && e.cd <= 0) { e.state = 'windup'; e.t = 0.75; e.cd = 3.5; sfx('telegraph'); }
            else chase();
          }
        } else if (ai === 'boss') {
          this.bossAI(e, dt, dist, nx, nz, los, chase);
        }
      } else if (!e.aggro) {
        // idle wander
        if (e.t <= 0) { e.t = rnd(1.5, 4); e.wx = rnd(-1, 1); e.wz = rnd(-1, 1); if (Math.random() < 0.5) e.wx = e.wz = 0; }
        mvx = (e.wx || 0) * 0.35; mvz = (e.wz || 0) * 0.35;
      }

      // separation
      for (let j = i + 1; j < this.enemies.length; j++) {
        const o = this.enemies[j]; if (o.dead) continue;
        const sx = e.x - o.x, sz = e.z - o.z, rr = e.r + o.r;
        const d2 = sx * sx + sz * sz;
        if (d2 < rr * rr && d2 > 0.0001) {
          const dd = Math.sqrt(d2), push = (rr - dd) * 0.5 / dd;
          if (!e.boss) { e.kx += sx * push * 8; e.kz += sz * push * 8; }
          if (!o.boss) { o.kx -= sx * push * 8; o.kz -= sz * push * 8; }
        }
      }
      // player body block
      if (dist < e.r + p.r && dist > 0.001) {
        const push = (e.r + p.r - dist);
        if (!e.boss) { e.x -= nx * push * 0.5; e.z -= nz * push * 0.5; }
        this.move(p, nx * push * 0.5, nz * push * 0.5);
      }

      const busy = e.state === 'windup' || e.state === 'lunge' || e.state === 'charge' || e.state === 'slam' || e.state === 'intro';
      const sp = busy ? 0 : e.speed * (e.state === 'recover' ? 0.3 : 1);
      this.move(e, (mvx * sp + e.kx) * dt, (mvz * sp + e.kz) * dt, fly);
      e.kx *= Math.pow(0.0005, dt); e.kz *= Math.pow(0.0005, dt);
      if (mvx || mvz) e.face = Math.atan2(mvx, mvz);
      if (e.aggro && (busy || (e.def.ai !== 'melee' && dist < 10))) e.face = Math.atan2(nx, nz);
      this.animateEnemy(e, dt, Math.hypot(mvx, mvz) * sp);
    }
    // remove dead
    if (this.enemies.some((e) => e.dead)) this.enemies = this.enemies.filter((e) => !e.dead);
  }

  bossAI(e, dt, dist, nx, nz, los, chase) {
    const p = this.player;
    if (e.state === 'intro') { if (e.t <= 0) { e.state = 'chase'; e.cd = 1; } return; }
    const enraged = e.hp < e.maxHp * 0.5;
    if (e.state === 'chase') {
      if (dist > 3.2) chase();
      if (e.cd <= 0) {
        const pats = ['ring', 'spiral', 'summon', 'charge', 'slam'];
        const pick = pats[e.pattern % pats.length];
        e.pattern += 1 + (Math.random() < 0.4 ? 1 : 0);
        e.state = pick; e.t = { ring: 1.6, spiral: 2.6, summon: 1.2, charge: 0.8, slam: 1.2 }[pick]; e.sub = 0; e.subT = 0;
        sfx('telegraph');
        if (pick === 'slam') {
          const tx = p.x, tz = p.z;
          this.addDecal(tx, tz, 4, 0xff2010, 1.0, () => {
            sfx('explode'); this.shakeIt(0.5);
            this.particles.ring(tx, 0.3, tz, 60, e.def.pcolor, 10, 0.6, 0.6);
            this.particles.burst(tx, 0.5, tz, 30, 0xffffff, 6, 0.4, 0.5, -6);
            if (Math.hypot(p.x - tx, p.z - tz) < 4 + p.r) this.hurtPlayer(e.dmg * 1.3, tx, tz);
          });
          if (enraged) {
            const ang = Math.random() * 6;
            for (let k = 0; k < 2; k++) {
              const ox = p.x + Math.cos(ang + k * 3) * 4, oz = p.z + Math.sin(ang + k * 3) * 4;
              this.addDecal(ox, oz, 3, 0xff2010, 1.3, () => { sfx('explode'); this.particles.ring(ox, 0.3, oz, 40, e.def.pcolor, 8, 0.5, 0.5); if (Math.hypot(p.x - ox, p.z - oz) < 3 + p.r) this.hurtPlayer(e.dmg, ox, oz); });
            }
          }
        }
      }
      return;
    }
    e.subT -= dt;
    if (e.state === 'ring') {
      if (e.subT <= 0 && e.sub < 3) {
        e.sub++; e.subT = 0.45;
        const n = enraged ? 20 : 14, off = e.sub * 0.2;
        for (let k = 0; k < n; k++) { const a = (k / n) * Math.PI * 2 + off; this.shoot(e.x, e.z, Math.cos(a), Math.sin(a), 8, e.dmg * 0.7, e.def.pcolor, 'enemy', 0.28); }
        sfx('shoot'); this.shakeIt(0.15);
      }
    } else if (e.state === 'spiral') {
      if (e.subT <= 0) {
        e.subT = enraged ? 0.07 : 0.1; e.sub += 0.42;
        for (let k = 0; k < 3; k++) { const a = e.sub + k * Math.PI * 2 / 3; this.shoot(e.x, e.z, Math.cos(a), Math.sin(a), 7.5, e.dmg * 0.6, e.def.pcolor, 'enemy', 0.24); }
        if (Math.random() < 0.3) sfx('shoot');
      }
    } else if (e.state === 'summon') {
      if (e.sub === 0) {
        e.sub = 1;
        const roster = this.biome.enemies;
        const n = enraged ? 4 : 3;
        for (let k = 0; k < n; k++) {
          const a = (k / n) * Math.PI * 2;
          const sx = e.x + Math.cos(a) * 2.8, sz = e.z + Math.sin(a) * 2.8;
          if (this.blocked(sx, sz, 0.5, false)) continue;
          const m = this.spawnEnemy(roster[Math.floor(Math.random() * roster.length)], sx, sz);
          m.aggro = true;
          this.particles.burst(sx, 0.5, sz, 25, e.def.pcolor, 5, 0.4, 0.6, 2);
        }
        sfx('growl');
      }
    } else if (e.state === 'charge') {
      if (e.sub === 0 && e.t < 0.05) { e.sub = 1; e.lx = nx; e.lz = nz; e.chT = 0.9; sfx('dash'); }
      if (e.sub === 1) {
        e.chT -= dt;
        const hit = this.move(e, e.lx * 16 * dt, e.lz * 16 * dt, e.def.fly);
        this.particles.emit(e.x, 0.5, e.z, rnd(-1, 1), 1, rnd(-1, 1), 0.8, 0.4, 0.3, 0.8, 0.5, 0, 0.95);
        if (dist < e.r + p.r + 0.3 && !e.lungeHit) { e.lungeHit = true; this.hurtPlayer(e.dmg, e.x, e.z); }
        if (hit || e.chT <= 0) { e.sub = 2; e.lungeHit = false; e.t = 0.6; if (hit) { this.shakeIt(0.5); sfx('explode'); } }
        e.t = Math.max(e.t, 0.1);
      }
    }
    if (e.t <= 0) { e.state = 'chase'; e.cd = enraged ? rnd(0.8, 1.4) : rnd(1.4, 2.2); }
  }

  animateEnemy(e, dt, speed) {
    const m = e.model, u = m.userData;
    m.position.set(e.x, 0, e.z);
    let diff = e.face - m.rotation.y; diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    m.rotation.y += diff * Math.min(1, dt * 8);
    e.anim += dt * (2 + speed * 2.2);
    const s = Math.sin(e.anim);
    const wind = e.state === 'windup' || e.state === 'slam';
    if (u.legL) { u.legL.rotation.x = s * 0.6 * Math.min(1, speed); u.legR.rotation.x = -s * 0.6 * Math.min(1, speed); }
    if (u.armR) u.armR.rotation.x = wind ? -2.4 : (e.state === 'recover' ? 0.6 : -s * 0.5 * Math.min(1, speed) - 0.2);
    if (u.armL) u.armL.rotation.x = wind && e.type === 'golem' ? -2.4 : s * 0.4 * Math.min(1, speed);
    if (u.legs) u.legs.forEach((l, k) => { l.rotation.x = Math.sin(e.anim * 2 + k * 1.3) * 0.35 * Math.min(1, speed + 0.1); });
    if (u.blob) { const q = 1 + Math.sin(this.time * 6 + e.anim) * 0.08; u.body.scale.set(q, 2 - q, q); u.core.rotation.y += dt * 2; }
    if (u.float) u.body.position.y = 0.3 + Math.sin(this.time * 2 + e.anim) * 0.15;
    if (u.wL) { const f = Math.sin(this.time * 18) * 0.5; u.wL.rotation.y = Math.PI + 0.5 + f; u.wR.rotation.y = -0.5 - f; u.body.position.y = 0.3 + Math.sin(this.time * 3) * 0.1; }
    if (u.tents) u.tents.forEach((t, k) => { t.rotation.x = Math.sin(this.time * 3 + k) * 0.4; t.rotation.z = Math.cos(this.time * 2.5 + k) * 0.4; });
    if (u.orb) u.orb.scale.setScalar(wind ? 1.8 + Math.sin(this.time * 30) * 0.3 : 1);
    if (u.core && u.core.material) u.core.rotation.y += dt;
    // hit squash + windup tremble
    const hs = e.hitT > 0 ? 1 + e.hitT * 1.5 : 1;
    const base = e.scale;
    m.scale.set(base * hs, base * (2 - hs), base * hs);
    if (wind) { m.position.x += Math.sin(this.time * 60) * 0.05; }
    if (e.boss && Math.random() < 0.3) this.particles.emit(e.x + rnd(-1, 1), rnd(0.5, 3), e.z + rnd(-1, 1), 0, 1, 0, ...this.hexRGB(e.def.pcolor), 0.4, 0.8, 0.5, 0.97);
  }

  hexRGB(h) { return [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255]; }

  updateWorld(dt, live) {
    const p = this.player;
    // projectiles
    for (const pr of this.projectiles) {
      pr.life -= dt;
      pr.x += pr.vx * dt; pr.z += pr.vz * dt;
      pr.mesh.position.set(pr.x, 1.1, pr.z);
      this.particles.emit(pr.x, 1.1, pr.z, rnd(-0.3, 0.3), rnd(-0.3, 0.3), rnd(-0.3, 0.3), pr.color.r, pr.color.g, pr.color.b, 0.45, 0.25, 0, 0.9);
      const cell = this.dungeon.get(Math.floor(pr.x / TILE), Math.floor(pr.z / TILE));
      if (cell === WALL) { pr.life = 0; this.particles.burst(pr.x, 1.1, pr.z, 10, pr.color.getHex(), 4, 0.3, 0.3, -6); continue; }
      if (live && pr.owner === 'enemy' && p && (p.x - pr.x) ** 2 + (p.z - pr.z) ** 2 < (pr.r + p.r) ** 2) {
        pr.life = 0; this.hurtPlayer(pr.dmg, pr.x - pr.vx * 0.05, pr.z - pr.vz * 0.05);
        this.particles.burst(pr.x, 1.1, pr.z, 14, pr.color.getHex(), 5, 0.35, 0.4, -6);
      }
    }
    if (this.projectiles.some((pr) => pr.life <= 0)) {
      this.projectiles = this.projectiles.filter((pr) => { if (pr.life <= 0) { this.world.remove(pr.mesh); return false; } return true; });
    }
    // decals
    for (const dc of this.decals) {
      dc.t += dt;
      const k = Math.min(1, dc.t / dc.time);
      dc.fill.scale.setScalar(Math.max(0.01, dc.radius * k));
      dc.ring.material.opacity = 0.5 + Math.sin(this.time * 20) * 0.3;
      if (k >= 1 && !dc.done) { dc.done = true; if (dc.onDone && live) dc.onDone(); this.world.remove(dc.ring, dc.fill); }
    }
    if (this.decals.some((dc) => dc.done)) this.decals = this.decals.filter((dc) => !dc.done);
    // pickups
    for (const pk of this.pickups) {
      pk.t += dt;
      if (pk.vy !== 0 || pk.y > 0.3) {
        pk.vy -= 18 * dt; pk.y += pk.vy * dt;
        const nx = pk.x + pk.vx * dt, nz = pk.z + pk.vz * dt;
        if (this.dungeon.get(Math.floor(nx / TILE), Math.floor(nz / TILE)) === FLOOR) { pk.x = nx; pk.z = nz; } else { pk.vx *= -0.4; pk.vz *= -0.4; }
        if (pk.y <= 0.3) { pk.y = 0.3; pk.vy = Math.abs(pk.vy) > 2 ? -pk.vy * 0.35 : 0; pk.vx *= 0.6; pk.vz *= 0.6; }
      }
      pk.mesh.position.set(pk.x, pk.y + Math.sin(this.time * 3 + pk.x) * 0.08, pk.z);
      pk.mesh.rotation.y += dt * 2;
      if (live && p && pk.t > 0.5) {
        const dx = p.x - pk.x, dz = p.z - pk.z, d = Math.hypot(dx, dz);
        if (d < p.magnet && pk.kind === 'gold') { pk.x += dx / d * dt * 12; pk.z += dz / d * dt * 12; }
        if (d < 0.9) {
          pk.taken = true; this.world.remove(pk.mesh);
          if (pk.kind === 'gold') { const v = Math.round(pk.value * p.goldMult); p.gold += v; sfx('gold'); this.particles.burst(pk.x, 0.5, pk.z, 6, 0xffd060, 3, 0.25, 0.4, -4); }
          else if (pk.kind === 'potion') { if (p.potions < 9) { p.potions++; sfx('potion'); } else { p.hp = Math.min(p.maxHp, p.hp + 20); sfx('potion'); } this.ui.toast('+1 İksir'); }
        }
      }
    }
    if (this.pickups.some((pk) => pk.taken)) this.pickups = this.pickups.filter((pk) => !pk.taken);
    // chests
    for (const c of this.chests) {
      if (!c.open && live && p && (p.x - c.x) ** 2 + (p.z - c.z) ** 2 < 2.6) {
        c.open = true; sfx('chest');
        const n = 4 + Math.floor(Math.random() * 5);
        for (let k = 0; k < n; k++) this.spawnPickup('gold', c.x, c.z, 4 + Math.floor(Math.random() * 5 * this.floor));
        if (Math.random() < 0.5) this.spawnPickup('potion', c.x, c.z);
        if (Math.random() < 0.35) { this.pendingPerk = (this.pendingPerk || 0) + 1; this.ui.toast('Kadim bir güç buldun!'); }
        this.particles.burst(c.x, 0.8, c.z, 40, 0xffd060, 5, 0.4, 0.9, -4);
      }
      if (c.open && c.t < 1) {
        c.t = Math.min(1, c.t + dt * 2.5);
        c.mesh.userData.lid.rotation.x = -c.t * 1.9;
        c.mesh.userData.glow.material.opacity = Math.sin(c.t * Math.PI) * 0.8;
      }
    }
    // torch flames
    const pf = this.Q.particles;
    for (const t of this.torches) {
      if (Math.random() < 0.7 * pf) this.particles.emit(t.x + rnd(-0.06, 0.06), t.y, t.z + rnd(-0.06, 0.06), rnd(-0.15, 0.15), rnd(1.2, 2.0), rnd(-0.15, 0.15), t.color.r * 1.2, t.color.g, t.color.b * 0.8, rnd(0.35, 0.6), rnd(0.25, 0.45), 1.5, 0.95);
    }
    for (const g of this.glows) if (g.fire && Math.random() < 0.8 * pf) this.particles.emit(g.x + rnd(-0.2, 0.2), g.fire, g.z + rnd(-0.2, 0.2), 0, rnd(1.5, 2.5), 0, 1, 0.5, 0.15, rnd(0.4, 0.7), 0.4, 1, 0.95);
    // ambient particles around camera target
    const ct = this.camTarget;
    const kind = this.biome.particles;
    if (Math.random() < 0.6 * pf) {
      const x = ct.x + rnd(-14, 14), z = ct.z + rnd(-14, 14);
      if (kind === 'dust') this.particles.emit(x, rnd(0.3, 3), z, rnd(-0.1, 0.1), rnd(-0.05, 0.1), rnd(-0.1, 0.1), 0.5, 0.45, 0.4, 0.12, 4, 0, 1);
      else if (kind === 'embers') this.particles.emit(x, 0.1, z, rnd(-0.3, 0.3), rnd(0.8, 1.8), rnd(-0.3, 0.3), 1, 0.4, 0.08, 0.18, 3, 0.1, 0.99);
      else if (kind === 'snow') this.particles.emit(x, 5, z, rnd(-0.5, 0.2), -rnd(0.6, 1.1), rnd(-0.5, 0.2), 0.7, 0.8, 0.9, 0.16, 5, 0, 1);
      else if (kind === 'spores') this.particles.emit(x, rnd(0.2, 2), z, rnd(-0.2, 0.2), rnd(0.05, 0.3), rnd(-0.2, 0.2), 0.4, 1, 0.5, 0.15, 4, 0, 1);
      else if (kind === 'void') this.particles.emit(x, rnd(0.2, 3), z, 0, rnd(0.2, 0.6), 0, 0.7, 0.3, 1, 0.16, 3, 0, 1);
    }
    // liquid bubbles
    if (this.biome.liquid.lava || this.biome.id === 'swamp') {
      for (const g of this.glows) if (g.pool && Math.random() < 0.15 * pf) {
        const c = g.color; this.particles.emit(g.x + rnd(-2, 2), -0.2, g.z + rnd(-2, 2), 0, rnd(1, 2.5), 0, c.r, c.g, c.b, 0.3, 0.6, -2, 0.98);
      }
    }
    // portal
    if (this.portal) {
      const u = this.portal.userData;
      u.vortex.material.uniforms.uTime.value = this.time;
      const target = this.portalOpen ? 1 : 0.12;
      u.vortex.material.uniforms.uOpen.value += (target - u.vortex.material.uniforms.uOpen.value) * Math.min(1, dt * 2);
      u.runeRing.rotation.z += dt * 0.5;
      if (this.portalOpen && Math.random() < 0.5 * pf) {
        const a = Math.random() * 6.28, c = new THREE.Color(this.biome.torch);
        this.particles.emit(this.portal.position.x + Math.cos(a) * 1.3, 0.3, this.portal.position.z + Math.sin(a) * 1.3, -Math.cos(a) * 0.6, rnd(1, 2.5), -Math.sin(a) * 0.6, c.r, c.g, c.b, 0.3, 1, 0, 0.98);
      }
    }
  }

  updateLightsAndCamera(dt) {
    const p = this.player;
    const playing = (this.state === 'play' || this.state === 'dead') && p;
    const focus = playing ? tmpV2.set(p.x, 0, p.z) : this.camTarget;
    if (playing) this.camTarget.lerp(focus, 1 - Math.exp(-dt * 6));
    // camera
    const ct = this.camTarget;
    let sx = 0, sy = 0;
    if (this.shake > 0) { this.shake = Math.max(0, this.shake - dt * 2.2); const s = this.shake * this.shake * 0.8; sx = rnd(-s, s); sy = rnd(-s, s); }
    this.camera.position.set(ct.x + ISO.x * 50 + sx, ISO.y * 50 + sy, ct.z + ISO.z * 50 - sx);
    this.camera.lookAt(ct.x + sx, sy, ct.z - sx);
    if (playing) this.cutaway.uPlayer.value.set(p.x, 1.0, p.z);
    this.cutaway.uCamDir.value.copy(ISO);

    // key light follows focus
    this.key.position.set(ct.x - 8, 22, ct.z + 12);
    this.key.target.position.set(ct.x, 0, ct.z);

    // player torch
    const flick = 1 + Math.sin(this.time * 13) * 0.04 + Math.sin(this.time * 31) * 0.03;
    if (playing) {
      this.torchLight.position.set(p.x - 0.4, 3.0, p.z - 0.4);
      this.torchLight.intensity = 34 * flick + (this.novaFlash || 0) * 140;
      this.torchLight.color.setHex(this.novaFlash > 0.1 ? 0xff9040 : 0xffc890);
      this.novaFlash = Math.max(0, (this.novaFlash || 0) - dt * 3);
    } else {
      this.torchLight.position.set(ct.x, 4, ct.z);
      this.torchLight.intensity = 26 * flick;
    }

    // light pool: nearest emitters
    const cand = this._cand || (this._cand = []);
    cand.length = 0;
    const fx = ct.x, fz = ct.z;
    const consider = (o, inten, col) => {
      const dx = o.x - fx, dz = o.z - fz, d2 = dx * dx + dz * dz;
      if (d2 < 500) cand.push({ o, d2, inten, col });
    };
    for (const t of this.torches) consider(t, t.i * (1 + Math.sin(this.time * 9 + t.seed) * 0.08 + Math.sin(this.time * 23 + t.seed * 3) * 0.05), t.color);
    for (const g of this.glows) consider(g, g.portal ? (this.portalOpen ? g.i : g.i * 0.2) : g.i * (1 + Math.sin(this.time * 2 + g.seed) * 0.15), g.color);
    for (const pr of this.projectiles) consider({ x: pr.x, y: 1.1, z: pr.z }, 9, pr.color);
    cand.sort((a, b) => a.d2 - b.d2);
    for (let i = 0; i < this.pool.length; i++) {
      const l = this.pool[i], c = cand[i];
      if (c) {
        l.position.set(c.o.x, c.o.y, c.o.z); l.color.copy(c.col);
        const fade = Math.min(1, Math.max(0, (480 - c.d2) / 120));
        l.intensity = c.inten * fade;
      } else l.intensity = 0;
    }
  }

  render() {
    if (this.composer) {
      if (this.finalPass) {
        this.finalPass.uniforms.uTime.value = this.time;
        this.finalPass.uniforms.uHurt.value = this.hurtFlash || 0;
        const lowHp = this.player && this.state === 'play' ? Math.max(0, 1 - this.player.hp / this.player.maxHp / 0.3) : 0;
        this.finalPass.uniforms.uVig.value = 1 + lowHp * 0.8 * (0.8 + Math.sin(this.time * 6) * 0.2);
      }
      this.composer.render();
    } else this.renderer.render(this.scene, this.camera);
  }
}
