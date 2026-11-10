const KEY = 'gd_settings_v1';
const META = 'gd_meta_v1';

const defaults = {
  quality: 'auto', // low | medium | high | ultra | auto
  music: 0.6,
  sfx: 0.85,
  shake: true,
  fps: false,
  lang: 'tr',
};

function load(key, def) {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return Object.assign({}, def, JSON.parse(raw));
  } catch (e) { /* storage unavailable */ }
  return Object.assign({}, def);
}

export const settings = load(KEY, defaults);
export function saveSettings() {
  try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch (e) { /* ignore */ }
}

export const meta = load(META, { bestFloor: 0, bestScore: 0, runs: 0, kills: 0, wins: 0 });
export function saveMeta() {
  try { localStorage.setItem(META, JSON.stringify(meta)); } catch (e) { /* ignore */ }
}

export function detectQuality() {
  // Heuristic: GPU renderer string + core count + memory.
  let tier = 'medium';
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2');
    if (!gl) return 'low';
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const r = (ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : '') + '';
    const cores = navigator.hardwareConcurrency || 4;
    const mem = navigator.deviceMemory || 4;
    if (/Adreno \(TM\) (7[3-9]\d|8\d\d)|Mali-G7[1-9]|Mali-G[7-9]\d\d|Immortalis|Xclipse|Apple|NVIDIA|GeForce|RTX|Radeon/i.test(r) && mem >= 6) tier = 'high';
    else if (/Adreno \(TM\) [3-5]\d\d|Mali-[4T]|PowerVR SGX|Mali-G5[0-2]/i.test(r) || cores <= 4 || mem <= 2) tier = 'low';
    const isMobile = /Android|iPhone|iPad/i.test(navigator.userAgent);
    if (!isMobile && /NVIDIA|GeForce|RTX|Radeon/i.test(r)) tier = 'ultra';
  } catch (e) { tier = 'medium'; }
  return tier;
}

export const QUALITY = {
  low:    { pixelRatio: 0.75, shadows: false, shadowSize: 512,  bloom: false, ao: false, texSize: 256, torchShadow: false, lights: 4, particles: 0.5 },
  medium: { pixelRatio: 1.0,  shadows: true,  shadowSize: 1024, bloom: true,  ao: false, texSize: 512, torchShadow: false, lights: 6, particles: 0.8 },
  high:   { pixelRatio: 1.5,  shadows: true,  shadowSize: 2048, bloom: true,  ao: false, texSize: 512, torchShadow: true,  lights: 8, particles: 1.0 },
  ultra:  { pixelRatio: 2.0,  shadows: true,  shadowSize: 2048, bloom: true,  ao: true,  texSize: 1024, torchShadow: true, lights: 8, particles: 1.0 },
};
