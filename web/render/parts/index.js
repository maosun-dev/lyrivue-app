// 部品の登録表。名前 → 描く関数 (ctx, t, layer, scene, env) => void
// 部品を足すときは 1ファイル作って、ここに並べる。
import { bgGradient } from './bg-gradient.js';
import { bgPulse } from './bg-pulse.js';
import { textBounce } from './text-bounce.js';
import { textPop } from './text-pop.js';
import { textSlide } from './text-slide.js';
import { fxRing } from './fx-ring.js';
import { fxDots } from './fx-dots.js';
import { fxWave } from './fx-wave.js';
import { textMotion } from './text-motion.js';
import { bgVignette } from './bg-vignette.js';
import { fxFlash } from './fx-flash.js';
import { fxStreak } from './fx-streak.js';
import { fxRays } from './fx-rays.js';
import { fxBokeh } from './fx-bokeh.js';
import { fxDust } from './fx-dust.js';
import { fxFloor } from './fx-floor.js';
import { fxShapes } from './fx-shapes.js';
import { fxMotif } from './fx-motif.js';
import { fxDeco } from './fx-deco.js';
import { fxTunnel } from './fx-tunnel.js';
import { fxProp } from './fx-prop.js';
import { fxWorld } from './fx-world.js';
import { fxGeo } from './fx-geo.js';
import { fxTitle } from './fx-title.js';
import { bgInk, fxStars, fxSolids } from './fx-space3d.js';
import { fxOverlay } from './fx-overlay.js';
import { fxRings, fxCorridor, fxNest } from './fx-scenes3d.js';

export const PARTS = {
  'bg.gradient': bgGradient,
  'bg.pulse': bgPulse,
  'text.bounce': textBounce,
  'text.pop': textPop,
  'text.slide': textSlide,
  'fx.ring': fxRing,
  'fx.dots': fxDots,
  'fx.wave': fxWave,
  'text.motion': textMotion,
  'bg.vignette': bgVignette,
  'fx.flash': fxFlash,
  'fx.streak': fxStreak,
  'fx.rays': fxRays,
  'fx.bokeh': fxBokeh,
  'fx.dust': fxDust,
  'fx.floor': fxFloor,
  'fx.shapes': fxShapes,
  'fx.motif': fxMotif,
  'fx.deco': fxDeco,
  'fx.tunnel': fxTunnel,
  'fx.prop': fxProp,
  'fx.world': fxWorld,
  'fx.geo': fxGeo,     // 間奏の幾何学模様
  'fx.title': fxTitle, // 間奏の巨大文字（今は使わない）
  'bg.ink': bgInk,         // 間奏の地の塗り（世界の配色の地の色）
  'fx.stars': fxStars,     // 間奏の星の粒
  'fx.solids': fxSolids,   // 間奏の立体物
  'fx.rings': fxRings,     // 間奏の場面展開：光の輪のトンネル
  'fx.corridor': fxCorridor, // 間奏の場面展開：枠の通路
  'fx.nest': fxNest,       // 間奏の場面展開：平面の模様（入れ子の四角）
  'fx.overlay': fxOverlay, // 間奏の重ねる模様
};
