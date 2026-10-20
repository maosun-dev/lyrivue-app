// 時刻から「いまの拍」「いまの盛り上がり」を引く道具と、動きの緩急。

export const clamp01 = x => (Number.isFinite(x) ? Math.min(1, Math.max(0, x)) : 0);

/**
 * t を含む拍の番号と、その拍の中での位置（0〜1）。
 * 最初の拍より前・拍が空・t が数でないときは { index: -1, phase: 0 }。
 * 最後の拍より後ろは、直前の拍の間隔で進め、1 で止める。
 */
export function beatAt(beats, t) {
  if (!Array.isArray(beats) || beats.length === 0 || !Number.isFinite(t) || t < beats[0]) return { index: -1, phase: 0 };
  let lo = 0;
  let hi = beats.length - 1;
  while (lo < hi) { // beats[i] <= t を満たす最後の i を探す
    const mid = (lo + hi + 1) >> 1;
    if (beats[mid] <= t) lo = mid; else hi = mid - 1;
  }
  const last = beats.length - 1;
  const len = lo < last ? beats[lo + 1] - beats[lo] : (lo > 0 ? beats[lo] - beats[lo - 1] : 0);
  return { index: lo, phase: len > 0 ? clamp01((t - beats[lo]) / len) : 1 };
}

/** t の拍の盛り上がり（0〜1）。拍の外・データなしは 0.5 */
export function energyAt(analysis, t) {
  const { index } = beatAt(analysis?.beats, t);
  const e = index >= 0 ? analysis?.energy?.[index] : undefined;
  return Number.isFinite(e) ? e : 0.5;
}

/** 行き過ぎて戻る動き（x は 0〜1 に収める） */
export function easeOutBack(x) {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  const v = clamp01(x) - 1;
  return 1 + c3 * v * v * v + c1 * v * v;
}

export function easeOutCubic(x) {
  const v = 1 - clamp01(x);
  return 1 - v * v * v;
}
