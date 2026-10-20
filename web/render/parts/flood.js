// 歌詞そのもので画面を埋める大げさな組み（render/parts/flood-patterns.js の 52 種）を、行の板の上に描く。
// 描く係 text-motion が、行の文字より先（後ろ）に drawFlood(…, 'draw')、文字のあと（手前）に drawFlood(…, 'front') を呼ぶ。
// 座標は行の板の局所座標（行の真ん中が原点）。模様は幅 W・高さ H の四角（カメラが行に寄りきったときの画面くらい）に収める。
import { PATTERNS, CATS } from './flood-patterns.js';

/** 一覧（持ち主が選んだ 52 種）。id は種類をまたいで重ならない */
export const FLOODS = PATTERNS;
export const FLOOD_CATS = CATS;
export const FLOOD_BY_ID = Object.fromEntries(PATTERNS.map(p => [p.id, p]));

const clamp01 = x => Math.max(0, Math.min(1, x));
const ease = q => 1 - Math.pow(1 - clamp01(q), 3);
const mod = (a, n) => ((a % n) + n) % n;
const hash = (a, b = 0) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); };
const fin = (v, d = 0) => (Number.isFinite(v) ? v : d);
const KEY_RUN = /[\p{Script=Han}\p{Script=Katakana}ー]{2,}/gu; // 強調語の無い行は、漢字・カタカナのいちばん長い塊を代わりにする
const SCRATCH_MAX = 2400 * 2400;                                 // 別の画面（巨大な語の中に詰める）の画素の上限

/** 強調語の範囲（無ければ漢字・カタカナのいちばん長い塊、それも無ければ頭の 2〜4 文字）。[始まり, 長さ] */
export function floodWord(chars, emph) {
  const N = chars.length;
  if (Array.isArray(emph) && emph[0] >= 0 && emph[0] < N && emph[1] > 0) return [emph[0], Math.min(emph[1], N - emph[0])];
  const text = chars.join('');
  let best = null;
  for (const m of text.matchAll(KEY_RUN)) {
    const start = Array.from(text.slice(0, m.index)).length, len = Array.from(m[0]).length;
    if (!best || len > best[1]) best = [start, len];
  }
  if (best) return best;
  let s = 0;
  while (s < N && !String(chars[s]).trim()) s++;
  return [Math.min(s, Math.max(0, N - 1)), Math.max(1, Math.min(N <= 6 ? 2 : 4, N - s))];
}

// 文字の幅：100px で測って縮尺で使う（描いている画面ごとに覚える。書体が読み込み途中のあいだは覚えない）
const widthCache = new WeakMap();
const fontsReady = () => { const f = globalThis.document?.fonts; return !f || f.status === 'loaded'; };

// 別の画面（巨大な語の中に歌詞を詰める）。作れない所（試験など）では null
const scratches = new Map();
function scratchCanvas(name, W, H) {
  const w = Math.max(1, Math.round(W)), h = Math.max(1, Math.round(H));
  const k = Math.min(1, Math.sqrt(SCRATCH_MAX / (w * h)));
  const cw = Math.max(1, Math.round(w * k)), ch = Math.max(1, Math.round(h * k));
  const key = `${name}|${cw}x${ch}`;
  let cv = scratches.get(key);
  if (cv) return cv;
  try {
    if (typeof OffscreenCanvas === 'function') cv = new OffscreenCanvas(cw, ch);
    else if (globalThis.document?.createElement) { cv = globalThis.document.createElement('canvas'); cv.width = cw; cv.height = ch; }
  } catch { cv = null; }
  if (!cv?.getContext) return null;
  if (scratches.size > 8) scratches.clear();
  scratches.set(key, cv);
  return cv;
}

/**
 * 模様に渡す道具と時刻（S）を作る。見本（app/fill-check.js）と同じ形。
 * @param {CanvasRenderingContext2D} ctx 文字の幅を測るのにも使う（測ったあとは書体を元に戻す）
 * @param {{W:number, H:number, T:number, beat?:{index:number, phase:number, len?:number}, pal:{bg:string,fg:string,accent:string,band:string,light:boolean},
 *   face:{family:string, light:string, heavy:string}, chars:string[], emph?:number[], glyphs:{ch:string,x:number,y:number,w:number,px:number,font:string,e?:boolean}[],
 *   px:number, ga:number, gap?:string}} o glyphs は模様の四角の座標（左上が 0,0）に直した本体の行の文字
 */
export function floodTools(ctx, o) {
  const W = Math.max(1, fin(o.W, 1)), H = Math.max(1, fin(o.H, 1));
  const U = Math.min(W, H);
  const T = Math.max(0, fin(o.T));
  const pal = o.pal;
  const face = o.face;
  const chars = o.chars.length ? o.chars : [' '];
  const [es, el] = floodWord(chars, o.emph);
  const isE = i => i >= es && i < es + el;
  const gapChars = Array.from(o.gap ?? (chars.some(c => /[A-Za-z]/.test(c)) && !chars.some(c => /[^\x00-\x7F]/.test(c)) ? '   ' : '　'));
  const unit = [...chars.map((ch, i) => ({ ch, e: isE(i) })), ...gapChars.map(ch => ({ ch, e: false }))];
  const emph = chars.slice(es, es + el).join('');
  const fontOf = (px, heavy) => `${heavy ? face.heavy : face.light} ${px}px ${face.family}`;
  let cache = widthCache.get(ctx);
  if (!cache) { cache = new Map(); widthCache.set(ctx, cache); }
  const cw = (ch, px, heavy) => {
    const k = `${face.family}|${heavy ? face.heavy : face.light}|${ch}`;
    let w = cache.get(k);
    if (w == null) {
      const prev = ctx.font;
      ctx.font = fontOf(100, heavy);
      w = fin(ctx.measureText(ch)?.width);
      if (typeof prev === 'string') ctx.font = prev;
      if (fontsReady()) cache.set(k, w);
    }
    return w * px / 100;
  };
  const beatLen = fin(o.beat?.len, 0.5) > 0.05 ? fin(o.beat?.len, 0.5) : 0.5;
  const hasBeat = o.beat && o.beat.index >= 0 && Number.isFinite(o.beat.phase);
  const phase = hasBeat ? clamp01(o.beat.phase) : T / beatLen - Math.floor(T / beatLen);
  const beatN = hasBeat ? Math.floor(o.beat.index) : Math.floor(T / beatLen);
  const ga = clamp01(fin(o.ga, 1));
  const uwCache = new Map();
  const glyphs = o.glyphs ?? [];
  const box = list => (list.length ? {
    left: Math.min(...list.map(g => g.x)), right: Math.max(...list.map(g => g.x + g.w)),
    top: Math.min(...list.map(g => g.y - g.px * 0.86)), bottom: Math.max(...list.map(g => g.y + g.px * 0.12)),
  } : { left: W / 2, right: W / 2, top: H / 2, bottom: H / 2 });
  const S = {
    W, H, U, T, t: T, pal, unit, chars, emph, emphChars: Array.from(emph).filter(ch => ch !== ' '),
    beat: beatLen, beatN, beatQ: Math.pow(1 - phase, 3), beatAge: k => (k + phase) * beatLen,
    dim: pal.light ? 0.3 : 0.24, ga,
    inQ: ease((T - 0.2) / 0.7),
    in: (d, dur = 0.5) => ease((T - 0.2 - d) / dur),
    m: { glyphs, px: fin(o.px, U * 0.1), L: box(glyphs), E: box(glyphs.filter(g => g.e)) },
    mod, hash, cw, font: fontOf,
    UW: (px, heavy) => { const k = heavy ? 1 : 0; if (!uwCache.has(k)) uwCache.set(k, unit.reduce((s, u) => s + cw(u.ch, 100, heavy), 0)); return uwCache.get(k) * px / 100; },
    lineW: (px, heavy) => chars.reduce((s, ch) => s + cw(ch, px, heavy), 0),
    wordW: (px, heavy) => cw(emph, px, heavy),
    fitWord: (target, heavy) => target / Math.max(1, cw(emph, 100, heavy)) * 100,
    scratch: name => scratchCanvas(name, W, H),
    proj: (x, y, z) => { const F = U * 1.1, zz = Math.max(0.05, z); return { x: W / 2 + x * F / zz, y: H / 2 + y * F / zz, s: F / zz }; },
    circle: (cx, cy, r, n = 96, a0 = 0) => Array.from({ length: n }, (_, k) => { const a = a0 + k * Math.PI * 2 / n; return [cx + Math.cos(a) * r, cy + Math.sin(a) * r]; }),
  };
  // 1 文字を置く（書体は呼ぶ側で合わせておく）。raw は全体の濃さ ga を掛けない（別の画面に描くとき）
  S.put = (c, u, X, Y, op = {}) => {
    if (u.ch === ' ' || u.ch === '　') return;
    const e = u.e && op.emph !== false;
    const a = (e ? (op.ealpha ?? op.alpha ?? 1) : (op.alpha ?? 1)) * (op.raw ? 1 : ga);
    if (!(a > 0.003)) return;
    const col = e ? (op.ecolor ?? pal.accent) : (op.color ?? pal.fg);
    const mode = e ? (op.emode ?? op.mode ?? 'fill') : (op.mode ?? 'fill');
    c.globalAlpha = Math.min(1, a);
    if (mode !== 'stroke') { c.fillStyle = col; c.fillText(u.ch, X, Y); }
    if (mode !== 'fill') { c.strokeStyle = col; c.strokeText(u.ch, X, Y); }
  };
  // ひと続きを x から右へ（vertical なら y から下へ）並べる。until を超えたら止める。each(k,u,pos) で 1 文字ずつ上書きできる
  S.run = (c, x, y, px, op = {}) => {
    const heavy = !!op.heavy;
    if (!(px > 0.5)) return x;
    c.font = fontOf(px, heavy);
    c.lineWidth = op.lw ?? Math.max(0.8, px * 0.04);
    c.lineJoin = 'round';
    const n = op.n ?? Infinity, until = op.until ?? Infinity;
    let pos = op.vertical ? y : x, i = op.start ?? 0;
    for (let k = 0; k < n && pos < until && k < 3000; k++, i++) {
      const u = unit[mod(i, unit.length)];
      const w = op.vertical ? px * 1.02 : cw(u.ch, px, heavy);
      if (op.after == null || pos >= op.after) {
        const ov = op.each ? { ...op, ...op.each(k, u, pos) } : op;
        if (op.vertical) S.put(c, u, x - cw(u.ch, px, heavy) / 2, pos + px * 0.88, ov);
        else S.put(c, u, pos, y + (ov.dy ?? 0), ov);
      }
      if (!(w > 0) && !op.vertical) break;
      pos += w;
    }
    c.globalAlpha = ga;
    return pos;
  };
  // 横 1 段を left〜right に敷き詰める。offset が増えると右へ流れる
  S.tile = (c, y, px, offset, op = {}) => {
    const left = op.left ?? 0, uw = S.UW(px, op.heavy);
    if (!(uw > 0) || !Number.isFinite(offset)) return;
    S.run(c, left + mod(offset, uw) - uw, y, px, { ...op, until: op.right ?? W });
  };
  // 縦 1 列を top〜bottom に敷き詰める。offset が増えると下へ流れる
  S.vtile = (c, x, px, offset, op = {}) => {
    const top = op.top ?? 0, uh = unit.length * px * 1.02;
    if (!(uh > 0) || !Number.isFinite(offset)) return;
    S.run(c, x, top + mod(offset, uh) - uh, px, { ...op, vertical: true, until: op.bottom ?? H });
  };
  // 折れ線に沿って文字を並べる（文字は線の向きに回す）。closed なら一周を埋める
  S.path = (c, pts, closed, px, offset, op = {}) => {
    const segs = [];
    let L = 0;
    const m = closed ? pts.length : pts.length - 1;
    for (let i = 0; i < m; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (!Number.isFinite(l)) return;
      segs.push({ a, b, l, s: L });
      L += l;
    }
    if (!(L > 0) || !(px > 0.5) || !Number.isFinite(offset)) return;
    const heavy = !!op.heavy;
    c.font = fontOf(px, heavy);
    c.lineWidth = op.lw ?? Math.max(0.8, px * 0.04);
    const uw = S.UW(px, heavy);
    if (!(uw > 0)) return;
    let s = closed ? mod(offset, uw) - uw : offset;
    let si = 0;
    for (let i = 0; s < L && i < 4000; i++) {
      const u = unit[mod(i, unit.length)];
      const w = cw(u.ch, px, heavy);
      const mid = closed ? mod(s + w / 2, L) : s + w / 2;
      if (mid >= 0 && mid <= L) {
        if (closed || segs[si].s > mid) si = 0;
        while (si < segs.length - 1 && segs[si].s + segs[si].l < mid) si++;
        const g = segs[si], f = g.l > 0 ? (mid - g.s) / g.l : 0;
        c.save();
        c.translate(g.a[0] + (g.b[0] - g.a[0]) * f, g.a[1] + (g.b[1] - g.a[1]) * f);
        c.rotate(Math.atan2(g.b[1] - g.a[1], g.b[0] - g.a[0]) + (op.rot ?? 0));
        S.put(c, u, -w / 2, px * 0.36, op);
        c.restore();
      }
      s += Math.max(w, px * 0.2);
    }
    c.globalAlpha = ga;
  };
  // 強調語をひとかたまりで置く（x は真ん中、y はベースライン）
  S.word = (c, x, y, px, op = {}) => {
    if (!(px > 0.5) || !emph) return 0;
    const heavy = op.heavy ?? true;
    c.font = fontOf(px, heavy);
    const w = cw(emph, px, heavy);
    c.globalAlpha = Math.min(1, (op.alpha ?? 1) * (op.raw ? 1 : ga));
    c.lineJoin = 'round';
    if ((op.mode ?? 'fill') === 'stroke') { c.lineWidth = op.lw ?? Math.max(1, px * 0.02); c.strokeStyle = op.color ?? pal.accent; c.strokeText(emph, x - w / 2, y); }
    else { c.fillStyle = op.color ?? pal.accent; c.fillText(emph, x - w / 2, y); }
    c.globalAlpha = ga;
    return w;
  };
  // 本体の行の写し（水面・残像）。本体の行そのものは描く係が描く
  S.drawMain = (c, op = {}) => {
    c.save();
    c.lineJoin = 'round';
    c.textBaseline = 'alphabetic';
    for (const g of glyphs) {
      const a = (op.alpha ?? 1) * ga;
      if (!(a > 0.003) || !g.ch.trim()) continue;
      c.globalAlpha = Math.min(1, a);
      c.font = g.font;
      const x = g.x + (op.dx ?? 0), y = g.y + (op.dy ?? 0), col = op.color ?? pal.fg;
      if (op.mode === 'stroke') { c.lineWidth = op.lw ?? Math.max(1, g.px * 0.03); c.strokeStyle = col; c.strokeText(g.ch, x, y); }
      else { c.fillStyle = col; c.fillText(g.ch, x, y); }
    }
    c.restore();
  };
  return S;
}

/**
 * 模様を描く。which：'draw'（行の後ろ）・'front'（行の手前。無い模様は何もしない）。
 * 座標は行の板の局所座標（行の真ん中が原点）で、o.W×o.H の四角に切り抜く。o.glyphs も行の真ん中が原点の座標で渡す。
 * @returns {{gap:number, cy:number}} gap は本体の行を上下に割って開くすき間（split のある模様だけ。無ければ 0）、cy は割る高さ（行の真ん中が原点）
 */
export function drawFlood(ctx, def, o, which = 'draw') {
  const fn = def?.[which];
  if (!def || !(o?.W > 0) || !(o?.H > 0) || !(fin(o.ga) > 0.003)) return { gap: 0, cy: 0 };
  const W = o.W, H = o.H;
  const glyphs = (o.glyphs ?? []).map(g => ({ ...g, x: g.x + W / 2, y: g.y + H / 2 }));
  const S = floodTools(ctx, { ...o, glyphs });
  const gap = def.split ? Math.max(0, fin(def.split(S))) : 0;
  if (typeof fn === 'function') {
    ctx.save();
    ctx.translate(-W / 2, -H / 2);
    ctx.beginPath();
    ctx.rect(0, 0, W, H);
    ctx.clip();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.lineJoin = 'round';
    ctx.lineCap = 'butt';
    ctx.globalAlpha = S.ga;
    fn(ctx, S);
    ctx.restore();
  }
  return { gap, cy: (S.m.L.top + S.m.L.bottom) / 2 - H / 2 };
}
