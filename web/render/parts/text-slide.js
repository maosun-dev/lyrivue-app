// 文字：下から滑り上がって止まる。
import { prepareText, fadeOut, drawGlyphs, lineY } from './text-common.js';
import { easeOutCubic, clamp01 } from '../timing.js';

const SLIDE = 0.35; // 滑る秒数

export function textSlide(ctx, t, layer, scene, env) {
  const p = prepareText(ctx, env);
  if (!p) return;
  const offset = (1 - easeOutCubic(env.u / SLIDE)) * env.height * 0.12;
  ctx.globalAlpha = clamp01(env.u / 0.2) * fadeOut(env.u, env.dur);
  p.lines.forEach((line, li) => {
    drawGlyphs(ctx, env, line, env.width / 2, lineY(env, li, p.lines.length, p.lineHeight) + offset, p.px);
  });
}
