// 見る段の「テーマ」：18 の世界をしぼった、おすすめの組み合わせ。
// 旅の組み立て（director/worlds.js の planJourney）は A メロ＝静か・つなぎ＝中くらい・サビ＝派手 の世界を 1 つずつ選ぶので、
// どのテーマにも 3 つの性格がそろうようにしてある。細かい選びは「作る側の道具」の「使う世界」で。
import { WORLDS } from '../director/worlds.js';

const ALL = WORLDS.map(w => w.id);

export const THEMES = Object.freeze([
  { id: 'omakase', name: 'おまかせ', note: '18 の世界から', worlds: null },
  { id: 'warm', name: '紙と夕焼け', note: '紙・黒板・影絵', worlds: ['paper', 'news', 'chalk', 'film', 'sunset', 'pop'] },
  { id: 'night', name: '夜の光', note: '雨の窓・星・街', worlds: ['window', 'stars', 'water', 'city', 'blueprint', 'neon', 'hud'] },
  { id: 'play', name: 'あそび', note: '網点・図形・ゲーム', worlds: ['chalk', 'leaves', 'mono', 'sunset', 'pop', 'game', 'kaleido'] },
]);

/** テーマで使う世界（WORLDS の順）。知らない名前・おまかせは全部 */
export function themeWorlds(id) {
  const t = THEMES.find(x => x.id === id);
  return t?.worlds ? ALL.filter(w => t.worlds.includes(w)) : [...ALL];
}

/** いまの世界の選びがどのテーマか（順番は問わない）。どれでもなければ null */
export function themeOf(worlds) {
  if (!Array.isArray(worlds)) return null;
  const set = new Set(worlds);
  return THEMES.find(t => {
    const ws = themeWorlds(t.id);
    return ws.length === set.size && ws.every(w => set.has(w));
  })?.id ?? null;
}
