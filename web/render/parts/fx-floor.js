// 飾り（雰囲気 S）：文字の雲の下に敷いた、線の床。世界に固定した格子を、カメラのまわりにだけ描く。
// 遠いほど薄く消え、拍の頭でカメラの足もとから明るい輪が外へ広がる。カメラが回り込むと床の傾きで向きが分かる。
import { clamp01 } from '../timing.js';
import { inkOrPaper, strokeWorld } from './space-common.js';

const FLOOR_Y = 1.6;   // 床の高さ（y は下が +。文字の雲は ±1.5 くらいまで）
const GAP = 0.7;       // 格子の間隔
const RADIUS = 8;      // カメラからこの距離まで描く
const SEG = 0.4;       // 線を区切る長さ（区切りごとに濃さを変え、カメラの後ろに回った所を切る）

export function fxFloor(ctx, t, layer, scene, env) {
  const { width: w, height: h, cam, beat } = env;
  if (!(w > 0 && h > 0) || !cam?.pos || typeof env.project !== 'function') return;
  const intensity = clamp01(env.intensity);
  const cx = cam.pos[0], cz = cam.pos[2];
  if (!Number.isFinite(cx) || !Number.isFinite(cz)) return;
  const step = env.lite ? 2 : 1; // 軽い版は1本おき
  const paths = [];
  const n = Math.ceil(RADIUS / GAP);
  const x0 = Math.round(cx / GAP), z0 = Math.round(cz / GAP);
  const segs = Math.ceil((2 * RADIUS) / SEG);
  for (let k = -n; k <= n; k += step) {
    const along = [], across = [];
    for (let i = 0; i <= segs; i++) {
      const d = -RADIUS + i * SEG;
      along.push([(x0 + k) * GAP, FLOOR_Y, cz + d]);  // 奥へ伸びる線
      across.push([cx + d, FLOOR_Y, (z0 + k) * GAP]); // 横に伸びる線
    }
    paths.push(along, across);
  }
  // 拍の頭で、カメラの足もとから外へ広がる明るい輪
  const phase = beat?.index >= 0 ? beat.phase : 1;
  const wave = RADIUS * phase;
  const alphaOf = (pi, i) => {
    const a = paths[pi][i], b = paths[pi][i + 1];
    const d = Math.hypot((a[0] + b[0]) / 2 - cx, (a[2] + b[2]) / 2 - cz);
    const fall = clamp01(1 - d / RADIUS);
    const ring = (1 - phase) * Math.exp(-(((d - wave) / 0.8) ** 2)) * intensity;
    return clamp01(Math.pow(fall, 1.5) * 0.7 + ring * fall);
  };
  const { color, gain } = inkOrPaper(ctx, env, 1);
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(0.75, Math.min(w, h) * 0.0025);
  strokeWorld(ctx, env, paths, alphaOf, gain * (0.7 + 0.3 * intensity));
}
