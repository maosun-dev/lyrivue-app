// 間奏の空間（雰囲気 S の間奏の場面。director/interlude.js）：地の塗り・星の粒・立体物。
// 2026-10-20 持ち主が 55 点を付けた「立体の空間の見本」（app/space-check.js）と同じ見せ方：
// 無地の地に、くり返し敷いた星の粒（速く動くと線に伸びる）と、カメラの道すじのまわりに散らした中抜きの立体（solid3d.js）。
import { clamp01 } from '../timing.js';
import { project } from '../camera.js';
import { hash01 } from '../rand.js';
import { drawSolid, solidDepth } from './solid3d.js';
import { tileNear, edgeFade } from './space-common.js';

const FADE = 0.4;     // 間奏の頭（fadeIn）・終わり（fadeOut）で濃さを上げ下げする秒数
const SHUTTER = 0.035; // 星を伸ばす時間の幅（秒）

/** 層の時刻での濃さ（範囲の外は 0） */
function layerAlpha(t, layer) {
  if (!(Number.isFinite(t) && t >= layer.from && t < layer.to)) return 0;
  let a = 1;
  if (layer.fadeIn) a = Math.min(a, clamp01((t - layer.from) / FADE));
  if (layer.fadeOut) a = Math.min(a, clamp01((layer.to - t) / FADE));
  return a;
}

/** globalAlpha の代入のたびに a を掛ける窓口（部品が自分で濃さを決めるので、外から薄めるときに使う） */
export function dimmed(ctx, a) {
  if (!(a < 1)) return ctx;
  return new Proxy(ctx, {
    get: (o, k) => { const v = o[k]; return typeof v === 'function' ? v.bind(o) : (k === 'globalAlpha' ? v / a : v); },
    set: (o, k, v) => { o[k] = k === 'globalAlpha' ? v * a : v; return true; },
  });
}

/** 地の塗り：世界の配色の地の色（無ければ曲の暗い色）で画面を塗る */
export function bgInk(ctx, t, layer, scene, env) {
  const w = env?.width, h = env?.height;
  if (!(w > 0 && h > 0 && Number.isFinite(w) && Number.isFinite(h))) return;
  ctx.globalAlpha = 1;
  ctx.fillStyle = env.ink?.bg ?? env.colors?.[2] ?? '#000000';
  ctx.fillRect(0, 0, w, h);
}

const STAR_COUNT = 420;
const STAR_CELL = 16;  // 星を敷き詰める箱の一辺
const STAR_AHEAD = 7;  // 箱の中心を、カメラの前方へこれだけ進めた所に置く

/** 星の粒：カメラの前の箱にくり返し敷く（どこまで行っても尽きない）。速く動くと、動いた向きに線に伸びる */
export function fxStars(ctx, t, layer, scene, env) {
  const w = env?.width, h = env?.height, cam = env?.cam;
  if (!(w > 0 && h > 0 && Number.isFinite(w) && Number.isFinite(h)) || !Array.isArray(cam?.pos)) return;
  const fade = layerAlpha(t, layer);
  if (!(fade > 0)) return;
  const size = { width: w, height: h }, S = Math.min(w, h);
  const before = typeof env.camAt === 'function' ? env.camAt(t - SHUTTER) : null;
  const prev = before ? { ...before, zoom: cam.zoom } : null; // 拡大は今と同じ（拍の寄りで伸びないように）
  const color = env.ink?.fg ?? '#F4F4F4';
  ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineCap = 'round';
  const n = env.lite ? STAR_COUNT / 2 : STAR_COUNT;
  for (let i = 0; i < n; i++) {
    const { p, edge } = tileNear(cam, [hash01(i, 31), hash01(i, 32), hash01(i, 33)], STAR_CELL, STAR_AHEAD);
    const a = project(cam, p, size);
    if (!a) continue;
    const k = Math.min(1, 3 / a.dz);
    const alpha = (0.25 + 0.6 * k) * edgeFade(edge) * fade;
    if (!(alpha > 0.01)) continue;
    ctx.globalAlpha = alpha;
    const lwd = Math.max(0.7, k * S * 0.004);
    const b = prev ? project(prev, p, size) : null;
    const len = b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
    if (b && len > lwd * 1.5 && len < S * 0.6) { ctx.lineWidth = lwd; ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(a.x, a.y); ctx.stroke(); }
    else { ctx.beginPath(); ctx.arc(a.x, a.y, lwd * 0.6, 0, Math.PI * 2); ctx.fill(); }
  }
}

const FAR = 32;      // これより遠い物は描かない（もやで地の色に溶けきっている）
const LITE_FAR = 16; // 軽い描き方（ぶれの重ね描き）では近い物だけ

/** 立体物：layer.objects（{kind, pos, size, rot, spin, color}）を、奥の物から中抜きで描く（光る辺・透ける面・線の球） */
export function fxSolids(ctx, t, layer, scene, env) {
  const w = env?.width, h = env?.height, cam = env?.cam;
  if (!(w > 0 && h > 0 && Number.isFinite(w) && Number.isFinite(h)) || !Array.isArray(cam?.pos)) return;
  const fade = layerAlpha(t, layer);
  if (!(fade > 0) || !Array.isArray(layer.objects)) return;
  const size = { width: w, height: h };
  const ink = { bg: env.ink?.bg ?? '#000000', fg: env.ink?.fg ?? '#F4F4F4', accent: env.ink?.accent ?? env.ink?.fg ?? '#F4F4F4' };
  const far = env.lite ? LITE_FAR : FAR;
  const items = [];
  for (const o of layer.objects) {
    if (!o || !Array.isArray(o.pos) || !o.pos.every(Number.isFinite)) continue;
    const d = solidDepth(o, cam, size);
    if (Number.isFinite(d) && d < far) items.push({ o, d });
  }
  items.sort((a, b) => b.d - a.d);
  const c = dimmed(ctx, fade);
  for (const { o } of items) {
    ctx.save();
    if (fade < 1) ctx.globalAlpha = fade;
    drawSolid(c, o, cam, size, ink, t, { hollow: true });
    ctx.restore();
  }
}
