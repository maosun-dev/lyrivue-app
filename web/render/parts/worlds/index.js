// 世界の背景の登録表。世界の id（director/worlds.js）→ 描く関数 (ctx, k)。tunnel・void はここに無い（別の部品で描く）
import { sky, paper, news, water, stars, chalk, leaves, rainWindow } from './calm.js';
import { hud, pop, neon, kaleido, game } from './loud.js';
import { mono, city, blueprint, film, sunset } from './mid.js';

/** 地を自分で塗る世界（画面いっぱいの色の移り変わりで地を塗るので、fx.world は地の色を塗らない） */
export const OWNS_BG = new Set(['sky', 'water', 'window', 'sunset']);

export const WORLD_DRAW = {
  sky, hud, paper, pop, mono, city, news, neon, water, stars, blueprint, film, chalk, leaves, kaleido, window: rainWindow, game, sunset,
};
