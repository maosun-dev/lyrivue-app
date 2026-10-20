// 日本語の辞書（kuromoji）を、画面とは別の作業場で組み立てて、歌詞の切れ端を区切って返す。
// 画面と同じ所で組み立てると、iPhone ではその間ページ全体が止まった（2026-10-20 持ち主の iPhone 12 mini で「辞書（0 秒）」のまま）。
// kuromoji は中で古い書き方（this を使う部品）をしているので、module ではなく、ふつうの作業場で importScripts で読む。
// 受け取るもの：{ lib: kuromoji.js の URL, dicPath: 辞書の場所, parts: 切れ端の並び }
// 返すもの：{ type: 'done', tokens: 切れ端ごとの区切り } か { type: 'error', message }
self.onmessage = ({ data }) => {
  try {
    if (!self.kuromoji) importScripts(data.lib);
    self.kuromoji.builder({ dicPath: data.dicPath }).build((err, tokenizer) => {
      if (err) { self.postMessage({ type: 'error', message: String(err?.message ?? err) }); return; }
      const tokens = data.parts.map(p => tokenizer.tokenize(p).map(t => ({
        surface_form: t.surface_form, pos: t.pos, pos_detail_1: t.pos_detail_1, reading: t.reading,
      })));
      self.postMessage({ type: 'done', tokens });
    });
  } catch (e) {
    self.postMessage({ type: 'error', message: String(e?.message ?? e) });
  }
};
