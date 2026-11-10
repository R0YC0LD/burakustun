// Procedural 3D models built from primitives with PBR materials.
import * as THREE from 'three';

const geoCache = {};
const G = (key, fn) => geoCache[key] || (geoCache[key] = fn());
const matCache = {};
export function M(key, opts) {
  if (!matCache[key]) {
    matCache[key] = opts.physical ? new THREE.MeshPhysicalMaterial(opts.p) : new THREE.MeshStandardMaterial(opts.p || opts);
  }
  return matCache[key];
}

const mats = {
  steel: () => M('steel', { color: 0xb8c0cc, metalness: 0.95, roughness: 0.28 }),
  darkSteel: () => M('darkSteel', { color: 0x3a3f48, metalness: 0.9, roughness: 0.4 }),
  gold: () => M('gold', { color: 0xffc860, metalness: 1, roughness: 0.25 }),
  leather: () => M('leather', { color: 0x4a2e1c, metalness: 0, roughness: 0.75 }),
  cloth: () => M('cloth', { color: 0x8a1420, metalness: 0, roughness: 0.9, side: THREE.DoubleSide }),
  bone: () => M('bone', { color: 0xd8ccb0, metalness: 0, roughness: 0.65 }),
  rust: () => M('rust', { color: 0x6a4030, metalness: 0.6, roughness: 0.7 }),
  wood: () => M('wood', { color: 0x5a3a22, metalness: 0, roughness: 0.8 }),
  stone: () => M('stone', { color: 0x6a6660, metalness: 0, roughness: 0.9 }),
  blade: () => M('blade', { color: 0xdde6f0, metalness: 1, roughness: 0.12, emissive: 0x3080ff, emissiveIntensity: 0.25 }),
};

function eye(color, r = 0.05) {
  return new THREE.Mesh(G('eye' + r, () => new THREE.SphereGeometry(r, 8, 6)), M('eye' + color, { color: 0x000000, emissive: color, emissiveIntensity: 4 }));
}

function mesh(geo, mat, x = 0, y = 0, z = 0, cast = true) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = cast; m.receiveShadow = false;
  return m;
}

// --------------------------------------------------- PLAYER
export function makePlayer() {
  const root = new THREE.Group();
  const body = new THREE.Group(); root.add(body);
  const torso = mesh(G('torso', () => new THREE.CapsuleGeometry(0.32, 0.45, 6, 12)), mats.steel(), 0, 1.05, 0);
  torso.scale.set(1, 1, 0.8);
  body.add(torso);
  const belt = mesh(G('belt', () => new THREE.CylinderGeometry(0.34, 0.34, 0.1, 16)), mats.leather(), 0, 0.82, 0); body.add(belt);
  const buckle = mesh(G('buckle', () => new THREE.BoxGeometry(0.1, 0.08, 0.04)), mats.gold(), 0, 0.82, 0.28); body.add(buckle);
  const pauldL = mesh(G('pauld', () => new THREE.SphereGeometry(0.2, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2)), mats.darkSteel(), -0.36, 1.35, 0);
  const pauldR = pauldL.clone(); pauldR.position.x = 0.36;
  body.add(pauldL, pauldR);
  const head = new THREE.Group(); head.position.set(0, 1.62, 0); body.add(head);
  head.add(mesh(G('helm', () => new THREE.SphereGeometry(0.22, 16, 12)), mats.steel()));
  const visor = mesh(G('visor', () => new THREE.BoxGeometry(0.3, 0.05, 0.12)), M('visor', { color: 0x050505, roughness: 0.3 }), 0, 0, 0.17);
  head.add(visor);
  const crest = mesh(G('crest', () => new THREE.BoxGeometry(0.04, 0.16, 0.36)), M('crest', { color: 0xaa1020, roughness: 0.8 }), 0, 0.22, -0.02);
  head.add(crest);
  const e1 = eye(0x88ccff, 0.025); e1.position.set(-0.07, 0, 0.22); head.add(e1);
  const e2 = eye(0x88ccff, 0.025); e2.position.set(0.07, 0, 0.22); head.add(e2);
  // cape
  const capeGeo = G('cape', () => { const g = new THREE.PlaneGeometry(0.6, 0.95, 4, 6); g.translate(0, -0.47, 0); return g; });
  const cape = mesh(capeGeo, mats.cloth(), 0, 1.42, -0.26); cape.rotation.x = 0.12; body.add(cape);
  // legs
  const legGeo = G('leg', () => { const g = new THREE.CapsuleGeometry(0.11, 0.42, 4, 8); g.translate(0, -0.3, 0); return g; });
  const legL = mesh(legGeo, mats.darkSteel(), -0.15, 0.78, 0);
  const legR = mesh(legGeo, mats.darkSteel(), 0.15, 0.78, 0);
  body.add(legL, legR);
  // sword arm
  const armR = new THREE.Group(); armR.position.set(0.42, 1.28, 0); body.add(armR);
  armR.add(mesh(G('arm', () => { const g = new THREE.CapsuleGeometry(0.09, 0.32, 4, 8); g.translate(0, -0.22, 0); return g; }), mats.steel()));
  const sword = new THREE.Group(); sword.position.set(0, -0.44, 0.06); armR.add(sword);
  sword.add(mesh(G('grip', () => new THREE.CylinderGeometry(0.03, 0.03, 0.22, 8)), mats.leather(), 0, 0, 0));
  const guard = mesh(G('guard', () => new THREE.BoxGeometry(0.26, 0.05, 0.06)), mats.gold(), 0, 0.12, 0); sword.add(guard);
  const blade = mesh(G('blade', () => { const g = new THREE.BoxGeometry(0.07, 0.95, 0.02); g.translate(0, 0.62, 0); return g; }), mats.blade()); sword.add(blade);
  sword.rotation.x = Math.PI / 2;
  // shield arm
  const armL = new THREE.Group(); armL.position.set(-0.42, 1.28, 0); body.add(armL);
  armL.add(mesh(G('arm', () => { const g = new THREE.CapsuleGeometry(0.09, 0.32, 4, 8); g.translate(0, -0.22, 0); return g; }), mats.steel()));
  const shield = mesh(G('shield', () => new THREE.CylinderGeometry(0.3, 0.3, 0.06, 20)), M('shield', { color: 0x1a3a7a, metalness: 0.6, roughness: 0.4 }), -0.08, -0.3, 0.12);
  shield.rotation.z = Math.PI / 2; shield.rotation.y = Math.PI / 2;
  armL.add(shield);
  const boss = mesh(G('boss', () => new THREE.SphereGeometry(0.08, 10, 8)), mats.gold(), -0.12, -0.3, 0.12); armL.add(boss);
  root.userData = { body, legL, legR, armR, armL, cape, sword, head, blade };
  return root;
}

// --------------------------------------------------- ENEMIES
function skeleton(tint = 0xd8ccb0, eyeC = 0xff3020) {
  const root = new THREE.Group(); const body = new THREE.Group(); root.add(body);
  const bone = M('bone' + tint, { color: tint, roughness: 0.65 });
  const spine = mesh(G('spine', () => new THREE.CylinderGeometry(0.05, 0.05, 0.6, 6)), bone, 0, 1.0, 0); body.add(spine);
  for (let i = 0; i < 4; i++) {
    const rib = mesh(G('rib', () => new THREE.TorusGeometry(0.2, 0.025, 4, 12, Math.PI * 1.4)), bone, 0, 1.15 - i * 0.1, 0.02);
    rib.rotation.x = Math.PI / 2; rib.rotation.z = Math.PI * 0.8; rib.scale.setScalar(1 - i * 0.12); body.add(rib);
  }
  const pelvis = mesh(G('pelvis', () => new THREE.BoxGeometry(0.32, 0.1, 0.16)), bone, 0, 0.7, 0); body.add(pelvis);
  const head = new THREE.Group(); head.position.set(0, 1.45, 0); body.add(head);
  head.add(mesh(G('skull', () => new THREE.SphereGeometry(0.17, 12, 10)), bone));
  const jaw = mesh(G('jaw', () => new THREE.BoxGeometry(0.18, 0.06, 0.14)), bone, 0, -0.13, 0.04); head.add(jaw);
  const e1 = eye(eyeC); e1.position.set(-0.06, 0.02, 0.14); const e2 = eye(eyeC); e2.position.set(0.06, 0.02, 0.14); head.add(e1, e2);
  const limb = G('limb', () => { const g = new THREE.CylinderGeometry(0.035, 0.03, 0.55, 6); g.translate(0, -0.27, 0); return g; });
  const legL = mesh(limb, bone, -0.12, 0.68, 0), legR = mesh(limb, bone, 0.12, 0.68, 0); body.add(legL, legR);
  const armL = new THREE.Group(); armL.position.set(-0.25, 1.25, 0); armL.add(mesh(limb, bone));
  const armR = new THREE.Group(); armR.position.set(0.25, 1.25, 0); armR.add(mesh(limb, bone));
  const sword = mesh(G('rustblade', () => { const g = new THREE.BoxGeometry(0.06, 0.7, 0.02); g.translate(0, -0.85, 0.0); return g; }), mats.rust());
  armR.add(sword);
  body.add(armL, armR);
  root.userData = { body, legL, legR, armL, armR, head };
  return root;
}

function archer() {
  const r = skeleton(0xb8b0a0, 0x40ff80);
  const bow = mesh(G('bow', () => new THREE.TorusGeometry(0.35, 0.02, 4, 16, Math.PI)), mats.wood(), 0, -0.5, 0.1);
  bow.rotation.y = Math.PI / 2; r.userData.armL.add(bow);
  const hood = mesh(G('hood', () => new THREE.ConeGeometry(0.24, 0.4, 10, 1, true)), M('hoodc', { color: 0x203020, roughness: 0.9, side: THREE.DoubleSide }), 0, 0.1, -0.02);
  r.userData.head.add(hood);
  return r;
}

function spider(scale = 1) {
  const root = new THREE.Group(); const body = new THREE.Group(); root.add(body);
  const chitin = M('chitin', { color: 0x15120f, roughness: 0.35, metalness: 0.3 });
  const abd = mesh(G('abd', () => new THREE.SphereGeometry(0.42, 16, 12)), chitin, 0, 0.55, -0.35); abd.scale.set(1, 0.8, 1.2); body.add(abd);
  const mark = mesh(G('mark', () => new THREE.SphereGeometry(0.12, 8, 6)), M('spmark', { color: 0x300000, emissive: 0xff2010, emissiveIntensity: 1.2 }), 0, 0.85, -0.4); mark.scale.set(1, 0.3, 1.5); body.add(mark);
  const head = mesh(G('sphead', () => new THREE.SphereGeometry(0.25, 12, 10)), chitin, 0, 0.5, 0.2); body.add(head);
  for (let i = 0; i < 4; i++) { const e = eye(0x60ff30, 0.035); e.position.set(-0.09 + (i % 2) * 0.18, 0.58 + Math.floor(i / 2) * 0.06, 0.42); body.add(e); }
  const legs = [];
  const legGeo = G('spleg', () => { const g = new THREE.CylinderGeometry(0.03, 0.02, 0.8, 5); g.translate(0, -0.4, 0); return g; });
  for (let i = 0; i < 8; i++) {
    const side = i < 4 ? -1 : 1; const k = i % 4;
    const leg = new THREE.Group(); leg.position.set(side * 0.2, 0.55, 0.25 - k * 0.18);
    const seg = mesh(legGeo, chitin); seg.rotation.z = side * 1.9; leg.add(seg);
    const seg2 = mesh(legGeo, chitin, side * 0.72, 0.25, 0); seg2.rotation.z = side * 0.35; leg.add(seg2);
    leg.rotation.y = side * (-0.5 + k * 0.33);
    body.add(leg); legs.push(leg);
  }
  root.scale.setScalar(scale);
  root.userData = { body, legs };
  return root;
}

function slime(scale = 1) {
  const root = new THREE.Group(); const body = new THREE.Group(); root.add(body);
  const mat = M('slime', { physical: true, p: { color: 0x5ad01a, roughness: 0.05, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.05, transparent: true, opacity: 0.82, emissive: 0x2a8a00, emissiveIntensity: 0.6 } });
  const blob = mesh(G('blob', () => new THREE.SphereGeometry(0.55, 20, 14)), mat, 0, 0.5, 0); body.add(blob);
  const core = mesh(G('core', () => new THREE.IcosahedronGeometry(0.16, 0)), M('slcore', { color: 0x102000, emissive: 0xc0ff40, emissiveIntensity: 2 }), 0, 0.5, 0, false); body.add(core);
  const e1 = eye(0x000000, 0.07); e1.material = M('slEye', { color: 0x050505, roughness: 0.1 }); e1.position.set(-0.17, 0.72, 0.42);
  const e2 = e1.clone(); e2.position.x = 0.17; body.add(e1, e2);
  root.scale.setScalar(scale);
  root.userData = { body, blob, core };
  return root;
}

function imp() {
  const root = new THREE.Group(); const body = new THREE.Group(); root.add(body);
  const skin = M('impskin', { color: 0x8a1a0a, roughness: 0.55, emissive: 0x300400, emissiveIntensity: 0.6 });
  const torso = mesh(G('imptorso', () => new THREE.SphereGeometry(0.3, 14, 10)), skin, 0, 0.85, 0); torso.scale.set(1, 1.2, 0.9); body.add(torso);
  const head = new THREE.Group(); head.position.set(0, 1.35, 0.05); body.add(head);
  head.add(mesh(G('imphead', () => new THREE.SphereGeometry(0.22, 14, 10)), skin));
  const horn = G('horn', () => new THREE.ConeGeometry(0.05, 0.25, 6));
  const h1 = mesh(horn, mats.bone(), -0.13, 0.2, 0); h1.rotation.z = 0.5; const h2 = mesh(horn, mats.bone(), 0.13, 0.2, 0); h2.rotation.z = -0.5; head.add(h1, h2);
  const e1 = eye(0xffd000, 0.04); e1.position.set(-0.08, 0.03, 0.19); const e2 = eye(0xffd000, 0.04); e2.position.set(0.08, 0.03, 0.19); head.add(e1, e2);
  const wingGeo = G('wing', () => { const s = new THREE.Shape(); s.moveTo(0, 0); s.lineTo(0.7, 0.35); s.lineTo(0.55, -0.1); s.lineTo(0.35, 0.05); s.lineTo(0.2, -0.2); s.closePath(); return new THREE.ShapeGeometry(s); });
  const wmat = M('impwing', { color: 0x401008, roughness: 0.7, side: THREE.DoubleSide });
  const wL = mesh(wingGeo, wmat, -0.15, 1.0, -0.2); wL.rotation.y = Math.PI + 0.5; const wR = mesh(wingGeo, wmat, 0.15, 1.0, -0.2); wR.rotation.y = -0.5;
  body.add(wL, wR);
  const orb = mesh(G('orb', () => new THREE.SphereGeometry(0.12, 12, 8)), M('fireorb', { color: 0x000000, emissive: 0xff6010, emissiveIntensity: 5 }), 0.32, 0.9, 0.25, false);
  body.add(orb);
  const legGeo = G('impleg', () => { const g = new THREE.CylinderGeometry(0.06, 0.04, 0.5, 6); g.translate(0, -0.25, 0); return g; });
  const legL = mesh(legGeo, skin, -0.12, 0.6, 0), legR = mesh(legGeo, skin, 0.12, 0.6, 0); body.add(legL, legR);
  root.userData = { body, legL, legR, wL, wR, orb, head };
  return root;
}

function golem(kind = 'lava') {
  const root = new THREE.Group(); const body = new THREE.Group(); root.add(body);
  const rock = kind === 'ice'
    ? M('golemIce', { physical: true, p: { color: 0x9ad0f0, roughness: 0.15, metalness: 0.1, clearcoat: 1, emissive: 0x103050, emissiveIntensity: 0.5 } })
    : kind === 'void' ? M('golemVoid', { color: 0x221a30, roughness: 0.4, metalness: 0.5 })
      : M('golemRock', { color: 0x3a302a, roughness: 0.95, flatShading: true });
  const glowC = kind === 'ice' ? 0x60d0ff : kind === 'void' ? 0xb050ff : 0xff5010;
  const glow = M('golemGlow' + kind, { color: 0x000000, emissive: glowC, emissiveIntensity: 3 });
  const chunk = G('chunk', () => new THREE.DodecahedronGeometry(0.5, 0));
  const torso = mesh(chunk, rock, 0, 1.25, 0); torso.scale.set(1.3, 1.1, 1); body.add(torso);
  const core = mesh(G('gcore', () => new THREE.OctahedronGeometry(0.2, 0)), glow, 0, 1.3, 0.42, false); body.add(core);
  const head = mesh(chunk, rock, 0, 1.95, 0.1); head.scale.setScalar(0.5); body.add(head);
  const e1 = eye(glowC, 0.05); e1.position.set(-0.1, 1.98, 0.32); const e2 = eye(glowC, 0.05); e2.position.set(0.1, 1.98, 0.32); body.add(e1, e2);
  const armL = new THREE.Group(); armL.position.set(-0.75, 1.5, 0);
  const armR = new THREE.Group(); armR.position.set(0.75, 1.5, 0);
  [armL, armR].forEach((a) => {
    const u = mesh(chunk, rock, 0, -0.35, 0); u.scale.set(0.5, 0.8, 0.5); a.add(u);
    const f = mesh(chunk, rock, 0, -0.9, 0.05); f.scale.set(0.65, 0.65, 0.65); a.add(f);
    body.add(a);
  });
  const legL = mesh(chunk, rock, -0.35, 0.4, 0), legR = mesh(chunk, rock, 0.35, 0.4, 0);
  legL.scale.set(0.5, 0.8, 0.5); legR.scale.set(0.5, 0.8, 0.5); body.add(legL, legR);
  root.userData = { body, legL, legR, armL, armR, core };
  return root;
}

function wraith(color = 0x60d0ff) {
  const root = new THREE.Group(); const body = new THREE.Group(); root.add(body);
  const cloak = mesh(G('cloak', () => new THREE.ConeGeometry(0.5, 1.6, 16, 4, true)), M('cloak' + color, { color: 0x101820, roughness: 0.9, transparent: true, opacity: 0.85, side: THREE.DoubleSide, emissive: color, emissiveIntensity: 0.08 }), 0, 1.2, 0);
  body.add(cloak);
  const hood = mesh(G('whood', () => new THREE.SphereGeometry(0.28, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.65)), cloak.material, 0, 1.95, 0); body.add(hood);
  const face = mesh(G('wface', () => new THREE.SphereGeometry(0.2, 10, 8)), M('wface', { color: 0x000000, roughness: 1 }), 0, 1.88, 0.06); body.add(face);
  const e1 = eye(color, 0.045); e1.position.set(-0.08, 1.9, 0.24); const e2 = eye(color, 0.045); e2.position.set(0.08, 1.9, 0.24); body.add(e1, e2);
  const handGeo = G('whand', () => { const g = new THREE.ConeGeometry(0.08, 0.6, 6); g.rotateX(Math.PI / 2); return g; });
  const hL = mesh(handGeo, cloak.material, -0.45, 1.4, 0.2); const hR = mesh(handGeo, cloak.material, 0.45, 1.4, 0.2); body.add(hL, hR);
  const orb = mesh(G('orb', () => new THREE.SphereGeometry(0.12, 12, 8)), M('wo' + color, { color: 0x000000, emissive: color, emissiveIntensity: 4 }), 0.5, 1.4, 0.5, false); body.add(orb);
  root.userData = { body, hL, hR, orb, float: true };
  return root;
}

function voideye() {
  const root = new THREE.Group(); const body = new THREE.Group(); root.add(body);
  const flesh = M('vflesh', { physical: true, p: { color: 0x3a1a40, roughness: 0.3, clearcoat: 0.8, metalness: 0 } });
  const ball = mesh(G('vball', () => new THREE.SphereGeometry(0.55, 24, 16)), M('vwhite', { physical: true, p: { color: 0xd8d0c8, roughness: 0.15, clearcoat: 1 } }), 0, 1.4, 0);
  body.add(ball);
  const lid = mesh(G('vlid', () => new THREE.SphereGeometry(0.6, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.4)), flesh, 0, 1.4, 0); lid.rotation.x = -0.4; body.add(lid);
  const iris = mesh(G('viris', () => new THREE.SphereGeometry(0.22, 16, 10)), M('viris', { color: 0x000000, emissive: 0xb040ff, emissiveIntensity: 3 }), 0, 1.4, 0.4, false); iris.scale.set(1, 1, 0.4); body.add(iris);
  const pupil = mesh(G('vpupil', () => new THREE.SphereGeometry(0.1, 10, 8)), M('vpupil', { color: 0x000000, roughness: 0 }), 0, 1.4, 0.49, false); pupil.scale.set(0.6, 1.2, 0.3); body.add(pupil);
  const tents = [];
  const tg = G('tent', () => { const g = new THREE.ConeGeometry(0.07, 0.9, 6); g.translate(0, -0.45, 0); return g; });
  for (let i = 0; i < 6; i++) {
    const t = new THREE.Group(); const a = (i / 6) * Math.PI * 2; t.position.set(Math.cos(a) * 0.3, 1.0, Math.sin(a) * 0.3);
    t.add(mesh(tg, flesh)); body.add(t); tents.push(t);
  }
  root.userData = { body, tents, iris, float: true };
  return root;
}

const FACT = {
  skeleton: () => skeleton(),
  archer: () => archer(),
  spider: () => spider(0.9),
  slime: () => slime(1),
  slimeSmall: () => slime(0.55),
  imp: () => imp(),
  golem: (biome) => golem(biome === 'ice' ? 'ice' : biome === 'void' ? 'void' : 'lava'),
  wraith: (biome) => wraith(biome === 'void' ? 0xc060ff : 0x60d0ff),
  voideye: () => voideye(),
  // bosses
  lich: () => { const r = skeleton(0xe8e0c8, 0x40a0ff); const crown = mesh(G('crown', () => new THREE.CylinderGeometry(0.2, 0.17, 0.14, 8, 1, true)), mats.gold(), 0, 0.17, 0); r.userData.head.add(crown); const robe = mesh(G('robe', () => new THREE.ConeGeometry(0.5, 1.1, 12, 1, true)), M('robe', { color: 0x201040, roughness: 0.85, side: THREE.DoubleSide }), 0, 0.6, 0); r.userData.body.add(robe); return r; },
  magma: () => golem('lava'),
  frostqueen: () => wraith(0x80e0ff),
  broodmother: () => spider(1),
  overseer: () => voideye(),
};

export function makeEnemyModel(type, biome) {
  const f = FACT[type] || FACT.skeleton;
  return f(biome);
}

// --------------------------------------------------- PROPS
export function makeProp(kind, rand) {
  const g = new THREE.Group();
  const r = rand || Math.random;
  switch (kind) {
    case 'pillar': {
      g.add(mesh(G('pillarBase', () => new THREE.BoxGeometry(0.9, 0.3, 0.9)), mats.stone(), 0, 0.15, 0));
      g.add(mesh(G('pillar', () => new THREE.CylinderGeometry(0.32, 0.36, 2.6, 12)), mats.stone(), 0, 1.6, 0));
      g.add(mesh(G('pillarTop', () => new THREE.BoxGeometry(0.9, 0.25, 0.9)), mats.stone(), 0, 3.0, 0));
      g.userData.solid = 0.5; break;
    }
    case 'coffin': {
      const c = mesh(G('coffin', () => new THREE.BoxGeometry(0.8, 0.5, 1.8)), mats.wood(), 0, 0.25, 0);
      g.add(c); g.add(mesh(G('coffinLid', () => new THREE.BoxGeometry(0.85, 0.08, 1.85)), M('coffinLid', { color: 0x3a2618, roughness: 0.7 }), 0, 0.54, 0));
      g.rotation.y = r() * Math.PI; g.userData.solid = 0.6; break;
    }
    case 'urn': {
      const pts = []; for (let i = 0; i <= 10; i++) { const t = i / 10; pts.push(new THREE.Vector2(0.12 + Math.sin(t * Math.PI) * 0.22 + (t > 0.85 ? 0.05 : 0), t * 0.8)); }
      g.add(mesh(G('urn', () => new THREE.LatheGeometry(pts, 14)), M('urnMat', { color: 0x7a5030, roughness: 0.5, metalness: 0.1 })));
      g.userData.solid = 0.35; break;
    }
    case 'bones': {
      for (let i = 0; i < 5; i++) { const b = mesh(G('bonebit', () => new THREE.CylinderGeometry(0.03, 0.03, 0.4, 5)), mats.bone(), (r() - 0.5) * 0.8, 0.03, (r() - 0.5) * 0.8, false); b.rotation.set(Math.PI / 2, 0, r() * 3); g.add(b); }
      const sk = mesh(G('skull', () => new THREE.SphereGeometry(0.17, 12, 10)), mats.bone(), 0, 0.12, 0); sk.scale.setScalar(0.7); g.add(sk); break;
    }
    case 'rock': {
      const m = mesh(G('rock', () => new THREE.DodecahedronGeometry(0.5, 0)), M('rockMat', { color: 0x4a4440, roughness: 0.95, flatShading: true }), 0, 0.3, 0);
      m.scale.set(0.8 + r() * 0.8, 0.5 + r() * 0.6, 0.8 + r() * 0.8); m.rotation.y = r() * 3; g.add(m); g.userData.solid = 0.55; break;
    }
    case 'crystal': case 'crystalRed': case 'crystalPurple': {
      const col = kind === 'crystalRed' ? 0xff4020 : kind === 'crystalPurple' ? 0xb050ff : 0x60d0ff;
      const mat = M('crys' + kind, { physical: true, p: { color: col, roughness: 0.05, metalness: 0.1, clearcoat: 1, emissive: col, emissiveIntensity: 0.9, transparent: true, opacity: 0.9 } });
      for (let i = 0; i < 4; i++) {
        const c = mesh(G('crys', () => new THREE.OctahedronGeometry(0.3, 0)), mat, (r() - 0.5) * 0.6, 0.4, (r() - 0.5) * 0.6);
        c.scale.set(0.6, 1.5 + r() * 1.5, 0.6); c.rotation.set((r() - 0.5) * 0.6, r() * 3, (r() - 0.5) * 0.6); g.add(c);
      }
      g.userData.glow = col; g.userData.solid = 0.5; break;
    }
    case 'icePillar': {
      const mat = M('icep', { physical: true, p: { color: 0xb0e0ff, roughness: 0.05, clearcoat: 1, transparent: true, opacity: 0.75, emissive: 0x2060a0, emissiveIntensity: 0.4 } });
      g.add(mesh(G('icep', () => new THREE.CylinderGeometry(0.25, 0.5, 2.8, 7)), mat, 0, 1.4, 0)); g.userData.solid = 0.5; break;
    }
    case 'brazier': {
      g.add(mesh(G('brz', () => new THREE.CylinderGeometry(0.4, 0.2, 0.4, 12)), mats.darkSteel(), 0, 0.9, 0));
      g.add(mesh(G('brzLeg', () => new THREE.CylinderGeometry(0.06, 0.1, 0.8, 6)), mats.darkSteel(), 0, 0.4, 0));
      g.add(mesh(G('coals', () => new THREE.SphereGeometry(0.3, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2)), M('coals', { color: 0x200000, emissive: 0xff4000, emissiveIntensity: 3 }), 0, 1.0, 0, false));
      g.userData.fire = 1.3; g.userData.glow = 0xff6a20; g.userData.solid = 0.45; break;
    }
    case 'mushroom': {
      const n = 1 + Math.floor(r() * 3);
      for (let i = 0; i < n; i++) {
        const s = 0.6 + r() * 0.9;
        const st = mesh(G('mstem', () => new THREE.CylinderGeometry(0.08, 0.12, 0.8, 8)), M('mstem', { color: 0xd8d0b0, roughness: 0.8 }), (r() - 0.5) * 0.8, 0.4 * s, (r() - 0.5) * 0.8);
        st.scale.setScalar(s); g.add(st);
        const cap = mesh(G('mcap', () => new THREE.SphereGeometry(0.38, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2)), M('mcap', { color: 0x40a0a0, roughness: 0.4, emissive: 0x20ffc0, emissiveIntensity: 0.8 }), st.position.x, 0.78 * s, st.position.z);
        cap.scale.setScalar(s); g.add(cap);
      }
      g.userData.glow = 0x40ffc0; g.userData.solid = 0.4; break;
    }
    case 'stump': {
      g.add(mesh(G('stump', () => new THREE.CylinderGeometry(0.4, 0.55, 0.6, 10)), mats.wood(), 0, 0.3, 0)); g.userData.solid = 0.5; break;
    }
    case 'obelisk': {
      g.add(mesh(G('obel', () => new THREE.CylinderGeometry(0.15, 0.45, 3.2, 4)), M('obsid', { color: 0x0a0810, roughness: 0.15, metalness: 0.6 }), 0, 1.6, 0));
      const rune = mesh(G('rune', () => new THREE.BoxGeometry(0.08, 1.4, 0.02)), M('rune', { color: 0x000000, emissive: 0xb050ff, emissiveIntensity: 3 }), 0, 1.6, 0.3, false);
      rune.rotation.y = Math.PI / 4; g.add(rune);
      g.rotation.y = Math.PI / 4; g.userData.glow = 0xb050ff; g.userData.solid = 0.5; break;
    }
  }
  return g;
}

export function makeTorch() {
  const g = new THREE.Group();
  const holder = mesh(G('tholder', () => new THREE.BoxGeometry(0.12, 0.12, 0.45)), mats.darkSteel(), 0, 0, 0.2); g.add(holder);
  const stick = mesh(G('tstick', () => new THREE.CylinderGeometry(0.05, 0.04, 0.5, 6)), mats.wood(), 0, 0.15, 0.42); stick.rotation.x = -0.3; g.add(stick);
  return g;
}

export function makeChest() {
  const g = new THREE.Group();
  const base = mesh(G('chestBase', () => new THREE.BoxGeometry(1.0, 0.55, 0.65)), mats.wood(), 0, 0.28, 0); g.add(base);
  const lid = new THREE.Group(); lid.position.set(0, 0.55, -0.32); g.add(lid);
  const lidMesh = mesh(G('chestLid', () => { const geo = new THREE.CylinderGeometry(0.33, 0.33, 1.0, 12, 1, false, 0, Math.PI); geo.rotateZ(Math.PI / 2); geo.translate(0, 0, 0.32); return geo; }), mats.wood()); lid.add(lidMesh);
  const band = mesh(G('chestBand', () => new THREE.BoxGeometry(1.04, 0.08, 0.69)), mats.gold(), 0, 0.5, 0); g.add(band);
  const lock = mesh(G('chestLock', () => new THREE.BoxGeometry(0.14, 0.18, 0.06)), mats.gold(), 0, 0.5, 0.34); g.add(lock);
  const glow = mesh(G('chestGlow', () => new THREE.SphereGeometry(0.3, 10, 8)), M('chestGlow', { color: 0x000000, emissive: 0xffc040, emissiveIntensity: 4, transparent: true, opacity: 0 }), 0, 0.6, 0, false);
  g.add(glow);
  g.userData = { lid, glow };
  return g;
}

export function makePortal(color) {
  const g = new THREE.Group();
  const ringMat = M('portalRing', { color: 0x202020, metalness: 0.8, roughness: 0.3 });
  const base = mesh(G('portalBase', () => new THREE.CylinderGeometry(1.6, 1.8, 0.25, 32)), ringMat, 0, 0.12, 0); base.receiveShadow = true; g.add(base);
  const runeRing = mesh(G('portalRune', () => new THREE.TorusGeometry(1.35, 0.06, 6, 48)), M('portalRuneMat' + color, { color: 0x000000, emissive: color, emissiveIntensity: 4 }), 0, 0.27, 0, false);
  runeRing.rotation.x = Math.PI / 2; g.add(runeRing);
  const vortexMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(color) }, uOpen: { value: 1 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);} ',
    fragmentShader: `varying vec2 vUv; uniform float uTime; uniform vec3 uColor; uniform float uOpen;
      void main(){ vec2 p=vUv-0.5; float r=length(p)*2.0; float a=atan(p.y,p.x);
        float s=sin(a*5.0 + r*12.0 - uTime*4.0)*0.5+0.5; float core=smoothstep(1.0,0.0,r);
        float v=core*(0.35+0.65*s)*smoothstep(1.0,0.85,r);
        gl_FragColor=vec4(uColor*v*3.0*uOpen + vec3(1.0)*pow(core,6.0)*uOpen, v*uOpen); }`,
  });
  const vortex = new THREE.Mesh(G('portalDisc', () => new THREE.CircleGeometry(1.3, 48)), vortexMat);
  vortex.rotation.x = -Math.PI / 2; vortex.position.y = 0.28; g.add(vortex);
  g.userData = { vortex, runeRing };
  return g;
}

export function makePickup(kind) {
  const g = new THREE.Group();
  if (kind === 'gold') {
    for (let i = 0; i < 3; i++) {
      const c = mesh(G('coin', () => new THREE.CylinderGeometry(0.14, 0.14, 0.04, 14)), mats.gold(), (i - 1) * 0.12, 0.05 + i * 0.05, 0, false);
      c.rotation.x = 0.3 * i; g.add(c);
    }
  } else if (kind === 'potion') {
    const pts = []; for (let i = 0; i <= 8; i++) { const t = i / 8; pts.push(new THREE.Vector2(t < 0.7 ? 0.05 + Math.sin(t / 0.7 * Math.PI) * 0.18 : 0.06, t * 0.5)); }
    g.add(mesh(G('flask', () => new THREE.LatheGeometry(pts, 12)), M('flaskMat', { physical: true, p: { color: 0xff2040, roughness: 0.05, clearcoat: 1, emissive: 0xff1030, emissiveIntensity: 0.9, transparent: true, opacity: 0.9 } }), 0, 0.1, 0, false));
    g.add(mesh(G('cork', () => new THREE.CylinderGeometry(0.05, 0.05, 0.08, 6)), mats.wood(), 0, 0.64, 0, false));
  }
  return g;
}
