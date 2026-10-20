// 間奏の重ねる模様（雰囲気 S の間奏の場面。director/interlude.js）：1〜2 小節ごとの区切りに 1 層。
// layer.kind：背景向きの模様（画面いっぱいに薄く敷く）。layer.spots：真ん中にまとまる形を画面のあちこちに大小ばらばらに置く
// （{id, x, y, size, vx, vy, mode, key, swap, dir}。x・y は画面の割合、size は短辺の割合）。
// 出方 mode：steady＝ずっと・flash＝拍ごとに点いたり消えたり・strobe＝1 秒に 8 回チカチカ・pop＝弾んで出て縮んで消える・
// wipe＝さっと塗られるように現れる・spin＝回り続ける・glitch＝横の帯ごとにずれる。
// 重ね方は光らせて重ねる（lighter）。白っぽい地ではふつうに重ねる（光らせると白く飛ぶ）。
// 置く模様は、いったん別の画面に描いて丸く縁をぼかしてから重ねる（四角い縁が見えないように）。別の画面が作れなければ丸く切るだけ。
// 2026-10-20 持ち主が 55 点を付けた「立体の空間の見本」（app/space-check.js）と同じ見せ方
import { drawGeo, geoById } from './geo/index.js';
import { clamp01 } from '../timing.js';

const FADE = 0.4;

// 置く模様を描く別の画面（大きさごとに使い回す）。作れない所（試験など）では null
const pool = new Map();
function scratch(n) {
  const k = Math.max(16, Math.min(1024, 2 ** Math.ceil(Math.log2(Math.max(1, n)))));
  if (pool.has(k)) return pool.get(k);
  let c = null;
  if (typeof globalThis.OffscreenCanvas === 'function') c = new globalThis.OffscreenCanvas(k, k);
  else if (globalThis.document?.createElement) { c = globalThis.document.createElement('canvas'); c.width = c.height = k; }
  const g = c?.getContext?.('2d') ?? null;
  const v = g ? { canvas: c, ctx: g } : null;
  pool.set(k, v);
  return v;
}

/** 置いた模様の、今の濃さ（0 なら描かない）と大きさの倍率・回転 */
export function spotLook(sp, t, el, len, beat) {
  const bi = beat.index, bp = beat.phase;
  let a = 0.85, scale = 1, rot = 0;
  if (sp.mode === 'flash') a = (((bi + sp.key) * 2654435761) >>> 0) % 3 === 0 ? 0 : 0.9 * Math.exp(-bp * 2.5);
  else if (sp.mode === 'strobe') a = Math.floor(t * 8 + sp.key) % 2 && ((bi + sp.key) % 4 !== 0) ? 0.9 : 0.12;
  else if (sp.mode === 'pop') {
    const inK = Math.min(1, el / 0.25), outK = Math.min(1, (len - el) / 0.2);
    scale = inK < 1 ? inK * (1 + 0.25 * Math.sin(inK * Math.PI)) : Math.max(0, outK);
  } else if (sp.mode === 'spin') rot = (sp.dir < 0 ? -1 : 1) * el * 1.4;
  return { a, scale, rot };
}

export function fxOverlay(ctx, t, layer, scene, env) {
  const w = env?.width, h = env?.height;
  if (!(w > 0 && h > 0 && Number.isFinite(w) && Number.isFinite(h)) || !Number.isFinite(t)) return;
  if (!(t >= layer.from && t < layer.to)) return;
  let fade = 1;
  if (layer.fadeIn) fade = Math.min(fade, clamp01((t - layer.from) / FADE));
  if (layer.fadeOut) fade = Math.min(fade, clamp01((layer.to - t) / FADE));
  if (!(fade > 0)) return;
  const ink = env.ink ?? {};
  const fg = ink.fg ?? '#F4F4F4', accent = ink.accent ?? fg, bg = ink.bg ?? '#000000';
  const add = !ink.light;
  const beat = { index: Number.isFinite(env.beat?.index) ? env.beat.index : 0, phase: clamp01(env.beat?.phase ?? 0) };
  ctx.globalCompositeOperation = add ? 'lighter' : 'source-over';
  // 背景向きの模様 1 枚（画面いっぱい・薄め）
  if (geoById(layer.kind)) {
    drawGeo(ctx, layer.kind, { width: w, height: h, t: t * 1.5, beat, intensity: 0.6,
      fg: layer.swap ? accent : fg, accent: layer.swap ? fg : accent, bg, fade: (add ? 0.3 : 0.25) * fade });
  }
  const S = Math.min(w, h), len = layer.to - layer.from, el = t - layer.from;
  (Array.isArray(layer.spots) ? layer.spots : []).forEach((sp, k) => {
    if (!sp || !geoById(sp.id) || ![sp.x, sp.y, sp.size].every(Number.isFinite)) return;
    if (env.lite && k % 2) return; // 軽い描き方（ぶれの重ね描き）では半分だけ
    const look = spotLook(sp, t, el, len, beat);
    const d = sp.size * S * look.scale;
    if (!(look.a > 0.02) || !(d > 1)) return;
    const cx = (sp.x + (sp.vx || 0) * el) * w, cy = (sp.y + (sp.vy || 0) * el) * h;
    const genv = { width: d, height: d, t: t * 2 + k * 7, beat, intensity: 0.75, fg: sp.swap ? accent : fg, accent: sp.swap ? fg : accent, bg };
    const paint = o => {
      if (sp.mode === 'wipe') { const q = Math.min(1, el / 0.35); o.beginPath(); o.rect(0, 0, d * q, d); o.clip(); }
      if (sp.mode === 'glitch') {
        // 横の帯 6 本を、1 秒に 12 回ずつずらし直す
        const strips = 6, g = Math.floor(t * 12);
        for (let j = 0; j < strips; j++) {
          const sh = ((((g * 31 + j * 17 + sp.key) % 13) + 13) % 13 / 13 - 0.5) * d * 0.35;
          o.save(); o.beginPath(); o.rect(0, (j * d) / strips, d, d / strips); o.clip(); o.translate(sh, 0); drawGeo(o, sp.id, genv); o.restore();
        }
      } else drawGeo(o, sp.id, genv);
    };
    const off = scratch(Math.ceil(d));
    ctx.save();
    ctx.translate(cx, cy); ctx.rotate(look.rot);
    ctx.globalAlpha = Math.min(1, look.a * (add ? 0.85 : 0.75) * fade);
    if (off) {
      // 別の画面に描き、丸い移り変わりで縁をぼかしてから重ねる
      const o = off.ctx, W = off.canvas.width, k0 = W / d;
      o.setTransform(1, 0, 0, 1, 0, 0); o.globalAlpha = 1; o.globalCompositeOperation = 'source-over'; o.clearRect(0, 0, W, W);
      o.setTransform(k0, 0, 0, k0, 0, 0);
      o.save(); paint(o); o.restore();
      o.setTransform(1, 0, 0, 1, 0, 0);
      o.globalCompositeOperation = 'destination-in';
      const mask = o.createRadialGradient(W / 2, W / 2, W * 0.3, W / 2, W / 2, W / 2);
      mask.addColorStop(0, 'rgba(0,0,0,1)'); mask.addColorStop(1, 'rgba(0,0,0,0)');
      o.fillStyle = mask; o.fillRect(0, 0, W, W);
      o.globalCompositeOperation = 'source-over';
      ctx.drawImage(off.canvas, -d / 2, -d / 2, d, d);
    } else {
      genv.fade = ctx.globalAlpha; // 模様は濃さを自分で決めるので、倍率として渡す
      ctx.beginPath(); ctx.arc(0, 0, d / 2, 0, Math.PI * 2); ctx.clip();
      ctx.translate(-d / 2, -d / 2);
      paint(ctx);
    }
    ctx.restore();
  });
  ctx.globalCompositeOperation = 'source-over';
}
