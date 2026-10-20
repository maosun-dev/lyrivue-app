// 幾何学模様（間奏の場面に出す）100 種類の一覧と、1 つを描く入口。
// 系統：放射・格子・曲線・立体・線・敷き詰め（和柄の線画を含む）。設計：docs/superpowers/specs/2026-10-20-interlude-design.md
import { RADIAL } from './radial.js';
import { GRID } from './grid.js';
import { CURVES } from './curves.js';
import { SOLID } from './solid.js';
import { LINES } from './lines.js';
import { TILES } from './tiles.js';
import { clamp01 } from './kit.js';

export const GEO_GROUPS = { radial: '放射', grid: '格子', curve: '曲線', solid: '立体', line: '線', tile: '敷き詰め' };
// 真ん中にまとまる形（縁まで線が届かない）：画面のあちこちに大小ばらばらに「置く」のに使える。
// 2026-10-20 に 100 種を描いて、縁（半径の 92% より外）に線が来る割合を測って選んだ（縁まで広がる形は、置くと □ の箱が見えて不自然）。
// それ以外は「背景向き」（画面いっぱいに敷く）
export const GEO_SPOT_IDS = new Set([
  'sun-wheel', 'mandala', 'clock-ticks', 'sonar', 'flower-of-life', 'rose', 'segment-ring', 'gear', 'ripple-dots', 'supershape', 'string-art',
  'epicycles', 'audio-ring', 'globe', 'orbit-rings', 'phyllotaxis', 'octa-twin', 'nested-diamond', 'spokes-arcs', 'pyramid', 'pulse-rings',
  'cardioid', 'spiral-arms', 'torus', 'star-spin', 'globe-glow', 'contour', 'lissajous', 'tetra-swarm', 'helix', 'harmonograph', 'infinity',
  'spirograph', 'ring-cylinder', 'tesseract', 'cube-lattice', 'cube-spin', 'icosa', 'cube-nest', 'nest-poly',
]);
export const GEOS = [
  ...RADIAL.map(g => ({ ...g, group: 'radial' })), ...GRID.map(g => ({ ...g, group: 'grid' })),
  ...CURVES.map(g => ({ ...g, group: 'curve' })), ...SOLID.map(g => ({ ...g, group: 'solid' })),
  ...LINES.map(g => ({ ...g, group: 'line' })), ...TILES.map(g => ({ ...g, group: 'tile' })),
].map(g => ({ ...g, spot: GEO_SPOT_IDS.has(g.id) }));
const BY_ID = new Map(GEOS.map(g => [g.id, g]));
export const geoById = id => BY_ID.get(id);

/**
 * 幾何学模様を 1 つ描く。描く前後で ctx の状態を戻す。知らない id・おかしな大きさなら何もしない。
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} id
 * @param {{width:number, height:number, t:number, beat?:{index:number, phase:number}, intensity?:number, fg?:string, accent?:string, bg?:string, seed?:number, fade?:number}} env
 *   fade（0〜1）は全体の濃さの倍率（場面の頭と終わりで上げ下げする。模様が決める濃さに掛ける）
 */
export function drawGeo(ctx, id, env) {
  const g = BY_ID.get(id);
  const w = env?.width, h = env?.height;
  if (!g || !(w > 0 && h > 0) || !Number.isFinite(w) || !Number.isFinite(h)) return;
  const beat = env.beat ?? {};
  // 模様は小節（4 拍）ごとに反応させる：beat は「小節の番号と小節の中の進み」に直して渡す。
  // 毎拍だとどの模様もばくばくして効かない（2026-10-20 持ち主と決めた：ふだんはなめらかに、決めどころだけ叩く）
  const bi = Number.isFinite(beat.index) ? beat.index : 0, bp = clamp01(beat.phase);
  const bar = { index: Math.floor(bi / 4), phase: ((bi % 4 + 4) % 4 + bp) / 4 };
  const e = {
    w, h, S: Math.min(w, h), cx: w / 2, cy: h / 2,
    t: Number.isFinite(env.t) ? env.t : 0,
    beat: bar,
    energy: clamp01(env.intensity ?? 0.5),
    fg: env.fg ?? '#F4F4F4', accent: env.accent ?? '#FF3E7F', bg: env.bg ?? '#000', seed: Number.isFinite(env.seed) ? env.seed : 0,
  };
  const fade = env.fade === undefined ? 1 : clamp01(env.fade);
  if (!(fade > 0)) return;
  // 模様は濃さ（globalAlpha）を自分で決めるので、薄めるときは代入のたびに倍率を掛ける窓口を通して描く
  const c = fade < 1 ? new Proxy(ctx, {
    get: (o, k) => { const v = o[k]; return typeof v === 'function' ? v.bind(o) : (k === 'globalAlpha' ? v / fade : v); },
    set: (o, k, v) => { o[k] = k === 'globalAlpha' ? v * fade : v; return true; },
  }) : ctx;
  if (fade < 1) ctx.globalAlpha = fade;
  ctx.save();
  try { g.draw(c, e); } finally {
    ctx.setLineDash?.([]);
    ctx.restore();
  }
}
