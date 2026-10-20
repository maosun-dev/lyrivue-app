// Whisper の言葉ごとの時刻のうち、当てにならないものを捨てる。
//
// 言葉ごとの時刻は「注目の向き」をたどって割り出すが、窓の端に近い言葉では、たどる先が
// 窓の終わりに張り付いて、何語も「同じ時刻・長さ 0」に並ぶことがある（本物の曲では、
// 「夏のしるし」の最後の「にしまう」が 207 秒で歌われているのに 221.78 秒に 3 語つぶれていた）。
// 文字は合っていても時刻が十数秒ずれるので、合わせるときに使わないほうがよい。

/**
 * 2語以上つづけて同じ時刻・長さ 0 の言葉（時刻がつぶれたもの）を捨てる。元の配列は変えない。
 * 1語だけの長さ 0 は、ふつうに起こる（短い言葉）ので残す。
 * @param {import('./types.js').AsrWord[]} words
 * @returns {import('./types.js').AsrWord[]}
 */
export function dropCollapsedWords(words) {
  if (!Array.isArray(words)) return [];
  const same = (a, b) => a.start === b.start && a.end === b.end && a.start === a.end;
  const out = [];
  let i = 0;
  while (i < words.length) {
    let j = i + 1;
    while (j < words.length && same(words[i], words[j])) j++;
    if (j - i < 2) out.push(words[i]);
    i = j;
  }
  return out;
}
