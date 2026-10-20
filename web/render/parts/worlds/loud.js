// 世界の背景：派手な世界（方眼の計器・ポップな図形・光る線の枠・万華鏡・ゲーム画面）。強い場面で出やすい
import { hash01 } from '../../rand.js';
import { strokePath, fillPoly, scatter, ring, dot } from './common.js';

const TAU = Math.PI * 2;

// 方眼の計器：上下に奥へ続く方眼の板（カメラが進むと流れる）、隅で刻々と変わる数字、拍で回る照準
export function hud(ctx, k) {
  const { ink, w, h, s, t, lw, cam } = k;
  ctx.strokeStyle = ink.line;
  ctx.lineWidth = lw;
  if (cam) {
    const cz = cam.pos[2], cx = Math.round(cam.pos[0]);
    const z0 = Math.floor(cz) - 2, z1 = Math.ceil(cz) + 14;
    for (const y of [1.7, -1.7]) {
      for (let x = cx - 6; x <= cx + 6; x++) { ctx.globalAlpha = 0.22; strokePath(ctx, k, [[x, y, z0], [x, y, (z0 + z1) / 2], [x, y, z1]]); }
      for (let z = z0; z <= z1; z++) {
        ctx.globalAlpha = 0.28 * Math.max(0, 1 - Math.abs(z - cz - 5) / 10);
        strokePath(ctx, k, [[cx - 6, y, z], [cx, y, z], [cx + 6, y, z]]);
      }
    }
  }
  // 隅の数字（等幅に見える書体）
  const px = Math.max(8, s * 0.026);
  ctx.font = `${px}px "DotGothic16", monospace`;
  ctx.fillStyle = ink.line;
  ctx.globalAlpha = 0.75;
  const m = s * 0.05;
  ctx.textAlign = 'left';
  ctx.fillText(`T ${k.t.toFixed(2)}`, m, m + px);
  ctx.fillText(`Z ${(cam ? cam.pos[2] : 0).toFixed(1)}`, m, m + px * 2.3);
  ctx.textAlign = 'right';
  ctx.fillText(String(Math.floor(k.t * 7) % 1000).padStart(3, '0'), w - m, h - m);
  ctx.textAlign = 'left';
  // 照準：中心から少しずれた所。拍の頭で縮んで回る
  const ax = w * 0.5 + Math.sin(t * 0.3) * s * 0.18, ay = h * 0.5 + Math.cos(t * 0.23) * s * 0.12;
  const r = s * (0.07 - 0.015 * k.beatK);
  ctx.strokeStyle = ink.accent;
  ctx.globalAlpha = 0.65;
  ring(ctx, ax, ay, r);
  for (let j = 0; j < 4; j++) {
    const an = j * Math.PI / 2 + k.beatK * 0.6 + t * 0.4;
    ctx.beginPath(); ctx.moveTo(ax + Math.cos(an) * r * 1.2, ay + Math.sin(an) * r * 1.2); ctx.lineTo(ax + Math.cos(an) * r * 1.8, ay + Math.sin(an) * r * 1.8); ctx.stroke();
  }
}

// ポップな図形：原色の丸・三角・ジグザグ・四角が空間に浮かび、拍の頭で跳ねる
export function pop(ctx, k) {
  const { ink, lw } = k;
  const COL = [ink.accent, '#3d5bff', '#ffffff', ink.fg];
  scatter(k, 16, 5, 3, 91, hash01, (p, a, j) => {
    const kind = j % 4, size = 0.12 + 0.12 * hash01(91, j, 4), spin = hash01(91, j, 5) * TAU + k.t * 0.5 * (j % 2 ? 1 : -1);
    const y = p[1] - 0.18 * k.beatK * k.beatK * (0.5 + hash01(91, j, 6));
    const at = (r, an) => [p[0] + Math.cos(an + spin) * r, y + Math.sin(an + spin) * r, p[2]];
    ctx.globalAlpha = a;
    ctx.fillStyle = COL[j % COL.length];
    ctx.strokeStyle = ink.fg;
    ctx.lineWidth = lw * 3;
    if (kind === 0) fillPoly(ctx, k, Array.from({ length: 16 }, (_, q) => at(size, q / 16 * TAU)));
    else if (kind === 1) fillPoly(ctx, k, [0, 1, 2].map(q => at(size * 1.2, q / 3 * TAU - Math.PI / 2)));
    else if (kind === 2) strokePath(ctx, k, Array.from({ length: 7 }, (_, q) => [p[0] + (q - 3) * size * 0.45, y + (q % 2 ? -1 : 1) * size * 0.3, p[2]]));
    else strokePath(ctx, k, [0, 1, 2, 3].map(q => at(size, q / 4 * TAU + Math.PI / 4)), true);
  });
}

// 光る線の枠：奥へ並ぶ角丸の管の枠。色が交互で、ときどきちらつく
export function neon(ctx, k) {
  const { ink, lw, cam, t } = k;
  if (!cam) return;
  ctx.globalCompositeOperation = 'lighter';
  const GAP = 2.4, cz = cam.pos[2];
  for (let n = Math.floor((cz - 1) / GAP); n <= Math.ceil((cz + 14) / GAP); n++) {
    const z = n * GAP, d = z - cz;
    if (hash01(101, n, Math.floor(t * 14)) < 0.05) continue; // ちらつき
    const fade = Math.max(0, Math.min(1, (d + 1) / 1.5)) * Math.max(0, 1 - d / 14);
    const W = 2.4, H = 1.6, R = 0.35;
    const pts = [];
    for (const [cx, cy, a0] of [[W - R, H - R, 0], [-W + R, H - R, Math.PI / 2], [-W + R, -H + R, Math.PI], [W - R, -H + R, Math.PI * 1.5]]) {
      for (let q = 0; q <= 4; q++) { const an = a0 + q / 4 * Math.PI / 2; pts.push([cam.pos[0] * 0.3 + cx + Math.cos(an) * R, cy + Math.sin(an) * R, z]); }
    }
    ctx.strokeStyle = n % 2 ? ink.accent : ink.line;
    if (!k.lite) { ctx.globalAlpha = 0.12 * fade; ctx.lineWidth = lw * 7; strokePath(ctx, k, pts, true); }
    ctx.globalAlpha = (0.55 + 0.3 * k.beatK) * fade;
    ctx.lineWidth = lw * 2;
    strokePath(ctx, k, pts, true);
  }
}

// 万華鏡：画面の中心で回る 12 回対称の模様。拍の頭で開く
export function kaleido(ctx, k) {
  const { ink, w, h, s, t, lw } = k;
  const cx = w / 2, cy = h / 2;
  const open = 1 + 0.12 * k.beatK;
  ctx.lineWidth = lw * 1.4;
  for (let j = 0; j < 12; j++) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(j / 12 * TAU + t * 0.15);
    if (j % 2) ctx.scale(1, -1);
    for (let q = 0; q < 4; q++) {
      const r0 = s * (0.12 + 0.17 * q) * open, r1 = r0 + s * 0.12;
      const an = 0.18 + 0.1 * Math.sin(t * 0.6 + q);
      ctx.globalAlpha = 0.09;
      ctx.fillStyle = q % 2 ? ink.accent : ink.line;
      ctx.beginPath(); ctx.moveTo(r0, 0); ctx.lineTo(Math.cos(an) * r1, Math.sin(an) * r1); ctx.lineTo(r1 * 1.1, 0); ctx.closePath(); ctx.fill();
      ctx.globalAlpha = 0.35;
      ctx.strokeStyle = q % 2 ? ink.line : ink.accent;
      ctx.stroke();
    }
    ctx.restore();
  }
}

// ゲーム画面：下にドットの地形が横へ流れ、浮かぶコイン、上に点数
export function game(ctx, k) {
  const { ink, w, h, s, t } = k;
  const cell = Math.max(3, Math.round(s / 26));
  const scroll = Math.floor(t * 8);
  const cols = Math.ceil(w / cell) + 1;
  ctx.globalAlpha = 0.55;
  for (let c = 0; c < cols; c++) {
    const n = c + scroll;
    const hgt = 2 + Math.floor(3 * (0.5 + 0.5 * Math.sin(n * 0.35)) + 2 * hash01(111, n, 1));
    for (let r = 0; r < hgt; r++) {
      ctx.fillStyle = r === hgt - 1 ? ink.line : '#1b6b40';
      ctx.fillRect(c * cell, h - (r + 1) * cell, cell - 1, cell - 1);
    }
    if (hash01(111, n, 2) < 0.12) {
      ctx.fillStyle = ink.accent;
      const bob = Math.round(Math.sin(t * 6 + n) * cell * 0.2);
      ctx.fillRect(c * cell + cell * 0.25, h - (hgt + 2) * cell + bob, cell * 0.5, cell * 0.7);
    }
  }
  const px = Math.max(8, cell * 0.9);
  ctx.globalAlpha = 0.85;
  ctx.fillStyle = ink.fg;
  ctx.font = `${px}px "DotGothic16", monospace`;
  ctx.textAlign = 'left';
  ctx.fillText(`SCORE ${String(Math.floor(t * 37) * 10).padStart(6, '0')}`, cell, cell + px);
  ctx.textAlign = 'right';
  ctx.fillText(`x${1 + (Math.floor(t / 8) % 9)}`, w - cell, cell + px);
  ctx.textAlign = 'left';
  // 残りの命（丸 3 つ）
  ctx.fillStyle = ink.accent;
  for (let j = 0; j < 3; j++) dot(ctx, cell * (1.5 + j * 1.6), cell * 2.6 + px, cell * 0.4);
}
