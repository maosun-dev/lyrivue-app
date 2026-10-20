// 台本係：行を世界のどこに置くか・強調する語・打ち込みの秒数・カメラのキーを決める。
// 世界座標の単位は「画面の短辺 = 1」。x は右、y は下、z は奥が +（render/camera.js と同じ）。

import { DEFAULT_TUNING } from '../shared/tuning.js';

export const VIEW_DIST = 1.2;  // 1行を見るときのカメラと行の距離（render/camera.js の VIEW_DIST と同じ値）
// 次の定数は、調整値（shared/tuning.js）の初期値。実際には呼び出しで渡された調整値を使う
export const Z_STEP = DEFAULT_TUNING.zStep;
export const TRAVEL = DEFAULT_TUNING.travel;
export const DRIFT = DEFAULT_TUNING.drift;
export const KEEP_LINES = DEFAULT_TUNING.keepLines;
export const SPIN = DEFAULT_TUNING.spin;
export const SETTLE = DEFAULT_TUNING.settle;

const MAX_EMPHASIS = 4;        // 強調する語の最大の長さ（文字）
const KANJI_KATA = /[一-鿿゠-ヿ]+/g;
const LATIN_WORD = /^[A-Za-z0-9'’]+$/;
const MAX_LATIN_EMPHASIS = 14; // 英単語は丸ごと強調する（4 文字で切ると「clou」になる）

/**
 * count 行ぶんの置き場所。i 行目は、乱数を 6つ（x, y, 向きの種類, 向きの細かい値, 大きさ, ゆがみ）固定の順で使う。
 * 行数が変わっても、前の行の配置は変わらない。
 * size は行ごとの大きさの倍率（0.8〜1.5）、skew は斜体のゆがみ（±0.2。0 の行が多い）。
 * @returns {{pos:[number,number,number], roll:number, size:number, skew:number}[]}
 */
export function placeLines(count, rng, tuning) {
  const z = tuning?.zStep ?? Z_STEP;
  const spread = tuning?.spread ?? DEFAULT_TUNING.spread;
  const out = [];
  for (let i = 0; i < count; i++) {
    const r1 = rng();
    const r2 = rng();
    const kind = rng();
    const fine = rng();
    const sizeR = rng();
    const skewR = rng();
    let roll;
    if (kind < 0.15) roll = 0;
    else if (kind < 0.8) roll = (fine - 0.5) * 0.7;                   // 小さな傾き
    else if (kind < 0.93) roll = (fine < 0.5 ? -1 : 1) * Math.PI / 2; // 縦
    else roll = Math.PI;                                             // 逆さ
    out.push({ pos: [(r1 - 0.5) * 1.0 * spread, (r2 - 0.5) * 0.6 * spread, -(i * z) + 0], roll, size: 0.8 + 0.7 * sizeR, skew: skewR < 0.6 ? 0 : (skewR - 0.8) });
  }
  return out;
}

/**
 * 行の中で強調する語の [開始位置, 長さ]（BMP の文字を1文字と数える）。無ければ null。
 * words（長い順）の中で行に含まれる最初の語、無ければ漢字・カタカナの最長の連なり（同じ長さなら先）。
 * 長さは最大 4 文字。
 */
export function emphasisSpan(text, words) {
  if (typeof text !== 'string' || text === '') return null;
  const list = (Array.isArray(words) ? words : []).filter(w => typeof w === 'string' && w !== '').sort((a, b) => b.length - a.length);
  for (const w of list) {
    if (LATIN_WORD.test(w)) {
      // 英単語：大文字小文字を問わず、単語まるごと当たるところだけ（「sky」を「Skyline」には当てない）。長さは切らない
      const esc = w.replace(/['’]/g, "['’]"); // 英単語の文字だけなので、記号は ' と ’ のどちらでも当てる
      const m = new RegExp(`(?<![A-Za-z0-9'’])${esc}(?![A-Za-z0-9'’])`, 'i').exec(text);
      if (m) return [m.index, Math.min(w.length, MAX_LATIN_EMPHASIS)];
      continue;
    }
    const i = text.indexOf(w);
    if (i >= 0) return [i, Math.min(w.length, MAX_EMPHASIS)];
  }
  let best = null;
  for (const m of text.matchAll(KANJI_KATA)) {
    if (best === null || m[0].length > best[1]) best = [m.index, m[0].length];
  }
  if (best) return [best[0], Math.min(best[1], MAX_EMPHASIS)];
  // 英語の行：いちばん長い単語（5 文字以上。同じ長さなら先）
  for (const m of text.matchAll(/[A-Za-z]{5,}/g)) {
    if (best === null || m[0].length > best[1]) best = [m.index, m[0].length];
  }
  return best ? [best[0], Math.min(best[1], MAX_LATIN_EMPHASIS)] : null;
}

/** 1行を打ち込むのにかける秒数。行の長さの 75%、ただし 0.3 秒〜（文字数 × 0.12 秒）。数でなければ 0.3 */
export function typeSeconds(start, end, charCount) {
  const dur = end - start;
  if (!Number.isFinite(dur) || !Number.isFinite(charCount)) return 0.3;
  return Math.min(Math.max(dur * 0.75, 0.3), Math.max(0.3, 0.12 * charCount));
}

const poseOf = p => ({ pos: [p.pos[0], p.pos[1], p.pos[2] - VIEW_DIST], roll: p.roll * 0.6, zoom: 1 });

/**
 * 曲全体で1本のカメラの動き。最初のキーは、最初の行から 1 だけ引いた所（t=0）。
 * 行ごとに「到着キー」（行の start に、行を見る姿勢へ。急に動いてゆっくり止まる outExpo。
 * 到着では SPIN だけ余分に回っていて、向きは行ごとに交互）を置き、
 * 着いてから SETTLE 秒で回転が元に戻る「落ち着きのキー」（次の待機キーまでに余裕があるときだけ）を置く。
 * 2行目以降は到着キーの手前に「待機キー」（前の行の姿勢から少し寄った所。着くのを TRAVEL 秒前から始める）を置く。
 * キーの t は必ず増える順。
 * @param {{pos:number[], roll:number}[]} placements
 * @param {{start:number}[]} lines
 */
export function cameraKeys(placements, lines, tuning) {
  const travel = tuning?.travel ?? TRAVEL;
  const drift = tuning?.drift ?? DRIFT;
  const spinAmount = tuning?.spin ?? SPIN;
  const settle = tuning?.settle ?? SETTLE;
  const n = Math.min(placements.length, lines.length);
  if (n === 0) return [];
  // 到着の時刻（行の start。前の到着より 0.05 秒は後ろにする）
  const arrives = [];
  let prev = 0;
  for (let i = 0; i < n; i++) {
    const start = Number.isFinite(lines[i].start) ? lines[i].start : 0;
    prev = Math.max(start, prev + 0.05);
    arrives.push(prev);
  }
  const first = poseOf(placements[0]);
  const keys = [{ t: 0, pos: [first.pos[0], first.pos[1], first.pos[2] - 1], roll: 0, zoom: 1, ease: 'linear' }];
  let lastT = 0;
  for (let i = 0; i < n; i++) {
    if (i >= 1) {
      const p = poseOf(placements[i - 1]);
      const holdT = arrives[i] - travel;
      if (holdT > lastT) { keys.push({ t: holdT, pos: [p.pos[0], p.pos[1], p.pos[2] + drift], roll: p.roll, zoom: 1, ease: 'linear' }); lastT = holdT; }
    }
    const pose = poseOf(placements[i]);
    // 行の間隔が travel+settle より短いときは、回転を間隔に比例して小さくする（往復し続けて目が回らないように）
    const gap = i === 0 ? Infinity : arrives[i] - arrives[i - 1];
    const spin = (i % 2 === 0 ? -1 : 1) * spinAmount * Math.min(1, gap / (travel + settle));
    keys.push({ t: arrives[i], pos: pose.pos, roll: pose.roll + spin, zoom: 1, ease: 'outExpo' });
    lastT = arrives[i];
    const settleT = arrives[i] + settle;
    const nextHold = i + 1 < n ? arrives[i + 1] - travel : Infinity;
    if (settleT < nextHold) { keys.push({ t: settleT, pos: pose.pos, roll: pose.roll, zoom: 1, ease: 'outCubic' }); lastT = settleT; }
  }
  return keys;
}
