// 台本係：場面展開の予定（2026-10-20 持ち主「場面展開がないから PV っぽくないのかな？」）。
// 1 カット長回しをやめ、区切りごとに カット（別の場所・別の向きへ一瞬で）・場面の種類・配色・寄りと引き を変える。
// 区切り：強い一打（director/rhythm.js の hit）で切る。ただし前の区切りから 2 小節はあけ、4 小節のうちに一打が無ければ 4 小節で切る。
// 同じ入力なら同じ予定。

export const SCENE_KINDS = ['space', 'tunnel', 'corridor', 'flat']; // 宇宙・光の輪のトンネル・模様の壁の通路・平面の模様だけ
export const TONES = ['dark', 'color', 'light'];                    // 黒地 → 色地 → 白地
const MIN_BARS = 2, MAX_BARS = 4;

function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

/**
 * @param {{duration:number, bar:number, hits?:number[], seed?:number}} o  bar＝1 小節の秒数、hits＝強い一打の時刻
 * @returns {{from:number, to:number, kind:string, tone:string, frame:'wide'|'close', seed:number}[]}
 */
export function scenePlan({ duration, bar, hits = [], seed = 11 }) {
  const end = Number.isFinite(duration) && duration > 0 ? duration : 0;
  const b = Number.isFinite(bar) && bar > 0 ? bar : 2;
  const hs = hits.filter(Number.isFinite).sort((x, y) => x - y);
  const cuts = [0];
  for (let t = 0; ;) {
    const lo = t + b * MIN_BARS - 1e-6, hi = t + b * MAX_BARS + 1e-6;
    const h = hs.find(x => x >= lo);
    const next = h !== undefined && h <= hi ? h : t + b * MAX_BARS;
    if (next >= end - b + 1e-6) break; // 残りが 1 小節より短ければ、今の場面につなげる
    cuts.push(next); t = next;
  }
  const r = rng(seed);
  let kind = SCENE_KINDS[0];
  return cuts.map((from, i) => {
    if (i > 0) { const others = SCENE_KINDS.filter(k => k !== kind); kind = others[Math.floor(r() * others.length)]; }
    return { from, to: cuts[i + 1] ?? end, kind, tone: TONES[i % TONES.length], frame: i % 2 ? 'close' : 'wide', seed: Math.floor(r() * 1e6) };
  });
}

/** 時刻 t の場面（index）と、その場面に入ってからの秒数 el */
export function sceneAt(plan, t) {
  let i = 0;
  while (i + 1 < plan.length && plan[i + 1].from <= t) i++;
  return { index: i, scene: plan[i], el: t - (plan[i]?.from ?? 0) };
}
