// 幾何学模様：曲線（なめらかな線・数式の曲線・糸かけ）
import { TAU, pulse, barPhase, beatNo, hash, lw, circle, line, path, pen, ink } from './kit.js';

const curve = (ctx, e, n, f, close = false) => { const pts = []; for (let i = 0; i <= n; i++) pts.push(f(i / n)); path(ctx, pts, close); };

export const CURVES = [
  { id: 'lissajous', name: 'リサージュ', draw(ctx, e) {
    const a = 3 + (beatNo(e) >> 3) % 3, b = 2 + (beatNo(e) >> 4) % 3, p = pulse(e);
    pen(ctx, e.fg, lw(e, 0.004 + 0.004 * p));
    curve(ctx, e, 600, u => [e.cx + Math.sin(a * u * TAU + e.t * 0.7) * e.S * 0.42, e.cy + Math.sin(b * u * TAU) * e.S * 0.42 * (e.h / e.w > 1 ? 1.4 : 0.9)]); ctx.stroke();
    const u = (e.t * 0.25) % 1; ink(ctx, e.accent, 1);
    circle(ctx, e.cx + Math.sin(a * u * TAU + e.t * 0.7) * e.S * 0.42, e.cy + Math.sin(b * u * TAU) * e.S * 0.42 * (e.h / e.w > 1 ? 1.4 : 0.9), e.S * 0.02 * (1 + p)); ctx.fill();
  } },
  { id: 'harmonograph', name: 'ハーモノグラフ', draw(ctx, e) {
    pen(ctx, e.fg, lw(e, 0.002), 0.85);
    curve(ctx, e, 1500, u => { const t = u * 60; const d = Math.exp(-t * 0.03); return [e.cx + e.S * 0.4 * d * (Math.sin(t * 2.01 + e.t * 0.3) + 0.4 * Math.sin(t * 3)), e.cy + e.S * 0.4 * d * (Math.sin(t * 3.003) + 0.3 * Math.sin(t * 2 + e.t * 0.5))]; }); ctx.stroke();
    pen(ctx, e.accent, lw(e, 0.006), pulse(e)); circle(ctx, e.cx, e.cy, e.S * 0.45 * (1 - e.beat.phase * 0.2)); ctx.stroke();
  } },
  { id: 'sine-stack', name: '重なる波', draw(ctx, e) {
    const n = 18, p = pulse(e);
    for (let k = 0; k < n; k++) {
      const y0 = (k + 0.5) / n * e.h, amp = e.S * 0.04 * (0.5 + p) * Math.sin(k / n * Math.PI);
      pen(ctx, k % 6 === 3 ? e.accent : e.fg, lw(e, 0.003), 0.8);
      curve(ctx, e, 120, u => [u * e.w, y0 + Math.sin(u * 12 + e.t * 2 + k * 0.4) * amp]); ctx.stroke();
    }
  } },
  { id: 'spirograph', name: 'スピログラフ', draw(ctx, e) {
    const R = 1, r = 0.31 + 0.1 * ((beatNo(e) >> 3) % 3), d = 0.7, s = e.S * 0.3;
    pen(ctx, e.fg, lw(e, 0.002), 0.85);
    curve(ctx, e, 2400, u => { const t = u * TAU * 20; return [e.cx + s * ((R - r) * Math.cos(t) + d * Math.cos((R - r) / r * t + e.t * 0.2)), e.cy + s * ((R - r) * Math.sin(t) - d * Math.sin((R - r) / r * t + e.t * 0.2))]; }); ctx.stroke();
    pen(ctx, e.accent, lw(e, 0.005), 0.4 + 0.6 * pulse(e)); circle(ctx, e.cx, e.cy, s * 1.75); ctx.stroke();
  } },
  { id: 'supershape', name: '変わる形（超公式）', draw(ctx, e) {
    const m = 3 + (beatNo(e) >> 2) % 6, n1 = 0.3 + 0.7 * pulse(e, 3), p = pulse(e);
    for (let k = 0; k < 4; k++) {
      pen(ctx, k ? e.fg : e.accent, lw(e, 0.004), 1 - k * 0.2);
      curve(ctx, e, 400, u => { const a = u * TAU; const t1 = Math.abs(Math.cos(m * a / 4)), t2 = Math.abs(Math.sin(m * a / 4)); const r = Math.pow(Math.pow(t1, 1.7) + Math.pow(t2, 1.7), -1 / n1) * e.S * 0.12 * (1 + k * 0.6) * (1 + 0.1 * p); const rr = Math.min(r, e.S * 0.6); return [e.cx + Math.cos(a + e.t * 0.2) * rr, e.cy + Math.sin(a + e.t * 0.2) * rr]; }, true); ctx.stroke();
    }
  } },
  { id: 'ribbons', name: 'リボン', draw(ctx, e) {
    for (let k = 0; k < 6; k++) {
      const ph = k * 0.6 + e.t * (0.8 + 0.2 * k);
      ink(ctx, k % 3 === 0 ? e.accent : e.fg, 0.25);
      ctx.beginPath();
      for (let i = 0; i <= 80; i++) { const u = i / 80; const y = e.cy + Math.sin(u * 6 + ph) * e.h * 0.25 + Math.sin(u * 2 + k) * e.h * 0.1; i ? ctx.lineTo(u * e.w, y) : ctx.moveTo(0, y); }
      for (let i = 80; i >= 0; i--) { const u = i / 80; const y = e.cy + Math.sin(u * 6 + ph + 0.3) * e.h * 0.25 + Math.sin(u * 2 + k) * e.h * 0.1 + e.S * (0.03 + 0.04 * pulse(e)); ctx.lineTo(u * e.w, y); }
      ctx.closePath(); ctx.fill();
    }
  } },
  { id: 'contour', name: '等高線', draw(ctx, e) {
    for (let k = 1; k <= 12; k++) {
      pen(ctx, k % 4 === 0 ? e.accent : e.fg, lw(e, 0.003), 0.75);
      curve(ctx, e, 200, u => { const a = u * TAU; const r = e.S * 0.035 * k * (1 + 0.15 * Math.sin(a * 3 + e.t + k * 0.3) + 0.08 * Math.sin(a * 5 - e.t * 1.3)) * (1 + 0.08 * pulse(e)); return [e.cx + Math.cos(a) * r, e.cy + Math.sin(a) * r]; }, true); ctx.stroke();
    }
  } },
  { id: 'string-art', name: '糸かけ', draw(ctx, e) {
    const n = 120, mul = 2 + ((beatNo(e) >> 2) % 7) + e.beat.phase * 0.2, r = e.S * 0.42;
    pen(ctx, e.fg, lw(e, 0.0015), 0.55);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU, b = ((i * mul) % n / n) * TAU;
      line(ctx, e.cx + Math.cos(a) * r, e.cy + Math.sin(a) * r, e.cx + Math.cos(b) * r, e.cy + Math.sin(b) * r); ctx.stroke();
    }
    pen(ctx, e.accent, lw(e, 0.005)); circle(ctx, e.cx, e.cy, r); ctx.stroke();
  } },
  { id: 'moire', name: 'モアレ', draw(ctx, e) {
    const off = Math.sin(e.t * 0.8) * e.S * 0.12 * (1 + pulse(e));
    for (const [x, c] of [[e.cx - off, e.fg], [e.cx + off, e.accent]]) {
      pen(ctx, c, lw(e, 0.003), 0.7);
      for (let k = 1; k < 30; k++) { circle(ctx, x, e.cy, e.S * 0.025 * k); ctx.stroke(); }
    }
  } },
  { id: 'phyllotaxis', name: 'ひまわりの種', draw(ctx, e) {
    // 2026-10-20 持ち主「もっと早く回転してほしい」：全体を速く回す（内側ほど速くすると、時間がたつとねじれて種の並びが崩れるので同じ速さ）
    const n = 520, ga = Math.PI * (3 - Math.sqrt(5)), p = pulse(e);
    for (let i = 0; i < n; i++) {
      const r = e.S * 0.02 * Math.sqrt(i), a = i * ga + e.t * 1.3;
      const hot = (i + beatNo(e) * 13) % 34 === 0;
      ink(ctx, hot ? e.accent : e.fg, hot ? 1 : 0.7);
      circle(ctx, e.cx + Math.cos(a) * r, e.cy + Math.sin(a) * r, e.S * (0.004 + 0.004 * (i / n)) * (hot ? 2 + p * 2 : 1)); ctx.fill();
    }
  } },
  { id: 'interference', name: '干渉の縞', draw(ctx, e) {
    const c = e.S * 0.03, s1 = [e.cx - e.S * 0.25, e.cy], s2 = [e.cx + e.S * 0.25, e.cy];
    for (let y = 0; y < e.h; y += c) for (let x = 0; x < e.w; x += c) {
      const v = Math.sin(Math.hypot(x - s1[0], y - s1[1]) / e.S * 40 - e.t * 6) + Math.sin(Math.hypot(x - s2[0], y - s2[1]) / e.S * 40 - e.t * 6);
      if (v > 1 - 0.5 * pulse(e)) { ink(ctx, v > 1.7 ? e.accent : e.fg, 0.8); ctx.fillRect(x, y, c * 0.8, c * 0.8); }
    }
  } },
  { id: 'cardioid', name: '心臓形', draw(ctx, e) {
    const p = pulse(e);
    for (let k = 0; k < 6; k++) {
      pen(ctx, k === 0 ? e.accent : e.fg, lw(e, 0.004), 1 - k * 0.14);
      const s = e.S * (0.06 + k * 0.035) * (1 + 0.2 * p);
      curve(ctx, e, 200, u => { const a = u * TAU; const r = s * (1 - Math.sin(a)); return [e.cx + Math.cos(a + e.t * 0.2 * (k % 2 ? 1 : -1)) * r * 1.2, e.cy + Math.sin(a + e.t * 0.2 * (k % 2 ? 1 : -1)) * r * 1.2]; }, true); ctx.stroke();
    }
  } },
  { id: 'pendulums', name: '振り子の波', draw(ctx, e) {
    // 2026-10-20 持ち主「（垂れる鎖は）伝わりづらい」→ 作り替え：長さの違う振り子が、そろって揺れたり、ばらけて波になったりする
    const n = 15, top = e.h * 0.12, span = e.w * 0.8, x0 = (e.w - span) / 2;
    pen(ctx, e.fg, lw(e, 0.004), 0.8); line(ctx, x0 - e.S * 0.03, top, x0 + span + e.S * 0.03, top); ctx.stroke();
    const tips = [];
    for (let k = 0; k < n; k++) {
      const x = x0 + (k / (n - 1)) * span;
      const L = e.h * (0.45 + 0.025 * k) * (e.h > e.w ? 1 : 0.8);
      const a = 0.5 * Math.sin(e.t * (2.2 + k * 0.11));   // 振り子ごとに少しずつ速さが違う
      const tx = x + Math.sin(a) * L, ty = top + Math.cos(a) * L;
      pen(ctx, e.fg, lw(e, 0.002), 0.6); line(ctx, x, top, tx, ty); ctx.stroke();
      tips.push([tx, ty]);
    }
    pen(ctx, e.accent, lw(e, 0.003), 0.5); path(ctx, tips); ctx.stroke();
    tips.forEach(([x, y], k) => { ink(ctx, k % 4 === 0 ? e.accent : e.fg, 1); circle(ctx, x, y, e.S * (0.018 + 0.008 * pulse(e))); ctx.fill(); });
  } },
  { id: 'epicycles', name: '周転円', draw(ctx, e) {
    let x = e.cx, y = e.cy;
    const rs = [0.2, 0.11, 0.07, 0.045, 0.03], sp = [1, -2.3, 3.7, -5.1, 7.3];
    for (let k = 0; k < rs.length; k++) {
      const r = e.S * rs[k] * (1 + 0.15 * pulse(e)), a = e.t * sp[k] * 0.6;
      pen(ctx, e.fg, lw(e, 0.003), 0.6); circle(ctx, x, y, r); ctx.stroke();
      const nx = x + Math.cos(a) * r, ny = y + Math.sin(a) * r;
      pen(ctx, e.accent, lw(e, 0.004)); line(ctx, x, y, nx, ny); ctx.stroke();
      x = nx; y = ny;
    }
    // たどった跡（同じ式を過去の時刻で）
    const pts = [];
    for (let j = 0; j < 160; j++) { const t = e.t - j * 0.02; let px = e.cx, py = e.cy; for (let k = 0; k < rs.length; k++) { const a = t * sp[k] * 0.6; px += Math.cos(a) * e.S * rs[k]; py += Math.sin(a) * e.S * rs[k]; } pts.push([px, py]); }
    pen(ctx, e.accent, lw(e, 0.004), 0.8); path(ctx, pts); ctx.stroke();
  } },
  { id: 'infinity', name: '無限の輪', draw(ctx, e) {
    for (let k = 0; k < 7; k++) {
      const s = e.S * (0.15 + k * 0.045) * (1 + 0.1 * pulse(e));
      pen(ctx, k === 3 ? e.accent : e.fg, lw(e, 0.003), 0.8);
      curve(ctx, e, 300, u => { const a = u * TAU; const d = 1 + Math.sin(a) ** 2; return [e.cx + s * Math.cos(a) / d * 1.6, e.cy + s * Math.sin(a) * Math.cos(a) / d * 1.6 + Math.sin(e.t + k) * e.S * 0.02]; }, true); ctx.stroke();
    }
  } },
  { id: 'audio-ring', name: '音の形の輪', draw(ctx, e) {
    const b = beatNo(e), p = pulse(e);
    for (let k = 0; k < 2; k++) {
      pen(ctx, k ? e.accent : e.fg, lw(e, 0.005), 0.9);
      curve(ctx, e, 256, u => { const a = u * TAU; const v = Math.abs(Math.sin(u * 40 + e.t * 9 + k)) * hash(Math.floor(u * 64), b) * p; const r = e.S * (0.25 + k * 0.04) * (1 + 0.5 * v * (0.5 + e.energy)); return [e.cx + Math.cos(a) * r, e.cy + Math.sin(a) * r]; }, true); ctx.stroke();
    }
  } },
  { id: 'flow-lines', name: '流れの線', draw(ctx, e) {
    for (let k = 0; k < 40; k++) {
      let x = hash(k, 1) * e.w, y = hash(k, 2) * e.h;
      const pts = [[x, y]];
      for (let i = 0; i < 40; i++) { const a = Math.sin(x / e.S * 3 + e.t * 0.5) * 2 + Math.cos(y / e.S * 3 - e.t * 0.4) * 2; x += Math.cos(a) * e.S * 0.012; y += Math.sin(a) * e.S * 0.012; pts.push([x, y]); }
      pen(ctx, k % 7 === 0 ? e.accent : e.fg, lw(e, 0.003 + 0.003 * pulse(e)), 0.7); path(ctx, pts); ctx.stroke();
    }
  } },
];
