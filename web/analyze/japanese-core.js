// 日本語の読み（ひらがな）と品詞を、区切る係（kuromoji の tokenize と同じ形）から調べる。kuromoji そのものは読まない
// （画面を開いたときに辞書の部品を読まないため。辞書を使う係は japanese.js、別の作業場は app/japanese-worker.js）

/** @typedef {import('./types.js').Token} Token */

// カタカナ → ひらがな（ァ〜ヶ だけ 0x60 ずらす。ー は対象外）
function kataToHira(s) {
  return s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
}

// 残すのは ひらがな・英小文字・数字だけ（ー・記号・空白は消す）
function keepSinging(s) {
  return s.replace(/[^ぁ-ゖa-z0-9]/g, '');
}

/**
 * 辞書に渡す切れ端。英字の連なりは辞書に任せず外し（1 語として別に扱う）、数字は漢数字にする（「2人」→「二人」→ ふたり）。
 * 別の作業場で辞書を使うとき（app/japanese-worker.js）は、この切れ端だけを渡して区切ってもらう。
 * @param {string} text
 * @returns {string[]}
 */
export function japaneseParts(text) {
  return splitParts(text).filter(p => !/^[A-Za-z]+$/.test(p));
}
function splitParts(text) {
  const src = String(text ?? '').normalize('NFKC').replace(/[0-9]/g, (d) => '〇一二三四五六七八九'[Number(d)]);
  return src.split(/([A-Za-z]+)/).filter(Boolean);
}

/**
 * 切れ端を区切る係（kuromoji の tokenize と同じ形：surface_form・pos・pos_detail_1・reading）から、読みと品詞を調べる係を作る
 * @param {(part:string)=>{surface_form:string, pos:string, pos_detail_1?:string, reading?:string}[]} rawTokenize
 * @returns {{toKana(text:string):string, tokenize(text:string):Token[]}}
 */
export function fromRawTokenizer(rawTokenize) {
  /** 1語の読み。読みのない語（記号など）は表層をそのまま使う */
  const readingOf = (t) => {
    const r = t.reading;
    return kataToHira(r && r !== '*' ? r : t.surface_form);
  };
  // 英字の連なりは辞書に任せず、そのまま 1 語にする
  // （辞書は「Tシャツ」を丸ごと「てぃーしゃつ」と読んでしまい、英字のまま比べられないため）
  const run = (text) => {
    /** @type {Token[]} */
    const out = [];
    for (const part of splitParts(text)) {
      if (/^[A-Za-z]+$/.test(part)) {
        out.push({ surface: part, pos: '名詞', posDetail: '一般', reading: part.toLowerCase() });
      } else {
        for (const t of rawTokenize(part)) {
          out.push({ surface: t.surface_form, pos: t.pos, posDetail: t.pos_detail_1 || '*', reading: readingOf(t) });
        }
      }
    }
    return out;
  };
  return {
    toKana(text) {
      return keepSinging(run(text).map((t) => t.reading).join('').toLowerCase());
    },
    tokenize(text) {
      return run(text);
    },
  };
}

/**
 * 辞書なしの簡単な区切り（辞書を組み立てられない端末の代わり）。漢字・カタカナ・ひらがな・そのほかのまとまりで区切り、
 * 漢字とカタカナのまとまりを名詞として扱う。漢字の読みは分からないので表層のまま（AI の合わせには使わない）
 * @param {string} part
 */
export function lightRawTokenize(part) {
  const runs = String(part ?? '').match(/[一-龯々〆ヵヶ]+|[ァ-ヴー]+|[ぁ-ゖ]+|[^一-龯々〆ヵヶァ-ヴーぁ-ゖ]+/g) ?? [];
  return runs.map(r => {
    const noun = /^[一-龯々〆ヵヶァ-ヴー]+$/.test(r);
    return { surface_form: r, pos: noun ? '名詞' : 'その他', pos_detail_1: noun ? '一般' : '*', reading: /^[ァ-ヴー]+$/.test(r) ? r : '*' };
  });
}
