// 曲・歌詞・写真から MV の下ごしらえ（AnalysisResult）を作る入口。
// Whisper が失敗しても、歌詞が空でも、例外を投げずに必ず結果を返す。
import { parseLyrics } from './lyrics.js';
import { analyzeTempo } from './tempo.js';
import { beatEnergy, waveform } from './energy.js';
import { alignLyrics } from './align.js';
import { buildSections } from './sections.js';
import { extractWords, moodOf } from './words.js';
import { extractPalette } from './palette.js';
import { resample } from './audio.js';
import { fallbackAlign } from './fallback.js';

const WHISPER_RATE = 16000;
const WAVEFORM_RATE = 30; // 波形の点の数（1秒あたり）。結果の waveformRate にも入れる
const RESULT_VERSION = 1; // 結果の形の版。保存した結果を読むときに見分ける
const NO_MOOD = { night: 0, summer: 0, rain: 0, love: 0, lonely: 0 };

/**
 * @param {{mono:Float32Array, sampleRate:number, lyricsText:string, photoRgba?:Uint8ClampedArray,
 *   transcriber:{transcribe:(m:Float32Array, p?:(r:number)=>void)=>Promise<import('./types.js').AsrWord[]>},
 *   japanese:{toKana:(s:string)=>string, tokenize:(s:string)=>any[]},
 *   onProgress?:(step:string, ratio:number)=>void}} [args] 無い・一部だけでも例外は投げない
 *   （japanese が無ければ AI は呼ばずに代わりの合わせ方。transcriber が無くても同じ）
 * @returns {Promise<import('./types.js').AnalysisResult>}
 */
export async function analyzeSong(args) {
  // 引数なし・null・一部だけでも落ちないように、ここで受け取る
  const { mono: monoIn, sampleRate, lyricsText, photoRgba, transcriber, japanese, onProgress } = args ?? {};
  let mono = monoIn;
  // 進み具合の通知で落ちないようにする
  const report = (step, ratio) => { try { onProgress?.(step, ratio); } catch { /* 通知の失敗は無視 */ } };
  if (!(mono instanceof Float32Array)) {
    try { mono = Float32Array.from(mono ?? []); } catch { mono = new Float32Array(0); }
  }
  const duration = sampleRate > 0 ? mono.length / sampleRate : 0;

  // 1. 速さと拍・盛り上がり・波形（音が短すぎる等で解析できなければ、空の値で続ける）
  report('tempo', 0);
  let tempo = { bpm: 120, firstBeat: 0, beats: [] };
  let energy = [];
  let wave = [];
  try {
    tempo = analyzeTempo(mono, sampleRate);
    energy = beatEnergy(mono, sampleRate, tempo.beats);
    wave = waveform(mono, sampleRate, WAVEFORM_RATE);
  } catch {
    tempo = { bpm: 120, firstBeat: 0, beats: [] };
    energy = [];
    wave = [];
  }
  report('tempo', 1);

  let lines = [];
  try {
    const parsed = parseLyrics(lyricsText ?? '');
    if (Array.isArray(parsed)) lines = parsed;
  } catch { lines = []; }

  // 2. 歌を聞く（歌詞が無ければ呼ばない）。Whisper の失敗や「何も聞こえない」は代わりの合わせ方へ。
  // 辞書（toKana）が無いと聞き取りと歌詞を比べられないので、AI は呼ばずに代わりの合わせ方へ
  report('listen', 0);
  let asr = [];
  let usedFallback = false;
  const toKana = typeof japanese?.toKana === 'function' ? japanese.toKana : null;
  if (lines.length > 0 && !toKana) usedFallback = true;
  if (lines.length > 0 && !usedFallback) {
    try {
      asr = await transcriber.transcribe(resample(mono, sampleRate, WHISPER_RATE), r => report('listen', r));
      if (!Array.isArray(asr) || asr.length === 0) usedFallback = true;
    } catch {
      usedFallback = true;
    }
  }
  report('listen', 1);

  // 3. 歌詞に時刻を付ける
  report('align', 0);
  let timed = [];
  if (lines.length > 0) {
    try {
      timed = usedFallback ? fallbackAlign(lines, tempo.beats, energy, duration) : alignLyrics(lines, asr, toKana);
    } catch {
      // 合わせ方が失敗したら（巨大な歌詞で表が作れない等）代わりの合わせ方。それも失敗したら全行 0 秒・要確認
      usedFallback = true;
      try { timed = fallbackAlign(lines, tempo.beats, energy, duration); } catch {
        timed = lines.map(l => ({ ...l, start: 0, end: 0, confidence: 0, needsCheck: true }));
      }
    }
    timed = clampLines(timed, duration);
  }
  let sections = [];
  try { sections = buildSections(timed, duration); } catch { sections = []; }
  report('align', 1);

  // 4. 歌詞から言葉と雰囲気を取り出す
  report('words', 0);
  let words = [];
  let mood = { ...NO_MOOD };
  if (lines.length) {
    try {
      words = extractWords(timed, japanese.tokenize);
      mood = moodOf(timed, japanese.tokenize);
    } catch { words = []; mood = { ...NO_MOOD }; }
  }
  report('words', 1);

  // 5. 写真があれば色を調べる
  report('photo', 0);
  let palette = [], brightness = null, warmth = null;
  if (photoRgba && photoRgba.length >= 4) {
    try {
      const p = extractPalette(photoRgba);
      if (p.colors.length > 0) { palette = p.colors; brightness = p.brightness; warmth = p.warmth; }
    } catch { /* 写真が読めなければ写真なしと同じ */ }
  }
  report('photo', 1);

  return {
    version: RESULT_VERSION,
    duration, bpm: tempo.bpm, beats: tempo.beats, energy, sections, lines: timed,
    words, mood, palette, brightness, warmth, waveform: wave, waveformRate: WAVEFORM_RATE, usedFallback,
  };
}

/**
 * 行の時刻を 0〜曲の長さに収める（描く係は 0〜duration で描くため）。end は start 以上にする。
 * 曲の外にあって動かした行は「要確認」にする。曲の長さがわからない（0）ときは 0 以上にだけそろえる。
 * @param {import('./types.js').TimedLine[]} lines @param {number} duration
 * @returns {import('./types.js').TimedLine[]}
 */
function clampLines(lines, duration) {
  const hi = duration > 0 ? duration : Infinity;
  return lines.map(l => {
    const s0 = Number.isFinite(l.start) ? l.start : 0;
    const e0 = Number.isFinite(l.end) ? l.end : s0;
    const start = Math.min(Math.max(s0, 0), hi);
    const end = Math.min(Math.max(e0, start), hi);
    // 時刻が無い・0 より前・曲の長さより後ろだった行（start≦end のそろえ直しだけなら印は付けない）
    const moved = !Number.isFinite(l.start) || start !== s0 || end < e0;
    return { ...l, start, end, needsCheck: l.needsCheck || moved };
  });
}
