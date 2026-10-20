// 飾り（雰囲気 S）：奥へ並んだ輪のトンネル（After Effects のリピーターの考え方：同じ形を少しずつ回しながら繰り返す）。
// 輪は世界の奥行き（z）に一定の間隔で固定して並ぶので、カメラが奥へ進むと輪をくぐり抜ける。拍の頭で輪が明るくなる。
// layer.sides：輪の角の数（4・6・0 は円）
import { clamp01 } from '../timing.js';
import { inkOrPaper, strokeWorld } from './space-common.js';

const GAP = 1.1;      // 輪の間隔（奥行き）
const RADIUS = 2.9;   // 輪の大きさ（文字の雲より大きい）
const AHEAD = 12;     // カメラの前、この距離まで描く
const BEHIND = 2;
const TWIST = 0.18;   // 1つ奥へ行くごとに回す角度

export function fxTunnel(ctx, t, layer, scene, env) {
  const { width: w, height: h, cam, beat } = env;
  if (!(w > 0 && h > 0) || !cam?.pos || typeof env.project !== 'function') return;
  const cz = cam.pos[2];
  if (!Number.isFinite(cz)) return;
  const intensity = clamp01(env.intensity);
  const sides = layer.sides === 4 || layer.sides === 6 || layer.sides === 3 ? layer.sides : 48;
  const k0 = Math.floor((cz - BEHIND) / GAP), k1 = Math.ceil((cz + AHEAD) / GAP);
  const paths = [], fades = [];
  const pulse = beat?.index >= 0 ? (1 - beat.phase) : 0;
  for (let k = k0; k <= k1; k += env.lite ? 2 : 1) {
    const z = k * GAP;
    const rot = k * TWIST + t * 0.25;
    const pts = [];
    const seg = sides >= 48 ? sides : sides * 4; // 角のある形は辺を区切る（カメラの後ろに回った所を切れるように）
    for (let v = 0; v <= seg; v++) {
      const f = v / seg;
      let x, y;
      if (sides >= 48) { x = Math.cos(f * Math.PI * 2 + rot); y = Math.sin(f * Math.PI * 2 + rot); } else {
        const e = f * sides, i = Math.floor(e) % sides, u = e - Math.floor(e);
        const a0 = (i / sides) * Math.PI * 2 + rot, a1 = ((i + 1) / sides) * Math.PI * 2 + rot;
        x = Math.cos(a0) + (Math.cos(a1) - Math.cos(a0)) * u; y = Math.sin(a0) + (Math.sin(a1) - Math.sin(a0)) * u;
      }
      pts.push([x * RADIUS, y * RADIUS * 0.8, z]);
    }
    const d = z - cz;
    const fade = clamp01((d + BEHIND) / 1.5) * clamp01(1 - d / AHEAD);
    // 拍の光は、手前から奥へ走る（拍の進みに合わせて明るい輪が奥へ移る）
    const run = Math.exp(-(((d / AHEAD) - (beat?.phase ?? 0)) ** 2) / 0.01) * pulse * intensity;
    paths.push(pts);
    fades.push(clamp01(fade * (0.45 + 0.6 * run)));
  }
  const { color, gain } = inkOrPaper(ctx, env, 1);
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(0.75, Math.min(w, h) * 0.0025);
  strokeWorld(ctx, env, paths, pi => fades[pi], gain * (0.75 + 0.25 * intensity));
}
