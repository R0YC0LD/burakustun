// Biome / dungeon style definitions.
export const BIOMES = [
  {
    id: 'crypt', name: 'Kadim Mahzen', sub: 'Unutulmuş kralların kemikleri burada yatar', seed: 3,
    floor: { a: [92, 88, 82], b: [120, 114, 104], dirt: [60, 52, 44], grout: [34, 31, 28], rough: 0.85 },
    wall: { a: [86, 80, 72], b: [112, 104, 92], mortar: [44, 40, 36], moss: [58, 70, 44], rough: 0.9 },
    ambient: 0x2a2f3a, ambientI: 0.55, hemiSky: 0x6070a0, hemiGround: 0x201810, key: 0x8090c0, keyI: 0.55,
    torch: 0xff8a3a, torchI: 1.0, fog: 0x07080c,
    liquid: { color: 0x0d1a22, emissive: 0x0a2a3a, ei: 0.4, rough: 0.05, metal: 0.2, walk: false },
    particles: 'dust', props: ['pillar', 'coffin', 'urn', 'bones'], step: 'stone',
    enemies: ['skeleton', 'skeleton', 'archer', 'spider'], boss: 'lich',
  },
  {
    id: 'lava', name: 'Kor Mağaraları', sub: 'Dağın kalbi hâlâ yanıyor', seed: 7,
    floor: { a: [58, 46, 42], b: [82, 64, 56], dirt: [30, 22, 20], grout: [120, 40, 10], rough: 0.8, glow: [255, 80, 10] },
    wall: { a: [52, 40, 36], b: [76, 58, 50], mortar: [30, 20, 18], moss: [140, 50, 20], rough: 0.85 },
    ambient: 0x3a2018, ambientI: 0.5, hemiSky: 0xff7040, hemiGround: 0x200805, key: 0xff9a60, keyI: 0.45,
    torch: 0xff6a1a, torchI: 1.2, fog: 0x100503,
    liquid: { color: 0xff4000, emissive: 0xff3a00, ei: 2.6, rough: 0.6, metal: 0, walk: false, lava: true },
    particles: 'embers', props: ['rock', 'crystalRed', 'brazier', 'rock'], step: 'stone',
    enemies: ['imp', 'golem', 'imp', 'skeleton'], boss: 'magma',
  },
  {
    id: 'ice', name: 'Donmuş Salonlar', sub: 'Zamanın bile donduğu yer', seed: 11,
    floor: { a: [150, 170, 190], b: [190, 210, 228], dirt: [110, 130, 150], grout: [70, 90, 110], rough: 0.25 },
    wall: { a: [120, 140, 165], b: [165, 185, 210], mortar: [80, 95, 115], moss: [210, 230, 245], rough: 0.35 },
    ambient: 0x304060, ambientI: 0.7, hemiSky: 0x9fd0ff, hemiGround: 0x203040, key: 0xbfe0ff, keyI: 0.7,
    torch: 0x6ac8ff, torchI: 1.0, fog: 0x0a1420,
    liquid: { color: 0x5aa8d8, emissive: 0x1a5a8a, ei: 0.5, rough: 0.02, metal: 0.1, walk: false },
    particles: 'snow', props: ['crystal', 'icePillar', 'crystal', 'rock'], step: 'ice',
    enemies: ['wraith', 'golem', 'wraith', 'spider'], boss: 'frostqueen',
  },
  {
    id: 'swamp', name: 'Zehirli Bataklık', sub: 'Mantarlar fısıldıyor, sular kaynıyor', seed: 17,
    floor: { a: [58, 66, 44], b: [82, 90, 56], dirt: [40, 36, 24], grout: [30, 34, 22], rough: 0.7 },
    wall: { a: [56, 60, 46], b: [80, 84, 62], mortar: [30, 32, 24], moss: [70, 110, 40], rough: 0.85 },
    ambient: 0x203018, ambientI: 0.55, hemiSky: 0x80c060, hemiGround: 0x101808, key: 0xb0e090, keyI: 0.45,
    torch: 0x9aff4a, torchI: 1.0, fog: 0x060a04,
    liquid: { color: 0x3a8a10, emissive: 0x48c010, ei: 1.0, rough: 0.1, metal: 0, walk: false },
    particles: 'spores', props: ['mushroom', 'mushroom', 'stump', 'rock'], step: 'swamp',
    enemies: ['slime', 'spider', 'slime', 'archer'], boss: 'broodmother',
  },
  {
    id: 'void', name: 'Boşluk Tapınağı', sub: 'Gerçekliğin kıyısında son kapı', seed: 23,
    floor: { a: [40, 34, 56], b: [62, 52, 86], dirt: [20, 14, 34], grout: [90, 40, 140], rough: 0.3, glow: [150, 60, 255] },
    wall: { a: [36, 30, 52], b: [58, 48, 80], mortar: [120, 60, 200], moss: [20, 16, 30], rough: 0.4 },
    ambient: 0x281a40, ambientI: 0.6, hemiSky: 0xa060ff, hemiGround: 0x100818, key: 0xc090ff, keyI: 0.5,
    torch: 0xb05aff, torchI: 1.2, fog: 0x07040c,
    liquid: { color: 0x05000a, emissive: 0x6a20c0, ei: 1.4, rough: 0.05, metal: 0.5, walk: false },
    particles: 'void', props: ['obelisk', 'crystalPurple', 'pillar', 'obelisk'], step: 'stone',
    enemies: ['voideye', 'wraith', 'voideye', 'golem'], boss: 'overseer',
  },
];

export const FLOORS_PER_BIOME = 2;
export function biomeForFloor(floor) {
  return BIOMES[Math.floor((floor - 1) / FLOORS_PER_BIOME) % BIOMES.length];
}
export function isBossFloor(floor) { return floor % FLOORS_PER_BIOME === 0; }
export const TOTAL_FLOORS = BIOMES.length * FLOORS_PER_BIOME;
