// 飾り：光の粒がゆっくり上へ流れる。位置は粒の番号と時刻だけで決まる（記憶を持たない）。
import { hash01 } from '../rand.js';

const BASE_COUNT = 24; // 強さ 0 のときの粒の数。強さ 1 で 2 倍

export function fxDots(ctx, t, layer, scene, env) {
  const { width: w, height: h, colors, intensity } = env;
  const short = Math.min(w, h);
  const count = Math.round(BASE_COUNT * (1 + intensity));
  ctx.fillStyle = colors[1];
  ctx.globalAlpha = 0.6;
  for (let i = 0; i < count; i++) {
    const speed = 0.01 + 0.03 * hash01(i, 3);                       // 1秒に画面の何割上がるか
    const y = (((hash01(i, 2) - t * speed) % 1) + 1) % 1;            // 0〜1 の中で上へ流れて、上の端で下に戻る
    const x = hash01(i, 1) + 0.02 * Math.sin(t * 0.5 + i);          // 左右に少しゆれる
    ctx.beginPath();
    ctx.arc(Math.min(w, Math.max(0, x * w)), y * h, short * (0.004 + 0.008 * hash01(i, 4)), 0, Math.PI * 2);
    ctx.fill();
  }
}
