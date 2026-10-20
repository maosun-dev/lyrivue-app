// 吹き出し：行のそばに出る小さな吹き出し。中身は言葉・「！」・点々など
import { TAU, cl, poly, rrect, starPts, die, label, measure, heartPath, sparkle } from './common.js';

// しっぽ（吹き出しから下向き・左下の言葉を指す）
const tail = (c, x, y, w, tx, ty) => { c.moveTo(x - w, y); c.lineTo(tx, ty); c.lineTo(x + w, y); };

export const BUBBLE = [
  {
    id: 'round-bang', name: '丸い吹き出し（！！）', size: 0.7, spots: ['tr', 'tl'],
    draw(ctx, S) {
      const u = S.u, s = 1 + S.b * 0.08;
      die(ctx, S, c => { c.beginPath(); c.ellipse(0, 0, u * 1.05 * s, u * 0.85 * s, 0, 0, TAU); c.moveTo(-u * 0.5, u * 0.6); tail(c, -u * 0.45, u * 0.6, u * 0.22, -u * 1.0, u * 1.25); c.closePath(); }, S.paper);
      label(ctx, S, '!!', 0, 0, u * 1.0, S.c1, u * 1.6, { weight: '900' });
    },
  },
  {
    id: 'shout', name: 'ギザギザの叫び', size: 0.62,
    draw(ctx, S) {
      const u = S.u, w = Math.max(u * 1.3, measure(ctx, S, S.word, u * 0.6, '900') / 2 + u * 0.55);
      const pts = starPts(16, 1, 0.78, Math.sin(S.t * 20) * 0.02).map(([x, y], k) => [x * w * (1 + (k % 4 === 0 ? 0.12 : 0)), y * u * 1.05]);
      die(ctx, S, c => poly(c, pts), S.c2, { border: 0.1 });
      ctx.save(); ctx.translate(Math.sin(S.t * 40) * u * 0.02, 0);
      label(ctx, S, S.word, 0, 0, u * 0.6, S.ink, w * 1.5, { weight: '900' });
      ctx.restore();
    },
  },
  {
    id: 'thought', name: 'もくもくの考え中', size: 0.62,
    draw(ctx, S) {
      const u = S.u;
      for (const [x, y, r, d] of [[-u * 1.1, u * 1.55, u * 0.14, 0], [-u * 0.75, u * 1.1, u * 0.22, 0.12]]) {
        if (S.t < d) continue;
        die(ctx, S, c => { c.beginPath(); c.arc(x, y + Math.sin(S.t * 3 + x) * u * 0.04, r, 0, TAU); }, S.paper, { border: 0.07 });
      }
      if (S.t < 0.22) return;
      const puffs = [[-0.8, 0.1, 0.5], [-0.3, -0.35, 0.55], [0.35, -0.38, 0.55], [0.85, 0.05, 0.5], [0.4, 0.4, 0.5], [-0.3, 0.42, 0.5]];
      die(ctx, S, c => { c.beginPath(); for (const [x, y, r] of puffs) { const R = r * u * (1 + Math.sin(S.t * 2 + x * 3) * 0.04); c.moveTo(x * u + R, y * u); c.arc(x * u, y * u, R, 0, TAU); } }, S.paper, { ink: false });
      ctx.fillStyle = S.ink;
      for (let k = 0; k < 3; k++) { const on = (Math.floor(S.t * 3) % 4) > k; ctx.globalAlpha *= on ? 1 : 0.25; ctx.beginPath(); ctx.arc((k - 1) * u * 0.38, 0, u * 0.1, 0, TAU); ctx.fill(); ctx.globalAlpha /= on ? 1 : 0.25; }
    },
  },
  {
    id: 'chat', name: '四角いチャット', at: 'above', size: 0.68,
    draw(ctx, S) {
      const u = S.u, w = Math.max(u * 2.2, measure(ctx, S, S.word, u * 0.62) + u * 0.9), h = u * 1.2;
      die(ctx, S, c => { rrect(c, -w / 2, -h / 2, w, h, u * 0.35); c.moveTo(-w / 2 + u * 0.5, h / 2 - 1); c.lineTo(-w / 2 + u * 0.3, h / 2 + u * 0.45); c.lineTo(-w / 2 + u * 0.95, h / 2 - 1); c.closePath(); }, S.c1, { border: 0.1 });
      label(ctx, S, S.word, 0, 0, u * 0.62, S.paper, w - u * 0.5);
    },
  },
  {
    id: 'whisper', name: '点線のささやき', at: 'above', size: 0.7, pop: 'draw',
    draw(ctx, S) {
      const u = S.u, w = Math.max(u * 2.4, measure(ctx, S, S.word, u * 0.5, '500') + u * 1.0);
      ctx.save(); ctx.strokeStyle = S.fg; ctx.lineWidth = u * 0.06; ctx.setLineDash([u * 0.06, u * 0.12]); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.ellipse(0, 0, w / 2, u * 0.75, 0, -Math.PI / 2, -Math.PI / 2 + TAU * S.f); ctx.stroke(); ctx.restore();
      ctx.save(); ctx.globalAlpha *= cl((S.t - 0.3) / 0.4);
      label(ctx, S, S.word, 0, 0, u * 0.5, S.fg, w - u * 0.6, { weight: '500' });
      ctx.restore();
    },
  },
  {
    id: 'mini-qa', name: '小さな「!?」', size: 0.55, tilt: 0.6,
    draw(ctx, S) {
      const u = S.u, k = 1 + S.b * 0.15;
      die(ctx, S, c => { c.beginPath(); c.arc(0, 0, u * k, 0, TAU); c.moveTo(-u * 0.55, u * 0.7); c.lineTo(-u * 1.0, u * 1.2); c.lineTo(-u * 0.15, u * 0.95); c.closePath(); }, S.c1);
      label(ctx, S, '!?', 0, 0, u * 1.0, S.paper, u * 1.5, { weight: '900' });
    },
  },
  {
    id: 'heart-bubble', name: 'ハートの吹き出し', size: 0.62,
    draw(ctx, S) {
      const u = S.u, s = u * (1.1 + S.b * 0.08);
      die(ctx, S, c => { heartPath(c, s); }, S.c1);
      label(ctx, S, S.word, 0, -u * 0.05, u * 0.42, S.paper, u * 1.5, { weight: '900' });
      sparkle(ctx, s * 0.95, -s * 0.8, u * 0.25 * (0.5 + 0.5 * Math.sin(S.t * 6)), S.c2);
    },
  },
  {
    id: 'typing', name: '入力中の点々', at: 'side', size: 0.55,
    draw(ctx, S) {
      const u = S.u, w = u * 2.3, h = u * 1.15;
      die(ctx, S, c => { rrect(c, -w / 2, -h / 2, w, h, h / 2); c.moveTo(-w / 2 + u * 0.1, h / 2 - u * 0.3); c.lineTo(-w / 2 - u * 0.3, h / 2 + u * 0.2); c.lineTo(-w / 2 + u * 0.55, h / 2 - 1); c.closePath(); }, S.paper);
      ctx.fillStyle = S.ink;
      for (let k = 0; k < 3; k++) { const y = -Math.max(0, Math.sin(S.t * 7 - k * 0.9)) * u * 0.22; ctx.beginPath(); ctx.arc((k - 1) * u * 0.5, y, u * 0.15, 0, TAU); ctx.fill(); }
    },
  },
  {
    id: 'shout-lines', name: '叫びの線つき吹き出し', at: 'above', size: 0.66,
    draw(ctx, S) {
      const u = S.u, w = Math.max(u * 2.2, measure(ctx, S, S.word, u * 0.7, '900') + u * 0.8), h = u * 1.3;
      die(ctx, S, c => { rrect(c, -w / 2, -h / 2, w, h, u * 0.15); c.moveTo(-u * 0.2, h / 2 - 1); c.lineTo(-u * 0.6, h / 2 + u * 0.55); c.lineTo(u * 0.3, h / 2 - 1); c.closePath(); }, S.ink, { border: 0.1 });
      label(ctx, S, S.word, 0, 0, u * 0.7, S.c2, w - u * 0.4, { weight: '900' });
      ctx.strokeStyle = S.fg; ctx.lineWidth = u * 0.08; ctx.lineCap = 'round';
      const k = 0.6 + 0.4 * Math.abs(Math.sin(S.t * 8));
      for (const a of [-2.5, -2.2, -0.9, -0.6]) { const x0 = Math.cos(a) * (w / 2 + u * 0.25), y0 = Math.sin(a) * (h / 2 + u * 0.25); ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0 + Math.cos(a) * u * 0.55 * k, y0 + Math.sin(a) * u * 0.55 * k); ctx.stroke(); }
    },
  },
];
