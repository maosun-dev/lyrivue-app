// AI（Whisper）が使えないときの代わりの合わせ方。
// 盛り上がっている範囲に、行を文字数の比で並べて拍に寄せる。全行「要確認」にする。

const LOUD_RATIO = 0.3; // 最大の何倍を超えたら「歌っているあたり」とみなすか

/**
 * @param {import('./types.js').LyricLine[]} lines
 * @param {number[]} beats 拍の時刻（秒）
 * @param {number[]} energy 拍ごとの盛り上がり（beats と同じ長さ）
 * @param {number} [duration] 曲の長さ（秒）。範囲が決まらないとき全体に広げる
 * @returns {import('./types.js').TimedLine[]}
 */
export function fallbackAlign(lines, beats, energy, duration) {
  lines = Array.isArray(lines) ? lines : [];
  if (lines.length === 0) return [];
  beats = Array.isArray(beats) ? beats : [];
  energy = Array.isArray(energy) ? energy : [];
  const lastBeat = beats.length ? beats[beats.length - 1] : 0;
  const total = Number.isFinite(duration) && duration > 0 ? duration : lastBeat;

  // 歌っているあたり（最初〜最後の盛り上がった拍）を決める
  let from = 0, to = total;
  const max = Math.max(0, ...energy);
  if (beats.length > 0 && max > 0) {
    let first = -1, last = -1;
    for (let i = 0; i < beats.length; i++) {
      if ((energy[i] ?? 0) > max * LOUD_RATIO) { if (first < 0) first = i; last = i; }
    }
    if (first >= 0) {
      from = beats[first];
      const period = beats.length > 1 ? beats[1] - beats[0] : 0;
      to = last + 1 < beats.length ? beats[last + 1] : beats[last] + period;
      if (total > 0) to = Math.min(to, total);
    }
  }
  if (!(to > from)) { from = 0; to = Math.max(total, 0); }

  // 文字数の比で境目を置き、いちばん近い拍に寄せる（範囲の両端は動かさない）
  const weights = lines.map(l => Math.max(1, [...String(l?.text ?? '')].length));
  const sum = weights.reduce((a, b) => a + b, 0);
  const bounds = [from];
  let acc = 0;
  for (let i = 0; i < lines.length - 1; i++) {
    acc += weights[i];
    let t = from + (to - from) * acc / sum;
    let bestD = Infinity, snapped = t;
    for (const b of beats) {
      if (b <= from || b >= to) continue;
      const d = Math.abs(b - t);
      if (d < bestD) { bestD = d; snapped = b; }
    }
    bounds.push(Math.max(bounds[bounds.length - 1], snapped));
  }
  bounds.push(Math.max(bounds[bounds.length - 1], to));

  return lines.map((l, i) => ({
    ...l, start: bounds[i], end: Math.max(bounds[i], bounds[i + 1]), confidence: 0, needsCheck: true,
  }));
}
