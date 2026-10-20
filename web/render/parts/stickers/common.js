// 文字のあとに貼る飾り（ステッカー・ロゴ風・吹き出し・手描きの記号・紙もの）の共通の道具。
// 飾りは「貼る場所の真ん中」を原点に描く。長さの単位は S.u（1 つの飾りの大きさ。文字の大きさに比例）。
// S = { u, t（貼ってからの秒）, q（現れる動きの進み 0→1）, f（線が描かれる進み 0→1）, b（拍の頭で 1→0）,
//       w・h（場所が言葉や行の上のとき、その外枠の幅と高さ）, word（飾りに組む言葉）, font（書体）,
//       c1・c2・c3（場面の色）, ink（飾りの輪郭の色）, paper（シールの白い縁）, fg・bg・light, seed, r(k)（飾りごとの決まった乱数） }
import { hash01 } from '../../rand.js';

export const TAU = Math.PI * 2;
export const cl = x => Math.max(0, Math.min(1, x));
export const oc = x => 1 - Math.pow(1 - cl(x), 3);
export const ic = x => Math.pow(cl(x), 3);
/** 行き過ぎて戻る（0→1 で、途中 1.1 ほどまで出る） */
export const ob = x => { const c = 1.9, v = cl(x) - 1; return 1 + (c + 1) * v * v * v + c * v * v; };

/** 手描きのゆらぎ：1 秒に 8 回だけ描き直す揺れ（アニメの線がふるえる感じ）。i ごとに違う値、-amp〜amp */
export const boil = (S, i, amp) => (hash01(S.seed, Math.floor(S.t * 8), i) - 0.5) * 2 * amp;

/** 点の並びで線を引く（閉じるかどうか） */
export function poly(ctx, pts, close = true) {
  ctx.beginPath();
  pts.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  if (close) ctx.closePath();
}
/** 角の丸い四角 */
export function rrect(ctx, x, y, w, h, r) {
  const rr = Math.max(0, Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}
/** 星形の点（n 個のとがり、外の半径 r1・内の半径 r2） */
export function starPts(n, r1, r2, rot = -Math.PI / 2) {
  const out = [];
  for (let k = 0; k < n * 2; k++) { const a = rot + k * Math.PI / n, r = k % 2 ? r2 : r1; out.push([Math.cos(a) * r, Math.sin(a) * r]); }
  return out;
}
/** だ円の上の点（a0〜a1 を n 区切り） */
export function arcPts(cx, cy, rx, ry, a0, a1, n) {
  const out = [];
  for (let k = 0; k <= n; k++) { const a = a0 + (a1 - a0) * k / n; out.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]); }
  return out;
}
/** ハートの形 */
export function heartPath(ctx, s) {
  ctx.beginPath();
  ctx.moveTo(0, s * 0.95);
  ctx.bezierCurveTo(-s * 1.25, s * 0.15, -s * 1.05, -s * 0.95, 0, -s * 0.42);
  ctx.bezierCurveTo(s * 1.05, -s * 0.95, s * 1.25, s * 0.15, 0, s * 0.95);
  ctx.closePath();
}

/**
 * シール：白い縁で切り抜いた形。影 → 白い縁 → 塗り → 輪郭の順に描く。
 * build(ctx) が形の道を作る。fill は塗りの色（無ければ白のまま）
 */
export function die(ctx, S, build, fill, o = {}) {
  const u = S.u, bw = (o.border ?? 0.14) * u;
  ctx.save();
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const a = ctx.globalAlpha;
  ctx.save();
  ctx.translate(u * 0.05, u * 0.09);
  build(ctx);
  ctx.globalAlpha = a * 0.28; ctx.fillStyle = '#000'; ctx.strokeStyle = '#000'; ctx.lineWidth = bw * 2;
  ctx.stroke(); ctx.fill();
  ctx.restore();
  ctx.globalAlpha = a;
  build(ctx);
  ctx.lineWidth = bw * 2; ctx.strokeStyle = S.paper; ctx.fillStyle = S.paper;
  ctx.stroke(); ctx.fill();
  if (fill) { build(ctx); ctx.fillStyle = fill; ctx.fill(); }
  if (o.ink !== false) { build(ctx); ctx.lineWidth = u * (o.inkW ?? 0.05); ctx.strokeStyle = S.ink; ctx.stroke(); }
  ctx.restore();
}

/** 言葉を置く（幅 maxW に収まるよう縮める）。o.stroke で縁取り、o.align で寄せ */
export function label(ctx, S, text, x, y, size, color, maxW = Infinity, o = {}) {
  const s = String(text ?? '');
  if (!s || !(size > 0.5)) return 0;
  ctx.font = `${o.weight ?? S.weight ?? '700'} ${size}px ${S.font}`;
  const w = ctx.measureText(s).width;
  const k = w > maxW && maxW > 0 ? maxW / w : 1;
  ctx.save();
  ctx.translate(x, y);
  if (S.mirror) ctx.scale(-1, 1); // 飾りが左右反転していても文字は正しい向き
  if (k < 1) ctx.scale(k, k);
  ctx.textAlign = o.align ?? 'center';
  ctx.textBaseline = 'middle';
  if (o.stroke) { ctx.lineJoin = 'round'; ctx.lineWidth = o.strokeW ?? size * 0.22; ctx.strokeStyle = o.stroke; ctx.strokeText(s, 0, size * 0.04); }
  ctx.fillStyle = color;
  ctx.fillText(s, 0, size * 0.04);
  ctx.restore();
  return w * k;
}
/** 言葉の幅（縮める前） */
export function measure(ctx, S, text, size, weight) {
  ctx.font = `${weight ?? S.weight ?? '700'} ${size}px ${S.font}`;
  return ctx.measureText(String(text ?? '')).width;
}

/** 線の頭から割合 f までを残す（2 次元） */
export function trim(pts, f) {
  if (f >= 1) return pts;
  if (!(f > 0) || pts.length < 2) return [];
  const segs = pts.length - 1, x = f * segs, k = Math.floor(x), v = x - k;
  const out = pts.slice(0, k + 1);
  if (k < segs && v > 0) { const a = pts[k], b = pts[k + 1]; out.push([a[0] + (b[0] - a[0]) * v, a[1] + (b[1] - a[1]) * v]); }
  return out;
}
/** 手描きの線：点にゆらぎを足し、f まで描く。太さは u 単位 */
export function hand(ctx, S, pts, f, width, color, k = 0) {
  const p = trim(pts, f);
  if (p.length < 2) return;
  const amp = S.u * 0.025;
  ctx.save();
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.strokeStyle = color; ctx.lineWidth = S.u * width;
  ctx.beginPath();
  p.forEach(([x, y], i) => { const X = x + boil(S, k * 97 + i * 2, amp), Y = y + boil(S, k * 97 + i * 2 + 1, amp); if (i) ctx.lineTo(X, Y); else ctx.moveTo(X, Y); });
  ctx.stroke();
  ctx.restore();
}
/** 4 つのとがりのキラキラ（塗り） */
export function sparkle(ctx, x, y, r, color) {
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.quadraticCurveTo(x, y, x, y + r);
  ctx.quadraticCurveTo(x, y, x - r, y);
  ctx.quadraticCurveTo(x, y, x, y - r);
  ctx.fillStyle = color; ctx.fill();
}
/** 言葉の文字を 1 文字ずつに（縦組み・切り抜き文字に使う） */
export const charsOf = s => Array.from(String(s ?? ''));
