// 連想の小物（fx.prop）の形の道具。小物は「点の列（線）」をいくつも並べたもので表す。
// 小物の中の座標は、大きさ 1（だいたい半径 1 に収まる）・x は右・y は上・z は奥（描く係が世界の y 下向きに直す）。
// 線（path）= [[x,y,z], ...]。形（item）= 線か、線や形を入れ子にした配列。hot(...) で印を付けた線は目立つ色で描く。
const TAU = Math.PI * 2;
export { TAU };

// 平面の向き：'z' は正面（xy）、'y' は水平（xz）、'x' は横向き（zy）
const PLANE = {
  z: (u, v) => [u, v, 0],
  y: (u, v) => [u, 0, v],
  x: (u, v) => [0, v, u],
};
const add = (p, c) => [p[0] + (c?.[0] ?? 0), p[1] + (c?.[1] ?? 0), p[2] + (c?.[2] ?? 0)];
const plane = ax => PLANE[ax] ?? PLANE.z;

/** 線かどうか（点の配列） */
export const isPath = x => Array.isArray(x) && x.length > 0 && Array.isArray(x[0]) && typeof x[0][0] === 'number';

/** 入れ子の形を、線の平らな一覧にする */
export function flat(item, out = []) {
  if (!Array.isArray(item) || item.length === 0) return out;
  if (isPath(item)) { out.push(item); return out; }
  for (const x of item) flat(x, out);
  return out;
}

/** すべての点を f で写した新しい形（印 hot は引き継ぐ） */
export function tf(item, f) {
  if (!Array.isArray(item) || item.length === 0) return [];
  if (isPath(item)) { const p = item.map(f); if (item.hot) p.hot = true; return p; }
  return item.map(x => tf(x, f));
}
export const mv = (item, dx = 0, dy = 0, dz = 0) => tf(item, p => [p[0] + dx, p[1] + dy, p[2] + dz]);
export const sc = (item, sx = 1, sy = sx, sz = sx) => tf(item, p => [p[0] * sx, p[1] * sy, p[2] * sz]);
export const rotZ = (item, a, c = [0, 0, 0]) => { const cs = Math.cos(a), sn = Math.sin(a); return tf(item, p => { const x = p[0] - c[0], y = p[1] - c[1]; return [c[0] + x * cs - y * sn, c[1] + x * sn + y * cs, p[2]]; }); };
export const rotY = (item, a, c = [0, 0, 0]) => { const cs = Math.cos(a), sn = Math.sin(a); return tf(item, p => { const x = p[0] - c[0], z = p[2] - c[2]; return [c[0] + x * cs + z * sn, p[1], c[2] - x * sn + z * cs]; }); };
export const rotX = (item, a, c = [0, 0, 0]) => { const cs = Math.cos(a), sn = Math.sin(a); return tf(item, p => { const y = p[1] - c[1], z = p[2] - c[2]; return [p[0], c[1] + y * cs - z * sn, c[2] + y * sn + z * cs]; }); };
/** 左右の写しと合わせる */
export const mirror = item => [item, tf(item, p => [-p[0], p[1], p[2]])];
/** 印を付ける（目立つ色で描く線） */
export function hot(item) { for (const p of flat(item)) p.hot = true; return item; }
/** n 個並べる */
export const rep = (n, f) => Array.from({ length: Math.max(0, n | 0) }, (_, k) => f(k, n));

/** 点を並べた線（z は省略できる） */
export const line = (...pts) => pts.map(p => [p[0], p[1], p[2] ?? 0]);
/** 閉じた線 */
export const loop = (...pts) => { const l = line(...pts); l.push([...l[0]]); return l; };
/** 平らな数の列 [x0,y0,x1,y1,...] から、正面の線（closed なら閉じる） */
export function pl(nums, closed = false, z = 0) {
  const pts = [];
  for (let k = 0; k + 1 < nums.length; k += 2) pts.push([nums[k], nums[k + 1], z]);
  if (closed && pts.length) pts.push([...pts[0]]);
  return pts;
}

/** 円弧（中心 c・半径 r・角度 a0〜a1） */
export function arc(r, a0 = 0, a1 = TAU, c, ax = 'z', n) {
  const N = n ?? Math.max(4, Math.ceil((Math.abs(a1 - a0) / TAU) * 32));
  const f = plane(ax);
  const out = [];
  for (let k = 0; k <= N; k++) { const a = a0 + ((a1 - a0) * k) / N; out.push(add(f(Math.cos(a) * r, Math.sin(a) * r), c)); }
  return out;
}
export const circle = (r, c, ax = 'z', n) => arc(r, 0, TAU, c, ax, n);
/** だ円 */
export function oval(rx, ry, c, ax = 'z', n = 32) {
  const f = plane(ax);
  return rep(n + 1, k => { const a = (k / n) * TAU; return add(f(Math.cos(a) * rx, Math.sin(a) * ry), c); });
}
/** 正多角形（rot は回す角度） */
export function ngon(n, r, c, rot = 0, ax = 'z') { return arc(r, rot + Math.PI / 2, rot + Math.PI / 2 + TAU, c, ax, n); }
/** 四角（中心 c・幅 w・高さ h） */
export function rect(w, h, c, ax = 'z') {
  const f = plane(ax), x = w / 2, y = h / 2;
  return [f(-x, -y), f(x, -y), f(x, y), f(-x, y), f(-x, -y)].map(p => add(p, c));
}
/** 角の丸い四角 */
export function rrect(w, h, r, c, ax = 'z') {
  const f = plane(ax), x = w / 2 - r, y = h / 2 - r, out = [];
  const corner = (cx, cy, a0) => { for (let k = 0; k <= 4; k++) { const a = a0 + (k / 4) * (Math.PI / 2); out.push(add(f(cx + Math.cos(a) * r, cy + Math.sin(a) * r), c)); } };
  corner(x, y, 0); corner(-x, y, Math.PI / 2); corner(-x, -y, Math.PI); corner(x, -y, Math.PI * 1.5);
  out.push([...out[0]]);
  return out;
}
/** 箱（中心 c・幅 w・高さ h・奥行き d）の12本の辺 */
export function box(w, h, d, c) {
  const x = w / 2, y = h / 2, z = d / 2;
  const P = (a, b, e) => add([a, b, e], c);
  return [
    [P(-x, -y, -z), P(x, -y, -z), P(x, y, -z), P(-x, y, -z), P(-x, -y, -z)],
    [P(-x, -y, z), P(x, -y, z), P(x, y, z), P(-x, y, z), P(-x, -y, z)],
    [P(-x, -y, -z), P(-x, -y, z)], [P(x, -y, -z), P(x, -y, z)], [P(x, y, -z), P(x, y, z)], [P(-x, y, -z), P(-x, y, z)],
  ];
}
/** 縦の筒（中心 c・半径 r・高さ h） */
export function cyl(r, h, c, n = 24, sides = 4) {
  const cc = c ?? [0, 0, 0];
  const top = circle(r, add([0, h / 2, 0], cc), 'y', n), bot = circle(r, add([0, -h / 2, 0], cc), 'y', n);
  const v = rep(sides, k => { const a = (k / sides) * TAU + 0.4; return line(add([Math.cos(a) * r, -h / 2, Math.sin(a) * r], cc), add([Math.cos(a) * r, h / 2, Math.sin(a) * r], cc)); });
  return [top, bot, v];
}
/** 円すい（底の中心 c・半径 r・高さ h。上向き） */
export function cone(r, h, c, n = 24, sides = 4) {
  const cc = c ?? [0, 0, 0];
  const tip = add([0, h, 0], cc);
  return [circle(r, cc, 'y', n), rep(sides, k => { const a = (k / sides) * TAU + 0.4; return line(add([Math.cos(a) * r, 0, Math.sin(a) * r], cc), tip); })];
}
/** 球（3本の大円と、緯線） */
export function ball(r, c, lat = 0) {
  const out = [circle(r, c, 'z'), circle(r, c, 'y'), circle(r, c, 'x')];
  for (let k = 1; k <= lat; k++) { const y = (r * k) / (lat + 1); const rr = Math.sqrt(Math.max(0, r * r - y * y)); out.push(circle(rr, add([0, y, 0], c), 'y'), circle(rr, add([0, -y, 0], c), 'y')); }
  return out;
}
/** 星形（n 個の角・外の半径 r1・内の半径 r2） */
export function star(n, r1, r2, c, rot = 0) {
  const pts = [];
  for (let k = 0; k <= n * 2; k++) { const r = k % 2 ? r2 : r1; const a = rot + Math.PI / 2 + (k / (n * 2)) * TAU; pts.push(add([Math.cos(a) * r, Math.sin(a) * r, 0], c)); }
  return pts;
}
/** ハートの形（大きさ s） */
export function heartShape(s = 1, c) {
  return rep(41, k => { const a = (k / 40) * TAU; const x = 16 * Math.pow(Math.sin(a), 3); const y = 13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a); return add([(x / 17) * s, (y / 17) * s, 0], c); });
}
/** うず巻き */
export function spiral(r0, r1, turns, c, ax = 'z', n) {
  const N = n ?? Math.ceil(turns * 28);
  const f = plane(ax);
  return rep(N + 1, k => { const u = k / N; const a = u * turns * TAU; const r = r0 + (r1 - r0) * u; return add(f(Math.cos(a) * r, Math.sin(a) * r), c); });
}
/** ばね（縦。半径 r・高さ h・巻き数 turns） */
export function coil(r, h, turns, c, n) {
  const N = n ?? Math.ceil(turns * 20);
  return rep(N + 1, k => { const u = k / N; const a = u * turns * TAU; return add([Math.cos(a) * r, -h / 2 + h * u, Math.sin(a) * r], c); });
}
/** 波線（x0〜x1・高さ y・振れ amp・山の数 cycles・ずれ ph） */
export function wave(x0, x1, y, amp, cycles, ph = 0, z = 0, n = 32) {
  return rep(n + 1, k => { const u = k / n; return [x0 + (x1 - x0) * u, y + Math.sin(u * cycles * TAU + ph) * amp, z]; });
}
/** ぎざぎざ線 */
export function zig(x0, x1, y, amp, n, z = 0) { return rep(n + 1, k => [x0 + ((x1 - x0) * k) / n, y + (k % 2 ? amp : -amp), z]); }
/** 中心から外へ向かう n 本の線（目盛り・光の筋） */
export function spokes(n, r0, r1, c, rot = 0, ax = 'z') {
  const f = plane(ax);
  return rep(n, k => { const a = rot + (k / n) * TAU; return [add(f(Math.cos(a) * r0, Math.sin(a) * r0), c), add(f(Math.cos(a) * r1, Math.sin(a) * r1), c)]; });
}
/** 3次のなめらかな曲線（ベジェ） */
export function bez(p0, p1, p2, p3, n = 16) {
  return rep(n + 1, k => { const u = k / n, v = 1 - u; return [0, 1, 2].map(i => v * v * v * (p0[i] ?? 0) + 3 * v * v * u * (p1[i] ?? 0) + 3 * v * u * u * (p2[i] ?? 0) + u * u * u * (p3[i] ?? 0)); });
}
/** 方眼（幅 w・高さ h・nx × ny の升目） */
export function grid(w, h, nx, ny, c, ax = 'z') {
  const f = plane(ax), out = [];
  for (let i = 0; i <= nx; i++) { const u = -w / 2 + (w * i) / nx; out.push([add(f(u, -h / 2), c), add(f(u, h / 2), c)]); }
  for (let j = 0; j <= ny; j++) { const v = -h / 2 + (h * j) / ny; out.push([add(f(-w / 2, v), c), add(f(w / 2, v), c)]); }
  return out;
}
/** 点 a から b への破線（n 個に切る） */
export function dashed(a, b, n = 6) {
  return rep(n, k => { const u0 = k / n, u1 = (k + 0.55) / n; return [[0, 1, 2].map(i => (a[i] ?? 0) + ((b[i] ?? 0) - (a[i] ?? 0)) * u0), [0, 1, 2].map(i => (a[i] ?? 0) + ((b[i] ?? 0) - (a[i] ?? 0)) * u1)]; });
}
/** 角柱（底の多角形 n 角・半径 r・高さ h。縦） */
export function prism(n, r, h, c, rot = 0) {
  const cc = c ?? [0, 0, 0];
  const top = ngon(n, r, add([0, h / 2, 0], cc), rot, 'y'), bot = ngon(n, r, add([0, -h / 2, 0], cc), rot, 'y');
  return [top, bot, rep(n, k => line(bot[k], top[k]))];
}
/** 角すい（底 n 角・半径 r・高さ h） */
export function pyramid(n, r, h, c, rot = 0) {
  const cc = c ?? [0, 0, 0];
  const base = ngon(n, r, cc, rot, 'y');
  const tip = add([0, h, 0], cc);
  return [base, rep(n, k => line(base[k], tip))];
}
/** 文字の代わりの短い横線の並び（本の行・画面の文字など） */
export function textLines(w, h, rows, c, ax = 'z') {
  const f = plane(ax);
  return rep(rows, k => { const v = h / 2 - (h * (k + 0.5)) / rows; const len = w * (0.55 + 0.45 * (((k * 37) % 10) / 10)); return [add(f(-w / 2, v), c), add(f(-w / 2 + len, v), c)]; });
}
/** 0〜1 の三角波（行って戻る） */
export const tri = x => 1 - Math.abs(((x % 2) + 2) % 2 - 1);
/** 0〜1 のこぎり波 */
export const saw = x => x - Math.floor(x);
