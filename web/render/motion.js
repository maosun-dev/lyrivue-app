// 移動のぶれ：カメラが速く動く瞬間だけ、時刻を少しずつずらして数回描き、重ねて平均する。
// 描く係は「同じ入力なら同じ絵」なので、ずらして描いて重ねるだけで、動いた方向の筋になる。
import { renderFrame } from './index.js';
import { cameraAt } from './camera.js';

const SHUTTER = 1 / 30;    // ぶれにする時間の幅（秒）
const SPEED_STEP = 0.5;    // 速さ 2 ごとに重ねる回数を 1 増やす
const MAX_SAMPLES = 7;

/** t のカメラの動きの速さ（1 秒あたり）。位置の移動量 + 回転 × 0.5 + 拡大の変化。camera が無ければ 0 */
export function cameraSpeed(script, t) {
  const cam = script?.camera;
  if (!cam?.keys?.length || !Number.isFinite(t)) return 0;
  const dt = 1 / 60;
  const a = cameraAt(cam, t - dt / 2);
  const b = cameraAt(cam, t + dt / 2);
  const move = Math.hypot(b.pos[0] - a.pos[0], b.pos[1] - a.pos[1], b.pos[2] - a.pos[2]);
  const turn = (Math.abs(b.yaw - a.yaw) + Math.abs(b.pitch - a.pitch)) * 1.2; // 向きの回転（距離 1.2 ぶんに換算）
  return (move + Math.abs(b.roll - a.roll) * 0.5 + Math.abs(b.zoom - a.zoom) + turn) / dt;
}

/** 速さから重ねる回数（1〜7）を決める */
export function motionSamples(speed) {
  if (!Number.isFinite(speed)) return 1;
  return Math.min(MAX_SAMPLES, Math.max(1, Math.round(speed * SPEED_STEP)));
}

/**
 * renderFrame と同じ引数に、重ね先の画面を作る関数を渡して使う。
 * makeCanvas(width, height) は { canvas, ctx } を返す（同じ大きさなら使い回してよい）。
 * 重ねる必要がない・makeCanvas が無い・大きさが不正なときは、普通に1回描く。
 */
export function renderFrameMotion(ctx, script, analysis, t, size, opts) {
  const makeCanvas = opts?.makeCanvas;
  const n = motionSamples(cameraSpeed(script, t));
  const okSize = size?.width > 0 && size?.height > 0 && Number.isFinite(size.width) && Number.isFinite(size.height);
  if (n === 1 || typeof makeCanvas !== 'function' || !okSize) {
    renderFrame(ctx, script, analysis, t, size);
    return;
  }
  const scratch = makeCanvas(size.width, size.height);
  ctx.save();
  for (let s = 0; s < n; s++) {
    const ts = Math.max(0, t - SHUTTER * (1 - s / (n - 1)));
    renderFrame(scratch.ctx, script, analysis, ts, size, { lite: true }); // 重ねる絵は軽い版で描く（飾りが7倍にならないように）
    ctx.globalAlpha = 1 / (s + 1); // 逐次の平均になる（s 枚目を 1/(s+1) の濃さで重ねる）
    ctx.drawImage(scratch.canvas, 0, 0);
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}
