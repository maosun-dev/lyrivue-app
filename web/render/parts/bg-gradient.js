// 背景：暗い色の上に、向きがゆっくり回るグラデーション（強調色）を重ねる。
export function bgGradient(ctx, t, layer, scene, env) {
  const { width: w, height: h, colors } = env;
  ctx.fillStyle = colors[2];
  ctx.fillRect(0, 0, w, h);
  const ang = t * 0.1;
  const r = Math.hypot(w, h) / 2;
  const cx = w / 2;
  const cy = h / 2;
  const g = ctx.createLinearGradient(cx - Math.cos(ang) * r, cy - Math.sin(ang) * r, cx + Math.cos(ang) * r, cy + Math.sin(ang) * r);
  g.addColorStop(0, colors[2]);
  g.addColorStop(1, colors[0]);
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}
