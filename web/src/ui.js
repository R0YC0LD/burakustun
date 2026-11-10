// DOM user interface: menus, HUD, touch controls, overlays.
import * as THREE from 'three';
import { settings, saveSettings, meta } from './settings.js';
import { sfx, applyVolumes } from './audio.js';
import { TILE, FLOOR, LIQUID } from './dungeon.js';
import { mountIcons, perkIcon, icon } from './icons.js';

const $ = (id) => document.getElementById(id);
const tmp = new THREE.Vector3();

export const input = { mx: 0, my: 0, attack: false, dash: false, nova: false, potion: false };

const BTN_IDS = ['bAttack', 'bDash', 'bNova', 'bPotion'];
const BASE = { bAttack: 78, bDash: 54, bNova: 54, bPotion: 46 };
const NAMES = { bAttack: 'Saldırı', bDash: 'Atılma', bNova: 'Nova', bPotion: 'İksir', stick: 'Joystick' };
const FALLBACK = { bAttack: { x: 0.92, y: 0.82 }, bDash: { x: 0.81, y: 0.86 }, bNova: { x: 0.92, y: 0.6 }, bPotion: { x: 0.82, y: 0.68 } };

export class UI {
  constructor() {
    mountIcons();
    this.dmgPool = [];
    this.dmgLayer = $('dmg');
    for (let i = 0; i < 40; i++) {
      const d = document.createElement('div'); d.className = 'dn'; d.style.display = 'none';
      this.dmgLayer.appendChild(d); this.dmgPool.push({ el: d, t: 0, active: false });
    }
    this.mm = $('minimap'); this.mmx = this.mm.getContext('2d');
    this.mmTimer = 0;
    this.setupTouch();
    this.setupKeys();
    this.setupButtons();
    this.refreshSettings();
  }

  show(id) {
    ['menu', 'settings', 'howto', 'hud', 'pause', 'perks', 'over', 'victory'].forEach((s) => $(s).classList.toggle('hidden', s !== id && !(id === 'hud+' && s === 'hud')));
  }
  overlay(id, on) { $(id).classList.toggle('hidden', !on); }

  setupButtons() {
    const bind = (id, fn) => $(id).addEventListener('click', (e) => { e.preventDefault(); sfx('click'); fn(); });
    bind('btnPlay', () => this.onPlay());
    bind('btnSettings', () => { this.settingsFrom = 'menu'; this.show('settings'); });
    bind('btnHow', () => this.show('howto'));
    bind('btnHowBack', () => this.show('menu'));
    bind('btnSetBack', () => { this.show(this.settingsFrom === 'pause' ? 'pause' : 'menu'); if (this.settingsFrom === 'pause') $('hud').classList.remove('hidden'); });
    bind('btnPause', () => this.onPause());
    bind('btnResume', () => this.onResume());
    bind('btnPauseSettings', () => { this.settingsFrom = 'pause'; this.show('settings'); });
    bind('btnQuit', () => this.onQuit());
    bind('btnRetry', () => this.onPlay());
    bind('btnOverMenu', () => this.onQuit());
    bind('btnVicMenu', () => this.onQuit());
    bind('btnEndless', () => this.onEndless());
    document.querySelectorAll('[data-q]').forEach((b) => b.addEventListener('click', () => {
      sfx('click'); settings.quality = b.dataset.q; saveSettings(); this.refreshSettings(); this.onQuality();
    }));
    $('volMusic').addEventListener('input', (e) => { settings.music = +e.target.value; saveSettings(); applyVolumes(); });
    $('volSfx').addEventListener('input', (e) => { settings.sfx = +e.target.value; saveSettings(); applyVolumes(); });
    $('chkShake').addEventListener('change', (e) => { settings.shake = e.target.checked; saveSettings(); });
    document.querySelectorAll('[data-d]').forEach((b) => b.addEventListener('click', () => { sfx('click'); settings.difficulty = b.dataset.d; saveSettings(); this.refreshSettings(); }));
    const tog = (id, key, after) => $(id).addEventListener('change', (e) => { settings[key] = e.target.checked; saveSettings(); if (after) after(); });
    tog('chkAuto', 'autoAttack'); tog('chkPotion', 'autoPotion'); tog('chkStick', 'fixedStick', () => this.applyLayout());
    $('rngBtn').addEventListener('input', (e) => { settings.btnScale = +e.target.value; saveSettings(); this.applyLayout(); });
    $('rngOpa').addEventListener('input', (e) => { settings.btnOpacity = +e.target.value; saveSettings(); this.applyLayout(); });
    bind('btnLayout', () => this.openEditor());
    bind('edDone', () => this.closeEditor());
    bind('edReset', () => { settings.layout = null; settings.stickPos = null; settings.btnScale = 1; saveSettings(); this.applyLayout(); this.selectEd(null); this.refreshSettings(); });
    $('edSize').addEventListener('input', (e) => {
      if (!this.edSel) return;
      if (this.edSel.id === 'stick') return;
      this.ensureLayout(); settings.layout[this.edSel.id].s = +e.target.value; saveSettings(); this.applyLayout();
    });
    this.setupEditorDrag();
    window.addEventListener('resize', () => this.applyLayout());
    this.applyLayout();
    $('chkFps').addEventListener('change', (e) => { settings.fps = e.target.checked; saveSettings(); $('fps').classList.toggle('hidden', !settings.fps); });
  }

  refreshSettings() {
    document.querySelectorAll('[data-q]').forEach((b) => b.classList.toggle('on', b.dataset.q === settings.quality));
    $('volMusic').value = settings.music; $('volSfx').value = settings.sfx;
    $('chkShake').checked = settings.shake; $('chkFps').checked = settings.fps;
    document.querySelectorAll('[data-d]').forEach((b) => b.classList.toggle('on', b.dataset.d === settings.difficulty));
    $('chkAuto').checked = settings.autoAttack; $('chkPotion').checked = settings.autoPotion; $('chkStick').checked = settings.fixedStick;
    $('rngBtn').value = settings.btnScale; $('rngOpa').value = settings.btnOpacity;
    $('fps').classList.toggle('hidden', !settings.fps);
    $('menuStats').innerHTML = meta.runs
      ? `En derin kat: <b>${meta.bestFloor}</b> · En yüksek skor: <b>${meta.bestScore}</b> · Zafer: <b>${meta.wins}</b>`
      : 'Derinlikler seni bekliyor, gezgin.';
  }

  // ---- adjustable controls -------------------------------------------------
  stickCenter() {
    const sp = settings.stickPos || { x: 0.14, y: 0.72 };
    return { x: sp.x * window.innerWidth, y: sp.y * window.innerHeight };
  }

  // Snapshot where the buttons currently sit so they can be moved individually from there.
  ensureLayout() {
    if (settings.layout) return;
    const L = {};
    for (const id of BTN_IDS) {
      const r = $(id).getBoundingClientRect();
      const visible = r.width > 0;
      L[id] = visible
        ? { x: (r.left + r.width / 2) / window.innerWidth, y: (r.top + r.height / 2) / window.innerHeight, s: settings.btnScale }
        : { ...FALLBACK[id], s: settings.btnScale };
    }
    settings.layout = L;
  }

  applyLayout() {
    const root = document.documentElement.style;
    root.setProperty('--btnScale', settings.btnScale);
    root.setProperty('--btnOpacity', settings.btnOpacity);
    const custom = !!settings.layout;
    document.querySelector('.actions').classList.toggle('customized', custom);
    for (const id of BTN_IDS) {
      const el = $(id);
      el.classList.toggle('custom', custom);
      if (custom) {
        const c = settings.layout[id] || { ...FALLBACK[id], s: 1 };
        const size = el.offsetWidth || BASE[id];
        el.style.left = (c.x * window.innerWidth - size / 2) + 'px';
        el.style.top = (c.y * window.innerHeight - size / 2) + 'px';
        el.style.scale = c.s;
      } else { el.style.left = el.style.top = ''; el.style.scale = ''; }
    }
    const st = $('stick');
    st.classList.toggle('fixed', settings.fixedStick);
    if (settings.fixedStick || this.editing) { const c = this.stickCenter(); st.style.left = c.x + 'px'; st.style.top = c.y + 'px'; }
  }

  openEditor() {
    this.editorFrom = this.settingsFrom;
    this.hudWasHidden = $('hud').classList.contains('hidden');
    $('settings').classList.add('hidden'); $('menu').classList.add('hidden'); $('pause').classList.add('hidden');
    $('hud').classList.remove('hidden');
    this.editing = true; document.body.classList.add('editing');
    $('editor').classList.remove('hidden');
    this.ensureLayout(); saveSettings();
    this.applyLayout(); this.selectEd(null);
  }

  closeEditor() {
    this.editing = false; document.body.classList.remove('editing');
    $('editor').classList.add('hidden');
    this.selectEd(null);
    saveSettings(); this.applyLayout();
    if (this.hudWasHidden) $('hud').classList.add('hidden');
    $('settings').classList.remove('hidden');
    this.refreshSettings();
  }

  selectEd(el) {
    document.querySelectorAll('.sel').forEach((n) => n.classList.remove('sel'));
    this.edSel = el;
    const size = $('edSize');
    if (!el) { $('edSel').textContent = 'Bir tuşa dokun'; size.disabled = true; return; }
    el.classList.add('sel');
    $('edSel').textContent = NAMES[el.id] + (el.id === 'stick' ? ' (konum)' : ' boyutu');
    size.disabled = el.id === 'stick';
    if (el.id !== 'stick') size.value = settings.layout[el.id].s;
  }

  setupEditorDrag() {
    const clamp = (v) => Math.max(0.04, Math.min(0.96, v));
    [...BTN_IDS, 'stick'].forEach((id) => {
      const el = $(id);
      let drag = false;
      el.addEventListener('pointerdown', (e) => {
        if (!this.editing) return;
        e.preventDefault(); e.stopPropagation();
        drag = true; el.setPointerCapture(e.pointerId); this.selectEd(el);
      });
      el.addEventListener('pointermove', (e) => {
        if (!this.editing || !drag) return;
        const x = clamp(e.clientX / window.innerWidth), y = clamp(e.clientY / window.innerHeight);
        if (id === 'stick') { settings.stickPos = { x, y }; settings.fixedStick = true; }
        else { settings.layout[id].x = x; settings.layout[id].y = y; }
        this.applyLayout();
      });
      const up = () => { if (drag) { drag = false; saveSettings(); } };
      el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    });
  }

  setupTouch() {
    const zone = $('stickZone'), base = $('stick'), knob = $('knob');
    let id = null, ox = 0, oy = 0;
    const R = 60;
    const start = (t) => {
      if (this.editing) return;
      id = t.identifier; ox = t.clientX; oy = t.clientY;
      if (settings.fixedStick) { const c = this.stickCenter(); ox = c.x; oy = c.y; }
      base.style.left = ox + 'px'; base.style.top = oy + 'px'; base.classList.add('active');
      knob.style.transform = 'translate(-50%,-50%)';
    };
    const moveT = (t) => {
      if (id === null) return;
      let dx = t.clientX - ox, dy = t.clientY - oy;
      const l = Math.hypot(dx, dy);
      if (l > R) { dx = dx / l * R; dy = dy / l * R; }
      knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
      const m = Math.min(1, l / R);
      const dz = 0.15;
      const k = m < dz ? 0 : (m - dz) / (1 - dz) / (m || 1);
      input.mx = dx / R * k * (l > R ? 1 : 1); input.my = dy / R * k;
      const ml = Math.hypot(input.mx, input.my); if (ml > 1) { input.mx /= ml; input.my /= ml; }
    };
    const end = () => { id = null; input.mx = 0; input.my = 0; base.classList.remove('active'); knob.style.transform = 'translate(-50%,-50%)'; };
    this.stickStart = (t) => { start(t); if (id !== null) moveT(t); };
    zone.addEventListener('touchstart', (e) => { e.preventDefault(); if (id === null) { start(e.changedTouches[0]); if (settings.fixedStick && id !== null) moveT(e.changedTouches[0]); } }, { passive: false });
    zone.addEventListener('touchmove', (e) => { e.preventDefault(); for (const t of e.changedTouches) if (t.identifier === id) moveT(t); }, { passive: false });
    zone.addEventListener('touchend', (e) => { for (const t of e.changedTouches) if (t.identifier === id) end(); });
    zone.addEventListener('touchcancel', end);
    // mouse fallback for the stick
    let md = false;
    zone.addEventListener('mousedown', (e) => { md = true; start({ identifier: 'm', clientX: e.clientX, clientY: e.clientY }); });
    window.addEventListener('mousemove', (e) => { if (md) moveT({ clientX: e.clientX, clientY: e.clientY }); });
    window.addEventListener('mouseup', () => { if (md) { md = false; end(); } });

    const hold = (elId, key) => {
      const el = $(elId);
      const on = (e) => { if (this.editing) return; e.preventDefault(); input[key] = true; el.classList.add('press'); if (navigator.vibrate && key === 'attack') navigator.vibrate(8); };
      const off = (e) => { e.preventDefault(); input[key] = false; el.classList.remove('press'); };
      el.addEventListener('touchstart', on, { passive: false }); el.addEventListener('touchend', off, { passive: false }); el.addEventListener('touchcancel', off);
      el.addEventListener('mousedown', on); el.addEventListener('mouseup', off); el.addEventListener('mouseleave', off);
    };
    const tap = (elId, key) => {
      const el = $(elId);
      const on = (e) => { if (this.editing) return; e.preventDefault(); input[key] = true; el.classList.add('press'); setTimeout(() => el.classList.remove('press'), 120); if (navigator.vibrate) navigator.vibrate(12); };
      el.addEventListener('touchstart', on, { passive: false }); el.addEventListener('mousedown', on);
    };
    hold('bAttack', 'attack'); tap('bDash', 'dash'); tap('bNova', 'nova'); tap('bPotion', 'potion');
  }

  setupKeys() {
    const keys = {};
    const upd = () => {
      input.mx = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
      input.my = (keys.KeyS || keys.ArrowDown ? 1 : 0) - (keys.KeyW || keys.ArrowUp ? 1 : 0);
      const l = Math.hypot(input.mx, input.my); if (l > 1) { input.mx /= l; input.my /= l; }
    };
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      keys[e.code] = true;
      if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) upd();
      if (e.code === 'KeyJ' || e.code === 'Space') input.attack = true;
      if (e.code === 'KeyK' || e.code === 'ShiftLeft') input.dash = true;
      if (e.code === 'KeyL' || e.code === 'KeyE') input.nova = true;
      if (e.code === 'KeyQ' || e.code === 'KeyH') input.potion = true;
      if (e.code === 'Escape' || e.code === 'KeyP') this.onBack && this.onBack();
    });
    window.addEventListener('keyup', (e) => {
      keys[e.code] = false; upd();
      if (e.code === 'KeyJ' || e.code === 'Space') input.attack = false;
    });
  }

  hud(p, game) {
    $('hpFill').style.width = (p.hp / p.maxHp * 100).toFixed(1) + '%';
    $('hpText').textContent = `${Math.ceil(p.hp)} / ${Math.round(p.maxHp)}`;
    $('xpFill').style.width = (p.xp / p.xpNext * 100).toFixed(1) + '%';
    $('lvl').textContent = p.level;
    $('gold').textContent = p.gold;
    $('floorLbl').textContent = `Kat ${game.floor} · ${game.biome.name}`;
    $('potCount').textContent = p.potions;
    const cd = (el, t, max) => { const k = Math.max(0, t / max); $(el).style.setProperty('--cd', (k * 100).toFixed(0) + '%'); $(el).classList.toggle('cool', k > 0); };
    cd('bDash', p.tDash, p.dashCd); cd('bNova', p.tNova, p.novaCd);
    $('bPotion').classList.toggle('cool', p.potions <= 0);
    $('hpBar').classList.toggle('low', p.hp / p.maxHp < 0.3);
    this.mmTimer -= 1;
    if (this.mmTimer <= 0) { this.mmTimer = 6; this.drawMinimap(game); }
    this.tickDmg();
  }

  drawMinimap(game) {
    const d = game.dungeon, c = this.mmx, W = this.mm.width, H = this.mm.height;
    const s = Math.min(W / d.w, H / d.h);
    c.clearRect(0, 0, W, H);
    c.save();
    // rotate 45° to match isometric view
    c.translate(W / 2, H / 2); c.rotate(Math.PI / 4 + Math.PI / 2); c.scale(0.72, 0.72); c.translate(-d.w * s / 2, -d.h * s / 2);
    for (let y = 0; y < d.h; y++) for (let x = 0; x < d.w; x++) {
      if (!d.explored[y * d.w + x]) continue;
      const v = d.grid[y * d.w + x];
      if (v === FLOOR) c.fillStyle = 'rgba(200,190,170,0.55)';
      else if (v === LIQUID) c.fillStyle = 'rgba(80,160,255,0.5)';
      else c.fillStyle = 'rgba(40,36,30,0.9)';
      c.fillRect(x * s, y * s, s + 0.5, s + 0.5);
    }
    const ex = d.exit;
    if (d.explored[ex.cy * d.w + ex.cx]) { c.fillStyle = game.portalOpen ? '#b070ff' : '#704090'; c.beginPath(); c.arc((ex.cx + 0.5) * s, (ex.cy + 0.5) * s, s * 1.6, 0, 7); c.fill(); }
    c.fillStyle = '#ff4040';
    for (const e of game.enemies) {
      const cx = Math.floor(e.x / TILE), cy = Math.floor(e.z / TILE);
      if (e.aggro || d.explored[cy * d.w + cx]) { if (Math.hypot(e.x - game.player.x, e.z - game.player.z) < 20) c.fillRect(e.x / TILE * s - 1.5, e.z / TILE * s - 1.5, e.boss ? 6 : 3, e.boss ? 6 : 3); }
    }
    c.fillStyle = '#ffe080';
    for (const ch of game.chests) if (!ch.open && d.explored[Math.floor(ch.z / TILE) * d.w + Math.floor(ch.x / TILE)]) c.fillRect(ch.x / TILE * s - 2, ch.z / TILE * s - 2, 4, 4);
    c.fillStyle = '#7ad0ff'; c.beginPath(); c.arc(game.player.x / TILE * s, game.player.z / TILE * s, 3, 0, 7); c.fill();
    c.restore();
  }

  damageNumber(x, y, z, n, kind, camera) {
    const slot = this.dmgPool.find((d) => !d.active);
    if (!slot) return;
    slot.active = true; slot.t = 0; slot.pos = [x + (Math.random() - 0.5) * 0.6, y, z]; slot.camera = camera;
    slot.el.textContent = kind === 'crit' ? n + '!' : n;
    slot.el.className = 'dn ' + kind;
    slot.el.style.display = 'block';
    this.placeDmg(slot);
  }
  placeDmg(slot) {
    tmp.set(slot.pos[0], slot.pos[1] + slot.t * 1.5, slot.pos[2]).project(slot.camera);
    const x = (tmp.x * 0.5 + 0.5) * window.innerWidth, y = (-tmp.y * 0.5 + 0.5) * window.innerHeight;
    slot.el.style.transform = `translate(${x}px, ${y}px) translate(-50%,-50%) scale(${1 + Math.max(0, 0.3 - slot.t) * 2})`;
    slot.el.style.opacity = Math.min(1, (0.9 - slot.t) * 3);
  }
  tickDmg() {
    const now = performance.now();
    const dt = this.lastDmg ? Math.min(0.05, (now - this.lastDmg) / 1000) : 0.016; this.lastDmg = now;
    for (const s of this.dmgPool) {
      if (!s.active) continue;
      s.t += dt;
      if (s.t > 0.9) { s.active = false; s.el.style.display = 'none'; continue; }
      this.placeDmg(s);
    }
  }
  clearDmg() { for (const s of this.dmgPool) { s.active = false; s.el.style.display = 'none'; } }

  floorBanner(title, name, sub) {
    const b = $('banner');
    $('bTitle').textContent = title; $('bName').textContent = name; $('bSub').textContent = sub;
    b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
  }
  toast(msg) {
    const t = $('toast'); t.textContent = msg; t.classList.remove('show'); void t.offsetWidth; t.classList.add('show');
  }
  bossBar(name, k) {
    $('boss').classList.remove('hidden');
    if (name) $('bossName').textContent = name;
    $('bossFill').style.width = (Math.max(0, k) * 100).toFixed(1) + '%';
  }
  hideBossBar() { $('boss').classList.add('hidden'); }
  fade(on) { $('fade').classList.toggle('on', on); }
  fps(f, scale, q) { if (settings.fps) $('fps').textContent = `${f.toFixed(0)} FPS · ${q.toUpperCase()} · ${(scale * 100).toFixed(0)}%`; }

  showPerks(opts, level, cb) {
    const box = $('perkList'); box.innerHTML = '';
    $('perkTitle').textContent = `Seviye ${level} — Bir güç seç`;
    opts.forEach((p, i) => {
      const el = document.createElement('button');
      el.className = 'perk'; el.style.animationDelay = (i * 0.08) + 's';
      el.innerHTML = `<div class="pi">${perkIcon(p.id)}</div><div class="pt"><div class="pn">${p.name}</div><div class="pd">${p.desc}</div></div>`;
      el.addEventListener('click', (e) => { e.preventDefault(); $('perks').classList.add('hidden'); this.paused = false; cb(p); });
      box.appendChild(el);
    });
    input.attack = false;
    $('perks').classList.remove('hidden');
    this.paused = true;
  }

  gameOver(s) {
    $('overStats').innerHTML = statsHtml(s) + (s.best ? `<div class="best">${icon('star')} YENİ REKOR ${icon('star')}</div>` : '');
    this.show('over');
  }
  victory(s) { $('vicStats').innerHTML = statsHtml(s); this.show('victory'); }
}

function statsHtml(s) {
  const m = Math.floor(s.time / 60), sec = Math.floor(s.time % 60);
  return `<div class="stats">
    <div><span>Ulaşılan kat</span><b>${s.floor}</b></div>
    <div><span>Seviye</span><b>${s.level}</b></div>
    <div><span>Öldürülen</span><b>${s.kills}</b></div>
    <div><span>Altın</span><b>${s.gold}</b></div>
    <div><span>Süre</span><b>${m}:${String(sec).padStart(2, '0')}</b></div>
    <div class="score"><span>Skor</span><b>${s.score}</b></div></div>`;
}
