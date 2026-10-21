import { test } from 'node:test'; import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const read = p => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

/** js/app-native.js を、偽の Capacitor（LyrivueWhisper プラグインつき）の中で動かす */
function runBridge({ available = true } = {}) {
  const sent = { transcribe: [], prepare: 0, removed: 0 };
  let progress = null;
  const plugin = {
    async addListener(name, fn) { if (name === 'progress') progress = fn; return { remove: async () => { sent.removed++; } }; },
    async prepare() { sent.prepare++; progress?.({ loaded: 30, total: 60 }); },
    async transcribe(opts) { sent.transcribe.push(opts); return { tokens: [{ text: 'あ', start: 0.1, end: 0.2 }] }; },
    async release() {},
  };
  const ctx = {
    btoa, atob, TextEncoder, console,
    Capacitor: {
      isNativePlatform: () => true,
      isPluginAvailable: name => available && name === 'LyrivueWhisper',
      registerPlugin: name => (name === 'LyrivueWhisper' ? plugin : null),
    },
  };
  ctx.window = ctx;
  vm.runInNewContext(read('js/app-native.js'), ctx);
  return { w: ctx.lyrivueWhisper, sent };
}

test('橋：切れの音を base64 で送り（配列の途中からでも）、言葉の種類を ja / en に直す', async () => {
  const { w, sent } = runBridge();
  const all = new Float32Array([9, 0.25, -0.5, 1, 9]);
  const words = await w.transcribeChunk(all.subarray(1, 4), 'english');
  assert.deepEqual(words, [{ text: 'あ', start: 0.1, end: 0.2 }]);
  const { audio, language } = sent.transcribe[0];
  assert.equal(language, 'en');
  const bytes = Uint8Array.from(atob(audio), c => c.charCodeAt(0));
  assert.deepEqual([...new Float32Array(bytes.buffer)], [0.25, -0.5, 1]);
  await w.transcribeChunk(all, 'japanese');
  assert.equal(sent.transcribe[1].language, 'ja');
});
test('橋：AI のデータの読み込みの進み具合を渡し、終わったら知らせを外す', async () => {
  const { w, sent } = runBridge();
  const seen = [];
  await w.prepare((r, total) => seen.push([r, total]));
  assert.deepEqual(seen, [[0.5, 60]]);
  assert.equal(sent.prepare, 1);
  assert.equal(sent.removed, 1);
});
test('橋：プラグインが無ければ lyrivueWhisper を出さない（ウェブの AI のまま）', () => {
  assert.equal(runBridge({ available: false }).w, undefined);
});

test('プラグインの形：npm の file: 依存・Capacitor の iOS の場所・whisper.cpp v1.9.2 の部品', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.equal(pkg.dependencies['lyrivue-whisper'], 'file:plugins/whisper');
  const plug = JSON.parse(read('plugins/whisper/package.json'));
  assert.equal(plug.name, 'lyrivue-whisper');
  assert.equal(plug.capacitor.ios.src, 'ios');
  const spm = read('plugins/whisper/Package.swift');
  assert.ok(spm.includes('https://github.com/ggml-org/whisper.cpp/releases/download/v1.9.2/whisper-v1.9.2-xcframework.zip'));
  assert.ok(spm.includes('af74fed13ea7f2d5ca2a39d9f58ec177713fafd7cab63aef4e27b79f3ceca80b'));
  const swift = read('plugins/whisper/ios/Sources/LyrivueWhisperPlugin/LyrivueWhisperPlugin.swift');
  assert.ok(swift.includes('jsName = "LyrivueWhisper"'));
  for (const m of ['prepare', 'transcribe', 'release']) assert.ok(swift.includes(`name: "${m}"`), m);
  assert.ok(swift.includes('ggml-base-q5_1.bin'));
});
test('アプリの対応 iOS は 16.4（whisper.cpp の部品が 16.4 から）', () => {
  const pbx = read('ios/App/App.xcodeproj/project.pbxproj');
  assert.doesNotMatch(pbx, /IPHONEOS_DEPLOYMENT_TARGET = 15\.0;/);
  assert.match(pbx, /IPHONEOS_DEPLOYMENT_TARGET = 16\.4;/);
});
