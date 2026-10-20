// 空間の飾り（雰囲気 S）の共通の道具。飾りは画面ではなく世界に固定して置き、カメラの project で映す。
// こうすると、カメラが動いたとき近い物は速く・遠い物は遅く流れる（視差）。
import { forwardOf } from '../camera.js';

const fract = x => x - Math.floor(x);

/**
 * 一辺 cell の箱を世界に隙間なく敷き詰めたとき、箱の中の点 base（0〜1 の割合）の写しのうち、
 * カメラの前（前方へ ahead 進んだ所）を中心とする箱に入るものを返す。
 * edge は中心からの離れ具合（0 = 中心、1 = 箱の端）。端の近くで薄くして、写しが入れ替わるときに突然現れないようにする。
 * @returns {{p:number[], edge:number}}
 */
export function tileNear(cam, base, cell, ahead) {
  const f = forwardOf(cam);
  const c = [0, 1, 2].map(k => cam.pos[k] + f[k] * ahead);
  let edge = 0;
  const p = [0, 1, 2].map(k => {
    const lo = c[k] - cell / 2;
    const v = lo + fract((base[k] * cell - lo) / cell) * cell; // c[k] ± cell/2 に入る写し
    edge = Math.max(edge, Math.abs(v - c[k]) / (cell / 2));
    return v;
  });
  return { p, edge };
}

/** 箱の端で 0、内側 (1 - band) より中では 1 */
export const edgeFade = (edge, band = 0.3) => Math.min(1, Math.max(0, (1 - edge) / band));

/** 黒地は光を足し合わせる明るい線、白地は薄い墨の線 */
export function inkOrPaper(ctx, env, colorIndex) {
  if (env.tone === 'paper' || env.ink?.light) { ctx.globalCompositeOperation = 'source-over'; return { color: env.ink?.fg ?? '#101010', gain: 0.45 }; }
  if (env.tone === 'color') { ctx.globalCompositeOperation = 'lighter'; return { color: '#ffffff', gain: 0.6 }; } // 暗めの色地は白い光
  ctx.globalCompositeOperation = 'lighter';
  return { color: env.colors?.[colorIndex] ?? '#ffffff', gain: 1 };
}

/**
 * 世界の点の列を、映せる区間だけ線でつなぐ（カメラの後ろに回った区間は切る）。
 * 濃さ alphaOf(i)（区間 i〜i+1 の濃さ）を BANDS 段に丸めて、段ごとに1回だけ stroke する（線の数が多くても軽い）。
 */
const BANDS = 6;
export function strokeWorld(ctx, env, paths, alphaOf, maxAlpha) {
  const buckets = Array.from({ length: BANDS }, () => []);
  paths.forEach((pts, pi) => {
    let prev = env.project(pts[0]);
    for (let i = 1; i < pts.length; i++) {
      const cur = env.project(pts[i]);
      if (prev && cur) {
        const a = alphaOf(pi, i - 1);
        const b = Math.min(BANDS, Math.round(a * BANDS));
        if (b > 0) buckets[b - 1].push(prev, cur);
      }
      prev = cur;
    }
  });
  buckets.forEach((segs, b) => {
    if (segs.length === 0) return;
    ctx.globalAlpha = maxAlpha * (b + 1) / BANDS;
    ctx.beginPath();
    for (let i = 0; i < segs.length; i += 2) { ctx.moveTo(segs[i].x, segs[i].y); ctx.lineTo(segs[i + 1].x, segs[i + 1].y); }
    ctx.stroke();
  });
}
