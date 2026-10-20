// 幾何学模様（間奏の場面に出す）の共通の道具。模様は画面に直接描く（2D。立体のものは簡単な遠近で映す）。
// 模様の描き方 draw(ctx, e) が受け取る e：
//   w, h：画面の大きさ（画素）／S：短辺／cx, cy：中心
//   t：曲の時刻（秒）／beat：{index, phase}（小節の番号と、小節の中の進み 0〜1。drawGeo が拍から直す）／energy：強さ 0〜1
//   fg：線の色／accent：目立たせる色／bg：地の色／seed：模様ごとの種（同じ種なら同じ絵）
// どの模様も「同じ入力なら同じ絵」（前のコマを覚えない）。小節の頭で動き、強いほど派手にする（弱い場面はほとんど叩かない）。

export const TAU = Math.PI * 2;
export const clamp01 = x => (Number.isFinite(x) ? Math.min(1, Math.max(0, x)) : 0);

/** 小節の頭で強さに応じた高さ（弱いと 0.15、強いと 1）になり、なめらかに 0 へ落ちる（sharp が大きいほど短い）。
 *  頭の一瞬（小節の 2%）で立ち上げて、カクッと跳ねないようにする */
export const pulse = (e, sharp = 6) => {
  const ph = clamp01(e.beat?.phase ?? 0), rise = 0.02;
  const env = ph < rise ? ph / rise : Math.exp(-(ph - rise) * sharp);
  return env * (0.15 + 0.85 * clamp01(e.energy ?? 0.5));
};
/** 4 小節のまとまりの中の進み 0〜1 */
export const barPhase = e => (((e.beat?.index ?? 0) % 4 + 4) % 4 + clamp01(e.beat?.phase ?? 0)) / 4;
/** 小節の番号（負にならない） */
export const beatNo = e => Math.max(0, Math.floor(e.beat?.index ?? 0));
/** 拍の頭へ向かって、ぐっと詰まってから戻る動き（−1〜1 の行き来に使う） */
export const swing = e => Math.sin(((e.beat?.index ?? 0) + clamp01(e.beat?.phase ?? 0)) * Math.PI);

/** 0〜1 の決まった乱数（同じ引数なら同じ値） */
export function hash(...n) {
  let h = 2166136261;
  for (const v of n) { h ^= Math.floor(v * 1000) | 0; h = Math.imul(h, 16777619); }
  h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995); h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

/** 線の太さ：短辺に対する割合 */
export const lw = (e, k) => Math.max(1, e.S * k);

/** 正多角形の道すじ */
export function poly(ctx, x, y, r, n, rot = 0) {
  ctx.beginPath();
  for (let i = 0; i <= n; i++) {
    const a = rot + (i / n) * TAU;
    const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

/** 星形の道すじ（尖り n 個、内側の半径の割合 k） */
export function star(ctx, x, y, r, n, k = 0.45, rot = 0) {
  ctx.beginPath();
  for (let i = 0; i <= n * 2; i++) {
    const a = rot + (i / (n * 2)) * TAU;
    const rr = i % 2 ? r * k : r;
    const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

export function circle(ctx, x, y, r) { ctx.beginPath(); ctx.arc(x, y, Math.max(0, r), 0, TAU); }
export function line(ctx, x1, y1, x2, y2) { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); }
/** 点の並びをつないだ道すじ（close で閉じる） */
export function path(ctx, pts, close = false) {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  if (close) ctx.closePath();
}

/** 線の描き方をまとめて決める */
export function pen(ctx, color, width, alpha = 1) {
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.globalAlpha = clamp01(alpha); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
}
export function ink(ctx, color, alpha = 1) { ctx.fillStyle = color; ctx.globalAlpha = clamp01(alpha); }

// ---- 立体（簡単な遠近） ----
/** 点 [x,y,z] を回す（x 軸まわり ax、y 軸まわり ay、z 軸まわり az） */
export function rot3([x, y, z], ax, ay, az = 0) {
  let c = Math.cos(ax), s = Math.sin(ax);
  [y, z] = [y * c - z * s, y * s + z * c];
  c = Math.cos(ay); s = Math.sin(ay);
  [x, z] = [x * c + z * s, -x * s + z * c];
  c = Math.cos(az); s = Math.sin(az);
  [x, y] = [x * c - y * s, x * s + y * c];
  return [x, y, z];
}
/** 立体の点を画面へ（カメラは z = -dist から原点を見る。大きさは短辺 × scale）。後ろにある点は null */
export function proj(e, [x, y, z], dist = 3, scale = 0.45) {
  const d = z + dist;
  if (d <= 0.05) return null;
  const f = (e.S * scale * dist) / d;
  return [e.cx + x * f, e.cy + y * f, f];
}
/** 辺の並び（点の番号の組）を映して描く */
export function edges3(ctx, e, pts, pairs, dist, scale) {
  const p = pts.map(q => proj(e, q, dist, scale));
  ctx.beginPath();
  for (const [a, b] of pairs) {
    if (!p[a] || !p[b]) continue;
    ctx.moveTo(p[a][0], p[a][1]); ctx.lineTo(p[b][0], p[b][1]);
  }
}

export const CUBE = {
  pts: [[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1], [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]],
  edges: [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]],
};
const G = (1 + Math.sqrt(5)) / 2;
export const ICOSA = (() => {
  const pts = [[-1, G, 0], [1, G, 0], [-1, -G, 0], [1, -G, 0], [0, -1, G], [0, 1, G], [0, -1, -G], [0, 1, -G], [G, 0, -1], [G, 0, 1], [-G, 0, -1], [-G, 0, 1]]
    .map(p => p.map(v => v / Math.hypot(1, G)));
  const edges = [];
  for (let a = 0; a < 12; a++) for (let b = a + 1; b < 12; b++) {
    const d = Math.hypot(pts[a][0] - pts[b][0], pts[a][1] - pts[b][1], pts[a][2] - pts[b][2]);
    if (Math.abs(d - 1.0515) < 0.05) edges.push([a, b]);
  }
  return { pts, edges };
})();
export const OCTA = {
  pts: [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]],
  edges: [[0, 2], [0, 3], [0, 4], [0, 5], [1, 2], [1, 3], [1, 4], [1, 5], [2, 4], [2, 5], [3, 4], [3, 5]],
};
export const TETRA = {
  pts: [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]].map(p => p.map(v => v / Math.sqrt(3))),
  edges: [[0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3]],
};
