// ロゴ風：言葉を組んだバッジ・判子・札。S.word を組み込む
import { TAU, ob, poly, rrect, starPts, die, label, measure, charsOf, sparkle } from './common.js';

const fitW = (ctx, S, word, size, min, pad) => Math.max(min, measure(ctx, S, word, size) + pad);

export const LOGO = [
  {
    id: 'ring-badge', name: '丸いバッジ（言葉が周りを回る）', at: 'corner', size: 0.95,
    draw(ctx, S) {
      const u = S.u;
      die(ctx, S, c => { c.beginPath(); c.arc(0, 0, u, 0, TAU); }, S.c1);
      ctx.save(); ctx.strokeStyle = S.paper; ctx.lineWidth = u * 0.04; ctx.setLineDash([u * 0.06, u * 0.06]);
      ctx.beginPath(); ctx.arc(0, 0, u * 0.68, 0, TAU); ctx.stroke(); ctx.restore();
      // 周りの小さな言葉（回る）
      const ring = charsOf(`${S.word} ◆ ${S.word} ◆ `);
      ctx.save(); ctx.rotate(S.t * 0.6);
      ctx.font = `700 ${u * 0.2}px ${S.font}`; ctx.fillStyle = S.paper; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ring.forEach((ch, k) => { const a = k / ring.length * TAU; ctx.save(); ctx.rotate(a); ctx.translate(0, -u * 0.84); ctx.fillText(ch, 0, 0); ctx.restore(); });
      ctx.restore();
      label(ctx, S, S.word, 0, 0, u * 0.42, S.paper, u * 1.15, { stroke: S.ink, strokeW: u * 0.07 });
    },
  },
  {
    id: 'ribbon', name: '帯のリボン', at: 'above', size: 0.62, pop: 'unfold',
    draw(ctx, S) {
      const u = S.u, w = fitW(ctx, S, S.word, u * 0.62, u * 2.6, u * 1.0), h = u * 0.82;
      const wave = y => Math.sin(S.t * 2.4 + y) * u * 0.04;
      // 後ろに折れた両端
      for (const sd of [-1, 1]) {
        const x0 = sd * w / 2;
        const pts = [[x0 - sd * u * 0.25, -h * 0.2], [x0 + sd * u * 0.75, -h * 0.2 + wave(sd)], [x0 + sd * u * 0.45, h * 0.45], [x0 + sd * u * 0.75, h * 1.1 + wave(sd)], [x0 - sd * u * 0.25, h * 1.1]];
        die(ctx, S, c => poly(c, pts), S.c2, { border: 0.09 });
        ctx.save(); poly(ctx, [[x0 - sd * u * 0.25, h * 0.5], [x0, h * 0.5], [x0 - sd * u * 0.25, h * 1.1]]); ctx.fillStyle = S.ink; ctx.globalAlpha *= 0.55; ctx.fill(); ctx.restore();
      }
      die(ctx, S, c => { c.beginPath(); c.moveTo(-w / 2, -h / 2); c.quadraticCurveTo(0, -h / 2 - u * 0.2, w / 2, -h / 2); c.lineTo(w / 2, h / 2); c.quadraticCurveTo(0, h / 2 - u * 0.2, -w / 2, h / 2); c.closePath(); }, S.c1, { border: 0.09 });
      label(ctx, S, S.word, 0, -u * 0.08, u * 0.56, S.paper, w - u * 0.5);
    },
  },
  {
    id: 'hanko-square', name: '角判子', at: 'corner', size: 0.8, pop: 'stamp', tilt: 0.3,
    draw(ctx, S) {
      const u = S.u, ch = charsOf(S.word).slice(0, 4), n = ch.length || 1;
      const red = S.stamp;
      const edge = [];
      for (let k = 0; k < 24; k++) { const s = k / 6 | 0, v = (k % 6) / 6; const c = [[-1, -1], [1, -1], [1, 1], [-1, 1]]; const a = c[s], b = c[(s + 1) % 4]; edge.push([(a[0] + (b[0] - a[0]) * v) * u + (S.r(k + 20) - 0.5) * u * 0.08, (a[1] + (b[1] - a[1]) * v) * u + (S.r(k + 60) - 0.5) * u * 0.08]); }
      ctx.save(); ctx.globalAlpha *= 0.92;
      ctx.strokeStyle = red; ctx.lineWidth = u * 0.13; ctx.lineJoin = 'round'; poly(ctx, edge); ctx.stroke();
      // 英字は横に 1 行、ほかは縦に組む（2 列まで）
      if (/^[ -~]+$/.test(S.word)) { label(ctx, S, S.word, 0, 0, u * 0.8, red, u * 1.6, { weight: '900' }); ctx.restore(); return; }
      const cols = n > 2 ? 2 : 1, rows = Math.ceil(n / cols), cell = (u * 1.55) / Math.max(rows, cols);
      ctx.font = `800 ${cell * 0.92}px ${S.serif ?? S.font}`; ctx.fillStyle = red; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ch.forEach((c, k) => { const col = cols - 1 - Math.floor(k / rows), row = k % rows; ctx.fillText(c, (col - (cols - 1) / 2) * cell, (row - (rows - 1) / 2) * cell + cell * 0.04); });
      ctx.restore();
    },
  },
  {
    id: 'hanko-round', name: '丸判子', at: 'corner', size: 0.75, pop: 'stamp',
    draw(ctx, S) {
      const u = S.u, red = S.stamp;
      ctx.save(); ctx.globalAlpha *= 0.9; ctx.strokeStyle = red;
      ctx.lineWidth = u * 0.1; ctx.beginPath(); ctx.arc(0, 0, u, 0, TAU); ctx.stroke();
      ctx.lineWidth = u * 0.035; ctx.beginPath(); ctx.arc(0, 0, u * 0.82, 0, TAU); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-u * 0.82, -u * 0.36); ctx.lineTo(u * 0.82, -u * 0.36); ctx.moveTo(-u * 0.82, u * 0.36); ctx.lineTo(u * 0.82, u * 0.36); ctx.stroke();
      label(ctx, S, S.word, 0, 0, u * 0.5, red, u * 1.45, { weight: '800' });
      ctx.fillStyle = red;
      for (const y of [-0.6, 0.6]) { ctx.beginPath(); poly(ctx, starPts(5, u * 0.13, u * 0.055).map(([x, yy]) => [x, yy + y * u])); ctx.fill(); }
      ctx.restore();
    },
  },
  {
    id: 'ransom', name: '切り抜き文字', at: 'above', size: 0.62, pop: 'none',
    draw(ctx, S) {
      const u = S.u, ch = charsOf(S.word).slice(0, 8), n = ch.length;
      const cols = [S.c1, S.paper, S.c2, S.ink, S.c3];
      const cell = u * 1.05, x0 = -(n - 1) * cell / 2;
      ch.forEach((c, k) => {
        const q = ob((S.t - k * 0.07) / 0.3);
        if (!(q > 0)) return;
        const bg = cols[(k + Math.floor(S.r(k) * 5)) % 5], fgc = bg === S.ink || bg === S.c1 ? S.paper : S.ink;
        ctx.save(); ctx.translate(x0 + k * cell, (S.r(k + 9) - 0.5) * u * 0.3); ctx.rotate((S.r(k + 3) - 0.5) * 0.45 + Math.sin(S.t * 3 + k) * 0.03); ctx.scale(q, q);
        const w = u * (0.85 + S.r(k + 5) * 0.25), h = u * (0.95 + S.r(k + 6) * 0.3);
        ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(-w / 2 + u * 0.05, -h / 2 + u * 0.07, w, h);
        ctx.fillStyle = bg; ctx.fillRect(-w / 2, -h / 2, w, h);
        ctx.strokeStyle = bg === S.paper ? S.ink : S.paper; ctx.lineWidth = u * 0.05; ctx.strokeRect(-w / 2, -h / 2, w, h);
        label(ctx, S, c, 0, 0, u * (0.7 + S.r(k + 7) * 0.2), fgc, w * 0.92, { weight: S.r(k + 8) > 0.5 ? '900' : '500' });
        ctx.restore();
      });
    },
  },
  {
    id: 'burst', name: 'ギザギザの札', at: 'corner', size: 0.95,
    draw(ctx, S) {
      const u = S.u;
      ctx.save(); ctx.rotate(Math.sin(S.t * 1.3) * 0.08 + S.b * 0.05);
      die(ctx, S, c => poly(c, starPts(14, u * (1 + S.b * 0.06), u * 0.8)), S.c2);
      ctx.restore();
      label(ctx, S, S.word, 0, 0, u * 0.48, S.ink, u * 1.25, { weight: '900' });
    },
  },
  {
    id: 'shield', name: '盾の紋章', at: 'corner', size: 0.85,
    draw(ctx, S) {
      const u = S.u;
      const shield = c => { c.beginPath(); c.moveTo(-u * 0.85, -u); c.lineTo(u * 0.85, -u); c.lineTo(u * 0.85, 0); c.quadraticCurveTo(u * 0.8, u * 0.75, 0, u * 1.1); c.quadraticCurveTo(-u * 0.8, u * 0.75, -u * 0.85, 0); c.closePath(); };
      die(ctx, S, shield, S.c1);
      ctx.save(); shield(ctx); ctx.clip();
      ctx.fillStyle = S.paper; ctx.fillRect(-u, -u * 0.18, u * 2, u * 0.5);
      ctx.restore();
      label(ctx, S, S.word, 0, u * 0.07, u * 0.36, S.ink, u * 1.5, { weight: '900' });
      ctx.fillStyle = S.paper; poly(ctx, starPts(5, u * 0.26, u * 0.11).map(([x, y]) => [x, y - u * 0.6])); ctx.fill();
      ctx.fillStyle = S.paper; for (const x of [-0.42, 0.42]) { poly(ctx, starPts(5, u * 0.1, u * 0.04).map(([xx, y]) => [xx + x * u, y - u * 0.55])); ctx.fill(); }
    },
  },
  {
    id: 'ticket', name: '切符', at: 'side', size: 0.62, tilt: 0.5,
    draw(ctx, S) {
      const u = S.u, w = fitW(ctx, S, S.word, u * 0.55, u * 2.6, u * 1.5), h = u * 1.2;
      const path = c => {
        c.beginPath(); c.moveTo(-w / 2, -h / 2); c.lineTo(w / 2, -h / 2); c.lineTo(w / 2, -u * 0.2); c.arc(w / 2, 0, u * 0.2, -Math.PI / 2, Math.PI / 2, true);
        c.lineTo(w / 2, h / 2); c.lineTo(-w / 2, h / 2); c.lineTo(-w / 2, u * 0.2); c.arc(-w / 2, 0, u * 0.2, Math.PI / 2, -Math.PI / 2, true); c.closePath();
      };
      die(ctx, S, path, S.c2, { border: 0.1 });
      ctx.save(); ctx.strokeStyle = S.ink; ctx.lineWidth = u * 0.04; ctx.setLineDash([u * 0.08, u * 0.07]);
      ctx.beginPath(); ctx.moveTo(-w / 2 + u * 0.75, -h / 2 + u * 0.1); ctx.lineTo(-w / 2 + u * 0.75, h / 2 - u * 0.1); ctx.stroke(); ctx.restore();
      ctx.fillStyle = S.ink; poly(ctx, starPts(5, u * 0.22, u * 0.09).map(([x, y]) => [x - w / 2 + u * 0.38, y])); ctx.fill();
      label(ctx, S, S.word, u * 0.37, -u * 0.08, u * 0.5, S.ink, w - u * 1.2, { weight: '900' });
      ctx.fillStyle = S.ink; for (let k = 0; k < 9; k++) ctx.fillRect(u * 0.37 - u * 0.6 + k * u * 0.14, u * 0.3, u * (S.r(k) > 0.5 ? 0.06 : 0.03), u * 0.2);
    },
  },
  {
    id: 'caution', name: '斜めの帯（テープ）', at: 'line', size: 0.55, back: true, pop: 'unfold', tilt: 0,
    draw(ctx, S) {
      const u = S.u, w = S.w + u * 6, h = u * 1.1;
      ctx.save(); ctx.rotate(-0.12 + (S.r(1) > 0.5 ? 0.24 : 0));
      ctx.beginPath(); ctx.rect(-w / 2, -h / 2, w, h); ctx.save(); ctx.clip();
      ctx.fillStyle = S.c2; ctx.fillRect(-w / 2, -h / 2, w, h);
      ctx.fillStyle = S.ink;
      const sp = u * 0.5, off = (S.t * u * 0.8) % (sp * 2);
      for (let x = -w / 2 - h - sp * 2 + off; x < w / 2 + h; x += sp * 2) { for (const y0 of [-h / 2, h / 2 - u * 0.22]) { poly(ctx, [[x, y0 + u * 0.22], [x + u * 0.22, y0], [x + u * 0.22 + sp, y0], [x + sp, y0 + u * 0.22]]); ctx.fill(); } }
      const step = measure(ctx, S, `${S.word}　`, u * 0.42, '900');
      const scroll = (S.t * u * 1.2) % Math.max(1, step);
      for (let x = -w / 2 - scroll; x < w / 2; x += step) label(ctx, S, S.word, x, 0, u * 0.42, S.ink, Infinity, { weight: '900', align: 'left' });
      ctx.restore(); ctx.restore();
    },
  },
  {
    id: 'tag', name: '値札（ぶら下がる）', at: 'corner', size: 0.55, pop: 'drop',
    draw(ctx, S) {
      const u = S.u, w = fitW(ctx, S, S.word, u * 0.6, u * 2.2, u * 1.3), h = u * 1.05;
      const sw = Math.sin(S.t * 3.1) * Math.exp(-S.t * 0.4) * 0.35 + Math.sin(S.t * 1.4) * 0.05;
      ctx.save(); ctx.translate(-u * 0.6, -u * 1.2); ctx.rotate(sw + 0.25);
      ctx.strokeStyle = S.ink; ctx.lineWidth = u * 0.05; ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(u * 0.4, u * 0.2, u * 0.6, u * 0.9); ctx.stroke();
      ctx.translate(u * 0.6, u * 0.9);
      const path = c => poly(c, [[0, 0], [u * 0.5, -h / 2], [w, -h / 2], [w, h / 2], [u * 0.5, h / 2]]);
      die(ctx, S, path, S.c1, { border: 0.1 });
      ctx.fillStyle = S.paper; ctx.beginPath(); ctx.arc(u * 0.42, 0, u * 0.12, 0, TAU); ctx.fill(); ctx.strokeStyle = S.ink; ctx.lineWidth = u * 0.04; ctx.stroke();
      label(ctx, S, S.word, (w + u * 0.65) / 2, 0, u * 0.55, S.paper, w - u * 0.85, { weight: '900' });
      ctx.restore();
    },
  },
  {
    id: 'oval-logo', name: '楕円のロゴ', at: 'above', size: 0.62,
    draw(ctx, S) {
      const u = S.u, w = fitW(ctx, S, S.word, u * 0.7, u * 3, u * 1.4) / 2;
      die(ctx, S, c => { c.beginPath(); c.ellipse(0, 0, w, u * 1.05, 0, 0, TAU); }, S.ink, { ink: false });
      ctx.strokeStyle = S.c2; ctx.lineWidth = u * 0.06; ctx.beginPath(); ctx.ellipse(0, 0, w - u * 0.15, u * 0.9, 0, 0, TAU); ctx.stroke();
      ctx.lineWidth = u * 0.025; ctx.beginPath(); ctx.ellipse(0, 0, w - u * 0.26, u * 0.79, 0, 0, TAU); ctx.stroke();
      label(ctx, S, S.word, 0, 0, u * 0.66, S.paper, w * 1.6, { weight: '900' });
      ctx.fillStyle = S.c2;
      for (const sy of [-1, 1]) for (let k = -2; k <= 2; k++) { const tw = 0.6 + 0.4 * Math.sin(S.t * 5 + k * 1.3 + sy); poly(ctx, starPts(5, u * 0.08 * tw, u * 0.035 * tw).map(([x, y]) => [x + k * u * 0.32, y + sy * u * 0.58])); ctx.fill(); }
    },
  },
  {
    id: 'tanzaku', name: '短冊（縦の札）', at: 'side', size: 0.5, pop: 'drop', tilt: 0.1,
    draw(ctx, S) {
      const u = S.u, ch = charsOf(S.word).slice(0, 6), n = Math.max(1, ch.length), h = u * (n * 0.9 + 1.1), w = u * 1.2;
      const sw = Math.sin(S.t * 2.2) * 0.07;
      ctx.save(); ctx.translate(0, -h / 2 - u * 0.4); ctx.rotate(sw);
      ctx.strokeStyle = S.fg; ctx.lineWidth = u * 0.04; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, u * 0.4); ctx.stroke();
      die(ctx, S, c => { c.beginPath(); c.rect(-w / 2, u * 0.4, w, h); }, S.c1, { border: 0.08 });
      ctx.strokeStyle = S.paper; ctx.lineWidth = u * 0.03; ctx.strokeRect(-w / 2 + u * 0.12, u * 0.52, w - u * 0.24, h - u * 0.24);
      ctx.font = `800 ${u * 0.72}px ${S.serif ?? S.font}`; ctx.fillStyle = S.paper; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ch.forEach((c, k) => ctx.fillText(c, 0, u * 0.4 + u * 0.95 + k * u * 0.9));
      ctx.restore();
    },
  },
  {
    id: 'box-logo', name: '塗り箱のロゴ', at: 'under', size: 0.55, pop: 'slap', tilt: 0.25,
    draw(ctx, S) {
      const u = S.u, w = fitW(ctx, S, S.word, u * 0.9, u * 2, u * 0.8), h = u * 1.25;
      const d = u * (0.16 + S.b * 0.08);
      ctx.fillStyle = S.ink; ctx.fillRect(-w / 2 + d, -h / 2 + d, w, h);
      ctx.fillStyle = S.c1; ctx.fillRect(-w / 2, -h / 2, w, h);
      label(ctx, S, S.word, 0, 0, u * 0.9, S.paper, w - u * 0.4, { weight: '900' });
    },
  },
  {
    id: 'arc-word', name: '弧に並ぶ言葉', at: 'above', size: 0.55, pop: 'none',
    draw(ctx, S) {
      const u = S.u, ch = charsOf(S.word).slice(0, 10), n = ch.length;
      const R = u * 3.2, span = Math.min(1.5, n * 0.24);
      ctx.save(); ctx.translate(0, R - u * 0.2);
      ch.forEach((c, k) => {
        const q = ob((S.t - k * 0.06) / 0.35);
        if (!(q > 0)) return;
        const a = -Math.PI / 2 + (n > 1 ? (k / (n - 1) - 0.5) * span : 0);
        ctx.save(); ctx.rotate(a + Math.PI / 2); ctx.translate(0, -R - Math.sin(S.t * 4 + k * 0.7) * u * 0.06); ctx.scale(q, q);
        label(ctx, S, c, 0, 0, u * 0.82, S.c2, Infinity, { weight: '900', stroke: S.ink, strokeW: u * 0.18 });
        ctx.restore();
      });
      ctx.restore();
      for (const sd of [-1, 1]) sparkle(ctx, sd * (Math.sin(span / 2) * R + u * 0.55), -u * 0.1 + (1 - Math.cos(span / 2)) * R, u * 0.28 * (0.7 + 0.3 * Math.sin(S.t * 6 + sd)), S.c3);
    },
  },
  {
    id: 'neon-sign', name: 'ネオン看板', at: 'above', size: 0.55, pop: 'flicker',
    draw(ctx, S) {
      const u = S.u, w = fitW(ctx, S, S.word, u * 0.8, u * 2.8, u * 1.4), h = u * 1.5;
      const on = hashOn(S);
      ctx.save();
      ctx.shadowColor = S.c3; ctx.shadowBlur = u * 0.5 * on;
      ctx.strokeStyle = S.c3; ctx.globalAlpha *= 0.4 + 0.6 * on; ctx.lineWidth = u * 0.09;
      rrect(ctx, -w / 2, -h / 2, w, h, u * 0.35); ctx.stroke();
      ctx.shadowColor = S.c1; ctx.lineWidth = u * 0.05;
      label(ctx, S, S.word, 0, 0, u * 0.8, S.c1, w - u * 0.5, { weight: '700', stroke: S.c1, strokeW: u * 0.02 });
      ctx.restore();
    },
  },
  {
    id: 'arrow-sign', name: '矢印の看板', at: 'side', size: 0.55, pop: 'slap', tilt: 0.2,
    draw(ctx, S) {
      const u = S.u, w = fitW(ctx, S, S.word, u * 0.6, u * 2.4, u * 1.0), h = u * 1.1, nudge = Math.sin(S.t * 6) * u * 0.08;
      ctx.save(); ctx.translate(nudge, 0);
      const path = c => poly(c, [[-w / 2 - u * 0.6, 0], [-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]]);
      die(ctx, S, path, S.c2, { border: 0.1 });
      label(ctx, S, S.word, u * 0.05, 0, u * 0.6, S.ink, w - u * 0.4, { weight: '900' });
      ctx.restore();
    },
  },
  {
    id: 'wax-seal', name: '封蝋', at: 'corner', size: 0.62, pop: 'stamp',
    draw(ctx, S) {
      const u = S.u, pts = [];
      for (let k = 0; k < 20; k++) { const a = k / 20 * TAU, r = u * (1 + (S.r(k) - 0.5) * 0.22); pts.push([Math.cos(a) * r, Math.sin(a) * r]); }
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.translate(u * 0.05, u * 0.08); poly(ctx, pts); ctx.fill(); ctx.translate(-u * 0.05, -u * 0.08);
      ctx.fillStyle = S.stamp; poly(ctx, pts); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.28)'; ctx.lineWidth = u * 0.08; ctx.beginPath(); ctx.arc(0, 0, u * 0.7, 0, TAU); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = u * 0.04; ctx.beginPath(); ctx.arc(-u * 0.03, -u * 0.04, u * 0.7, Math.PI * 0.9, Math.PI * 1.6); ctx.stroke();
      label(ctx, S, charsOf(S.word)[0] ?? '', 0, 0, u * 0.82, 'rgba(0,0,0,0.38)', Infinity, { weight: '800' });
      label(ctx, S, charsOf(S.word)[0] ?? '', -u * 0.03, -u * 0.04, u * 0.82, 'rgba(255,255,255,0.25)', Infinity, { weight: '800' });
      ctx.restore();
    },
  },
  {
    id: 'patch', name: '刺しゅうのワッペン', at: 'under', size: 0.55, tilt: 0.3,
    draw(ctx, S) {
      const u = S.u, w = fitW(ctx, S, S.word, u * 0.62, u * 2.4, u * 1.2), h = u * 1.3;
      die(ctx, S, c => rrect(c, -w / 2, -h / 2, w, h, h / 2), S.c3 === '#FFFFFF' ? S.c1 : S.c3, { border: 0.06, inkW: 0.12 });
      ctx.save(); ctx.strokeStyle = S.ink; ctx.lineWidth = u * 0.04; ctx.setLineDash([u * 0.1, u * 0.07]);
      rrect(ctx, -w / 2 + u * 0.16, -h / 2 + u * 0.16, w - u * 0.32, h - u * 0.32, h / 2 - u * 0.16); ctx.stroke(); ctx.restore();
      label(ctx, S, S.word, 0, 0, u * 0.6, S.ink, w - u * 0.6, { weight: '900' });
    },
  },
];

// ネオンのまたたき：たまに一瞬消える
function hashOn(S) {
  const k = Math.floor(S.t * 14);
  const r = Math.abs(Math.sin(k * 12.9898 + S.seed * 78.233) * 43758.5453) % 1;
  return S.t < 0.5 ? (r > 0.5 ? 1 : 0.15) : r > 0.06 ? 1 : 0.2;
}
