// 区切りの盛り上がり（動きの強さ）を 0〜1 で出す。

/** start 以上 end 未満にある拍の energy の平均。拍が無ければ 0.5 */
export function sectionIntensity(analysis, start, end) {
  const beats = analysis?.beats;
  const energy = analysis?.energy;
  if (!Array.isArray(beats) || !Array.isArray(energy)) return 0.5;
  let sum = 0;
  let n = 0;
  for (let i = 0; i < beats.length && i < energy.length; i++) {
    if (beats[i] >= start && beats[i] < end && Number.isFinite(energy[i])) { sum += energy[i]; n++; }
  }
  if (n === 0) return 0.5;
  return Math.min(1, Math.max(0, sum / n));
}

/**
 * 場面ごとの強さを、曲の中で最小を 0・最大を 1 に引き伸ばす（差を見せるため）。
 * 空は空、全部同じ（差が 1e-6 未満）・1つだけなら 0.5。
 */
export function stretch(values) {
  if (!Array.isArray(values) || values.length === 0) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (!(max - min >= 1e-6)) return values.map(() => 0.5);
  return values.map(v => (v - min) / (max - min));
}
