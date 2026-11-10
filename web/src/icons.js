// Hand-drawn SVG icon set (24x24 grid). Shared gradients live in one hidden <svg> injected by mountIcons().
// Classes: default = gold gradient outline, .f = soft gold fill, .s = solid gold, .r/.e/.g = red/ember/green fill,
// .w = ivory detail stroke, .t = thin stroke.
const BOOT = '<path class="f" d="M10 4h4.6v7.6l4.6 2.3a2 2 0 0 1 1.1 1.8V19H10z"/><path d="M10 16h10.2"/>';
const SWORD = '<path class="f" d="M20.5 3.5l-4.6.6-8.4 8.4 4 4 8.4-8.4z"/><path class="t" d="M17.4 6.6l-6 6"/><path d="M5.6 10.6l7.8 7.8M8 16l-3 3"/><circle class="s" cx="4.1" cy="19.9" r="1.4"/>';
const FLAME = '<path class="e" d="M12 5.6c.6 2.4 3.6 3.9 3.6 7.2a3.6 3.6 0 0 1-7.2 0c0-1.5.7-2.5 1.5-3.3.2 1 .7 1.6 1.3 1.9-.3-2.1.1-4.1.8-5.8z"/>';

const P = {
  // --- actions / interface ---
  sword: SWORD,
  swords: '<g><path class="f" d="M3.5 3.5l2.8.4 9.2 9.2-2.4 2.4-9.2-9.2z"/><path d="M11 17.5l6.5-6.5M15.4 15.4l3.4 3.4"/><circle class="s" cx="19.8" cy="19.8" r="1.3"/></g><g transform="matrix(-1 0 0 1 24 0)"><path class="f" d="M3.5 3.5l2.8.4 9.2 9.2-2.4 2.4-9.2-9.2z"/><path d="M11 17.5l6.5-6.5M15.4 15.4l3.4 3.4"/><circle class="s" cx="19.8" cy="19.8" r="1.3"/></g>',
  dash: BOOT + '<path class="w" d="M2.5 7.5h4.5M1.5 11.5h5.5M3.5 15.5h3.5"/>',
  nova: '<circle cx="12" cy="12" r="10" stroke-dasharray="4.4 2.58"/><g transform="translate(12 11.6) scale(1.3) translate(-12 -11.4)">' + FLAME + '</g>',
  potion: '<path class="r" d="M6.76 13.6h10.48a5.3 5.3 0 1 1-10.48 0z"/><path d="M9.6 3h4.8M10.5 3v5.1a6.5 6.5 0 1 0 3 0V3"/><circle class="w t" cx="10.2" cy="16.4" r=".9"/><circle class="w t" cx="13.6" cy="15" r=".6"/>',
  pause: '<rect class="s" x="6.6" y="5" width="3.8" height="14" rx="1.1"/><rect class="s" x="13.6" y="5" width="3.8" height="14" rx="1.1"/>',
  play: '<path class="s" d="M8 5.3v13.4a.8.8 0 0 0 1.2.7l10.9-6.7a.8.8 0 0 0 0-1.4L9.2 4.6A.8.8 0 0 0 8 5.3z"/>',
  scroll: '<path class="f" d="M6.5 5.5h11v13h-11z"/><path stroke-width="2.6" d="M4.6 5h14.8M4.6 19h14.8"/><path class="t" d="M9.3 9.3h5.4M9.3 12h5.4M9.3 14.7h3.2"/>',
  gear: '<circle cx="12" cy="12" r="7.6" stroke-width="3.2" stroke-dasharray="2.98 2.99" stroke-linecap="butt"/><circle class="f" cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2.3"/>',
  back: '<path stroke-width="2" d="M19.5 12H5M11 5.8L4.8 12l6.2 6.2"/>',
  home: '<path class="f" d="M6 10v9.5h12V10l-6-5.4z"/><path d="M3.6 11.6L12 4l8.4 7.6M10.2 19.5v-5h3.6v5"/>',
  retry: '<path stroke-width="2" d="M19.5 12a7.5 7.5 0 1 1-2.4-5.5M17.9 2.6v4.3h-4.3"/>',
  infinity: '<path stroke-width="2" d="M12 12c-1.8-2.6-3.3-4-5.3-4a4 4 0 0 0 0 8c2 0 3.5-1.4 5.3-4zm0 0c1.8 2.6 3.3 4 5.3 4a4 4 0 0 0 0-8c-2 0-3.5 1.4-5.3 4z"/>',
  gem: '<path class="s" d="M12 3l6.8 9-6.8 9-6.8-9z"/><path class="k" d="M5.2 12h13.6M12 3l-2.6 9 2.6 9 2.6-9z"/>',
  heart: '<path class="r" d="M12 20.5S3.5 15 3.5 8.9A4.4 4.4 0 0 1 12 7.2a4.4 4.4 0 0 1 8.5 1.7c0 6.1-8.5 11.6-8.5 11.6z"/>',
  star: '<path class="s" d="M12 2.8l2.7 6 6.5.7-4.9 4.4 1.4 6.4L12 17l-5.7 3.3 1.4-6.4-4.9-4.4 6.5-.7z"/>',
  stick: '<circle cx="12" cy="12" r="9.3"/><circle class="f" cx="12" cy="12" r="4"/><path class="t" d="M12 4.6v1.6M12 17.8v1.6M4.6 12h1.6M17.8 12h1.6"/>',
  warn: '<circle class="r" cx="12" cy="12" r="9.3"/><path class="w" stroke-width="2" d="M12 6.8v6.4"/><circle class="w" cx="12" cy="16.6" r=".5"/>',
  levelup: '<path class="f" d="M12 3.5l7 7.5h-4v9H9v-9H5z"/>',
  boss: '<path class="f" d="M3.5 18.5l-1-11 5.2 4.2L12 4.5l4.3 7.2 5.2-4.2-1 11z"/><path d="M3.5 18.5h17"/><circle class="r" cx="12" cy="14.3" r="1.4"/>',
  // --- perks ---
  p_hp: '<path class="r" d="M12 20.5S3.5 15 3.5 8.9A4.4 4.4 0 0 1 12 7.2a4.4 4.4 0 0 1 8.5 1.7c0 6.1-8.5 11.6-8.5 11.6z"/><path class="w" d="M12 9.8v5M9.5 12.3h5"/>',
  p_dmg: SWORD + '<path class="w t" d="M5 3v3.6M3.2 4.8h3.6M19.5 15.2v3M18 16.7h3"/>',
  p_as: '<path d="M12 3.5a8.5 8.5 0 0 1 8.5 8.5M18.3 9.8l2.2 2.4 2.2-2.4M12 20.5A8.5 8.5 0 0 1 3.5 12M1.3 14.2l2.2-2.4 2.2 2.4"/><path class="s" d="M12 7.2l1.4 3.4 3.4 1.4-3.4 1.4-1.4 3.4-1.4-3.4L7.2 12l3.4-1.4z"/>',
  p_spd: BOOT + '<path class="w" d="M10 8.2C6.6 8 4.2 6.6 3 4c2.6.8 4.8.9 7 .6M10 11.8c-2.6.2-4.5-.5-6-2"/>',
  p_crit: '<circle cx="12" cy="12" r="8.8"/><circle class="f" cx="12" cy="12" r="5"/><circle class="r" cx="12" cy="12" r="1.9"/><path class="w" d="M12 1.5v3.5M12 19v3.5M1.5 12H5M19 12h3.5"/>',
  p_critd: '<path class="f" d="M12 3.5a7.5 7.5 0 0 0-7.5 7.5c0 2.6 1.2 4.4 3 5.6V19a1.5 1.5 0 0 0 1.5 1.5h6a1.5 1.5 0 0 0 1.5-1.5v-2.4c1.8-1.2 3-3 3-5.6A7.5 7.5 0 0 0 12 3.5z"/><circle class="s" cx="9.2" cy="11.4" r="1.8"/><circle class="s" cx="14.8" cy="11.4" r="1.8"/><path class="t" d="M12 14.2l-.9 1.7h1.8zM10.5 18.2v2.3M13.5 18.2v2.3"/>',
  p_ls: '<path class="r" d="M12 3.2c3 4 5.8 7 5.8 10.6a5.8 5.8 0 0 1-11.6 0c0-3.6 2.8-6.6 5.8-10.6z"/><path class="w" d="M9.3 14.2a2.8 2.8 0 0 0 2.3 2.7"/>',
  p_regen: '<path class="g" d="M5 19C5 10 10 5 19.5 4.5 19.5 14 14 19 5 19z"/><path class="w t" d="M4.5 19.5L14 10M9.6 14.4v-3.6M9.6 14.4h3.8"/>',
  p_armor: '<path class="f" d="M12 3l7.5 2.6v5.6c0 4.6-3 8.2-7.5 9.8-4.5-1.6-7.5-5.2-7.5-9.8V5.6z"/><path class="w t" d="M8.3 9l3.7 2.6L15.7 9M8.3 12.8l3.7 2.6 3.7-2.6"/>',
  p_dash: '<path stroke-width="2" d="M11 6l6 6-6 6M16.5 6l6 6-6 6" transform="translate(-2.5 0)"/><path class="w" d="M2 8.5h4.5M1.5 12h6M2 15.5h4.5"/>',
  p_nova: '<circle cx="12" cy="12" r="10" stroke-dasharray="4.4 2.58"/><g transform="translate(12 11.6) scale(1.3) translate(-12 -11.4)">' + FLAME + '</g>',
  p_reach: '<path class="f" d="M12 2l1.9 2.6V15h-3.8V4.6z"/><path d="M7.8 15h8.4M12 15v4.5"/><circle class="s" cx="12" cy="20.8" r="1.3"/><path class="w t" d="M4.5 5v8M3 6.5L4.5 5 6 6.5M3 11.5L4.5 13 6 11.5M19.5 5v8M18 6.5L19.5 5 21 6.5M18 11.5l1.5 1.5 1.5-1.5"/>',
  p_thorns: '<path class="f" d="M22 12l-5.2 2 2.27 5.07-5.08-2.27L12 22l-1.99-5.2-5.08 2.27L7.2 14 2 12l5.2-2-2.27-5.07 5.08 2.27L12 2l1.99 5.2 5.08-2.27L16.8 10z"/><circle class="g" cx="12" cy="12" r="2.4"/>',
  p_potion: '<path class="g" d="M8.3 14.5h7.4l1.9 3.3a1.8 1.8 0 0 1-1.6 2.7H8a1.8 1.8 0 0 1-1.6-2.7z"/><path d="M9.3 3h5.4M10.2 3v5.6L5.5 17a2.7 2.7 0 0 0 2.4 4h8.2a2.7 2.7 0 0 0 2.4-4l-4.7-8.4V3"/><path class="w t" d="M18.5 3.5v3.4M16.8 5.2h3.4"/>',
  p_magnet: '<path class="f" d="M10.5 7.2C7 9.2 4.5 12.6 4.5 16A4.5 4.5 0 0 0 9 20.5h6a4.5 4.5 0 0 0 4.5-4.5c0-3.4-2.5-6.8-6-8.8z"/><path d="M9 3.5h6l-1.5 3.7h-3z"/><path class="s" d="M12 10.8l2.4 3.2-2.4 3.2L9.6 14z"/>',
};

export const icon = (name, cls = '') => `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true">${P[name] || ''}</svg>`;
export const ICONS = new Proxy({}, { get: (_, k) => icon(k) });
export const perkIcon = (id) => icon(P['p_' + id] ? 'p_' + id : 'star');

// Inject shared gradient defs and replace every <i data-ic="name"> placeholder with its SVG.
export function mountIcons(root = document) {
  if (!document.getElementById('icDefs')) {
    const d = document.createElement('div');
    d.innerHTML = `<svg id="icDefs" width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
<linearGradient id="icG" gradientUnits="userSpaceOnUse" x1="0" y1="2" x2="0" y2="22"><stop offset="0" stop-color="#fff3d0"/><stop offset=".55" stop-color="#e8c06a"/><stop offset="1" stop-color="#b07a2c"/></linearGradient>
<linearGradient id="icF" gradientUnits="userSpaceOnUse" x1="0" y1="2" x2="0" y2="22"><stop offset="0" stop-color="#ffe9b0" stop-opacity=".5"/><stop offset="1" stop-color="#b07a2c" stop-opacity=".16"/></linearGradient>
<linearGradient id="icR" gradientUnits="userSpaceOnUse" x1="0" y1="3" x2="0" y2="21"><stop offset="0" stop-color="#ff7a80"/><stop offset="1" stop-color="#a80f20"/></linearGradient>
<linearGradient id="icE" gradientUnits="userSpaceOnUse" x1="0" y1="5" x2="0" y2="17"><stop offset="0" stop-color="#ffe27a"/><stop offset=".6" stop-color="#ff8a2a"/><stop offset="1" stop-color="#d8351a"/></linearGradient>
<linearGradient id="icGr" gradientUnits="userSpaceOnUse" x1="0" y1="4" x2="0" y2="21"><stop offset="0" stop-color="#b4f08a"/><stop offset="1" stop-color="#2f8a3c"/></linearGradient>
</defs></svg>`;
    document.body.appendChild(d.firstChild);
  }
  root.querySelectorAll('i[data-ic]').forEach((el) => { el.outerHTML = icon(el.dataset.ic, el.className); });
}
