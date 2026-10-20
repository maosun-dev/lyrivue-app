// 盛り上がり（拍ごとの音の大きさ）と波形の点を作る

/** 拍ごとの音の大きさ（0〜1）。拍から次の拍までの RMS を、全体の最大で割る
 * @param {Float32Array} mono @param {number} sampleRate @param {number[]} beats @returns {number[]} */
export function beatEnergy(mono, sampleRate, beats) {
  const raw = beats.map((t, i) => {
    const a = Math.max(0, Math.min(mono.length, Math.floor(t * sampleRate)));
    const b = i + 1 < beats.length ? Math.floor(beats[i + 1] * sampleRate) : mono.length; // 最後の拍は曲の終わりまで
    const e = Math.max(a, Math.min(mono.length, b));
    if (e <= a) return 0;
    let s = 0; for (let k = a; k < e; k++) s += mono[k] * mono[k];
    return Math.sqrt(s / (e - a));
  });
  const max = Math.max(0, ...raw);
  return max > 0 ? raw.map(v => v / max) : raw.map(() => 0);
}

/** 波形の点（0〜1）。区間ごとの最大の絶対値を、全体の最大で割る
 * @param {Float32Array} mono @param {number} sampleRate @param {number} perSecond @returns {number[]} */
export function waveform(mono, sampleRate, perSecond = 30) {
  const bucket = sampleRate / perSecond;
  const n = Math.ceil(mono.length / bucket - 1e-9);
  const raw = [];
  for (let i = 0; i < n; i++) {
    const a = Math.floor(i * bucket), b = Math.min(mono.length, Math.floor((i + 1) * bucket));
    let m = 0; for (let k = a; k < b; k++) { const v = Math.abs(mono[k]); if (v > m) m = v; }
    raw.push(m);
  }
  const max = Math.max(0, ...raw);
  return max > 0 ? raw.map(v => v / max) : raw;
}
