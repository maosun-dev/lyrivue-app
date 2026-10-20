// 幾何学模様：立体（線で描いた立体を、簡単な遠近で映す）
import { TAU, pulse, barPhase, beatNo, hash, lw, circle, path, pen, ink, rot3, proj, edges3, CUBE, ICOSA, OCTA, TETRA } from './kit.js';

// 拍の頭でぐっと回る角度（拍ごとに 1/8 回転ずつ進む）
const kick = e => (beatNo(e) + (1 - Math.pow(1 - Math.min(1, e.beat.phase * 2), 3))) * Math.PI / 4;
const solid = (ctx, e, S, ax, ay, az, scale, dist = 3) => edges3(ctx, e, S.pts.map(p => rot3(p, ax, ay, az)), S.edges, dist, scale);

export const SOLID = [
  { id: 'cube-spin', name: '回る立方体', draw(ctx, e) {
    const p = pulse(e);
    pen(ctx, e.fg, lw(e, 0.006)); solid(ctx, e, CUBE, e.t * 0.4, kick(e), 0, 0.22 * (1 + 0.15 * p)); ctx.stroke();
    pen(ctx, e.accent, lw(e, 0.003), 0.7); solid(ctx, e, CUBE, -e.t * 0.3, -kick(e), 0.3, 0.36); ctx.stroke();
  } },
  { id: 'cube-nest', name: '入れ子の立方体', draw(ctx, e) {
    for (let k = 0; k < 5; k++) { pen(ctx, k === 2 ? e.accent : e.fg, lw(e, 0.004), 1 - k * 0.15); solid(ctx, e, CUBE, e.t * 0.3 + k * 0.2, kick(e) * (k % 2 ? 1 : -1), 0, 0.08 + k * 0.07); ctx.stroke(); }
  } },
  { id: 'icosa', name: '二十面体', draw(ctx, e) {
    const p = pulse(e);
    pen(ctx, e.fg, lw(e, 0.005)); solid(ctx, e, ICOSA, e.t * 0.35, kick(e), 0, 0.5 * (1 + 0.15 * p)); ctx.stroke();
    const pts = ICOSA.pts.map(q => proj(e, rot3(q, e.t * 0.35, kick(e), 0), 3, 0.5 * (1 + 0.15 * p)));
    ink(ctx, e.accent, 1); pts.forEach(q => { if (q) { circle(ctx, q[0], q[1], e.S * 0.012); ctx.fill(); } });
  } },
  { id: 'octa-twin', name: '双子の八面体', draw(ctx, e) {
    pen(ctx, e.fg, lw(e, 0.005)); ctx.save(); ctx.translate(-e.S * 0.2, 0); solid(ctx, e, OCTA, e.t * 0.5, kick(e), 0, 0.3); ctx.stroke(); ctx.restore();
    pen(ctx, e.accent, lw(e, 0.005)); ctx.save(); ctx.translate(e.S * 0.2, 0); solid(ctx, e, OCTA, -e.t * 0.5, -kick(e), 0, 0.3 * (1 + 0.2 * pulse(e))); ctx.stroke(); ctx.restore();
  } },
  { id: 'tetra-swarm', name: '四面体の群れ', draw(ctx, e) {
    // 2026-10-20 持ち主「量ふやそう」：30 個に増やし、群れ全体がゆっくり渦を巻いて流れる
    for (let k = 0; k < 30; k++) {
      const ang = hash(k, 5) * TAU + e.t * (0.15 + 0.1 * hash(k, 6));
      const rad = 0.3 + 1.3 * hash(k, 1);
      const x = Math.cos(ang) * rad, y = (hash(k, 2) - 0.5) * 3.2, z = 0.4 + Math.sin(ang) * rad * 0.6 + hash(k, 3);
      const c = proj(e, [x, y, z], 3, 0.35); if (!c) continue;
      ctx.save(); ctx.translate(c[0] - e.cx, c[1] - e.cy);
      pen(ctx, k % 4 ? e.fg : e.accent, lw(e, 0.003), 0.9);
      solid(ctx, e, TETRA, e.t * (0.5 + hash(k, 4)), kick(e) + k, 0, 0.08 * (1 + 0.3 * pulse(e)) * 3 / (3 + z)); ctx.stroke(); ctx.restore();
    }
  } },
  { id: 'globe', name: '線の地球儀', draw(ctx, e) {
    const ay = e.t * 0.4 + kick(e) * 0.3, s = 0.42 * (1 + 0.1 * pulse(e));
    for (let k = -4; k <= 4; k++) { const la = (k / 5) * Math.PI / 2; const pts = []; for (let i = 0; i <= 64; i++) { const lo = (i / 64) * TAU; const q = proj(e, rot3([Math.cos(la) * Math.cos(lo), Math.sin(la), Math.cos(la) * Math.sin(lo)], 0.4, ay), 3, s); if (q) pts.push(q); } pen(ctx, k === 0 ? e.accent : e.fg, lw(e, 0.003), 0.8); path(ctx, pts); ctx.stroke(); }
    for (let k = 0; k < 12; k++) { const lo = (k / 12) * Math.PI; const pts = []; for (let i = 0; i <= 64; i++) { const la = (i / 64) * TAU; const q = proj(e, rot3([Math.cos(la) * Math.cos(lo), Math.sin(la), Math.cos(la) * Math.sin(lo)], 0.4, ay), 3, s); if (q) pts.push(q); } pen(ctx, e.fg, lw(e, 0.002), 0.5); path(ctx, pts); ctx.stroke(); }
  } },
  { id: 'torus', name: 'ドーナツ', draw(ctx, e) {
    const R = 1, r = 0.4, ax = 1 + Math.sin(e.t * 0.3) * 0.4, ay = e.t * 0.3 + kick(e) * 0.3;
    for (let i = 0; i < 24; i++) { const u = (i / 24) * TAU; const pts = []; for (let j = 0; j <= 32; j++) { const v = (j / 32) * TAU; const q = proj(e, rot3([(R + r * Math.cos(v)) * Math.cos(u), r * Math.sin(v), (R + r * Math.cos(v)) * Math.sin(u)], ax, ay), 3.5, 0.32 * (1 + 0.1 * pulse(e))); if (q) pts.push(q); } pen(ctx, i % 6 === 0 ? e.accent : e.fg, lw(e, 0.003), 0.75); path(ctx, pts); ctx.stroke(); }
  } },
  { id: 'square-tunnel', name: '四角のトンネル', draw(ctx, e) { polyTunnel(ctx, e, 4, 0.12); } },
  { id: 'tri-tunnel', name: '三角のトンネル', draw(ctx, e) { polyTunnel(ctx, e, 3, 0.2); } },
  { id: 'hex-tunnel', name: '六角のトンネル', draw(ctx, e) {
    polyTunnel(ctx, e, 6, 0.06);
    // 中心の奥に小さく光る点（行き先）
    ink(ctx, e.accent, 0.6 + 0.4 * pulse(e)); circle(ctx, e.cx, e.cy, e.S * 0.012); ctx.fill();
  } },
  { id: 'terrain', name: '線の山並み', draw(ctx, e) {
    const rows = 22, cols = 30, p = pulse(e);
    for (let j = 0; j < rows; j++) {
      const z = 1 + j * 0.35 - ((e.t * 1.5) % 0.35);
      const pts = [];
      for (let i = 0; i <= cols; i++) { const x = (i / cols - 0.5) * 6; const hgt = (Math.sin(x * 1.3 + (j + Math.floor(e.t * 1.5 / 0.35)) * 0.5) + Math.sin(x * 0.7 - j * 0.3)) * 0.25 * (1 + p); const q = proj(e, [x, 0.8 - hgt, z], 0.5, 0.5); if (q) pts.push(q); }
      pen(ctx, j === 2 ? e.accent : e.fg, lw(e, 0.003), Math.max(0.15, 1 - j / rows)); path(ctx, pts); ctx.stroke();
    }
  } },
  { id: 'helix', name: '二重らせん', draw(ctx, e) {
    const ay = e.t * 0.8, n = 60;
    const a = [], b = [];
    for (let i = 0; i <= n; i++) { const y = (i / n - 0.5) * 4; const ang = i * 0.35 + ay; a.push(proj(e, [Math.cos(ang) * 0.6, y, Math.sin(ang) * 0.6], 4, 0.4)); b.push(proj(e, [Math.cos(ang + Math.PI) * 0.6, y, Math.sin(ang + Math.PI) * 0.6], 4, 0.4)); }
    pen(ctx, e.fg, lw(e, 0.006)); path(ctx, a.filter(Boolean)); ctx.stroke();
    pen(ctx, e.accent, lw(e, 0.006)); path(ctx, b.filter(Boolean)); ctx.stroke();
    for (let i = 0; i <= n; i += 3) { if (!a[i] || !b[i]) continue; pen(ctx, e.fg, lw(e, 0.002), (i + beatNo(e) * 3) % 12 === 0 ? 1 : 0.4); path(ctx, [a[i], b[i]]); ctx.stroke(); }
  } },
  { id: 'ring-cylinder', name: '輪の筒', draw(ctx, e) {
    for (let k = 0; k < 14; k++) {
      const y = (k / 13 - 0.5) * 3.2, r = 0.5 + 0.25 * Math.sin(k * 0.6 + e.t * 2) * (0.5 + pulse(e));
      const pts = []; for (let i = 0; i <= 48; i++) { const a = (i / 48) * TAU; const q = proj(e, rot3([Math.cos(a) * r, y, Math.sin(a) * r], 0.5, e.t * 0.3), 4, 0.42); if (q) pts.push(q); }
      pen(ctx, k % 4 === 0 ? e.accent : e.fg, lw(e, 0.004), 0.85); path(ctx, pts); ctx.stroke();
    }
  } },
  { id: 'star-warp', name: '星の早送り', draw(ctx, e) {
    const sp = 1.5 + 4 * pulse(e, 3) * e.energy;
    for (let k = 0; k < 160; k++) {
      const x = (hash(k, 1) - 0.5) * 4, y = (hash(k, 2) - 0.5) * 4;
      const z = 0.2 + ((hash(k, 3) * 6 - e.t * sp) % 6 + 6) % 6;
      const a = proj(e, [x, y, z - 1], 1, 0.4), b = proj(e, [x, y, z - 1 + 0.08 * sp], 1, 0.4); // 奥行き z の点（カメラは z = 0）
      if (!a || !b) continue;
      pen(ctx, k % 11 === 0 ? e.accent : e.fg, lw(e, 0.004 * Math.min(2, 2 / z)), Math.min(1, 3 / z)); path(ctx, [a, b]); ctx.stroke();
    }
  } },
  { id: 'cube-lattice', name: '立方体の格子', draw(ctx, e) {
    const pts = [], pairs = [], n = 3;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) for (let k = 0; k < n; k++) pts.push([(i - 1) * 0.8, (j - 1) * 0.8, (k - 1) * 0.8]);
    const id = (i, j, k) => (i * n + j) * n + k;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) for (let k = 0; k < n; k++) { if (i < n - 1) pairs.push([id(i, j, k), id(i + 1, j, k)]); if (j < n - 1) pairs.push([id(i, j, k), id(i, j + 1, k)]); if (k < n - 1) pairs.push([id(i, j, k), id(i, j, k + 1)]); }
    const s = 1 + 0.15 * pulse(e);
    pen(ctx, e.fg, lw(e, 0.003), 0.8); edges3(ctx, e, pts.map(p => rot3(p.map(v => v * s), e.t * 0.3, kick(e) * 0.5)), pairs, 3.5, 0.42); ctx.stroke();
    ink(ctx, e.accent, 1); pts.forEach(p => { const q = proj(e, rot3(p.map(v => v * s), e.t * 0.3, kick(e) * 0.5), 3.5, 0.42); if (q) { circle(ctx, q[0], q[1], e.S * 0.008); ctx.fill(); } });
  } },
  { id: 'globe-glow', name: '光る地球儀', draw(ctx, e) {
    // 2026-10-20 持ち主「（線の地球儀）かっこよ！なんか光る感じ版もほしい」：線を重ねて光らせ、赤道とまわりの輪を強く光らせる
    const ay = e.t * 0.4 + kick(e) * 0.3, s = 0.4 * (1 + 0.08 * pulse(e));
    const lat = (k, steps = 64) => { const la = (k / 5) * Math.PI / 2; const pts = []; for (let i = 0; i <= steps; i++) { const lo = (i / steps) * TAU; const q = proj(e, rot3([Math.cos(la) * Math.cos(lo), Math.sin(la), Math.cos(la) * Math.sin(lo)], 0.4, ay), 3, s); if (q) pts.push(q); } return pts; };
    const lon = k => { const lo = (k / 12) * Math.PI; const pts = []; for (let i = 0; i <= 64; i++) { const la = (i / 64) * TAU; const q = proj(e, rot3([Math.cos(la) * Math.cos(lo), Math.sin(la), Math.cos(la) * Math.sin(lo)], 0.4, ay), 3, s); if (q) pts.push(q); } return pts; };
    // 光り方：足し合わせで、太く薄い線 2 段（にじみ）→ 細く濃い線（芯）の順に重ねる。
    // 影のぼかし（shadowBlur）は 1080p で 1 コマ 0.7 秒かかったので使わない
    ctx.globalCompositeOperation = 'lighter';
    for (const [w, a] of [[0.03, 0.06], [0.014, 0.14], [0.004, 0.9]]) {
      for (let k = -4; k <= 4; k++) { pen(ctx, k === 0 ? e.accent : e.fg, lw(e, w * (k === 0 ? 1.6 : 1)), a); path(ctx, lat(k)); ctx.stroke(); }
      for (let k = 0; k < 12; k++) { pen(ctx, e.fg, lw(e, w * 0.7), a * 0.7); path(ctx, lon(k)); ctx.stroke(); }
    }
    // まわりを回る光の輪
    const ring = []; for (let i = 0; i <= 80; i++) { const a = (i / 80) * TAU; const q = proj(e, rot3([Math.cos(a) * 1.45, 0, Math.sin(a) * 1.45], 0.9, e.t * 0.7), 3, s); if (q) ring.push(q); }
    pen(ctx, e.accent, lw(e, 0.006), 0.85); path(ctx, ring); ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
  } },
  { id: 'pyramid', name: 'ピラミッド', draw(ctx, e) {
    const P = { pts: [[0, -1.1, 0], [-1, 0.6, -1], [1, 0.6, -1], [1, 0.6, 1], [-1, 0.6, 1]], edges: [[0, 1], [0, 2], [0, 3], [0, 4], [1, 2], [2, 3], [3, 4], [4, 1]] };
    pen(ctx, e.fg, lw(e, 0.006)); solid(ctx, e, P, 0.3, e.t * 0.4 + kick(e) * 0.5, 0, 0.32); ctx.stroke();
    pen(ctx, e.accent, lw(e, 0.004), pulse(e)); solid(ctx, e, P, 0.3, e.t * 0.4 + kick(e) * 0.5, 0, 0.32 * (1.2 + 0.3 * e.beat.phase)); ctx.stroke();
  } },
  { id: 'tesseract', name: '四次元立方体', draw(ctx, e) {
    const a = e.t * 0.5 + kick(e) * 0.2;
    const v4 = []; for (let i = 0; i < 16; i++) v4.push([i & 1 ? 1 : -1, i & 2 ? 1 : -1, i & 4 ? 1 : -1, i & 8 ? 1 : -1]);
    const pts = v4.map(([x, y, z, w]) => { const c = Math.cos(a), s = Math.sin(a); [x, w] = [x * c - w * s, x * s + w * c]; const k = 1 / (2.2 - w); return rot3([x * k, y * k, z * k], 0.4, e.t * 0.2); });
    const pairs = []; for (let i = 0; i < 16; i++) for (let b = 0; b < 4; b++) { const j = i ^ (1 << b); if (i < j) pairs.push([i, j]); }
    pen(ctx, e.fg, lw(e, 0.004), 0.9); edges3(ctx, e, pts, pairs, 3, 0.75 * (1 + 0.1 * pulse(e))); ctx.stroke();
    pen(ctx, e.accent, lw(e, 0.004), 0.9); edges3(ctx, e, pts, pairs.filter(([i, j]) => (i & 8) && (j & 8)), 3, 0.75 * (1 + 0.1 * pulse(e))); ctx.stroke();
  } },
  { id: 'orbit-rings', name: '軌道の輪', draw(ctx, e) {
    for (let k = 0; k < 3; k++) {
      const tilt = [0.3, 1.1, 1.9][k];
      const pts = []; for (let i = 0; i <= 80; i++) { const a = (i / 80) * TAU; const q = proj(e, rot3([Math.cos(a), 0, Math.sin(a)], tilt, e.t * 0.2 + k), 3, 0.42); if (q) pts.push(q); }
      pen(ctx, e.fg, lw(e, 0.003), 0.7); path(ctx, pts); ctx.stroke();
      const a = e.t * (1 + k * 0.4) + k * 2; const q = proj(e, rot3([Math.cos(a), 0, Math.sin(a)], tilt, e.t * 0.2 + k), 3, 0.42);
      if (q) { ink(ctx, e.accent, 1); circle(ctx, q[0], q[1], e.S * 0.02 * (1 + pulse(e))); ctx.fill(); }
    }
    ink(ctx, e.fg, 1); circle(ctx, e.cx, e.cy, e.S * 0.04 * (1 + 0.3 * pulse(e))); ctx.fill();
  } },
];


// 多角形のトンネル（n 角）：輪は奥から手前へ流れ、奥で現れて手前で消える（濃さをなめらかに）。
// 輪ごとに決まったねじれの角度を持つので、輪が手前へ抜けても回転が飛ばない（2026-10-20 持ち主「カクカクはいらない」）
function polyTunnel(ctx, e, n, twist) {
  const speed = 1.2 + 1.2 * e.energy, gap = 0.6, rings = 18;
  const head = e.t * speed / gap;            // 何本ぶん流れたか
  const base = Math.floor(head), frac = head - base;
  for (let k = rings - 1; k >= 0; k--) {
    const id = base + k;                     // 輪の通し番号（流れても変わらない）
    const z = 0.3 + (k - frac) * gap;
    if (z <= 0.15) continue;
    const fade = Math.min(1, (z - 0.15) / 0.5) * Math.min(1, (rings * gap - z) / 2.5);
    const rot = id * twist + e.t * 0.25;
    const corners = [];
    for (let i = 0; i < n; i++) { const a = rot + (i / n) * TAU; corners.push(proj(e, [Math.cos(a) * 1.3, Math.sin(a) * 1.3, z - 1], 1, 0.5)); }
    if (corners.some(c => !c)) continue;
    pen(ctx, id % 6 === 0 ? e.accent : e.fg, lw(e, 0.002 + 0.006 * Math.min(1, 1 / z)), Math.max(0, fade) * 0.95);
    path(ctx, corners, true); ctx.stroke();
  }
}
