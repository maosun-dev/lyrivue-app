// 英語の歌詞の読みと言葉の区切り（japanese.js と同じ形 {toKana, tokenize}）。
// 英語には日本語の辞書（kuromoji、読み込むと約 240MB 使う）は要らないので、これで代わりにする。
// claude.ai の専用ページでは、辞書の組み立て中にページが止まって落ちた（2026-10-20「Beyond the clouds」）

/** @typedef {import('./types.js').Token} Token */

// 名詞として数えない、よく出る短い言葉（冠詞・代名詞・前置詞・助動詞など）
const COMMON = new Set(`a an the and or but so if as of at by for from in into on onto to up down out over under with without
about above after again against all along also am are be been being before behind below beneath between beyond both can
could did do does doing done each even ever every few had has have having he her here hers him his how i i'm i’m i'd i’d
im id is it its it's it’s just let me more most my myself never no not now off once one only other our ours own same she
should some still such than that their theirs them then there these they this those though through till too until very
was we were what when where which while who whom why will would yet you your yours oh ah yeah la na don't don’t can't
can’t couldn't couldn’t won't won’t gonna wanna`.split(/\s+/));

/** @returns {{toKana(text:string):string, tokenize(text:string):Token[]}} */
export function createEnglish() {
  return {
    // 英小文字と数字だけにする（japanese.js の英字の扱いと同じ）
    toKana(text) {
      return String(text ?? '').normalize('NFKC').toLowerCase().replace(/[^a-z0-9]/g, '');
    },
    tokenize(text) {
      const words = String(text ?? '').normalize('NFKC').match(/[A-Za-z0-9]+(?:['’][A-Za-z]+)?/g) ?? [];
      return words.map(surface => {
        const low = surface.toLowerCase();
        // 3 文字以上で、よく出る言葉でなければ名詞として数える（品詞は分からないので近い扱い）
        const noun = low.length >= 3 && !COMMON.has(low) && !/^\d+$/.test(low);
        return { surface, pos: noun ? '名詞' : 'その他', posDetail: noun ? '一般' : '*', reading: low.replace(/[^a-z0-9]/g, '') };
      });
    },
  };
}
