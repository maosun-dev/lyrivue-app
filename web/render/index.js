// 描く係：台本と時刻から、その瞬間の絵を描く。同じ入力なら必ず同じ絵になる。
import { PARTS } from './parts/index.js';
import { beatAt, energyAt } from './timing.js';
import { cameraAt, project, projectPlane, VIEW_DIST } from './camera.js';
import { resolveTuning, BAR_PUNCH } from '../shared/tuning.js';
import { toneAt, toneStyle, worldInk } from './tone.js';
import { hitsAt, applyHitCamera, drawHitsPost } from './hits.js';
import { dimmed } from './parts/fx-space3d.js';
import { validVessels } from './parts/vessel-line.js';

// 主役は 1 つ（2026-10-19）：器の行を歌っている間は、ほかの行の文字と連想の小物を QUIET_LEVEL の濃さにする（前後 QUIET_RAMP 秒でなめらかに）
export const QUIET_LEVEL = 0.45;
// 連想の小物は場所の目印。文字より控えめな濃さで描く（2026-10-19 方針「主役は歌詞」：盾などの小物が文字より目立っていた）
export const PROP_LEVEL = 0.7;
const QUIET_RAMP = 0.3;
const QUIET_AFTER = 0.3; // 歌い終わってからこの秒数は薄いまま
/** 場面の中で、いま器を出している行と、ほかを薄くする濃さ k（無ければ null） */
export function quietAt(scene, t) {
  let best = null;
  for (const l of scene?.layers ?? []) {
    if (l?.part !== 'text.motion' || !Array.isArray(l.sing) || !validVessels(l.vessels).length) continue;
    const [a, b] = l.sing;
    if (!(Number.isFinite(a) && Number.isFinite(b) && t >= a && t < b + QUIET_AFTER + QUIET_RAMP)) continue;
    const ramp = Math.min(1, (t - a) / QUIET_RAMP, (b + QUIET_AFTER + QUIET_RAMP - t) / QUIET_RAMP);
    const k = 1 - (1 - QUIET_LEVEL) * Math.max(0, ramp);
    if (!best || k < best.k) best = { line: l.line, k };
  }
  return best;
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {import('../director/types.js').Script} script
 * @param {import('../analyze/types.js').AnalysisResult} analysis
 * @param {number} t 秒
 * @param {{width:number,height:number}} size 描く先の大きさ（画素）
 * @param {{lite?:boolean}} [opts] lite が true なら、飾りと文字のぼけを軽く描く（ぶれの重ね描き用。部品は env.lite で見分ける）
 */
// 強い場面とみなす強さ（director/effects.js の STRONG_FROM と同じ）。小節の頭の寄り BAR_PUNCH は shared/tuning.js
const STRONG_SCENE = 0.45;
export { BAR_PUNCH };

export function renderFrame(ctx, script, analysis, t, size, opts) {
  const { width, height } = size;
  const colors = script?.style?.colors ?? ['#ffffff', '#ffffff', '#000000'];
  ctx.save();
  ctx.fillStyle = colors[2];
  ctx.fillRect(0, 0, width, height);

  const scenes = script?.scenes ?? [];
  const sceneIndex = scenes.findIndex((s, i) => t >= s.start && (t < s.end || (i === scenes.length - 1 && t === s.end)));
  if (sceneIndex >= 0) {
    const scene = scenes[sceneIndex];
    // コマ打ち（scene.koma コマ／秒）：場面の中は時刻をコマの頭に丸めて描く（わざとカクカク動かす）
    if (scene.koma > 0 && Number.isFinite(t)) t = Math.max(scene.start, Math.floor(t * scene.koma) / scene.koma);
    const beat = beatAt(analysis?.beats, t);
    // 今の拍の長さ（秒）。拍の時刻が無ければテンポから、それも無ければ 0.5 秒
    const bs = analysis?.beats;
    const beatLen = beat.index >= 0 && bs?.[beat.index + 1] > bs?.[beat.index] ? bs[beat.index + 1] - bs[beat.index] : (analysis?.bpm > 0 ? 60 / analysis.bpm : 0.5);
    const energy = energyAt(analysis, t);
    const tune = resolveTuning(script?.tuning); // 調整値（台本に入っている。無ければ初期値）
    const cam = cameraAt(script?.camera, t);
    // 拍の頭でぐっと寄って、次の拍までに戻る（カメラのある台本だけ。強い場面ほど大きい）。
    // 毎拍の寄り punch は初期値 0（毎拍だとばくばくして効かない＝2026-10-20 持ち主と決めた）。
    // 強い場面（サビ）の小節の頭（4 拍ごと）だけ BAR_PUNCH ぶん寄る（決めどころだけ叩く）
    // 間奏の場面（流れ続けるカメラ）では寄らない（ふだんはなめらかに）
    if (script?.camera?.keys?.length && beat.index >= 0 && !scene.interlude) {
      const k = 1 - beat.phase;
      const I = scene.intensity ?? 0;
      const bar = beat.index % 4 === 0 && I >= STRONG_SCENE ? BAR_PUNCH : 0;
      cam.zoom *= 1 + (tune.punch + bar) * I * k * k * k;
    }
    const hit = hitsAt(scene, t); // 境目の一瞬の効果（揺れ・突きはカメラに、白飛び・反転・裂けは描いたあとに掛ける）
    applyHitCamera(cam, hit, t);
    // 世界のある場面は世界の配色（地の色の途中切り替えは使わない）。無ければ地の色（場面の途中で切り替わることがある＝scene.tones）
    const wink = worldInk(scene);
    const tone = wink ? (wink.light ? 'paper' : 'ink') : toneAt(scene, t);
    const ink = wink ?? toneStyle(tone, colors);
    const toScreen = p => project(cam, p, { width, height });
    const toPlane = (p, rot) => projectPlane(cam, p, rot, { width, height }); // 空間に固定した文字の板（向きを持つ）
    const quiet = quietAt(scene, t);
    (scene.layers ?? []).forEach((layer, layerIndex) => {
      const draw = PARTS[layer.part];
      if (!draw) return; // 知らない部品（古い保存データなど）は飛ばす
      if (!(t >= layer.from && (t < layer.to || (layer.to === scene.end && t === scene.end)))) return;
      // 行の手直し「位置」（layer.shift = [横, 縦]。画面の中心から端までを 1）：映したあとに画面の上でずらす（文字の板と、その行の小物）。
      // 縦長でも横長でも、画面の中で同じ割合の所に来る。sh は画素
      const sf = shiftOf(layer);
      const sh = sf ? [sf[0] * width / 2, sf[1] * height / 2] : null;
      const project = sh ? p => { const r = toScreen(p); return r && { ...r, x: r.x + sh[0], y: r.y + sh[1] }; } : toScreen;
      const projectPlane = sh ? (p, rot) => {
        const r = toPlane(p, rot);
        if (!r) return r;
        const m = [...r.m]; m[4] += sh[0]; m[5] += sh[1];
        return { ...r, m, x: r.x + sh[0], y: r.y + sh[1] };
      } : toPlane;
      const env = {
        width, height, colors, font: script?.style?.font ?? "sans-serif", intensity: scene.intensity,
        beat, beatLen, energy, u: t - layer.from, dur: layer.to - layer.from,
        text: analysis?.lines?.[layer.line]?.text ?? '',
        waveform: analysis?.waveform ?? [], waveformRate: analysis?.waveformRate || 30,
        tune, cam, camAt: time => cameraAt(script?.camera, time), project, projectPlane, shift: sh, lite: !!opts?.lite, tone, ink, viewDist: VIEW_DIST,
        layerIndex, sceneIndex, hit,
      };
      ctx.save();
      // layer.alpha（0〜1）：その層だけ薄く重ねる（間奏の景色をテーマの背景の上に半透明で）。部品が自分で決める濃さに掛ける
      let a = layer.alpha;
      if (layer.part === 'fx.prop') a = (Number.isFinite(a) && a >= 0 && a < 1 ? a : 1) * PROP_LEVEL;
      // 器を出している間は、ほかの行の文字と小物を薄く
      if (quiet && (layer.part === 'fx.prop' || (layer.part === 'text.motion' && layer.line !== quiet.line))) a = (Number.isFinite(a) && a >= 0 && a < 1 ? a : 1) * quiet.k;
      if (Number.isFinite(a) && a >= 0 && a < 1) { const c = dimmed(ctx, a); c.globalAlpha = 1; draw(c, t, layer, scene, env); }
      else draw(ctx, t, layer, scene, env);
      ctx.restore();
    });
    drawHitsPost(ctx, hit, { width, height }, t);
  }
  ctx.restore();
}

/** 層の画面の上でのずらし（[横, 縦]、画面の中心から端までを 1）。無い・壊れていれば null */
export function shiftOf(layer) {
  const v = layer?.shift;
  return Array.isArray(v) && v.length === 2 && v.every(Number.isFinite) && (v[0] || v[1]) ? v : null;
}
