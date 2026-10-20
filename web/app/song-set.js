// いつもの 3 曲（持ち主の自作曲）：確認ページのボタン 1 つで、曲と解析結果をまとめて読み込む。
// 置き場所は公開ページの songs/（手元の eval/audio/ から公開するときに渡す。曲の写しは git には入れない）。
// 手元のサーバー（tools/serve.mjs）は songs/ を持たないので、手元では読めない（今までどおりファイルを選ぶ）
export const SONG_SET = Object.freeze([
  { id: 'shuuden', title: '終電前の月' },
  { id: 'natsu', title: '夏のしるし' },
  { id: 'beyond', title: 'Beyond the clouds' },
]);

/** 曲と解析結果の URL。base はこのファイル（app/）の場所。知らない id は null */
export function songSetUrls(id, base) {
  if (!SONG_SET.some(s => s.id === id)) return null;
  return {
    analysis: new URL(`../songs/${id}-analysis.json`, base).href,
    song: new URL(`../songs/${id}.mp3`, base).href,
  };
}
