// 立体物：空間に浮かぶ、陰影のある多面体・光る球（輪つきも）。カメラで映して描く（render/camera.js の project）。
// 面ごとに、面の向きと光の向きから明るさを決め（面ごとの陰影）、奥の面から順に描く。遠いほど地の色に溶ける（もや）。
// 同じ入力なら同じ絵（前のコマを覚えない）。
import { project } from '../camera.js';

const G = (1 + Math.sqrt(5)) / 2;
const norm = v => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

// 凸な立体を、点の並びと「面＝点の番号の輪」で表す（面の点は外から見て反時計回りでなくてもよい：法線は中心から外向きにそろえる）
function hull(pts, faces) { return { pts, faces }; }
const CUBE = hull([[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1], [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]].map(p => p.map(v => v * 0.7)),
  [[0, 1, 2, 3], [4, 5, 6, 7], [0, 1, 5, 4], [2, 3, 7, 6], [1, 2, 6, 5], [0, 3, 7, 4]]);
const OCTA = hull([[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]],
  [[0, 2, 4], [0, 4, 3], [0, 3, 5], [0, 5, 2], [1, 2, 4], [1, 4, 3], [1, 3, 5], [1, 5, 2]]);
const TETRA = hull([[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]].map(p => p.map(v => v * 0.75)), [[0, 1, 2], [0, 1, 3], [0, 2, 3], [1, 2, 3]]);
const ICOSA = (() => {
  const pts = [[-1, G, 0], [1, G, 0], [-1, -G, 0], [1, -G, 0], [0, -1, G], [0, 1, G], [0, -1, -G], [0, 1, -G], [G, 0, -1], [G, 0, 1], [-G, 0, -1], [-G, 0, 1]].map(p => p.map(v => v / Math.hypot(1, G)));
  const faces = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
  return hull(pts, faces);
})();
const PRISM = (() => { // 六角柱
  const pts = []; for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; pts.push([Math.cos(a) * 0.6, -1, Math.sin(a) * 0.6]); } for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; pts.push([Math.cos(a) * 0.6, 1, Math.sin(a) * 0.6]); }
  const faces = [[0, 1, 2, 3, 4, 5], [6, 7, 8, 9, 10, 11]]; for (let k = 0; k < 6; k++) faces.push([k, (k + 1) % 6, 6 + (k + 1) % 6, 6 + k]);
  return hull(pts, faces);
})();
const CRYSTAL = (() => { // 細長い両錐（結晶）
  const pts = [[0, -1.4, 0], [0, 1.4, 0]]; for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; pts.push([Math.cos(a) * 0.45, 0, Math.sin(a) * 0.45]); }
  const faces = []; for (let k = 0; k < 6; k++) { faces.push([0, 2 + k, 2 + (k + 1) % 6]); faces.push([1, 2 + k, 2 + (k + 1) % 6]); }
  return hull(pts, faces);
})();
const SLAB = hull([[-1.2, -0.12, -0.8], [1.2, -0.12, -0.8], [1.2, 0.12, -0.8], [-1.2, 0.12, -0.8], [-1.2, -0.12, 0.8], [1.2, -0.12, 0.8], [1.2, 0.12, 0.8], [-1.2, 0.12, 0.8]],
  [[0, 1, 2, 3], [4, 5, 6, 7], [0, 1, 5, 4], [2, 3, 7, 6], [1, 2, 6, 5], [0, 3, 7, 4]]); // 薄い板（石板）

export const SOLIDS = { cube: CUBE, octa: OCTA, tetra: TETRA, icosa: ICOSA, prism: PRISM, crystal: CRYSTAL, slab: SLAB };
export const SOLID_KINDS = [...Object.keys(SOLIDS), 'sphere', 'planet'];

/** 点を yaw（Y 軸）→ pitch（X 軸）→ roll（Z 軸）で回す */
function rot([x, y, z], r) {
  let c = Math.cos(r.roll ?? 0), s = Math.sin(r.roll ?? 0); [x, y] = [x * c - y * s, x * s + y * c];
  c = Math.cos(r.pitch ?? 0); s = Math.sin(r.pitch ?? 0); [y, z] = [y * c - z * s, y * s + z * c];
  c = Math.cos(r.yaw ?? 0); s = Math.sin(r.yaw ?? 0); [x, z] = [x * c + z * s, -x * s + z * c];
  return [x, y, z];
}

// 色を混ぜる（k は b の割合）。色は #rrggbb・rgb(…)・[r,g,b] のどれでもよい（混ぜた結果をまた混ぜられる）
function rgbOf(c) {
  if (Array.isArray(c)) return c;
  const s = String(c ?? '');
  const m = /^#?([0-9a-f]{6})$/i.exec(s);
  if (m) { const n = parseInt(m[1], 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
  const r = /rgb\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i.exec(s);
  return r ? [Number(r[1]), Number(r[2]), Number(r[3])] : [0, 0, 0];
}
function mix(a, b, k) { const x = rgbOf(a), y = rgbOf(b); const q = Math.min(1, Math.max(0, Number.isFinite(k) ? k : 0)); return `rgb(${x.map((v, i) => Math.round(v + (y[i] - v) * q)).join(',')})`; }

const LIGHT = norm([-0.5, -0.8, -0.4]); // 光は左上手前から
const FOG_NEAR = 5, FOG_FAR = 30;      // この距離から薄れ始め、ここで地の色に溶けきる

/** 物の、カメラからの奥行き（並べ替えに使う）。映らなければ Infinity */
export function solidDepth(obj, cam, size) {
  const c = project(cam, obj.pos, size);
  return c ? c.dz : Infinity;
}

/**
 * 立体物を 1 つ描く。obj = {kind, pos, size, rot:{yaw,pitch,roll}, spin:[yaw,pitch,roll の 1 秒あたり], color:'fg'|'accent'}
 * ink = {bg, fg, accent}。t は時刻（回転に使う）。opts.hollow なら中抜き：面はほとんど透明にして、光る辺で形を見せる
 * （奥の辺も薄く透ける。球は線でできた球）。2026-10-20 持ち主「図形は中抜き（透明）にしてみたら？」
 */
export function drawSolid(ctx, obj, cam, size, ink, t, opts) {
  const hollow = !!opts?.hollow;
  const c = project(cam, obj.pos, size);
  if (!c) return;
  const fog = Math.min(1, Math.max(0, (c.dz - FOG_NEAR) / (FOG_FAR - FOG_NEAR)));
  if (fog >= 1) return;
  const base = obj.color === 'accent' ? ink.accent : ink.fg;
  const sp = obj.spin ?? [0, 0, 0];
  const r = { yaw: (obj.rot?.yaw ?? 0) + sp[0] * t, pitch: (obj.rot?.pitch ?? 0) + sp[1] * t, roll: (obj.rot?.roll ?? 0) + sp[2] * t };
  const s = obj.size ?? 0.3;
  if (obj.kind === 'sphere' || obj.kind === 'planet') return hollow ? drawWireBall(ctx, obj, c, cam, size, ink, base, fog, s, r) : drawBall(ctx, obj, c, cam, size, ink, base, fog, s, r);
  const shape = SOLIDS[obj.kind];
  if (!shape) return;
  const world = shape.pts.map(p => { const q = rot(p, r); return [obj.pos[0] + q[0] * s, obj.pos[1] + q[1] * s, obj.pos[2] + q[2] * s]; });
  const scr = world.map(p => project(cam, p, size));
  if (scr.some(p => !p)) return; // 一部がカメラの後ろ（くぐり抜ける瞬間）は描かない
  const faces = [];
  for (const f of shape.faces) {
    const P = f.map(i => world[i]);
    let n = norm(cross(sub(P[1], P[0]), sub(P[2], P[0])));
    const mid = P.reduce((m, p) => [m[0] + p[0] / P.length, m[1] + p[1] / P.length, m[2] + p[2] / P.length], [0, 0, 0]);
    if (dot(n, sub(mid, obj.pos)) < 0) n = n.map(v => -v);       // 外向きにそろえる
    const front = dot(n, sub(cam.pos, mid)) > 0;
    if (!front && !hollow) continue;                             // 塗るときは、裏を向いた面は描かない
    const lit = 0.25 + 0.75 * Math.max(0, -dot(n, LIGHT));
    const dz = f.reduce((m, i) => m + scr[i].dz, 0) / f.length;
    faces.push({ f, lit, dz, front });
  }
  faces.sort((a, b) => b.dz - a.dz);
  if (hollow) {
    // 中抜き：奥の面の辺を薄く → 手前の面はうっすら色をのせて、辺を光らせる
    const lwd = Math.max(0.8, c.scale * Math.min(size.width, size.height) * 0.006);
    ctx.lineJoin = 'round';
    for (const { f, lit, front } of faces) {
      ctx.beginPath();
      f.forEach((i, k) => (k ? ctx.lineTo(scr[i].x, scr[i].y) : ctx.moveTo(scr[i].x, scr[i].y)));
      ctx.closePath();
      if (front) { ctx.globalAlpha = (0.05 + 0.12 * lit) * (1 - fog); ctx.fillStyle = base; ctx.fill(); }
      ctx.globalAlpha = (front ? 0.95 : 0.28) * (1 - fog);
      ctx.strokeStyle = front ? mix(base, '#ffffff', 0.25 * lit) : base;
      ctx.lineWidth = front ? lwd : lwd * 0.6;
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    return;
  }
  ctx.lineJoin = 'round';
  for (const { f, lit } of faces) {
    ctx.beginPath();
    f.forEach((i, k) => (k ? ctx.lineTo(scr[i].x, scr[i].y) : ctx.moveTo(scr[i].x, scr[i].y)));
    ctx.closePath();
    ctx.globalAlpha = 1;
    // 面の色：地の色 → 物の色を明るさで混ぜ、もやで地の色へ戻す
    ctx.fillStyle = mix(mix(ink.bg, base, 0.3 + 0.7 * lit), ink.bg, fog * 0.85);
    ctx.fill();
    ctx.strokeStyle = mix(base, ink.bg, fog);
    ctx.globalAlpha = 0.8 * (1 - fog);
    ctx.lineWidth = Math.max(0.6, c.scale * Math.min(size.width, size.height) * 0.004);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

// 球（丸みは光の側を明るくする色の移り変わり）。planet は輪を付ける（奥の半分 → 球 → 手前の半分の順）
function drawBall(ctx, obj, c, cam, size, ink, base, fog, s, r) {
  const R = s * c.scale * Math.min(size.width, size.height);
  if (!(R > 0.5)) return;
  const ring = obj.kind === 'planet';
  const ringPts = [];
  if (ring) for (let k = 0; k <= 64; k++) { const a = (k / 64) * Math.PI * 2; const q = rot([Math.cos(a) * 1.9, 0, Math.sin(a) * 1.9], { ...r, pitch: (r.pitch ?? 0) + 0.45 }); ringPts.push(project(cam, [obj.pos[0] + q[0] * s, obj.pos[1] + q[1] * s, obj.pos[2] + q[2] * s], size)); }
  const drawRing = front => {
    if (!ring || ringPts.some(p => !p)) return;
    ctx.strokeStyle = mix(obj.color === 'accent' ? ink.fg : ink.accent, ink.bg, fog);
    ctx.lineWidth = Math.max(1, R * 0.12); ctx.globalAlpha = 0.85;
    ctx.beginPath();
    let open = false;
    ringPts.forEach(p => { const isFront = p.dz < c.dz; if (isFront === front) { if (!open) { ctx.moveTo(p.x, p.y); open = true; } else ctx.lineTo(p.x, p.y); } else open = false; });
    ctx.stroke(); ctx.globalAlpha = 1;
  };
  drawRing(false);
  const lx = c.x + LIGHT[0] * R * 0.55, ly = c.y + LIGHT[1] * R * 0.55;
  const g = ctx.createRadialGradient(lx, ly, R * 0.05, c.x, c.y, R);
  g.addColorStop(0, mix(mix(base, '#ffffff', 0.45), ink.bg, fog * 0.85));
  g.addColorStop(0.5, mix(base, ink.bg, fog * 0.85));
  g.addColorStop(1, mix(ink.bg, base, 0.3 * (1 - fog)));
  ctx.fillStyle = g; ctx.globalAlpha = 1;
  ctx.beginPath(); ctx.arc(c.x, c.y, R, 0, Math.PI * 2); ctx.fill();
  // 縁の光（逆光の輪郭）
  ctx.strokeStyle = mix(base, ink.bg, fog); ctx.globalAlpha = 0.5 * (1 - fog); ctx.lineWidth = Math.max(1, R * 0.03);
  ctx.beginPath(); ctx.arc(c.x, c.y, R * 0.985, Math.PI * 0.05, Math.PI * 0.95); ctx.stroke(); ctx.globalAlpha = 1;
  drawRing(true);
}

// 線でできた球（中抜き）：輪郭・緯線 3 本・経線 4 本（物の回転で回る）。planet は輪も線で
function drawWireBall(ctx, obj, c, cam, size, ink, base, fog, s, r) {
  const R = s * c.scale * Math.min(size.width, size.height);
  if (!(R > 0.5)) return;
  const lwd = Math.max(0.8, R * 0.025);
  const line = (pts, alpha) => {
    if (pts.some(p => !p)) return;
    ctx.globalAlpha = alpha * (1 - fog); ctx.beginPath();
    pts.forEach((p, k) => (k ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.stroke();
  };
  const at = (x, y, z) => { const q = rot([x, y, z], r); return project(cam, [obj.pos[0] + q[0] * s, obj.pos[1] + q[1] * s, obj.pos[2] + q[2] * s], size); };
  ctx.strokeStyle = base; ctx.lineWidth = lwd * 0.7;
  for (const la of [-0.5, 0, 0.5]) { const pts = []; for (let k = 0; k <= 40; k++) { const a = (k / 40) * Math.PI * 2; pts.push(at(Math.cos(a) * Math.cos(la), Math.sin(la), Math.sin(a) * Math.cos(la))); } line(pts, 0.55); }
  for (let m = 0; m < 4; m++) { const lo = (m / 4) * Math.PI; const pts = []; for (let k = 0; k <= 40; k++) { const a = (k / 40) * Math.PI * 2; pts.push(at(Math.cos(a) * Math.cos(lo), Math.sin(a), Math.cos(a) * Math.sin(lo))); } line(pts, 0.4); }
  // 輪郭（いちばん明るく）
  ctx.globalAlpha = 0.95 * (1 - fog); ctx.strokeStyle = mix(base, '#ffffff', 0.3); ctx.lineWidth = lwd;
  ctx.beginPath(); ctx.arc(c.x, c.y, R, 0, Math.PI * 2); ctx.stroke();
  if (obj.kind === 'planet') {
    const pts = []; for (let k = 0; k <= 64; k++) { const a = (k / 64) * Math.PI * 2; const q = rot([Math.cos(a) * 1.9, 0, Math.sin(a) * 1.9], { ...r, pitch: (r.pitch ?? 0) + 0.45 }); pts.push(project(cam, [obj.pos[0] + q[0] * s, obj.pos[1] + q[1] * s, obj.pos[2] + q[2] * s], size)); }
    ctx.strokeStyle = obj.color === 'accent' ? ink.fg : ink.accent; ctx.lineWidth = lwd * 1.4; line(pts, 0.9);
  }
  ctx.globalAlpha = 1;
}
