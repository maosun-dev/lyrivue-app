// 日本語の読み（ひらがな）と品詞を調べる（kuromoji）
// dicPath は辞書フォルダ。Node では実ファイル、ブラウザでは URL として読まれる
import kuromoji from 'kuromoji';
import { fromRawTokenizer } from './japanese-core.js';

export { japaneseParts, fromRawTokenizer, lightRawTokenize } from './japanese-core.js';

/** @typedef {import('./types.js').Token} Token */

/**
 * @param {string} dicPath 辞書フォルダ（例: 'node_modules/kuromoji/dict'）
 * @returns {Promise<{toKana(text:string):string, tokenize(text:string):Token[]}>}
 */
export function createJapanese(dicPath) {
  return new Promise((resolve, reject) => {
    kuromoji.builder({ dicPath }).build((err, tokenizer) => {
      if (err) { reject(err); return; }
      resolve(fromRawTokenizer(part => tokenizer.tokenize(part)));
    });
  });
}
