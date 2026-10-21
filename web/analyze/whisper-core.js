// Whisper（軽い版 base）で歌を聞き、言葉ごとの時刻を返す部分。transformers.js は外から渡す（lib）。
// 画面とは別の作業場（Worker）では読み込みの決まり（import map）が使えないので、ライブラリを名前で読まずに受け取る。
// ふだん（Node・解析の確認ページ）は whisper.js から使う。
import { dropCollapsedWords } from './asr-repair.js';

/** @typedef {import('./types.js').AsrWord} AsrWord */

/**
 * 聞き取り係を作る。モデルは最初に1回だけ読み込む。
 * @param {{pipeline:Function, env?:{version?:string}}} lib transformers.js（の pipeline と env）
 * @param {{model?:string, language?:string, onProgress?:(p:any)=>void}} [opts] onProgress はモデルのダウンロード経過。language は歌の言葉（既定は日本語）
 */
export async function createTranscriberWith(lib, { model = 'onnx-community/whisper-base_timestamped', language = 'japanese', onProgress } = {}) {
  // 言葉ごとの時刻が出るのは _timestamped 版だけ
  if (!model.includes('_timestamped')) {
    throw new Error(`言葉ごとの時刻が出るモデルではありません: ${model}`);
  }
  const asr = await lib.pipeline('automatic-speech-recognition', model, {
    dtype: 'q8',
    // 計算の部品が記憶をまとめて確保しておく仕組みを切る（結果は同じ）。iPhone 12 mini で歌を聞いて 20 秒ほどで落ちた
    // （2026-10-21。WebKit で測ると聞いている間の山が 1.1〜1.7GB → 1.0〜1.3GB に下がった）
    session_options: { enableCpuMemArena: false, enableMemPattern: false },
    progress_callback: onProgress,
  });
  fixTokenTimestampFrames(asr.model, lib.env?.version);

  return {
    /**
     * @param {Float32Array} mono16k 16kHz・1ch の音
     * @param {(ratio:number)=>void} [onProgress] 簡易：始めに0、終わりに1
     * @param {string} [lang] この曲の言葉の種類（作るときの language より優先）
     * @returns {Promise<AsrWord[]>}
     */
    async transcribe(mono16k, onProgress, lang = language) {
      onProgress?.(0);
      // 30秒窓だと前奏つきの冒頭を ♪ と聞き違えて歌い出しを落とすので、15秒窓・重なり3秒にしている
      const out = await asr(mono16k, {
        language: lang,
        task: 'transcribe',
        return_timestamps: 'word',
        chunk_length_s: 15,
        stride_length_s: 3,
      });
      // 時刻がつぶれた言葉は捨てる（asr-repair.js）
      const words = dropCollapsedWords(chunksToWords(out.chunks));
      onProgress?.(1);
      return words;
    },
  };
}

/** Whisper の chunks を AsrWord[] に詰め替える（時刻が null の語は前後から埋める） */
export function chunksToWords(chunks) {
  if (!Array.isArray(chunks) || chunks.length === 0) {
    throw new Error('言葉ごとの時刻が返りませんでした（モデルが _timestamped 版か確認してください）');
  }
  const items = chunks
    .map((c) => ({
      text: String(c.text ?? '').trim(),
      start: c.timestamp?.[0] ?? null,
      end: c.timestamp?.[1] ?? null,
    }))
    // 記号だけの語（♪ や ~ など、音楽を歌と聞き違えたもの）は捨てる
    .filter((c) => /[\p{L}\p{N}]/u.test(c.text));

  for (let i = 0; i < items.length; i++) {
    const w = items[i];
    if (w.start == null) w.start = i > 0 ? items[i - 1].end ?? items[i - 1].start ?? 0 : 0;
    if (w.end == null) {
      // 次の語の始まり、なければ自分の始まりまで
      const next = items.slice(i + 1).find((n) => n.start != null);
      w.end = next ? next.start : w.start;
    }
    if (w.end < w.start) w.end = w.start;
  }
  return items;
}

const FIXED_FOR_VERSION = '3.8.1';
let warnedVersion = false;

/**
 * transformers.js 3.8.1 の言葉ごとの時刻の計算を直す。
 * パイプラインは窓の長さを「音の特徴のこま数」（10ミリ秒ごと）で num_frames として渡すが、
 * Whisper の注目の表は 2 こまを 1 つにまとめた 20ミリ秒ごとの並び。半分にしないと 15 秒の窓でも
 * 30 秒ぶん（後ろ半分は埋めた無音）を見てしまい、言葉の時刻が無音の側へ流れて
 * 「窓の始まり + 29.98 秒」につぶれる（本家 Python 版は num_frames // 2 で切っている）。
 * 不具合を確かめた 3.8.1 のときだけ直す。ほかの版では、本家で直っていると半分の半分になって
 * 時刻が窓の前半へ寄ってしまうので、直さずに一度だけ注意を出す（版を上げたら確かめ直すこと）。
 * @param {any} model asr.model
 * @param {string} [version] transformers.js の版（読み込んだライブラリの env.version）
 * @returns {boolean} 直したら true
 */
export function fixTokenTimestampFrames(model, version) {
  if (version !== FIXED_FOR_VERSION) {
    if (!warnedVersion) {
      warnedVersion = true;
      console.warn(`transformers.js ${version} では言葉の時刻の直しをかけていません（${FIXED_FOR_VERSION} 用）。本物の曲で答え合わせ（npm run eval）を確かめてください`);
    }
    return false;
  }
  const original = model?._extract_token_timestamps;
  if (typeof original !== 'function') return false;
  if (original.__lyrivueFixed) return true;
  const fixed = function (outputs, alignmentHeads, numFrames, ...rest) {
    const half = numFrames == null ? numFrames : Math.floor(numFrames / 2);
    return original.call(this, outputs, alignmentHeads, half, ...rest);
  };
  fixed.__lyrivueFixed = true;
  model._extract_token_timestamps = fixed;
  return true;
}
