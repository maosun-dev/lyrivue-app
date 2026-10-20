// 持ち主の選び直し（2026-10-19。方針「主役は歌詞・線画の空間」で、文字の演出 88 種と歌詞で埋める組み 52 種を
// 「いつも使う・派手な所だけ・いらない」に分けた）。台本係が自動で選ぶときの重みに掛ける。
// ・いらない（NO）：自動では選ばない（部品は残す。消す一覧・手直しの名前としては今までどおり通じる）
// ・派手な所だけ（LOUD）：強い場面（強さ STRONG_FROM 以上）だけで選ぶ
// ・好き（FAVOR）：重みを倍に（持ち主「これすごい好き」「すき」）
// 名前は「種類:名前」（同じ名前が種類違いである：look:mirror はいつも、hit:mirror はいらない）
export const STRONG_FROM = 0.45; // effects.js の強い場面と同じ
export const FX_NO = new Set([
  'hold:shiver', 'hold:squash', 'exit:stretchup', 'exit:drip',
  'look:stripes', 'look:chroma3', 'look:stencil', 'look:sticker', // シールは明るい曲の書体の縁で別に考える（持ち主）
  'kime:shake', 'hit:blink', 'hit:mirror', 'hit:slicetext', 'hit:zoomblur',
]);
export const FX_LOUD = new Set(['hold:heartbeat', 'exit:glitchout', 'kime:split']);
export const FX_FAVOR = new Map([['look:box', 2], ['look:underline', 2]]);
export const FLOOD_NO = new Set([
  'tile:wave', 'giant:slices', 'band:thickband', 'band:vertical', 'ring:orbit',
  'depth:floor', 'depth:floorceil', 'depth:stepsback', 'depth:cylinder', 'mirror:quad', 'frame:underline',
]);
export const FLOOD_LOUD = new Set([
  'tile:diag', 'tile:zigzag', 'tile:twolayer', 'giant:hugeoutline', 'giant:stuffed', 'giant:spinchar',
  'ring:ripple', 'mirror:water', 'mirror:lr', 'frame:roundframe', 'frame:lattice',
]);

/** 選びの倍率：0（選ばない）か、1、好きなら 2。key は「種類:名前」、i は場面の強さ */
export function pickFactor(key, i, no = FX_NO, loud = FX_LOUD, favor = FX_FAVOR) {
  if (no.has(key)) return 0;
  if (loud.has(key) && !(i >= STRONG_FROM)) return 0;
  return favor.get(key) ?? 1;
}
