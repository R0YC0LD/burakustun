import { Game } from './game.js';
import { UI, input } from './ui.js';
import { initAudio, playMusic, suspendAudio, stopAmbience, playAmbience } from './audio.js';
import { settings, detectQuality } from './settings.js';

const ui = new UI();
const canvas = document.getElementById('c');
let game;

function boot() {
  try {
    game = new Game(canvas, ui, input);
  } catch (e) {
    document.getElementById('loadMsg').textContent = 'WebGL2 başlatılamadı: ' + e.message;
    return;
  }
  game.autoQ = detectQuality();
  window.__game = game;
  if (settings.quality === 'auto') game.applyQuality();
  game.startAttract();
  ui.show('menu');
  document.getElementById('loading').classList.add('done');
  setTimeout(() => document.getElementById('loading').remove(), 900);
  let last = performance.now();
  const loop = (now) => {
    requestAnimationFrame(loop);
    const dt = (now - last) / 1000; last = now;
    if (!ui.paused && game.state !== 'paused') game.update(dt);
    game.render();
  };
  requestAnimationFrame(loop);
}

let audioReady = false;
function ensureAudio() {
  initAudio();
  if (!audioReady) { audioReady = true; playMusic('menu'); }
}
window.addEventListener('pointerdown', ensureAudio, { once: false, passive: true });
window.addEventListener('touchstart', ensureAudio, { once: false, passive: true });
window.addEventListener('keydown', ensureAudio, { once: false });

ui.onPlay = () => {
  ensureAudio();
  ui.clearDmg();
  game.endless = false;
  ui.paused = false;
  ui.fade(true);
  setTimeout(() => {
    game.newRun();
    ui.show('hud');
    ui.fade(false);
  }, 450);
};
ui.onPause = () => {
  if (game.state !== 'play') return;
  game.state = 'paused';
  input.attack = false; input.mx = input.my = 0;
  suspendAudio(true);
  ui.show('pause'); document.getElementById('hud').classList.remove('hidden');
};
ui.onResume = () => {
  suspendAudio(false);
  ui.show('hud');
  game.state = 'play';
};
ui.onQuit = () => {
  suspendAudio(false);
  ui.paused = false;
  ui.clearDmg();
  ui.hideBossBar();
  ui.fade(true);
  setTimeout(() => {
    stopAmbience();
    game.startAttract();
    playAmbience(game.biome.id);
    playMusic('menu');
    ui.refreshSettings();
    ui.show('menu');
    ui.fade(false);
  }, 450);
};
ui.onEndless = () => { ui.show('hud'); game.continueEndless(); };
ui.onQuality = () => { game.applyQuality(); };
ui.onBack = () => {
  const vis = (id) => !document.getElementById(id).classList.contains('hidden');
  if (vis('perks')) return true;
  if (vis('settings')) { document.getElementById('btnSetBack').click(); return true; }
  if (vis('howto')) { ui.show('menu'); return true; }
  if (vis('over') || vis('victory')) { ui.onQuit(); return true; }
  if (game && game.state === 'play') { ui.onPause(); return true; }
  if (game && game.state === 'paused') { ui.onResume(); return true; }
  if (vis('menu')) return false; // let Android close the app
  return true;
};
// Android hardware back button bridge
window.onAndroidBack = () => ui.onBack();
window.onAndroidPause = () => { if (game && game.state === 'play') ui.onPause(); suspendAudio(true); };
window.onAndroidResume = () => { if (game && game.state !== 'paused') suspendAudio(false); };

document.addEventListener('visibilitychange', () => { if (document.hidden && game && game.state === 'play') ui.onPause(); });
document.addEventListener('contextmenu', (e) => e.preventDefault());

// let the loading screen paint before heavy texture generation
setTimeout(boot, 60);
