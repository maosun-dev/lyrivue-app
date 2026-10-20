// 幾何学模様：格子（方眼・升目・点の並び）
import { TAU, pulse, barPhase, beatNo, hash, lw, poly, circle, line, path, pen, ink } from './kit.js';

// 画面を cell の大きさの升目に分けて、升目ごとに fn(x, y, i, j) を呼ぶ（画面からはみ出す分も 1 つ足す）
function cells(e, cell, fn) {
  const nx = Math.ceil(e.w / cell) + 1, ny = Math.ceil(e.h / cell) + 1;
  const ox = (e.w - (nx - 1) * cell) / 2, oy = (e.h - (ny - 1) * cell) / 2;
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) fn(ox + i * cell, oy + j * cell, i, j, nx, ny);
}

export const GRID = [
  { id: 'wave-grid', name: '波打つ方眼', draw(ctx, e) {
    const p = pulse(e), c = e.S * 0.08, amp = e.S * (0.015 + 0.04 * p);
    pen(ctx, e.fg, lw(e, 0.003), 0.8);
    for (let y = -c; y < e.h + c; y += c) {
      const pts = []; for (let x = 0; x <= e.w; x += c / 4) pts.push([x, y + Math.sin(x / e.S * 8 + e.t * 3 + y / e.S * 4) * amp]);
      path(ctx, pts); ctx.stroke();
    }
    pen(ctx, e.accent, lw(e, 0.003), 0.6);
    for (let x = -c; x < e.w + c; x += c) {
      const pts = []; for (let y = 0; y <= e.h; y += c / 4) pts.push([x + Math.sin(y / e.S * 8 + e.t * 3 + x / e.S * 4) * amp, y]);
      path(ctx, pts); ctx.stroke();
    }
  } },
  { id: 'dot-matrix', name: '点の電光板', draw(ctx, e) {
    const c = e.S * 0.05, b = beatNo(e);
    cells(e, c, (x, y, i, j) => {
      const d = Math.hypot(x - e.cx, y - e.cy) / e.S;
      const on = Math.sin(d * 18 - e.t * 6) > 0.4 - 0.5 * pulse(e) || hash(i, j, b) < 0.05;
      ink(ctx, on ? (hash(i, j) < 0.2 ? e.accent : e.fg) : e.fg, on ? 0.95 : 0.12);
      circle(ctx, x, y, c * 0.32); ctx.fill();
    });
  } },
  { id: 'checker-flip', name: '市松のめくれ', draw(ctx, e) {
    const c = e.S * 0.12, b = beatNo(e), p = pulse(e, 3);
    cells(e, c, (x, y, i, j) => {
      if ((i + j + b) % 2) return;
      const s = (1 - p * (hash(i, j, b) < 0.5 ? 1 : 0.3)) * c * 0.46;
      ink(ctx, (i * 7 + j * 3 + b) % 5 === 0 ? e.accent : e.fg, 0.75);
      ctx.fillRect(x - s, y - s, s * 2, s * 2);
    });
  } },
  { id: 'plus-field', name: '十字の畑', draw(ctx, e) {
    const c = e.S * 0.09;
    cells(e, c, (x, y, i, j) => {
      const r = c * 0.3 * (0.6 + 0.6 * Math.abs(Math.sin(e.t * 2 + i * 0.5 + j * 0.3)));
      pen(ctx, (i + j + beatNo(e)) % 7 === 0 ? e.accent : e.fg, lw(e, 0.004), 0.8);
      ctx.save(); ctx.translate(x, y); ctx.rotate((i + j) % 2 ? e.t : -e.t);
      line(ctx, -r, 0, r, 0); ctx.stroke(); line(ctx, 0, -r, 0, r); ctx.stroke(); ctx.restore();
    });
  } },
  { id: 'perspective-floor', name: '走る床', draw(ctx, e) {
    // 2026-10-20 持ち主「斬新！何したらいいのかな」：地平線に縞の太陽と山の線を足し、床の上を走る道（夜のドライブ）にする
    const hz = e.h * 0.55, p = pulse(e);
    // 縞の太陽（下ほど切れ目が太い）
    const sr = e.S * 0.22, sy = hz - sr * 0.55;
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, e.w, hz); ctx.clip();
    for (let k = 0; k < 14; k++) {
      const y = sy - sr + (k / 14) * sr * 2, gap = k > 6 ? (k - 6) * 0.004 * e.S : 0;
      const half = Math.sqrt(Math.max(0, sr * sr - (y - sy) ** 2));
      ink(ctx, k > 8 ? e.accent : e.fg, 0.85); ctx.fillRect(e.cx - half, y, half * 2, sr * 2 / 14 - gap);
    }
    // 山の線（ゆっくり流れる）
    const mpts = [];
    for (let i = 0; i <= 40; i++) { const x = (i / 40) * e.w; const u = i / 40 * 6 + e.t * 0.05; mpts.push([x, hz - e.S * (0.05 + 0.08 * Math.abs(Math.sin(u * 1.7) * Math.cos(u * 0.9)))]); }
    pen(ctx, e.fg, lw(e, 0.004), 0.9); path(ctx, mpts); ctx.stroke();
    ctx.restore();
    // 床：奥へ集まる線と、手前へ流れてくる横線（強い所ほど速い）
    pen(ctx, e.fg, lw(e, 0.003), 0.8);
    for (let i = -14; i <= 14; i++) { line(ctx, e.cx + i * e.S * 0.01, hz, e.cx + i * e.S * 0.3, e.h); ctx.stroke(); }
    const sp = (e.t * (1 + 1.5 * e.energy)) % 1;
    for (let k = 0; k < 16; k++) { const z = (k + sp) / 16; const y = hz + (e.h - hz) * z * z; pen(ctx, e.fg, lw(e, 0.002 + 0.005 * z), z); line(ctx, 0, y, e.w, y); ctx.stroke(); }
    // 道の白線
    pen(ctx, e.accent, lw(e, 0.008), 0.6 + 0.4 * p);
    line(ctx, e.cx - e.S * 0.004, hz, e.cx - e.S * 0.12, e.h); ctx.stroke(); line(ctx, e.cx + e.S * 0.004, hz, e.cx + e.S * 0.12, e.h); ctx.stroke();
    pen(ctx, e.fg, lw(e, 0.004), 0.9); line(ctx, 0, hz, e.w, hz); ctx.stroke();
  } },
  { id: 'hex-honey', name: '蜂の巣', draw(ctx, e) {
    const r = e.S * 0.06, dx = r * Math.sqrt(3), dy = r * 1.5, b = beatNo(e);
    for (let j = -1; j * dy < e.h + r; j++) for (let i = -1; i * dx < e.w + r; i++) {
      const x = i * dx + (j % 2 ? dx / 2 : 0), y = j * dy;
      const hot = hash(i, j, b) < 0.06 + 0.1 * e.energy;
      pen(ctx, hot ? e.accent : e.fg, lw(e, hot ? 0.008 : 0.003), hot ? 1 : 0.5);
      poly(ctx, x, y, r * (hot ? 0.9 + 0.3 * pulse(e) : 0.92), 6, Math.PI / 6); ctx.stroke();
    }
  } },
  { id: 'tri-grid', name: '三角の網', draw(ctx, e) {
    const s = e.S * 0.12, h = s * Math.sqrt(3) / 2, b = beatNo(e);
    for (let j = -1; j * h < e.h + h; j++) for (let i = -1; i * s < e.w + s; i++) {
      const x = i * s + (j % 2 ? s / 2 : 0), y = j * h;
      const up = (i + j) % 2 === 0;
      const hot = hash(i, j, b) < 0.08;
      const f = (k) => [x + Math.cos(-Math.PI / 2 + k * TAU / 3 + (up ? 0 : Math.PI)) * s * 0.55, y + Math.sin(-Math.PI / 2 + k * TAU / 3 + (up ? 0 : Math.PI)) * s * 0.55];
      if (hot) { ink(ctx, e.accent, 0.7 * pulse(e, 3) + 0.2); path(ctx, [f(0), f(1), f(2)], true); ctx.fill(); }
      pen(ctx, e.fg, lw(e, 0.002), 0.55); path(ctx, [f(0), f(1), f(2)], true); ctx.stroke();
    }
  } },
  { id: 'bars-eq', name: '縦棒の音量', draw(ctx, e) {
    const n = 24, bw = e.w / n, b = beatNo(e);
    for (let i = 0; i < n; i++) {
      const v = 0.15 + 0.85 * Math.abs(Math.sin(i * 0.7 + e.t * 3)) * (0.4 + 0.6 * pulse(e) * hash(i, b)) * (0.5 + 0.5 * e.energy);
      const hgt = e.h * 0.6 * v;
      for (let k = 0; k * e.S * 0.025 < hgt; k++) { ink(ctx, k * e.S * 0.025 > hgt * 0.8 ? e.accent : e.fg, 0.85); ctx.fillRect(i * bw + bw * 0.15, e.cy + e.h * 0.25 - k * e.S * 0.025, bw * 0.7, e.S * 0.018); }
    }
  } },
  { id: 'crosshatch', name: '斜めの網', draw(ctx, e) {
    const c = e.S * 0.06, sh = (e.t * e.S * 0.05) % c, p = pulse(e);
    pen(ctx, e.fg, lw(e, 0.002 + 0.003 * p), 0.6);
    for (let k = -e.h; k < e.w + e.h; k += c) { line(ctx, k + sh, 0, k + sh - e.h, e.h); ctx.stroke(); }
    pen(ctx, e.accent, lw(e, 0.002 + 0.003 * p), 0.5);
    for (let k = -e.h; k < e.w + e.h; k += c * 2) { line(ctx, k - sh, 0, k - sh + e.h, e.h); ctx.stroke(); }
  } },
  { id: 'pixel-rain', name: '升目の雨', draw(ctx, e) {
    const c = e.S * 0.04, cols = Math.ceil(e.w / c);
    for (let i = 0; i < cols; i++) {
      const sp = 0.5 + hash(i, 1) * 1.5, head = ((e.t * sp + hash(i, 2) * 10) % 1.4) * e.h;
      for (let k = 0; k < 12; k++) {
        const y = head - k * c; if (y < -c || y > e.h) continue;
        ink(ctx, k === 0 ? e.accent : e.fg, (1 - k / 12) * 0.9);
        ctx.fillRect(i * c + c * 0.1, y, c * 0.8, c * 0.8);
      }
    }
  } },
  { id: 'ripple-dots', name: '波紋の点', draw(ctx, e) {
    const c = e.S * 0.06, ph = e.beat.phase;
    cells(e, c, (x, y) => {
      const d = Math.hypot(x - e.cx, y - e.cy) / e.S;
      const wv = Math.max(0, 1 - Math.abs(d - ph * 0.8) * 8);
      ink(ctx, wv > 0.5 ? e.accent : e.fg, 0.2 + 0.8 * wv);
      circle(ctx, x, y, c * (0.08 + 0.3 * wv)); ctx.fill();
    });
  } },
  { id: 'block-shift', name: 'ずれる積み木', draw(ctx, e) {
    const rows = 10, rh = e.h / rows, b = beatNo(e), p = pulse(e, 4);
    for (let r = 0; r < rows; r++) {
      const off = (hash(r, b) - 0.5) * e.w * 0.4 * p;
      for (let k = 0; k < 6; k++) {
        const x = ((k / 6) * e.w + off + r * 20) % e.w;
        ink(ctx, (r + k) % 5 === 0 ? e.accent : e.fg, 0.55);
        ctx.fillRect(x, r * rh + rh * 0.15, e.w / 6 * 0.6, rh * 0.7);
      }
    }
  } },
  { id: 'circuit', name: '回路', draw(ctx, e) {
    // 2026-10-20 持ち主「迷路すすんでなくね」：回路の上を光の点が実際にたどって進み、通った跡が光って消える
    const c = e.S * 0.1;
    const nx = Math.ceil(e.w / c) + 1, ny = Math.ceil(e.h / c) + 1;
    const ox = (e.w - (nx - 1) * c) / 2, oy = (e.h - (ny - 1) * c) / 2;
    pen(ctx, e.fg, lw(e, 0.003), 0.45);
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const x = ox + i * c, y = oy + j * c, r = hash(i, j, 7);
      if (r < 0.45 && i < nx - 1) { line(ctx, x, y, x + c, y); ctx.stroke(); }
      else if (r < 0.9 && j < ny - 1) { line(ctx, x, y, x, y + c); ctx.stroke(); }
      if (hash(i, j, 8) < 0.12) { circle(ctx, x, y, c * 0.08); ctx.stroke(); }
    }
    // 光の点：升目の上を 1 秒に 6 マス進む（曲がる向きは決まった乱数）。今の位置から過去 14 マスを描く
    const walkers = 5, speed = 6;
    for (let w = 0; w < walkers; w++) {
      const steps = Math.max(0, e.t) * speed + w * 37;
      const n = Math.floor(steps), f = steps - n;
      // 曲の頭から 1 マスずつたどる（同じ時刻なら同じ道。4 分の曲でも 1 本 1500 マスほど）。最後の 16 マスを残す
      const trail = [];
      let i = Math.floor(hash(w, 1) * nx), j = Math.floor(hash(w, 2) * ny), d = Math.floor(hash(w, 3) * 4);
      for (let s = 0; s <= n + 1; s++) {
        if (s >= n - 14) trail.push([ox + i * c, oy + j * c]);
        if (hash(w, s, 9) < 0.3) d = (d + (hash(w, s, 10) < 0.5 ? 1 : 3)) % 4;
        if (i + [1, 0, -1, 0][d] < 0 || i + [1, 0, -1, 0][d] >= nx || j + [0, 1, 0, -1][d] < 0 || j + [0, 1, 0, -1][d] >= ny) d = (d + 2) % 4;
        i += [1, 0, -1, 0][d]; j += [0, 1, 0, -1][d];
      }
      while (trail.length < 16) trail.unshift(trail[0]);
      const head = [trail[14][0] + (trail[15][0] - trail[14][0]) * f, trail[14][1] + (trail[15][1] - trail[14][1]) * f];
      for (let k = 0; k < 14; k++) { pen(ctx, e.accent, lw(e, 0.007), (k + 1) / 14); path(ctx, [trail[k], trail[k + 1]]); ctx.stroke(); }
      pen(ctx, e.accent, lw(e, 0.007)); path(ctx, [trail[14], head]); ctx.stroke();
      ink(ctx, e.fg, 1); circle(ctx, head[0], head[1], c * (0.1 + 0.06 * pulse(e))); ctx.fill();
    }
  } },
  { id: 'scan-lines', name: '走査線', draw(ctx, e) {
    const p = pulse(e);
    for (let y = 0; y < e.h; y += e.S * 0.012) { ink(ctx, e.fg, 0.08 + 0.12 * Math.sin(y * 0.1 + e.t * 10)); ctx.fillRect(0, y, e.w, e.S * 0.004); }
    const y = (barPhase(e) * e.h * 1.2) - e.h * 0.1;
    ink(ctx, e.accent, 0.5 + 0.5 * p); ctx.fillRect(0, y, e.w, e.S * 0.03);
    ink(ctx, e.fg, 0.3); ctx.fillRect(0, y - e.S * 0.08, e.w, e.S * 0.08);
  } },
  { id: 'tiles-rotate', name: '回るタイル', draw(ctx, e) {
    const c = e.S * 0.13, b = beatNo(e), ph = Math.min(1, e.beat.phase * 3);
    cells(e, c, (x, y, i, j) => {
      const turns = Math.floor(hash(i, j, b) * 4);
      const a = (turns + (hash(i, j, b + 1) < 0.5 ? ph : 0)) * Math.PI / 2;
      ctx.save(); ctx.translate(x, y); ctx.rotate(a);
      pen(ctx, (i + j) % 6 === 0 ? e.accent : e.fg, lw(e, 0.006), 0.85);
      ctx.beginPath(); ctx.arc(-c / 2, -c / 2, c / 2, 0, Math.PI / 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(c / 2, c / 2, c / 2, Math.PI, Math.PI * 1.5); ctx.stroke();
      ctx.restore();
    });
  } },
  { id: 'warp-grid', name: 'ゆがむ方眼', draw(ctx, e) {
    const c = e.S * 0.07, p = pulse(e, 3);
    const warp = (x, y) => { const dx = x - e.cx, dy = y - e.cy, d = Math.hypot(dx, dy) / e.S; const k = 1 + (0.6 * p + 0.2) * Math.exp(-d * d * 8); return [e.cx + dx * k, e.cy + dy * k]; };
    pen(ctx, e.fg, lw(e, 0.003), 0.75);
    for (let y = -c; y < e.h + c; y += c) { const pts = []; for (let x = -c; x <= e.w + c; x += c / 3) pts.push(warp(x, y)); path(ctx, pts); ctx.stroke(); }
    pen(ctx, e.accent, lw(e, 0.003), 0.6);
    for (let x = -c; x < e.w + c; x += c) { const pts = []; for (let y = -c; y <= e.h + c; y += c / 3) pts.push(warp(x, y)); path(ctx, pts); ctx.stroke(); }
  } },
];
