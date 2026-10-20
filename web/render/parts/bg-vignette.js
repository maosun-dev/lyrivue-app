// 背景（雰囲気 D・S）：白地（paper）と色地（color）は四隅を暗く落とし、黒地（ink）は真っ黒。
import { toneStyle } from '../tone.js';

export function bgVignette(ctx, t, layer, scene, env) {
  const { width: w, height: h } = env;
  if (!(w > 0 && h > 0)) return;
  if (env.tone === 'paper' || env.tone === 'color') {
    ctx.fillStyle = toneStyle(env.tone, env.colors).bg;
    ctx.fillRect(0, 0, w, h);
    const short = Math.min(w, h);
    const g = ctx.createRadialGradient(w / 2, h / 2, short * 0.35, w / 2, h / 2, Math.hypot(w, h) / 2);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.35)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  } else {
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, w, h);
  }
}
