// 文字を載せる器（render/parts/vessels/）を本編の行に使う：1 行を 2〜3 カットに割り、カットごとに器を入れ替えて描く。
// 描く係 text-motion が、器を使う行（layer.vessels）では行の文字の代わりにここを呼ぶ。座標は行の板の局所座標（行の真ん中が原点）。
import { VESSEL_BY_ID, vesselTools, drawVessel } from './vessels/index.js';

export const VESSEL_MIN_CUT = 1.5; // これより短いカットは隣とまとめる（秒。2026-10-19 0.6 → 1.5：短いと器が出きる前に替わって読めなかった）
// 器の出てくる動き（めくれる・落ちてくる・点が灯るなど。見本では 1.2 秒ほどかけて出る）を、本編では早回しにする：
// はじめの INTRO_REAL 秒で器の INTRO_REAL×INTRO_SPEED 秒ぶん進め、そのあとはふつうの速さ
const INTRO_REAL = 0.3, INTRO_SPEED = 4;
/** 本編の時刻（カットの頭からの秒）→ 器に渡す時刻 */
export const vesselTime = t => (!(t > 0) ? 0 : t < INTRO_REAL ? t * INTRO_SPEED : INTRO_REAL * INTRO_SPEED + (t - INTRO_REAL));
// 器が画面に占める割合：カメラが着いたとき FRAC_ARRIVE、寄るとゆっくり大きく（寄った倍率の FRAC_GROW 乗）、FRAC_MAX で止まる
const FRAC_ARRIVE = 0.8, FRAC_GROW = 0.35, FRAC_MAX = 0.95;
/** sNow：いまの板の映る倍率、sArr：カメラが着いたときの倍率 */
export function vesselFrac(sNow, sArr) {
  if (!(sNow > 0) || !(sArr > 0)) return FRAC_ARRIVE;
  return Math.min(FRAC_MAX, FRAC_ARRIVE * Math.pow(sNow / sArr, FRAC_GROW));
}
const LONG_LINE = 8;               // 強調語の無い行は、この文字数から 2 カットに割る
const fin = (v, d = 0) => (Number.isFinite(v) ? v : d);

/**
 * 1 行をカットに割る。強調語のある行は 前・強調語・後ろ、無い行は短ければ 1 つ・長ければ空白か真ん中で 2 つ。
 * カットの始まりは、そのカットの最初の文字を歌うおよその時刻（歌い出しから。singSec 秒で N 文字を等しく歌うとみなす。
 * 打ち込みの秒数は歌うより速いので使わない）。
 * 短すぎるカットは次とまとめ、最後のカット（endSec まで）が短ければ前とまとめる。
 * @param {string[]} chars 行の文字
 * @param {number[]|undefined} emph [始まり, 長さ]
 * @param {number} singSec 行を歌う秒数
 * @param {number} endSec 器が消え始める時刻（歌い出しから）
 * @returns {{from:number,to:number,text:string,emph:number[],last:boolean}[]} emph はカットの文字の中で数え直した [始まり, 長さ]（無ければ [0, 0]）
 */
export function vesselCuts(chars, emph, singSec, endSec) {
  const N = Array.isArray(chars) ? chars.length : 0;
  if (!N) return [];
  const ts = Math.max(0, fin(singSec)), end = Math.max(0, fin(endSec));
  let es = Math.trunc(fin(emph?.[0], -1)), el = Math.trunc(fin(emph?.[1]));
  if (!(es >= 0 && es < N && el > 0)) { es = -1; el = 0; } else el = Math.min(el, N - es);
  let cuts;
  if (el > 0) cuts = [[0, es], [es, es + el], [es + el, N]];
  else if (N >= LONG_LINE) {
    // 真ん中に近い空白（3〜7 割の間）で割る。無ければ真ん中
    let p = Math.round(N / 2), best = Infinity;
    chars.forEach((ch, i) => { if (!ch.trim() && i >= N * 0.3 && i <= N * 0.7 && Math.abs(i - N / 2) < best) { best = Math.abs(i - N / 2); p = i; } });
    cuts = [[0, p], [p, N]];
  } else cuts = [[0, N]];
  const blank = ([a, b]) => !chars.slice(a, b).join('').trim();
  // 空白だけ・空のカットは次（無ければ前）にまとめる
  cuts = cuts.filter(([a, b]) => b > a);
  for (let k = 0; k < cuts.length && cuts.length > 1;) {
    if (!blank(cuts[k])) { k++; continue; }
    if (k + 1 < cuts.length) cuts[k + 1] = [cuts[k][0], cuts[k + 1][1]]; else cuts[k - 1] = [cuts[k - 1][0], cuts[k][1]];
    cuts.splice(k, 1);
  }
  const fromOf = k => (k === 0 ? 0 : cuts[k][0] / N * ts);
  for (let k = 0; k + 1 < cuts.length;) {
    if (fromOf(k + 1) - fromOf(k) >= VESSEL_MIN_CUT) { k++; continue; }
    cuts[k] = [cuts[k][0], cuts[k + 1][1]];
    cuts.splice(k + 1, 1);
  }
  // 最後のカットは、器が出ている長さに加えて、歌っている長さも VESSEL_MIN_CUT の半分は要る（1 文字だけ残って器が替わるのを防ぐ）
  while (cuts.length > 1 && (end - fromOf(cuts.length - 1) < VESSEL_MIN_CUT || ts - fromOf(cuts.length - 1) < VESSEL_MIN_CUT / 2)) {
    const n = cuts.length;
    cuts[n - 2] = [cuts[n - 2][0], cuts[n - 1][1]];
    cuts.pop();
  }
  const froms = cuts.map((_, k) => fromOf(k));
  return cuts.map(([a, b], k) => {
    const raw = chars.slice(a, b), lead = raw.length - raw.join('').trimStart().length;
    const text = raw.join('').trim();
    const s = Math.max(es, a), e = Math.min(es + el, b);
    const ce = e > s ? [Math.max(0, s - a - lead), Math.min(e - s, Array.from(text).length)] : [0, 0];
    const from = froms[k];
    return { from, to: k + 1 < cuts.length ? froms[k + 1] : Math.max(from, end), text, emph: ce, last: k === cuts.length - 1 };
  });
}

/** 行の器の名前のうち、本編で使えるものだけ */
export const validVessels = ids => (Array.isArray(ids) ? ids.filter(id => VESSEL_BY_ID[id]) : []);

// 器は自分で濃さ（globalAlpha）を決めて上書きするので、板の濃さ k を掛け算で効かせる包み
function alphaScaled(ctx, k) {
  const bound = new Map();
  return new Proxy(ctx, {
    get(t, n) {
      if (n === 'globalAlpha') { const a = t.globalAlpha; return typeof a === 'number' ? a / k : 1; }
      const v = t[n];
      if (typeof v !== 'function') return v;
      let f = bound.get(n);
      if (!f) { f = v.bind(t); bound.set(n, f); }
      return f;
    },
    set(t, n, v) { t[n] = n === 'globalAlpha' ? v * k : v; return true; },
  });
}

/**
 * 今のカットの器を描く。o：{ ids（使える器の名前）, cuts（vesselCuts の結果）, u（歌い出しからの秒）, W, H（器を描く四角。板の局所座標）,
 *   pal:{bg,fg,accent,band,light}, face:{family,light,heavy}, beatLen, ga（板の濃さ） }
 * @returns {boolean} 描いたら true
 */
export function drawLineVessel(ctx, o) {
  const cuts = o.cuts ?? [];
  if (!o.ids?.length || !cuts.length || !(o.W > 0) || !(o.H > 0) || !(fin(o.ga) > 0.003) || !(o.u >= 0)) return false;
  let k = 0;
  while (k + 1 < cuts.length && o.u >= cuts[k + 1].from) k++;
  const cut = cuts[k];
  const def = VESSEL_BY_ID[o.ids[k % o.ids.length]];
  if (!def || !cut.text) return false;
  const OUT = cut.last ? vesselTime(cut.to - cut.from) : 1e9;
  const c = o.ga < 0.999 ? alphaScaled(ctx, o.ga) : ctx;
  ctx.save();
  ctx.translate(-o.W / 2, -o.H / 2);
  c.globalAlpha = 1;
  const S = vesselTools(ctx, { W: o.W, H: o.H, T: vesselTime(o.u - cut.from), LOOP: OUT + 1, OUT, beat: o.beatLen, pal: o.pal, face: o.face, text: cut.text, emph: cut.emph });
  drawVessel(c, def, S);
  ctx.restore();
  return true;
}
