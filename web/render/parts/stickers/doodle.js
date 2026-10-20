// 手描きの記号：ペンで描いたような線が順に引かれ、1 秒に 8 回ふるえる（S.f が描かれる進み）
import { TAU, cl, oc, poly, starPts, arcPts, hand, heartPath, sparkle, label } from './common.js';

const W = 0.13; // 線の太さ（u 単位）
// 名前どおりの線を時間差で引く：list = [[点の並び, 始まりの割合]]
const strokes = (ctx, S, list, color, width = W) => list.forEach(([pts, d], k) => hand(ctx, S, pts, cl((S.f - d) / Math.max(0.05, 1 - d)), width, color, k));

export const DOODLE = [
  {
    id: 'arrow-curve', name: '曲がった矢印', at: 'side', size: 0.84, pop: 'draw',
    draw(ctx, S) {
      const u = S.u, wig = Math.sin(S.t * 5) * u * 0.06;
      const body = []; for (let k = 0; k <= 16; k++) { const v = k / 16; body.push([u * 1.2 - v * u * 2.0 + wig * v, -u * 0.9 + Math.sin(v * Math.PI) * -u * 0.55 + v * u * 1.0]); }
      const [ex, ey] = body[body.length - 1];
      strokes(ctx, S, [[body, 0], [[[ex + u * 0.45, ey - u * 0.25], [ex, ey], [ex + u * 0.4, ey + u * 0.35]], 0.65]], S.c1);
    },
  },
  {
    id: 'circle-around', name: '丸で囲む', at: 'on', size: 0.5, pop: 'draw', tilt: 0,
    draw(ctx, S) {
      const u = S.u, rx = S.w / 2 + u * 0.7, ry = S.h / 2 + u * 0.45;
      const pts = arcPts(0, 0, rx, ry, -2.6, -2.6 + TAU * 1.12, 40).map(([x, y], k) => [x, y + k * u * 0.006]);
      strokes(ctx, S, [[pts, 0]], S.c1);
    },
  },
  {
    id: 'wave-under', name: '波線の下線', at: 'under', size: 0.5, pop: 'draw', tilt: 0,
    draw(ctx, S) {
      const u = S.u, w = S.w + u, ph = S.t * 6, pts = [];
      for (let k = 0; k <= 30; k++) { const v = k / 30; pts.push([-w / 2 + v * w, Math.sin(v * 12 + ph) * u * 0.18]); }
      strokes(ctx, S, [[pts, 0]], S.c1);
    },
  },
  {
    id: 'double-under', name: '二重の下線', at: 'under', size: 0.5, pop: 'draw', tilt: 0,
    draw(ctx, S) {
      const u = S.u, w = S.w + u * 0.6;
      strokes(ctx, S, [[[[-w / 2, 0], [w / 2, -u * 0.08]], 0], [[[-w / 2 + u * 0.3, u * 0.32], [w / 2 + u * 0.2, u * 0.22]], 0.45]], S.c1, 0.11);
    },
  },
  {
    id: 'kira-three', name: 'キラキラ三つ', size: 0.81, pop: 'none', spots: ['tr', 'tl', 'br', 'bl'],
    draw(ctx, S) {
      const u = S.u;
      [[0, 0, 0.75, 0], [u * 0.9, -u * 0.7, 0.45, 1.3], [u * 0.85, u * 0.55, 0.32, 2.4]].forEach(([x, y, r, ph], k) => {
        const on = oc((S.t - k * 0.12) / 0.3);
        const tw = 0.65 + 0.35 * Math.sin(S.t * 6 + ph);
        sparkle(ctx, x, y, u * r * on * tw, k === 0 ? S.c2 : S.fg);
      });
    },
  },
  {
    id: 'surprise', name: '驚きの線', at: 'corner', size: 0.81, pop: 'draw', spots: ['tr', 'tl'],
    draw(ctx, S) {
      const u = S.u, k = 1 + S.b * 0.25;
      strokes(ctx, S, [-1.0, -0.45, 0.1].map((a, j) => [[[Math.cos(a - 0.9) * u * 0.3, Math.sin(a - 0.9) * u * 0.3], [Math.cos(a - 0.9) * u * 1.1 * k, Math.sin(a - 0.9) * u * 1.1 * k]], j * 0.15]), S.fg);
    },
  },
  {
    id: 'sweat', name: '汗', at: 'corner', size: 0.74, pop: 'drop', spots: ['tr', 'tl'],
    draw(ctx, S) {
      const u = S.u, y = (S.t % 1.6) > 1.2 ? ((S.t % 1.6) - 1.2) * u * 0.8 : 0;
      ctx.save(); ctx.translate(0, y);
      ctx.beginPath(); ctx.moveTo(0, -u); ctx.bezierCurveTo(u * 0.25, -u * 0.4, u * 0.6, -u * 0.05, u * 0.6, u * 0.3); ctx.arc(0, u * 0.3, u * 0.6, 0, Math.PI); ctx.bezierCurveTo(-u * 0.6, -u * 0.05, -u * 0.25, -u * 0.4, 0, -u); ctx.closePath();
      ctx.fillStyle = '#8FD8FF'; ctx.fill(); ctx.strokeStyle = S.ink === S.fg ? S.fg : '#1C3E66'; ctx.lineWidth = u * 0.09; ctx.stroke();
      ctx.restore();
    },
  },
  {
    id: 'anger', name: '怒りの印', at: 'corner', size: 0.68, pop: 'stamp', spots: ['tr', 'tl', 't'],
    draw(ctx, S) {
      const u = S.u * (1 + S.b * 0.2);
      ctx.save(); ctx.strokeStyle = S.c1; ctx.lineWidth = u * 0.22; ctx.lineCap = 'round';
      for (let k = 0; k < 4; k++) { ctx.save(); ctx.rotate(k * Math.PI / 2 + Math.PI / 4); ctx.beginPath(); ctx.moveTo(u * 0.25, -u * 0.6); ctx.quadraticCurveTo(u * 0.3, -u * 0.3, u * 0.6, -u * 0.25); ctx.stroke(); ctx.restore(); }
      ctx.restore();
    },
  },
  {
    id: 'spiral', name: 'ぐるぐる', at: 'corner', size: 0.74, pop: 'draw', spots: ['tr', 'tl', 'r', 'l'],
    draw(ctx, S) {
      const u = S.u, pts = [];
      for (let k = 0; k <= 48; k++) { const v = k / 48, a = v * TAU * 2.6 + S.t * 3; pts.push([Math.cos(a) * u * v, Math.sin(a) * u * v * 0.8]); }
      strokes(ctx, S, [[pts, 0]], S.fg, 0.1);
    },
  },
  {
    id: 'notes-float', name: '浮かぶ音符', at: 'side', size: 0.68, pop: 'none',
    draw(ctx, S) {
      const u = S.u;
      for (let k = 0; k < 3; k++) {
        const life = ((S.t + k * 0.7) % 2.1) / 2.1, a = Math.sin(life * Math.PI);
        if (S.t < k * 0.25) continue;
        const x = (k - 1) * u * 0.9 + Math.sin(life * 6 + k) * u * 0.25, y = u * 0.8 - life * u * 2.2;
        ctx.save(); ctx.globalAlpha *= a; ctx.translate(x, y); ctx.rotate(Math.sin(life * 8 + k) * 0.2);
        ctx.fillStyle = k === 1 ? S.c1 : S.fg; ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = u * 0.1; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.ellipse(0, 0, u * 0.28, u * 0.2, -0.4, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.moveTo(u * 0.24, -u * 0.05); ctx.lineTo(u * 0.24, -u * 0.9); ctx.quadraticCurveTo(u * 0.5, -u * 0.7, u * 0.6, -u * 0.45); ctx.stroke();
        ctx.restore();
      }
    },
  },
  {
    id: 'hanamaru', name: '花丸', at: 'corner', size: 0.81, pop: 'draw', spots: ['tr', 'tl', 'r', 'l', 'br'],
    draw(ctx, S) {
      const u = S.u, sp = [];
      for (let k = 0; k <= 40; k++) { const v = k / 40, a = v * TAU * 2.2 - 1.6; sp.push([Math.cos(a) * u * 0.42 * (0.3 + v * 0.7), Math.sin(a) * u * 0.42 * (0.3 + v * 0.7)]); }
      const pet = [];
      for (let k = 0; k <= 60; k++) { const v = k / 60, a = v * TAU - 1.6; const r = u * (0.72 + Math.abs(Math.sin(v * Math.PI * 5)) * 0.32); pet.push([Math.cos(a) * r, Math.sin(a) * r]); }
      strokes(ctx, S, [[sp, 0], [pet, 0.35]], S.c1, 0.1);
    },
  },
  {
    id: 'check', name: 'チェック', at: 'corner', size: 0.81, pop: 'draw', spots: ['tr', 'tl', 'r', 'l'], noMirror: true,
    draw(ctx, S) {
      const u = S.u;
      strokes(ctx, S, [[[[-u * 0.8, -u * 0.05], [-u * 0.2, u * 0.6], [u * 0.95, -u * 0.85]], 0]], S.c1, 0.2);
    },
  },
  {
    id: 'cross', name: 'ばつ印', at: 'corner', size: 0.68, pop: 'draw', spots: ['tr', 'tl', 't'],
    draw(ctx, S) {
      const u = S.u;
      strokes(ctx, S, [[[[-u * 0.7, -u * 0.7], [u * 0.7, u * 0.7]], 0], [[[u * 0.7, -u * 0.7], [-u * 0.7, u * 0.7]], 0.45]], S.c1, 0.2);
    },
  },
  {
    id: 'bang-pair', name: '手描きのビックリ', at: 'corner', size: 0.74, pop: 'draw', spots: ['tr', 'tl', 't'],
    draw(ctx, S) {
      const u = S.u, j = S.b * u * 0.1;
      for (const [x, d, r] of [[-u * 0.35, 0, -0.15], [u * 0.35, 0.3, 0.12]]) {
        ctx.save(); ctx.translate(x, -j); ctx.rotate(r);
        strokes(ctx, S, [[[[0, -u], [0, u * 0.25]], d]], S.fg, 0.2);
        if (S.f > d + 0.4) { ctx.fillStyle = S.fg; ctx.beginPath(); ctx.arc(0, u * 0.7, u * 0.13, 0, TAU); ctx.fill(); }
        ctx.restore();
      }
    },
  },
  {
    id: 'question', name: 'はてな', at: 'corner', size: 0.74, pop: 'draw', spots: ['tr', 'tl', 'r'], noMirror: true,
    draw(ctx, S) {
      const u = S.u, tilt = Math.sin(S.t * 2.5) * 0.18;
      ctx.save(); ctx.rotate(tilt);
      const pts = arcPts(0, -u * 0.35, u * 0.5, u * 0.5, Math.PI * 1.05, Math.PI * 2.4, 16); pts.push([0, u * 0.3]);
      strokes(ctx, S, [[pts, 0]], S.fg, 0.18);
      if (S.f > 0.8) { ctx.fillStyle = S.fg; ctx.beginPath(); ctx.arc(0, u * 0.75, u * 0.13, 0, TAU); ctx.fill(); }
      ctx.restore();
    },
  },
  {
    id: 'speed', name: '速さの線', at: 'lineLeft', size: 0.5, pop: 'none', tilt: 0,
    draw(ctx, S) {
      const u = S.u;
      ctx.save(); ctx.strokeStyle = S.fg; ctx.lineCap = 'round';
      for (let k = 0; k < 6; k++) {
        const y = (k - 2.5) * u * 0.5, len = u * (1.2 + S.r(k) * 1.6), ph = ((S.t * 2.2 + S.r(k + 7)) % 1);
        ctx.globalAlpha *= 1 - ph * 0.6; ctx.lineWidth = u * (0.06 + S.r(k + 3) * 0.06);
        const x1 = -ph * u * 0.9; ctx.beginPath(); ctx.moveTo(x1, y); ctx.lineTo(x1 - len, y); ctx.stroke();
        ctx.globalAlpha /= 1 - ph * 0.6;
      }
      ctx.restore();
    },
  },
  {
    id: 'hearts-up', name: '浮かぶハート', at: 'corner', size: 0.75, pop: 'none', spots: ['tr', 'tl', 't'],
    draw(ctx, S) {
      const u = S.u;
      for (let k = 0; k < 4; k++) {
        if (S.t < k * 0.2) continue;
        const life = ((S.t - k * 0.2 + k * 0.45) % 1.8) / 1.8;
        ctx.save(); ctx.globalAlpha *= Math.sin(life * Math.PI); ctx.translate((k - 1.5) * u * 0.7 + Math.sin(life * 7 + k) * u * 0.3, u - life * u * 3);
        heartPath(ctx, u * (0.35 + 0.15 * (k % 2))); ctx.fillStyle = k % 2 ? S.c1 : S.c2; ctx.fill();
        ctx.restore();
      }
    },
  },
  {
    id: 'halo', name: '頭の上の輪', at: 'above', size: 0.68, pop: 'drop', tilt: 0,
    draw(ctx, S) {
      const u = S.u, rx = Math.max(u * 1.2, S.w * 0.35);
      ctx.save(); ctx.translate(0, Math.sin(S.t * 2.4) * u * 0.1); ctx.rotate(Math.sin(S.t * 1.3) * 0.08);
      ctx.strokeStyle = S.c2; ctx.lineWidth = u * 0.16; ctx.beginPath(); ctx.ellipse(0, u * 0.3, rx, u * 0.32, 0, 0, TAU); ctx.stroke();
      ctx.strokeStyle = S.paper; ctx.globalAlpha *= 0.6; ctx.lineWidth = u * 0.05; ctx.beginPath(); ctx.ellipse(0, u * 0.3, rx, u * 0.32, 0, Math.PI * 1.1, Math.PI * 1.5); ctx.stroke();
      ctx.restore();
    },
  },
  {
    id: 'orbit', name: '回る小さな星', at: 'on', size: 0.55, pop: 'none', tilt: 0,
    draw(ctx, S) {
      const u = S.u, rx = S.w / 2 + u * 1.2, ry = S.h / 2 + u * 0.4, a = S.t * 2.6;
      const grow = oc(S.t / 0.4);
      ctx.save(); ctx.globalAlpha *= 0.5; ctx.strokeStyle = S.fg; ctx.lineWidth = u * 0.05; ctx.setLineDash([u * 0.1, u * 0.2]); ctx.beginPath(); ctx.ellipse(0, 0, rx * grow, ry * grow, -0.12, 0, TAU); ctx.stroke(); ctx.restore();
      for (let k = 0; k < 2; k++) {
        const b = a + k * Math.PI, x = Math.cos(b) * rx * grow, y = Math.sin(b) * ry * grow;
        const c = Math.cos(-0.12), s = Math.sin(-0.12);
        ctx.fillStyle = k ? S.c1 : S.c2; poly(ctx, starPts(5, u * 0.5, u * 0.22, b).map(([px, py]) => [x * c - y * s + px, x * s + y * c + py])); ctx.fill();
      }
    },
  },
  {
    id: 'brackets', name: '手描きのかぎかっこ', at: 'on', size: 0.5, pop: 'draw', tilt: 0,
    draw(ctx, S) {
      const u = S.u, w = S.w / 2 + u * 0.6, h = S.h / 2 + u * 0.35;
      strokes(ctx, S, [[[[-w + u * 0.7, -h], [-w, -h], [-w, h * 0.3]], 0], [[[w - u * 0.7, h], [w, h], [w, -h * 0.3]], 0.35]], S.c1, 0.14);
    },
  },
  {
    id: 'shooting', name: '流れ星', at: 'above', size: 0.85, pop: 'none',
    draw(ctx, S) {
      const u = S.u, v = ((S.t * 0.7) % 1), x = u * 2 - v * u * 4, y = -u * 0.5 + v * u * 1.2;
      ctx.save(); ctx.globalAlpha *= Math.sin(v * Math.PI);
      ctx.strokeStyle = S.fg; ctx.lineCap = 'round';
      for (let k = 0; k < 3; k++) { ctx.lineWidth = u * (0.1 - k * 0.025); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + u * (1.6 + k * 0.4), y - u * (0.48 + k * 0.12) + (k - 1) * u * 0.12); ctx.stroke(); }
      ctx.fillStyle = S.c2; poly(ctx, starPts(5, u * 0.45, u * 0.2, S.t * 4).map(([px, py]) => [x + px, y + py])); ctx.fill();
      ctx.restore();
    },
  },
  {
    id: 'pop-dots', name: '弾ける点', at: 'corner', size: 1.0, pop: 'none',
    draw(ctx, S) {
      const u = S.u, cyc = (S.t % 1.2) / 1.2, spread = oc(cyc * 1.6), a = 1 - cyc;
      ctx.save(); ctx.globalAlpha *= a;
      for (let k = 0; k < 8; k++) { const ang = k / 8 * TAU + 0.2, r = u * (0.3 + spread * 0.9); ctx.fillStyle = k % 2 ? S.c1 : S.c2; ctx.beginPath(); ctx.arc(Math.cos(ang) * r, Math.sin(ang) * r, u * 0.12 * (1 - cyc * 0.5), 0, TAU); ctx.fill(); }
      ctx.restore();
    },
  },
  {
    id: 'scribble-star', name: '手描きの星', at: 'corner', size: 0.81, pop: 'draw',
    draw(ctx, S) {
      const u = S.u, rot = Math.sin(S.t * 2) * 0.15;
      const pts = []; for (let k = 0; k <= 5; k++) { const a = -Math.PI / 2 + rot + k * TAU * 2 / 5; pts.push([Math.cos(a) * u, Math.sin(a) * u]); }
      strokes(ctx, S, [[pts, 0]], S.c2, 0.12);
    },
  },
  {
    id: 'mark-word', name: '言葉に添える手書きの「！」', at: 'corner', size: 0.68, pop: 'slap', spots: ['tr', 'tl', 'r'],
    draw(ctx, S) {
      const u = S.u;
      label(ctx, S, '!', 0, 0, u * 2, S.c1, Infinity, { weight: '900', stroke: S.paper, strokeW: u * 0.3 });
    },
  },
];
