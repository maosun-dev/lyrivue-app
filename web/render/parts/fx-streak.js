// 飾り（雰囲気 D）：拍ごとに、細い縦の線が3本、上から流れ落ちて薄くなる。
import { hash01 } from '../rand.js';

export function fxStreak(ctx, t, layer, scene, env) {
  const { width: w, height: h, beat } = env;
  if (!(w > 0 && h > 0) || beat.index < 0) return;
  const short = Math.min(w, h);
  const lw = Math.max(1, short * 0.004);
  ctx.globalAlpha = 0.5 * (1 - beat.phase);
  ctx.fillStyle = env.ink?.fg ?? (env.tone === 'paper' ? '#101010' : '#F4F4F4');
  for (let k = 0; k < 3; k++) {
    const x = hash01(beat.index, k, 1) * w;
    ctx.fillRect(x - lw / 2, -h * 0.2 + beat.phase * h * 1.2, lw, h * 0.35);
  }
}
