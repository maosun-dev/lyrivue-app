// 境目の一瞬の効果（ヒット）：台本の scene.hits = [{t, kind, amp, dur}] を、その時刻の効き具合に直して絵に掛ける。
// kind：flash（白飛び）・invert（白黒反転）・chroma（色ずれ。文字が赤と青に割れる）・slice（横に裂けるグリッチ）・
//       shake（画面の揺れ）・zoom（ぐっと寄る突き）・bars（上下の黒帯が締まる）・echo（文字の残像）
//       文字だけに掛かるもの（2026-10-18、render/parts/text-fx.js の hit）：scramble（文字化け）・blink（点滅）・slicetext（文字が横に裂ける）・
//       zoomblur（文字が放射状にぶれる）・band（色の帯が走る）・wide（横に伸びる）・ghost（横のぶれの写し）・negative（箱に抜き文字）・mirror（左右反転）
// 効き具合は出だしが最大で、dur 秒で 0 に落ちる。同じ種類が重なったら大きいほう。
import { hash01 } from './rand.js';

export const TEXT_HIT_KINDS = ['scramble', 'blink', 'slicetext', 'zoomblur', 'band', 'wide', 'ghost', 'negative', 'mirror'];
export const HIT_KINDS = ['flash', 'invert', 'chroma', 'slice', 'shake', 'zoom', 'bars', 'echo', ...TEXT_HIT_KINDS];
const STEP = 1 / 24; // 揺れ・裂けの乱れが変わる間隔（秒。コマ打ちのようにカクカク変わる）

/** 時刻 t の効き具合 {kind: 0〜1} */
export function hitsAt(scene, t) {
  const out = {};
  for (const k of HIT_KINDS) out[k] = 0;
  const list = Array.isArray(scene?.hits) ? scene.hits : [];
  if (!Number.isFinite(t)) return out;
  for (const h of list) {
    if (!h || !(h.kind in out) || !Number.isFinite(h.t)) continue;
    const dur = Number.isFinite(h.dur) && h.dur > 0 ? h.dur : 0.2;
    const u = t - h.t;
    if (!(u >= 0 && u < dur)) continue;
    const k = 1 - u / dur;
    const amp = Math.min(1.5, Math.max(0, Number.isFinite(h.amp) ? h.amp : 1));
    // 反転は「入ってすぐ切れる」ので形を変えない。ほかは出だしが強く、すっと落ちる
    const v = h.kind === 'invert' ? amp : amp * k * k;
    if (v > out[h.kind]) out[h.kind] = v;
  }
  return out;
}

/** 揺れ・突きをカメラに掛ける（cam を書き換える） */
export function applyHitCamera(cam, a, t) {
  if (!cam || !a) return cam;
  const step = Math.floor(t / STEP);
  if (a.shake > 0) {
    const s = a.shake;
    cam.pos = [cam.pos[0] + (hash01(step, 1) - 0.5) * 0.12 * s, cam.pos[1] + (hash01(step, 2) - 0.5) * 0.12 * s, cam.pos[2]];
    cam.roll += (hash01(step, 3) - 0.5) * 0.12 * s;
  }
  if (a.zoom > 0) cam.zoom *= 1 + 0.45 * a.zoom;
  return cam;
}

/**
 * 描き終えた絵の上に掛ける効果（白飛び・反転・裂け・黒帯）。size は描く先の大きさ（画素）。
 * 裂けは描いた絵を自分の上にずらして写す（ctx.canvas が使えるときだけ）。
 */
export function drawHitsPost(ctx, a, size, t) {
  const { width: w, height: h } = size ?? {};
  if (!a || !(w > 0 && h > 0)) return;
  const step = Math.floor(t / STEP);
  if (a.slice > 0.02) {
    const cv = ctx.canvas;
    if (cv && cv.width > 0 && cv.height > 0 && typeof cv.getContext === 'function') {
      const kx = cv.width / w, ky = cv.height / h; // 画面の拡大（端末の画素の密度）に合わせて元の絵を切り出す
      const n = 3 + Math.round(5 * Math.min(1, a.slice));
      ctx.save();
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      for (let i = 0; i < n; i++) {
        const y = hash01(step, i, 11) * h;
        const bh = h * (0.015 + 0.08 * hash01(step, i, 12));
        const dx = (hash01(step, i, 13) - 0.5) * 0.25 * w * a.slice;
        const sy = Math.max(0, Math.min(cv.height - 1, y * ky));
        const sh = Math.max(1, Math.min(cv.height - sy, bh * ky));
        ctx.drawImage(cv, 0, sy, cv.width, sh, dx, sy / ky, w, sh / ky);
      }
      ctx.restore();
    }
  }
  if (a.invert > 0.5) {
    ctx.save();
    ctx.globalCompositeOperation = 'difference';
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }
  // 黒帯は反転のあと（反転で白くならないように）
  if (a.bars > 0.01) {
    const bh = h * 0.13 * Math.min(1, a.bars);
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, w, bh);
    ctx.fillRect(0, h - bh, w, bh);
    ctx.restore();
  }
  if (a.flash > 0.01) {
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = Math.min(1, a.flash);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }
}
