// 紙もの：テープ・付箋・破れた紙・切手・クリップ・蛍光ペン・ラベル。文字の後ろに敷くもの（back）もある
import { TAU, cl, oc, poly, starPts, label, measure, sparkle } from './common.js';

// テープの切れ端（端がぎざぎざ）
function tape(ctx, S, x, y, w, h, rot, color) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  const pts = [];
  for (let k = 0; k <= 5; k++) pts.push([-w / 2 + (k % 2) * S.u * 0.06, -h / 2 + k * h / 5]);
  for (let k = 5; k >= 0; k--) pts.push([w / 2 - (k % 2) * S.u * 0.06, -h / 2 + k * h / 5]);
  ctx.globalAlpha *= 0.82; ctx.fillStyle = color; poly(ctx, pts); ctx.fill();
  ctx.globalAlpha *= 0.5; ctx.strokeStyle = S.paper; ctx.lineWidth = S.u * 0.05;
  for (let k = 1; k < 4; k++) { ctx.beginPath(); ctx.moveTo(-w / 2 + k * w / 4, -h / 2); ctx.lineTo(-w / 2 + k * w / 4 - h * 0.3, h / 2); ctx.stroke(); }
  ctx.restore();
}

export const PAPER = [
  {
    id: 'tape-corners', name: 'テープで貼った', at: 'line', size: 0.55, pop: 'slap', tilt: 0,
    draw(ctx, S) {
      const u = S.u, w = S.w / 2 + u * 0.3, h = S.h / 2 + u * 0.2;
      const q1 = oc(S.t / 0.25), q2 = oc((S.t - 0.12) / 0.25);
      if (q1 > 0) tape(ctx, S, -w, -h, u * 2 * q1, u * 0.8, -0.65, S.c2);
      if (q2 > 0) tape(ctx, S, w, h, u * 2 * q2, u * 0.8, -0.6, S.c3 === '#FFFFFF' ? S.c1 : S.c3);
    },
  },
  {
    id: 'sticky', name: '付箋', at: 'on', size: 0.5, back: true, inkText: true, pop: 'slap', tilt: 0.12,
    draw(ctx, S) {
      const u = S.u, w = S.w + u * 1.2, h = S.h + u * 1.1, lift = u * (0.25 + 0.1 * Math.sin(S.t * 1.8));
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; poly(ctx, [[-w / 2 + u * 0.1, -h / 2 + u * 0.15], [w / 2 + u * 0.1, -h / 2 + u * 0.15], [w / 2 + u * 0.2, h / 2 + u * 0.25], [-w / 2 + u * 0.1, h / 2 + u * 0.15]]); ctx.fill();
      ctx.fillStyle = S.light ? '#FFE45C' : S.c2; poly(ctx, [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2 - lift], [w / 2 - lift, h / 2], [-w / 2, h / 2]]); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(-w / 2, -h / 2, w, u * 0.35);
      ctx.fillStyle = 'rgba(255,255,255,0.55)'; poly(ctx, [[w / 2, h / 2 - lift], [w / 2 - lift, h / 2], [w / 2 - lift * 0.8, h / 2 - lift * 0.8]]); ctx.fill();
      ctx.restore();
    },
  },
  {
    id: 'torn', name: '破れた紙', at: 'line', size: 0.5, back: true, inkText: true, pop: 'unfold', tilt: 0,
    draw(ctx, S) {
      const u = S.u, w = S.w + u * 2, h = S.h + u * 1.2, n = 18, top = [], bot = [];
      for (let k = 0; k <= n; k++) { const x = -w / 2 + k * w / n; top.push([x, -h / 2 + (S.r(k) - 0.5) * u * 0.45]); bot.push([x, h / 2 + (S.r(k + 40) - 0.5) * u * 0.45]); }
      const pts = [...top, ...bot.reverse()];
      ctx.save(); ctx.rotate((S.r(99) - 0.5) * 0.08);
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.translate(u * 0.08, u * 0.12); poly(ctx, pts); ctx.fill(); ctx.translate(-u * 0.08, -u * 0.12);
      ctx.fillStyle = S.light ? '#FFFFFF' : '#F3EEE2'; poly(ctx, pts); ctx.fill();
      ctx.restore();
    },
  },
  {
    id: 'postage', name: '切手', at: 'corner', size: 0.7, pop: 'slap',
    draw(ctx, S) {
      const u = S.u, w = u * 1.6, h = u * 1.95, r = u * 0.09;
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.fillRect(-w / 2 + u * 0.06, -h / 2 + u * 0.09, w, h);
      ctx.fillStyle = S.paper; ctx.fillRect(-w / 2, -h / 2, w, h);
      // ぎざぎざの縁（背景の色の丸で欠く）
      ctx.fillStyle = S.bg;
      for (let x = -w / 2; x <= w / 2 + 1; x += u * 0.27) for (const y of [-h / 2, h / 2]) { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); }
      for (let y = -h / 2; y <= h / 2 + 1; y += u * 0.27) for (const x of [-w / 2, w / 2]) { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); }
      const iw = w - u * 0.4, ih = h - u * 0.6;
      ctx.fillStyle = S.c1; ctx.fillRect(-iw / 2, -h / 2 + u * 0.2, iw, ih);
      // 中の絵：月と星
      ctx.fillStyle = S.c2; ctx.beginPath(); ctx.arc(-u * 0.05, -u * 0.25, u * 0.38, 0, TAU); ctx.fill();
      ctx.fillStyle = S.c1; ctx.beginPath(); ctx.arc(u * 0.12, -u * 0.35, u * 0.32, 0, TAU); ctx.fill();
      sparkle(ctx, u * 0.4, u * 0.2, u * 0.16 * (0.6 + 0.4 * Math.sin(S.t * 5)), S.paper);
      label(ctx, S, S.word, 0, h / 2 - u * 0.24, u * 0.24, S.ink, w - u * 0.3, { weight: '900' });
      ctx.restore();
    },
  },
  {
    id: 'clip', name: 'クリップ', at: 'cornerL', size: 0.6, pop: 'drop', tilt: 0.3,
    draw(ctx, S) {
      const u = S.u;
      ctx.save(); ctx.rotate(-0.35 + Math.sin(S.t * 2) * 0.03);
      ctx.strokeStyle = S.light ? '#5B6270' : '#C9CED8'; ctx.lineWidth = u * 0.13; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(u * 0.25, u * 0.4); ctx.lineTo(u * 0.25, -u * 0.75); ctx.arc(0, -u * 0.75, u * 0.25, 0, Math.PI, true); ctx.lineTo(-u * 0.25, u * 0.75); ctx.arc(u * 0.05, u * 0.75, u * 0.3, Math.PI, 0, true); ctx.lineTo(u * 0.35, -u * 0.45);
      ctx.stroke();
      ctx.restore();
    },
  },
  {
    id: 'marker', name: '蛍光ペンでなぞる', at: 'on', size: 0.5, back: true, pop: 'draw', tilt: 0,
    draw(ctx, S) {
      const u = S.u, w = S.w + u * 0.8, h = S.h * 0.55;
      ctx.save(); ctx.globalAlpha *= 0.75; ctx.fillStyle = S.light ? '#FFF04A' : S.c1;
      const f = oc(S.f);
      const pts = [];
      for (let k = 0; k <= 10; k++) pts.push([-w / 2 + k * w / 10 * f, -h / 2 + u * 0.15 + (S.r(k) - 0.5) * u * 0.18]);
      for (let k = 10; k >= 0; k--) pts.push([-w / 2 + k * w / 10 * f, h / 2 + u * 0.15 + (S.r(k + 20) - 0.5) * u * 0.18]);
      poly(ctx, pts); ctx.fill();
      ctx.restore();
    },
  },
  {
    id: 'label-tape', name: '打ち出しラベル', at: 'under', size: 0.6, pop: 'none', tilt: 0.15,
    draw(ctx, S) {
      const u = S.u, text = S.word, n = Array.from(text).length;
      const fw = measure(ctx, S, text, u * 0.75, '700'), w = fw + u * 1.2, h = u * 1.2;
      const shown = Math.min(1, S.t / (0.06 * n + 0.15));
      const wc = u * 0.6 + fw * shown;
      ctx.save(); ctx.translate(-w / 2, 0);
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(u * 0.06, -h / 2 + u * 0.08, wc, h);
      ctx.fillStyle = S.ink; ctx.fillRect(0, -h / 2, wc, h);
      ctx.save(); ctx.beginPath(); ctx.rect(0, -h / 2, wc, h); ctx.clip();
      label(ctx, S, text, u * 0.6, 0, u * 0.75, S.paper, Infinity, { weight: '700', align: 'left', stroke: 'rgba(255,255,255,0.18)', strokeW: u * 0.06 });
      ctx.restore();
      ctx.restore();
    },
  },
  {
    id: 'pin-note', name: '画びょうで留めたメモ', at: 'side', size: 0.5, pop: 'drop', tilt: 0.3,
    draw(ctx, S) {
      const u = S.u, w = Math.max(u * 2.4, measure(ctx, S, S.word, u * 0.55, '500') + u * 0.9), h = u * 1.7;
      ctx.save(); ctx.rotate(Math.sin(S.t * 2.2) * 0.04);
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(-w / 2 + u * 0.08, -h / 2 + u * 0.12, w, h);
      ctx.fillStyle = '#FBF8EF'; ctx.fillRect(-w / 2, -h / 2, w, h);
      ctx.strokeStyle = 'rgba(80,120,200,0.35)'; ctx.lineWidth = u * 0.03; for (let k = 1; k < 4; k++) { ctx.beginPath(); ctx.moveTo(-w / 2, -h / 2 + k * h / 4 + u * 0.1); ctx.lineTo(w / 2, -h / 2 + k * h / 4 + u * 0.1); ctx.stroke(); }
      label(ctx, S, S.word, 0, u * 0.15, u * 0.55, '#1C1A22', w - u * 0.4, { weight: '500' });
      ctx.fillStyle = S.c1; ctx.beginPath(); ctx.arc(0, -h / 2 + u * 0.2, u * 0.2, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.beginPath(); ctx.arc(-u * 0.06, -h / 2 + u * 0.14, u * 0.07, 0, TAU); ctx.fill();
      ctx.restore();
    },
  },
  {
    id: 'stamp-ink', name: 'インクのスタンプ（星）', at: 'corner', size: 0.7, pop: 'stamp',
    draw(ctx, S) {
      const u = S.u;
      ctx.save(); ctx.globalAlpha *= 0.85; ctx.strokeStyle = S.c1; ctx.lineWidth = u * 0.09;
      ctx.beginPath(); ctx.arc(0, 0, u, 0, TAU); ctx.stroke();
      ctx.fillStyle = S.c1; poly(ctx, starPts(5, u * 0.6, u * 0.26)); ctx.fill();
      ctx.fillStyle = S.bg; for (let k = 0; k < 14; k++) { ctx.beginPath(); ctx.arc((S.r(k) - 0.5) * u * 1.8, (S.r(k + 30) - 0.5) * u * 1.8, u * 0.03 + S.r(k + 60) * u * 0.05, 0, TAU); ctx.fill(); }
      ctx.restore();
    },
  },
  {
    id: 'polaroid', name: '写真の枠', at: 'corner', size: 0.65, pop: 'slap', tilt: 0.5,
    draw(ctx, S) {
      const u = S.u, w = u * 1.7, h = u * 2.05;
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(-w / 2 + u * 0.07, -h / 2 + u * 0.1, w, h);
      ctx.fillStyle = '#FBFAF6'; ctx.fillRect(-w / 2, -h / 2, w, h);
      const iw = w - u * 0.24, ih = iw;
      const dev = cl(S.t / 1.4);
      ctx.fillStyle = S.c1; ctx.fillRect(-iw / 2, -h / 2 + u * 0.12, iw, ih);
      ctx.save(); ctx.beginPath(); ctx.rect(-iw / 2, -h / 2 + u * 0.12, iw, ih); ctx.clip();
      ctx.fillStyle = S.c2; ctx.beginPath(); ctx.arc(u * 0.25, -h / 2 + u * 0.12 + ih * 0.35, u * 0.28, 0, TAU); ctx.fill();
      ctx.fillStyle = S.ink; poly(ctx, [[-iw / 2, -h / 2 + u * 0.12 + ih], [-iw / 2 + iw * 0.35, -h / 2 + u * 0.12 + ih * 0.5], [-iw / 2 + iw * 0.6, -h / 2 + u * 0.12 + ih * 0.75], [-iw / 2 + iw * 0.8, -h / 2 + u * 0.12 + ih * 0.6], [iw / 2, -h / 2 + u * 0.12 + ih]]); ctx.fill();
      ctx.globalAlpha *= 1 - dev; ctx.fillStyle = '#2A2630'; ctx.fillRect(-iw / 2, -h / 2, iw, h);
      ctx.restore();
      label(ctx, S, S.word, 0, h / 2 - u * 0.3, u * 0.28, '#1C1A22', w - u * 0.3, { weight: '500' });
      ctx.restore();
    },
  },
];
