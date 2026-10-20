// 文字の部品に共通の道具：大きさと折り返しを決める・薄くなる・影つきで描く。
import { wrapText } from '../layout.js';
import { clamp01 } from '../timing.js';

const LINE_HEIGHT = 1.3;   // 行の高さ（文字の大きさに対する倍率）
const MAX_WIDTH = 0.86;    // 文字を置いてよい幅（画面の幅に対する割合）
const MAX_HEIGHT = 0.8;    // 文字を置いてよい高さ（画面の高さに対する割合）
const FADE_SECONDS = 0.2;  // 出番の終わりに薄くなる秒数
const MAX_SHRINK_STEPS = 60; // 文字を縮めてみる回数の上限（無限に回らないように）

/**
 * 文字の大きさと折り返しを決め、ctx.font を設定する。env.text が空なら null。
 * 縦長は幅の 0.11 倍、そうでなければ短辺の 0.09 倍から始め、収まらなければ縮める（下限は短辺の 0.03 倍）
 * @returns {{lines:string[], px:number, lineHeight:number}|null}
 */
export function prepareText(ctx, env) {
  const { width: w, height: h } = env;
  // 画面の大きさが数でない・0 以下のときは描かない（大きさが NaN になるとくり返しが終わらなくなる）
  if (!env.text || !(w > 0 && h > 0 && Number.isFinite(w) && Number.isFinite(h))) return null;
  const short = Math.min(w, h);
  const minPx = short * 0.03;
  let px = Math.max(minPx, h > w ? w * 0.11 : short * 0.09);
  let lines;
  for (let i = 0; i < MAX_SHRINK_STEPS; i++) {
    ctx.font = `${px}px "${env.font}", "Hiragino Sans", sans-serif`;
    lines = wrapText(ctx, env.text, w * MAX_WIDTH);
    if (lines.length * px * LINE_HEIGHT <= h * MAX_HEIGHT || px <= minPx) break;
    px = Math.max(minPx, px * 0.9);
  }
  return { lines, px, lineHeight: px * LINE_HEIGHT };
}

/** 出番の最後の 0.2 秒で 1→0。出番が短いときは後半で薄くなる */
export function fadeOut(u, dur) {
  const f = Math.min(FADE_SECONDS, Math.max(0, dur) / 2);
  if (!(f > 0)) return 1;
  return clamp01((dur - u) / f);
}

/** 影（強調色）を少しずらして重ねてから、明るい色で描く。中央ぞろえ */
export function drawGlyphs(ctx, env, str, x, y, px) {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const d = px * 0.05;
  ctx.fillStyle = env.colors[0];
  ctx.fillText(str, x + d, y + d);
  ctx.fillStyle = env.colors[1];
  ctx.fillText(str, x, y);
}

/** 行ごとの中心の高さ（文字のかたまりを画面の中央に置く） */
export function lineY(env, i, count, lineHeight) {
  return env.height / 2 + (i - (count - 1) / 2) * lineHeight;
}
