import { test } from 'node:test'; import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { appHtml } from '../tools/build-www.mjs';

const web = readFileSync(new URL('../web/app/play-check.html', import.meta.url), 'utf8');

test('アプリの画面：外への読み込みが無く、部品はアプリの中の写しを読む', () => {
  const h = appHtml(web);
  assert.doesNotMatch(h, /<(script|link)[^>]+(src|href)="https?:\/\//i);
  assert.match(h, /"mp4-muxer": "\.\/vendor\/mp4-muxer\.js"/);
  assert.match(h, /"kuromoji-dict\/": "\.\/vendor\/kuromoji\/dict\/"/);
  assert.match(h, /<link rel="stylesheet" href="fonts\/fonts\.css">/);
  assert.match(h, /src="app\/play-check\.js"/);
});
test('アプリの画面：AI と計算の部品もアプリの中の写し（.mjs は .js の名前）・読み込みの決まりは JSON として読める', () => {
  const h = appHtml(web);
  const map = JSON.parse(h.match(/<script type="importmap">([\s\S]*?)<\/script>/)[1]);
  assert.equal(map.imports['@huggingface/transformers'], './vendor/transformers/transformers.js');
  assert.equal(map.imports['ort-wasm/'], './vendor/transformers/');
  assert.equal(map.imports['ort-wasm/ort-wasm-simd-threaded.jsep.mjs'], './vendor/transformers/ort-wasm-simd-threaded.jsep.js');
  assert.ok(Object.values(map.imports).every(v => v.startsWith('./')), '外への読み込みが無い');
});
test('アプリの画面：アプリだけの見た目と保存の差し替えを、</head> の前で読む', () => {
  const h = appHtml(web);
  const head = h.slice(0, h.indexOf('</head>'));
  for (const f of ['app/app-native.css', 'js/vendor/capacitor.js', 'js/vendor/share.js', 'js/app-native.js']) assert.ok(head.includes(f), f);
});
test('アプリだけの見た目：作る側の道具・いつもの曲を隠す', () => {
  const css = readFileSync(new URL('../js/app-native.css', import.meta.url), 'utf8');
  for (const sel of ['#tools', 'section:has(#song-set)']) assert.ok(css.includes(sel), sel);
});
test('写したウェブ版に、持ち主の曲や解析結果が混ざっていない', () => {
  assert.ok(!existsSync(new URL('../web/songs', import.meta.url)));
  assert.ok(!existsSync(new URL('../web/eval', import.meta.url)));
});
