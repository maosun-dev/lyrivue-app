// 歌詞から「よく出る言葉」と「雰囲気」を取り出す
import { MOOD_WORDS } from './mood-words.js';

/** 歌詞に残さない名詞（数・代名詞・非自立など）の細分類 */
const SKIP_DETAIL = new Set(['数', '代名詞', '非自立', '接尾', '特殊']);

/**
 * 名詞を数えて、多い順（同数は先に出た順）に max 個返す。
 * @param {import('./types.js').LyricLine[]} lines
 * @param {(text:string)=>import('./types.js').Token[]} tokenize
 * @param {number} [max]
 * @returns {string[]}
 */
export function extractWords(lines, tokenize, max = 12) {
  /** @type {Map<string,{n:number, first:number}>} */
  const counts = new Map();
  let order = 0;
  for (const line of lines ?? []) {
    for (const t of tokenize(line.text)) {
      if (t.pos !== '名詞' || SKIP_DETAIL.has(t.posDetail)) continue;
      if (/^[A-Za-z]$/.test(t.surface)) continue; // 「Tシャツ」の T のような英字1文字
      if (!/[^\s\p{P}\p{S}]/u.test(t.surface)) continue; // 記号だけは除く
      const c = counts.get(t.surface);
      if (c) c.n++; else counts.set(t.surface, { n: 1, first: order++ });
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1].n - a[1].n || a[1].first - b[1].first)
    .slice(0, max)
    .map(([w]) => w);
}

/**
 * 雰囲気ごとの強さ（0〜1）。その言葉が出た行の数 ÷ 全行数 を2倍して 1 で止める。
 * 言葉の判定は行の文字（NFKC）に含まれるかどうかで行う。
 * 辞書の区切り方で「ひとり」「さよなら」などが割れても拾うため。
 * tokenize は使わないが、予定どおりの形にそろえるため引数に残している。
 * @param {import('./types.js').LyricLine[]} lines
 * @param {(text:string)=>import('./types.js').Token[]} [tokenize]
 * @returns {{night:number, summer:number, rain:number, love:number, lonely:number}}
 */
export function moodOf(lines, tokenize) { // eslint-disable-line no-unused-vars
  const texts = (lines ?? []).map((l) => String(l.text ?? '').normalize('NFKC'));
  const result = {};
  for (const [mood, words] of Object.entries(MOOD_WORDS)) {
    const hit = texts.filter((t) => words.some((w) => t.includes(w))).length;
    result[mood] = texts.length ? Math.min(1, (hit / texts.length) * 2) : 0;
  }
  return /** @type {any} */ (result);
}
