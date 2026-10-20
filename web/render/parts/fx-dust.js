// 飾り（雰囲気 S）：空間に浮かぶちり。粒は世界に固定してあり、カメラの前に隙間なく敷き詰める（tileNear）。
// 近い粒は大きく・ぼけて・速く流れ、遠い粒は小さく・遅く流れる。カメラが速く動くと、粒が動いた向きに伸びて線になる。
// layer.near が true なら文字より手前（行を見る距離 viewDist より近い粒）だけ、そうでなければ奥の粒だけを描く
// （台本係は、奥を文字の前に・手前を文字のあとに置く。手前の粒が文字の前を横切る）。
import { hash01 } from '../rand.js';
import { clamp01 } from '../timing.js';
import { project } from '../camera.js';
import { tileNear, edgeFade, inkOrPaper } from './space-common.js';

const CELL = 5;          // 粒を敷き詰める箱の一辺（世界の単位。短辺 = 1）
const AHEAD = 2.2;       // 箱の中心を、カメラの前方へこれだけ進めた所に置く
const BASE_COUNT = 90;   // 強さ 0 の粒の数。強さ 1 で 150
const SHUTTER = 1 / 30;  // 粒を伸ばす時間の幅（秒）
const SOFT_DZ = 0.7;     // これより近い粒は、ぼけた光の丸で描く

export function fxDust(ctx, t, layer, scene, env) {
  const { width: w, height: h, cam, beat } = env;
  if (!(w > 0 && h > 0) || !cam?.pos) return;
  const intensity = clamp01(env.intensity);
  const short = Math.min(w, h);
  const full = Math.round(BASE_COUNT + 60 * intensity);
  const count = env.lite ? Math.round(full / 2) : full;
  const near = !!layer.near;
  const split = env.viewDist ?? 1.2;
  // 少し前の時刻のカメラ（拡大は今と同じにする。拍の拡大で粒が伸びないように）
  const before = typeof env.camAt === 'function' ? env.camAt(t - SHUTTER) : null;
  const prevCam = before ? { ...before, zoom: cam.zoom } : null;
  const pulse = 1 + 0.5 * (1 - (beat?.index >= 0 ? beat.phase : 1)) * intensity;
  const { color, gain } = inkOrPaper(ctx, env, 1);
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  for (let i = 0; i < count; i++) {
    const { p, edge } = tileNear(cam, [hash01(i, 11), hash01(i, 12), hash01(i, 13)], CELL, AHEAD);
    const s = project(cam, p, env);
    if (!s || (s.dz < split) !== near) continue;
    const fog = clamp01(1 - (s.dz - 1) / (CELL * 0.6)); // 遠いほど薄い
    const a = gain * edgeFade(edge) * (0.35 + 0.65 * fog) * (0.55 + 0.45 * hash01(i, 14)) * pulse;
    if (!(a > 0.01)) continue;
    const r = Math.min(short * 0.06, (0.006 + 0.014 * hash01(i, 15)) * s.scale * short);
    if (s.dz < SOFT_DZ) { // 近すぎる粒は、ぼけた丸
      const R = r * 3;
      const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, R);
      g.addColorStop(0, color);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalAlpha = Math.min(1, a * 0.6);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(s.x, s.y, R, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = color;
      continue;
    }
    ctx.globalAlpha = Math.min(1, a);
    const q = prevCam ? project(prevCam, p, env) : null;
    const len = q ? Math.hypot(s.x - q.x, s.y - q.y) : 0;
    if (q && len > r * 1.5 && len < short * 0.6) { // 動いた向きに伸ばす（長すぎるのは向きが飛んだとき。伸ばさない）
      ctx.lineWidth = Math.max(0.5, r * 2);
      ctx.beginPath();
      ctx.moveTo(q.x, q.y);
      ctx.lineTo(s.x, s.y);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(s.x, s.y, Math.max(0.5, r), 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
