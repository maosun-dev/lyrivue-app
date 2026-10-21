// 「ここから場所を変える」：持ち主が止めた画面で行ごとに決めた区切りの印を、解析結果の区切りに掛ける。
// サビなどの見出しが書いていない歌詞でも、同じ種類の区切りは同じ場所に戻り、サビは派手な場所になる
// （場所を決めるのは director/worlds.js の planJourney。ここでは区切りの名前と範囲を作り直すだけ）。
// 2026-10-21 持ち主「世界を変えるタイミングとかもあると面白い。サビとか書いてない歌詞に」

/** 印の種類 → 区切りの名前（director/worlds.js の sectionKind が読める名前）。none＝ここでは区切らない（前の区切りにつなぐ） */
export const PLACE_KINDS = { verse: 'Aメロ', bridge: 'Bメロ', chorus: 'サビ', outro: 'アウトロ', none: '' };

/**
 * 行の直し（edits.lines）の place を解析結果に掛けた写しを返す（元は書き換えない。効く印が無ければ同じものを返す）。
 * 印のある行から先は、次の印か見出しまでその種類。とちゅうの自動の区切り（歌が途切れた所）は残し、同じ種類のままにする
 * @param {import('../analyze/types.js').AnalysisResult} a
 * @param {{lines?:Object<string,{text:string, place?:string}>}} [edits]
 */
export function applyPlaces(a, edits) {
  const lines = Array.isArray(a?.lines) ? a.lines : [];
  const src = edits?.lines && typeof edits.lines === 'object' ? edits.lines : {};
  /** @type {Map<number,string>} 行 → 印 */
  const marks = new Map();
  for (const [k, e] of Object.entries(src)) {
    const i = Number(k);
    if (!Number.isInteger(i) || !lines[i] || !e || !(e.place in PLACE_KINDS)) continue;
    if (typeof e.text === 'string' && e.text !== String(lines[i].text ?? '')) continue; // 歌詞が変わった行には掛けない
    marks.set(i, e.place);
  }
  if (!marks.size || !lines.length) return a;

  // もとの区切り：その行の歌い出し以前に始まる最後の区切り
  const sections = Array.isArray(a.sections) ? a.sections : [];
  const base = lines.map(l => {
    let idx = -1;
    sections.forEach((s, j) => { if (s.start <= l.start) idx = j; });
    return idx;
  });
  const hasHeading = lines.some(l => String(l.section ?? '') !== '');
  let name = '', index = -1;
  const out = lines.map((l, i) => {
    const mark = marks.get(i);
    const baseSplit = i === 0 || base[i] !== base[i - 1];
    const split = i === 0 || (mark !== undefined ? mark !== 'none' : baseSplit);
    if (mark !== undefined && mark !== 'none') name = PLACE_KINDS[mark];
    else if (baseSplit && mark !== 'none' && hasHeading) name = String(l.section ?? ''); // 見出しの所からは見出しの名前に戻る
    else if (i === 0) name = hasHeading ? String(l.section ?? '') : '';
    if (split) index++;
    return { ...l, section: name, sectionIndex: index };
  });
  // 区切りの範囲：番号が変わる行の歌い出しから、次の区切りの頭まで（最初の区切りは、もとの最初の区切りの頭から）
  const dur = Number.isFinite(a.duration) && a.duration > 0 ? a.duration : 0;
  const heads = [];
  out.forEach((l, i) => { if (i === 0 || l.sectionIndex !== out[i - 1].sectionIndex) heads.push({ name: l.section, index: l.sectionIndex, start: l.start }); });
  if (sections.length && Number.isFinite(sections[0].start)) heads[0].start = Math.min(heads[0].start, sections[0].start);
  const secs = heads.map((h, j) => ({ ...h, end: Math.max(h.start, j + 1 < heads.length ? heads[j + 1].start : Math.max(dur, h.start)) }));
  return { ...a, lines: out, sections: secs };
}
