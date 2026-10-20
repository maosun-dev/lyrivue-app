// 世界の背景：静かな世界（空と線画・紙のカード・新聞・水の中・星図・黒板・森の葉・雨の窓）。弱い場面で出やすい
import { hash01 } from '../../rand.js';
import { P, strokePath, fillPoly, scatter, vGrad, ring, dot, fract } from './common.js';

const circlePath = (ctx, x, y, r) => { if (r > 0) { ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, Math.PI * 2); } };

const TAU = Math.PI * 2;

// 空と線画：淡い空の上下の色、ふくらみを重ねた細い線の雲が空間に漂い、画面の上に大きな線の太陽
export function sky(ctx, k) {
  vGrad(ctx, k, '#c4dcee', '#f1f6f9');
  const { ink, t, s, lw } = k;
  ctx.strokeStyle = ink.line;
  ctx.lineWidth = lw;
  // 太陽：輪と、ゆっくり回る短い光の線
  const sx = k.w * 0.78, sy = k.h * 0.2, r = s * 0.11;
  ctx.globalAlpha = 0.5;
  ring(ctx, sx, sy, r);
  for (let j = 0; j < 12; j++) {
    const a = j / 12 * TAU + t * 0.08;
    ctx.beginPath();
    ctx.moveTo(sx + Math.cos(a) * r * 1.25, sy + Math.sin(a) * r * 1.25);
    ctx.lineTo(sx + Math.cos(a) * r * (1.45 + 0.15 * k.beatK), sy + Math.sin(a) * r * (1.45 + 0.15 * k.beatK));
    ctx.stroke();
  }
  // 雲：底の平らな線に、3〜4 個のふくらみ。少しずつ横へ流れる
  scatter(k, 9, 9, 5, 11, hash01, (p, a, j) => {
    const bumps = 3 + Math.floor(hash01(11, j, 4) * 2);
    const size = 0.5 + 0.6 * hash01(11, j, 5);
    const cx = p[0] + ((t * 0.04) % 1), cy = p[1] - 0.6, cz = p[2];
    const pts = [];
    for (let b = 0; b < bumps; b++) {
      const bx = cx + (b - (bumps - 1) / 2) * size * 0.5;
      const br = size * (0.25 + 0.12 * hash01(11, j, 10 + b));
      for (let q = 0; q <= 8; q++) { const an = Math.PI + q / 8 * Math.PI; pts.push([bx + Math.cos(an) * br, cy + Math.sin(an) * br, cz]); }
    }
    pts.push([cx + bumps * size * 0.25, cy, cz], [cx - bumps * size * 0.25, cy, cz], pts[0]);
    ctx.globalAlpha = 0.55 * a;
    strokePath(ctx, k, pts);
  });
}

// 紙のカード：紙の繊維の点、空間に散らばった傾いたカード（ときどきテープ）
export function paper(ctx, k) {
  const { ink, s, w, h } = k;
  ctx.fillStyle = ink.line;
  ctx.globalAlpha = 0.12;
  for (let j = 0; j < (k.lite ? 60 : 140); j++) {
    ctx.fillRect(hash01(21, j, 1) * w, hash01(21, j, 2) * h, s * (0.004 + 0.01 * hash01(21, j, 3)), Math.max(0.6, s * 0.0015));
  }
  scatter(k, 10, 6, 4, 22, hash01, (p, a, j) => {
    const rz = (hash01(22, j, 4) - 0.5) * 0.9, ry = (hash01(22, j, 5) - 0.5) * 0.8;
    const cw = 0.45 + 0.35 * hash01(22, j, 6), ch = cw * 0.62;
    const corner = (x, y) => {
      const xr = x * Math.cos(rz) - y * Math.sin(rz), yr = x * Math.sin(rz) + y * Math.cos(rz);
      return [p[0] + xr * Math.cos(ry), p[1] + yr, p[2] + xr * Math.sin(ry)];
    };
    const card = [corner(-cw, -ch), corner(cw, -ch), corner(cw, ch), corner(-cw, ch)];
    ctx.globalAlpha = 0.85 * a;
    ctx.fillStyle = ink.card ?? '#f8f5ee'; // 紙の時間で変わる（director/worlds.js の PAPER_TIMES）
    if (!fillPoly(ctx, k, card)) return;
    ctx.globalAlpha = 0.35 * a;
    ctx.strokeStyle = ink.line;
    ctx.lineWidth = k.lw;
    strokePath(ctx, k, card, true);
    if (hash01(22, j, 7) < 0.5) {
      ctx.globalAlpha = 0.6 * a;
      ctx.fillStyle = ink.accent;
      fillPoly(ctx, k, [corner(-0.15, -ch - 0.06), corner(0.15, -ch - 0.06), corner(0.15, -ch + 0.06), corner(-0.15, -ch + 0.06)]);
    }
  });
}

// 新聞・雑誌：上の題字の罫線、段組みの縦罫、灰色の本文の線がゆっくり上へ流れ、赤い丸い判子が拍で押される
export function news(ctx, k) {
  const { ink, s, w, h, t, lw } = k;
  const m = s * 0.06;
  ctx.strokeStyle = ink.fg;
  ctx.globalAlpha = 0.5;
  ctx.lineWidth = lw * 2.2;
  ctx.beginPath(); ctx.moveTo(m, m * 1.6); ctx.lineTo(w - m, m * 1.6); ctx.stroke();
  ctx.lineWidth = lw;
  ctx.beginPath(); ctx.moveTo(m, m * 1.6 + lw * 4); ctx.lineTo(w - m, m * 1.6 + lw * 4); ctx.stroke();
  const cols = w > h ? 4 : 3;
  const cw = (w - m * 2) / cols;
  ctx.globalAlpha = 0.28;
  for (let c = 1; c < cols; c++) { ctx.beginPath(); ctx.moveTo(m + c * cw, m * 2.2); ctx.lineTo(m + c * cw, h - m); ctx.stroke(); }
  // 本文の線（灰色の短い帯）
  const lh = Math.max(3, s * 0.032), scroll = (t * s * 0.02) % lh;
  ctx.fillStyle = ink.line;
  ctx.globalAlpha = 0.22;
  for (let c = 0; c < cols; c++) {
    for (let r = 0, y = m * 2.4 - scroll; y < h - m; r++, y += lh) {
      if (y < m * 2.2) continue;
      const len = hash01(31, c, r) < 0.12 ? 0.35 : 0.88 + 0.1 * hash01(31, c, r + 500);
      ctx.fillRect(m + c * cw + s * 0.012, y, (cw - s * 0.03) * Math.min(1, len), lh * 0.32);
    }
  }
  // 判子：赤い二重の輪と十字。拍の頭で少し大きく押される
  const r = s * (0.09 + 0.012 * k.beatK);
  ctx.strokeStyle = ink.accent;
  ctx.globalAlpha = 0.75;
  ctx.lineWidth = lw * 2.4;
  const sx = w - m - s * 0.12, sy = h - m - s * 0.14;
  ring(ctx, sx, sy, r);
  ctx.lineWidth = lw;
  ring(ctx, sx, sy, r * 0.8);
  ctx.beginPath(); ctx.moveTo(sx - r * 0.5, sy); ctx.lineTo(sx + r * 0.5, sy); ctx.moveTo(sx, sy - r * 0.5); ctx.lineTo(sx, sy + r * 0.5); ctx.stroke();
}

// 水の中：上から差す揺らぐ光の網目、空間の泡がゆっくり昇る
export function water(ctx, k) {
  const { ink, w, h, s, t, lw } = k;
  vGrad(ctx, k, ink.top ?? '#0a3a47', ink.bg); // 上から差す光の色（夜明けの配色で淡くなる）
  ctx.strokeStyle = ink.line;
  ctx.lineWidth = lw * 1.5;
  ctx.globalAlpha = 0.13;
  const n = k.lite ? 5 : 9;
  for (let d = 0; d < 2; d++) {
    for (let j = 0; j < n; j++) {
      ctx.beginPath();
      for (let q = 0; q <= 14; q++) {
        const u = q / 14;
        const base = (j + 0.5) / n;
        const x = d ? u * w : (base + 0.04 * Math.sin(u * 7 + t * 0.9 + j)) * w;
        const y = d ? (base * 0.6 + 0.03 * Math.sin(u * 6 - t * 0.7 + j * 1.7)) * h : u * h * 0.6;
        if (q) ctx.lineTo(x, y); else ctx.moveTo(x, y);
      }
      ctx.stroke();
    }
  }
  ctx.strokeStyle = ink.accent;
  ctx.lineWidth = lw;
  ctx.globalAlpha = 0.45;
  ctx.beginPath();
  scatter(k, 20, 4, 2.5, 41, hash01, (p, a, j) => {
    if (a < 0.3) return; // 箱の端の泡は描かない（まとめて描くので濃さは揃える）
    const rise = fract(hash01(41, j, 5) + k.t * (0.05 + 0.05 * hash01(41, j, 6)));
    const q = P(k, [p[0] + 0.05 * Math.sin(k.t * 2 + j), p[1] + 2 - rise * 4, p[2]]);
    if (q) circlePath(ctx, q.x, q.y, Math.min(s * 0.05, (0.02 + 0.03 * hash01(41, j, 7)) * q.scale * s));
  });
  ctx.stroke();
}

// 星図：空間の星の点と、近い星どうしを結ぶ星座の線、画面にゆっくり回る円の目盛り
export function stars(ctx, k) {
  const { ink, w, h, s, t, lw } = k;
  ctx.globalCompositeOperation = 'lighter';
  const pts = [];
  scatter(k, 70, 10, 5, 51, hash01, (p, a, j) => {
    const q = P(k, p);
    if (!q) return;
    const tw = 0.6 + 0.4 * Math.sin(t * (1 + 2 * hash01(51, j, 5)) + j);
    ctx.globalAlpha = a * tw * 0.9;
    ctx.fillStyle = hash01(51, j, 6) < 0.15 ? ink.accent : ink.fg;
    const r = Math.max(0.8, Math.min(s * 0.006, s * 0.0016 * q.scale));
    ctx.fillRect(q.x - r, q.y - r, r * 2, r * 2);
    pts.push({ q, a, j });
  });
  ctx.strokeStyle = ink.line;
  ctx.lineWidth = lw;
  for (let n = 1; n < pts.length; n++) {
    const A = pts[n - 1].q, B = pts[n].q;
    if (pts[n].j % 4 === 0 || Math.hypot(A.x - B.x, A.y - B.y) > s * 0.3) continue;
    ctx.globalAlpha = 0.35 * Math.min(pts[n - 1].a, pts[n].a);
    ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y); ctx.stroke();
  }
  ctx.globalCompositeOperation = 'source-over';
  ctx.strokeStyle = ink.line;
  ctx.globalAlpha = 0.22;
  const cx = w / 2, cy = h / 2, R = s * 0.46;
  ring(ctx, cx, cy, R);
  for (let j = 0; j < 72; j++) {
    const an = j / 72 * TAU + t * 0.02;
    const L = j % 6 === 0 ? 0.05 : 0.02;
    ctx.beginPath(); ctx.moveTo(cx + Math.cos(an) * R, cy + Math.sin(an) * R); ctx.lineTo(cx + Math.cos(an) * R * (1 - L), cy + Math.sin(an) * R * (1 - L)); ctx.stroke();
  }
}

// 黒板：チョークの粉のかすれ、空間に手書きの丸と矢印
export function chalk(ctx, k) {
  const { ink, w, h, s, lw } = k;
  ctx.fillStyle = ink.fg;
  for (let j = 0; j < 4; j++) {
    ctx.globalAlpha = 0.04;
    ctx.beginPath();
    ctx.ellipse(hash01(61, j, 1) * w, hash01(61, j, 2) * h, s * (0.25 + 0.2 * hash01(61, j, 3)), s * 0.08, (hash01(61, j, 4) - 0.5), 0, TAU);
    ctx.fill();
  }
  ctx.strokeStyle = ink.fg;
  ctx.lineWidth = lw * 2;
  scatter(k, 7, 6, 3.5, 62, hash01, (p, a, j) => {
    ctx.globalAlpha = 0.32 * a;
    if (j % 2 === 0) {
      // 手書きの丸：少しはみ出して閉じきらない
      const r = 0.35 + 0.25 * hash01(62, j, 4);
      const pts = [];
      for (let q = 0; q <= 26; q++) {
        const an = q / 24 * TAU;
        const wob = 1 + 0.06 * Math.sin(q * 1.7 + j);
        pts.push([p[0] + Math.cos(an) * r * wob * 1.3, p[1] + Math.sin(an) * r * wob, p[2]]);
      }
      strokePath(ctx, k, pts);
    } else {
      // 矢印：少し曲がった線と先の「く」
      const L = 0.6 + 0.4 * hash01(62, j, 5), dir = hash01(62, j, 6) < 0.5 ? -1 : 1;
      const pts = [];
      for (let q = 0; q <= 10; q++) { const u = q / 10; pts.push([p[0] + dir * L * u, p[1] - 0.15 * Math.sin(u * Math.PI), p[2]]); }
      strokePath(ctx, k, pts);
      const e = pts[pts.length - 1];
      strokePath(ctx, k, [[e[0] - dir * 0.14, e[1] - 0.1, e[2]], e, [e[0] - dir * 0.14, e[1] + 0.1, e[2]]]);
    }
  });
}

// 森の葉：重なる葉の切り絵が空間に浮かび、ゆっくり揺れる（2 つの濃さの緑）
export function leaves(ctx, k) {
  const { ink, t } = k;
  scatter(k, 30, 5, 3, 71, hash01, (p, a, j) => {
    const L = 0.25 + 0.3 * hash01(71, j, 4), Wd = L * 0.38;
    const rot = hash01(71, j, 5) * TAU + 0.25 * Math.sin(t * 0.8 + j);
    // 葉：先から先へ、上の弧と下の弧（アーモンド形）
    const pts = [];
    for (let q = 0; q <= 16; q++) {
      const u = q <= 8 ? q / 8 : (16 - q) / 8, side = q <= 8 ? 1 : -1;
      const x = (u - 0.5) * L * 2, y = side * Math.sin(u * Math.PI) * Wd;
      pts.push([p[0] + x * Math.cos(rot) - y * Math.sin(rot), p[1] + x * Math.sin(rot) + y * Math.cos(rot), p[2]]);
    }
    ctx.globalAlpha = (0.35 + 0.35 * hash01(71, j, 6)) * a;
    ctx.fillStyle = j % 3 === 0 ? '#1d4a2a' : ink.line;
    fillPoly(ctx, k, pts);
  });
}

// 雨の窓：奥の街の灯りのにじみ、ガラスの水滴、ゆっくり流れ落ちる筋
export function rainWindow(ctx, k) {
  const { ink, w, h, s, t, lw } = k;
  vGrad(ctx, k, ink.top ?? '#2a3646', ink.bg); // 上の色（夜明けの配色で淡くなる）
  for (let j = 0; j < (k.lite ? 5 : 10); j++) {
    ctx.globalAlpha = 0.1 + 0.08 * Math.sin(t * 0.5 + j);
    ctx.fillStyle = j % 3 === 0 ? ink.accent : ink.line;
    dot(ctx, hash01(81, j, 1) * w, (0.45 + 0.5 * hash01(81, j, 2)) * h, s * (0.04 + 0.07 * hash01(81, j, 3)));
  }
  ctx.strokeStyle = ink.fg;
  ctx.lineWidth = lw;
  ctx.globalAlpha = 0.22;
  ctx.beginPath();
  for (let j = 0; j < (k.lite ? 25 : 50); j++) circlePath(ctx, hash01(82, j, 1) * w, hash01(82, j, 2) * h, s * (0.003 + 0.006 * hash01(82, j, 3)));
  ctx.stroke();
  for (let j = 0; j < 10; j++) {
    const x = hash01(83, j, 1) * w;
    const head = fract(hash01(83, j, 2) + t * (0.03 + 0.04 * hash01(83, j, 3))) * h * 1.2;
    const len = s * (0.15 + 0.2 * hash01(83, j, 4));
    ctx.globalAlpha = 0.28;
    ctx.beginPath();
    for (let q = 0; q <= 8; q++) { const y = head - len * (1 - q / 8); ctx[q ? 'lineTo' : 'moveTo'](x + Math.sin(y * 0.03 + j) * s * 0.004, y); }
    ctx.stroke();
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = ink.fg;
    dot(ctx, x, head, s * 0.005);
  }
}
