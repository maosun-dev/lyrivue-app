// 貼られた歌詞のテキストを行に分ける。
// 「[Verse 1]」のような行は見出しとして扱い、その後の行に見出し名と順番を付ける。

/**
 * 歌詞テキストを LyricLine の配列にする。
 * 空行は捨てる。見出しだけの行は行として数えない。
 * 見出しが出るたびに sectionIndex を1つ進める（最初の見出しが 0）。
 * 見出しより前の行は section が空文字、sectionIndex は 0。
 * 見出しより前に行があるときは、最初の見出しを 1 にする（前の行と同じ番号にして名前を消さないため）。
 * 見出しの名前は前後の空白を落とす。
 * @param {string} text
 * @returns {import('./types.js').LyricLine[]}
 */
export function parseLyrics(text) {
  const result = [];
  let sectionIndex = -1; // 最初の見出しで 0 になる
  let section = '';
  for (const raw of String(text ?? '').split('\n')) {
    const line = raw.trim(); // 全角空白も含めて前後を落とす
    if (line === '') continue;
    const heading = line.match(/^\[(.+)\]$/);
    if (heading) {
      // 見出しより前に行（曲名など）があれば、それが番号 0 の区切りなので、最初の見出しは 1 から
      sectionIndex = sectionIndex < 0 && result.length > 0 ? 1 : sectionIndex + 1;
      section = heading[1].trim(); // 「[ Verse 1 ]」→「Verse 1」
      continue;
    }
    result.push({ text: line, section, sectionIndex: Math.max(sectionIndex, 0) });
  }
  return result;
}

/**
 * 歌詞の言葉の種類（歌を聞く AI に教える）。見出しを除いた文字のうち、かな・漢字が 1 割未満なら英語。
 * 日本語の AI のまま英語の歌を聞くと、カタカナに聞き違えて時刻が合わない（2026-10-20「Beyond the clouds」）
 * @param {string} text 貼った歌詞
 * @returns {'japanese'|'english'}
 */
export function lyricsLanguage(text) {
  const body = String(text ?? '').split(/\r?\n/).filter(l => !/^\s*\[.+\]\s*$/.test(l)).join('\n');
  const latin = (body.match(/[A-Za-z]/g) ?? []).length;
  const japanese = (body.match(/[\p{scx=Hiragana}\p{scx=Katakana}\p{scx=Han}]/gu) ?? []).length;
  if (latin === 0) return 'japanese';
  return japanese / (latin + japanese) < 0.1 ? 'english' : 'japanese';
}
