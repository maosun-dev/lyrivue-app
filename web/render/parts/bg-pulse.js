// 背景：拍の頭で中心から強調色がぱっと明るくなり、次の拍までに引く。
export function bgPulse(ctx, t, layer, scene, env) {
  const { width: w, height: h, colors, intensity, beat } = env;
  ctx.fillStyle = colors[2];
  ctx.fillRect(0, 0, w, h);
  const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.hypot(w, h) / 2);
  g.addColorStop(0, colors[0]);
  g.addColorStop(1, colors[2]);
  ctx.globalAlpha = 0.15 + 0.35 * intensity * (1 - beat.phase);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}
