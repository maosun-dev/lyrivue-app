// 飾り：画面の下に、いま鳴っている音の大きさの線（前後1秒ぶん）を描く。
import { clamp01 } from '../timing.js';

const SPAN = 1; // 前後に見せる秒数

export function fxWave(ctx, t, layer, scene, env) {
  const { width: w, height: h, colors, waveform } = env;
  const rate = env.waveformRate > 0 ? env.waveformRate : 30;
  const short = Math.min(w, h);
  const steps = Math.min(200, Math.max(2, Math.floor(w / 3)));
  const base = h * 0.9;       // 音が無いときの線の高さ
  const reach = h * 0.1;      // いちばん大きい音で上がる高さ
  ctx.globalAlpha = 0.8;
  ctx.strokeStyle = colors[0];
  ctx.lineWidth = Math.max(1, short * 0.006);
  ctx.beginPath();
  for (let k = 0; k < steps; k++) {
    const sec = t - SPAN + (2 * SPAN * k) / (steps - 1);
    const amp = clamp01(waveform?.[Math.round(sec * rate)] ?? 0);
    const x = (w * k) / (steps - 1);
    const y = base - amp * reach;
    if (k === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.stroke();
}
