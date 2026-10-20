// 16 分の譜面：曲を拍の 4 分の 1（16 分）ごとに区切り、そこで音が鳴り始めているか（音符）と強さを決める。
// TJA採譜台で音符を置いたときと同じ考え方（音の立ち上がりを 16 分の目盛りで拾う）。AI は使わない。
// 2026-10-20 持ち主「音符の出方きめたときみたいな？」「16 分で拾って、8 分までで刻む」→ カメラの速さの予定（director/rhythm.js）に使う
import { getBands } from './tempo.js';

const WIN = 0.025;      // 目盛りの前後これだけ（秒）の中で、いちばん強い立ち上がりをその目盛りの強さにする
const NOTE_MIN = 0.4;   // 強さがこれ以上で（0.2 だと細かいハイハットまで拾い、16 分の 7 割が音符になって緩急が出なかった。Beyond the clouds で 0.4 に）
const NOTE_REL = 0.5;   // まわり（前後 2 拍）の音符らしい所の平均のこれ以上なら音符
const ACC_REL = 1.4;    // まわりの音符の平均のこれ以上なら、際立って強い一打（acc）
const QUIET_REL = 0.15; // まわりの音量が曲全体の真ん中のこれ未満なら「静か」（採譜台の「曲の音がない拍」と同じ 15%）

/**
 * @param {Float32Array} mono 1 チャンネルにまとめた音
 * @param {number} sampleRate
 * @param {number[]} beats 拍の時刻（秒）
 * @returns {{slots:{t:number, s:number, note:boolean, quiet:boolean, acc:boolean}[]}} 拍ごとに 4 つ（16 分）。s は 0〜1 の強さ、acc は際立って強い一打
 */
export function noteGrid(mono, sampleRate, beats) {
  const bs = (Array.isArray(beats) ? beats : []).filter(Number.isFinite);
  if (!(mono?.length > 0) || !(sampleRate > 0) || !bs.length) return { slots: [] };
  const { env, rms, FPS } = getBands(mono, sampleRate);
  const n = env.length;
  const step = bs.length >= 2 ? (bs.at(-1) - bs[0]) / (bs.length - 1) : 0.5;
  const times = [];
  bs.forEach((b, i) => { const len = (bs[i + 1] ?? b + step) - b; for (let k = 0; k < 4; k++) times.push({ t: b + (len * k) / 4, len: len / 4, beat: len }); });
  const frame = t => Math.min(n - 1, Math.max(0, Math.round(t * FPS)));
  const W = Math.max(1, Math.round(WIN * FPS));
  const raw = times.map(({ t }) => { const c = frame(t); let m = 0; for (let j = c - W; j <= c + W; j++) if (j >= 0 && j < n && env[j] > m) m = env[j]; return m; });
  // 強さをそろえる：0 でない目盛りの、大きい方から 5% の値を 1 にする
  const pos = raw.filter(v => v > 0).sort((a, b) => a - b);
  const top = pos[Math.floor(pos.length * 0.95)] || 1;
  const s = raw.map(v => Math.min(1, v / top));
  // 静か：目盛りの 1 拍前から目盛りの半分あとまでの音量の平均が、曲全体の真ん中の 15% 未満
  const cs = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) cs[i + 1] = cs[i] + rms[i];
  const loud = times.map(({ t, len, beat }) => { const a = frame(t - beat), z = Math.max(a + 1, frame(t + len / 2)); return (cs[z] - cs[a]) / (z - a); });
  const mid = [...loud].sort((a, b) => a - b)[Math.floor(loud.length / 2)] || 0;
  const slots = times.map(({ t }, i) => {
    // まわり（前後 2 拍＝8 目盛り）の、音符らしい所（NOTE_MIN 以上）の平均
    let sum = 0, cnt = 0;
    for (let j = Math.max(0, i - 8); j <= Math.min(s.length - 1, i + 8); j++) if (s[j] >= NOTE_MIN) { sum += s[j]; cnt++; }
    const quiet = loud[i] < mid * QUIET_REL;
    const note = !quiet && s[i] >= NOTE_MIN && s[i] >= NOTE_REL * (cnt ? sum / cnt : 0);
    // 際立って強い一打：まわり（前後 2 小節）の音符らしい所の平均の ACC_REL 倍以上（そろえる前の強さで比べる）
    let rs = 0, rc = 0;
    for (let j = Math.max(0, i - 32); j <= Math.min(raw.length - 1, i + 32); j++) if (j !== i && s[j] >= NOTE_MIN) { rs += raw[j]; rc++; }
    const acc = note && rc > 0 && raw[i] >= ACC_REL * (rs / rc);
    return { t: Math.round(t * 1e4) / 1e4, s: Math.round(s[i] * 1000) / 1000, note, quiet, acc };
  });
  return { slots };
}
