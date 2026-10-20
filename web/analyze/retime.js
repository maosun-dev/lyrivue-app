// タップで合わせた時刻で、解析結果の行の時刻を付け直す。
// 曲を流しながら、各行の歌い出しで「いま！」をたたいた結果（taps）を受け取る。元の結果は書き換えない。
import { buildSections } from './sections.js';

const GAP = 0.1;      // 次の行の歌い出しより、これだけ前で終える（秒）
const PER_CHAR = 0.4; // たたいた行の長さの上限：文字数 × これ + TAIL（間奏まで伸ばさない）
const TAIL = 1.5;
const MIN_STEP = 0.05; // 前の行より、少なくともこれだけ後ろ

/**
 * @param {import('./types.js').AnalysisResult} result
 * @param {{line:number, time:number}[]} taps 行の番号とたたいた時刻（秒）。同じ行はあとのほうを使う
 * @returns {import('./types.js').AnalysisResult} 付け直した結果（taps が使えなければ同じ中身の写し）
 */
export function retimeLines(result, taps) {
  if (!result || !Array.isArray(result.lines)) return result ?? null;
  const lines = result.lines;
  const n = lines.length;
  const dur = Number.isFinite(result.duration) && result.duration > 0 ? result.duration : Infinity;
  const clamp = v => Math.min(Math.max(v, 0), dur);
  const old = lines.map(l => (Number.isFinite(l.start) ? l.start : 0));

  /** @type {Map<number, number>} 行 → たたいた時刻 */
  const tapped = new Map();
  for (const t of Array.isArray(taps) ? taps : []) {
    if (!Number.isInteger(t?.line) || t.line < 0 || t.line >= n || !Number.isFinite(t.time)) continue;
    tapped.set(t.line, clamp(t.time));
  }
  if (tapped.size === 0) return { ...result, lines: lines.map(l => ({ ...l })) };

  // 歌い出し：たたいた行はその時刻。間の行は前の間隔の比で割り振り、後ろの行は最後のずれの分だけずらす
  const keys = [...tapped.keys()].sort((a, b) => a - b);
  const start = old.slice();
  for (const k of keys) start[k] = tapped.get(k);
  for (let j = 0; j + 1 < keys.length; j++) {
    const a = keys[j], b = keys[j + 1];
    const span = old[b] - old[a];
    for (let i = a + 1; i < b; i++) {
      const r = span > 0 ? (old[i] - old[a]) / span : (i - a) / (b - a);
      start[i] = start[a] + (start[b] - start[a]) * Math.min(Math.max(r, 0), 1);
    }
  }
  const last = keys[keys.length - 1];
  const shift = start[last] - old[last];
  for (let i = last + 1; i < n; i++) start[i] = old[i] + shift;
  // たたいた行より前の行は、たたいた行を越えないように（越えた分だけ前へ詰める）
  for (let i = keys[0] - 1; i >= 0; i--) start[i] = Math.min(start[i], start[i + 1] - MIN_STEP);
  // 前の行より早くならないようにそろえ、曲の長さに収める
  for (let i = 0; i < n; i++) {
    start[i] = clamp(i > 0 ? Math.max(start[i], start[i - 1] + MIN_STEP) : start[i]);
  }

  const out = lines.map((l, i) => {
    const next = i + 1 < n ? start[i + 1] - GAP : dur;
    const len = tapped.has(i)
      ? [...String(l.text ?? '')].length * PER_CHAR + TAIL
      : Math.max(0, (Number.isFinite(l.end) ? l.end : old[i]) - old[i]);
    const end = Math.max(start[i], Math.min(start[i] + len, next, dur));
    const fix = tapped.has(i) ? { confidence: 1, needsCheck: false } : {};
    return { ...l, start: round(start[i]), end: round(end), ...fix };
  });
  let sections = result.sections;
  try { sections = buildSections(out, result.duration); } catch { /* 作れなければ前のまま */ }
  return { ...result, lines: out, sections };
}

// 小数の誤差（10.9 が 10.899999 になる等）を消す
const round = v => Math.round(v * 1e6) / 1e6;
