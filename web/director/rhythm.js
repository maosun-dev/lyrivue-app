// 台本係：16 分の譜面（analyze/notes.js の slots）から、カメラの速さの予定を作る。
// 拾うのは 16 分、刻むのは最大 8 分（2026-10-20 持ち主「16 分で拾って、8 分までで刻む」。16 分で刻むと 1 秒に 8 回を超えて震えて見える）。
// 刻み（step）ごとに：
//   rest＝静か（キメ・休み）→ ほぼ止まる／drift＝音符がまばら → ゆっくり漂う／dash＝刻みの頭に音符 → 短くダッシュ／
//   rush＝16 分が続く所 → 刻まずに、その間ずっと超高速で突き進む／hit＝まわりより際立って強い一打 → 大きく加速して場面を切り替える（1 小節に 1 回まで）
// 同じ入力なら同じ予定。speedAt は時刻だけで決まる（前のコマを覚えない）。

export const STEP_MIN = 0.2;  // 刻む間隔の下限（秒）。8 分がこれより短い速い曲は 1 拍で刻む
const RUN_MIN = 6;            // 16 分の音符がこれ以上つながったら「突き進む」
const LEVEL = { rest: 0.05, drift: 0.6, dash: 0.75, hit: 0.9, rush: 2.6 }; // 刻みの間の速さ（ふだんの速さの倍率）
const EASE = 0.12;            // 刻みが変わるとき、速さを移す秒数
const DASH = { amp: 1.4, attack: 0.04, decay: 0.16 };  // ダッシュの山（強さ s を掛ける）
const HIT = { amp: 2.4, attack: 0.06, decay: 0.4 };    // 強い一打の山
const BLUR_FROM = 1.8, BLUR_SPAN = 1.6;                // 速さの倍率がこれを超えた分を、ぶれ・赤青のずれの強さ（0〜1）にする（突き進む間は 0.5 ほど。続くと濁るので強くしない）

/**
 * @param {{t:number, s:number, note:boolean, quiet:boolean, acc?:boolean}[]} slots 拍ごとに 4 つ
 * @param {number} bpm
 * @returns {{step:number, steps:{t:number, kind:'rest'|'drift'|'dash'|'rush'|'hit', s:number}[]}}
 */
export function rhythmPlan(slots, bpm) {
  const list = Array.isArray(slots) ? slots.filter(x => x && Number.isFinite(x.t)) : [];
  const beat = 60 / (Number.isFinite(bpm) && bpm > 0 ? bpm : 120);
  const per = beat / 2 >= STEP_MIN ? 2 : 4; // 1 刻みに入る 16 分の数
  const step = Math.round(beat / (4 / per) * 1e4) / 1e4;
  // 16 分の音符のつながりの長さ（その目盛りを含むつながり）
  const run = new Array(list.length).fill(0);
  for (let i = 0; i < list.length;) {
    let j = i; while (j < list.length && list[j].note) j++;
    for (let k = i; k < j; k++) run[k] = j - i;
    i = Math.max(j, i + 1);
  }
  const steps = [];
  let lastHit = -Infinity;
  for (let i = 0; i + per <= list.length; i += per) {
    const g = list.slice(i, i + per), head = g[0];
    let kind = 'drift';
    if (g.every(x => x.quiet)) kind = 'rest';
    else if (g.every((x, k) => x.note && run[i + k] >= RUN_MIN)) kind = 'rush';
    else if (head.note && head.acc && i % 4 === 0 && head.t - lastHit >= beat * 4 - 1e-6) { kind = 'hit'; lastHit = head.t; }
    else if (head.note) kind = 'dash';
    steps.push({ t: head.t, kind, s: head.s });
  }
  return { step, steps };
}

const pulse = (dt, p) => (dt < 0 ? 0 : dt < p.attack ? dt / p.attack : Math.exp(-(dt - p.attack) / p.decay));
const smooth = x => { const u = Math.min(1, Math.max(0, x)); return u * u * (3 - 2 * u); };

/** 時刻 t のカメラの速さ（ふだんの速さの倍率 mult）と、ぶれ・赤青のずれの強さ env（0〜1） */
export function speedAt(plan, t) {
  const steps = plan?.steps ?? [];
  if (!steps.length || !Number.isFinite(t)) return { mult: LEVEL.drift, env: 0 };
  // t を含む刻み（二分探し）
  let lo = 0, hi = steps.length - 1;
  if (t < steps[0].t) return { mult: LEVEL.drift, env: 0 };
  while (lo < hi) { const m = (lo + hi + 1) >> 1; if (steps[m].t <= t) lo = m; else hi = m - 1; }
  const cur = steps[lo], prev = steps[lo - 1];
  const a = prev ? LEVEL[prev.kind] : LEVEL.drift, b = LEVEL[cur.kind];
  let mult = a + (b - a) * smooth((t - cur.t) / EASE);
  // 山：ダッシュ・強い一打（少し前の刻みのぶんも足す）
  let hitPulse = 0;
  for (let k = lo; k >= 0 && t - steps[k].t < 2; k--) {
    const x = steps[k];
    if (x.kind === 'dash') mult += DASH.amp * x.s * pulse(t - x.t, DASH);
    else if (x.kind === 'hit') { const p = pulse(t - x.t, HIT); mult += HIT.amp * p; hitPulse = Math.max(hitPulse, p); }
  }
  const env = Math.min(1, Math.max(hitPulse, (mult - BLUR_FROM) / BLUR_SPAN, 0));
  return { mult, env };
}
