// 歌を聞く AI（Whisper）を、画面とは別の作業場（Worker）で動かす。
// 画面と同じ所で動かすと、聞き終わるまで（曲の長さ〜数倍）ページが止まって固まったように見えるため。
// Worker では読み込みの決まり（import map）が使えないので、transformers.js の場所は画面から受け取る。
import { createTranscriberWith } from '../analyze/whisper-core.js';

let transcriber = null;

self.onmessage = async ({ data }) => {
  try {
    if (data?.type === 'load') {
      const lib = await import(data.libUrl);
      if (data.wasmPaths) lib.env.backends.onnx.wasm.wasmPaths = data.wasmPaths;
      transcriber = await createTranscriberWith(lib, {
        language: data.language,
        onProgress: p => { if (p?.file && (p.status === 'progress' || p.status === 'done')) self.postMessage({ type: 'model', p: { file: p.file, status: p.status, loaded: p.loaded, total: p.total } }); },
      });
      self.postMessage({ type: 'ready' });
    } else if (data?.type === 'transcribe') {
      if (!transcriber) throw new Error('AI がまだ読み込まれていません');
      const words = await transcriber.transcribe(data.mono, undefined, data.language); // 歌詞が英語なら english
      self.postMessage({ type: 'words', id: data.id, words });
    }
  } catch (e) {
    self.postMessage({ type: 'error', id: data?.id, message: String(e?.message ?? e) });
  }
};
