// 文字を載せる「器」の道具（見本 app/vessel-check.js と、のちの本編で同じ形にする）。
// 器はどれも draw(c, S) で、器そのものと文字の両方を描く（1 文字ずつ器に入れるものがあるので）。
// 座標は画面の画素（左上が 0,0）。S.T は出始めからの秒、S.OUT で消え始める。線画が主：線は fg、強調語は accent、差し色は band。
export const TAU = Math.PI * 2;
export const cl = x => Math.max(0, Math.min(1, x));
export const ease = q => 1 - Math.pow(1 - cl(q), 3);
export const back = q => { const k = 1.7, x = cl(q) - 1; return 1 + (k + 1) * x * x * x + k * x * x; }; // 少し行き過ぎて戻る
export const lerp = (a, b, q) => a + (b - a) * q;
export const hash = (a, b = 0) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); };
const fin = (v, d = 0) => (Number.isFinite(v) ? v : d);

/** 角丸の四角の道すじ */
export function rr(c, x, y, w, h, r) {
  const q = Math.max(0, Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2));
  c.beginPath();
  c.moveTo(x + q, y);
  c.arcTo(x + w, y, x + w, y + h, q); c.arcTo(x + w, y + h, x, y + h, q);
  c.arcTo(x, y + h, x, y, q); c.arcTo(x, y, x + w, y, q);
  c.closePath();
}
/** 折れ線（closed で閉じる） */
export function poly(c, pts, closed = true) {
  c.beginPath();
  pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
  if (closed) c.closePath();
}
export const seg = (c, x0, y0, x1, y1) => { c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); };
/** 線を q（0〜1）の分だけ描いた途中にする（len は道すじのおよその長さ） */
export const dashOn = (c, len, q) => c.setLineDash(q >= 1 ? [] : [Math.max(0.01, len * cl(q)), len + 1]);
// まとめ描きの道すじ：Path2D があればそれ、無い所（試験の node）では同じ命令を覚えておいて描くときに流す
class PathRec {
  constructor() { this.ops = []; }
  moveTo(...a) { this.ops.push(['moveTo', a]); }
  lineTo(...a) { this.ops.push(['lineTo', a]); }
  rect(...a) { this.ops.push(['rect', a]); }
  arc(...a) { this.ops.push(['arc', a]); }
}
export const newPath = () => (typeof Path2D === 'function' ? new Path2D() : new PathRec());
/** 道すじを塗る（how：'fill' か 'stroke'） */
export function paintPath(c, p, how = 'fill') {
  if (!(p instanceof PathRec)) { c[how](p); return; }
  c.beginPath();
  for (const [op, a] of p.ops) c[op](...a);
  c[how]();
}

// 文字の幅：100px で測って縮尺で使う（描く画面ごと。書体の読み込み途中は覚えない）
const widthCache = new WeakMap();
const fontsReady = () => { const f = globalThis.document?.fonts; return !f || f.status === 'loaded'; };

/**
 * 器に渡す道具と時刻（S）。
 * @param {CanvasRenderingContext2D} ctx
 * @param {{W:number,H:number,T:number,LOOP?:number,OUT?:number,beat?:number,pal:{bg:string,fg:string,accent:string,band:string,light:boolean},
 *   face:{family:string,light:string,heavy:string}, text:string, emph:number[]}} o
 */
export function vesselTools(ctx, o) {
  const W = Math.max(1, fin(o.W, 1)), H = Math.max(1, fin(o.H, 1));
  const U = Math.min(W, H), T = Math.max(0, fin(o.T));
  const LOOP = fin(o.LOOP, 4.8), OUT = fin(o.OUT, LOOP - 0.95);
  const pal = o.pal, face = o.face;
  const chars = Array.from(o.text || ' ');
  const [es, el] = o.emph ?? [0, 0];
  const isE = i => i >= es && i < es + el;
  const english = !chars.some(ch => /[^\x00-\x7F]/.test(ch));
  const fontOf = (px, heavy) => `${heavy ? face.heavy : face.light} ${Math.max(1, px)}px ${face.family}`;
  let cache = widthCache.get(ctx);
  if (!cache) { cache = new Map(); widthCache.set(ctx, cache); }
  const cw = (str, px, heavy) => {
    const k = `${face.family}|${heavy ? face.heavy : face.light}|${str}`;
    let w = cache.get(k);
    if (w == null) {
      const prev = ctx.font;
      ctx.font = fontOf(100, heavy);
      w = fin(ctx.measureText(str)?.width);
      if (typeof prev === 'string') ctx.font = prev;
      if (fontsReady()) cache.set(k, w);
    }
    return w * px / 100;
  };
  const beat = fin(o.beat, 0.5);
  const S = {
    W, H, U, T, LOOP, OUT, pal, face, chars, es, el, isE, english,
    text: chars.join(''), emph: chars.slice(es, es + el).join(''),
    head: chars.slice(0, es).join('').trim(), tail: chars.slice(es + el).join('').trim(),
    cx: W / 2, cy: H / 2, lw: Math.max(1, U * 0.006),
    beat, beatN: Math.floor(T / beat), beatQ: Math.pow(1 - (T / beat - Math.floor(T / beat)), 3),
    font: fontOf, cw, hash,
    /** 出てくる進み（d 秒遅れ、dur 秒で） */
    in: (d = 0, dur = 0.5) => ease((T - 0.12 - d) / dur),
    inRaw: (d = 0, dur = 0.5) => cl((T - 0.12 - d) / dur),
    /** 消えていく進み */
    out: (d = 0, dur = 0.5) => ease((T - OUT - d) / dur),
    /** 1 文字ずつ出る濃さ（打ち込み） */
    typeA: (i, d = 0.3, step = 0.05) => cl((T - 0.12 - d - i * step) / 0.1),
  };
  S.vis = 1 - S.out(0, 0.6);
  /** 文字列を描く。x は真ん中、y は字の真ん中。stroke で縁取りだけ、outline で地の色の縁＋塗り */
  S.say = (c, str, x, y, px, op = {}) => {
    if (!str || !(px > 0.5)) return 0;
    const heavy = op.heavy ?? false;
    c.font = fontOf(px, heavy);
    c.textBaseline = 'alphabetic';
    const w = cw(str, px, heavy);
    const X = op.align === 'left' ? x : op.align === 'right' ? x - w : x - w / 2;
    const Y = y + px * 0.36;
    const col = op.color ?? pal.fg;
    c.lineJoin = 'round';
    if (op.outline) { c.lineWidth = px * 0.16; c.strokeStyle = op.outline === true ? pal.bg : op.outline; c.strokeText(str, X, Y); }
    if (op.stroke) { c.lineWidth = op.lw ?? Math.max(1, px * 0.035); c.strokeStyle = col; c.strokeText(str, X, Y); }
    else { c.fillStyle = col; c.fillText(str, X, Y); }
    return w;
  };
  /** 行を 1 本に並べたときの文字の位置（強調語は k 倍・太字）。x は文字の左、w は幅。全体の幅は width */
  S.layout = (px, k = 1.3) => {
    let x = 0;
    const glyphs = chars.map((ch, i) => { const e = isE(i), p = px * (e ? k : 1), w = cw(ch, p, e); const g = { i, ch, e, x, w, px: p }; x += w; return g; });
    return { glyphs, width: x };
  };
  /** 幅 maxW に収まる文字の大きさ（上限 maxPx） */
  S.fit = (maxW, maxPx, k = 1.3) => { const w = S.layout(100, k).width; return Math.min(maxPx, w > 0 ? maxW / w * 100 : maxPx); };
  S.fitStr = (str, maxW, maxPx, heavy) => { const w = cw(str, 100, heavy); return Math.min(maxPx, w > 0 ? maxW / w * 100 : maxPx); };
  /**
   * 行を真ん中 (x, y) に描く。each(g, k) で 1 文字ずつ { alpha, dx, dy, rot, scale, color, stroke } を返せる
   * @returns 並べた結果（左右は画面の座標）
   */
  S.line = (c, x, y, px, op = {}) => {
    const k = op.k ?? 1.3;
    const lay = S.layout(px, k);
    const left = x - lay.width / 2;
    lay.glyphs.forEach((g, n) => {
      if (!g.ch.trim()) return;
      const ov = op.each ? op.each(g, n) ?? {} : {};
      const a = (op.alpha ?? 1) * (ov.alpha ?? 1);
      if (!(a > 0.003)) return;
      c.save();
      c.globalAlpha *= Math.min(1, a);
      const gx = left + g.x + g.w / 2 + (ov.dx ?? 0), gy = y + (ov.dy ?? 0);
      c.translate(gx, gy);
      if (ov.rot) c.rotate(ov.rot);
      if (ov.scale != null) c.scale(ov.scale, ov.scale);
      S.say(c, g.ch, 0, 0, g.px, {
        heavy: g.e || op.heavy, color: ov.color ?? (g.e ? (op.ecolor ?? pal.accent) : (op.color ?? pal.fg)),
        stroke: ov.stroke ?? (g.e ? op.estroke : op.stroke), outline: ov.outline ?? op.outline, lw: op.lw,
      });
      c.restore();
    });
    return { left, right: left + lay.width, width: lay.width, glyphs: lay.glyphs.map(g => ({ ...g, cx: left + g.x + g.w / 2 })) };
  };
  /**
   * 1 文字ずつ器に入れるときの升目：文字を何段かに折り、升目の大きさ s がいちばん大きくなる段数を選ぶ。
   * 空白は升目を作らない（space:true）。gap は升目どうしのすき間（升目の大きさに対する割合）
   */
  S.cells = (op = {}) => {
    const gap = op.gap ?? 0.18, rowGap = op.rowGap ?? gap, maxS = op.max ?? U * 0.24, wK = op.w ?? 0.9, hK = op.h ?? 0.72, aspect = op.aspect ?? 1;
    const N = chars.length;
    // 段に分ける：空白のある行（英語など）は単語の切れ目で折り、段の頭と終わりの空白は落とす。無ければ同じ文字数ずつ
    const split = target => {
      const idx = chars.map((_, i) => i);
      if (!chars.some(ch => !ch.trim())) { const per = Math.ceil(N / target); return Array.from({ length: target }, (_, r) => idx.slice(r * per, (r + 1) * per)).filter(r => r.length); }
      const per = Math.ceil(N / target), out = [];
      let row = [], word = [];
      const flush = () => { if (!word.length) return; if (row.length && row.length + 1 + word.length > per) { out.push(row); row = []; } if (row.length) row.push(word[0] - 1); row.push(...word); word = []; };
      idx.forEach(i => { if (chars[i].trim()) word.push(i); else flush(); });
      flush();
      if (row.length) out.push(row);
      return out;
    };
    let best = null;
    for (let target = 1; target <= 4; target++) {
      const rowsL = split(target), rows = rowsL.length, per = Math.max(...rowsL.map(r => r.length));
      const s = Math.min(maxS, W * wK / (per * (aspect + gap)), H * hK / (rows * (1 + rowGap)));
      if (!best || s > best.s * 1.04) best = { rowsL, rows, s };
    }
    const { rowsL, rows, s } = best;
    const sw = s * aspect, out = [];
    rowsL.forEach((list, r) => {
      const rowW = list.length * sw + (list.length - 1) * s * gap;
      list.forEach((i, k) => {
        const ch = chars[i];
        out.push({ i, ch, e: isE(i), space: !ch.trim(), x: W / 2 - rowW / 2 + k * (sw + s * gap) + sw / 2, y: H / 2 - (rows * s + (rows - 1) * s * rowGap) / 2 + r * (s * (1 + rowGap)) + s / 2, s, sw, row: r, col: k });
      });
    });
    return out;
  };

  // ---- 立体：カメラが器のまわりを回り込む（yaw・pitch はゆっくり揺れる） ----
  S.cam = (yaw = Math.sin(T * 0.55) * 0.55, pitch = -0.28 + Math.sin(T * 0.4) * 0.12, dist = 3.2) => {
    const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
    const F = U * 0.95;
    return (x, y, z) => {
      // 器の座標：x 右・y 下・z 手前（単位は画面の短い辺の半分くらい）
      const x1 = x * cy - z * sy, z1 = x * sy + z * cy;
      const y2 = y * cp - z1 * sp, z2 = y * sp + z1 * cp;
      const d = Math.max(0.3, dist - z2);
      return { x: W / 2 + x1 * F / d, y: H / 2 + y2 * F / d, s: F / d, z: z2 };
    };
  };
  /** 立体の折れ線を描く（P は S.cam の結果） */
  S.poly3 = (c, P, pts, closed = true) => poly(c, pts.map(p => { const q = P(...p); return [q.x, q.y]; }), closed);
  /**
   * 立体の平面に描く：o3 が平面の真ん中、ux・uy が平面の右・下の向き（長さ 1）。
   * draw の中は「立体の 1 単位 = 100」の座標（細かい字がつぶれないように 100 倍で描く）。遠近は真ん中の近くでの見え方で近づける
   */
  S.onPlane = (c, P, o3, ux, uy, draw) => {
    const e = 0.05;
    const o = P(...o3), a = P(o3[0] + ux[0] * e, o3[1] + ux[1] * e, o3[2] + ux[2] * e), b = P(o3[0] + uy[0] * e, o3[1] + uy[1] * e, o3[2] + uy[2] * e);
    c.save();
    c.transform((a.x - o.x) / e, (a.y - o.y) / e, (b.x - o.x) / e, (b.y - o.y) / e, o.x, o.y);
    c.scale(0.01, 0.01);
    draw(c);
    c.restore();
  };
  /** 立体の平面に行を描く：1 文字ずつ、その文字の場所での遠近に合わせる（面の端でも字が面からずれない）。px は 1 単位 = 100 の大きさ */
  S.line3 = (c, P, o3, ux, uy, px, op = {}) => {
    const lay = S.layout(px, op.k ?? 1.3);
    lay.glyphs.forEach((g, n) => {
      if (!g.ch.trim()) return;
      const ov = op.each ? op.each(g, n) ?? {} : {};
      const a = (op.alpha ?? 1) * (ov.alpha ?? 1);
      if (!(a > 0.003)) return;
      const f = (g.x + g.w / 2 - lay.width / 2) / 100;
      c.save(); c.globalAlpha *= Math.min(1, a);
      S.onPlane(c, P, [o3[0] + ux[0] * f, o3[1] + ux[1] * f, o3[2] + ux[2] * f], ux, uy, cc => S.say(cc, g.ch, 0, 0, g.px, { heavy: g.e, color: g.e ? pal.accent : (op.color ?? pal.fg) }));
      c.restore();
    });
  };
  /** 面が手前を向いているか：面の角を外から見て 左上 a・右上 b・左下 d の順に渡す */
  S.facing = (P, a, b, d) => { const A = P(...a), B = P(...b), D = P(...d); return (B.x - A.x) * (D.y - A.y) - (B.y - A.y) * (D.x - A.x) > 0; };
  /**
   * 箱の 6 面（外から見て 左上・右上・右下・左下 の順）。x・y・z が真ん中、a・b・d が半分の幅・高さ・奥行き。
   * 面ごとに { name, pts, o（真ん中）, ux, uy } を返す。凸の箱なので、手前を向いた面だけ描けば重なりは正しい
   */
  S.boxFaces = (x, y, z, a, b, d) => {
    const v = (i, j, k) => [x + i * a, y + j * b, z + k * d];
    const F = [
      ['front', [v(-1, -1, 1), v(1, -1, 1), v(1, 1, 1), v(-1, 1, 1)]],
      ['back', [v(1, -1, -1), v(-1, -1, -1), v(-1, 1, -1), v(1, 1, -1)]],
      ['right', [v(1, -1, 1), v(1, -1, -1), v(1, 1, -1), v(1, 1, 1)]],
      ['left', [v(-1, -1, -1), v(-1, -1, 1), v(-1, 1, 1), v(-1, 1, -1)]],
      ['top', [v(-1, -1, -1), v(1, -1, -1), v(1, -1, 1), v(-1, -1, 1)]],
      ['bottom', [v(-1, 1, 1), v(1, 1, 1), v(1, 1, -1), v(-1, 1, -1)]],
    ];
    const unit = (p, q) => { const dx = q[0] - p[0], dy = q[1] - p[1], dz = q[2] - p[2], l = Math.hypot(dx, dy, dz) || 1; return [dx / l, dy / l, dz / l]; };
    return F.map(([name, pts]) => ({
      name, pts,
      o: [0, 1, 2].map(k => (pts[0][k] + pts[2][k]) / 2),
      ux: unit(pts[0], pts[1]), uy: unit(pts[0], pts[3]),
      w: Math.hypot(...[0, 1, 2].map(k => pts[1][k] - pts[0][k])), h: Math.hypot(...[0, 1, 2].map(k => pts[3][k] - pts[0][k])),
    }));
  };
  /** 箱を線画で描く（手前を向いた面だけ。面は地の色で塗ってから線）。onFace(face, c) で面の座標に、onFace3(face) で画面の座標に描ける */
  S.drawBox = (c, P, faces, op = {}) => {
    for (const f of faces) {
      if (!S.facing(P, f.pts[0], f.pts[1], f.pts[3])) continue;
      S.poly3(c, P, f.pts);
      c.fillStyle = op.fill ?? pal.bg; c.fill();
      c.strokeStyle = op.stroke ?? pal.fg; c.lineWidth = op.lw ?? S.lw; c.stroke();
      if (op.onFace) S.onPlane(c, P, f.o, f.ux, f.uy, cc => op.onFace(f, cc));
      if (op.onFace3) op.onFace3(f); // 面の上に S.line3 などで描く（画面の座標のまま）
    }
  };

  // 点で描く文字：小さい画面に文字を描いて、塗られた所を拾う（大きさ・書体ごとに覚える）
  S.bitmap = (str, cols, heavy = true) => dotsOf(str, cols, fontOf, heavy);
  return S;
}

const bitmaps = new Map();
function dotsOf(str, rowsH, fontOf, heavy) {
  const k = `${fontOf(10, heavy)}|${str}|${rowsH}`;
  if (bitmaps.has(k)) return bitmaps.get(k);
  let cv;
  try {
    if (typeof OffscreenCanvas === 'function') cv = new OffscreenCanvas(8, 8);
    else if (globalThis.document?.createElement) cv = globalThis.document.createElement('canvas');
  } catch { cv = null; }
  const g = cv?.getContext?.('2d', { willReadFrequently: true });
  if (!g) return { w: 0, h: 0, on: () => false };
  const px = rowsH;
  g.font = fontOf(px, heavy);
  const w = Math.max(1, Math.ceil(g.measureText(str).width)), h = Math.ceil(px * 1.15);
  cv.width = w; cv.height = h;
  g.font = fontOf(px, heavy);
  g.fillStyle = '#fff';
  g.textBaseline = 'alphabetic';
  g.fillText(str, 0, px * 0.92);
  const data = g.getImageData(0, 0, w, h).data;
  const out = { w, h, on: (x, y) => x >= 0 && y >= 0 && x < w && y < h && data[(y * w + x) * 4 + 3] > 110 };
  if (fontsReady()) { if (bitmaps.size > 60) bitmaps.clear(); bitmaps.set(k, out); }
  return out;
}
