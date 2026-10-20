// Whisper（軽い版 base）で歌を聞き、言葉ごとの時刻を返す。
// ブラウザでも Node でも動くよう、@huggingface/transformers だけを使う。中身は whisper-core.js。
import * as lib from '@huggingface/transformers';
import { createTranscriberWith, chunksToWords, fixTokenTimestampFrames as fixFrames } from './whisper-core.js';

export { chunksToWords };

/**
 * 聞き取り係を作る。モデルは最初に1回だけ読み込む。
 * @param {{model?:string, language?:string, onProgress?:(p:any)=>void}} [opts] onProgress はモデルのダウンロード経過
 */
export const createTranscriber = (opts) => createTranscriberWith(lib, opts);

/** transformers.js 3.8.1 の言葉ごとの時刻の計算を直す（whisper-core.js）。version の既定は読み込んだライブラリの版 */
export const fixTokenTimestampFrames = (model, version = lib.env?.version) => fixFrames(model, version);
