// 確認ページ用：歌詞で埋める組みが出る所へ飛ぶ（2026-10-19 持ち主「埋める仕組みは動画を見ないとよくわからん」）。
// 台本（消した演出・直した行を反映したもの）から、埋める組みの入った行の歌い出しを集める
import { FLOOD_BY_ID, FLOOD_CATS } from '../render/parts/flood.js';

export const JUMP_LEAD = 0.5; // 歌い出しのこの秒数前へ飛ぶ（出てくる所から見えるように）
const EPS = 0.05;

/** 埋める組みの出る所の一覧（時刻順）。{ t：歌い出し, at：飛ぶ先, id, name, cat, line } */
export function floodMoments(script) {
  const out = [];
  for (const sc of script?.scenes ?? []) for (const l of sc.layers ?? []) {
    if (l.part !== 'text.motion' || !l.flood || !Array.isArray(l.sing) || !Number.isFinite(l.sing[0])) continue;
    const f = FLOOD_BY_ID[l.flood];
    out.push({ t: l.sing[0], at: Math.max(0, l.sing[0] - JUMP_LEAD), id: l.flood, name: f?.name ?? l.flood, cat: FLOOD_CATS[f?.cat] ?? '', line: l.line });
  }
  return out.sort((a, b) => a.t - b.t);
}

/** いまの時刻から、次（dir 1）・前（dir -1）の所。無ければ null */
export function jumpTarget(list, now, dir) {
  if (dir > 0) return list.find(m => m.at > now + EPS) ?? null;
  for (let k = list.length - 1; k >= 0; k--) if (list[k].at < now - EPS) return list[k];
  return null;
}

/** いまが何番目の所か（1 から。最初の所より前なら 0） */
export function momentIndex(list, now) {
  let n = 0;
  list.forEach((m, k) => { if (m.at <= now + EPS) n = k + 1; });
  return n;
}
