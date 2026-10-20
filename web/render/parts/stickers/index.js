// 文字のあとに貼る飾り（2026-10-18 持ち主「JIZURA とか文字PVって字が出た後にステッカーみたいなのよく出ない？」）。
// 文字が出そろったあと、行や強調語のそばに「ポン」と貼られて少し動き、行が消えるとき一緒に消える。
// 絵は全部自作（logo・seal・bubble・doodle・paper）。描く場所は文字と同じ平面（行の外枠 P.L・強調語の外枠 P.E の座標）。
//
// 1 つの飾り = { id, cat, name, draw(ctx, S), at?, size?, pop?, tilt?, back? }
//   at：貼る場所 corner（言葉の右上）・cornerL（左上）・above（上）・under（下）・side（行の右）・lineLeft（行の左）・
//       on（言葉の真ん中。S.w・S.h に外枠）・line（行の真ん中。行の外枠）。既定 corner
//   size：大きさ（S.u = 文字の大きさ px × 1.7 × size）
//   pop：現れ方 pop（弾む）・stamp（押す）・drop（落ちる）・slap（回って貼る）・unfold（横に開く）・flicker（またたく）・draw（線を描く）・none（飾りが自分で動く）
//   spots：置き場所の候補（tr・tl・t・r・l・br・bl・above・under・on・line・lineLeft。既定は at から）。noMirror：左に置いても反転しない
//   tilt：傾きのばらつき（既定 0.4）。back：文字の後ろに描く。inkText：上の文字を濃い色にする（後ろに敷く紙が明るいもの）
import { hash01 } from '../../rand.js';
import { cl, oc, ob } from './common.js';
import { LOGO } from './logo.js';
import { SEAL } from './seal.js';
import { BUBBLE } from './bubble.js';
import { DOODLE } from './doodle.js';
import { PAPER } from './paper.js';

export const STICKER_CATS = {
  logo: 'ロゴ風（言葉を組む）',
  seal: 'シール',
  bubble: '吹き出し',
  doodle: '手描きの記号',
  paper: '紙もの',
};
export const STICKERS = [
  ...LOGO.map(d => ({ cat: 'logo', ...d })),
  ...SEAL.map(d => ({ cat: 'seal', ...d })),
  ...BUBBLE.map(d => ({ cat: 'bubble', ...d })),
  ...DOODLE.map(d => ({ cat: 'doodle', ...d })),
  ...PAPER.map(d => ({ cat: 'paper', ...d })),
];
export const STICKER_BY_ID = Object.freeze(Object.fromEntries(STICKERS.map(d => [d.id, d])));

// 本編で使う組（2026-10-18 持ち主が見本で「いい」にしたもの）。doodle＝手描きの記号だけ、all＝シール・紙もの・丸い吹き出しも
const DOODLE_SET = ['circle-around', 'wave-under', 'double-under', 'kira-three', 'surprise', 'sweat', 'anger', 'spiral', 'notes-float', 'hanamaru',
  'check', 'cross', 'bang-pair', 'question', 'speed', 'hearts-up', 'halo', 'orbit', 'brackets', 'shooting', 'pop-dots', 'scribble-star', 'mark-word'];
const OTHER_SET = ['star', 'heart', 'bolt', 'cloud', 'flower', 'crown', 'eye', 'flame', 'drop', 'moon', 'face', 'note', 'planet', 'big-sparkle', 'gem', 'cat',
  'round-bang', 'tape-corners', 'sticky', 'torn', 'postage', 'clip', 'marker'];
export const STICKER_SETS = Object.freeze({ doodle: Object.freeze([...DOODLE_SET]), all: Object.freeze([...DOODLE_SET, ...OTHER_SET]) });

export const POP_SECONDS = 0.45; // 現れる動きの長さ
const SCALE = 1.7;               // 飾りの大きさの元（文字の大きさ px に掛ける）
const DRAW_SECONDS = 0.6;        // 線が描かれる長さ
const OUT_SECONDS = 0.3;         // 消える長さ

// 置き場所の候補（at ごとの既定。飾りが spots で決めていればそちら）。毎回 seed で 1 つ選ぶ
const SPOTS = {
  corner: ['tr', 'tl', 't', 'r', 'br', 'bl'],
  cornerL: ['tl', 'tr'],
  side: ['r', 'l'],
};
/** その飾りの置き場所の名前（seed ごとに決まる。見本ページが画面に収めるのに使う） */
export const spotNameOf = (def, seed) => { const list = spotsOf(def); return list[Math.floor(spotR(seed) * list.length) % list.length]; };
// 置き場所の乱数（seed が 1 違いでもよくばらけるよう、seed を大きく混ぜてから引く）
const spotR = seed => hash01(Math.imul(seed | 0, 2654435761) ^ 0x5bd1e995, 31337);
/** その飾りの置き場所の候補 */
export const spotsOf = def => def?.spots ?? SPOTS[def?.at ?? 'corner'] ?? [def?.at];

/**
 * 貼る場所（行の座標）と、そこで使う外枠の幅・高さ。mirror は左側に置くとき（絵を左右反転して言葉のほうへ向ける）。
 * 角や横に置くものは、強調語のそばか行のはしかも選ぶ。言葉の外枠から u の分は離す
 */
export function stickerSpot(def, P, u, r, seed) {
  const L = P.L, E = P.E ?? L;
  const list = spotsOf(def);
  const spot = spotNameOf(def, seed) ?? 'tr';
  const lw = L.right - L.left, lh = L.bottom - L.top;
  // 強調語が行と違うときだけ、3 割は行のはしに貼る
  const sameE = E === L || (E.left === L.left && E.right === L.right);
  const B = !sameE && r(6) < 0.3 ? L : E;
  const bw = B.right - B.left, bh = B.bottom - B.top;
  const slide = (r(7) - 0.5) * u * 0.5; // 辺に沿って少しずらす
  const mirror = !def.noMirror;
  switch (spot) {
    case 'tl': return { spot, x: B.left - u * 0.8, y: B.top - u * 0.45 + slide * 0.4, w: bw, h: bh, mirror };
    case 't': return { spot, x: B.cx + (r(8) - 0.5) * bw * 0.6, y: B.top - u * 1.05, w: bw, h: bh };
    case 'r': return { spot, x: B.right + u * 1.05, y: B.cy + slide, w: bw, h: bh };
    case 'l': return { spot, x: B.left - u * 1.05, y: B.cy + slide, w: bw, h: bh, mirror };
    case 'br': return { spot, x: B.right + u * 0.8, y: B.bottom + u * 0.25, w: bw, h: bh };
    case 'bl': return { spot, x: B.left - u * 0.8, y: B.bottom + u * 0.25, w: bw, h: bh, mirror };
    case 'above': return { spot, x: E.cx, y: E.top - u * 1.3, w: E.right - E.left, h: E.bottom - E.top };
    case 'under': return { spot, x: E.cx, y: E.bottom + u * 0.55, w: E.right - E.left, h: E.bottom - E.top };
    case 'lineLeft': return { spot, x: L.left - u * 0.4, y: L.cy, w: lw, h: lh };
    case 'on': return { spot, x: E.cx, y: E.cy, w: E.right - E.left, h: E.bottom - E.top };
    case 'line': return { spot, x: L.cx, y: L.cy, w: lw, h: lh };
    default: return { spot: 'tr', x: B.right + u * 0.8, y: B.top - u * 0.45 + slide * 0.4, w: bw, h: bh };
  }
}

/**
 * 飾りを 1 つ描く。P は文字の描き方と同じ（px・L・E・fg・accent・bg・light・gA・t）。
 * o = { t（貼ってからの秒）, out（消える進み 0→1）, word, font, serif, colors:[c1,c2,c3], seed, beat（拍の頭で 1→0） }
 */
export function drawSticker(ctx, def, P, o) {
  if (!def || typeof def.draw !== 'function' || !P?.L) return;
  const t = Number.isFinite(o?.t) ? o.t : 0;
  if (!(t >= 0)) return;
  const out = cl(o?.out ?? 0);
  if (out >= 1) return;
  const px = Number.isFinite(P.px) && P.px > 0 ? P.px : 1;
  const u = px * SCALE * (def.size ?? 0.5);
  const seed = Number.isFinite(o?.seed) ? o.seed : 0;
  const r = k => hash01(seed, 7177, k);
  const pl = stickerSpot(def, P, u, r, seed);
  if (![pl.x, pl.y].every(Number.isFinite)) return;
  const cols = o?.colors ?? [];
  const S = {
    u, t, q: cl(t / POP_SECONDS), f: oc(t / DRAW_SECONDS), b: Number.isFinite(o?.beat) ? cl(o.beat) : 0,
    w: Math.max(0, pl.w || 0), h: Math.max(0, pl.h || 0),
    word: String(o?.word ?? '').trim() || '♪', font: o?.font ?? 'sans-serif', serif: o?.serif,
    c1: cols[0] ?? P.accent ?? '#FF3E7F', c2: cols[1] ?? '#FFD23D', c3: cols[2] ?? '#3DD9FF',
    stamp: o?.stamp ?? '#E23B2E',
    ink: '#16121F', paper: '#FFFFFF', fg: P.fg ?? '#FFFFFF', bg: P.bg ?? '#000000', light: !!P.light,
    seed, r, mirror: !!pl.mirror,
  };
  // 現れ方・傾き・ゆれ
  const q = S.q, pop = def.pop ?? 'pop';
  const side = r(1) > 0.5 ? 1 : -1;
  let rot = (r(2) - 0.5) * (def.tilt ?? 0.4), sx = 1, sy = 1, ty = 0, a = 1;
  switch (pop) {
    case 'pop': { const k = ob(q); sx = sy = k; rot += (1 - oc(q)) * 0.6 * side; break; }
    case 'stamp': { const k = 1 + 0.8 * (1 - oc(q * 1.8)); sx = sy = k; a = oc(q * 2.5); if (q > 0.55 && q < 0.8) ty = Math.sin((q - 0.55) * 60) * u * 0.04; break; }
    case 'drop': ty = -(1 - ob(q)) * u * 2.2; a = oc(q * 3); break;
    case 'slap': { const k = ob(q); sx = sy = 0.5 + 0.5 * k; rot += (1 - k) * 1.4 * side; a = oc(q * 3); break; }
    case 'unfold': sx = ob(q); break;
    case 'flicker': a = q < 1 ? (Math.floor(t * 18) % 3 ? 1 : 0.2) * oc(q * 2) : 1; break;
    default: break; // draw・none：飾りが S.f・S.t で自分で現れる
  }
  if (pop === 'pop' || pop === 'slap' || pop === 'stamp' || pop === 'drop') rot += Math.sin(t * 1.7 + seed) * 0.03;
  // 消えるとき：縮みながら薄く
  a *= 1 - oc(out);
  const k = 1 - 0.35 * out;
  const alpha = (Number.isFinite(P.gA) ? P.gA : 1) * a;
  if (!(alpha > 0.01)) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(pl.x, pl.y + ty);
  if (rot) ctx.rotate(rot);
  ctx.scale(sx * k * (pl.mirror ? -1 : 1), sy * k);
  try { def.draw(ctx, S); } catch { /* 1 つの飾りが壊れても絵全体は止めない */ }
  ctx.restore();
}

/** 消えるまでの秒数（描く係が終わりを決めるのに使う） */
export const STICKER_OUT_SECONDS = OUT_SECONDS;
