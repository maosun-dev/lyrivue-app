// 曲を 15 秒ずつ（前後 3 秒重ね）に切って 1 切れずつ聞き取り係に渡し、言葉をつなぐ部分。
// iPhone アプリの whisper.cpp（ネイティブ）用。ウェブの AI（whisper-core.js の chunk_length_s 15・stride 3）と同じ切り方にして、
// 合わせ方の結果をそろえる。1 切れずつ渡すので、大きな音を一度に渡さずに済み、進み具合も切れの数で出せる。
import { dropCollapsedWords } from './asr-repair.js';

const RATE = 16000;

/**
 * 切れの範囲（秒）。各切れでは、中心が [keepStart, keepEnd) にある言葉だけ残す（重なりで二重にしないため）。
 * 最初の切れは頭から、最後の切れは終わりまで残す。
 * @param {number} duration 曲の長さ（秒）
 * @param {{len?:number, stride?:number}} [opts] len は切れの長さ、stride は片側の重なり
 * @returns {{start:number, end:number, keepStart:number, keepEnd:number}[]}
 */
export function chunkRanges(duration, { len = 15, stride = 3 } = {}) {
  const step = len - 2 * stride;
  const out = [];
  for (let start = 0; ; start += step) {
    const last = start + len >= duration;
    out.push({
      start,
      end: last ? duration : start + len,
      keepStart: start === 0 ? 0 : start + stride,
      keepEnd: last ? Infinity : start + len - stride,
    });
    if (last) return out;
  }
}

/**
 * 切って聞き、言葉ごとの時刻（曲の頭から）を返す。1 切れの失敗は飛ばして続け、全部失敗したら例外。
 * @param {Float32Array} mono16k 16kHz・1ch の音
 * @param {(chunk:Float32Array)=>Promise<{text:string,start:number,end:number}[]>} transcribeChunk 時刻は切れの頭から（秒）
 * @param {(ratio:number)=>void} [onProgress]
 * @param {(text:string)=>void} [log]
 * @returns {Promise<import('./types.js').AsrWord[]>}
 */
export async function transcribeInChunks(mono16k, transcribeChunk, onProgress, log = () => {}) {
  const ranges = chunkRanges(mono16k.length / RATE);
  const words = [];
  let failed = 0, lastError = null;
  onProgress?.(0);
  for (const [i, r] of ranges.entries()) {
    try {
      const got = await transcribeChunk(mono16k.subarray(Math.round(r.start * RATE), Math.round(r.end * RATE)));
      for (const w of got ?? []) {
        const text = String(w?.text ?? '').trim();
        const start = r.start + Number(w?.start), end = Math.max(start, r.start + Number(w?.end));
        // 記号だけの語（♪ など、音楽を歌と聞き違えたもの）は捨てる
        if (!Number.isFinite(start) || !/[\p{L}\p{N}]/u.test(text)) continue;
        const mid = (start + end) / 2;
        if (mid >= r.keepStart && mid < r.keepEnd) words.push({ text, start, end });
      }
    } catch (e) {
      failed++;
      lastError = e;
      log(`AI：${i + 1}/${ranges.length} 切れ目を聞けなかった（${e?.message ?? e}）`);
    }
    onProgress?.((i + 1) / ranges.length);
  }
  if (failed === ranges.length) throw lastError;
  // 時刻がつぶれた言葉は捨てる（asr-repair.js）
  return dropCollapsedWords(words);
}
