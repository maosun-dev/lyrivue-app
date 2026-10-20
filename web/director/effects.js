// 台本係（雰囲気 S）：演出の詰め込み。行ごとの出方・加工・落ち着いたあとの動き、場面の中の「境目の一瞬の効果（hits）」と
// 地の色の切り替え（tones）、場面の背景（トンネル・何もない空間）と飾り、言葉の演出（月・雨など）、コマ打ち、カット割りを決める。
// 強い場面ほど派手な種類が出やすく、数も多い。同じ種類が2行続かないようにする。
// 乱数は台本の本体とは別の列（種から作る）を使う：ここを足しても、行の置き場所やカメラの動きは変わらない。
import { makeRng } from './rng.js';
import { propsOf } from './props.js';
import { worldById } from './worlds.js';
import { TEXT_FX } from '../render/parts/text-fx.js';
import { STICKER_SETS } from '../render/parts/stickers/index.js';
import { FLOODS } from '../render/parts/flood.js';
import { STRONG_FROM, pickFactor, FLOOD_NO, FLOOD_LOUD } from './picks.js';
import { MAIN_VESSELS } from '../render/parts/vessels/index.js';

// 文字そのものの演出（2026-10-18 持ち主が見本で選んだもの。render/parts/text-fx.js）を今までの種類のあとに足す
const NEW_ENTERS = Object.keys(TEXT_FX.enter);
const NEW_LOOKS = Object.keys(TEXT_FX.look);
const NEW_HOLDS = Object.keys(TEXT_FX.hold);
export const ENTERS = ['type', 'drop', 'spin', 'scatter', 'stretch', 'random', ...NEW_ENTERS];
export const LOOKS = ['plain', 'extrude', 'outline', 'shadow', 'marker', 'glow', ...NEW_LOOKS];
export const HOLDS = ['none', 'wave', 'jitter', 'breathe', ...NEW_HOLDS];
/** 消え方（歌い終わって少し待ってから、明るい文字が飛び去る。none は今までどおりゆっくり薄くなる） */
export const EXITS = ['none', ...Object.keys(TEXT_FX.exit)];
/** 強調語のキメ（強調語が打たれた瞬間の飾り。強調語のある行だけ） */
export const KIMES = ['none', ...Object.keys(TEXT_FX.kime)];
// 新しい種類の性格：calm は静かな場面向き、loud は強い場面向き（書いていないものは中くらい）
const CALM = new Set(['rise', 'flipx', 'focus', 'baseline', 'swing', 'draw', 'cursor', 'mosaic', 'float', 'sway', 'shimmer', 'breatheglow', 'colorrun',
  'fadeup', 'shrink', 'wipe', 'dissolve', 'flipout', 'sink', 'untype', 'drip', 'gradient', 'underline', 'mirror', 'emboss', 'sparkle', 'swoosh', 'echostack']);
const LOUD = new Set(['slam', 'spring', 'glitchin', 'shuffle', 'stamp', 'orbit', 'alternate', 'neon', 'widen', 'elastic', 'bounce', 'turny', 'slash', 'halves',
  'shiver', 'heartbeat', 'hop', 'spinone', 'flicker', 'squash', 'fillswap', 'glitchout', 'explode', 'zoompast', 'strobe', 'burn', 'scatter', 'blow', 'fall', 'splitout',
  'stretchup', 'slideaway', 'spinout', 'chroma3', 'stencil', 'cut', 'offsetline', 'sticker', 'stripes', 'halftone', 'box', 'neontube',
  'flash', 'burst', 'ring', 'invertbox', 'shake', 'giant', 'colorflip', 'split']);
// 1 つの新しい種類の重み（強さ i で。base はその種類の全体の割合を決める）
// cat は種類（enter・look・hold・exit・kime）。持ち主の選び直し（director/picks.js）の倍率を掛ける：いらない 0・派手な所だけは強い場面だけ・好きは倍
const temper = (id, i, base, cat) => base * (CALM.has(id) ? 1.25 - 0.8 * i : LOUD.has(id) ? 0.35 + 1.1 * i : 0.8) * pickFactor(`${cat}:${id}`, i);
const addNew = (w, ids, i, base, cat) => { for (const id of ids) w[id] = temper(id, i, base, cat); return w; };
export const DECOS = ['focus', 'brackets', 'halftone']; // 下の波形（wave）は 2026-10-18 に外した（持ち主が消した）
// 書体（mincho＝明朝・gothic＝ゴシック・heavy＝極太・hand＝手書き風・dot＝ドット）と組み方（row＝横並び・tate＝縦組み・
// jump＝1文字ずつ大小と上下・fill＝画面いっぱいに敷き詰め・slant＝斜めの段と大きな1語）。2026-10-18 に足した
export const FONTS = ['mincho', 'gothic', 'heavy', 'hand', 'dot'];
export const SETS = ['row', 'tate', 'jump', 'fill', 'slant'];
/** 英字が文字の半分より多い行（英語の行） */
export function isLatinLine(text) {
  const s = String(text ?? '').replace(/\s/g, '');
  return s.length > 0 && (s.match(/[A-Za-z]/g) ?? []).length * 2 > s.length;
}
export const BGS = ['tunnel', 'void']; // 床の格子（floor）は 2026-10-18 に外した（持ち主「もういらない」）
// 言葉の演出：歌詞にこの言葉があれば、その行を歌う瞬間からその景色にする（上から順に調べる。「花火」は「花」「火」より先）
export const MOTIFS = [
  ['firework', ['花火']], ['rain', ['雨', 'レイン']], ['snow', ['雪', 'スノー']], ['petal', ['花', '桜', 'さくら', 'サクラ']],
  ['star', ['星', 'ほし', 'スター']], ['moon', ['月']], ['sea', ['海', '波', 'うみ']], ['ember', ['炎', '火']],
  ['wind', ['風', 'かぜ']], ['light', ['光', 'ひかり', '太陽']], ['heart', ['心', '胸', 'ハート', '鼓動']],
];
const PARTICLE_MOTIFS = new Set(['rain', 'snow', 'petal', 'ember', 'wind']); // 文字の手前にも粒を流すもの
/** 行の文字から言葉の演出の種類を探す。無ければ null */
export function motifOf(text) {
  const s = String(text ?? '');
  for (const [kind, words] of MOTIFS) if (words.some(w => s.includes(w))) return kind;
  return null;
}
const MAX_PROPS = 8;         // 1場面で同時に出す連想の小物の上限
const MAX_HITS = 600;        // 1場面の hits の上限（重くならないように）
// 強い場面（拍ごとの効果・地の色の切り替えが入る）の境目 STRONG_FROM 0.45 は director/picks.js にある（選び直しの「派手な所だけ」と同じ境目）

// 重み付きで1つ選ぶ。avoid は選ばない（ほかに候補があれば）
export function weighted(rng, weights, avoid) {
  const keys = Object.keys(weights).filter(k => weights[k] > 0 && k !== avoid);
  const list = keys.length ? keys : Object.keys(weights).filter(k => weights[k] > 0);
  const total = list.reduce((s, k) => s + weights[k], 0);
  let x = rng() * total;
  for (const k of list) { if ((x -= weights[k]) < 0) return k; }
  return list[list.length - 1];
}

export const enterWeights = i => addNew({ type: 1.3 - 0.7 * i, drop: 0.5 + 0.5 * i, spin: 0.3 + 0.8 * i, scatter: 0.3 + 0.8 * i, stretch: 0.4 + 0.6 * i, random: 0.5 }, NEW_ENTERS, i, 0.3, 'enter');
export const lookWeights = (i, emph) => addNew({ plain: 1.1 - 0.7 * i, extrude: 0.5 + 0.9 * i + (emph ? 0.8 : 0), outline: 0.6, shadow: 0.5 + 0.2 * i, marker: 0.2 + 0.6 * i, glow: 0.5 + 0.4 * i }, NEW_LOOKS, i, 0.3, 'look');
export const fontWeights = i => ({ mincho: 1.0 - 0.4 * i, gothic: 0.9, heavy: 0.3 + 1.0 * i, hand: 0.6 - 0.3 * i, dot: 0.2 + 0.4 * i });
// 長い行は縦組み・敷き詰めにしにくい（列や写しが多くなりすぎる）
// latin：英語の行（縦組みにするとアルファベットが 1 文字ずつ縦に並んで読めないので選ばない）
export const setWeights = (i, emph, n, latin = false) => ({ row: 1.2 - 0.6 * i, tate: latin ? 0 : n <= 14 ? 0.7 : 0.15, jump: 0.3 + 0.8 * i, fill: n <= 16 ? 0.15 + 0.7 * i : 0.05, slant: 0.2 + 0.5 * i + (emph ? 0.3 : 0) });
const FONT_SWAP = 0.3; // 場面の書体と違う書体にする行の割合
const STICKER_BASE = 0.16;  // 貼る飾りを貼る行の割合（弱い場面）
const STICKER_GAIN = 0.2;   // 強い場面ほど足す割合
// 歌詞で画面を埋める大げさな組み（2026-10-18 持ち主が選んだ 52 種。render/parts/flood.js）を入れる行の割合。
// 強調語のある行は弱い場面で 3 割・いちばん強い場面で 7 割、強調語の無い行は 1 割〜3 割。どれも同じ重みで、直近 FLOOD_RECENT 回に出たものは選ばない
export const floodRate = (i, emph) => (emph ? 0.3 + 0.4 * i : 0.08 + 0.22 * i);
/** どの埋める組みにするかの重み：直近に出たもの（recent）・持ち主がいらないとしたものは 0、派手な所だけのものは強い場面だけ */
export const floodWeights = (i, recent = []) => Object.fromEntries(FLOODS.map(f => [f.id, recent.includes(f.id) ? 0 : pickFactor(`${f.cat}:${f.id}`, i, FLOOD_NO, FLOOD_LOUD, new Map())]));
const FLOOD_RECENT = 10;
// 文字を載せる器（2026-10-19 持ち主が選んだ平面の 47 種。render/parts/vessels/）を入れる行の割合：弱い場面で 3 割・いちばん強い場面で 8 割
// （歌詞で埋める組み・敷き詰めの組みの行は除く）。1 行に 3 つ選び、描く係がカット（前・強調語・後ろ）ごとに順に使う
export const vesselRate = i => 0.3 + 0.5 * i;
export const VESSELS_PER_LINE = 3;
const VESSEL_RECENT = 12; // 直近この数に出た器は選ばない
// 主役は 1 つ（2026-10-19 持ち主「器を入れてから妙にごちゃごちゃしはじめた」）：
// 器か埋める組みの入った行の次の行には、どちらも入れない（息つぎ）。器の行を歌っている間（＋VESSEL_QUIET_AFTER 秒）は、
// 白飛び以外の一瞬の効果（色ずれ・裂け・揺れ・残像・文字に掛かる一瞬など）を入れない（場面の頭は残す）
const VESSEL_QUIET_AFTER = 0.3;
const QUIET_KEEP = new Set(['flash']);
/** 器を 3 つ選ぶ（行の中で重ならない。avoid にあるものは選ばない）。乱数は毎回同じ数だけ引く */
export function pickVessels(rng, avoid = []) {
  const out = [];
  for (let k = 0; k < VESSELS_PER_LINE; k++) out.push(weighted(rng, Object.fromEntries(MAIN_VESSELS.map(v => [v.id, avoid.includes(v.id) || out.includes(v.id) ? 0 : 1]))));
  return out;
}
export const holdWeights = i => addNew({ none: 1.2 - 0.6 * i, wave: 0.6, jitter: 0.2 + 0.6 * i, breathe: 0.3 + 0.6 * i }, NEW_HOLDS, i, 0.25, 'hold');
// 消え方は、静かな場面では半分くらいの行、強い場面ではほとんどの行。
// 2026-10-19 持ち主「消え方はいったん消そう。たぶんこれがごちゃごちゃ」→ on が true のときだけ（初期オフ。部品は残す）。
// まだ歌っているのに字が飛び去る（カメラが歌い終わる前に次へ動き出すので）・次の行と目を取り合う・通ってきた行が残らない、が理由
export const exitWeights = (i, on = false) => (on ? addNew({ none: 2.4 - 2.0 * i }, EXITS.slice(1), i, 0.12, 'exit') : { none: 1 });
// キメは強調語のある行だけ。強い場面ほど必ず
export const kimeWeights = (i, emph) => (emph ? addNew({ none: 0.9 - 0.8 * i }, KIMES.slice(1), i, 0.2, 'kime') : { none: 1 });
// 文字に掛かる一瞬の重み（左右反転はまれ）
export const textHitWeights = i => {
  const w = { scramble: 0.9, blink: 0.4 + 0.6 * i, slicetext: 0.6 + 0.6 * i, zoomblur: 0.5 + 0.5 * i, band: 0.7, wide: 0.6, ghost: 0.7, negative: 0.3 + 0.7 * i, mirror: 0.12 };
  for (const k of Object.keys(w)) w[k] *= pickFactor(`hit:${k}`, i); // 持ち主の選び直し（点滅・左右反転・裂け・放射のぶれは外した）
  return w;
};
const TEXT_HIT_SECONDS = { scramble: 0.22, blink: 0.25, slicetext: 0.25, zoomblur: 0.3, band: 0.35, wide: 0.25, ghost: 0.3, negative: 0.15, mirror: 0.12 };

// 行の頭に入れる効果（強さで候補と数が変わる）
function lineHits(rng, t, i, emph) {
  const H = (kind, amp, dur) => ({ t, kind, amp, dur });
  if (i < 0.3) return rng() < 0.5 ? [H(rng() < 0.6 ? 'chroma' : 'echo', 0.6, 0.3)] : [];
  if (i < STRONG_FROM) {
    const k = weighted(rng, { chroma: 1, shake: 0.7, zoom: 0.6, echo: 0.8, slice: 0.4 });
    return [H(k, 0.8, k === 'echo' ? 0.5 : 0.28)];
  }
  const pool = { slice: 1, invert: 0.5, flash: 0.6, chroma: 1, shake: 0.9, zoom: 0.8, bars: 0.5, echo: 0.7 };
  const n = 1 + (rng() < 0.4 + 0.4 * i ? 1 : 0) + (emph ? 1 : 0);
  const out = [];
  let last;
  for (let k = 0; k < n; k++) {
    last = weighted(rng, pool, last);
    const dur = { slice: 0.2, invert: 0.08, flash: 0.25, chroma: 0.35, shake: 0.3, zoom: 0.3, bars: 0.7, echo: 0.5 }[last];
    out.push(H(last, 0.8 + 0.4 * rng(), dur));
  }
  return out;
}

/**
 * @param {{start:number,end:number,intensity:number,tone:string,world?:string,lines:{index:number,start:number,end?:number,emph:boolean,text?:string,pos?:number[],until?:number}[]}[]} scenes 場面ごとの範囲・強さ・地の色・行（時刻順）。
 *   pos は行の置き場所（連想の小物をそのそばに置く）、until は行が見えなくなる時刻、end は歌い終わり（器の行を静かにする間）
 * @param {number[]} beats 拍の時刻
 * @param {number} seed
 * @param {{motifs?:boolean, fonts?:string[], stickers?:'none'|'doodle'|'all', floods?:boolean, vessels?:boolean, exits?:boolean}} [opts] motifs が false なら言葉の演出を入れない。fonts は使ってよい書体（無い・空なら全部）。
 *   floods が false なら歌詞で画面を埋める組みを入れない（初期は入れる）。vessels が true のときだけ文字を載せる器を入れる（2026-10-19 方針で初期オフ）。
 *   stickers は文字のあとに貼る飾り（none＝貼らない・既定／doodle＝手描きの記号だけ／all＝シール・紙ものも）
 * @returns {{lines:Map<number,{enter:string,look:string,hold:string,font:string,set:string,exit:string,kime:string,sticker?:string,stickerSeed?:number,flood?:string,vessels?:string[]}>, cuts:number[], scenes:{hits:{t:number,kind:string,amp:number,dur:number}[], tones:{t:number,tone:string}[],
 *   bg:string, sides?:number, koma:number, back:Object[], front:Object[]}[]}}
 *   back は文字の奥、front は文字の手前に描く層。cuts はカメラが瞬間的に切り替わる時刻（行の歌い出し）
 */
export function planEffects(scenes, beats, seed, opts) {
  const useMotifs = opts?.motifs !== false;
  const cuts = [];
  let prevHold;
  let prevDeco;
  const rng = makeRng((Number.isFinite(seed) ? Math.trunc(seed) : 0) * 7919 + 104729);
  // 書体と組み方は、さらに別の乱数の列（足しても、出方・加工・効果・カット割りの選びは前と同じ）
  const typeRng = makeRng((Number.isFinite(seed) ? Math.trunc(seed) : 0) * 6151 + 271829);
  // 連想の小物も別の乱数の列（足しても、ほかの選びは前と同じ）
  const propRng = makeRng((Number.isFinite(seed) ? Math.trunc(seed) : 0) * 3571 + 524287);
  // 消え方・キメ・文字に掛かる一瞬も別の乱数の列（2026-10-18 に足した。足してもカット割り・カメラは前と同じ）
  const textRng = makeRng((Number.isFinite(seed) ? Math.trunc(seed) : 0) * 2287 + 613);
  // 文字のあとに貼る飾りも別の乱数の列（2026-10-18 に足した。貼る・貼らないで、ほかの選びは変わらない）
  const stickRng = makeRng((Number.isFinite(seed) ? Math.trunc(seed) : 0) * 1663 + 90001);
  const stickSet = STICKER_SETS[opts?.stickers] ?? null;
  let prevSticker;
  // 歌詞で画面を埋める組みも別の乱数の列（2026-10-18 に足した。入れる・入れないで、ほかの選びは変わらない）
  const floodRng = makeRng((Number.isFinite(seed) ? Math.trunc(seed) : 0) * 2741 + 7717);
  const floodOn = opts?.floods !== false;
  const recentFloods = [];
  // 文字を載せる器も別の乱数の列（2026-10-19 に足した。入れる・入れないで、ほかの選びは変わらない）
  const vesselRng = makeRng((Number.isFinite(seed) ? Math.trunc(seed) : 0) * 3299 + 4111);
  const vesselOn = opts?.vessels === true; // 2026-10-19 方針（docs/lyrivue-direction.md）で初期オフ
  const recentVessels = [];
  let prevHeavy = false; // 前の行に器か埋める組みが入ったか（息つぎ）
  let prevExit;
  let prevKime;
  let prevTextHit;
  // 持ち主が選んだ書体だけを使う（選ばれていない書体の重みを 0 に）
  const allowed = FONTS.filter(f => Array.isArray(opts?.fonts) && opts.fonts.includes(f));
  const fontW = i => { const w = fontWeights(i); if (allowed.length) for (const k of FONTS) if (!allowed.includes(k)) w[k] = 0; return w; };
  let prevFont;
  let prevSet;
  const lines = new Map();
  const beatList = (Array.isArray(beats) ? beats : []).filter(Number.isFinite);
  let prevEnter;
  let prevLook;
  const out = (Array.isArray(scenes) ? scenes : []).map((sc, si) => {
    const i = Math.min(1, Math.max(0, Number.isFinite(sc.intensity) ? sc.intensity : 0));
    const strong = i >= STRONG_FROM;
    const hits = [];
    const tones = [];
    // 場面の頭：強い場面は白飛び＋裂け、弱い場面は色ずれ＋残像（最初の場面は除く）
    if (si > 0) {
      if (strong) hits.push({ t: sc.start, kind: 'flash', amp: 1, dur: 0.35 }, { t: sc.start, kind: 'slice', amp: 1, dur: 0.25 }, { t: sc.start, kind: 'zoom', amp: 1, dur: 0.4 });
      else hits.push({ t: sc.start, kind: 'chroma', amp: 0.9, dur: 0.4 }, { t: sc.start, kind: 'echo', amp: 1, dur: 0.6 });
    }
    const order = ['ink', 'paper', 'color'];
    let tone = sc.tone;
    // 世界の好み（書体・飾りの重みに掛ける。tunnel・void は好みなし）。乱数を引く回数は変わらない
    const world = worldById(sc.world);
    const likes = (w, pref, d) => { if (world?.palette) for (const k of Object.keys(w)) w[k] *= pref[k] ?? d; return w; };
    const sceneFontW = () => likes(fontW(i), world?.fonts ?? {}, 0.4);
    // 場面の書体を1つ決め、ときどき別の書体の行を混ぜる（同じ書体が2場面続かない）
    const mainFont = weighted(typeRng, sceneFontW(), prevFont);
    prevFont = mainFont;
    (sc.lines ?? []).forEach((l, k) => {
      prevEnter = weighted(rng, enterWeights(i), prevEnter);
      prevLook = weighted(rng, lookWeights(i, l.emph), prevLook);
      prevHold = weighted(rng, holdWeights(i), prevHold);
      const font = typeRng() < FONT_SWAP ? weighted(typeRng, sceneFontW(), mainFont) : mainFont;
      const n = Array.from(String(l.text ?? '')).length;
      // 横並びは続いてよい。ほかの組み方は2行続かない
      prevSet = weighted(typeRng, setWeights(i, l.emph, n, isLatinLine(l.text)), prevSet === 'row' ? undefined : prevSet);
      const exit = weighted(textRng, exitWeights(i, opts?.exits === true), prevExit); // オフでも乱数は同じく 1 回引く（ほかの選びが変わらない）
      if (exit !== 'none') prevExit = exit;
      const kime = weighted(textRng, kimeWeights(i, l.emph), prevKime);
      if (kime !== 'none') prevKime = kime;
      const lf = { enter: prevEnter, look: prevLook, hold: prevHold, font, set: prevSet, exit, kime };
      // 貼る飾り：4 行に 1 回くらい（強い場面ほど多い）。同じ飾りは 2 回続かない
      if (stickSet && stickRng() < STICKER_BASE + STICKER_GAIN * i) {
        lf.sticker = weighted(stickRng, Object.fromEntries(stickSet.map(id => [id, 1])), prevSticker);
        lf.stickerSeed = Math.floor(stickRng() * 1e6);
        prevSticker = lf.sticker;
      }
      // 歌詞で画面を埋める組み：強調語のある行・強い場面ほど多い。直近に出た模様は選ばない。敷き詰めの組みの行には入れない。
      // 乱数は入れるかどうかに関係なく同じ数だけ引く
      const fRoll = floodRng();
      const fPick = weighted(floodRng, floodWeights(i, recentFloods));
      if (floodOn && prevSet !== 'fill' && !prevHeavy && fRoll < floodRate(i, l.emph)) {
        lf.flood = fPick;
        recentFloods.push(fPick);
        if (recentFloods.length > FLOOD_RECENT) recentFloods.shift();
      }
      // 文字を載せる器：埋める組み・敷き詰めの組みの行には入れない。乱数は入れるかどうかに関係なく同じ数だけ引く
      const vRoll = vesselRng();
      const vPick = pickVessels(vesselRng, recentVessels);
      if (vesselOn && !lf.flood && prevSet !== 'fill' && !prevHeavy && vRoll < vesselRate(i)) {
        lf.vessels = vPick;
        recentVessels.push(...vPick);
        while (recentVessels.length > VESSEL_RECENT) recentVessels.shift();
      }
      prevHeavy = !!(lf.flood || lf.vessels);
      lines.set(l.index, lf);
      // 文字に掛かる一瞬：行の頭に（強い場面ほどよく入る）。乱数は入れるかどうかに関係なく同じ数だけ引く
      const thOn = textRng() < 0.2 + 0.55 * i;
      const th = weighted(textRng, textHitWeights(i), prevTextHit);
      const thAmp = 0.7 + 0.3 * textRng();
      if (!Number.isFinite(l.start)) return;
      if (thOn) { prevTextHit = th; hits.push({ t: l.start, kind: th, amp: thAmp, dur: TEXT_HIT_SECONDS[th] }); }
      // カット割り：強い場面ほど、行の頭でカメラが瞬間的に切り替わる（場面の最初の行は元から切り替わる）
      if (k > 0 && rng() < (strong ? 0.25 + 0.25 * i : 0.08)) {
        cuts.push(l.start);
        hits.push({ t: l.start, kind: 'slice', amp: 0.8, dur: 0.12 }, { t: l.start, kind: 'zoom', amp: 0.6, dur: 0.25 });
      }
      hits.push(...lineHits(rng, l.start, i, l.emph));
      // 地の色の切り替え：強い場面は行の頭でよく入れ替わる（反転か白飛びで隠す）。少し強い場面はときどき色地に
      const flip = strong ? rng() < 0.35 + 0.4 * i : (i >= 0.25 && rng() < 0.2);
      if (k > 0 && flip) {
        const choices = order.filter(x => x !== tone && (strong || x !== 'paper'));
        tone = choices[Math.floor(rng() * choices.length)] ?? tone;
        tones.push({ t: l.start, tone });
        hits.push({ t: l.start, kind: rng() < 0.5 ? 'invert' : 'flash', amp: 1, dur: rng() < 0.5 ? 0.08 : 0.2 });
      }
    });
    // 強い場面の拍：毎拍に小さな色ずれ、4拍ごとに揺れ、8拍ごとに裂け
    if (strong) {
      beatList.filter(b => b >= sc.start && b < sc.end).forEach((b, k) => {
        hits.push({ t: b, kind: 'chroma', amp: 0.35 + 0.3 * i, dur: 0.15 });
        if (k % 4 === 0) hits.push({ t: b, kind: 'shake', amp: 0.5 + 0.4 * i, dur: 0.2 });
        if (k % 8 === 4) hits.push({ t: b, kind: 'slice', amp: 0.7, dur: 0.15 });
      });
    }
    // 器の行を歌っている間は静かに（白飛びと場面の頭は残す）
    const quiet = (sc.lines ?? []).filter(l => lines.get(l.index)?.vessels && Number.isFinite(l.start))
      .map(l => [l.start, (Number.isFinite(l.end) ? l.end : Number.isFinite(l.until) ? l.until : l.start + 2) + VESSEL_QUIET_AFTER]);
    const loud = h => h.t !== sc.start && !QUIET_KEEP.has(h.kind) && quiet.some(([a, b]) => h.t >= a && h.t <= b);
    const inScene = hits.filter(h => h.t >= sc.start && h.t < sc.end && !loud(h)).sort((a, b) => a.t - b.t).slice(0, MAX_HITS);
    tones.sort((a, b) => a.t - b.t);
    // 背景：輪のトンネル・何もない空間（強い場面ほどトンネル）
    const bg = weighted(rng, { tunnel: 0.5 + 0.8 * i, void: 0.8 });
    const sides = [0, 3, 4, 6][Math.floor(rng() * 4)];
    // コマ打ち（1秒12コマ）：ときどき、場面まるごとカクカク動かす
    const koma = rng() < (strong ? 0.2 : 0.1) ? 12 : 0; // 2026-10-18 少し減らした（持ち主が1か所消した）
    const back = [], front = [];
    // 言葉の演出：その言葉の行を歌う瞬間から、次の言葉の景色が始まるまで（最後は場面の終わりまで）
    const found = useMotifs ? (sc.lines ?? []).map(l => ({ kind: motifOf(l.text), t: l.start })).filter(x => x.kind && Number.isFinite(x.t)) : [];
    const runs = [];
    for (const f of found) { if (!runs.length || runs[runs.length - 1].kind !== f.kind) runs.push({ ...f }); }
    runs.forEach((m, k) => {
      const to = k + 1 < runs.length ? Math.min(sc.end, runs[k + 1].t + 0.8) : sc.end;
      if (!(to > m.t)) return;
      back.push({ part: 'fx.motif', kind: m.kind, from: m.t, to });
      if (PARTICLE_MOTIFS.has(m.kind)) front.push({ part: 'fx.motif', kind: m.kind, near: true, from: m.t, to });
    });
    // 連想の小物：行の言葉から連想する小物（時計・階段・傘…）を、行のそばの空間に置く（文字の奥に描く）
    if (useMotifs) back.push(...planProps(propRng, sc, i));
    // 一般の飾り：言葉の演出が無い場面には必ず、ある場面でも強ければ（同じ種類が2場面続かない）。
    // 乱数は使うかどうかに関係なく毎回引く（言葉の演出のオン・オフで、ほかの選び＝カット割りなどが変わらないように）
    const deco = weighted(rng, likes({ focus: 0.2 + 1.0 * i, brackets: 0.8, halftone: 0.7 - 0.3 * i }, world?.decos ?? {}, 0.5), prevDeco);
    if (!runs.length || strong) {
      prevDeco = deco;
      front.push({ part: 'fx.deco', kind: deco, from: sc.start, to: sc.end });
    }
    return { hits: inScene, tones, bg, sides, koma, back, front };
  });
  return { lines, cuts: cuts.sort((a, b) => a - b), scenes: out };
}

// 場面の行から連想の小物の層を作る。小物は行の置き場所から少し横・奥にずらし（off）、ときどき大きく文字の後ろに置く。
// 行が歌われる少し前に描かれ始め、行が見えなくなるまで（短くても 3 秒）残る。同時に出るのは MAX_PROPS 個まで
function planProps(rng, sc, i) {
  const out = [];
  const pick = w => weighted(rng, w);
  for (const l of sc.lines ?? []) {
    if (!Number.isFinite(l.start)) continue;
    const kinds = propsOf(l.text, 2);
    const base = Array.isArray(l.pos) && l.pos.length >= 3 && l.pos.every(Number.isFinite) ? l.pos : [0, 0, 0];
    let side = rng() < 0.5 ? -1 : 1;
    for (const kind of kinds) {
      const big = rng() < 0.12 + 0.12 * i;
      const r1 = rng(), r2 = rng(), r3 = rng(), r4 = rng(), r5 = rng(), r6 = rng();
      const size = big ? 0.75 + 0.35 * r1 : 0.35 + 0.2 * r1;
      // off：行から見たずれ（画面の横・縦・奥行き。台本の本体が、歌う瞬間のカメラの向きで世界の置き場所 at に直す）
      const off = big ? [side * 0.2 * r2, (r3 - 0.5) * 0.2, 0.6 + 0.4 * r4] : [side * (0.25 + 0.25 * r2), (r3 - 0.5) * 0.35, 0.1 + 0.3 * r4];
      const at = [base[0] + off[0], base[1] + off[1], base[2] + off[2]];
      const style = pick({ solo: 1.2, echo: 0.2 + 0.6 * i, trio: big ? 0 : 0.3 });
      const from = Math.max(sc.start, l.start - 0.35);
      const to = Math.min(sc.end, Math.max(Number.isFinite(l.until) ? l.until : sc.end, l.start + 3));
      const seed = Math.floor(rng() * 1e6);
      side = -side;
      if (!(to > from)) continue;
      if (out.filter(p => p.from <= from && p.to > from).length >= MAX_PROPS) continue;
      out.push({ part: 'fx.prop', kind, line: l.index, off, at, size, yaw: (r5 - 0.5) * 1.2, pitch: (r6 - 0.5) * 0.4, roll: (rng() - 0.5) * 0.3, style, seed, from, to });
    }
  }
  return out;
}
