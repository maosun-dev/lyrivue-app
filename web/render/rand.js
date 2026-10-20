// 整数の組から決まる擬似乱数。部品が記憶を持たずに「粒の位置」などを出すために使う。

/** 同じ組なら同じ値。0 以上 1 未満。小数は切り捨てて使う */
export function hash01(...ints) {
  let h = 2166136261;
  for (const n of ints) h = Math.imul(h ^ (Number.isFinite(n) ? Math.trunc(n) | 0 : 0), 16777619);
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
