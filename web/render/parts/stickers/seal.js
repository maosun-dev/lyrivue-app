// シール：白い縁で切り抜いた小さな絵（星・ハート・稲妻…）。絵は全部ここで描く自作
import { TAU, poly, starPts, die, label, heartPath, sparkle } from './common.js';

const eyeDots = (ctx, S, y, gap, r) => { ctx.fillStyle = S.ink; for (const sd of [-1, 1]) { ctx.beginPath(); ctx.ellipse(sd * gap, y, r * 0.7, r, 0, 0, TAU); ctx.fill(); } };
const blush = (ctx, S, y, gap, r) => { ctx.save(); ctx.globalAlpha *= 0.55; ctx.fillStyle = S.c1; for (const sd of [-1, 1]) { ctx.beginPath(); ctx.ellipse(sd * gap, y, r * 1.3, r * 0.7, 0, 0, TAU); ctx.fill(); } ctx.restore(); };

export const SEAL = [
  {
    id: 'star', name: '星', size: 0.7,
    draw(ctx, S) {
      const u = S.u * (1 + S.b * 0.08);
      ctx.save(); ctx.rotate(Math.sin(S.t * 1.6) * 0.12);
      die(ctx, S, c => { poly(c, starPts(5, u, u * 0.46)); }, S.c2);
      ctx.restore();
      eyeDots(ctx, S, u * 0.02, u * 0.2, u * 0.08);
    },
  },
  {
    id: 'heart', name: 'ハート', size: 0.7,
    draw(ctx, S) {
      const s = S.u * (1 + S.b * 0.14);
      die(ctx, S, c => heartPath(c, s), S.c1);
      ctx.save(); ctx.globalAlpha *= 0.5; ctx.fillStyle = S.paper; ctx.beginPath(); ctx.ellipse(-s * 0.45, -s * 0.35, s * 0.16, s * 0.1, -0.6, 0, TAU); ctx.fill(); ctx.restore();
    },
  },
  {
    id: 'bolt', name: '稲妻', size: 0.8,
    draw(ctx, S) {
      const u = S.u, j = S.b * u * 0.05;
      die(ctx, S, c => poly(c, [[-u * 0.2 + j, -u], [u * 0.55, -u], [u * 0.12, -u * 0.15], [u * 0.6, -u * 0.15], [-u * 0.35, u * 1.05], [-u * 0.02, u * 0.12], [-u * 0.55, u * 0.12]]), S.c2);
    },
  },
  {
    id: 'cloud', name: '雲', size: 0.75,
    draw(ctx, S) {
      const u = S.u, dx = Math.sin(S.t * 1.2) * u * 0.06;
      ctx.save(); ctx.translate(dx, 0);
      die(ctx, S, c => { c.beginPath(); c.arc(-u * 0.5, u * 0.1, u * 0.45, Math.PI * 0.5, Math.PI * 1.5); c.arc(-u * 0.05, -u * 0.25, u * 0.55, Math.PI, Math.PI * 1.9); c.arc(u * 0.55, u * 0.05, u * 0.5, Math.PI * 1.4, Math.PI * 0.5); c.closePath(); }, S.paper);
      eyeDots(ctx, S, u * 0.08, u * 0.24, u * 0.07);
      blush(ctx, S, u * 0.26, u * 0.42, u * 0.08);
      ctx.restore();
    },
  },
  {
    id: 'flower', name: '花', size: 0.7,
    draw(ctx, S) {
      const u = S.u;
      ctx.save(); ctx.rotate(S.t * 0.8);
      die(ctx, S, c => { c.beginPath(); for (let k = 0; k < 5; k++) { const a = k / 5 * TAU; c.moveTo(Math.cos(a) * u * 0.55 + u * 0.45, Math.sin(a) * u * 0.55); c.arc(Math.cos(a) * u * 0.55, Math.sin(a) * u * 0.55, u * 0.45, 0, TAU); } }, S.c1, { ink: false });
      ctx.restore();
      ctx.fillStyle = S.c2; ctx.beginPath(); ctx.arc(0, 0, u * 0.36, 0, TAU); ctx.fill(); ctx.strokeStyle = S.ink; ctx.lineWidth = u * 0.05; ctx.stroke();
    },
  },
  {
    id: 'crown', name: '王冠', at: 'above', size: 0.62,
    draw(ctx, S) {
      const u = S.u;
      die(ctx, S, c => poly(c, [[-u, u * 0.55], [-u, -u * 0.35], [-u * 0.5, u * 0.05], [0, -u * 0.7], [u * 0.5, u * 0.05], [u, -u * 0.35], [u, u * 0.55]]), S.c2);
      ctx.fillStyle = S.c1; for (const x of [-0.5, 0, 0.5]) { ctx.beginPath(); ctx.arc(x * u, u * 0.3, u * 0.1, 0, TAU); ctx.fill(); }
      sparkle(ctx, u * 0.85, -u * 0.75, u * 0.25 * (0.5 + 0.5 * Math.sin(S.t * 5)), S.paper);
    },
  },
  {
    id: 'eye', name: '目', size: 0.8,
    draw(ctx, S) {
      const u = S.u, blink = (S.t % 2.6) > 2.45 ? 0.1 : 1;
      die(ctx, S, c => { c.beginPath(); c.moveTo(-u, 0); c.quadraticCurveTo(0, -u * 0.95 * blink, u, 0); c.quadraticCurveTo(0, u * 0.95 * blink, -u, 0); c.closePath(); }, S.paper);
      if (blink > 0.5) {
        const lx = Math.sin(S.t * 0.9) * u * 0.18;
        ctx.fillStyle = S.c3 === '#FFFFFF' ? S.c1 : S.c3; ctx.beginPath(); ctx.arc(lx, 0, u * 0.36, 0, TAU); ctx.fill();
        ctx.fillStyle = S.ink; ctx.beginPath(); ctx.arc(lx, 0, u * 0.17, 0, TAU); ctx.fill();
        ctx.fillStyle = S.paper; ctx.beginPath(); ctx.arc(lx + u * 0.1, -u * 0.1, u * 0.07, 0, TAU); ctx.fill();
      }
    },
  },
  {
    id: 'flame', name: '炎', size: 0.75,
    draw(ctx, S) {
      const u = S.u, f = k => Math.sin(S.t * 9 + k) * u * 0.06;
      const outer = c => { c.beginPath(); c.moveTo(0, u); c.bezierCurveTo(-u * 0.9, u, -u * 0.8, u * 0.05, -u * 0.35 + f(1), -u * 0.35); c.quadraticCurveTo(-u * 0.25, u * 0.05, -u * 0.05, u * 0.05); c.quadraticCurveTo(-u * 0.25, -u * 0.6, f(2), -u * 1.05); c.quadraticCurveTo(u * 0.25, -u * 0.5, u * 0.35, -u * 0.25); c.quadraticCurveTo(u * 0.45 + f(3), -u * 0.5, u * 0.55, -u * 0.55); c.bezierCurveTo(u * 0.95, u * 0.05, u * 0.8, u, 0, u); c.closePath(); };
      die(ctx, S, outer, S.c1);
      ctx.fillStyle = S.c2; ctx.beginPath(); ctx.moveTo(0, u * 0.85); ctx.bezierCurveTo(-u * 0.5, u * 0.85, -u * 0.45, u * 0.25, f(4), -u * 0.15); ctx.bezierCurveTo(u * 0.45, u * 0.25, u * 0.5, u * 0.85, 0, u * 0.85); ctx.fill();
    },
  },
  {
    id: 'drop', name: 'しずく', size: 0.7,
    draw(ctx, S) {
      const u = S.u, sq = 1 + Math.sin(S.t * 3) * 0.04;
      ctx.save(); ctx.scale(1 / sq, sq);
      die(ctx, S, c => { c.beginPath(); c.moveTo(0, -u * 1.05); c.bezierCurveTo(u * 0.25, -u * 0.5, u * 0.8, -u * 0.05, u * 0.8, u * 0.35); c.arc(0, u * 0.35, u * 0.8, 0, Math.PI); c.bezierCurveTo(-u * 0.8, -u * 0.05, -u * 0.25, -u * 0.5, 0, -u * 1.05); c.closePath(); }, S.c3 === '#FFFFFF' ? '#7FD3FF' : S.c3);
      ctx.restore();
      ctx.save(); ctx.globalAlpha *= 0.7; ctx.fillStyle = S.paper; ctx.beginPath(); ctx.ellipse(-u * 0.35, u * 0.25, u * 0.11, u * 0.22, 0.3, 0, TAU); ctx.fill(); ctx.restore();
    },
  },
  {
    id: 'moon', name: '三日月', size: 0.75,
    draw(ctx, S) {
      const u = S.u;
      ctx.save(); ctx.rotate(-0.4 + Math.sin(S.t * 1.1) * 0.1);
      die(ctx, S, c => { c.beginPath(); c.arc(0, 0, u, Math.PI * 0.35, Math.PI * 1.65); c.arc(u * 0.42, 0, u * 0.78, Math.PI * 1.45, Math.PI * 0.55, true); c.closePath(); }, S.c2);
      ctx.fillStyle = S.ink; ctx.beginPath(); ctx.arc(-u * 0.5, -u * 0.05, u * 0.07, 0, TAU); ctx.fill();
      ctx.strokeStyle = S.ink; ctx.lineWidth = u * 0.05; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(-u * 0.48, u * 0.25, u * 0.12, 0.3, Math.PI - 0.3); ctx.stroke();
      ctx.restore();
      sparkle(ctx, u * 0.65, -u * 0.6, u * 0.22 * (0.5 + 0.5 * Math.sin(S.t * 4)), S.paper);
    },
  },
  {
    id: 'face', name: 'にっこり顔', size: 0.7,
    draw(ctx, S) {
      const u = S.u * (1 + S.b * 0.06);
      die(ctx, S, c => { c.beginPath(); c.arc(0, 0, u, 0, TAU); }, S.c2);
      ctx.strokeStyle = S.ink; ctx.lineWidth = u * 0.1; ctx.lineCap = 'round';
      for (const sd of [-1, 1]) { ctx.beginPath(); ctx.arc(sd * u * 0.36, -u * 0.08, u * 0.16, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke(); }
      ctx.fillStyle = S.ink; ctx.beginPath(); ctx.moveTo(-u * 0.32, u * 0.2); ctx.quadraticCurveTo(0, u * 0.75, u * 0.32, u * 0.2); ctx.closePath(); ctx.fill();
      blush(ctx, S, u * 0.22, u * 0.62, u * 0.11);
    },
  },
  {
    id: 'note', name: '音符', size: 0.75, noMirror: true,
    draw(ctx, S) {
      const u = S.u, hop = -Math.abs(Math.sin(S.t * 4)) * u * 0.12;
      ctx.save(); ctx.translate(0, hop); ctx.rotate(Math.sin(S.t * 4) * 0.08);
      die(ctx, S, c => { c.beginPath(); c.ellipse(-u * 0.55, u * 0.6, u * 0.36, u * 0.27, -0.4, 0, TAU); c.ellipse(u * 0.55, u * 0.4, u * 0.36, u * 0.27, -0.4, 0, TAU); c.rect(-u * 0.29, -u * 0.85, u * 0.13, u * 1.45); c.rect(u * 0.81, -u * 1.05, u * 0.13, u * 1.45); c.moveTo(-u * 0.29, -u * 0.85); c.lineTo(u * 0.94, -u * 1.05); c.lineTo(u * 0.94, -u * 0.72); c.lineTo(-u * 0.29, -u * 0.52); c.closePath(); }, S.c1, { ink: false });
      ctx.restore();
    },
  },
  {
    id: 'planet', name: '輪のある星', size: 0.75,
    draw(ctx, S) {
      const u = S.u;
      ctx.save(); ctx.rotate(-0.35);
      const ring = c => { c.beginPath(); c.ellipse(0, 0, u * 1.25, u * 0.38, 0, 0, TAU); c.ellipse(0, 0, u * 0.95, u * 0.22, 0, 0, TAU, true); };
      die(ctx, S, c => { c.beginPath(); c.arc(0, 0, u * 0.65, 0, TAU); }, S.c3 === '#FFFFFF' ? S.c1 : S.c3);
      ctx.save(); ctx.beginPath(); ctx.rect(-u * 2, 0, u * 4, u * 2); ctx.clip(); ring(ctx); ctx.fillStyle = S.c2; ctx.fill('evenodd'); ctx.strokeStyle = S.ink; ctx.lineWidth = u * 0.04; ctx.stroke(); ctx.restore();
      ctx.save(); ctx.beginPath(); ctx.rect(-u * 2, -u * 2, u * 4, u * 2); ctx.clip(); ring(ctx); ctx.globalAlpha *= 0.85; ctx.fillStyle = S.c2; ctx.fill('evenodd'); ctx.restore();
      ctx.restore();
      ctx.fillStyle = S.paper; const a = S.t * 2; ctx.beginPath(); ctx.arc(Math.cos(a) * u * 1.1, Math.sin(a) * u * 0.35 - u * 0.3, u * 0.08, 0, TAU); ctx.fill();
    },
  },
  {
    id: 'big-sparkle', name: '大きなキラキラ', size: 0.8,
    draw(ctx, S) {
      const u = S.u, k = 0.85 + 0.15 * Math.sin(S.t * 5);
      ctx.save(); ctx.rotate(S.t * 0.5);
      die(ctx, S, c => { c.beginPath(); c.moveTo(0, -u * k); c.quadraticCurveTo(u * 0.12, -u * 0.12, u * k, 0); c.quadraticCurveTo(u * 0.12, u * 0.12, 0, u * k); c.quadraticCurveTo(-u * 0.12, u * 0.12, -u * k, 0); c.quadraticCurveTo(-u * 0.12, -u * 0.12, 0, -u * k); c.closePath(); }, S.c2);
      ctx.restore();
      sparkle(ctx, u * 0.75, u * 0.6, u * 0.25 * (0.5 + 0.5 * Math.sin(S.t * 7 + 1)), S.c2);
    },
  },
  {
    id: 'holo', name: 'ホログラムの丸シール', size: 0.85,
    draw(ctx, S) {
      const u = S.u;
      die(ctx, S, c => { c.beginPath(); c.arc(0, 0, u, 0, TAU); }, null);
      ctx.save(); ctx.beginPath(); ctx.arc(0, 0, u, 0, TAU); ctx.clip();
      const sh = Math.sin(S.t * 1.7) * u;
      const g = typeof ctx.createLinearGradient === 'function' ? ctx.createLinearGradient(-u + sh, -u, u + sh, u) : null;
      if (g) { ['#FF9AD5', '#9AE7FF', '#FFF59A', '#B49AFF', '#9AFFC8', '#FF9AD5'].forEach((c, k) => g.addColorStop(k / 5, c)); ctx.fillStyle = g; } else ctx.fillStyle = S.c3;
      ctx.fillRect(-u, -u, u * 2, u * 2);
      ctx.globalAlpha *= 0.5; ctx.fillStyle = S.paper; ctx.save(); ctx.rotate(0.6); ctx.fillRect(sh * 1.6 - u * 0.15, -u * 1.5, u * 0.3, u * 3); ctx.restore();
      ctx.restore();
      ctx.strokeStyle = S.ink; ctx.lineWidth = u * 0.05; ctx.beginPath(); ctx.arc(0, 0, u, 0, TAU); ctx.stroke();
      label(ctx, S, S.word, 0, 0, u * 0.48, S.ink, u * 1.6, { weight: '900' });
    },
  },
  {
    id: 'peel', name: 'めくれかけたシール', at: 'under', size: 0.55,
    draw(ctx, S) {
      const u = S.u, w = Math.max(u * 2.4, u * 0.9 + S.w * 0.5), h = u * 1.2;
      const curl = 0.35 + 0.15 * Math.sin(S.t * 1.5);
      const c0 = u * curl * 1.6;
      const body = c => poly(c, [[-w / 2, -h / 2], [w / 2 - c0, -h / 2], [w / 2, -h / 2 + c0], [w / 2, h / 2], [-w / 2, h / 2]]);
      die(ctx, S, body, S.c1, { border: 0.09 });
      label(ctx, S, S.word, -c0 * 0.2, 0, u * 0.58, S.paper, w - u * 0.6 - c0, { weight: '900' });
      // めくれた角（裏の白）
      ctx.fillStyle = '#E9E6EE'; poly(ctx, [[w / 2 - c0, -h / 2], [w / 2, -h / 2 + c0], [w / 2 - c0 * 0.9, -h / 2 + c0 * 0.9]]); ctx.fill();
      ctx.strokeStyle = S.ink; ctx.lineWidth = u * 0.04; ctx.stroke();
    },
  },
  {
    id: 'gem', name: '宝石', size: 0.7,
    draw(ctx, S) {
      const u = S.u;
      const out = [[-u, -u * 0.25], [-u * 0.55, -u * 0.75], [u * 0.55, -u * 0.75], [u, -u * 0.25], [0, u]];
      die(ctx, S, c => poly(c, out), S.c3 === '#FFFFFF' ? '#7FD3FF' : S.c3);
      ctx.strokeStyle = S.ink; ctx.lineWidth = u * 0.04;
      poly(ctx, [[-u, -u * 0.25], [u, -u * 0.25]], false); ctx.stroke();
      poly(ctx, [[-u * 0.55, -u * 0.75], [-u * 0.3, -u * 0.25], [0, u], [u * 0.3, -u * 0.25], [u * 0.55, -u * 0.75]], false); ctx.stroke();
      poly(ctx, [[-u * 0.3, -u * 0.25], [0, -u * 0.75], [u * 0.3, -u * 0.25]], false); ctx.stroke();
      const tw = Math.max(0, Math.sin(S.t * 3));
      sparkle(ctx, -u * 0.45, -u * 0.45, u * 0.3 * tw, S.paper);
    },
  },
  {
    id: 'cat', name: '猫の顔', size: 0.72,
    draw(ctx, S) {
      const u = S.u, tw = Math.sin(S.t * 6) * 0.08;
      die(ctx, S, c => { c.beginPath(); c.moveTo(-u * 0.95, u * 0.1); c.lineTo(-u * 0.85, -u * (0.95 + tw)); c.lineTo(-u * 0.35, -u * 0.55); c.quadraticCurveTo(0, -u * 0.68, u * 0.35, -u * 0.55); c.lineTo(u * 0.85, -u * 0.95); c.lineTo(u * 0.95, u * 0.1); c.quadraticCurveTo(u * 0.9, u * 0.85, 0, u * 0.85); c.quadraticCurveTo(-u * 0.9, u * 0.85, -u * 0.95, u * 0.1); c.closePath(); }, S.ink === S.fg ? S.c2 : S.paper);
      const blink = (S.t % 3) > 2.85;
      ctx.strokeStyle = S.ink; ctx.fillStyle = S.ink; ctx.lineWidth = u * 0.07; ctx.lineCap = 'round';
      for (const sd of [-1, 1]) { if (blink) { ctx.beginPath(); ctx.moveTo(sd * u * 0.5, 0); ctx.lineTo(sd * u * 0.2, 0); ctx.stroke(); } else { ctx.beginPath(); ctx.ellipse(sd * u * 0.36, 0, u * 0.08, u * 0.14, 0, 0, TAU); ctx.fill(); } }
      ctx.beginPath(); ctx.moveTo(-u * 0.16, u * 0.3); ctx.quadraticCurveTo(-u * 0.08, u * 0.42, 0, u * 0.3); ctx.quadraticCurveTo(u * 0.08, u * 0.42, u * 0.16, u * 0.3); ctx.stroke();
      ctx.lineWidth = u * 0.035; for (const sd of [-1, 1]) for (const y of [0.18, 0.32]) { ctx.beginPath(); ctx.moveTo(sd * u * 0.55, u * y); ctx.lineTo(sd * u * 1.05, u * (y - 0.06 + (y - 0.25) * 0.6)); ctx.stroke(); }
    },
  },
];
