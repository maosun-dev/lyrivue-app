// 幾何学模様：線（縞・光線・枠・速さの線）
import { TAU, pulse, barPhase, beatNo, hash, lw, line, path, pen, ink, poly, circle } from './kit.js';

export const LINES = [
  { id: 'stripe-sweep', name: '斜めの縞が流れる', draw(ctx, e) {
    const w = e.S * 0.06, sh = (e.t * e.S * 0.3) % (w * 2), p = pulse(e);
    ctx.save(); ctx.translate(e.cx, e.cy); ctx.rotate(-0.6);
    const R = Math.hypot(e.w, e.h);
    for (let x = -R; x < R; x += w * 2) { ink(ctx, Math.round((x + R) / (w * 2)) % 5 === 0 ? e.accent : e.fg, 0.25 + 0.35 * p); ctx.fillRect(x + sh, -R, w, R * 2); }
    ctx.restore();
  } },
  { id: 'speed-lines', name: '集中線', draw(ctx, e) {
    // 2026-10-20 持ち主「もっと疾走感」：線が 1 秒に 12 回引き直され、中心から外へ速く流れる筋が重なる（強いほど速い）
    const R = Math.hypot(e.w, e.h) / 2, flick = Math.floor(e.t * 12);
    for (let i = 0; i < 70; i++) {
      const a = hash(i, flick) * TAU, r0 = R * (0.3 + 0.35 * hash(i, flick, 2));
      ink(ctx, i % 13 === 0 ? e.accent : e.fg, 0.75);
      const w = 0.004 + 0.01 * hash(i, 9);
      ctx.beginPath(); ctx.moveTo(e.cx + Math.cos(a - w) * R * 1.1, e.cy + Math.sin(a - w) * R * 1.1); ctx.lineTo(e.cx + Math.cos(a) * r0, e.cy + Math.sin(a) * r0); ctx.lineTo(e.cx + Math.cos(a + w) * R * 1.1, e.cy + Math.sin(a + w) * R * 1.1); ctx.fill();
    }
    const sp = 1.5 + 2.5 * e.energy;
    for (let i = 0; i < 90; i++) {
      const ph = (e.t * sp * (0.7 + 0.6 * hash(i, 3)) + hash(i, 4)) % 1;
      const a = hash(i, 5, Math.floor(e.t * sp * (0.7 + 0.6 * hash(i, 3)) + hash(i, 4))) * TAU;
      const r1 = R * (0.15 + ph * 1.1), r0 = r1 - R * (0.05 + 0.25 * ph);
      pen(ctx, i % 9 === 0 ? e.accent : e.fg, lw(e, 0.002 + 0.004 * ph), ph);
      line(ctx, e.cx + Math.cos(a) * r0, e.cy + Math.sin(a) * r0, e.cx + Math.cos(a) * r1, e.cy + Math.sin(a) * r1); ctx.stroke();
    }
  } },
  { id: 'zigzag', name: 'ジグザグ', draw(ctx, e) {
    const n = 12, step = e.S * 0.08;
    for (let k = 0; k < n; k++) {
      const y0 = (k / n) * e.h + ((e.t * e.S * 0.08) % (e.h / n)), amp = e.S * 0.03 * (1 + pulse(e));
      const pts = []; for (let x = -step, i = 0; x < e.w + step; x += step, i++) pts.push([x, y0 + (i % 2 ? amp : -amp)]);
      pen(ctx, k % 4 === 0 ? e.accent : e.fg, lw(e, 0.006), 0.85); path(ctx, pts); ctx.stroke();
    }
  } },
  { id: 'lasers', name: '交差する光線', draw(ctx, e) {
    const b = beatNo(e), p = pulse(e);
    for (let k = 0; k < 10; k++) {
      const x0 = hash(k, 1) * e.w, a = (hash(k, b >> 1) - 0.5) * 1.6 + Math.sin(e.t * (0.5 + hash(k, 3))) * 0.4;
      pen(ctx, k % 3 ? e.fg : e.accent, lw(e, 0.004 + 0.01 * p), 0.6 + 0.4 * p);
      line(ctx, x0, e.h * 1.05, x0 + Math.sin(a) * e.h * 1.3, e.h * 1.05 - Math.cos(a) * e.h * 1.3); ctx.stroke();
    }
  } },
  { id: 'frame-zoom', name: '枠のズーム', draw(ctx, e) {
    const sp = (e.t * 0.8) % 1;
    for (let k = 0; k < 10; k++) {
      const s = Math.pow(1.45, k - sp) * 0.04;
      const hw = e.w / 2 * s * 4, hh = e.h / 2 * s * 4;
      pen(ctx, (k + beatNo(e)) % 5 === 0 ? e.accent : e.fg, lw(e, 0.003 + 0.004 * s * 4), Math.min(1, s * 6));
      ctx.strokeRect(e.cx - hw, e.cy - hh, hw * 2, hh * 2);
    }
  } },
  { id: 'slash-x', name: '斜めの一閃', draw(ctx, e) {
    const b = beatNo(e), ph = e.beat.phase, R = Math.hypot(e.w, e.h);
    const a = (b % 2 ? 0.7 : -0.7) + (hash(b, 1) - 0.5) * 0.4;
    const reach = Math.min(1, ph * 4);
    ctx.save(); ctx.translate(e.cx, e.cy); ctx.rotate(a);
    ink(ctx, e.accent, 1 - ph); ctx.fillRect(-R / 2, -e.S * 0.02 * (1 - ph), R * reach, e.S * 0.04 * (1 - ph));
    pen(ctx, e.fg, lw(e, 0.003), 0.6); line(ctx, -R / 2, e.S * 0.05, R / 2, e.S * 0.05); ctx.stroke(); line(ctx, -R / 2, -e.S * 0.05, R / 2, -e.S * 0.05); ctx.stroke();
    ctx.restore();
  } },
  { id: 'corner-brackets', name: '四隅のかぎ', draw(ctx, e) {
    const p = pulse(e), m = e.S * (0.06 + 0.05 * (1 - p)), L = e.S * 0.12;
    for (let k = 0; k < 3; k++) {
      const mm = m + k * e.S * 0.05;
      pen(ctx, k ? e.fg : e.accent, lw(e, 0.008 - k * 0.002), 1 - k * 0.3);
      for (const [sx, sy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
        const x = sx > 0 ? mm : e.w - mm, y = sy > 0 ? mm : e.h - mm;
        path(ctx, [[x, y + sy * L], [x, y], [x + sx * L, y]]); ctx.stroke();
      }
    }
    pen(ctx, e.fg, lw(e, 0.003), 0.7); line(ctx, e.cx - e.S * 0.05, e.cy, e.cx + e.S * 0.05, e.cy); ctx.stroke(); line(ctx, e.cx, e.cy - e.S * 0.05, e.cx, e.cy + e.S * 0.05); ctx.stroke();
  } },
  { id: 'light-sweep', name: '光の掃き', draw(ctx, e) {
    const x = (barPhase(e) * 1.4 - 0.2) * e.w;
    for (let k = 0; k < 30; k++) { ink(ctx, e.fg, (1 - k / 30) * 0.12); ctx.fillRect(x - k * e.S * 0.01, 0, e.S * 0.01, e.h); }
    ink(ctx, e.accent, 0.9); ctx.fillRect(x, 0, e.S * 0.008, e.h);
    pen(ctx, e.fg, lw(e, 0.002), 0.4);
    for (let y = 0; y < e.h; y += e.S * 0.04) { line(ctx, 0, y, x, y); ctx.stroke(); }
  } },
  { id: 'glitch-lines', name: '崩れる線', draw(ctx, e) {
    const b = beatNo(e), p = pulse(e, 3);
    for (let k = 0; k < 40; k++) {
      const y = hash(k, b) * e.h, x = hash(k, b, 1) * e.w, w = e.w * (0.05 + 0.4 * hash(k, b, 2)) * (0.3 + p);
      ink(ctx, hash(k, 4) < 0.2 ? e.accent : e.fg, 0.4 + 0.5 * p);
      ctx.fillRect(x - w / 2 + (hash(k, Math.floor(e.t * 20)) - 0.5) * e.S * 0.05 * p, y, w, e.S * (0.003 + 0.01 * hash(k, 5)));
    }
  } },
  { id: 'h-meter', name: '横の目盛り', draw(ctx, e) {
    const n = 30, b = beatNo(e);
    for (let k = 0; k < n; k++) {
      const y = (k + 0.5) / n * e.h, v = Math.abs(Math.sin(k * 0.5 + e.t * 2)) * (0.3 + 0.7 * pulse(e) * hash(k, b));
      ink(ctx, v > 0.75 ? e.accent : e.fg, 0.8);
      ctx.fillRect(e.cx - e.w * 0.45 * v, y, e.w * 0.9 * v, e.h / n * 0.35);
    }
  } },
  { id: 'dash-marquee', name: '流れる破線', draw(ctx, e) {
    for (let k = 0; k < 14; k++) {
      const y = (k + 0.5) / 14 * e.h, sp = (k % 2 ? 1 : -1) * (0.2 + 0.1 * (k % 3));
      ctx.setLineDash([e.S * (0.02 + 0.04 * hash(k, 1)), e.S * 0.03]); ctx.lineDashOffset = e.t * sp * e.S;
      pen(ctx, k % 5 === 0 ? e.accent : e.fg, lw(e, 0.008 * (1 + pulse(e))), 0.8); line(ctx, 0, y, e.w, y); ctx.stroke();
    }
    ctx.setLineDash([]);
  } },
  { id: 'chevrons', name: '山形の矢', draw(ctx, e) {
    const step = e.S * 0.08, off = (e.t * e.S * 0.25) % step;
    for (let k = -2; k * step < e.h + step * 2; k++) {
      const y = k * step - off + e.S * 0.04;
      pen(ctx, (k + beatNo(e)) % 6 === 0 ? e.accent : e.fg, lw(e, 0.012), 0.7);
      path(ctx, [[e.cx - e.S * 0.3, y + e.S * 0.12], [e.cx, y], [e.cx + e.S * 0.3, y + e.S * 0.12]]); ctx.stroke();
    }
  } },
  { id: 'fan', name: '扇', draw(ctx, e) {
    const n = 18, p = pulse(e, 3), spread = Math.PI * (0.3 + 0.6 * p);
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 - spread / 2 + spread * (i / (n - 1));
      pen(ctx, i % 4 ? e.fg : e.accent, lw(e, 0.005), 0.85);
      line(ctx, e.cx, e.h * 0.95, e.cx + Math.cos(a) * e.h, e.h * 0.95 + Math.sin(a) * e.h); ctx.stroke();
    }
  } },
  { id: 'op-art', name: '目の錯覚の縞', draw(ctx, e) {
    const n = 40;
    for (let k = 0; k < n; k++) {
      const pts = []; for (let i = 0; i <= 60; i++) { const x = (i / 60) * e.w; const bulge = Math.exp(-Math.pow((x - e.cx) / (e.S * 0.25), 2)) * e.S * 0.05 * (1 + pulse(e)) * Math.sin(e.t * 1.5); pts.push([x, (k / n) * e.h + bulge * Math.sin(k / n * Math.PI)]); }
      pen(ctx, e.fg, lw(e, 0.004), 0.8); path(ctx, pts); ctx.stroke();
    }
  } },
  { id: 'sunburst', name: '後光', draw(ctx, e) {
    // 2026-10-20 持ち主「AI くさい」：均等な扇をやめ、太さも長さも不ぞろいな光の帯を重ね、根元に網点の輪を置く
    const R = Math.hypot(e.w, e.h), rot = e.t * 0.08;
    for (let i = 0; i < 26; i++) {
      const a = rot + hash(i, 1) * TAU, wdt = 0.015 + 0.09 * hash(i, 2) ** 2, len = R * (0.4 + 0.6 * hash(i, 3));
      const sway = Math.sin(e.t * (0.4 + hash(i, 4)) + i) * 0.03;
      ink(ctx, hash(i, 5) < 0.18 ? e.accent : e.fg, 0.1 + 0.18 * hash(i, 6) + 0.1 * pulse(e));
      ctx.beginPath(); ctx.moveTo(e.cx, e.cy); ctx.arc(e.cx, e.cy, len, a + sway, a + sway + wdt); ctx.closePath(); ctx.fill();
      if (hash(i, 7) < 0.3) { pen(ctx, e.fg, lw(e, 0.002), 0.5); line(ctx, e.cx, e.cy, e.cx + Math.cos(a + sway - 0.01) * len, e.cy + Math.sin(a + sway - 0.01) * len); ctx.stroke(); }
    }
    for (let k = 0; k < 3; k++) for (let i = 0; i < 40 + k * 16; i++) {
      const a = (i / (40 + k * 16)) * TAU - rot * 2, r = e.S * (0.1 + k * 0.045);
      ink(ctx, e.fg, 0.7 - k * 0.2); circle(ctx, e.cx + Math.cos(a) * r, e.cy + Math.sin(a) * r, e.S * (0.008 - k * 0.002)); ctx.fill();
    }
  } },
  { id: 'arrows', name: '矢印の流れ', draw(ctx, e) {
    const c = e.S * 0.12, off = (e.t * e.S * 0.2) % c;
    for (let y = -c; y < e.h + c; y += c) for (let x = -c; x < e.w + c; x += c) {
      const hot = hash(Math.round(x / c), Math.round(y / c), beatNo(e)) < 0.08;
      ink(ctx, hot ? e.accent : e.fg, hot ? 1 : 0.35);
      ctx.save(); ctx.translate(x + off, y); ctx.beginPath(); ctx.moveTo(-c * 0.25, -c * 0.2); ctx.lineTo(c * 0.15, 0); ctx.lineTo(-c * 0.25, c * 0.2); ctx.lineTo(-c * 0.12, 0); ctx.closePath(); ctx.fill(); ctx.restore();
    }
  } },
  { id: 'nested-diamond', name: 'ひし形の入れ子', draw(ctx, e) {
    for (let k = 0; k < 12; k++) {
      const r = e.S * 0.05 * (k + 1 - e.beat.phase);
      pen(ctx, k === 0 ? e.accent : e.fg, lw(e, 0.005), 1 - k / 12);
      poly(ctx, e.cx, e.cy, r, 4, Math.PI / 4 * 0 + (k % 2 ? 0 : 0)); ctx.stroke();
    }
  } },
];
