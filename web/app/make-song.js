// 新しい曲で作る：曲ファイルと歌詞から、聞く係（analyzeSong）で解析結果を作る。
// 辞書（kuromoji）と AI（Whisper）は、作るボタンを押したときに初めて読み込む。
// AI が使えない・読み込めないときは、代わりの合わせ方（盛り上がっている範囲に文字数の比で並べる）で続ける。
// 曲と歌詞はこのブラウザの中だけで使い、外へは送らない（外から読むのは AI のデータだけ）。
import { analyzeSong } from '../analyze/index.js';
import { lyricsLanguage, parseLyrics } from '../analyze/lyrics.js';
import { japaneseParts, fromRawTokenizer, lightRawTokenize } from '../analyze/japanese-core.js';
import { createEnglish } from '../analyze/english.js';
import { transcribeInChunks } from '../analyze/whisper-chunks.js';

const here = p => new URL(p, import.meta.url).href;

/** iPhone・iPad か（Whisper が落ちるので、AI の初期値を「使わない」にする） */
export const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

/** 「AI で歌に合わせる」を最初からオンにするか。iPhone の Safari ではウェブの AI が落ちるのでオフ。
 * iPhone アプリは iPhone 本体の whisper.cpp（window.lyrivueWhisper）で聞けるのでオン（2026-10-21 持ち主の iPhone 12 mini で確かめた） */
export const aiOnByDefault = ({ ios = isIOS(), native = globalThis.lyrivueWhisper } = {}) => !ios || !!native;

// AI は一度読めば、ページを開き直すまで使い回す（失敗したら次に押したとき読み直す）
let transcriberPromise = null;

// 辞書の置き場所：kuromoji は辞書の場所を道のようにつなぐ（// が / になる）ので、同じ置き場所なら道だけを渡す
function dictPath() {
  const dict = new URL(import.meta.resolve('kuromoji-dict/'));
  return dict.origin === location.origin ? dict.pathname : dict.href;
}

// 辞書は画面とは別の作業場（app/japanese-worker.js）で組み立て、切れ端の区切りだけ受け取る（終わったら作業場は閉じて記憶を返す）。
// 画面と同じ所で組み立てると、iPhone ではその間ページ全体が止まった（2026-10-20 iPhone 12 mini で「辞書（0 秒）」のまま）
function tokenizeOffPage(parts) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./japanese-worker.js', import.meta.url));
    const done = fn => v => { worker.terminate(); fn(v); };
    worker.onerror = e => { e.preventDefault?.(); done(reject)(new Error(e.message || '辞書の作業場を動かせませんでした')); };
    worker.onmessage = ({ data }) => {
      if (data.type !== 'done') { done(reject)(new Error(data.message || '辞書を組み立てられませんでした')); return; }
      done(resolve)(new Map(parts.map((p, i) => [p, data.tokens[i]])));
    };
    worker.postMessage({ lib: import.meta.resolve('kuromoji-build/kuromoji.js'), dicPath: dictPath(), parts });
  });
}

/** 歌詞の切れ端を区切っておき、読みと品詞を調べる係を作る。知らない切れ端は add で後から区切れる（AI が聞き取った言葉用） */
async function loadJapaneseOffPage(lyrics, log = () => {}) {
  const parts = [...new Set(parseLyrics(lyrics).flatMap(l => japaneseParts(l.text)))];
  const got = await tokenizeOffPage(parts);
  log(`辞書（別の作業場）：切れ端 ${parts.length} 個`);
  return {
    japanese: fromRawTokenizer(p => got.get(p) ?? lightRawTokenize(p)),
    async add(texts) {
      const more = [...new Set(texts.flatMap(t => japaneseParts(t)))].filter(p => !got.has(p));
      if (!more.length) return;
      for (const [k, v] of await tokenizeOffPage(more)) got.set(k, v);
      log(`辞書（別の作業場）：聞き取った言葉の切れ端 ${more.length} 個`);
    },
  };
}

// 計算の部品の場所（import map に ort-wasm/ が無ければ null＝transformers.js の決まりの配信元）
function ortPaths() {
  try {
    return {
      mjs: import.meta.resolve('ort-wasm/ort-wasm-simd-threaded.jsep.mjs'),
      wasm: import.meta.resolve('ort-wasm/ort-wasm-simd-threaded.jsep.wasm'),
    };
  } catch { return null; }
}

// AI は画面とは別の作業場（app/whisper-worker.js）で動かす。画面と同じ所で動かすと、聞き終わるまで
// （曲の長さ〜数倍）ページが止まって固まったように見えるため（2026-10-20 持ち主「くらうどかたまった」）
function loadTranscriber(onRatio, log = () => {}) {
  transcriberPromise ??= new Promise((resolve, reject) => {
    log('AI の作業場を作る');
    const worker = new Worker(new URL('./whisper-worker.js', import.meta.url), { type: 'module' });
    const files = new Map();
    const waiting = new Map(); // 聞き取りの番号 → { resolve, reject }
    let seq = 0;
    let ready = false;
    const failAll = err => {
      if (!ready) reject(err);
      for (const w of waiting.values()) w.reject(err);
      waiting.clear();
      transcriberPromise = null; // 次に押したとき作り直す
      worker.terminate();
    };
    worker.onerror = e => { e.preventDefault?.(); log(`AI の作業場でエラー：${e.message || '（中身なし）'}`); failAll(new Error(e.message || 'AI の作業場を動かせませんでした')); };
    worker.onmessage = ({ data }) => {
      if (data.type === 'model') {
        const p = data.p;
        if (!files.has(p.file)) log(`AI のデータを読み始め：${p.file}`);
        const f = files.get(p.file) ?? { loaded: 0, total: 0 };
        if (p.total) f.total = p.total;
        f.loaded = p.status === 'done' ? f.total || f.loaded : p.loaded ?? f.loaded;
        files.set(p.file, f);
        let loaded = 0, total = 0;
        for (const v of files.values()) { loaded += v.loaded; total += v.total; }
        if (total > 0) onRatio?.(loaded / total, total);
      } else if (data.type === 'ready') {
        ready = true;
        log('AI の準備ができた');
        resolve({
          // 作業場を閉じて AI の記憶を返す（次に使うときは読み直す。iPhone では AI を抱えたまま次の重い処理をすると落ちた）
          dispose() { transcriberPromise = null; worker.terminate(); },
          // analyzeSong が呼ぶ聞き取り係と同じ形（16kHz・1ch の音 → 言葉ごとの時刻）
          transcribe(mono16k, onProgress, language) {
            onProgress?.(0);
            const id = ++seq;
            return new Promise((res, rej) => {
              waiting.set(id, { resolve: w => { onProgress?.(1); res(w); }, reject: rej });
              worker.postMessage({ type: 'transcribe', id, mono: mono16k, language }, [mono16k.buffer]);
            });
          },
        });
      } else if (data.type === 'words') {
        waiting.get(data.id)?.resolve(data.words);
        waiting.delete(data.id);
      } else if (data.type === 'error') {
        log(`AI のエラー：${data.message}`);
        const err = new Error(data.message);
        if (data.id && waiting.has(data.id)) { waiting.get(data.id).reject(err); waiting.delete(data.id); } else failAll(err);
      }
    };
    log('AI の作業場へ読み込みを頼む');
    worker.postMessage({
      type: 'load',
      libUrl: import.meta.resolve('@huggingface/transformers'),
      // 計算の部品（ONNX Runtime の wasm と、それを読む mjs）の置き場所。ページの読み込みの決まり（import map）の ort-wasm/ で決める：
      // 手元のサーバーは node_modules の写し、iPhone アプリは中に入れた写し（外の配信元から作業場で読むと断られた）、公開ページは配信元
      wasmPaths: ortPaths(),
    });
  });
  transcriberPromise.catch(() => { transcriberPromise = null; });
  return transcriberPromise;
}

/**
 * iPhone アプリの中では、iPhone 本体の whisper.cpp（lyrivue-app の js/app-native.js が出す window.lyrivueWhisper）で聞く。
 * ウェブの AI は iPhone 12 mini では記憶が足りず、歌を聞いて 20 秒ほどで落ちた（2026-10-21。WebKit で測ると 1.0〜1.3GB）。
 * 曲は 15 秒ずつ切って 1 切れずつ渡す（analyze/whisper-chunks.js）。形はウェブの AI の係と同じ
 * @param {{prepare(onRatio?:(ratio:number,total:number)=>void):Promise<void>, transcribeChunk(mono:Float32Array, language:string):Promise<{text:string,start:number,end:number}[]>, release():Promise<void>}} native
 */
export async function loadNativeTranscriber(native, onRatio, log = () => {}) {
  log('AI：iPhone 本体（whisper.cpp）');
  await native.prepare((r, total) => onRatio?.(r, total));
  log('AI の準備ができた');
  return {
    dispose() { Promise.resolve(native.release()).catch(e => log(`AI を手放せなかった：${e?.message ?? e}`)); },
    transcribe: (mono16k, onProgress, language) => transcribeInChunks(mono16k, c => native.transcribeChunk(c, language), onProgress, log),
  };
}

// 読み込みがいつまでも終わらないとき（どこかで止まって返事が来ない）、待つのをやめて先へ進む
function within(promise, sec, what) {
  let timer = 0;
  const limit = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`${what}が ${sec} 秒たっても終わりませんでした`)), sec * 1000); });
  return Promise.race([promise, limit]).finally(() => clearTimeout(timer));
}

/** 曲を読み、1ch にまとめる */
async function decodeMono(file) {
  const buf = await file.arrayBuffer();
  const AC = window.AudioContext || window.webkitAudioContext;
  const ac = new AC();
  try {
    const audio = await new Promise((resolve, reject) => {
      const p = ac.decodeAudioData(buf, resolve, reject);
      if (p && typeof p.then === 'function') p.then(resolve, reject);
    });
    const n = audio.length, ch = audio.numberOfChannels;
    const mono = new Float32Array(n);
    for (let c = 0; c < ch; c++) {
      const d = audio.getChannelData(c);
      for (let i = 0; i < n; i++) mono[i] += d[i];
    }
    if (ch > 1) for (let i = 0; i < n; i++) mono[i] /= ch;
    return { mono, sampleRate: audio.sampleRate };
  } finally { ac.close?.(); }
}

// 重い計算の前に、画面を一度描かせる（見えていないタブでは rAF が来ないので、少し待って先へ）
const paint = () => new Promise(resolve => {
  let done = false;
  const go = () => { if (!done) { done = true; setTimeout(resolve, 0); } };
  requestAnimationFrame(go);
  setTimeout(go, 100);
});

/** 進み具合の段階（画面に出す順） */
export const MAKE_STEPS = [
  { key: 'dict', label: '辞書' },
  { key: 'decode', label: '曲を読む' },
  { key: 'tempo', label: '拍' },
  { key: 'model', label: 'AI のデータ' },
  { key: 'listen', label: '歌を聞く' },
  { key: 'align', label: '時刻' },
];

/**
 * @param {{file:File, lyrics:string, useAI:boolean, onStep?:(key:string, ratio:number, note?:string)=>void, onLog?:(text:string)=>void}} opts onLog は調べるための記録（画面に出す）
 * @returns {Promise<{analysis:import('../analyze/types.js').AnalysisResult, notes:string[]}>} notes は「AI を使えなかった」などのお知らせ
 */
export async function makeSong({ file, lyrics, useAI, onStep, onLog }) {
  const step = (k, r, note) => { try { onStep?.(k, r, note); } catch { /* 表示の失敗は無視 */ } };
  const log = text => { try { onLog?.(text); } catch { /* 記録の失敗は無視 */ } };
  log(`始め：曲 ${file?.name}（${((file?.size ?? 0) / 1048576).toFixed(1)} MB）・歌詞 ${String(lyrics ?? '').length} 文字・AI ${useAI ? 'オン' : 'オフ'}・言葉 ${lyricsLanguage(lyrics)}`);
  log(`環境：Worker ${typeof Worker === 'function' ? 'あり' : 'なし'}・隔離 ${self.crossOriginIsolated ? 'あり' : 'なし'}・場所 ${location.origin}・${navigator.userAgent.slice(0, 120)}`);
  const notes = [];

  step('dict', 0); await paint();
  let japanese = null;
  let dict = null;     // 辞書の係（聞き取った言葉を後から区切るため）
  let noDict = false;  // 辞書が読めず、簡単な区切りにした
  // 英語の歌詞なら日本語の辞書は読まない（組み立てに約 240MB 使い、専用ページではそこで止まって落ちた）
  if (lyricsLanguage(lyrics) === 'english') { japanese = createEnglish(); step('dict', 1, '英語'); }
  else try {
    dict = await within(loadJapaneseOffPage(lyrics, log), 60, '辞書の読み込み');
    japanese = dict.japanese;
    step('dict', 1);
  } catch (e) {
    log(`辞書のエラー：${e?.message ?? e}`);
    // 辞書が使えなくても、漢字・カタカナのまとまりを言葉として拾って最後まで作る（AI の合わせには読みが要るので、AI は使わない）
    japanese = fromRawTokenizer(lightRawTokenize);
    noDict = true;
    notes.push(`辞書を読み込めなかったので、簡単な言葉の区切りで作りました（${e?.message ?? e}）`);
    step('dict', 1, '簡単');
  }

  // AI は「歌を聞く」直前に読み込み、聞き終わったら手放す。曲を広げる・拍を調べるのと同時に記憶へ乗せないため
  // （2026-10-21 持ち主の iPhone 12 mini：AI のデータを読んだあと、154 秒の wav を読み終えた所でアプリが落ちた）
  let transcriber = null;
  const wantAI = useAI && japanese && !noDict && String(lyrics ?? '').trim();
  if (wantAI) {
    // 歌詞が英語なら、AI にも英語として聞かせる（日本語のままだとカタカナに聞き違える）
    const language = lyricsLanguage(lyrics);
    transcriber = {
      async transcribe(m, p) {
        step('model', 0); await paint();
        let ai = null;
        try {
          let lastMove = performance.now();
          const onRatio = (r, total) => { lastMove = performance.now(); step('model', r, `${(total / 1048576).toFixed(0)} MB`); };
          const native = globalThis.lyrivueWhisper;
          const loading = native ? loadNativeTranscriber(native, onRatio, log) : loadTranscriber(onRatio, log);
          // データの読み込みが 90 秒進まなければあきらめる（ダウンロード中は進むので待つ）
          const stall = new Promise((_, reject) => {
            const id = setInterval(() => { if (performance.now() - lastMove > 90_000) { clearInterval(id); reject(new Error('AI のデータの読み込みが 90 秒進みませんでした')); } }, 1000);
            loading.finally(() => clearInterval(id)).catch(() => {});
          });
          ai = await Promise.race([loading, stall]);
          step('model', 1);
          step('listen', 0); // 表示を「歌を聞く」に戻す（AI のデータは歌を聞く段の中で読む）
        } catch (e) {
          log(`AI を使えない：${e?.message ?? e}`);
          notes.push(`AI を読み込めなかったので、代わりの合わせ方で時刻を付けました（${e?.message ?? e}）。「タップで合わせる」で直せます`);
          step('model', 1, 'なし');
          aiFailed = true;
          throw e; // analyzeSong が代わりの合わせ方へ進む
        }
        try {
          const words = await ai.transcribe(m, p, language);
          // 聞き取った言葉の読みも辞書で調べてから合わせる（辞書は別の作業場なので、合わせる前に区切っておく）
          if (dict) await dict.add(words.map(w => w.text));
          return words;
        } finally {
          ai.dispose?.();
          log('AI を手放した');
        }
      },
    };
  } else step('model', 1, '使わない');
  let aiFailed = false;

  step('decode', 0); await paint();
  const { mono, sampleRate } = await decodeMono(file); // 曲が読めないときだけは止める（MV にできないので）
  step('decode', 1, `${(mono.length / sampleRate).toFixed(0)} 秒`);
  await paint();

  let listenTimer = 0;
  const analysis = await analyzeSong({
    mono, sampleRate, lyricsText: lyrics ?? '', transcriber, japanese,
    onProgress: (s, r) => {
      if (s === 'tempo' || s === 'listen' || s === 'align') step(s, r);
      // 歌を聞いている間は割合が出ないので、たった秒数を出す（止まっていないことが分かるように）
      if (s === 'listen' && r === 0 && transcriber && !listenTimer) { // 0 は2回届く（analyzeSong と聞き取り係）ので、時計は1つだけ
        const t0 = performance.now();
        listenTimer = setInterval(() => step('listen', 0, `${Math.round((performance.now() - t0) / 1000)} 秒`), 1000);
      }
      if (s === 'listen' && r === 1) { clearInterval(listenTimer); }
    },
  }).finally(() => clearInterval(listenTimer));
  if (analysis.usedFallback && transcriber && !aiFailed) notes.push('AI がうまく聞き取れなかったので、代わりの合わせ方で時刻を付けました。「タップで合わせる」で直せます');
  if (analysis.usedFallback && !transcriber && !notes.length && useAI === false) notes.push('時刻はざっと付けてあります。「タップで合わせる」で合わせると、ぴったりになります');
  return { analysis, notes };
}
