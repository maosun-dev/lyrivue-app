// 飾り（雰囲気 D）：場面の頭で、全面が白く飛んで 0.4 秒で消える。
const SECONDS = 0.4;

export function fxFlash(ctx, t, layer, scene, env) {
  const { width: w, height: h } = env;
  const u = t - layer.from;
  if (!(w > 0 && h > 0) || !(u >= 0 && u < SECONDS)) return;
  const k = 1 - u / SECONDS;
  ctx.globalAlpha = k * k;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
}
