// 日本語の読み（ひらがな）と品詞を調べる（kuromoji）
// dicPath は辞書フォルダ。Node では実ファイル、ブラウザでは URL として読まれる
import kuromoji from 'kuromoji';

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
 * @param {string} dicPath 辞書フォルダ（例: 'node_modules/kuromoji/dict'）
 * @returns {Promise<{toKana(text:string):string, tokenize(text:string):Token[]}>}
 */
export function createJapanese(dicPath) {
  return new Promise((resolve, reject) => {
    kuromoji.builder({ dicPath }).build((err, tokenizer) => {
      if (err) { reject(err); return; }

      /** 1語の読み。読みのない語（記号など）は表層をそのまま使う */
      const readingOf = (t) => {
        const r = t.reading;
        return kataToHira(r && r !== '*' ? r : t.surface_form);
      };

      // 英字の連なりは辞書に任せず、そのまま 1 語にする
      // （辞書は「Tシャツ」を丸ごと「てぃーしゃつ」と読んでしまい、英字のまま比べられないため）
      const run = (text) => {
        // 数字は漢数字にして辞書に読ませる（「2人」→「二人」→ ふたり）
        const src = String(text ?? '').normalize('NFKC').replace(/[0-9]/g, (d) => '〇一二三四五六七八九'[Number(d)]);
        /** @type {Token[]} */
        const out = [];
        for (const part of src.split(/([A-Za-z]+)/)) {
          if (!part) continue;
          if (/^[A-Za-z]+$/.test(part)) {
            out.push({ surface: part, pos: '名詞', posDetail: '一般', reading: part.toLowerCase() });
          } else {
            for (const t of tokenizer.tokenize(part)) {
              out.push({ surface: t.surface_form, pos: t.pos, posDetail: t.pos_detail_1 || '*', reading: readingOf(t) });
            }
          }
        }
        return out;
      };

      resolve({
        toKana(text) {
          return keepSinging(run(text).map((t) => t.reading).join('').toLowerCase());
        },
        tokenize(text) {
          return run(text);
        },
      });
    });
  });
}
