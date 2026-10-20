// 世界の背景（雰囲気 S）：場面の「世界」（director/worlds.js）ごとの背景。layer.kind が世界の id。
// 地を世界の配色（env.ink.bg）で塗ってから、世界ごとの形（render/parts/worlds/）を描く。
// 形には、画面に貼る物（空の色・方眼・フィルムの穴）と、世界に固定してカメラで映す物（雲・ビル・葉。視差が出る）がある。
// 背景は文字を邪魔しない濃さに抑え、世界ごとに 1 つだけ強い印象を置く。
import { WORLD_DRAW, OWNS_BG } from './worlds/index.js';
import { clamp01 } from '../timing.js';

const MIN_SIDE = 16; // 短い辺がこれより小さい画面は地だけ塗る（模様の間隔が 1 画素未満になって命令が増えすぎるため）
const FALLBACK = { bg: '#000000', fg: '#f4f4f4', line: '#888888', accent: '#ffffff', light: false };

export function fxWorld(ctx, t, layer, scene, env) {
  const draw = WORLD_DRAW[layer?.kind];
  if (!draw) return;
  const w = env?.width, h = env?.height;
  if (!(w > 0 && h > 0 && Number.isFinite(w) && Number.isFinite(h))) return; // 無限大の画面は繰り返しが終わらないので描かない
  const ink = env.ink && typeof env.ink.bg === 'string' ? env.ink : FALLBACK;
  const cam = env.cam && Array.isArray(env.cam.pos) && env.cam.pos.every(Number.isFinite) && typeof env.project === 'function' ? env.cam : null;
  const s = Math.min(w, h);
  const k = {
    t: Number.isFinite(t) ? t : 0, w, h, s, lw: Math.max(0.75, s * 0.0025), ink, env, cam,
    beatK: env.beat?.index >= 0 && Number.isFinite(env.beat.phase) ? 1 - clamp01(env.beat.phase) : 0,
    i: clamp01(env.intensity), lite: !!env.lite,
  };
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  // 地：自分で画面いっぱいに色の移り変わりを塗る世界（OWNS_BG）は、二度塗りしない（重さ対策）
  if (!OWNS_BG.has(layer.kind) || s < MIN_SIDE) { ctx.fillStyle = ink.bg; ctx.fillRect(0, 0, w, h); }
  if (s < MIN_SIDE) return;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  draw(ctx, k);
}
