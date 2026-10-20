// 貼った歌詞の各行に、聞き取り（Whisper の言葉と時刻）から始まりと終わりの時刻を付ける。
// 順番が前後しない1文字ずつの対応（動的計画法）で、歌詞と聞き取りの文字を並べて合わせる。
// くり返しの行（サビなど）も、前から順に割り当てられるので前後に飛ばない。

const SCORE_MATCH = 2;     // 同じ文字
const SCORE_MISMATCH = -1; // 違う文字どうしを対応させる
const SCORE_SKIP = -1;     // どちらかの文字を飛ばす
const DEFAULT_SEC_PER_CHAR = 0.18; // 一致が2文字未満の行で使う1文字あたりの秒数
const MIN_SEC_PER_CHAR = 0.05;     // 傾きがおかしいときに使わない範囲（下限）
const MAX_SEC_PER_CHAR = 0.6;      // 同（上限）
const UNMATCHED_SEC_PER_CHAR = 0.35; // 合わなかった行の長さの上限（1文字あたり）
const NEEDS_CHECK_BELOW = 0.5;
// 一致が半分に満たなくても、この割合以上で、前後の確かな行の間に収まるなら時刻を使う（要確認のまま）
const WEAK_MATCH_AT_LEAST = 0.3;
// 言葉の長さの上限 = その曲で聞き取った言葉の長さの中央値 × 2。
// Whisper 本家の「長すぎる語は息つぎ・間を含んでいるので縮める」後処理と同じ考え方
const LONG_WORD_RATIO = 2;
const MIN_LINE_GAPS_FOR_PACE = 3; // 歌詞の進む速さを決めるのに要る、となり合って合った行の組の数

// 表のたどり方の印
const FROM_DIAG = 0;
const FROM_UP = 1;   // 歌詞の文字を飛ばした
const FROM_LEFT = 2; // 聞き取りの文字を飛ばした

/**
 * 歌詞の行に時刻を付ける。例外は投げない。
 * @param {import('./types.js').LyricLine[]} lines
 * @param {import('./types.js').AsrWord[]} words
 * @param {(s:string)=>string} toKana ひらがな・英小文字・数字だけにする関数
 * @returns {import('./types.js').TimedLine[]}
 */
export function alignLyrics(lines, words, toKana) {
  lines = Array.isArray(lines) ? lines : [];
  words = Array.isArray(words) ? words : [];
  if (lines.length === 0) return [];

  const safeKana = s => { try { return String(toKana(String(s ?? '')) ?? ''); } catch { return ''; } };

  // 歌詞側の文字列 A：各文字に「何行目か」と「行の中で何文字目か」を持たせる
  const lineKana = lines.map(l => [...safeKana(l?.text)]);
  const aChars = [];
  const aLine = [];
  const aPos = [];
  lineKana.forEach((chars, li) => chars.forEach((c, p) => { aChars.push(c); aLine.push(li); aPos.push(p); }));

  // 聞き取り側の文字列 B：各文字に時刻。言葉の中は均等割り。言葉の頭の文字には、その言葉の長さも持たせる
  const bChars = [];
  const bTimeList = [];
  const bWordHead = []; // 言葉の頭の文字なら {start, end}、そうでなければ null
  const durations = [];
  for (const w of words) {
    const s = Number(w?.start), e = Number(w?.end);
    if (!Number.isFinite(s)) continue;
    const end = Number.isFinite(e) && e > s ? e : s;
    const chars = [...safeKana(w?.text)];
    if (chars.length) durations.push(end - s);
    chars.forEach((c, j) => {
      bChars.push(c);
      bTimeList.push(s + (end - s) * j / chars.length);
      bWordHead.push(j === 0 ? { start: s, end } : null);
    });
  }
  const maxWordSec = LONG_WORD_RATIO * (median(durations) ?? 0);

  // 行ごとの一致した文字（行内の位置と時刻と、聞き取り側の何文字目か）
  const matchPos = lines.map(() => []);
  const matchTime = lines.map(() => []);
  const matchB = lines.map(() => []);
  for (const [ai, bi] of alignChars(aChars, bChars)) {
    matchPos[aLine[ai]].push(aPos[ai]);
    matchTime[aLine[ai]].push(bTimeList[bi]);
    matchB[aLine[ai]].push(bi);
  }

  // 一致があった行の時刻を決める
  const out = lines.map((line, li) => {
    const n = lineKana[li].length;
    const cap = n * UNMATCHED_SEC_PER_CHAR; // 1行の長さの上限
    // 時刻が飛び離れた一致（偶然の一致）は捨て、上限の長さに収まるいちばん濃いかたまりだけ使う
    const [from, to] = densestCluster(matchTime[li], cap);
    const pos = matchPos[li].slice(from, to);
    const time = matchTime[li].slice(from, to);
    const k = pos.length;
    const confidence = n > 0 ? k / n : 0;
    const base = { ...line, start: NaN, end: NaN, confidence, needsCheck: confidence < NEEDS_CHECK_BELOW };
    // 一致が2文字未満、または少なすぎる行は、合わない行と同じに前後の行のすき間へ置く
    if (k < 2 || confidence < WEAK_MATCH_AT_LEAST) return base;
    const spc = secPerChar(pos, time);
    // 行の最初に一致した文字の時刻。それが長すぎる言葉の頭なら、前の息つぎ・間奏まで言葉に
    // 含まれているので、言葉の終わりから上限の長さだけ前を頭とみなす
    let first = time[0];
    const head = bWordHead[matchB[li][from]];
    if (head && maxWordSec > 0 && head.end - head.start > maxWordSec) first = head.end - maxWordSec;
    // 一致しなかった行頭の文字ぶんは、ふつうの速さ（既定の1文字あたりの秒数）でさかのぼる。
    // 行全体の傾きは、行末で伸ばす音に引っぱられて大きくなりがちなので使わない
    base.start = Math.max(0, first - pos[0] * DEFAULT_SEC_PER_CHAR);
    // 行の頭を優先し、長さは上限で止める
    base.end = Math.min(Math.max(base.start, time[k - 1] + spc), base.start + cap);
    return base;
  });

  // 一致が少ない行は、前後の確かな行の間に収まるときだけ時刻を使い、収まらなければ合わない行として置く
  const sure = li => Number.isFinite(out[li].start) && !out[li].needsCheck;
  for (let li = 0; li < out.length; li++) {
    if (!Number.isFinite(out[li].start) || sure(li)) continue;
    let p = li - 1; while (p >= 0 && !sure(p)) p--;
    let q = li + 1; while (q < out.length && !sure(q)) q++;
    const lo = p >= 0 ? out[p].start : -Infinity;
    const hi = q < out.length ? out[q].start : Infinity;
    if (!(out[li].start > lo && out[li].start < hi)) { out[li].start = NaN; out[li].end = NaN; }
  }

  // ここで時刻が無い行は、一致から時刻を決められなかった（1文字の行・一致が1文字だけの行・
  // 前後の行の間に収まらなかった行など）。次の placeUnmatched が推測で置くので、
  // 一致の割合に関係なく「要確認」・自信 0 にする（推測の位置に自信 1.0 で置かないため）。
  // 時刻の決め方には使わない印なので、ここで付け替えても時刻は変わらない
  const guessed = out.map(l => !Number.isFinite(l.start));
  placeUnmatched(out, lineKana);
  guessed.forEach((g, i) => { if (g) { out[i].needsCheck = true; out[i].confidence = 0; } });

  // 仕上げ：start が前の行より小さければそろえて、増えていく形にする
  for (let i = 1; i < out.length; i++) {
    if (out[i].start < out[i - 1].start) out[i].start = out[i - 1].start;
  }
  // end は start 以上、かつ次の行の start に食い込まない
  for (let i = 0; i < out.length; i++) {
    if (i + 1 < out.length && out[i].end > out[i + 1].start) out[i].end = out[i + 1].start;
    if (!(out[i].end >= out[i].start)) out[i].end = out[i].start;
  }
  return out;
}

/**
 * 時刻の並び（増えていく順）から、幅 span 以内に収まる一致がいちばん多い区間 [from, to) を返す。
 * 同じ数なら前のほう（行の頭に近いほう）を選ぶ。
 * @param {number[]} time
 * @param {number} span
 * @returns {[number, number]}
 */
function densestCluster(time, span) {
  let bestFrom = 0, bestTo = 0;
  let from = 0;
  for (let to = 0; to < time.length; to++) {
    while (time[to] - time[from] > span) from++;
    if (to + 1 - from > bestTo - bestFrom) { bestFrom = from; bestTo = to + 1; }
  }
  return [bestFrom, bestTo];
}

/**
 * 2つの文字列を順番を崩さずに並べ、一致した組 [Aの位置, Bの位置] を前から順に返す。
 * 表は型付き配列で持つ（約1000×1000でも数MB）。
 * @param {string[]} a
 * @param {string[]} b
 * @returns {Array<[number, number]>}
 */
function alignChars(a, b) {
  const n = a.length, m = b.length;
  if (n === 0 || m === 0) return [];
  const W = m + 1;
  const dir = new Uint8Array((n + 1) * W);
  let prev = new Int32Array(W);
  let cur = new Int32Array(W);
  for (let j = 0; j <= m; j++) { prev[j] = j * SCORE_SKIP; dir[j] = FROM_LEFT; }
  for (let i = 1; i <= n; i++) {
    cur[0] = i * SCORE_SKIP;
    dir[i * W] = FROM_UP;
    const ai = a[i - 1];
    for (let j = 1; j <= m; j++) {
      // 同点のときは 対角 → 歌詞を飛ばす → 聞き取りを飛ばす の順で選ぶ
      let best = prev[j - 1] + (ai === b[j - 1] ? SCORE_MATCH : SCORE_MISMATCH);
      let d = FROM_DIAG;
      const up = prev[j] + SCORE_SKIP;
      if (up > best) { best = up; d = FROM_UP; }
      const left = cur[j - 1] + SCORE_SKIP;
      if (left > best) { best = left; d = FROM_LEFT; }
      cur[j] = best;
      dir[i * W + j] = d;
    }
    const t = prev; prev = cur; cur = t;
  }
  // 右下からたどる
  const pairs = [];
  let i = n, j = m;
  while (i > 0 && j > 0) {
    const d = dir[i * W + j];
    if (d === FROM_DIAG) {
      if (a[i - 1] === b[j - 1]) pairs.push([i - 1, j - 1]);
      i--; j--;
    } else if (d === FROM_UP) i--;
    else j--;
  }
  return pairs.reverse();
}

/**
 * 一致した文字の「行内の位置」と「時刻」の傾き（最小二乗）を1文字あたりの秒数にする。
 * 一致が2文字未満、または傾きがおかしい（負・極端）なら既定値。
 */
function secPerChar(pos, time) {
  const k = pos.length;
  if (k < 2) return DEFAULT_SEC_PER_CHAR;
  let mp = 0, mt = 0;
  for (let i = 0; i < k; i++) { mp += pos[i]; mt += time[i]; }
  mp /= k; mt /= k;
  let num = 0, den = 0;
  for (let i = 0; i < k; i++) { num += (pos[i] - mp) * (time[i] - mt); den += (pos[i] - mp) ** 2; }
  const s = den > 0 ? num / den : NaN;
  if (!Number.isFinite(s) || s < MIN_SEC_PER_CHAR || s > MAX_SEC_PER_CHAR) return DEFAULT_SEC_PER_CHAR;
  return s;
}

/** 中央値（空なら null） */
function median(values) {
  if (!values.length) return null;
  const v = [...values].sort((x, y) => x - y);
  return v[v.length >> 1];
}

/**
 * 一致が無かった行（start が NaN）を、前後の一致した行のすき間に置く。
 * 歌詞の進む速さ（となり合って合った行の、頭どうしの間隔の中央値）がわかれば、
 * 前の行の頭からその間隔ずつ並べる（ただし前の行の end より前には置かない）。
 * わからなければ、各行「文字数 × 0.35 秒」（最低1文字分）を前の行の end から順に詰めて並べる。
 * どちらも行の長さは「文字数 × 0.35 秒」まで。すき間に入りきらなければ全体を縮めて収める。
 * 前に一致した行が無い（曲の頭）ときは、次の行の start で終わるように後ろ詰めにする。
 */
function placeUnmatched(out, lineKana) {
  const cap = li => Math.max(1, lineKana[li].length) * UNMATCHED_SEC_PER_CHAR;
  const gaps = [];
  for (let k = 1; k < out.length; k++) {
    const a = out[k - 1].start, b = out[k].start;
    if (Number.isFinite(a) && Number.isFinite(b) && b > a) gaps.push(b - a);
  }
  const pace = gaps.length >= MIN_LINE_GAPS_FOR_PACE ? median(gaps) : null;
  let i = 0;
  while (i < out.length) {
    if (Number.isFinite(out[i].start)) { i++; continue; }
    let j = i;
    while (j < out.length && !Number.isFinite(out[j].start)) j++;
    // i..j-1 が合わない行のかたまり。1行ぶんの枠（次の行の頭までの間隔）
    const slots = [];
    for (let k = i; k < j; k++) slots.push(pace ?? cap(k));
    const total = slots.reduce((x, y) => x + y, 0);
    let prevEnd = i > 0 ? out[i - 1].end : null;
    if (pace !== null && i > 0) prevEnd = Math.max(prevEnd, out[i - 1].start + pace);
    const nextStart = j < out.length ? out[j].start : null;
    let from, scale = 1;
    if (prevEnd !== null && nextStart !== null) {
      // 前の行の end が次の行の start を越えていても、次の行より後ろには置かない
      from = Math.min(prevEnd, nextStart);
      // 速さで進めた位置が次の行を越えるなら、前の行の end から詰める
      if (pace !== null && from >= nextStart) from = Math.min(out[i - 1].end, nextStart);
      const gap = Math.max(0, nextStart - from);
      if (total > gap) scale = total > 0 ? gap / total : 0;
    } else if (prevEnd !== null) {
      from = prevEnd;
    } else if (nextStart !== null) {
      if (total > nextStart) scale = total > 0 ? Math.max(0, nextStart) / total : 0;
      from = Math.max(0, nextStart - total * scale);
    } else {
      from = 0; // 一致がひとつも無い
    }
    let t = from;
    for (let k = i; k < j; k++) {
      const slot = slots[k - i] * scale;
      out[k].start = t;
      out[k].end = t + Math.min(slot, cap(k));
      t += slot;
    }
    i = j;
  }
}
