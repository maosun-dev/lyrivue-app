// 飾り（雰囲気 D・黒地）：画面の右上から差す光の筋。光を足し合わせる合成（lighter）で、黒地に淡く浮かぶ。
// 筋はゆっくり揺れ、拍の頭で少し明るくなる。色は曲の強調色（env.colors[0]）。
import { hash01 } from '../rand.js';
import { clamp01 } from '../timing.js';

const COUNT = 9;

export function fxRays(ctx, t, layer, scene, env) {
  const { width: w, height: h, colors, beat } = env;
  if (!(w > 0 && h > 0)) return;
  const intensity = clamp01(env.intensity); // 数でなければ 0（濃さが最大にならないように）
  const ox = w * 0.78;           // 光の元（画面の外の右上）
  const oy = -h * 0.12;
  const len = Math.hypot(w, h) * 1.3;
  const pulse = 0.8 + 0.4 * (1 - (beat.index >= 0 ? beat.phase : 1));
  ctx.globalCompositeOperation = 'lighter';
  for (let k = 0; k < COUNT; k++) {
    if (env.lite && k % 2 === 1) continue; // 軽い版は1本おき（9本→5本）
    const ang = Math.PI * 0.5 + (k - (COUNT - 1) / 2) * 0.22 + Math.sin(t * 0.3 + k * 1.7) * 0.05;
    const half = 0.025 + 0.025 * hash01(k, 1);
    const g = ctx.createLinearGradient(ox, oy, ox + Math.cos(ang) * len, oy + Math.sin(ang) * len);
    g.addColorStop(0, colors[0]);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = (0.06 + 0.10 * intensity * (0.6 + 0.4 * hash01(k, 2))) * pulse;
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(ox, oy);
    ctx.lineTo(ox + Math.cos(ang - half) * len, oy + Math.sin(ang - half) * len);
    ctx.lineTo(ox + Math.cos(ang + half) * len, oy + Math.sin(ang + half) * len);
    ctx.closePath();
    ctx.fill();
  }
}
