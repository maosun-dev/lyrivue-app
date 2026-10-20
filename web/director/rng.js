// 種を渡すと毎回同じ列を返す乱数（mulberry32）。台本を再現できるようにするために使う。

/** @param {number} seed 数でない値は 0、小数・負は整数にして使う */
export function makeRng(seed) {
  const n = Number(seed);
  let a = (Number.isFinite(n) ? Math.trunc(n) : 0) >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 配列から1つ選ぶ。空なら undefined */
export function pick(rng, list) {
  if (!Array.isArray(list) || list.length === 0) return undefined;
  return list[Math.min(list.length - 1, Math.floor(rng() * list.length))];
}
