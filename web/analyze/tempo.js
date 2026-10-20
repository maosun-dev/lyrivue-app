// 速さ（BPM）と最初の拍の解析。TJA採譜台（tja-saifu.html）の getBands / analyzeTempo / findFirstBeat から移した。
// 変更点：AudioBuffer ではなく (mono, sampleRate) を受ける／キャッシュと window の調整値は外して定数にした／
// 速さの「ありがちな中心」を太鼓向けの150から一般の歌向けの120に変えた。

const COVK = 0;        // 16分の目盛りに乗る音の割合を重く見る度合い（0＝使わない）
const TRIP_TH = 1.35;  // 3連符の位置の強さの比がこれを超えたら、速さを1.5倍に直す
const PRIOR_CENTER = 120;

// 音の立ち上がり（全体・低音・高音）と音量を 5ms ごとに計算する（16 分の譜面 analyze/notes.js も使う）
export function getBands(mono, sampleRate) {
  const sr = sampleRate, hop = Math.round(sr / 200), FPS = sr / hop;
  const n = Math.floor(mono.length / hop);
  const eAll = new Float32Array(n), eLow = new Float32Array(n), eHigh = new Float32Array(n), rms = new Float32Array(n), pL = new Float32Array(n), pH = new Float32Array(n);
  let lp = 0, lpH = 0; const alpha = 1 - Math.exp(-2 * Math.PI * 180 / sr), aH = 1 - Math.exp(-2 * Math.PI * 1800 / sr);
  for (let i = 0; i < n; i++) {
    let sa = 0, sl = 0, sh = 0;
    for (let j = i * hop, z = j + hop; j < z; j++) {
      const v = mono[j];
      lp += alpha * (v - lp); lpH += aH * (v - lpH);
      const h = v - lpH;
      sa += v * v; sl += lp * lp; sh += h * h;
    }
    eAll[i] = Math.log(1 + 1000 * sa / hop); eLow[i] = Math.log(1 + 4000 * sl / hop); eHigh[i] = Math.log(1 + 8000 * sh / hop); rms[i] = Math.sqrt(sa / hop); pL[i] = sl / hop; pH[i] = sh / hop;
  }
  const env = new Float32Array(n), low = new Float32Array(n), high = new Float32Array(n);
  for (let i = 1; i < n; i++) {
    low[i] = Math.max(0, pL[i] - pL[i - 1]); high[i] = Math.max(0, pH[i] - pH[i - 1]);
    env[i] = Math.max(0, eAll[i] - eAll[i - 1]) + 1.2 * Math.max(0, eLow[i] - eLow[i - 1]);
  }
  const W = 40, cs = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) cs[i + 1] = cs[i] + env[i];
  const envRaw = env.slice();
  for (let i = 0; i < n; i++) { const a = Math.max(0, i - W), z = Math.min(n, i + W); env[i] = Math.max(0, envRaw[i] - (cs[z] - cs[a]) / (z - a)); }
  // 低音・高音の立ち上がりを、それぞれの大きい方から数えて1%の値で割ってそろえる
  const norm = a => { const t = Array.from(a).filter(v => v > 0).sort((x, y) => x - y); const q = t[Math.floor(t.length * 0.99)] || 1; for (let i = 0; i < a.length; i++) a[i] /= q; };
  norm(low); norm(high);
  // 大きい立ち上がりの直後（40ms以内）の小さい山は、同じ音の尾ひれなので消す
  {
    const W2 = Math.round(0.04 * FPS), e2 = env.slice();
    const W3 = Math.round(0.09 * FPS);
    for (let i = 0; i < n; i++) {
      let mx = 0; for (let j = Math.max(0, i - W2); j <= Math.min(n - 1, i + W2); j++) if (j !== i && e2[j] > mx) mx = e2[j];
      let mb = 0; for (let j = Math.max(0, i - W3); j < i; j++) if (e2[j] > mb) mb = e2[j];   // 90ms以内の前にずっと大きい山がある
      if (e2[i] < 0.6 * mx || e2[i] < 0.25 * mb) env[i] = 0;
    }
  }
  return { env, low, high, rms, FPS };
}

function findFirstBeat(env, FPS, bpm) {
  const P = 60 * FPS / bpm, n = env.length;
  let bestPh = 0, bs = -1;
  for (let ph = 0; ph < P; ph += 0.5) {
    let sum = 0; for (let x = ph; x < n - 1; x += P) { const i = Math.round(x); sum += env[i] + 0.5 * (env[i - 1] || 0) + 0.5 * env[i + 1]; }
    if (sum > bs) { bs = sum; bestPh = ph; }
  }
  // 最初に音がはっきり出るあたりの拍を1小節目の頭にする
  let mx = 0; for (let i = 0; i < n; i++) if (env[i] > mx) mx = env[i];
  let firstOn = 0; for (let i = 0; i < n; i++) if (env[i] > mx * 0.25) { firstOn = i; break; }
  let x = bestPh; while (x + P < firstOn + P * 0.3) x += P;
  return Math.max(0, x / FPS - 0.005);
}

/**
 * 速さと拍を読む。
 * @param {Float32Array} mono 1チャンネルにまとめた音
 * @param {number} sampleRate
 * @returns {{bpm:number, firstBeat:number, beats:number[]}} beats は firstBeat から曲の終わりまで 60/bpm 秒ごと
 */
export function analyzeTempo(mono, sampleRate) {
  const bands = getBands(mono, sampleRate), env = bands.env, FPS = bands.FPS, n = env.length;
  // 自己相関
  const minL = Math.floor(60 * FPS / 290), maxL = Math.ceil(60 * FPS / 55);
  const ac = new Float64Array(maxL * 4 + 2);
  for (let L = minL; L < ac.length; L++) { let sum = 0; for (let i = 0; i + L < n; i++) sum += env[i] * env[i + L]; ac[L] = sum / (n - L); }
  const acAt = x => { const i = Math.floor(x), f = x - i; return i + 1 < ac.length ? ac[i] * (1 - f) + ac[i + 1] * f : 0; };
  const score = bpm => { const L = 60 * FPS / bpm; return acAt(L) + 0.5 * acAt(2 * L) + 0.25 * acAt(4 * L) + 0.3 * acAt(L / 2 >= minL ? L / 2 : L); };
  // 拍の位置で曲全体を折りたたんだときの、1拍あたりの音の立ち上がりの強さ（拍がそろうテンポほど大きい）
  const combMean = bpm => {
    const P = 60 * FPS / bpm, B = Math.ceil(P), h = new Float64Array(B);
    for (let i = 0; i < n; i++) h[Math.floor(i % P)] += env[i];
    let top = 0; for (let k = 0; k < B; k++) { const v = h[k] + 0.5 * h[(k + B - 1) % B] + 0.5 * h[(k + 1) % B]; if (v > top) top = v; }
    return top / (n / P);
  };
  const prior = bpm => Math.exp(-0.5 * Math.pow(Math.log2(bpm / PRIOR_CENTER) / 0.6, 2));   // 一般の歌によくある速さ（120前後）を少し優先
  // 大まかな候補：自己相関の山の上位6つと、その2倍・半分。1つに決めてしまうと近くの間違った山にはまるので、全部を細かく調べる
  const sc = []; for (let bpm = 60; bpm <= 280; bpm += 0.5) sc.push([bpm, score(bpm)]);
  const peaks = sc.filter((x, i) => i > 0 && i < sc.length - 1 && x[1] >= sc[i - 1][1] && x[1] >= sc[i + 1][1]).sort((a, b) => b[1] - a[1]).slice(0, 6).map(x => x[0]);
  const mults = COVK > 0 ? [1, 2, 0.5, 1.5, 2 / 3] : [1, 2, 0.5];
  const cand = new Set(); for (const p of peaks) for (const m of mults) { const v = p * m; if (v >= 70 && v <= 280) cand.add(Math.round(v * 2) / 2); }
  // 3分の2・2分の3の取り違えを見分ける：はっきりした音の立ち上がりのうち、そのテンポの16分の目盛りに乗る割合
  let onsetPk = null;
  const coverage = bpm => {
    if (!onsetPk) {
      let m = 0; for (let i = 0; i < n; i++) m += env[i]; m /= n || 1; onsetPk = [];
      const W = Math.round(0.03 * FPS); for (let i = W; i < n - W; i++) { if (env[i] < 4 * m) continue; let top = true; for (let j = i - W; j <= i + W; j++) if (env[j] > env[i]) { top = false; break; } if (top) onsetPk.push(i); }
    }
    if (onsetPk.length < 20) return 1;
    const P = 60 * FPS / bpm / 4, tol = 0.02 * FPS; let bestC = 0;
    for (let ph = 0; ph < P; ph += 0.5) { let c = 0; for (const i of onsetPk) { const d = (i - ph) % P, e = Math.min(d, P - d); if (e <= tol) c++; } if (c > bestC) bestC = c; }
    return bestC / onsetPk.length;
  };
  // 細かい調整：拍に加えて8分・16分の位置もそろうテンポを選ぶ
  let best = 120, bv = -1;
  for (const c0 of cand) {
    let b0 = c0, v0 = -1;
    for (let bpm = c0 - 1.5; bpm <= c0 + 1.5001; bpm += 0.05) {
      const v = (combMean(bpm) + 0.5 * combMean(2 * bpm) + 0.25 * combMean(4 * bpm)) * prior(bpm);
      if (v > v0) { v0 = v; b0 = bpm; }
    }
    const v = COVK > 0 ? v0 * Math.pow(coverage(b0), COVK) : v0;
    if (v > bv) { bv = v; best = b0; }
  }
  // 3分の2の読み間違いを見分ける：拍の3分の1・3分の2（3連符の位置）と2分の1（8分の位置）の強さを比べる
  const tripRatio = bpm => {
    const P = 60 * FPS / bpm, B = Math.max(6, Math.round(P)), h = new Float64Array(B);
    for (let i = 0; i < n; i++) h[Math.floor((i % P) / P * B) % B] += env[i];
    let k0 = 0; for (let k = 1; k < B; k++) if (h[k] > h[k0]) k0 = k;
    const at = f => { const x = k0 + f * B, i = Math.round(x); let m = 0; for (let d = -1; d <= 1; d++) m = Math.max(m, h[((i + d) % B + B) % B]); return m; };
    return (at(1 / 3) + at(2 / 3)) / 2 / Math.max(1e-9, at(1 / 2));
  };
  const trip = tripRatio(best);
  if (trip > TRIP_TH && best * 1.5 >= 170 && best * 1.5 <= 280) {   // 3連符の位置の方が強い速い曲 → 本当のテンポは1.5倍。前後6%で合わせ直す
    let b2 = best * 1.5, v2 = -1;
    for (let bpm = best * 1.5 * 0.94; bpm <= best * 1.5 * 1.06; bpm += 0.05) { const v = combMean(bpm) + 0.5 * combMean(2 * bpm) + 0.25 * combMean(4 * bpm); if (v > v2) { v2 = v; b2 = bpm; } }
    best = b2;
  }
  const r = Math.round(best);
  if (Math.abs(best - r) < 0.35) best = r; else best = Math.round(best * 100) / 100;
  const firstBeat = findFirstBeat(env, FPS, best);
  const duration = mono.length / sampleRate, step = 60 / best, beats = [];
  for (let t = firstBeat; t < duration; t += step) beats.push(t);
  if (beats.length === 0) beats.push(firstBeat);
  return { bpm: best, firstBeat, beats };
}
