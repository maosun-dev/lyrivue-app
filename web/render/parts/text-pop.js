// 文字：中央でぽんと拡大して出る（少し行き過ぎて戻る）。
import { prepareText, fadeOut, drawGlyphs, lineY } from './text-common.js';
import { easeOutBack, clamp01 } from '../timing.js';

const POP = 0.3; // 拡大にかける秒数

export function textPop(ctx, t, layer, scene, env) {
  const p = prepareText(ctx, env);
  if (!p) return;
  ctx.globalAlpha = clamp01(env.u / 0.1) * fadeOut(env.u, env.dur);
  ctx.translate(env.width / 2, env.height / 2);
  const s = easeOutBack(env.u / POP);
  ctx.scale(s, s);
  p.lines.forEach((line, li) => {
    drawGlyphs(ctx, env, line, 0, lineY(env, li, p.lines.length, p.lineHeight) - env.height / 2, p.px);
  });
}
