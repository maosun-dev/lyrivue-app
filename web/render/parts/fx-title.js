// 間奏の巨大文字（雰囲気 S の間奏の場面）：曲の題名（layer.role = 'title'）と、よく出る言葉（'word'）。
// 画面の真ん中に、極太の文字を画面の幅いっぱい（長い言葉は縮める）に置く。入れ替わるとき、少し大きい所から縮んで着く。
// 題名は塗り、言葉は縁取り（後ろに薄い写しを 2 つずらして重ねる）。
import { clamp01, easeOutCubic } from '../timing.js';
import { TYPEFACES } from './text-motion.js';
import { hash01 } from '../rand.js';

const IN = 0.35, OUT = 0.25; // 出る・消える秒数
const FILL = 0.88;           // 画面の幅に対して文字の幅をここまで

export function fxTitle(ctx, t, layer, scene, env) {
  const w = env?.width, h = env?.height, text = String(layer?.text ?? '').trim();
  if (!text || !(w > 0 && h > 0 && Number.isFinite(w) && Number.isFinite(h)) || !Number.isFinite(t)) return;
  const u = t - layer.from, left = layer.to - t;
  const inK = easeOutCubic(clamp01(u / IN));
  const a = Math.min(inK, clamp01(left / OUT));
  if (!(a > 0)) return;
  const ink = env.ink ?? {};
  const face = TYPEFACES.heavy;
  const S = Math.min(w, h);
  // 文字の大きさ：短辺の 0.3 を上限に、横幅いっぱいに収まるまで縮める。単語が 2 つ以上あれば、1〜3 行に分けて
  // いちばん大きく出せる分け方を選ぶ（「Beyond the clouds」を 1 行に詰めると小さすぎるので）
  const fontAt = px => `${face.heavy} ${px}px ${face.family}`;
  ctx.font = fontAt(100);
  const widthOf = s => ctx.measureText(s).width / 100; // 1px あたりの幅
  const words = text.split(/\s+/);
  let best = { rows: [text], px: 0 };
  for (let n = 1; n <= Math.min(3, words.length); n++) {
    const rows = splitRows(words, n, widthOf);
    const wmax = Math.max(...rows.map(widthOf));
    let px = Math.min(S * 0.3, wmax > 0 ? (w * FILL) / wmax : S * 0.3);
    px = Math.min(px, (h * 0.62) / (rows.length * 1.05)); // 縦にも収める
    if (px > best.px * 1.08) best = { rows, px }; // 行を増やすのは、はっきり大きくなるときだけ
  }
  const px = Math.max(best.px, 4), rows = best.rows;
  ctx.font = fontAt(px);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const scale = 1 + 0.25 * (1 - inK);
  const tilt = (hash01(Math.round((layer.from || 0) * 100), 3, 0) - 0.5) * 0.12; // 言葉ごとに少しだけ傾ける
  ctx.translate(w / 2, h / 2);
  ctx.rotate(layer.role === 'title' ? 0 : tilt);
  ctx.scale(scale, scale);
  const fg = ink.fg ?? '#F4F4F4', accent = ink.accent ?? fg;
  const lh = px * 1.05, y0 = -((rows.length - 1) * lh) / 2;
  rows.forEach((row, r) => {
    const y = y0 + r * lh;
    if (layer.role === 'title') {
      ctx.globalAlpha = a * 0.25; ctx.fillStyle = accent; ctx.fillText(row, px * 0.04, y + px * 0.05);
      ctx.globalAlpha = a; ctx.fillStyle = fg; ctx.fillText(row, 0, y);
    } else {
      ctx.lineJoin = 'round';
      ctx.lineWidth = Math.max(1, px * 0.035);
      for (const [k, al] of [[2, 0.18], [1, 0.35]]) { ctx.globalAlpha = a * al; ctx.strokeStyle = fg; ctx.strokeText(row, 0, y - px * 0.9 * k); ctx.strokeText(row, 0, y + px * 0.9 * k); }
      ctx.globalAlpha = a; ctx.strokeStyle = accent; ctx.strokeText(row, 0, y);
    }
  });
}

// 単語を n 行に分ける（行の幅がなるべくそろうように、先頭から詰めていく）
function splitRows(words, n, widthOf) {
  if (n <= 1) return [words.join(' ')];
  const total = widthOf(words.join(' '));
  const rows = [];
  let cur = [];
  for (const wd of words) {
    const next = [...cur, wd].join(' ');
    if (cur.length && rows.length < n - 1 && widthOf(next) > total / n * 1.15) { rows.push(cur.join(' ')); cur = [wd]; } else cur.push(wd);
  }
  if (cur.length) rows.push(cur.join(' '));
  return rows;
}
