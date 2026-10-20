// 飾り（雰囲気 S）：歌詞の言葉から連想する景色（言葉の演出）。絵ではなく、線・光・粒の形と動きで表す。
// layer.kind：rain（雨）・snow（雪）・petal（花びら）・ember（火の粉）・wind（風）・star（星と流れ星）・
//             firework（花火）・sea（波）・light（差し込む光）・moon（月）・heart（鼓動の輪）
// 粒は世界に固定して流す（カメラが動くと視差で流れる）。layer.near が true なら文字より手前の粒だけ、そうでなければ奥だけ。
// 出番の頭 0.8 秒で現れ、終わり 0.8 秒で消える。
import { hash01 } from '../rand.js';
import { clamp01, easeOutCubic } from '../timing.js';
import { project, forwardOf } from '../camera.js';
import { tileNear, edgeFade, strokeWorld } from './space-common.js';

const FADE = 0.8;
const fract = x => x - Math.floor(x);

// 種類ごとの色（暗い地／明るい地）
const TINT = {
  rain: ['#a8d0ff', '#33557a'], snow: ['#ffffff', '#6d7a88'], petal: ['#ffb7cf', '#c9577c'], ember: ['#ff9a3c', '#c0461a'],
  wind: ['#dfe9ff', '#4a5260'], star: ['#fff4cf', '#6b5a2a'], sea: ['#59c7ff', '#1f6f9a'], light: ['#fff1c4', '#c9a040'],
  moon: ['#fff6dc', '#8c7a4a'], heart: ['#ff5d8a', '#c2264f'],
};
const FIREWORK = ['#ff5d73', '#ffd23f', '#5ef0ff', '#b98cff', '#7dff9a'];

// 粒の場：番号 i の粒が、速度 v（世界の単位／秒）で流れる。箱を敷き詰めて写すので、どこまで流れても途切れない
function fieldPoint(cam, i, salt, v, t, cell, ahead) {
  const base = [0, 1, 2].map(k => fract(hash01(i, salt, k) + (v[k] * t) / cell));
  return tileNear(cam, base, cell, ahead);
}

export function fxMotif(ctx, t, layer, scene, env) {
  const { width: w, height: h, cam } = env;
  if (!(w > 0 && h > 0) || !cam?.pos || typeof env.project !== 'function') return;
  const life = clamp01((t - layer.from) / FADE) * clamp01((layer.to - t) / FADE);
  if (!(life > 0)) return;
  const kind = layer.kind;
  const light = env.ink ? env.ink.light : env.tone === 'paper';
  const tint = (TINT[kind] ?? TINT.light)[light ? 1 : 0];
  const short = Math.min(w, h);
  const intensity = clamp01(env.intensity);
  ctx.globalCompositeOperation = light ? 'source-over' : 'lighter';
  ctx.fillStyle = tint;
  ctx.strokeStyle = tint;
  ctx.lineCap = 'round';
  const near = !!layer.near;
  const split = env.viewDist ?? 1.2;
  const lite = !!env.lite;
  const sideOk = s => s && (s.dz < split) === near;
  const D = { ctx, t, w, h, cam, env, life, tint, short, intensity, light, lite, sideOk, kind };
  switch (kind) {
    case 'rain': return particles(D, { count: 170, v: [0.3, 4.2, 0], salt: 61, streak: 0.12, r: 0.006, a: 0.8 });
    case 'snow': return particles(D, { count: 110, v: [0.1, 0.35, 0], sway: 0.25, salt: 62, r: 0.012, a: 0.85, soft: true });
    case 'petal': return particles(D, { count: 70, v: [0.35, 0.45, 0.1], sway: 0.3, salt: 63, r: 0.02, a: 0.9, petal: true });
    case 'ember': return particles(D, { count: 90, v: [0.05, -0.7, 0], sway: 0.15, salt: 64, r: 0.007, a: 0.95, flicker: true, soft: true });
    case 'wind': return particles(D, { count: 80, v: [2.6, 0.1, 0], salt: 65, streak: 0.4, r: 0.012, a: 0.7 });
    case 'star': if (!near) stars(D); return;
    case 'firework': if (!near) fireworks(D); return;
    case 'sea': if (!near) sea(D); return;
    case 'light': if (!near) sunlight(D); return;
    case 'moon': if (!near) moon(D); return;
    case 'heart': if (!near) heartbeat(D); return;
    default:
  }
}

function particles(D, o) {
  const { ctx, t, cam, env, life, short, lite, sideOk } = D;
  const n = Math.round(o.count * (0.7 + 0.5 * D.intensity) * (lite ? 0.5 : 1));
  const dt = o.streak ?? 0;
  for (let i = 0; i < n; i++) {
    const sway = o.sway ? [Math.sin(t * 1.3 + i) * o.sway, 0, Math.cos(t * 0.9 + i) * o.sway * 0.5] : [0, 0, 0];
    const { p, edge } = fieldPoint(cam, i, o.salt, o.v, t, 5, 2.2);
    const q = [p[0] + sway[0] * 0.2, p[1], p[2] + sway[2] * 0.2];
    const s = project(cam, q, env);
    if (!sideOk(s)) continue;
    const fog = clamp01(1 - (s.dz - 1) / 3.5);
    let a = life * edgeFade(edge) * (0.3 + 0.7 * fog) * o.a * (0.5 + 0.5 * hash01(i, o.salt, 9));
    if (o.flicker) a *= 0.5 + 0.5 * Math.sin(t * 13 + i * 2.1);
    if (!(a > 0.01)) continue;
    const r = Math.min(short * 0.05, (o.r * (0.6 + 0.8 * hash01(i, o.salt, 8))) * s.scale * short);
    ctx.globalAlpha = Math.min(1, a);
    if (dt > 0) { // 流れる向きに伸びた線（雨・風）
      const tail = project(cam, [q[0] - o.v[0] * dt, q[1] - o.v[1] * dt, q[2] - o.v[2] * dt], env);
      if (!tail) continue;
      ctx.lineWidth = Math.max(1, r * 2); // 細すぎると見えないので最低 1 画素
      ctx.beginPath();
      ctx.moveTo(tail.x, tail.y);
      ctx.lineTo(s.x, s.y);
      ctx.stroke();
    } else if (o.petal) { // 花びら：くるくる回る小さな楕円
      ctx.beginPath();
      ctx.ellipse(s.x, s.y, Math.max(0.8, r), Math.max(0.5, r * 0.45 * Math.abs(Math.sin(t * 2.2 + i))) + 0.3, t * 1.7 + i, 0, Math.PI * 2);
      ctx.fill();
    } else if (o.soft && r > 2.5) { // 大きい粒はやわらかい丸
      const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, r * 1.6);
      g.addColorStop(0, D.tint);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(s.x, s.y, r * 1.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = D.tint;
    } else {
      ctx.beginPath();
      ctx.arc(s.x, s.y, Math.max(0.6, r), 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// 星：遠くでまたたく点と、ときどき流れる流れ星
function stars(D) {
  const { ctx, t, cam, env, life, short, lite } = D;
  const n = lite ? 60 : 130;
  for (let i = 0; i < n; i++) {
    const { p, edge } = fieldPoint(cam, i, 71, [0, 0, 0], t, 16, 9);
    const s = project(cam, p, env);
    if (!s || s.dz < 3) continue;
    const tw = 0.4 + 0.6 * Math.abs(Math.sin(t * (1 + 2 * hash01(i, 72)) + i));
    ctx.globalAlpha = Math.min(1, life * edgeFade(edge) * tw);
    const r = Math.max(0.7, short * (0.002 + 0.004 * hash01(i, 73)));
    ctx.beginPath();
    ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
    ctx.fill();
    if (hash01(i, 74) > 0.9) { // 明るい星は十字に光る
      ctx.lineWidth = Math.max(0.5, r * 0.4);
      ctx.beginPath();
      ctx.moveTo(s.x - r * 5, s.y); ctx.lineTo(s.x + r * 5, s.y);
      ctx.moveTo(s.x, s.y - r * 5); ctx.lineTo(s.x, s.y + r * 5);
      ctx.stroke();
    }
  }
  // 流れ星：1.6 秒ごとに 1 本（画面の上半分を斜めに）
  const k = Math.floor(t / 1.6);
  const u = (t - k * 1.6) / 0.6;
  if (u < 1) {
    const x0 = D.w * (0.2 + 0.6 * hash01(k, 75)), y0 = D.h * (0.05 + 0.3 * hash01(k, 76));
    const len = short * 0.5;
    const e = easeOutCubic(u);
    const hx = x0 + len * e, hy = y0 + len * 0.45 * e;
    const g = ctx.createLinearGradient(x0 + len * e * 0.4, y0 + len * 0.45 * e * 0.4, hx, hy);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, D.tint);
    ctx.strokeStyle = g;
    ctx.globalAlpha = life * (1 - u);
    ctx.lineWidth = Math.max(1, short * 0.004);
    ctx.beginPath();
    ctx.moveTo(x0 + len * e * 0.4, y0 + len * 0.45 * e * 0.4);
    ctx.lineTo(hx, hy);
    ctx.stroke();
    ctx.strokeStyle = D.tint;
  }
}

// 花火：カメラの前の遠くで、0.9 秒ごとに 1 発ずつ開く（粒が広がって落ちながら消える）
function fireworks(D) {
  const { ctx, t, cam, env, life, short, lite } = D;
  const f = forwardOf(cam);
  const PERIOD = 0.9, LIFE = 1.8;
  const k0 = Math.floor(t / PERIOD);
  for (let k = k0 - 2; k <= k0; k++) {
    const age = t - k * PERIOD;
    if (!(age >= 0 && age < LIFE)) continue;
    const dist = 6 + 3 * hash01(k, 81);
    const c = [cam.pos[0] + f[0] * dist + (hash01(k, 82) - 0.5) * 6, cam.pos[1] + f[1] * dist - 1.2 - 1.5 * hash01(k, 83), cam.pos[2] + f[2] * dist];
    const color = FIREWORK[Math.floor(hash01(k, 84) * FIREWORK.length)];
    const R = (1.2 + 0.8 * hash01(k, 85)) * easeOutCubic(Math.min(1, age / 0.7));
    const fall = 0.35 * age * age;
    const n = lite ? 24 : 48;
    const col = D.light ? '#3a2a40' : color;
    ctx.fillStyle = col;
    ctx.strokeStyle = col;
    // 少し前の広がり（尾を引く線の根もと）
    const ageB = Math.max(0, age - 0.12);
    const Rb = (1.2 + 0.8 * hash01(k, 85)) * easeOutCubic(Math.min(1, ageB / 0.7));
    const fallB = 0.35 * ageB * ageB;
    for (let i = 0; i < n; i++) {
      // 球の上にほぼ均等に散らした向き
      const zz = 1 - 2 * (i + 0.5) / n, rr = Math.sqrt(1 - zz * zz), th = i * 2.399963 + k;
      const dir = [Math.cos(th) * rr, zz, Math.sin(th) * rr];
      const s = project(cam, [c[0] + dir[0] * R, c[1] + dir[1] * R + fall, c[2] + dir[2] * R], env);
      if (!s) continue;
      const b = project(cam, [c[0] + dir[0] * Rb, c[1] + dir[1] * Rb + fallB, c[2] + dir[2] * Rb], env);
      const size = Math.max(1.2, Math.min(short * 0.014, 0.07 * s.scale * short));
      ctx.globalAlpha = life * Math.pow(1 - age / LIFE, 1.2) * (0.65 + 0.35 * Math.sin(age * 20 + i));
      if (b) {
        ctx.lineWidth = size * 0.7;
        ctx.beginPath();
        ctx.moveTo(b.x, b.y);
        ctx.lineTo(s.x, s.y);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(s.x, s.y, size, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// 波：床の高さに、横へうねる線を何本も重ねる
function sea(D) {
  const { ctx, t, cam, env, life, short, lite } = D;
  const Y = 1.55, GAP = 0.5, R = 7;
  const z0 = Math.round(cam.pos[2] / GAP);
  const paths = [];
  for (let k = -4; k <= Math.ceil(R / GAP); k += lite ? 2 : 1) {
    const z = (z0 + k) * GAP;
    const pts = [];
    for (let x = -R; x <= R; x += 0.35) {
      const X = cam.pos[0] + x;
      pts.push([X, Y + Math.sin(X * 1.8 + t * 1.6 + z * 0.9) * 0.09 + Math.sin(X * 0.7 - t * 0.8) * 0.05, z]);
    }
    paths.push(pts);
  }
  ctx.lineWidth = Math.max(0.8, short * 0.0028);
  strokeWorld(ctx, env, paths, (pi, i) => {
    const p = paths[pi][i];
    const d = Math.hypot(p[0] - cam.pos[0], p[2] - cam.pos[2]);
    return clamp01(1 - d / R) * life;
  }, 0.9);
}

// 差し込む光：右上の遠くの光源から、回る光の筋と、画面の中心へ並ぶ光の輪（レンズの反射）
function sunlight(D) {
  const { ctx, t, w, h, life, short, light } = D;
  const sx = w * 0.82, sy = h * 0.12;
  const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, short * 0.7);
  g.addColorStop(0, D.tint);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.globalAlpha = life * (light ? 0.45 : 0.6);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = D.tint;
  const n = 14;
  for (let k = 0; k < n; k++) {
    const ang = t * 0.12 + k * (Math.PI * 2 / n);
    const half = 0.025 + 0.02 * hash01(k, 91);
    const len = Math.hypot(w, h);
    ctx.globalAlpha = life * 0.08 * (0.6 + 0.4 * Math.sin(t * 0.8 + k));
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx + Math.cos(ang - half) * len, sy + Math.sin(ang - half) * len);
    ctx.lineTo(sx + Math.cos(ang + half) * len, sy + Math.sin(ang + half) * len);
    ctx.closePath();
    ctx.fill();
  }
  for (let k = 1; k <= 4; k++) { // 光源と中心を結ぶ線の上に、大きさの違う輪
    const f = k / 3.2;
    const x = sx + (w / 2 - sx) * f * 1.6, y = sy + (h / 2 - sy) * f * 1.6;
    ctx.globalAlpha = life * 0.12;
    ctx.lineWidth = Math.max(1, short * 0.003);
    ctx.beginPath();
    ctx.arc(x, y, short * (0.03 + 0.04 * hash01(k, 92)), 0, Math.PI * 2);
    ctx.stroke();
  }
}

// 月：空の遠く（カメラから見てほぼ同じ所）に、光の輪をまとった大きな月。カメラが回るとゆっくり流れる
function moon(D) {
  const { ctx, cam, env, life, short } = D;
  const dir = [0.45, -0.55, 1];
  const L = Math.hypot(...dir);
  const p = [cam.pos[0] + dir[0] / L * 30, cam.pos[1] + dir[1] / L * 30, cam.pos[2] + dir[2] / L * 30];
  const s = project(cam, p, env);
  if (!s) return;
  const r = Math.min(short * 0.3, 4 * s.scale * short);
  const halo = ctx.createRadialGradient(s.x, s.y, r * 0.8, s.x, s.y, r * 3);
  halo.addColorStop(0, D.tint);
  halo.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.globalAlpha = life * 0.35;
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(s.x, s.y, r * 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = life * 0.9;
  ctx.fillStyle = D.tint;
  ctx.beginPath();
  ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
  ctx.fill();
  // 欠けた部分：地の色の丸を少しずらして重ねる（三日月）
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = env.ink?.bg ?? '#000000';
  ctx.globalAlpha = life * 0.92;
  ctx.beginPath();
  ctx.arc(s.x + r * 0.42, s.y - r * 0.18, r * 0.92, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = D.tint;
  ctx.globalAlpha = life * 0.4;
  ctx.lineWidth = Math.max(0.8, short * 0.002);
  for (const k of [1.5, 2.1]) { ctx.beginPath(); ctx.arc(s.x, s.y, r * k, 0, Math.PI * 2); ctx.stroke(); }
}

// 鼓動：拍の頭ごとに、画面の中心から輪が広がる
function heartbeat(D) {
  const { ctx, w, h, env, life, short } = D;
  const beat = env.beat;
  if (!(beat?.index >= 0)) return;
  const ph = beat.phase;
  ctx.lineWidth = Math.max(1, short * 0.006 * (1 - ph));
  for (const lag of [0, 0.18]) {
    const q = ph - lag;
    if (q < 0) continue;
    ctx.globalAlpha = life * 0.7 * (1 - q) * (1 - q);
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, short * (0.15 + 0.55 * easeOutCubic(q)), 0, Math.PI * 2);
    ctx.stroke();
  }
}
