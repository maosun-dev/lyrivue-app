// ブラウザで `import kuromoji from 'kuromoji'` を通すための橋渡し。
// kuromoji は CommonJS なので、ページで ../node_modules/kuromoji/build/kuromoji.js を
// ふつうの <script> として先に読み込み（window.kuromoji ができる）、それをここから渡す。
// どの名前をどこから読むかは analyze-check.html の import map に書いてある。
const kuromoji = globalThis.kuromoji;
if (!kuromoji) {
  throw new Error('kuromoji が読み込まれていません（ページの <script src=".../kuromoji.js"> を確かめてください）');
}
export default kuromoji;
