// 歌詞の行から、曲の区切り（Aメロ・サビなど）を作る

const GAP = 3; // 見出しが無いとき、歌がこれ以上（秒）途切れたら区切る

/** @param {import('./types.js').TimedLine[]} lines @param {number} duration @returns {import('./types.js').Section[]} */
export function buildSections(lines, duration) {
  if (!lines.length) return [];
  const hasHeading = lines.some(l => l.section !== '');
  const groups = []; // { name, start }
  lines.forEach((l, i) => {
    const prev = lines[i - 1];
    const split = !prev || (hasHeading ? l.sectionIndex !== prev.sectionIndex : l.start - prev.end >= GAP);
    if (split) groups.push({ name: hasHeading ? l.section : '', index: hasHeading ? l.sectionIndex : groups.length, start: l.start });
  });
  // end は start より前にならない（最後の行が曲の長さより後ろにあっても逆向きにしない）
  return groups.map((g, i) => ({
    name: g.name, index: g.index,
    start: g.start, end: Math.max(g.start, i + 1 < groups.length ? groups[i + 1].start : duration),
  }));
}
