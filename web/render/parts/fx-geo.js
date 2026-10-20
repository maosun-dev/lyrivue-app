// 間奏の幾何学模様（雰囲気 S の間奏の場面）。layer.kind が模様の id（render/parts/geo/）。
// 世界の配色（env.ink の fg・accent・bg）で画面いっぱいに描く。間奏は 1〜2 小節ごとに模様が替わる（director/interlude.js）。
// layer.move：切り替わりごとの動き方（寄る zoom-in・引く zoom-out・回る spin・横から滑り込む slide・傾く tilt・押し込む push）
// layer.speed：模様の中の動きの速さの倍率（1.5〜3）。layer.swap：線の色と目立たせる色を入れ替える
// 切り替えはフェードなしでバッと替える。間奏の頭（fadeIn）と終わり（fadeOut）だけ濃さを上げ下げする。
// layer.pos・rot・act があれば「空間の板」：模様を文字の板と同じように空間に置いて映す（カメラが板から板へ飛び移る。
// act は自分の区切り［始め, 終わり］。区切りの間は濃く、前後の区切りでは薄く浮かべる）。無ければ画面に貼る（move で動かす）
import { drawGeo } from './geo/index.js';
import { clamp01 } from '../timing.js';
import { hash01 } from '../rand.js';

const FADE = 0.3;
const easeOut = x => 1 - Math.pow(1 - clamp01(x), 3);

/** 切り替わってからの進み u（0〜1）と経過秒 s での、模様の動かし方（画面の中心まわりの拡大・回転・ずらし） */
export function geoMotion(move, u, s, dir, w, h) {
  const e = easeOut(u * 1.6); // 頭で勢いよく、すぐ落ち着く
  switch (move) {
    case 'zoom-in': return { scale: 1 + 0.45 * u, rot: 0, dx: 0, dy: 0 };
    case 'zoom-out': return { scale: 1.6 - 0.6 * e, rot: 0, dx: 0, dy: 0 };
    case 'spin': return { scale: 1.15, rot: dir * (0.9 * (1 - e) + 0.25 * s), dx: 0, dy: 0 };
    case 'slide': return { scale: 1.1, rot: 0, dx: dir * w * 0.6 * (1 - e) - dir * w * 0.03 * s, dy: 0 };
    case 'tilt': return { scale: 1.25, rot: dir * 0.35 * e, dx: 0, dy: -dir * h * 0.04 * s };
    case 'push': return { scale: 0.7 + 0.5 * e + 0.05 * s, rot: dir * 0.12 * e, dx: 0, dy: 0 };
    default: return { scale: 1, rot: 0, dx: 0, dy: 0 };
  }
}

export function fxGeo(ctx, t, layer, scene, env) {
  const w = env?.width, h = env?.height;
  if (!(w > 0 && h > 0 && Number.isFinite(w) && Number.isFinite(h)) || !Number.isFinite(t)) return;
  if (Array.isArray(layer.pos) && layer.rot && Array.isArray(layer.act)) { drawBoard(ctx, t, layer, env, w, h); return; }
  const len = layer.to - layer.from, s = t - layer.from;
  if (!(len > 0) || s < 0 || s >= len) return; // 終わりの瞬間は次の模様の番
  const a = Math.min(layer.fadeIn ? clamp01(s / FADE) : 1, layer.fadeOut ? clamp01((layer.to - t) / FADE) : 1);
  if (!(a > 0)) return;
  const ink = env.ink ?? {};
  let fg = ink.fg ?? '#F4F4F4', accent = ink.accent ?? fg;
  if (layer.swap) [fg, accent] = [accent, fg];
  const dir = hash01(Math.round(layer.from * 1000), 11, 0) < 0.5 ? -1 : 1;
  const m = geoMotion(layer.move, clamp01(s / len), s, dir, w, h);
  const speed = Number.isFinite(layer.speed) && layer.speed > 0 ? layer.speed : 1;
  ctx.translate(w / 2 + m.dx, h / 2 + m.dy);
  ctx.rotate(m.rot);
  ctx.scale(m.scale, m.scale);
  ctx.translate(-w / 2, -h / 2);
  drawGeo(ctx, layer.kind, {
    // 模様の中の時刻：切り替わった所から speed 倍で進める（同じ模様でも毎回違う所から始まるよう、頭をずらす）
    width: w, height: h, t: layer.from + s * speed + hash01(Math.round(layer.from * 1000), 12, 0) * 20,
    beat: env.beat, intensity: clamp01(env.intensity ?? 0.5), fade: a, fg, accent, bg: ink.bg ?? '#000000',
  });
}

const BOARD = 1.38;   // 板の大きさ：行を見る距離（1.2）から見て、画面より少し大きい（傾いても端が見えにくい）
const DIM = 0.4;      // 自分の区切りでない（前後の）板の濃さ

// 空間の板に模様を描く。板の局所座標（短辺の画素）→ 画面は env.projectPlane が返す行列（文字の板と同じ）
function drawBoard(ctx, t, layer, env, w, h) {
  if (typeof env.projectPlane !== 'function' || !(t >= layer.from && t < layer.to)) return;
  const plane = env.projectPlane(layer.pos, layer.rot);
  if (!plane) return;
  const [a0, a1] = layer.act;
  const active = t >= a0 && t < a1;
  let a = active ? 1 : DIM;
  if (layer.fadeIn) a *= clamp01((t - layer.from) / FADE);
  if (layer.fadeOut) a *= clamp01((layer.to - t) / FADE);
  if (!(a > 0)) return;
  const ink = env.ink ?? {};
  let fg = ink.fg ?? '#F4F4F4', accent = ink.accent ?? fg;
  if (layer.swap) [fg, accent] = [accent, fg];
  const bs = Number.isFinite(layer.boardScale) && layer.boardScale > 0 ? layer.boardScale : 1; // 小さな看板にするときの倍率
  const W = w * BOARD * bs, H = h * BOARD * bs, S = Math.min(W, H);
  ctx.transform(...plane.m);
  // 板の地（世界の地の色を半分透かして、模様が背景に負けないように）と、縁と四隅のかぎ
  ctx.globalAlpha = 0.55 * a; ctx.fillStyle = ink.bg ?? '#000000'; ctx.fillRect(-W / 2, -H / 2, W, H);
  ctx.globalAlpha = 0.6 * a; ctx.strokeStyle = fg; ctx.lineWidth = Math.max(1, S * 0.003); ctx.strokeRect(-W / 2, -H / 2, W, H);
  ctx.globalAlpha = a; ctx.strokeStyle = accent; ctx.lineWidth = Math.max(1, S * 0.008);
  const c = S * 0.06;
  for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    ctx.beginPath(); ctx.moveTo(sx * W / 2, sy * (H / 2 - c)); ctx.lineTo(sx * W / 2, sy * H / 2); ctx.lineTo(sx * (W / 2 - c), sy * H / 2); ctx.stroke();
  }
  ctx.save(); ctx.beginPath(); ctx.rect(-W / 2, -H / 2, W, H); ctx.clip(); // 模様は板の中だけ
  ctx.translate(-W / 2, -H / 2);
  const speed = Number.isFinite(layer.speed) && layer.speed > 0 ? layer.speed : 1;
  drawGeo(ctx, layer.kind, {
    width: W, height: H, t: a0 + (t - a0) * speed + hash01(Math.round(a0 * 1000), 12, 0) * 20,
    beat: env.beat, intensity: clamp01(env.intensity ?? 0.5), fade: a, fg, accent, bg: ink.bg ?? '#000000',
  });
  ctx.restore();
}
