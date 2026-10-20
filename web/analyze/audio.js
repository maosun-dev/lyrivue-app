// 音の取り回し（サンプルレートの変換）

/**
 * サンプルレートを from から to に変える（直線でつなぐだけの簡易版。Whisper に渡す 16kHz への間引き用）
 * @param {Float32Array} x @param {number} from @param {number} to @returns {Float32Array}
 */
export function resample(x, from, to) {
  if (!x || x.length === 0) return new Float32Array(0);
  if (from === to || !(from > 0) || !(to > 0)) return Float32Array.from(x);
  const n = Math.max(1, Math.round(x.length * to / from));
  const out = new Float32Array(n);
  const ratio = from / to;
  for (let i = 0; i < n; i++) {
    const p = i * ratio, k = Math.floor(p), f = p - k;
    const a = x[Math.min(k, x.length - 1)], b = x[Math.min(k + 1, x.length - 1)];
    out[i] = a + (b - a) * f;
  }
  return out;
}
