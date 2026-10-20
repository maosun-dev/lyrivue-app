// 世界の背景：どちらの強さでも出る世界（1色の網点・夜の街の線画・設計図・映画のフィルム・夕焼けの影絵）
import { hash01 } from '../../rand.js';
import { P, strokePath, addPath, fillPoly, scatter, vGrad } from './common.js';

const TAU = Math.PI * 2;

// 1色の網点：曲の色 1 色の濃淡。ぐにゃっとした塊が網点でゆっくり形を変え、大きな輪郭の線が 1 本ずれて重なる
export function mono(ctx, k) {
  const { ink, w, h, s, t, lw } = k;
  const blobs = [0, 1, 2].map(j => ({
    x: w * (0.25 + 0.5 * hash01(121, j, 1)) + Math.sin(t * 0.2 + j * 2) * s * 0.08,
    y: h * (0.2 + 0.6 * hash01(121, j, 2)) + Math.cos(t * 0.17 + j) * s * 0.08,
    r: s * (0.22 + 0.12 * hash01(121, j, 3)), ph: j * 1.3,
  }));
  const reach = (b, x, y) => {
    const dx = x - b.x, dy = y - b.y, an = Math.atan2(dy, dx);
    const rr = b.r * (1 + 0.18 * Math.sin(an * 3 + t * 0.5 + b.ph) + 0.08 * Math.sin(an * 5 - t * 0.4));
    return 1 - Math.hypot(dx, dy) / rr;
  };
  const cell = Math.max(3, s / (k.lite ? 18 : 26));
  // 塊のまわり（形の揺れぶんを足した四角）だけを調べる
  const x0 = Math.max(0, Math.min(...blobs.map(b => b.x - b.r * 1.3))), x1 = Math.min(w, Math.max(...blobs.map(b => b.x + b.r * 1.3)));
  const y0 = Math.max(0, Math.min(...blobs.map(b => b.y - b.r * 1.3))), y1 = Math.min(h, Math.max(...blobs.map(b => b.y + b.r * 1.3)));
  ctx.fillStyle = ink.line;
  ctx.globalAlpha = 0.55;
  ctx.beginPath();
  for (let y = cell / 2 + Math.floor(y0 / cell) * cell; y < y1; y += cell) {
    for (let x = cell / 2 + Math.floor(x0 / cell) * cell + ((Math.round(y / cell) % 2) * cell) / 2; x < x1; x += cell) {
      let v = 0;
      for (const b of blobs) v = Math.max(v, reach(b, x, y));
      if (v <= 0.02) continue;
      const r = cell * 0.48 * Math.min(1, v * 2.2);
      ctx.moveTo(x + r, y);
      ctx.arc(x, y, r, 0, TAU);
    }
  }
  ctx.fill();
  // 輪郭の線：1 つ目の塊の形を、少しずらして重ねる
  const b = blobs[0];
  ctx.strokeStyle = ink.fg;
  ctx.lineWidth = lw * 1.6;
  ctx.globalAlpha = 0.35;
  ctx.beginPath();
  for (let q = 0; q <= 48; q++) {
    const an = q / 48 * TAU;
    const rr = b.r * (1 + 0.18 * Math.sin(an * 3 + t * 0.5 + b.ph) + 0.08 * Math.sin(an * 5 - t * 0.4));
    const x = b.x + s * 0.03 + Math.cos(an) * rr, y = b.y - s * 0.03 + Math.sin(an) * rr;
    if (q) ctx.lineTo(x, y); else ctx.moveTo(x, y);
  }
  ctx.stroke();
}

// 夜の街の線画：道の両側にビルの輪郭が奥へ並び、窓の灯りがときどき点いたり消えたりする
export function city(ctx, k) {
  const { ink, s, lw, cam, t } = k;
  if (!cam) return;
  const GAP = 1.3, cz = cam.pos[2], ground = 1.9;
  ctx.lineWidth = lw;
  for (const side of [-1, 1]) {
    for (let n = Math.floor((cz - 1) / GAP); n <= Math.ceil((cz + 15) / GAP); n++) {
      const z0 = n * GAP, z1 = z0 + GAP * 0.85, d = z0 - cz;
      const fade = Math.max(0, Math.min(1, (d + 1) / 2)) * Math.max(0, 1 - d / 15);
      if (!(fade > 0)) continue;
      const x = side * (2.8 + 0.6 * hash01(131, n, side + 2));
      const top = ground - (1.6 + 2.6 * hash01(131, n, side + 5));
      ctx.globalAlpha = 0.55 * fade;
      ctx.strokeStyle = ink.line;
      strokePath(ctx, k, [[x, ground, z0], [x, top, z0], [x, top, z1], [x, ground, z1]]);
      // 窓：面の上の格子。灯りは 2 秒ごとに少し入れ替わる
      ctx.fillStyle = ink.accent;
      const rows = Math.floor((ground - top) / 0.35), cols = 3;
      for (let r = 1; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (hash01(132, n * 7 + side, r * 5 + c, Math.floor(t / 2 + hash01(133, n, r, c) * 3)) > 0.3) continue;
          const q = P(k, [x, ground - r * 0.35, z0 + (c + 0.5) * (z1 - z0) / cols]);
          if (!q) continue;
          const sz = Math.max(0.8, Math.min(s * 0.012, s * 0.004 * q.scale));
          ctx.globalAlpha = 0.8 * fade;
          ctx.fillRect(q.x - sz / 2, q.y - sz / 2, sz, sz);
        }
      }
    }
  }
}

// 設計図：青い地に白い方眼（細い線と 4 つおきの太い線）、空間に円の作図線と寸法の矢印
export function blueprint(ctx, k) {
  const { ink, w, h, s, lw } = k;
  const g = Math.max(4, s / 16);
  ctx.strokeStyle = ink.line;
  ctx.lineWidth = Math.max(0.5, lw * 0.6);
  for (const [step, a] of [[g, 0.1], [g * 4, 0.22]]) {
    ctx.globalAlpha = a;
    ctx.beginPath();
    for (let x = 0; x <= w; x += step) { ctx.moveTo(x, 0); ctx.lineTo(x, h); }
    for (let y = 0; y <= h; y += step) { ctx.moveTo(0, y); ctx.lineTo(w, y); }
    ctx.stroke();
  }
  ctx.strokeStyle = ink.fg;
  ctx.lineWidth = lw;
  ctx.fillStyle = ink.fg;
  scatter(k, 7, 7, 4, 141, hash01, (p, a, j) => {
    const r = 0.4 + 0.4 * hash01(141, j, 4);
    ctx.globalAlpha = 0.4 * a;
    strokePath(ctx, k, Array.from({ length: 33 }, (_, q) => [p[0] + Math.cos(q / 32 * TAU) * r, p[1] + Math.sin(q / 32 * TAU) * r, p[2]]));
    strokePath(ctx, k, [[p[0] - r * 1.3, p[1], p[2]], [p[0] + r * 1.3, p[1], p[2]]]);
    strokePath(ctx, k, [[p[0], p[1] - r * 1.3, p[2]], [p[0], p[1] + r * 1.3, p[2]]]);
    // 寸法：円の下に両矢印と数字
    const y = p[1] + r + 0.2, L = [p[0] - r, y, p[2]], R = [p[0] + r, y, p[2]];
    strokePath(ctx, k, [L, R]);
    strokePath(ctx, k, [[L[0] + 0.08, y - 0.05, p[2]], L, [L[0] + 0.08, y + 0.05, p[2]]]);
    strokePath(ctx, k, [[R[0] - 0.08, y - 0.05, p[2]], R, [R[0] - 0.08, y + 0.05, p[2]]]);
    const q = P(k, [p[0], y - 0.04, p[2]]);
    if (q && q.scale > 0.2) {
      ctx.font = `${Math.min(s * 0.04, s * 0.012 * q.scale)}px "DotGothic16", monospace`;
      ctx.textAlign = 'center';
      ctx.fillText(`R${Math.round(r * 100)}`, q.x, q.y);
      ctx.textAlign = 'left';
    }
  });
}

// 映画のフィルム：左右の帯に送り穴が流れ、コマの境目の線、縦の傷とちらつき
export function film(ctx, k) {
  const { ink, w, h, s, t, lw } = k;
  const band = s * 0.085, hole = band * 0.42, gap = Math.max(4, band * 0.9);
  const off = (t * s * 0.6) % gap;
  for (const x0 of [0, w - band]) {
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = '#000000';
    ctx.fillRect(x0, 0, band, h);
    ctx.fillStyle = ink.line;
    ctx.globalAlpha = 0.55;
    for (let y = -gap + off; y < h; y += gap) ctx.fillRect(x0 + (band - hole) / 2, y, hole, hole * 1.3);
  }
  // コマの境目
  const frameH = Math.max(8, s * 0.75);
  ctx.globalAlpha = 0.25;
  ctx.fillStyle = '#000000';
  for (let y = ((t * s * 0.6) % frameH) - frameH; y < h; y += frameH) ctx.fillRect(band, y, w - band * 2, s * 0.012);
  // 傷：1/12 秒ごとに場所が変わる細い縦線
  const st = Math.floor(t * 12);
  ctx.strokeStyle = ink.fg;
  ctx.lineWidth = Math.max(0.5, lw * 0.7);
  for (let j = 0; j < 3; j++) {
    if (hash01(151, st, j) < 0.4) continue;
    const x = band + hash01(151, st, j + 10) * (w - band * 2);
    ctx.globalAlpha = 0.15;
    ctx.beginPath(); ctx.moveTo(x, h * hash01(151, st, j + 20) * 0.3); ctx.lineTo(x + s * 0.004, h * (0.6 + 0.4 * hash01(151, st, j + 30))); ctx.stroke();
  }
  // ちらつき
  ctx.globalAlpha = 0.04 * hash01(152, Math.floor(t * 24), 1);
  ctx.fillStyle = ink.fg;
  ctx.fillRect(0, 0, w, h);
}

// 夕焼けの影絵：夕焼けの上下の色、大きな夕日、黒い影の丘と、道ばたの電柱と電線
export function sunset(ctx, k) {
  const { ink, w, h, s, lw, cam } = k;
  vGrad(ctx, k, '#e0573a', '#ffc46b');
  ctx.globalAlpha = 0.95;
  ctx.fillStyle = ink.accent;
  ctx.beginPath(); ctx.arc(w * 0.5, h * 0.62, s * (0.3 + 0.01 * k.beatK), 0, TAU); ctx.fill();
  if (!cam) return;
  const cz = cam.pos[2];
  ctx.fillStyle = ink.fg;
  // 丘：遠く（カメラから一定の奥）に、なだらかな山なりの影。横の動きで少しずれる
  for (const [far, lift, a] of [[11, 0.9, 0.55], [7, 1.3, 0.95]]) {
    const pts = [];
    for (let q = 0; q <= 24; q++) {
      const x = cam.pos[0] + (q / 24 - 0.5) * far * 2;
      pts.push([x, lift - 0.5 * (0.5 + 0.5 * Math.sin(x * 0.7 + far)) - 0.3 * hash01(161, Math.floor(x * 2), far), cz + far]);
    }
    pts.push([cam.pos[0] + far, 6, cz + far], [cam.pos[0] - far, 6, cz + far]);
    ctx.globalAlpha = a;
    fillPoly(ctx, k, pts);
  }
  // 電柱と電線：道の右側に奥へ並ぶ
  const GAP = 3, x = 2.2, topY = -1.2, ground = 2;
  ctx.strokeStyle = ink.fg;
  ctx.globalAlpha = 0.9;
  // 柱と腕木を 1 回、電線を 1 回でまとめて描く
  const n0 = Math.floor((cz - 1) / GAP), n1 = Math.ceil((cz + 16) / GAP);
  ctx.lineWidth = lw * 2.5;
  ctx.beginPath();
  for (let n = n0; n <= n1; n++) {
    const z = n * GAP;
    addPath(ctx, k, [[x, ground, z], [x, topY, z]]);
    addPath(ctx, k, [[x - 0.35, topY + 0.15, z], [x + 0.35, topY + 0.15, z]]);
  }
  ctx.stroke();
  ctx.lineWidth = lw;
  ctx.beginPath();
  for (let n = n0 + 1; n <= n1; n++) {
    const z = n * GAP, prev = z - GAP;
    for (const dx of [-0.3, 0.3]) addPath(ctx, k, Array.from({ length: 9 }, (_, q) => { const u = q / 8; return [x + dx, topY + 0.15 + 0.35 * Math.sin(u * Math.PI), prev + (z - prev) * u]; }));
  }
  ctx.stroke();
}

