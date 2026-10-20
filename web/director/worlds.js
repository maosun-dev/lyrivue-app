// 台本係（雰囲気 S）：場面ごとの「世界」。1つの世界 = 背景＋配色＋出やすい書体と飾り＋文字の後ろに敷くもの（台紙）。
// 場面ごとに 1 つ選ぶ。同じ世界は 2 場面続かない。弱い場面は静かな世界（calm）、強い場面は派手な世界（loud）が出やすい。
// 乱数は台本の本体・演出とは別の列（種から作る）：世界を足しても、置き場所・カメラ・出方・効果・小物の選びは変わらない。
// 背景の形は render/parts/worlds/、台紙は render/parts/backings.js。2026-10-19 に足した（設計 docs/superpowers/specs/2026-10-19-worlds-design.md）
import { makeRng } from './rng.js';

const HEX = /^#([0-9a-f]{6})$/i;
const okHex = (c, d) => (typeof c === 'string' && HEX.test(c) ? c : d);
// 色合い（0〜360）・あざやかさ・明るさ（0〜1）→ '#rrggbb'
function hsl(h, s, l) {
  const f = n => {
    const k = (n + h / 30) % 12;
    const v = l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}
// '#rrggbb' の色合い（読めなければ d）
function hueOf(c, d) {
  const m = HEX.exec(String(c ?? ''));
  if (!m) return d;
  const [r, g, b] = [0, 2, 4].map(i => parseInt(m[1].slice(i, i + 2), 16) / 255);
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), dd = mx - mn;
  if (dd < 1e-6) return d;
  const h = mx === r ? ((g - b) / dd) % 6 : mx === g ? (b - r) / dd + 2 : (r - g) / dd + 4;
  return (h * 60 + 360) % 360;
}
const fixed = (light, bg, fg, line, accent) => () => ({ bg, fg, line, accent, light });

/**
 * 紙の時間（2026-10-19 方針「曲は旅」）：紙のカードの世界の配色の変種。同じ紙の世界に戻るとき、時間が進む。
 * card は空間に散らばるカードと、文字の後ろの台紙の色。夜は暗いカードに明るい文字（月明かりの紙）
 */
export const PAPER_TIMES = [
  { id: 'dawn', name: '朝', ink: { bg: '#dfe6ec', fg: '#1d2733', line: '#8798a8', accent: '#e5876f', card: '#f7f9fb', light: true } },
  { id: 'day', name: '昼', ink: { bg: '#e8e2d4', fg: '#1e1b18', line: '#8c8273', accent: '#c8452f', card: '#f8f5ee', light: true } },
  { id: 'dusk', name: '夕方', ink: { bg: '#e7b07e', fg: '#2a1610', line: '#8a4e33', accent: '#d23f24', card: '#f6e2c6', light: true } },
  { id: 'night', name: '夜', ink: { bg: '#141b2e', fg: '#f1ead8', line: '#7d8cb8', accent: '#f2c45a', card: '#28324f', light: false } },
  { id: 'old', name: '古い紙', ink: { bg: '#c7b089', fg: '#2b1d10', line: '#7a5c36', accent: '#8f2f1f', card: '#e6d4ae', light: true } },
];
const PAPER_BY_ID = new Map(PAPER_TIMES.map(p => [p.id, p]));
/** 紙の時間の配色（写しを返す）。知らない名前は昼 */
export const paperTime = id => ({ ...(PAPER_BY_ID.get(id) ?? PAPER_BY_ID.get('day')).ink });

// 色の計算：2 色を混ぜる（k は b の割合）・明るさ（相対輝度）
const rgbOf = c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16));
const mix = (a, b, k) => `#${rgbOf(a).map((v, i) => Math.round(v + (rgbOf(b)[i] - v) * k).toString(16).padStart(2, '0')).join('')}`;
const lumOf = c => {
  const [r, g, b] = rgbOf(c).map(v => v / 255).map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrastOf = (a, b) => { const [x, y] = [lumOf(a), lumOf(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

// 昼のように明るくせず「神秘的な明るさ」にする世界（2026-10-19 持ち主が見本で選んだ。森の葉のいつもの色が手本）
const MYSTIC_DAWN = new Set(['hud', 'city', 'neon', 'stars', 'kaleido']);
/**
 * 夜明けの配色（2026-10-19 持ち主「最後の世界は不要か明るくするか選べるように」）：曲の最後で、同じ世界のまま光が差して開けた色にする。
 * 紙は「朝」。明るい地の世界は地をさらに淡く、暗い地の世界は線の色合いの淡い地に濃い文字。top は上から差す光の色（水の中・雨の窓の上）、card はカードの色
 * @param {{bg:string, fg:string, line:string, accent:string, light:boolean}} ink 元の配色
 * @param {string} [id] 世界の id
 */
export function dawnInk(ink, id) {
  if (id === 'paper' || !ink || ![ink.bg, ink.fg, ink.line, ink.accent].every(c => HEX.test(String(c ?? '')))) { const p = paperTime('dawn'); return { ...p, top: mix(p.bg, '#ffffff', 0.5) }; }
  const h = hueOf(ink.line, hueOf(ink.accent, hueOf(ink.bg, 210)));
  let out;
  if (MYSTIC_DAWN.has(id) && !ink.light) {
    // 神秘的な明るさ：黒い地を線の色合いの深い色に持ち上げ、線を光らせ、上から淡い光が差す（暗いまま。文字は明るいまま）
    const glow = hsl(h, 0.75, 0.66);
    out = { bg: hsl(h, 0.55, 0.15), fg: ink.fg, line: lumOf(glow) >= lumOf(ink.line) ? glow : mix(ink.line, '#ffffff', 0.15), accent: ink.accent, top: hsl(h, 0.6, 0.34), card: hsl(h, 0.45, 0.22), light: false };
    if (contrastOf(out.fg, out.bg) < 4.5) out.fg = '#ffffff';
    return out;
  }
  if (ink.light) {
    const bg = mix(ink.bg, '#ffffff', 0.4);
    out = { bg, fg: ink.fg, line: ink.line, accent: ink.accent, top: mix(bg, '#ffffff', 0.5), card: mix(bg, '#ffffff', 0.7), light: true };
  } else {
    const bg = hsl(h, 0.35, 0.88);
    out = {
      bg, fg: hsl(h, 0.5, 0.15), line: hsl(h, 0.45, 0.45),
      accent: lumOf(ink.accent) > 0.45 ? hsl(hueOf(ink.accent, h), 0.75, 0.45) : ink.accent,
      top: hsl(h, 0.45, 0.78), card: hsl(h, 0.3, 0.96), light: true,
    };
  }
  if (contrastOf(out.fg, out.bg) < 4.5) out.fg = hsl(h, 0.5, 0.12); // 文字は必ず読める濃さに
  return out;
}

// 書体の好み（ここに無い書体は 0.4 倍）・飾りの好み（無いものは 0.5 倍）
const F = (...ks) => Object.fromEntries(ks.map(k => [k, 1.6]));
const D = (...ks) => Object.fromEntries(ks.map(k => [k, 1.6]));

/** 世界の一覧（設計の表の順）。light：明るい地か（tunnel・void は場面の地の色に従うので null） */
export const WORLDS = [
  { id: 'sky', name: '空と線画', light: true, energy: 'calm', back: 'line', fonts: F('mincho', 'hand'), decos: D('brackets'), palette: fixed(true, '#d9e9f4', '#1f3446', '#5a7a90', '#f2a65a') },
  { id: 'hud', name: '方眼の計器', light: false, energy: 'loud', back: 'bracket', fonts: F('gothic', 'dot'), decos: D('brackets', 'focus'), palette: fixed(false, '#0b131c', '#e8f4f5', '#3fb8c4', '#ffb23d') },
  { id: 'paper', name: '紙のカード', light: true, energy: 'calm', back: 'card', fonts: F('mincho', 'hand'), decos: D('halftone'), palette: () => paperTime('day') },
  { id: 'pop', name: 'ポップな図形', light: true, energy: 'loud', back: 'blob', fonts: F('heavy', 'gothic'), decos: D('focus', 'halftone'), palette: fixed(true, '#ffdf3d', '#241a36', '#241a36', '#ff4f7b') },
  {
    id: 'mono', name: '1色の網点', light: true, energy: 'mid', back: 'halftone', fonts: F('gothic', 'heavy'), decos: D('halftone'),
    palette: colors => { const h = hueOf(colors?.[0], 214); return { bg: hsl(h, 0.65, 0.86), fg: hsl(h, 0.7, 0.2), line: hsl(h, 0.65, 0.45), accent: hsl(h, 0.8, 0.55), light: true }; },
  },
  { id: 'city', name: '夜の街の線画', light: false, energy: 'mid', back: 'sign', fonts: F('gothic', 'mincho'), decos: D('brackets'), palette: fixed(false, '#05060b', '#f4eedd', '#5b8cff', '#ffd36b') },
  { id: 'news', name: '新聞・雑誌', light: true, energy: 'calm', back: 'rule', fonts: F('mincho'), decos: D('brackets', 'halftone'), palette: fixed(true, '#f4f1ea', '#161616', '#8a8a8a', '#c2262e') },
  {
    id: 'neon', name: '光る線の枠', light: false, energy: 'loud', back: 'tube', fonts: F('gothic', 'hand'), decos: D('focus'),
    palette: colors => ({ bg: '#08030e', fg: '#fff0f6', line: okHex(colors?.[0], '#ff4fa3'), accent: '#39e6f0', light: false }),
  },
  { id: 'water', name: '水の中', light: false, energy: 'calm', back: 'ripple', fonts: F('mincho', 'hand'), decos: D('halftone'), palette: fixed(false, '#04222b', '#e2fbff', '#4fc6d9', '#9ff2e0') },
  { id: 'stars', name: '星図', light: false, energy: 'calm', back: 'orbit', fonts: F('mincho', 'dot'), decos: D('brackets'), palette: fixed(false, '#050816', '#eef1ff', '#8c9eff', '#ffe28a') },
  { id: 'blueprint', name: '設計図', light: false, energy: 'mid', back: 'dimension', fonts: F('gothic', 'dot'), decos: D('brackets'), palette: fixed(false, '#123a7a', '#f2f7ff', '#a9c8f5', '#ffffff') },
  { id: 'film', name: '映画のフィルム', light: false, energy: 'mid', back: 'frame', fonts: F('mincho', 'gothic'), decos: D('brackets', 'halftone'), palette: fixed(false, '#0d0b09', '#f3e9d2', '#8e7f66', '#e8b04a') },
  { id: 'chalk', name: '黒板', light: false, energy: 'calm', back: 'chalk', fonts: F('hand'), decos: D('brackets'), palette: fixed(false, '#183a2d', '#f1f1e6', '#cfe3d3', '#f6d36b') },
  { id: 'leaves', name: '森の葉', light: false, energy: 'calm', back: 'cutout', fonts: F('mincho', 'hand'), decos: D('halftone'), palette: fixed(false, '#0e2416', '#f0f7e8', '#6dbb6a', '#e3f27a') },
  {
    id: 'kaleido', name: '万華鏡', light: false, energy: 'loud', back: 'prism', fonts: F('heavy', 'gothic'), decos: D('focus'),
    palette: colors => ({ bg: '#0a0614', fg: '#ffffff', line: okHex(colors?.[0], '#b36bff'), accent: '#ffd23d', light: false }),
  },
  { id: 'window', name: '雨の窓', light: false, energy: 'calm', back: 'fog', fonts: F('mincho', 'hand'), decos: D('halftone'), palette: fixed(false, '#1c2633', '#eef3f8', '#8fa4bc', '#ffc37a') },
  { id: 'game', name: 'ゲーム画面', light: false, energy: 'loud', back: 'dialog', fonts: F('dot'), decos: D('brackets'), palette: fixed(false, '#000000', '#ffffff', '#3ddc84', '#ff3d6e') },
  { id: 'sunset', name: '夕焼けの影絵', light: true, energy: 'mid', back: 'band', fonts: F('mincho', 'heavy'), decos: D('focus'), palette: fixed(true, '#f59a4a', '#1a0f14', '#1a0f14', '#ffe07a') },
  { id: 'tunnel', name: '輪のトンネル', light: null, energy: 'loud', back: null, fonts: {}, decos: {} },
  { id: 'void', name: '何もない空間', light: null, energy: 'mid', back: null, fonts: {}, decos: {} },
];
export const WORLD_IDS = WORLDS.map(w => w.id);
const BY_ID = new Map(WORLDS.map(w => [w.id, w]));
/** id から世界（無ければ undefined） */
export const worldById = id => BY_ID.get(id);

const weightOf = (w, i) => Math.max(0.05, w.energy === 'calm' ? 1.3 - 1.0 * i : w.energy === 'loud' ? 0.3 + 1.4 * i : 0.8);

/** 区切りの名前から種類：verse（A メロ・前奏）／bridge（つなぎ：Pre-Chorus・Bridge・B/C メロ）／chorus（サビ）／outro（終わり）。読めなければ null */
export function sectionKind(name) {
  const s = String(name ?? '');
  if (/outro|ending|アウトロ/i.test(s)) return 'outro';
  if (/pre|bridge|ブリッジ|Bメロ|Cメロ|プレ/i.test(s)) return 'bridge';
  if (/chorus|hook|サビ/i.test(s)) return 'chorus';
  if (/verse|intro|Aメロ|イントロ/i.test(s)) return 'verse';
  return null;
}
/** 歌詞の言葉 → 世界（前後の歌詞・区切りの歌詞に出てくれば、その世界を選びやすい。間奏と旅の組み立てで使う） */
export const WORLD_WORDS = [
  ['sky', /\bsky|skies|cloud|空|雲/i], ['stars', /\bstars?\b|night|galaxy|夜|星|宇宙/i], ['window', /\brain|雨|窓|window/i],
  ['water', /\bsea\b|ocean|water|wave|海|波|水/i], ['city', /\bcity|street|train|station|街|駅|電車/i],
  ['leaves', /\bleaf|leaves|forest|tree|森|葉/i], ['sunset', /sunset|dusk|夕|黄昏/i], ['neon', /\blight|neon|光/i],
];
const WORD_GAIN = 4; // 区切りの歌詞の言葉に合う世界の重みの倍率
// 歌詞から作る数（同じ種でも曲が違えば場所の組み合わせが変わるように、乱数の種に混ぜる）
const textSalt = texts => { let h = 7; for (const ch of texts.join('\n')) h = (h * 31 + ch.codePointAt(0)) % 1000003; return h; };
// 区切りの種類ごとに向く世界の性格
const KIND_ENERGY = { verse: 'calm', bridge: 'mid', chorus: 'loud' };
// 歌詞の言葉で選ぶときに許す性格
const KIND_FIT = { verse: ['calm', 'mid'], bridge: ['calm', 'mid'], chorus: ['loud'] };
const OPEN_WORLD = 'sky'; // 最後に抜ける開けた場所（ending: 'sky' のとき）
const ENDINGS = ['bright', 'stay', 'sky']; // 最後の世界：明るく（初期）・そのまま・空へ抜ける
const PAPER_ORDER = ['day', 'dusk', 'night', 'dawn', 'old']; // 紙に戻るたびに進む時間の順（opts.paperTimes でしぼる）

/**
 * 旅の組み立て（2026-10-19 方針の決まり②「曲は旅」）。区切りの種類ごとに場所を 1 つ決め、同じ種類の区切りは同じ場所に戻る
 * （紙の場所は戻るたびに時間が進む）。A メロは静か・つなぎは中くらい・サビは派手な世界。最後は開けた場所（空）へ抜ける：
 * Outro があればそこ、無ければ曲の終わりの間奏が使う（open）。名前の読めない区切りは今までどおり強さで選ぶ（隣と同じ場所は避ける）。
 * 乱数は台本のほかの選びと別の列（種から作る）
 * @param {string[]} names 場面ごとの区切りの名前
 * @param {number[]} intensities 場面ごとの強さ（名前の読めない区切りに使う）
 * @param {number} seed
 * @param {{worlds?:string[], paperTimes?:string[], texts?:string[], ending?:'bright'|'stay'|'sky'}} [opts] worlds：使ってよい世界。paperTimes：紙に戻るたびに使う時間の順。
 *   texts：場面ごとの歌詞（区切りの種類ごとにまとめ、言葉に合う世界を選びやすくする）。
 *   ending：最後の世界。bright（初期）・stay は Outro も直前の世界のまま（bright は描くときに夜明けの配色。dawnInk）、sky は空と線画へ抜ける
 * @returns {{worlds:string[], times:(string|null)[], open:string|null, ending:string}}
 */
export function planJourney(names, intensities, seed, opts) {
  const list = Array.isArray(names) ? names : [];
  const ints = Array.isArray(intensities) ? intensities : [];
  const texts = Array.isArray(opts?.texts) ? opts.texts.map(t => String(t ?? '')) : [];
  const rng = makeRng((Number.isFinite(seed) ? Math.trunc(seed) : 0) * 5021 + 33331 + (texts.length ? textSalt(texts) : 0));
  const wanted = Array.isArray(opts?.worlds) ? WORLDS.filter(w => opts.worlds.includes(w.id)) : [];
  const pool = wanted.length ? wanted : WORLDS;
  const pickFrom = (cands, weight) => {
    const total = cands.reduce((s, w) => s + weight(w), 0);
    let x = rng() * total;
    for (const w of cands) if ((x -= weight(w)) < 0) return w.id;
    return cands[cands.length - 1]?.id;
  };
  // 場所を決める（決まった順に乱数を引く）：A メロ → つなぎ → サビ。前に決めた場所は避ける（候補が尽きたら性格を問わず、それも尽きたら重ねてよい）
  const used = new Set();
  const kindsAll = list.map(sectionKind);
  const placeFor = kind => {
    const energy = KIND_ENERGY[kind];
    // この種類の区切りの歌詞に出てくる言葉の世界。言葉が合っても、種類に合わない派手さの世界は選ばない
    // （A メロ・つなぎは静か〜中くらい、サビは派手な世界だけ）
    const said = list.map((_, i) => (kindsAll[i] === kind ? texts[i] ?? '' : '')).join(' ');
    const fits = new Set(WORLD_WORDS.filter(([, re]) => re.test(said)).map(([id]) => id));
    const free = pool.filter(w => !used.has(w.id) && w.id !== OPEN_WORLD);
    const cands = free.filter(w => w.energy === energy || (fits.has(w.id) && KIND_FIT[kind].includes(w.energy)));
    const id = pickFrom(cands.length ? cands : free.length ? free : pool, w => (w.id === 'paper' ? 2 : 1) * (fits.has(w.id) ? WORD_GAIN : 1)); // 持ち主は紙が好き
    used.add(id);
    return id;
  };
  const places = { verse: placeFor('verse'), bridge: placeFor('bridge'), chorus: placeFor('chorus') };
  const ending = ENDINGS.includes(opts?.ending) ? opts.ending : 'bright';
  const sky = pool.find(w => w.id === OPEN_WORLD);
  const open = ending !== 'sky' ? null : sky ? OPEN_WORLD : pool.find(w => w.energy === 'calm' && w.light && !used.has(w.id))?.id ?? null;
  const kinds = kindsAll;
  const worlds = kinds.map(k => (k === 'outro' ? open : k ? places[k] : null));
  // 名前の読めない区切り：強さで選び、前後の場所と同じものは避ける
  worlds.forEach((w, i) => {
    if (w) return;
    const raw = ints[i];
    const it = Number.isFinite(raw) ? Math.min(1, Math.max(0, raw)) : 0.5;
    if (kinds[i] === 'outro') return; // 終わりは下で直前の世界に
    const avoid = new Set([worlds[i - 1], worlds[i + 1], OPEN_WORLD].filter(Boolean)); // 開けた場所は最後だけに取っておく
    const cands = pool.filter(x => !avoid.has(x.id));
    worlds[i] = pickFrom(cands.length ? cands : pool, x => weightOf(x, it));
  });
  // 終わり（Outro）で空へ抜けないときは、直前の区切りの世界のまま（2026-10-19 持ち主「途中まではいい世界観なんだからそのまま終わる」）
  worlds.forEach((w, i) => { if (!w && kinds[i] === 'outro') worlds[i] = worlds[i - 1] ?? places.verse; });
  // 紙に戻るたびに時間が進む
  const order = (Array.isArray(opts?.paperTimes) ? PAPER_ORDER.filter(t => opts.paperTimes.includes(t)) : []);
  const times = order.length ? order : PAPER_ORDER;
  // 名前の読めない区切り（前奏など）は時間を進めず、次の紙の区切りと同じ時間（無ければ前の時間）
  let visits = 0;
  const timeOf = worlds.map((w, i) => (w === 'paper' && kinds[i] ? times[visits++ % times.length] : null));
  worlds.forEach((w, i) => {
    if (w !== 'paper' || timeOf[i]) return;
    const next = timeOf.slice(i + 1).find((t, k) => t && worlds[i + 1 + k] === 'paper');
    timeOf[i] = next ?? timeOf.slice(0, i).reverse().find(Boolean) ?? times[0];
  });
  return { worlds, times: timeOf, open, ending };
}

/**
 * 場面ごとに世界を 1 つ選ぶ（区切りの名前を使わない、前からの選び方。名前の無い曲は planJourney の中で強さで選ぶ）
 * @param {number[]} intensities 場面ごとの強さ（0〜1。数でなければ 0.5）
 * @param {number} seed
 * @param {{worlds?:string[]}} [opts] worlds：使ってよい世界の id（無い・空・知らない名前だけなら全部）
 * @returns {string[]} 場面ごとの世界の id
 */
export function planWorlds(intensities, seed, opts) {
  const list = Array.isArray(intensities) ? intensities : [];
  const rng = makeRng((Number.isFinite(seed) ? Math.trunc(seed) : 0) * 4813 + 918273);
  const wanted = Array.isArray(opts?.worlds) ? WORLDS.filter(w => opts.worlds.includes(w.id)) : [];
  const pool = wanted.length ? wanted : WORLDS;
  let prev;
  return list.map(raw => {
    const i = Number.isFinite(raw) ? Math.min(1, Math.max(0, raw)) : 0.5;
    const cands = pool.length > 1 ? pool.filter(w => w.id !== prev) : pool;
    const total = cands.reduce((s, w) => s + weightOf(w, i), 0);
    let x = rng() * total;
    let pick = cands[cands.length - 1];
    for (const w of cands) { if ((x -= weightOf(w, i)) < 0) { pick = w; break; } }
    prev = pick.id;
    return pick.id;
  });
}
