// 飾り（雰囲気 S）：歌詞の言葉から連想する小物の線画（時計・階段・傘・電車…）。
// 小物は空間に固定した細い線の立体で、歌詞の行のそばに置く（カメラが回り込むと見え方が変わり、文字と重なって一緒に動く）。
// 現れるときは線が順に描かれていき（1 秒）、終わり 0.6 秒で消える。形と動き（時計の針が拍で進む など）は props/ にある。
// layer：kind（小物の種類）・at（世界の置き場所）・size（大きさ。世界の単位）・yaw/pitch/roll（向き）・
//        style（solo＝1つ／echo＝時間をずらした写しを重ねる／trio＝小さく3つ並べる）・seed（小物ごとのずれ）
import { hash01 } from '../rand.js';
import { clamp01 } from '../timing.js';
import { project } from '../camera.js';
import { SHAPES } from './props/index.js';
import { flat } from './props/geo.js';

const REVEAL = 1.0;   // 線が描かれ終わるまでの秒数
const FADE_OUT = 0.6;
const fin = (v, d = 0) => (Number.isFinite(v) ? v : d);

// 小物の中の点（y 上向き）を世界の点へ：大きさ → roll（Z）→ pitch（X）→ yaw（Y）→ 置き場所へ
function placer(at, size, yaw, pitch, roll) {
  const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch), cr = Math.cos(roll), sr = Math.sin(roll);
  return p => {
    let x = p[0] * size, y = -p[1] * size, z = p[2] * size;
    let a = x * cr - y * sr; y = x * sr + y * cr; x = a;
    a = y * cp - z * sp; z = y * sp + z * cp; y = a;
    a = x * cy + z * sy; z = -x * sy + z * cy; x = a;
    return [at[0] + x, at[1] + y, at[2] + z];
  };
}

// 線の頭から割合 f までを残す（途中の区間は線の上で切る）
function trim(path, f) {
  if (f >= 1) return path;
  if (!(f > 0) || path.length < 2) return null;
  const segs = path.length - 1;
  const x = f * segs, k = Math.floor(x), u = x - k;
  const out = path.slice(0, k + 1);
  if (k < segs && u > 0) { const a = path[k], b = path[k + 1]; out.push([a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u]); }
  return out.length >= 2 ? out : null;
}

export function fxProp(ctx, t, layer, scene, env) {
  const { width: w, height: h, cam } = env;
  if (!(w > 0 && h > 0) || !cam?.pos || typeof env.project !== 'function') return;
  const shape = SHAPES[layer?.kind];
  if (typeof shape !== 'function') return;
  const from = fin(layer.from), to = fin(layer.to, from);
  const out = clamp01((to - t) / FADE_OUT);
  if (!(t >= from) || !(out > 0)) return;
  const at = Array.isArray(layer.at) && layer.at.length >= 3 && layer.at.every(Number.isFinite) ? layer.at : [0, 0, 0];
  const size = Math.max(0.02, Math.min(5, fin(layer.size, 0.4)));
  const seed = fin(layer.seed);
  const r = hash01(seed, 911);
  const short = Math.min(w, h);
  // 置き場所の見え方（遠いほど薄く、カメラの後ろなら描かない）
  const anchor = project(cam, at, env);
  if (!anchor) return;
  const fog = clamp01(1 - (anchor.dz - 1.5) / 6);
  const alpha = out * (0.35 + 0.65 * fog);
  if (!(alpha > 0.01)) return;
  const beat = env.beat ?? {};
  const ph = beat.index >= 0 && Number.isFinite(beat.phase) ? clamp01(beat.phase) : 0;
  const bi = beat.index >= 0 ? beat.index : 0;
  const intensity = clamp01(env.intensity);
  const style = env.lite && layer.style === 'echo' ? 'solo' : layer.style;
  // 写しの一覧：[時間の遅れ, 大きさの倍率, 横のずれ, 濃さ]
  const copies = style === 'echo' ? [[0, 1, 0, 1], [0.14, 1.16, 0, 0.42], [0.28, 1.32, 0, 0.2]]
    : style === 'trio' ? [[0, 0.55, -1.25, 0.85], [0.2, 0.55, 0, 0.85], [0.4, 0.55, 1.25, 0.85]] : [[0, 1, 0, 1]];
  const lw = Math.max(1, Math.min(short * 0.012, short * 0.0045 * anchor.scale * Math.sqrt(size / 0.4)));
  // 線は文字と同じ色（トンネルなどの背景の線と見分けやすく）。動く所（印の付いた線）は場面の色
  const light = env.tone === 'paper' || !!env.ink?.light;
  ctx.globalCompositeOperation = 'source-over';
  const ink = { color: env.ink?.fg ?? (light ? '#101010' : '#ffffff') };
  const gain = light ? 0.85 : 0.9;
  const hotColor = env.colors?.[0] ?? ink.color;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const [lag, mul, dx, a0] of copies) {
    const local = t - from - lag;
    if (!(local >= 0)) continue;
    const A = { t: local, T: t - lag, ph, bi, b: Math.pow(1 - ph, 3) * (beat.index >= 0 ? 1 : 0), i: intensity, r };
    let item;
    try { item = shape(A); } catch { item = null; }
    const paths = flat(item);
    if (!paths.length) continue;
    // ゆっくり漂う（上下に浮く・少し向きが揺れる）
    const bob = Math.sin(t * 0.9 + r * 6.28) * 0.04 * size;
    const sway = Math.sin(t * 0.37 + r * 9) * 0.18;
    const side = dx * size;
    const yaw = fin(layer.yaw) + sway, cyw = Math.cos(yaw), syw = Math.sin(yaw);
    const base = [at[0] + side * cyw, at[1] + bob, at[2] - side * syw];
    const put = placer(base, size * mul, yaw, fin(layer.pitch), fin(layer.roll));
    const reveal = local / REVEAL;
    const n = paths.length;
    const plain = [], strong = [];
    paths.forEach((p, j) => {
      const start = n > 1 ? (j / (n - 1)) * 0.45 : 0;
      const part = trim(p, clamp01((reveal - start) / 0.55));
      if (part) (p.hot ? strong : plain).push(part);
    });
    const stroke = (list, color, width, a) => {
      if (!list.length || !(a > 0.01)) return;
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.globalAlpha = Math.min(1, a);
      ctx.beginPath();
      for (const p of list) {
        let pen = false;
        for (const q of p) {
          const s = env.project(put(q));
          if (!s || !Number.isFinite(s.x) || !Number.isFinite(s.y)) { pen = false; continue; }
          if (pen) ctx.lineTo(s.x, s.y); else { ctx.moveTo(s.x, s.y); pen = true; }
        }
      }
      ctx.stroke();
    };
    const a = alpha * a0 * gain;
    stroke(plain, ink.color, lw, a * 0.9);
    stroke(strong, hotColor, lw * 1.5, Math.min(1, a * 1.2 + 0.1 * intensity));
  }
  ctx.globalAlpha = 1;
}
