// 幾何学模様：敷き詰め（和柄の線画・タイル・図形の散らし）
import { TAU, pulse, beatNo, hash, lw, poly, star, circle, line, path, pen, ink } from './kit.js';

// 画面を c の大きさで敷く（はみ出す分も足す）
function tile(e, c, fn, shiftRow = 0) {
  for (let j = -1; j * c < e.h + c; j++) for (let i = -1; i * c < e.w + c; i++) fn(i * c + (j % 2 ? shiftRow : 0), j * c, i, j);
}

export const TILES = [
  { id: 'seigaiha', name: '青海波', draw(ctx, e) {
    const r = e.S * 0.09, sh = (e.t * e.S * 0.02) % (r * 2), p = pulse(e);
    for (let j = -1; j * r * 0.5 < e.h + r; j++) for (let i = -1; i * r * 2 < e.w + r * 2; i++) {
      const x = i * r * 2 + (j % 2 ? r : 0) + sh, y = j * r * 0.5;
      for (let k = 4; k >= 1; k--) { pen(ctx, k === 4 && hash(i, j, beatNo(e)) < 0.08 ? e.accent : e.fg, lw(e, 0.003), 0.8); ink(ctx, e.bg, 1); ctx.beginPath(); ctx.arc(x, y, r * k / 4 * (k === 4 ? 1 + 0.05 * p : 1), Math.PI, 0); ctx.fill(); ctx.globalAlpha = 0.8; ctx.stroke(); }
    }
  } },
  { id: 'asanoha', name: '麻の葉', draw(ctx, e) {
    const r = e.S * 0.1, dx = r * Math.sqrt(3), dy = r * 1.5, rot = Math.sin(e.t * 0.3) * 0.05;
    ctx.save(); ctx.translate(e.cx, e.cy); ctx.rotate(rot); ctx.translate(-e.cx, -e.cy);
    for (let j = -2; j * dy < e.h + r * 2; j++) for (let i = -2; i * dx < e.w + r * 2; i++) {
      const x = i * dx + (j % 2 ? dx / 2 : 0), y = j * dy;
      const hot = hash(i, j, beatNo(e)) < 0.05;
      pen(ctx, hot ? e.accent : e.fg, lw(e, hot ? 0.005 : 0.0025), hot ? 0.6 + 0.4 * pulse(e) : 0.7);
      for (let k = 0; k < 6; k++) { const a = Math.PI / 6 + k * TAU / 6; line(ctx, x, y, x + Math.cos(a) * r, y + Math.sin(a) * r); ctx.stroke(); const b = a + Math.PI / 6; line(ctx, x, y, x + Math.cos(b) * r * 0.58, y + Math.sin(b) * r * 0.58); ctx.stroke(); line(ctx, x + Math.cos(a) * r, y + Math.sin(a) * r, x + Math.cos(b) * r * 0.58, y + Math.sin(b) * r * 0.58); ctx.stroke(); }
    }
    ctx.restore();
  } },
  { id: 'shippo', name: '七宝', draw(ctx, e) {
    const c = e.S * 0.12, p = pulse(e);
    tile(e, c, (x, y, i, j) => {
      pen(ctx, (i + j + beatNo(e)) % 9 === 0 ? e.accent : e.fg, lw(e, 0.003), 0.75);
      circle(ctx, x, y, c / Math.SQRT2 * (1 + 0.03 * p)); ctx.stroke();
      if ((i + j) % 2 === 0) { ink(ctx, e.fg, 0.12); circle(ctx, x + c / 2, y + c / 2, c * 0.12); ctx.fill(); }
    });
  } },
  { id: 'uroko', name: '鱗', draw(ctx, e) {
    const c = e.S * 0.1, h = c * 0.9, b = beatNo(e);
    for (let j = -1; j * h < e.h + h; j++) for (let i = -1; i * c < e.w + c; i++) {
      const x = i * c + (j % 2 ? c / 2 : 0), y = j * h;
      const on = (i + j * 3 + b) % 4 === 0;
      ink(ctx, on ? e.accent : e.fg, on ? 0.5 + 0.4 * pulse(e) : 0.18);
      path(ctx, [[x, y], [x + c / 2, y + h], [x - c / 2, y + h]], true); ctx.fill();
    }
  } },
  { id: 'kagome', name: '籠目', draw(ctx, e) {
    const s = e.S * 0.12, h = s * Math.sqrt(3) / 2, off = (e.t * e.S * 0.03) % s;
    pen(ctx, e.fg, lw(e, 0.005), 0.8);
    for (let k = -30; k < 30; k++) {
      line(ctx, -e.w, k * h * 2 + off, e.w * 2, k * h * 2 + off); ctx.stroke();
      ctx.save(); ctx.translate(e.cx, e.cy);
      for (const a of [Math.PI / 3, -Math.PI / 3]) { ctx.save(); ctx.rotate(a); pen(ctx, a > 0 ? e.fg : e.accent, lw(e, 0.005), 0.7); line(ctx, -e.w * 2, k * h * 2 - off, e.w * 2, k * h * 2 - off); ctx.stroke(); ctx.restore(); }
      ctx.restore();
    }
    pen(ctx, e.accent, lw(e, 0.006), pulse(e)); star(ctx, e.cx, e.cy, s * 1.2, 6, 0.58, 0); ctx.stroke();
  } },
  { id: 'truchet-tri', name: '三角のトルシェ', draw(ctx, e) {
    const c = e.S * 0.1, b = beatNo(e);
    tile(e, c, (x, y, i, j) => {
      const r = Math.floor(hash(i, j, b >> 1) * 4);
      const pts = [[x, y], [x + c, y], [x + c, y + c], [x, y + c]];
      ink(ctx, (i + j) % 7 === 0 ? e.accent : e.fg, 0.55);
      path(ctx, [pts[r], pts[(r + 1) % 4], pts[(r + 2) % 4]], true); ctx.fill();
    });
  } },
  { id: 'pinwheel', name: '風車', draw(ctx, e) {
    const c = e.S * 0.16;
    tile(e, c, (x, y, i, j) => {
      ctx.save(); ctx.translate(x + c / 2, y + c / 2); ctx.rotate(e.t * ((i + j) % 2 ? 1 : -1) + pulse(e) * 0.5);
      for (let k = 0; k < 4; k++) { ctx.rotate(Math.PI / 2); ink(ctx, k % 2 ? e.fg : e.accent, 0.55); path(ctx, [[0, 0], [c * 0.4, 0], [0, -c * 0.4]], true); ctx.fill(); }
      ctx.restore();
    });
  } },
  { id: 'islamic-star', name: '八芒星の網', draw(ctx, e) {
    const c = e.S * 0.16, p = pulse(e);
    tile(e, c, (x, y, i, j) => {
      pen(ctx, (i + j + beatNo(e)) % 7 === 0 ? e.accent : e.fg, lw(e, 0.003), 0.8);
      star(ctx, x, y, c * 0.5 * (1 + 0.05 * p), 8, 0.7, Math.PI / 8); ctx.stroke();
      poly(ctx, x, y, c * 0.25, 8, Math.PI / 8 + e.t * 0.3); ctx.stroke();
    });
  } },
  { id: 'square-spiral', name: '四角の渦', draw(ctx, e) {
    const c = e.S * 0.2;
    tile(e, c, (x, y, i, j) => {
      const pts = []; let len = c * 0.9, a = (i + j) % 2 ? e.t : -e.t, px = x - c * 0.45, py = y - c * 0.45;
      for (let k = 0; k < 14; k++) { pts.push([px, py]); px += Math.cos(k * Math.PI / 2) * len; py += Math.sin(k * Math.PI / 2) * len; len *= 0.85; }
      ctx.save(); ctx.translate(x, y); ctx.rotate(a * 0.3); ctx.translate(-x, -y);
      pen(ctx, (i * 3 + j + beatNo(e)) % 8 === 0 ? e.accent : e.fg, lw(e, 0.004), 0.8); path(ctx, pts); ctx.stroke(); ctx.restore();
    });
  } },
  { id: 'circle-pack', name: '円の詰め合わせ', draw(ctx, e) {
    // 2026-10-20 持ち主「動かしてくれー」：円がそれぞれ小さく回って漂い、ふくらんだり縮んだりする（小節の頭でいくつかはじける）
    const b = beatNo(e), p = pulse(e);
    for (let k = 0; k < 70; k++) {
      const orbit = e.S * (0.01 + 0.03 * hash(k, 6)), sp = (0.3 + 0.8 * hash(k, 7)) * (k % 2 ? 1 : -1);
      const x = hash(k, 1) * e.w + Math.cos(e.t * sp + k) * orbit, y = hash(k, 2) * e.h + Math.sin(e.t * sp + k) * orbit;
      const breathe = 1 + 0.25 * Math.sin(e.t * (0.8 + hash(k, 8)) + k * 2);
      const pop = hash(k, b) < 0.25 ? 0.5 * p : 0;
      const r = e.S * (0.015 + 0.07 * hash(k, 3) ** 2) * (breathe + pop);
      pen(ctx, hash(k, 4) < 0.15 ? e.accent : e.fg, lw(e, 0.003), 0.8); circle(ctx, x, y, r); ctx.stroke();
      if (hash(k, 5) < 0.3) { ink(ctx, e.fg, 0.2); circle(ctx, x, y, r * 0.5); ctx.fill(); }
    }
  } },
  { id: 'bauhaus', name: '半円と四角', draw(ctx, e) {
    // 2026-10-20 持ち主「？？？」：わかりやすく、大きな升目に半円・四分円・丸・四角を置き、
    // 小節ごとに升目が 1 つずつ 90 度なめらかに回る（ポスターの図形が動く感じ）
    const cols = 3, c = e.w / cols, rows = Math.ceil(e.h / c) + 1, oy = (e.h - rows * c) / 2;
    const bn = beatNo(e), ph = Math.min(1, e.beat.phase * 4), ease = ph * ph * (3 - 2 * ph);
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const id = j * cols + i, kind = Math.floor(hash(i, j, 7) * 4);
      const turnsDone = Math.floor((bn + id * 5) / (cols * rows)) + Math.floor(hash(i, j, 3) * 4);
      const turning = (bn % (cols * rows)) === ((cols * rows - id * 5 % (cols * rows)) % (cols * rows));
      const a = (turnsDone + (turning ? ease : 0)) * Math.PI / 2;
      const x = i * c + c / 2, y = oy + j * c + c / 2;
      pen(ctx, e.fg, lw(e, 0.004), 0.5); ctx.strokeRect(x - c / 2, y - c / 2, c, c);
      ctx.save(); ctx.translate(x, y); ctx.rotate(a);
      ink(ctx, (i + j) % 3 === 0 ? e.accent : e.fg, 0.8);
      if (kind === 0) { ctx.beginPath(); ctx.arc(0, c / 2, c / 2 * 0.95, Math.PI, 0); ctx.fill(); }
      else if (kind === 1) { ctx.beginPath(); ctx.moveTo(-c / 2, -c / 2); ctx.arc(-c / 2, -c / 2, c * 0.95, 0, Math.PI / 2); ctx.closePath(); ctx.fill(); }
      else if (kind === 2) { circle(ctx, 0, 0, c * 0.3); ctx.fill(); pen(ctx, e.fg, lw(e, 0.006), 0.9); circle(ctx, 0, 0, c * 0.42); ctx.stroke(); }
      else { ctx.fillRect(-c / 2, -c / 2, c / 2, c / 2); ctx.fillRect(0, 0, c / 2, c / 2); }
      ctx.restore();
    }
  } },
  { id: 'confetti-geo', name: '図形の紙吹雪', draw(ctx, e) {
    for (let k = 0; k < 60; k++) {
      const x = (hash(k, 1) * e.w + Math.sin(e.t + k) * e.S * 0.03), y = ((hash(k, 2) + e.t * (0.05 + 0.1 * hash(k, 3))) % 1.1 - 0.05) * e.h;
      const s = e.S * (0.015 + 0.02 * hash(k, 4)) * (1 + 0.4 * pulse(e)), kind = k % 4;
      ctx.save(); ctx.translate(x, y); ctx.rotate(e.t * (1 + hash(k, 5) * 3));
      pen(ctx, k % 5 === 0 ? e.accent : e.fg, lw(e, 0.004), 0.9);
      if (kind === 0) { circle(ctx, 0, 0, s); ctx.stroke(); } else if (kind === 1) { poly(ctx, 0, 0, s, 3); ctx.stroke(); } else if (kind === 2) { ctx.strokeRect(-s, -s, s * 2, s * 2); } else { line(ctx, -s, 0, s, 0); ctx.stroke(); line(ctx, 0, -s, 0, s); ctx.stroke(); }
      ctx.restore();
    }
  } },
  { id: 'kaleido', name: '万華鏡の三角', draw(ctx, e) {
    const n = 12, R = Math.hypot(e.w, e.h) / 2;
    for (let s = 0; s < n; s++) {
      ctx.save(); ctx.translate(e.cx, e.cy); ctx.rotate((s / n) * TAU); if (s % 2) ctx.scale(1, -1);
      for (let k = 0; k < 6; k++) {
        const r = R * ((k / 6 + e.t * 0.1) % 1), a = Math.sin(e.t + k) * 0.2 + 0.12;
        pen(ctx, k % 3 ? e.fg : e.accent, lw(e, 0.004), 0.8);
        path(ctx, [[r, 0], [r * Math.cos(a) * 1.15, r * Math.sin(a) * 1.15 * (1 + 0.5 * pulse(e))], [r * 1.25, 0]]); ctx.stroke();
      }
      ctx.restore();
    }
  } },
  { id: 'polka-grow', name: '育つ水玉', draw(ctx, e) {
    const c = e.S * 0.1, ph = e.beat.phase;
    tile(e, c, (x, y, i, j) => {
      const d = Math.hypot(x - e.cx, y - e.cy) / e.S;
      const g = Math.max(0, Math.sin((d * 6 - e.t * 2) % TAU)) * (0.6 + 0.4 * (1 - ph));
      ink(ctx, (i + j) % 9 === 0 ? e.accent : e.fg, 0.75); circle(ctx, x, y, c * 0.45 * g); ctx.fill();
    }, c / 2);
  } },
  { id: 'stairs-iso', name: '積み木の階段', draw(ctx, e) {
    const s = e.S * 0.08, b = beatNo(e);
    const iso = (i, j, k) => [e.cx + (i - j) * s * 0.87, e.cy * 0.9 + (i + j) * s * 0.5 - k * s];
    for (let j = -6; j < 7; j++) for (let i = -6; i < 7; i++) {
      const k = Math.max(0, Math.round(2 + Math.sin(i * 0.6 + e.t) + Math.cos(j * 0.5 - e.t * 0.7) + (hash(i, j, b) < 0.06 ? 2 * pulse(e) : 0)));
      const [x, y] = iso(i, j, k);
      ink(ctx, e.fg, 0.25); path(ctx, [[x, y], [x + s * 0.87, y + s * 0.5], [x, y + s], [x - s * 0.87, y + s * 0.5]], true); ctx.fill();
      pen(ctx, (i + j + b) % 11 === 0 ? e.accent : e.fg, lw(e, 0.003), 0.8); ctx.stroke();
    }
  } },
];
