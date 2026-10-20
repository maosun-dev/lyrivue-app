// 確認ページ用の見本の解析結果（60秒・架空の歌詞。言葉の演出が見えるよう、雨・風・月・光・花火・星を入れてある）。ファイルを選ばなくても台本と絵を見られるようにする。
// 本物の解析結果と同じ形（analyze/types.js の AnalysisResult、version 1）。
export function makeDemoAnalysis() {
  const duration = 60;
  const beatLen = 0.5; // 120 BPM
  const beats = [];
  for (let t = 0.5; t < duration; t += beatLen) beats.push(Number(t.toFixed(3)));
  // 盛り上がり：Aメロは低め、サビは高め
  const energy = beats.map(t => (t >= 24 && t < 48 ? 0.85 : t >= 4 && t < 24 ? 0.35 : 0.2));
  const L = (text, section, sectionIndex, start, end) => ({ text, section, sectionIndex, start, end, confidence: 1, needsCheck: false });
  const lines = [
    L('夜の街を 走り抜けて', 'Verse 1', 1, 4, 9),
    L('雨のなかの 帰り道', 'Verse 1', 1, 9, 14),
    L('風の中 時計が鳴る', 'Verse 1', 1, 14, 19),
    L('階段で 月を見上げた', 'Verse 1', 1, 19, 24),
    L('電車の窓から 光のほうへ', 'Chorus', 2, 24, 30),
    L('まだ終わらない', 'Chorus', 2, 30, 36),
    L('花火みたいな この歌が', 'Chorus', 2, 36, 42),
    L('星まで届く', 'Chorus', 2, 42, 48),
    L('ありがとう', 'Outro', 3, 50, 56),
  ];
  const sections = [
    { name: 'Verse 1', index: 1, start: 4, end: 24 },
    { name: 'Chorus', index: 2, start: 24, end: 48 },
    { name: 'Outro', index: 3, start: 48, end: duration },
  ];
  const waveformRate = 30;
  const waveform = Array.from({ length: duration * waveformRate }, (_, i) => {
    const t = i / waveformRate;
    const base = t >= 24 && t < 48 ? 0.7 : 0.35;
    return Math.min(1, Math.max(0, base * (0.6 + 0.4 * Math.abs(Math.sin(t * Math.PI * 2 * 2)))));
  });
  return {
    version: 1, duration, bpm: 120, beats, energy, sections, lines,
    words: ['夜', '光', '歌'], mood: { night: 0.6 }, palette: [], brightness: null, warmth: null,
    waveform, waveformRate, usedFallback: false,
  };
}
