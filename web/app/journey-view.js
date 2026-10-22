// 見る段の旅程と旅の帯（2026-10-22 画面の作り直し。docs/superpowers/specs/2026-10-22-app-ui-redesign-design.md）。
// 台本の場面を「場所ごとの行」にまとめる。画面に触らない部品なので node の試験で確かめる
import { WORLDS, sectionKind } from '../director/worlds.js';
import { PLACE_NAMES } from '../director/edits.js';

const NO_COLOR = '#4A4A4D'; // 世界のない場面（灰）

/** 世界の見本の 3 色。知らない世界は null */
export function worldSwatch(id) {
  const w = WORLDS.find(x => x.id === id);
  const p = w?.palette?.(['#5B8CFF']);
  return p ? { bg: p.bg, line: p.line, accent: p.accent } : null;
}

/**
 * 旅程の行。続けて同じ世界の場面は 1 行にまとめ、同じ世界が何回目に出てきたかを数える。
 * @returns {{index:number,start:number,end:number,world:string|null,name:string,kind:string|null,kindLabel:string,color:string,visit:number,changeable:boolean}[]}
 */
export function journeyRows(script) {
  const scenes = Array.isArray(script?.scenes) ? script.scenes : [];
  const rows = [];
  for (const sc of scenes) {
    const world = sc.world ?? null;
    const last = rows.at(-1);
    if (last && last.world === world) { last.end = sc.end; continue; }
    const kind = sectionKind(sc.section);
    rows.push({
      index: rows.length, start: sc.start, end: sc.end, world,
      name: WORLDS.find(w => w.id === world)?.name ?? '間奏',
      kind,
      kindLabel: kind ? PLACE_NAMES[kind] : rows.length === 0 ? 'はじまり' : '間奏',
      color: worldSwatch(world)?.accent ?? NO_COLOR,
      visit: rows.filter(r => r.world === world).length + 1,
      changeable: kind === 'verse' || kind === 'bridge' || kind === 'chorus',
    });
  }
  return rows;
}

/** t 秒を含む行の番号。最後の行は終わりちょうども含む。無ければ -1 */
export function rowAt(rows, t) {
  return rows.findIndex((r, i) => t >= r.start && (t < r.end || (i === rows.length - 1 && t === r.end)));
}
