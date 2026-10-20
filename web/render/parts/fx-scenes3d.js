// 間奏の場面展開の景色（雰囲気 S。台本係 director/interlude-scenes.js）。立体の空間の見本（app/space-check.js Version 8）と同じ描き方：
// fx.rings＝光の輪のトンネル（道すじに並んだ輪をくぐる）・fx.corridor＝枠の通路（四角い枠と壁の模様の看板）・
// fx.nest＝平面の模様だけ（入れ子の四角が大きくなり、奥へ吸い込まれる）。色は場面の配色（env.ink）。
import { drawGeo } from './geo/index.js';
import { fxGeo } from './fx-geo.js';

const RING_R = 1.25, RING_PTS = 24, RING_FAR = 26, RING_STEP = 0.9;
const CW = 1.4, CH = 0.9, FRAME_FAR = 24, FRAME_STEP = 1.2;
const NEST_SPEED = 3.2; // 平面の模様が奥へ進む速さ（間奏のカメラの速さと同じ）

const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const okSize = env => env?.width > 0 && env?.height > 0 && Number.isFinite(env.width) && Number.isFinite(env.height);

// 輪や枠は道すじに沿って置かず、カメラの前にまっすぐ並べて、進んだ道のりのぶんだけ近づける（間奏の後半は道すじが次の行へ曲がるので、
// 道に沿って置くと列がカメラの前から外れた）。カメラの傾き（roll）は映すときに効くので、曲がるときの傾きは輪・枠の傾きとして見える

/** 時刻 t までに進んだ道のり。layer.track = [[時刻, 道のり], …]。表の外は端の速さで伸ばす */
export function distAt(track, t) {
  const tr = (Array.isArray(track) ? track : []).filter(x => Array.isArray(x) && Number.isFinite(x[0]) && Number.isFinite(x[1]));
  if (!tr.length || !Number.isFinite(t)) return 0;
  if (tr.length === 1) return tr[0][1];
  let i = 0;
  while (i < tr.length - 2 && tr[i + 1][0] <= t) i++;
  const [t0, d0] = tr[i], [t1, d1] = tr[i + 1];
  const v = t1 > t0 ? (d1 - d0) / (t1 - t0) : 0;
  if (t < tr[0][0]) return tr[0][1];
  return d0 + v * (t - t0);
}

// カメラの前の向き・横・上（傾きは入れない）
function camAxes(cam) {
  const yaw = cam.yaw ?? 0, pitch = cam.pitch ?? 0;
  const f = [Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)], right = [Math.cos(yaw), 0, -Math.sin(yaw)];
  return { f, right, up: cross(f, right) };
}
const glowOf = env => Math.exp(-Math.min(1, Math.max(0, env.beat?.phase ?? 0)) * 3);
const beatIndex = env => (Number.isFinite(env.beat?.index) ? env.beat.index : 0);

/** 光の輪のトンネル：0.9 ごとの輪を、前の 26 まで遠い順に。4 つに 1 つは太い色の輪、細い輪は破線。拍に合わせて 1 つずつ光る。輪は 1 つごとに少し回してある */
export function fxRings(ctx, t, layer, scene, env) {
  const cam = env?.cam;
  if (!okSize(env) || !Array.isArray(cam?.pos) || typeof env.project !== 'function') return;
  const S = Math.min(env.width, env.height), { f, right, up } = camAxes(cam);
  const ink = env.ink ?? {}, fg = ink.fg ?? '#F4F4F4', accent = ink.accent ?? fg, glow = glowOf(env), bi = beatIndex(env);
  const d = distAt(layer.track, t), first = Math.floor(d / RING_STEP);
  ctx.lineCap = 'round';
  for (let n = first + Math.floor(RING_FAR / RING_STEP); n >= first; n--) {
    const z = n * RING_STEP - d;
    if (z < 0.05 || z > RING_FAR) continue;
    const c = cam.pos.map((v, q) => v + f[q] * z), big = n % 4 === 0;
    const ps = [];
    for (let k = 0; k <= RING_PTS; k++) {
      const a = (k / RING_PTS) * Math.PI * 2 + n * 0.26;
      ps.push(env.project(c.map((v, q) => v + (right[q] * Math.cos(a) + up[q] * Math.sin(a)) * RING_R)));
    }
    const fade = Math.max(0, 1 - z / RING_FAR);
    const lit = ((n % 8) + 8) % 8 === ((bi % 8) + 8) % 8 ? glow : 0;
    ctx.strokeStyle = big || lit > 0.3 ? accent : fg;
    for (let k = 0; k < RING_PTS; k++) {
      const p = ps[k], q = ps[k + 1];
      if (!p || !q || (!big && k % 3 === 2)) continue;
      ctx.globalAlpha = Math.min(1, fade * (big ? 1 : 0.8) + lit * fade);
      ctx.lineWidth = Math.max(1, p.scale * S * (big ? 0.035 : 0.014) * (1 + lit));
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
}

/** 枠の通路：1.2 ごとの四角い枠・次の枠へつなぐ角の線と床の 2 本・3 枠ごとに左右交互の壁の模様の看板を、遠い順に。拍に合わせて 4 つに 1 つの枠が色で光る */
export function fxCorridor(ctx, t, layer, scene, env) {
  const cam = env?.cam;
  if (!okSize(env) || !Array.isArray(cam?.pos) || typeof env.project !== 'function') return;
  const S = Math.min(env.width, env.height), { f, right, up } = camAxes(cam);
  const ink = env.ink ?? {}, fg = ink.fg ?? '#F4F4F4', accent = ink.accent ?? fg, glow = glowOf(env), bi = beatIndex(env);
  const kinds = (Array.isArray(layer.kinds) ? layer.kinds : []).filter(k => typeof k === 'string');
  const d = distAt(layer.track, t), first = Math.floor(d / FRAME_STEP);
  const at = (z, x, y) => cam.pos.map((v, q) => v + f[q] * z + right[q] * x + up[q] * y);
  const items = [];
  for (let n = first; n <= first + Math.ceil(FRAME_FAR / FRAME_STEP); n++) {
    const z = n * FRAME_STEP - d;
    if (z < -1.3 || z > FRAME_FAR) continue;
    items.push({ z, n, ps: [at(z, -CW, -CH), at(z, CW, -CH), at(z, CW, CH), at(z, -CW, CH), at(z, -CW / 3, CH), at(z, CW / 3, CH)].map(p => env.project(p)) });
    if (!env.lite && kinds.length && ((n % 3) + 3) % 3 === 1 && z > -1) {
      const g = Math.floor(n / 3), side = ((g % 2) + 2) % 2 ? 1 : -1, ki = ((g % kinds.length) + kinds.length) % kinds.length;
      const board = { part: 'fx.geo', kind: kinds[ki], pos: at(z, side * CW * 0.97, 0), rot: { yaw: (cam.yaw ?? 0) - side * 1.5, pitch: 0, roll: 0 },
        act: [-1, 1e9], from: -1, to: 1e9, speed: 1.5, boardScale: 0.62, swap: !!layer.swaps?.[ki] };
      items.push({ z: z + 0.01, board });
    }
  }
  items.sort((a, b) => b.z - a.z);
  const byN = new Map(items.filter(x => x.ps).map(x => [x.n, x.ps]));
  ctx.lineCap = 'round';
  for (const it of items) {
    if (it.board) { ctx.save(); fxGeo(ctx, t, it.board, scene, { ...env, intensity: 0.75 }); ctx.restore(); continue; }
    const ps = it.ps, next = byN.get(it.n + 1), ref = ps.find(Boolean);
    if (!ref) continue;
    const fade = Math.max(0, Math.min(1, 1 - it.z / FRAME_FAR));
    const lit = ((it.n % 4) + 4) % 4 === ((bi % 4) + 4) % 4 ? glow : 0;
    const lw = Math.max(0.8, ref.scale * S * 0.006);
    if (next) {
      ctx.strokeStyle = fg; ctx.globalAlpha = 0.45 * fade; ctx.lineWidth = lw * 0.7;
      for (let k = 0; k < 6; k++) { const p = ps[k], q = next[k]; if (p && q) { ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke(); } }
    }
    ctx.strokeStyle = lit > 0.3 ? accent : fg; ctx.globalAlpha = Math.min(1, fade * (0.75 + lit)); ctx.lineWidth = lw * (1 + 1.5 * lit);
    for (let k = 0; k < 4; k++) { const p = ps[k], q = ps[(k + 1) % 4]; if (p && q) { ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke(); } }
  }
  ctx.globalAlpha = 1;
}

/** 平面の模様だけ：入れ子の四角（5 段）に背景向きの模様を交互に描き、進んだ道のりに合わせて大きくする（奥へ吸い込まれる） */
export function fxNest(ctx, t, layer, scene, env) {
  if (!okSize(env) || !Number.isFinite(t) || !Array.isArray(layer.ids) || layer.ids.length < 2) return;
  const W = env.width, H = env.height, D = Math.hypot(W, H);
  const ink = env.ink ?? {}, fg = ink.fg ?? '#F4F4F4', accent = ink.accent ?? fg, bg = ink.bg ?? '#000000';
  const beat = { index: beatIndex(env), phase: Math.min(1, Math.max(0, env.beat?.phase ?? 0)) };
  const u = Math.max(0, t - layer.from) * NEST_SPEED * 0.12, f = u - Math.floor(u);
  for (let k = env.lite ? 3 : 4; k >= 0; k--) {
    const id = k - Math.floor(u), side = D * 0.12 * 2 ** (k + f);
    const a = k === 0 ? f : 1; // いちばん小さい四角は、出てくるときだけ薄く
    const swap = ((id % 2) + 2) % 2 === 1;
    ctx.save();
    ctx.translate(W / 2, H / 2); ctx.rotate(id * 0.35);
    ctx.globalAlpha = a; ctx.fillStyle = bg; ctx.fillRect(-side / 2, -side / 2, side, side);
    ctx.beginPath(); ctx.rect(-side / 2, -side / 2, side, side); ctx.clip();
    ctx.translate(-side / 2, -side / 2);
    drawGeo(ctx, layer.ids[swap ? 1 : 0], { width: side, height: side, t: t * 1.5 + k * 3, beat, intensity: 0.7, fg: swap ? accent : fg, accent: swap ? fg : accent, bg, fade: 0.85 * a });
    ctx.restore();
    ctx.save();
    ctx.translate(W / 2, H / 2); ctx.rotate(id * 0.35);
    ctx.globalAlpha = a; ctx.strokeStyle = accent; ctx.lineWidth = Math.max(1.5, side * 0.008); ctx.strokeRect(-side / 2, -side / 2, side, side);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}
