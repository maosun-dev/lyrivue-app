// 共通の型定義（JSDoc のみ。実行時には何もしない）

/** @typedef {{text:string, start:number, end:number}} AsrWord  聞き取った言葉（秒） */
/** @typedef {{text:string, section:string, sectionIndex:number}} LyricLine  貼った歌詞の1行。sectionIndex は区切りの番号（0から。見出しより前に行があればそれが 0、最初の見出しは 1） */
/** @typedef {LyricLine & {start:number, end:number, confidence:number, needsCheck:boolean}} TimedLine */
/** @typedef {{name:string, index:number, start:number, end:number}} Section */
/** @typedef {{surface:string, pos:string, posDetail:string, reading:string}} Token  kuromoji の1語（reading はひらがな、posDetail は pos_detail_1） */
/**
 * analyzeSong の結果。2段階目（台本係・描く係）はこの形と下の約束だけを見て作る。
 * 時刻はすべて秒（曲の頭が 0）。
 * - version：結果の形の版（今は 1）。保存した結果を読むときに見分ける
 * - beats：拍の時刻。beats[0] は 0 秒ではなく「最初の拍」（前奏の頭が拍とは限らない）
 * - energy：拍ごとの盛り上がり（0〜1）。energy[i] は beats[i] から beats[i+1] まで
 *   （最後は曲の終わりまで）の値で、beats と同じ長さ
 * - waveform：波形の点（0〜1）。1秒に waveformRate 点（今は 30）。i 番目の点は i / waveformRate 秒から
 * - sections：最初の歌の行から始まる。前奏（最初の行より前）は区切りに入らない。
 *   最後の区切りの end は duration。どの区切りも end ≧ start
 * - lines：start・end は 0〜duration に収める（duration が 0 のときは 0 以上だけ）。start は増えていく順。
 *   needsCheck が true の行は位置が推測（一致が少ない・推測で置いた・曲の外から戻した・AI なし）
 * - palette：写真が無い・読めないときは空配列（brightness・warmth は null）
 * - usedFallback：AI（または辞書）が使えず、代わりの合わせ方にしたとき true（全行 needsCheck）
 * @typedef {{version:number, duration:number, bpm:number, beats:number[], energy:number[], sections:Section[], lines:TimedLine[], words:string[], mood:Object<string,number>, palette:string[], brightness:number|null, warmth:number|null, waveform:number[], waveformRate:number, usedFallback:boolean}} AnalysisResult
 */

export {};
