// 世界の背景（fx.world）の共通の道具。世界ごとの形は calm.js・loud.js・mid.js にある。
// 描く関数は (ctx, k) を受け取る。k = { t, w, h, s（短辺）, lw（細い線の太さ）, ink, env, beatK（拍の頭で 1→0）, i（強さ）, lite, cam（映せるカメラ or null） }
import { tileNear, edgeFade } from '../space-common.js';

export const fract = x => x - Math.floor(x);
export { edgeFade };

/** 世界の点を画面へ（映せなければ null） */
export const P = (k, p) => (k.cam ? k.env.project(p) : null);

/** 世界の点の列を線でつなぐ（映せない点で切る） */
export function strokePath(ctx, k, pts, closed = false) {
  if (!k.cam) return;
  ctx.beginPath();
  let pen = false, first = null;
  for (const p of pts) {
    const q = P(k, p);
    if (!q) { pen = false; continue; }
    if (!first) first = q;
    if (pen) ctx.lineTo(q.x, q.y); else ctx.moveTo(q.x, q.y);
    pen = true;
  }
  if (closed && first && pen) ctx.lineTo(first.x, first.y);
  ctx.stroke();
}

/** 世界の点の列を、今の線の道に足す（beginPath・stroke は呼ぶ側で。同じ色・太さの線をまとめて 1 回で描くため） */
export function addPath(ctx, k, pts) {
  if (!k.cam) return;
  let pen = false;
  for (const p of pts) {
    const q = P(k, p);
    if (!q) { pen = false; continue; }
    if (pen) ctx.lineTo(q.x, q.y); else ctx.moveTo(q.x, q.y);
    pen = true;
  }
}

/** 世界の点の多角形を塗る（1 点でも映せなければ描かない） */
export function fillPoly(ctx, k, pts) {
  if (!k.cam) return false;
  const qs = pts.map(p => P(k, p));
  if (qs.some(q => !q)) return false;
  ctx.beginPath();
  qs.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
  ctx.closePath();
  ctx.fill();
  return true;
}

/**
 * カメラのまわりに、世界に固定した物を n 個敷く（一辺 cell の箱を繰り返す。tileNear）。
 * each(p, a, j)：p は世界の置き場所、a は箱の端で薄くなる濃さ（0〜1）、j は番号
 */
export function scatter(k, n, cell, ahead, salt, hash, each) {
  if (!k.cam) return;
  const m = k.lite ? Math.ceil(n / 2) : n;
  for (let j = 0; j < m; j++) {
    const base = [hash(salt, j, 1), hash(salt, j, 2), hash(salt, j, 3)];
    const { p, edge } = tileNear(k.cam, base, cell, ahead);
    const a = edgeFade(edge, 0.35);
    if (a > 0) each(p, a, j);
  }
}

/** 画面に貼る縦の色の移り変わり（上の色 → 下の色） */
export function vGrad(ctx, k, top, bottom) {
  const g = ctx.createLinearGradient(0, 0, 0, k.h);
  g.addColorStop(0, top);
  g.addColorStop(1, bottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, k.w, k.h);
}

/** 画面の円（線） */
export function ring(ctx, x, y, r) {
  if (!(r > 0)) return;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
}
/** 画面の円（塗り） */
export function dot(ctx, x, y, r) {
  if (!(r > 0)) return;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}
