// 文字そのものの演出（2026-10-18 持ち主が見本 app/type-check.html で選んだもの）。描く係 text-motion.js と見本ページが使う。
// 考え方は JIZURA（MIT）を参考にしたが、形は全部自作。
//
// 1 つの演出 = { id, cat, name, glyph?, paint?, pre?, post?, dur?, stagger?, rev? }
//   cat：enter（出方）・hold（歌っている間の動き）・exit（消え方）・look（文字の加工）・kime（強調語のキメ）・hit（境目の一瞬・文字に掛かる）
//   glyph(q, g, P)：1 文字の姿 { tx, ty, rot, sx, sy, a, ch, mask, clipX, cut, blur, split, glow, color, pivot, skew, hide, unit, q }
//     q は種類ごとの進み（出方は 0 で出始め→1 で落ち着く、消え方は 0 で落ち着いた形→1 で消える、待機は使わず P.t を見る、
//     キメ・一瞬の効果は 0→1 の効き具合）。unit が true なら tx・ty は文字の大きさ g.px が 1
//   paint(ctx, g, s, P)：文字の塗り方を変える（無ければふつうに塗る P.fill）
//   pre / post(ctx, P, q)：行の後ろ・前に描く飾り（線・輪・箱など）。P.L は行の外枠、P.E は強調語の外枠
//   g = { i, ch, x, y, w, px, font, cx, cy }（x は左端、y は文字の下の線、cx・cy は文字の真ん中）
// いらないと言われたもの（2026-10-18）：小さく円をえがく・二重の縁取り・長く伸びる影・斜めの線が切り裂く
import { hash01 } from '../rand.js';

const cl = x => Math.max(0, Math.min(1, x));
const oc = x => 1 - Math.pow(1 - cl(x), 3);
const ic = x => Math.pow(cl(x), 3);
const ob = x => { const c = 1.9; const v = cl(x) - 1; return 1 + (c + 1) * v * v * v + c * v * v; };
const S = o => ({ tx: 0, ty: 0, rot: 0, sx: 1, sy: 1, a: 1, ...o });
const POOL = Array.from('#%&@*■◆▲●ｱｹﾈﾜ01ΣΩ');
const scr = (P, g, k = 0) => POOL[Math.floor(hash01(Math.floor(P.t * 30), g.i, k) * POOL.length)];

export const CATS = {
  enter: '出方',
  hold: '待機（歌っている間）',
  exit: '消え方',
  look: '文字の加工',
  kime: '強調語のキメ',
  hit: '境目の一瞬（文字に）',
};

// ---- 塗りの道具 ----
// 上半分・下半分（または斜めの片側）だけを塗る
function clipPoly(ctx, pts) { ctx.beginPath(); pts.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); ctx.clip(); }
const box = (g, pad = 0.12) => ({ l: g.x - g.px * pad, r: g.x + g.w + g.px * pad, t: g.y - g.px * 0.95, b: g.y + g.px * 0.2 });
function star(ctx, x, y, r) {
  ctx.beginPath();
  for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4, rr = k % 2 ? r * 0.28 : r; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  ctx.closePath(); ctx.fill();
}
const patterns = new Map();
function stripePat(ctx, P, color, size) {
  if (!canMakeCanvas() || typeof ctx.createPattern !== 'function') return color;
  const key = `${color}|${size}`;
  if (!patterns.has(key)) {
    const c = document.createElement('canvas'); c.width = c.height = size;
    const x = c.getContext('2d');
    x.strokeStyle = color; x.lineWidth = size * 0.32;
    for (let k = -1; k <= 1; k++) { x.beginPath(); x.moveTo(k * size, size); x.lineTo(k * size + size, 0); x.stroke(); }
    patterns.set(key, ctx.createPattern(c, 'repeat'));
  }
  return patterns.get(key);
}
function dotPat(ctx, color, size) {
  if (!canMakeCanvas() || typeof ctx.createPattern !== 'function') return color;
  const key = `dot|${color}|${size}`;
  if (!patterns.has(key)) {
    const c = document.createElement('canvas'); c.width = c.height = size;
    const x = c.getContext('2d');
    x.fillStyle = color; x.beginPath(); x.arc(size / 2, size / 2, size * 0.3, 0, Math.PI * 2); x.fill();
    patterns.set(key, ctx.createPattern(c, 'repeat'));
  }
  return patterns.get(key);
}
const mosaicCanvas = typeof document !== 'undefined' && document.createElement ? document.createElement('canvas') : null;
const canMakeCanvas = () => typeof document !== 'undefined' && typeof document.createElement === 'function';

export const FX = [
  // ================= 出方 =================
  { cat: 'enter', id: 'rise', name: '下からせり上がる（切り口あり）', glyph: q => S({ ty: (1 - oc(q)) * 1.1, mask: true, unit: true }) },
  { cat: 'enter', id: 'slam', name: '巨大から叩きつける', dur: 0.32, glyph: (q, g, P) => S({ sx: 1 + 2.6 * (1 - oc(q)) ** 2, sy: 1 + 2.6 * (1 - oc(q)) ** 2, a: cl(q * 5), tx: q > 0.6 && q < 1 ? (hash01(P.step, g.i) - 0.5) * g.px * 0.18 : 0 }) },
  { cat: 'enter', id: 'spring', name: '点からばねで弾む', dur: 0.7, glyph: q => { const s = q <= 0 ? 0 : 1 - Math.exp(-6 * q) * Math.cos(12 * q); return S({ sx: s, sy: s, a: cl(q * 4) }); } },
  { cat: 'enter', id: 'flipx', name: '上下にめくれて出る', glyph: q => { const sy = Math.max(0.02, Math.abs(Math.sin(oc(q) * Math.PI / 2))); return S({ sy, a: 0.35 + 0.65 * sy }); } },
  { cat: 'enter', id: 'turny', name: '裏返って出る（裏は色）', dur: 0.6, glyph: (q, g, P) => { const c = Math.cos((1 - oc(q)) * Math.PI); return S({ sx: Math.sign(c || 1) * Math.max(0.03, Math.abs(c)), color: c < 0 ? P.accent : null, a: cl(q * 4) }); } },
  { cat: 'enter', id: 'focus', name: 'ぼけからピントが合う', dur: 0.6, glyph: (q, g) => S({ blur: (1 - oc(q)) * g.px * 0.4, a: cl(q * 2), sx: 1 + 0.35 * (1 - oc(q)), sy: 1 + 0.35 * (1 - oc(q)) }) },
  { cat: 'enter', id: 'glitchin', name: 'ずれながら現れる（グリッチ）', glyph: (q, g, P) => S({ tx: (hash01(P.step, g.i, 3) - 0.5) * g.px * 1.2 * (1 - q), a: hash01(P.step, g.i, 4) < 0.3 + 0.7 * q ? 1 : 0.15, split: (1 - q) * g.px * 0.2 }) },
  {
    cat: 'enter', id: 'halves', name: '上と下が左右から合わさる', glyph: q => S({ d: (1 - oc(q)) * 1.6, a: cl(q * 3) }),
    paint: (ctx, g, s, P) => {
      const b = box(g), mid = g.y - g.px * 0.38, d = s.d * g.px;
      ctx.save(); clipPoly(ctx, [[b.l - d * 2, b.t], [b.r + d * 2, b.t], [b.r + d * 2, mid], [b.l - d * 2, mid]]); P.fill(ctx, g, s, { dx: -d }); ctx.restore();
      ctx.save(); clipPoly(ctx, [[b.l - d * 2, mid], [b.r + d * 2, mid], [b.r + d * 2, b.b], [b.l - d * 2, b.b]]); P.fill(ctx, g, s, { dx: d }); ctx.restore();
    },
  },
  {
    cat: 'enter', id: 'baseline', name: '線が伸びて、線の上に文字が乗る', glyph: q => S({ ty: (1 - oc(q)) * 0.9, mask: true, unit: true }),
    pre: (ctx, P, q) => { const L = P.L; ctx.fillStyle = P.accent; ctx.globalAlpha = P.gA; ctx.fillRect(L.left - P.px * 0.2, L.base + P.px * 0.12, (L.right - L.left + P.px * 0.4) * oc(q * 1.6), P.px * 0.07); },
  },
  { cat: 'enter', id: 'swing', name: '上を支点に揺れて止まる', dur: 0.9, glyph: q => S({ rot: q <= 0 ? 0 : 1.2 * Math.exp(-4 * q) * Math.cos(9 * q), pivot: -0.6, a: cl(q * 4) }) },
  {
    cat: 'enter', id: 'bounce', name: '上から落ちて弾む（着地でつぶれる）', dur: 0.7,
    glyph: (q, g) => { const b = Math.abs(Math.cos(q * 2 * Math.PI)), sq = (1 - b) * (1 - q) * cl(q * 3); return S({ ty: -g.px * 1.3 * (1 - q) ** 2 * b, sx: 1 + 0.35 * sq, sy: 1 - 0.35 * sq, pivot: 0.36, a: cl(q * 5) }); },
  },
  { cat: 'enter', id: 'elastic', name: '横にびよんと伸び縮み', dur: 0.7, glyph: q => { const s = q <= 0 ? 0 : 1 - Math.exp(-5 * q) * Math.cos(13 * q); return S({ sx: s, sy: 1 + 0.3 * (1 - s), a: cl(q * 4) }); } },
  { cat: 'enter', id: 'shuffle', name: '文字化けしてから決まる', dur: 0.7, glyph: (q, g, P) => S({ ch: q < 0.8 ? scr(P, g) : null, color: q < 0.8 ? P.accent : null }) },
  {
    cat: 'enter', id: 'stamp', name: 'はんこのように押す', dur: 0.45, glyph: q => S({ sx: 1 + 1.3 * (1 - oc(q * 1.7)), sy: 1 + 1.3 * (1 - oc(q * 1.7)), a: cl(q * 3), q }),
    paint: (ctx, g, s, P) => {
      P.fill(ctx, g, s);
      const k = (s.q - 0.55) / 0.45;
      if (k > 0 && k < 1) {
        ctx.save(); ctx.translate(g.cx, g.cy); ctx.scale(1 + k * 0.9, 1 + k * 0.9); ctx.translate(-g.cx, -g.cy);
        ctx.globalAlpha = P.gA * (1 - k) * 0.7; ctx.strokeStyle = P.accent; ctx.lineWidth = g.px * 0.05; ctx.strokeText(g.ch, g.x, g.y); ctx.restore();
      }
    },
  },
  { cat: 'enter', id: 'orbit', name: '渦を巻いて集まる', dur: 0.7, glyph: (q, g) => { const R = (1 - oc(q)) * g.px * 2.4, th = (1 - oc(q)) * 4 + g.i; return S({ tx: Math.cos(th) * R, ty: Math.sin(th) * R, rot: (1 - oc(q)) * 2, a: cl(q * 3) }); } },
  {
    cat: 'enter', id: 'tighten', name: '縁が締まって文字になる', dur: 0.35, glyph: q => S({ q }),
    paint: (ctx, g, s, P) => {
      const k = oc(s.q);
      ctx.save(); ctx.globalAlpha = P.gA * (1 - k) * 0.7; ctx.strokeStyle = P.accent; ctx.lineJoin = 'round'; ctx.lineWidth = (1 - k) * g.px * 0.18 + 0.5; ctx.strokeText(g.ch, g.x, g.y); ctx.restore();
      P.fill(ctx, g, s, { alpha: cl(s.q * 1.4) });
    },
  },
  { cat: 'enter', id: 'alternate', name: '左右から交互に飛び込む', glyph: (q, g) => S({ tx: (g.i % 2 ? 1 : -1) * (1 - oc(q)) * g.px * 3, a: cl(q * 3), skew: (g.i % 2 ? 1 : -1) * (1 - oc(q)) * 0.5 }) },
  {
    cat: 'enter', id: 'cursor', name: 'カーソル付きの打ち込み', dur: 0.01, stagger: 0.09, glyph: q => (q > 0 ? S({}) : S({ hide: true })),
    post: (ctx, P) => {
      if (!(P.lastRight > -Infinity) || Math.floor(P.t * 3) % 2 || P.t > (P.singTo ?? Infinity)) return;
      ctx.globalAlpha = P.gA; ctx.fillStyle = P.accent; ctx.fillRect(P.lastRight + P.px * 0.06, P.L.base - P.px * 0.85, P.px * 0.1, P.px * 0.95);
    },
  },
  { cat: 'enter', id: 'neon', name: 'ネオンがちらついて点く', dur: 0.8, glyph: (q, g, P) => { const on = q >= 1 || hash01(Math.floor(P.t * 20), g.i, 9) < q * q * 1.4; return S({ a: on ? 1 : 0.08, glow: on }); } },
  {
    cat: 'enter', id: 'draw', name: '輪郭を描いてから塗る', dur: 0.9, glyph: q => S({ q }),
    paint: (ctx, g, s, P) => {
      ctx.save(); ctx.globalAlpha = P.gA; ctx.strokeStyle = P.fg; ctx.lineWidth = Math.max(1, g.px * 0.03);
      ctx.setLineDash([g.px * 5 * cl(s.q / 0.7), g.px * 5]); ctx.strokeText(g.ch, g.x, g.y); ctx.restore();
      P.fill(ctx, g, s, { alpha: cl((s.q - 0.6) / 0.4) });
    },
  },
  {
    cat: 'enter', id: 'slash', name: '斜めに切れた片割れが合わさる', glyph: q => S({ d: (1 - oc(q)) * 1.4, a: cl(q * 3) }),
    paint: (ctx, g, s, P) => {
      const b = box(g, 0.4), d = s.d * g.px;
      ctx.save(); clipPoly(ctx, [[b.l, b.t], [b.r, b.t], [b.l, b.b]]); P.fill(ctx, g, s, { dx: -d, dy: -d * 0.6 }); ctx.restore();
      ctx.save(); clipPoly(ctx, [[b.r, b.t], [b.r, b.b], [b.l, b.b]]); P.fill(ctx, g, s, { dx: d, dy: d * 0.6 }); ctx.restore();
    },
  },
  { cat: 'enter', id: 'widen', name: '横に伸びた形から縮む', glyph: q => S({ sx: 1 + 3 * (1 - oc(q)), sy: 0.3 + 0.7 * oc(q), a: cl(q * 3) }) },
  {
    cat: 'enter', id: 'mosaic', name: 'モザイクから細かくなる', dur: 0.7, glyph: q => S({ q }),
    paint: (ctx, g, s, P) => {
      const f = Math.max(1, Math.round((1 - oc(s.q)) * g.px * 0.22));
      if (f <= 1 || !mosaicCanvas || typeof ctx.drawImage !== 'function') { P.fill(ctx, g, s); return; }
      const b = box(g, 0.1), w = Math.ceil(b.r - b.l), h = Math.ceil(b.b - b.t);
      const sw = Math.max(1, Math.ceil(w / f)), sh = Math.max(1, Math.ceil(h / f));
      mosaicCanvas.width = sw; mosaicCanvas.height = sh;
      const m = mosaicCanvas.getContext('2d');
      m.setTransform(sw / w, 0, 0, sh / h, -b.l * sw / w, -b.t * sh / h);
      m.font = g.font; m.fillStyle = s.color ?? P.fg; m.fillText(g.ch, g.x, g.y);
      ctx.save(); ctx.imageSmoothingEnabled = false; ctx.globalAlpha = P.gA * cl(s.q * 3); ctx.drawImage(mosaicCanvas, b.l, b.t, w, h); ctx.restore();
    },
  },

  // ================= 待機 =================
  { cat: 'hold', id: 'float', name: '1 文字ずつふわふわ浮かぶ', glyph: (q, g, P) => S({ ty: Math.sin(P.t * 2.2 + g.i * 0.9) * g.px * 0.09 }) },
  { cat: 'hold', id: 'sway', name: '行ごと振り子のように揺れる', glyph: (q, g, P) => { const a = Math.sin(P.t * 1.8) * 0.08, dx = g.cx - P.L.cx; return S({ tx: dx * (Math.cos(a) - 1), ty: dx * Math.sin(a), rot: a }); } },
  {
    cat: 'hold', id: 'shimmer', name: '光の帯が文字を走る', glyph: (q, g, P) => { const L = P.L, xb = L.left + (((P.t * 0.55) % 1.5) - 0.25) * (L.right - L.left); return S({ shine: cl(1 - Math.abs(g.cx - xb) / (g.px * 1.1)) }); },
    paint: (ctx, g, s, P) => { P.fill(ctx, g, s); if (s.shine > 0) P.fill(ctx, g, s, { color: P.light ? P.accent : '#ffffff', alpha: s.shine * 0.85, once: true }); },
  },
  { cat: 'hold', id: 'colorrun', name: '色が 1 文字ずつ流れる', glyph: (q, g, P) => S({ color: ((Math.floor(P.t * 7) - g.i) % P.n + P.n) % P.n < 2 ? P.accent : null }) },
  { cat: 'hold', id: 'spinone', name: '1 文字ずつ順にくるっと回る', glyph: (q, g, P) => { const u = ((P.t % 2.4) - g.i * 0.12) / 0.45; return S({ rot: u > 0 && u < 1 ? oc(u) * Math.PI * 2 : 0 }); } },
  { cat: 'hold', id: 'hop', name: '1 文字ずつ順に跳ねる', glyph: (q, g, P) => { const u = ((P.t % 1.8) - g.i * 0.1) / 0.35; return S({ ty: u > 0 && u < 1 ? -Math.sin(u * Math.PI) * g.px * 0.4 : 0 }); } },
  { cat: 'hold', id: 'heartbeat', name: '鼓動のように 2 回打つ', glyph: (q, g, P) => { const ph = P.t % 1; const k = Math.exp(-ph * 22) + (ph > 0.2 ? 0.7 * Math.exp(-(ph - 0.2) * 22) : 0); return S({ sx: 1 + 0.13 * k, sy: 1 + 0.13 * k }); } },
  { cat: 'hold', id: 'flicker', name: 'ときどき 1 文字ちらつく', glyph: (q, g, P) => S({ a: hash01(Math.floor(P.t * 10), g.i, 5) < 0.07 ? 0.12 : 1 }) },
  { cat: 'hold', id: 'shiver', name: '強くふるえて色が割れる', glyph: (q, g, P) => S({ tx: (hash01(P.step, g.i, 1) - 0.5) * g.px * 0.12, ty: (hash01(P.step, g.i, 2) - 0.5) * g.px * 0.12, split: g.px * 0.05 }) },
  { cat: 'hold', id: 'squash', name: 'つぶれて伸びる（弾力）', glyph: (q, g, P) => { const v = Math.sin(((P.t * 2 - g.i * 0.08) % 1) * Math.PI * 2); return S({ sx: 1 + 0.1 * v, sy: 1 - 0.12 * v, pivot: 0.35 }); } },
  {
    cat: 'hold', id: 'fillswap', name: '塗りと縁取りが入れ替わる', glyph: (q, g, P) => S({ outline: (Math.floor(P.t * 2.5) + g.i) % 2 === 0 }),
    paint: (ctx, g, s, P) => {
      if (!s.outline) { P.fill(ctx, g, s); return; }
      ctx.globalAlpha = P.gA * s.a; ctx.strokeStyle = P.fg; ctx.lineWidth = Math.max(1, g.px * 0.035); ctx.lineJoin = 'round'; ctx.strokeText(g.ch, g.x, g.y);
    },
  },
  { cat: 'hold', id: 'breatheglow', name: '光がゆっくり呼吸する', glyph: (q, g, P) => S({ glow: 0.25 + 0.75 * (0.5 + 0.5 * Math.sin(P.t * 3)) }) },
  // ================= 消え方 =================
  { cat: 'exit', id: 'fadeup', name: '昇りながらぼけて消える', glyph: (q, g) => S({ ty: -oc(q) * g.px * 1.2, a: 1 - q, blur: q * g.px * 0.25 }) },
  { cat: 'exit', id: 'fall', name: '重さで落ちる', dur: 0.9, glyph: (q, g) => S({ ty: ic(q) * g.px * 7, rot: ic(q) * (hash01(g.i, 1) - 0.5) * 3, a: 1 - ic(q) * 0.6 }) },
  { cat: 'exit', id: 'scatter', name: 'ばらばらに散る', glyph: (q, g) => { const r1 = hash01(g.i, 2) - 0.5, r2 = hash01(g.i, 3) - 0.5; return S({ tx: r1 * g.px * 5 * oc(q), ty: r2 * g.px * 5 * oc(q), rot: r1 * 3 * q, a: 1 - q }); } },
  { cat: 'exit', id: 'blow', name: '風に吹き流される', dur: 0.8, glyph: (q, g) => S({ tx: ic(q) * g.px * 8, ty: -q * g.px * hash01(g.i, 4) * 0.8, sx: 1 + q * 1.4, sy: 1 - q * 0.6, a: 1 - q, blur: q * g.px * 0.2 }) },
  { cat: 'exit', id: 'shrink', name: '点に縮んで消える', glyph: q => S({ sx: 1 - ic(q), sy: 1 - ic(q) }) },
  { cat: 'exit', id: 'spinout', name: '回りながら縮む', glyph: (q, g) => S({ rot: ic(q) * Math.PI * 2 * (g.i % 2 ? 1 : -1), sx: 1 - ic(q), sy: 1 - ic(q) }) },
  {
    cat: 'exit', id: 'wipe', name: '光の線がぬぐって消す', stagger: 0, dur: 0.6,
    glyph: (q, g, P) => S({ clipX: P.L.left - P.px * 0.3 + (P.L.right - P.L.left + P.px * 0.6) * oc(P.lineQ) }),
    post: (ctx, P) => {
      const q = P.lineQ; if (!(q > 0 && q < 1)) return;
      const x = P.L.left - P.px * 0.3 + (P.L.right - P.L.left + P.px * 0.6) * oc(q);
      ctx.globalAlpha = P.gA; ctx.fillStyle = P.accent; ctx.fillRect(x - P.px * 0.04, P.L.top - P.px * 0.3, P.px * 0.08, P.L.bottom - P.L.top + P.px * 0.6);
    },
  },
  { cat: 'exit', id: 'glitchout', name: 'グリッチで崩れる', glyph: (q, g, P) => S({ tx: (hash01(P.step, g.i) - 0.5) * g.px * 1.4 * q, a: hash01(P.step, g.i, 8) < 1 - q ? 1 : 0, split: q * g.px * 0.22 }) },
  {
    cat: 'exit', id: 'dissolve', name: '粒になってほどける', dur: 0.8, glyph: q => S({ q }),
    paint: (ctx, g, s, P) => {
      P.fill(ctx, g, s, { alpha: cl(1 - s.q * 1.6) });
      ctx.fillStyle = s.color ?? P.fg;
      for (let k = 0; k < 14; k++) {
        const x = g.x + hash01(g.i, k) * g.w, y = g.y - hash01(g.i, k, 2) * g.px * 0.85 - oc(s.q) * g.px * (0.6 + 1.6 * hash01(k, g.i, 3));
        const sz = g.px * 0.09 * (1 - s.q);
        ctx.globalAlpha = P.gA * (1 - s.q) * cl(s.q * 6); ctx.fillRect(x + (hash01(k, g.i, 4) - 0.5) * g.px * s.q, y, sz, sz);
      }
    },
  },
  {
    cat: 'exit', id: 'splitout', name: '上下に割れて離れる', glyph: q => S({ d: oc(q) * 0.8, a: 1 - q }),
    paint: (ctx, g, s, P) => {
      const b = box(g), mid = g.y - g.px * 0.38, d = s.d * g.px;
      ctx.save(); clipPoly(ctx, [[b.l, b.t - d], [b.r, b.t - d], [b.r, mid - d], [b.l, mid - d]]); P.fill(ctx, g, s, { dy: -d }); ctx.restore();
      ctx.save(); clipPoly(ctx, [[b.l, mid + d], [b.r, mid + d], [b.r, b.b + d], [b.l, b.b + d]]); P.fill(ctx, g, s, { dy: d }); ctx.restore();
    },
  },
  { cat: 'exit', id: 'explode', name: '真ん中から外へはじける', stagger: 0, dur: 0.55, glyph: (q, g, P) => S({ tx: (g.cx - P.L.cx) * oc(q) * 2.5, ty: (hash01(g.i, 6) - 0.5) * g.px * 2 * q, sx: 1 + q * 1.5, sy: 1 + q * 1.5, rot: (hash01(g.i, 7) - 0.5) * q * 2, a: 1 - q }) },
  { cat: 'exit', id: 'stretchup', name: '上へ細く伸びて消える', glyph: q => S({ sy: 1 + ic(q) * 5, sx: 1 - oc(q) * 0.85, a: 1 - ic(q), pivot: 0.35 }) },
  { cat: 'exit', id: 'flipout', name: 'めくれて消える', glyph: q => S({ sy: Math.max(0.01, Math.cos(oc(q) * Math.PI / 2)) }) },
  { cat: 'exit', id: 'sink', name: '床に沈む（切り口あり）', glyph: q => S({ ty: ic(q) * 1.2, mask: true, unit: true }) },
  {
    cat: 'exit', id: 'burn', name: '焼けて崩れる（火の粉）', dur: 0.9, glyph: (q, g, P) => S({ cut: q, color: q > 0.05 ? P.accent : null, q }),
    paint: (ctx, g, s, P) => {
      P.fill(ctx, g, s);
      ctx.fillStyle = P.accent;
      for (let k = 0; k < 8; k++) {
        const u = cl(s.q * 1.3 - hash01(g.i, k) * 0.3);
        if (!(u > 0 && u < 1)) continue;
        ctx.globalAlpha = P.gA * (1 - u);
        star(ctx, g.x + hash01(k, g.i, 5) * g.w, g.y - g.px * 0.95 + s.q * g.px * 1.1 - u * g.px * 1.5, g.px * 0.07);
      }
    },
  },
  { cat: 'exit', id: 'untype', name: '後ろから 1 文字ずつ打ち消す', rev: true, dur: 0.12, stagger: 0.08, glyph: q => (q >= 0.5 ? S({ hide: true }) : S({ sx: 1 + q * 0.6, sy: 1 + q * 0.6 })) },
  { cat: 'exit', id: 'zoompast', name: '手前へ巨大化して抜ける', stagger: 0.02, glyph: (q, g, P) => { const s = 1 + ic(q) * 6; return S({ sx: s, sy: s, tx: (g.cx - P.L.cx) * (s - 1) * 0.5, a: 1 - q, blur: q * g.px * 0.3 }); } },
  { cat: 'exit', id: 'strobe', name: '点滅しながら消える', glyph: q => S({ a: (Math.floor(q * 14) % 2 === 0 ? 1 : 0) * (1 - q * 0.5) }) },
  { cat: 'exit', id: 'slideaway', name: '斜めに流れ去る', glyph: (q, g) => S({ tx: -ic(q) * g.px * 6, skew: -q * 0.7, a: 1 - ic(q) }) },
  { cat: 'exit', id: 'drip', name: '下へ垂れて溶ける', dur: 0.9, glyph: q => S({ sy: 1 + ic(q) * 3, sx: 1 - q * 0.3, pivot: -0.6, a: 1 - q }) },

  // ================= 文字の加工 =================
  {
    cat: 'look', id: 'gradient', name: '上から下へ色が変わる',
    paint: (ctx, g, s, P) => { const gr = ctx.createLinearGradient(0, g.y - g.px * 0.9, 0, g.y + g.px * 0.1); gr.addColorStop(0, P.accent); gr.addColorStop(1, P.fg); P.fill(ctx, g, s, { color: gr }); },
  },
  { cat: 'look', id: 'stripes', name: '斜線で塗る', paint: (ctx, g, s, P) => { P.fill(ctx, g, s, { color: stripePat(ctx, P, P.fg, Math.max(4, Math.round(g.px * 0.14))) }); } },
  { cat: 'look', id: 'halftone', name: '網点の影', paint: (ctx, g, s, P) => { P.fill(ctx, g, s, { color: dotPat(ctx, P.accent, Math.max(3, Math.round(g.px * 0.09))), dx: g.px * 0.1, dy: g.px * 0.1, once: true }); P.fill(ctx, g, s); } },
  {
    cat: 'look', id: 'cut', name: '斜めの切れ目でずれる',
    paint: (ctx, g, s, P) => {
      const b = box(g, 0.3), d = g.px * 0.05;
      ctx.save(); clipPoly(ctx, [[b.l, b.t], [b.r, b.t], [b.r, b.t + (b.b - b.t) * 0.3], [b.l, b.t + (b.b - b.t) * 0.62]]); P.fill(ctx, g, s, { dx: -d }); ctx.restore();
      ctx.save(); clipPoly(ctx, [[b.l, b.t + (b.b - b.t) * 0.66], [b.r, b.t + (b.b - b.t) * 0.34], [b.r, b.b], [b.l, b.b]]); P.fill(ctx, g, s, { dx: d }); ctx.restore();
    },
  },
  {
    cat: 'look', id: 'offsetline', name: '塗りと縁がずれる',
    paint: (ctx, g, s, P) => { P.fill(ctx, g, s, { color: P.accent, dx: g.px * 0.07, dy: g.px * 0.06, once: true }); ctx.globalAlpha = P.gA * s.a; ctx.strokeStyle = P.fg; ctx.lineWidth = Math.max(1, g.px * 0.035); ctx.lineJoin = 'round'; ctx.strokeText(g.ch, g.x, g.y); },
  },
  {
    cat: 'look', id: 'box', name: '1 文字ずつ四角で囲む',
    paint: (ctx, g, s, P) => { if (g.ch.trim()) { ctx.globalAlpha = P.gA * s.a; ctx.strokeStyle = P.accent; ctx.lineWidth = g.px * 0.045; ctx.strokeRect(g.x - g.px * 0.04, g.y - g.px * 0.9, g.w + g.px * 0.08, g.px * 1.04); } P.fill(ctx, g, s); },
  },
  {
    cat: 'look', id: 'underline', name: '太い下線',
    pre: (ctx, P) => { ctx.globalAlpha = P.gA; ctx.fillStyle = P.accent; ctx.fillRect(P.L.left - P.px * 0.1, P.L.base + P.px * 0.06, P.L.right - P.L.left + P.px * 0.2, P.px * 0.16); },
  },
  {
    cat: 'look', id: 'mirror', name: '下に逆さの映り込み',
    paint: (ctx, g, s, P) => {
      P.fill(ctx, g, s);
      ctx.save(); ctx.translate(0, (g.y + g.px * 0.12) * 2); ctx.scale(1, -1); P.fill(ctx, g, s, { alpha: 0.22, once: true }); ctx.restore();
    },
  },
  {
    cat: 'look', id: 'neontube', name: 'ネオン管（縁が強く光る）',
    paint: (ctx, g, s, P) => {
      P.fill(ctx, g, s, { color: P.accent, alpha: 0.28, once: true });
      ctx.save(); ctx.globalAlpha = P.gA * s.a; ctx.lineJoin = 'round'; ctx.strokeStyle = P.accent;
      if (!P.lite) { ctx.shadowColor = P.accent; ctx.shadowBlur = g.px * 0.6; }
      ctx.lineWidth = g.px * 0.09; ctx.strokeText(g.ch, g.x, g.y);
      ctx.shadowBlur = 0; ctx.strokeStyle = P.light ? P.fg : '#ffffff'; ctx.lineWidth = Math.max(1, g.px * 0.03); ctx.strokeText(g.ch, g.x, g.y);
      ctx.restore();
    },
  },
  { cat: 'look', id: 'chroma3', name: 'いつも赤と青が少しずれる', glyph: (q, g) => S({ split: g.px * 0.05 }) },
  {
    cat: 'look', id: 'stencil', name: '型抜き（横の切れ目）',
    paint: (ctx, g, s, P) => {
      const b = box(g, 0.2), h = b.b - b.t;
      ctx.save(); ctx.beginPath();
      [[0, 0.33], [0.39, 0.6], [0.66, 1]].forEach(([a, c]) => ctx.rect(b.l, b.t + h * a, b.r - b.l, h * (c - a)));
      ctx.clip(); P.fill(ctx, g, s); ctx.restore();
    },
  },
  {
    cat: 'look', id: 'sticker', name: 'シール（太い白縁）',
    paint: (ctx, g, s, P) => {
      ctx.save(); ctx.globalAlpha = P.gA * s.a; ctx.lineJoin = 'round';
      ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowOffsetY = g.px * 0.05; ctx.shadowBlur = g.px * 0.08;
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = g.px * 0.24; ctx.strokeText(g.ch, g.x, g.y); ctx.restore();
      P.fill(ctx, g, s, { color: P.accent });
    },
  },
  {
    cat: 'look', id: 'emboss', name: '浮き彫り',
    paint: (ctx, g, s, P) => { const d = g.px * 0.035; P.fill(ctx, g, s, { color: 'rgba(0,0,0,.6)', dx: d, dy: d, once: true }); P.fill(ctx, g, s, { color: 'rgba(255,255,255,.75)', dx: -d, dy: -d, once: true }); P.fill(ctx, g, s, { color: P.accent }); },
  },

  // ================= 強調語のキメ（強調語が出た瞬間） =================
  {
    cat: 'kime', id: 'flash', name: '白く光って輪が抜ける', glyph: (q, g) => S({ color: q < 0.18 ? '#ffffff' : null, sx: 1 + 0.25 * (1 - oc(q)), sy: 1 + 0.25 * (1 - oc(q)), glow: q < 0.4 ? 1 - q / 0.4 : 0 }),
    post: (ctx, P, q) => { const E = P.E; ctx.globalAlpha = P.gA * (1 - q) ** 2 * 0.8; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = P.px * 0.08 * (1 - q); ctx.beginPath(); ctx.arc(E.cx, E.cy, (E.r + P.px) * (0.6 + oc(q) * 1.6), 0, Math.PI * 2); ctx.stroke(); },
  },
  {
    cat: 'kime', id: 'burst', name: '放射線が飛び出す',
    pre: (ctx, P, q) => {
      const E = P.E; ctx.globalAlpha = P.gA * (1 - q); ctx.strokeStyle = P.accent; ctx.lineWidth = P.px * 0.06; ctx.lineCap = 'round';
      for (let k = 0; k < 18; k++) {
        const a = k / 18 * Math.PI * 2 + 0.2, r0 = E.r * (0.9 + 0.5 * oc(q)), r1 = r0 + P.px * (0.6 + 1.6 * hash01(k, 3)) * oc(q * 1.4);
        ctx.beginPath(); ctx.moveTo(E.cx + Math.cos(a) * r0, E.cy + Math.sin(a) * r0); ctx.lineTo(E.cx + Math.cos(a) * r1, E.cy + Math.sin(a) * r1); ctx.stroke();
      }
    },
  },
  {
    cat: 'kime', id: 'ring', name: '輪が 2 重に広がる',
    post: (ctx, P, q) => {
      const E = P.E;
      for (const [d, c] of [[0, P.accent], [0.18, P.fg]]) {
        const k = cl((q - d) / 0.8); if (!(k > 0 && k < 1)) continue;
        ctx.globalAlpha = P.gA * (1 - k); ctx.strokeStyle = c; ctx.lineWidth = P.px * 0.07 * (1 - k) + 0.5;
        ctx.beginPath(); ctx.arc(E.cx, E.cy, E.r * 0.8 + oc(k) * P.px * 2.6, 0, Math.PI * 2); ctx.stroke();
      }
    },
  },
  {
    cat: 'kime', id: 'invertbox', name: '色の箱が伸びて抜き文字', glyph: (q, g, P) => S({ color: q > 0.25 ? P.bg : null }),
    pre: (ctx, P, q) => { const E = P.E; ctx.globalAlpha = P.gA; ctx.fillStyle = P.accent; ctx.fillRect(E.left - P.px * 0.15, E.top - P.px * 0.1, (E.right - E.left + P.px * 0.3) * oc(q * 3), E.bottom - E.top + P.px * 0.2); },
  },
  { cat: 'kime', id: 'shake', name: '強調語だけ激しく揺れて止まる', glyph: (q, g, P) => S({ tx: (hash01(P.step, g.i) - 0.5) * g.px * 0.45 * (1 - q), ty: (hash01(P.step, g.i, 1) - 0.5) * g.px * 0.45 * (1 - q), rot: (hash01(P.step, g.i, 2) - 0.5) * 0.4 * (1 - q) }) },
  { cat: 'kime', id: 'giant', name: '画面いっぱいから元の大きさへ', glyph: (q, g, P) => { const s = 1 + 3.2 * (1 - oc(q * 1.3)); return S({ sx: s, sy: s, tx: (g.cx - P.E.cx) * (s - 1), ty: (g.cy - P.E.cy) * (s - 1), a: cl(q * 8) }); } },
  {
    cat: 'kime', id: 'sparkle', name: 'まわりで星がまたたく',
    post: (ctx, P, q) => {
      const E = P.E; ctx.fillStyle = P.light ? P.accent : '#ffffff';
      for (let k = 0; k < 7; k++) {
        const u = cl((q * 1.2 - hash01(k, 1) * 0.4) / 0.6); if (!(u > 0 && u < 1)) continue;
        const a = hash01(k, 2) * Math.PI * 2, r = E.r * (0.8 + 0.6 * hash01(k, 3)) + P.px * 0.3;
        ctx.globalAlpha = P.gA * Math.sin(u * Math.PI); star(ctx, E.cx + Math.cos(a) * r * 1.4, E.cy + Math.sin(a) * r * 0.8, P.px * (0.22 + 0.28 * hash01(k, 4)) * Math.sin(u * Math.PI));
      }
    },
  },
  {
    cat: 'kime', id: 'swoosh', name: '筆の下線がシュッと引かれる',
    pre: (ctx, P, q) => {
      const E = P.E, k = oc(q * 2.2), x0 = E.left - P.px * 0.3, x1 = x0 + (E.right - E.left + P.px * 0.6) * k, y = E.bottom - P.px * 0.05;
      if (!(k > 0)) return;
      ctx.globalAlpha = P.gA * 0.95; ctx.fillStyle = P.accent;
      ctx.beginPath(); ctx.moveTo(x0, y); ctx.quadraticCurveTo((x0 + x1) / 2, y + P.px * 0.5, x1, y - P.px * 0.1); ctx.quadraticCurveTo((x0 + x1) / 2, y + P.px * 0.12, x0, y); ctx.fill();
    },
  },
  { cat: 'kime', id: 'colorflip', name: '強調語だけ色がチカチカ変わる', glyph: (q, g, P) => S({ color: q < 0.6 ? (Math.floor(q * 16) % 2 ? P.accent : P.fg) : P.accent }) },
  {
    cat: 'kime', id: 'echostack', name: '後ろに写しが段々に重なる', glyph: q => S({ q }),
    paint: (ctx, g, s, P) => { const k = oc(s.q); for (let j = 4; j >= 1; j--) P.fill(ctx, g, s, { color: P.accent, dx: -j * g.px * 0.09 * k, dy: -j * g.px * 0.09 * k, alpha: 0.5 * (1 - j / 5), once: true }); P.fill(ctx, g, s); },
  },
  { cat: 'kime', id: 'split', name: '赤と青に大きく割れて戻る', glyph: (q, g) => S({ split: (1 - oc(q)) * g.px * 0.5 }) },

  // ================= 境目の一瞬（文字に掛かる） =================
  { cat: 'hit', id: 'scramble', name: '一瞬文字化けする', glyph: (q, g, P) => S({ ch: q > 0.25 ? scr(P, g, 2) : null }) },
  { cat: 'hit', id: 'blink', name: '行がチカチカ点滅', glyph: (q, g, P) => S({ a: q > 0 && Math.floor(P.t * 30) % 2 ? 0.08 : 1 }) },
  { cat: 'hit', id: 'mirror', name: '一瞬左右が反転', glyph: (q, g, P) => (q > 0.35 ? S({ sx: -1, tx: (P.L.cx - g.cx) * 2 }) : S({})) },
  {
    cat: 'hit', id: 'slicetext', name: '文字が横に裂けてずれる', glyph: q => S({ q }),
    paint: (ctx, g, s, P) => {
      if (!(s.q > 0)) { P.fill(ctx, g, s); return; }
      const b = box(g, 0.6), h = b.b - b.t;
      for (let k = 0; k < 4; k++) {
        ctx.save(); ctx.beginPath(); ctx.rect(b.l - g.px, b.t + h * k / 4, b.r - b.l + g.px * 2, h / 4); ctx.clip();
        P.fill(ctx, g, s, { dx: (hash01(P.step, k, g.i) - 0.5) * g.px * 0.8 * s.q }); ctx.restore();
      }
    },
  },
  {
    cat: 'hit', id: 'zoomblur', name: '文字だけ放射状にぶれる', glyph: q => S({ q }),
    paint: (ctx, g, s, P) => {
      P.fill(ctx, g, s);
      for (let j = 1; j <= 5 && s.q > 0; j++) {
        const k = 1 + j * 0.07 * s.q;
        ctx.save(); ctx.translate(P.L.cx, P.L.cy); ctx.scale(k, k); ctx.translate(-P.L.cx, -P.L.cy); P.fill(ctx, g, s, { alpha: 0.28 * s.q, once: true }); ctx.restore();
      }
    },
  },
  {
    cat: 'hit', id: 'band', name: '色の帯が文字の後ろを走る',
    pre: (ctx, P, q) => { if (!(q > 0)) return; const L = P.L, w = L.right - L.left + P.px; const x = L.left - P.px * 0.5 + w * (1 - q) - w * 0.3; ctx.globalAlpha = P.gA; ctx.fillStyle = P.accent; ctx.fillRect(Math.max(L.left - P.px * 0.5, x), L.top - P.px * 0.15, Math.min(w * 0.6, w), L.bottom - L.top + P.px * 0.3); },
  },
  { cat: 'hit', id: 'wide', name: '一瞬横に伸びる', glyph: (q, g, P) => { const s = 1 + 0.6 * q; return S({ sx: s, sy: 1 - 0.3 * q, tx: (g.cx - P.L.cx) * (s - 1) }); } },
  { cat: 'hit', id: 'ghost', name: '横にぶれの写しが出る', glyph: q => S({ q }), paint: (ctx, g, s, P) => { for (let j = 3; j >= 1 && s.q > 0; j--) P.fill(ctx, g, s, { dx: -j * g.px * 0.22 * s.q, alpha: 0.3 / j, once: true }); P.fill(ctx, g, s); } },
  {
    cat: 'hit', id: 'negative', name: '一瞬だけ箱に抜き文字', glyph: (q, g, P) => S({ color: q > 0 ? P.bg : null }),
    pre: (ctx, P, q) => { if (!(q > 0)) return; const L = P.L; ctx.globalAlpha = P.gA; ctx.fillStyle = P.fg; ctx.fillRect(L.left - P.px * 0.2, L.top - P.px * 0.1, L.right - L.left + P.px * 0.4, L.bottom - L.top + P.px * 0.2); },
  },
];

/** 種類ごとの id → 演出 */
export const TEXT_FX = Object.fromEntries(Object.keys(CATS).map(c => [c, Object.fromEntries(FX.filter(f => f.cat === c).map(f => [f.id, f]))]));
/** 種類 cat の id の演出（無ければ null） */
export const fxOf = (cat, id) => (id && TEXT_FX[cat]?.[id]) || null;
