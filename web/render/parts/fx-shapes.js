// 飾り（雰囲気 S）：遠くに浮かぶ大きな線の図形（輪・二重の輪・三角・四角・六角）。世界に固定して、ゆっくり回る。
// 文字より奥に描き、遠いので、カメラが動いてもゆっくり流れる（近い文字との速さの差で奥行きが出る）。
import { hash01 } from '../rand.js';
import { clamp01 } from '../timing.js';
import { rotate } from '../camera.js';
import { tileNear, edgeFade, inkOrPaper, strokeWorld } from './space-common.js';

const CELL = 18;    // 図形を敷き詰める箱の一辺
const AHEAD = 8;    // 箱の中心をカメラの前方へ進める距離
const COUNT = 7;    // 1つの箱の図形の数
const MIN_DZ = 3;   // これより近い図形は描かない（文字にかぶらない）
const KINDS = [64, 64, 3, 4, 6]; // 頂点の数（64 は輪。2番目は二重の輪）

export function fxShapes(ctx, t, layer, scene, env) {
  const { width: w, height: h, cam, beat } = env;
  if (!(w > 0 && h > 0) || !cam?.pos || typeof env.project !== 'function') return;
  const intensity = clamp01(env.intensity);
  const pulse = 1 + 0.06 * (1 - (beat?.index >= 0 ? beat.phase : 1)) * intensity;
  const paths = [], alphas = [];
  const count = env.lite ? Math.ceil(COUNT / 2) : COUNT;
  for (let i = 0; i < count; i++) {
    const { p, edge } = tileNear(cam, [hash01(i, 21), hash01(i, 22), hash01(i, 23)], CELL, AHEAD);
    const c = env.project(p);
    if (!c || c.dz < MIN_DZ) continue;
    const fade = edgeFade(edge, 0.35) * clamp01((c.dz - MIN_DZ) / 2) * clamp01(1 - (c.dz - CELL * 0.5) / (CELL * 0.6));
    if (!(fade > 0.02)) continue;
    const kind = Math.floor(hash01(i, 24) * KINDS.length);
    const sides = KINDS[kind];
    const radius = (1.2 + 2.2 * hash01(i, 25)) * pulse;
    const spin = (hash01(i, 26) - 0.5) * 0.3; // 1秒に回る角度（ラジアン）
    const rot = { yaw: hash01(i, 27) * Math.PI, pitch: (hash01(i, 28) - 0.5) * 1.2, roll: hash01(i, 29) * Math.PI + spin * t };
    const rings = kind === 1 ? [1, 0.82] : [1];
    for (const k of rings) {
      const pts = [];
      for (let v = 0; v <= sides; v++) {
        const a = (v / sides) * Math.PI * 2;
        const d = rotate([Math.cos(a) * radius * k, Math.sin(a) * radius * k, 0], rot);
        pts.push([p[0] + d[0], p[1] + d[1], p[2] + d[2]]);
      }
      // 多角形は辺を区切って、カメラに近い所が切れても残りを描けるようにする
      paths.push(sides >= 64 ? pts : pts.flatMap((q, v) => (v === 0 ? [q] : [0.25, 0.5, 0.75, 1].map(f => q.map((x, j) => pts[v - 1][j] + (x - pts[v - 1][j]) * f)))));
      alphas.push(fade);
    }
  }
  if (paths.length === 0) return;
  const { color, gain } = inkOrPaper(ctx, env, 1);
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(0.5, Math.min(w, h) * 0.0022);
  strokeWorld(ctx, env, paths, pi => alphas[pi], gain * (0.45 + 0.35 * intensity));
}
