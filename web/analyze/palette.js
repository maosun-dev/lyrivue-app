// 写真（RGBA の画素）から、目立つ色・明るさ・暖かさを調べる

// 近い色をまとめる距離（RGB 0〜255 のユークリッド距離がこれ未満なら同じ色とみなす）
const MERGE_DISTANCE = 48;

const hex2 = (v) => Math.round(v).toString(16).padStart(2, '0');

/**
 * @param {Uint8ClampedArray} rgba
 * @param {number} [n] 返す色の数
 * @returns {{colors:string[], brightness:number, warmth:number}}
 */
export function extractPalette(rgba, n = 5) {
  // 4bit ずつに丸めた色ごとに、数と合計を持つ
  const bins = new Map();
  let total = 0, sumR = 0, sumG = 0, sumB = 0, sumLuma = 0;
  for (let i = 0; i + 3 < (rgba?.length ?? 0); i += 4) {
    if (rgba[i + 3] < 128) continue; // ほぼ透明は数えない
    const r = rgba[i], g = rgba[i + 1], b = rgba[i + 2];
    total++; sumR += r; sumG += g; sumB += b;
    sumLuma += (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    const bin = bins.get(key);
    if (bin) { bin.n++; bin.r += r; bin.g += g; bin.b += b; }
    else bins.set(key, { n: 1, r, g, b });
  }
  if (total === 0) return { colors: [], brightness: 0, warmth: 0 };

  // 多い順に見て、すでにある色に近ければそこへ足す（平均は数で重みづけ）
  const sorted = [...bins.values()].sort((a, b) => b.n - a.n);
  /** @type {{n:number, r:number, g:number, b:number}[]} */
  const groups = [];
  for (const bin of sorted) {
    const mr = bin.r / bin.n, mg = bin.g / bin.n, mb = bin.b / bin.n;
    const near = groups.find((g) => Math.hypot(g.r / g.n - mr, g.g / g.n - mg, g.b / g.n - mb) < MERGE_DISTANCE);
    if (near) { near.n += bin.n; near.r += bin.r; near.g += bin.g; near.b += bin.b; }
    else groups.push({ ...bin });
  }
  groups.sort((a, b) => b.n - a.n);

  const colors = groups.slice(0, n).map((g) => '#' + hex2(g.r / g.n) + hex2(g.g / g.n) + hex2(g.b / g.n));
  const warmth = Math.max(-1, Math.min(1, (sumR - sumB) / total / 255));
  return { colors, brightness: Math.max(0, Math.min(1, sumLuma / total)), warmth };
}
