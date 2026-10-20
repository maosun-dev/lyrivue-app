// 文字：1文字ずつ時間をずらして下から跳ね上がり、行き過ぎて戻って着地する。
import { prepareText, fadeOut, drawGlyphs, lineY } from './text-common.js';
import { easeOutBack, clamp01 } from '../timing.js';

const DELAY = 0.04;   // 1文字ごとの遅れ（秒）
const RISE = 0.35;    // 1文字が着地するまでの秒数

export function textBounce(ctx, t, layer, scene, env) {
  const p = prepareText(ctx, env);
  if (!p) return;
  const jump = env.height * (0.02 + 0.06 * env.intensity);
  const fade = fadeOut(env.u, env.dur);
  let k = 0; // 文字の通し番号
  p.lines.forEach((line, li) => {
    const chars = Array.from(line);
    const widths = chars.map(c => ctx.measureText(c).width);
    const total = widths.reduce((a, b) => a + b, 0);
    let x = env.width / 2 - total / 2;
    const y0 = lineY(env, li, p.lines.length, p.lineHeight);
    chars.forEach((c, ci) => {
      const local = (env.u - DELAY * k) / RISE;
      k++;
      const cx = x + widths[ci] / 2;
      x += widths[ci];
      if (local < 0) return; // まだ出番が来ていない
      ctx.globalAlpha = clamp01(local * 5) * fade;
      drawGlyphs(ctx, env, c, cx, y0 + (1 - easeOutBack(local)) * jump * 4, p.px);
    });
  });
}
