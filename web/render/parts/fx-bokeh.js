// 飾り（雰囲気 D・黒地）：やわらかい光の丸（にじみ）がゆっくり上へ流れる。位置は丸の番号と時刻だけで決まる。
// 光を足し合わせる合成（lighter）。拍の頭で少しふくらむ。色は曲の明るい色（env.colors[1]）。
import { hash01 } from '../rand.js';
import { clamp01 } from '../timing.js';

const BASE_COUNT = 14; // 強さ 0 のときの丸の数。強さ 1 で 30

const fract = x => x - Math.floor(x);

export function fxBokeh(ctx, t, layer, scene, env) {
  const { width: w, height: h, colors, beat } = env;
  if (!(w > 0 && h > 0)) return;
  const intensity = clamp01(env.intensity); // 数でなければ 0
  const short = Math.min(w, h);
  const full = Math.round(BASE_COUNT + 16 * intensity);
  const count = env.lite ? Math.round(full / 2) : full; // 軽い版は半分
  const margin = short * 0.14; // 丸の最大の半径より大きく、画面の外まで広げて折り返す（端で突然現れない）
  const pulse = 1 + 0.1 * (1 - (beat.index >= 0 ? beat.phase : 1));
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < count; i++) {
    const x = fract(hash01(i, 1) + 0.03 * Math.sin(t * 0.2 + i)) * (w + 2 * margin) - margin;
    const y = fract(hash01(i, 2) - t * (0.005 + 0.02 * hash01(i, 3))) * (h + 2 * margin) - margin; // ゆっくり上へ流れて、上の外で下の外に戻る
    const r = short * (0.03 + 0.09 * hash01(i, 4)) * pulse;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, colors[1]);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = 0.18 + 0.2 * hash01(i, 5);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
}
