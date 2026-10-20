// 飾り：拍ごとに中心から輪が広がって消える。
import { easeOutCubic } from '../timing.js';

export function fxRing(ctx, t, layer, scene, env) {
  const { width: w, height: h, colors, intensity, beat } = env;
  if (beat.index < 0) return; // 最初の拍より前は描かない
  const short = Math.min(w, h);
  ctx.globalAlpha = (1 - beat.phase) * 0.8;
  ctx.strokeStyle = colors[0];
  ctx.lineWidth = short * (0.01 + 0.02 * intensity);
  ctx.beginPath();
  ctx.arc(w / 2, h / 2, short * (0.1 + 0.5 * easeOutCubic(beat.phase)), 0, Math.PI * 2);
  ctx.stroke();
}
