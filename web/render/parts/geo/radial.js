// 幾何学模様：放射（中心から広がる・中心のまわりを回る）
import { TAU, pulse, barPhase, beatNo, hash, lw, poly, star, circle, line, path, pen, ink } from './kit.js';

export const RADIAL = [
  { id: 'nest-poly', name: '入れ子の多角形', draw(ctx, e) {
    const p = pulse(e);
    for (let k = 0; k < 9; k++) {
      pen(ctx, k % 3 ? e.fg : e.accent, lw(e, 0.004 + 0.004 * p), 1 - k * 0.08);
      poly(ctx, e.cx, e.cy, e.S * (0.08 + k * 0.07) * (1 + 0.25 * p), 6, e.t * (k % 2 ? 0.4 : -0.4) + k * 0.12);
      ctx.stroke();
    }
  } },
  { id: 'burst', name: '放射の線がはじける', draw(ctx, e) {
    const p = pulse(e, 4), n = 48;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + beatNo(e) * 0.13;
      const r0 = e.S * (0.1 + 0.3 * (1 - p)), r1 = r0 + e.S * (0.2 + 0.6 * p * hash(i, beatNo(e)));
      pen(ctx, i % 4 ? e.fg : e.accent, lw(e, 0.006), 0.4 + 0.6 * p);
      line(ctx, e.cx + Math.cos(a) * r0, e.cy + Math.sin(a) * r0, e.cx + Math.cos(a) * r1, e.cy + Math.sin(a) * r1);
      ctx.stroke();
    }
  } },
  { id: 'pulse-rings', name: '脈打つ同心円', draw(ctx, e) {
    const ph = e.beat.phase;
    for (let k = 0; k < 8; k++) {
      const r = e.S * 0.08 * (k + ph * 1.5);
      pen(ctx, k === 0 ? e.accent : e.fg, lw(e, 0.012 * (1 - k / 9)), (1 - k / 8) * (0.4 + 0.6 * e.energy));
      circle(ctx, e.cx, e.cy, r); ctx.stroke();
    }
  } },
  { id: 'star-spin', name: '回る星形', draw(ctx, e) {
    const p = pulse(e);
    for (let k = 0; k < 5; k++) {
      pen(ctx, k === 2 ? e.accent : e.fg, lw(e, 0.005), 0.9 - k * 0.15);
      star(ctx, e.cx, e.cy, e.S * (0.15 + k * 0.1) * (1 + 0.2 * p), 5 + k, 0.5, e.t * 0.5 * (k % 2 ? 1 : -1));
      ctx.stroke();
    }
  } },
  { id: 'sun-wheel', name: '太陽の輪', draw(ctx, e) {
    const p = pulse(e), n = 24;
    pen(ctx, e.fg, lw(e, 0.006));
    circle(ctx, e.cx, e.cy, e.S * 0.16 * (1 + 0.2 * p)); ctx.stroke();
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + e.t * 0.3;
      ink(ctx, i % 2 ? e.fg : e.accent, 0.85);
      ctx.save(); ctx.translate(e.cx, e.cy); ctx.rotate(a);
      ctx.beginPath(); ctx.moveTo(e.S * 0.2, -e.S * 0.02); ctx.lineTo(e.S * (0.32 + 0.12 * p), 0); ctx.lineTo(e.S * 0.2, e.S * 0.02); ctx.fill();
      ctx.restore();
    }
  } },
  { id: 'spokes-arcs', name: '輻と弧', draw(ctx, e) {
    // 2026-10-20 持ち主「永久に回転してたらかっこいい」：弧の長さは変えず、輪ごとに違う速さで回り続ける
    const p = pulse(e);
    for (let k = 1; k <= 6; k++) {
      const r = e.S * 0.075 * k;
      const a0 = e.t * (1.4 / k + 0.15) * (k % 2 ? 1 : -1);
      const len = TAU * (0.18 + 0.1 * (k % 3));
      for (let s = 0; s < 2; s++) {
        pen(ctx, k === 3 ? e.accent : e.fg, lw(e, 0.012 + 0.004 * p), 0.9);
        ctx.beginPath(); ctx.arc(e.cx, e.cy, r, a0 + s * Math.PI, a0 + s * Math.PI + len); ctx.stroke();
      }
    }
    pen(ctx, e.fg, lw(e, 0.002), 0.45);
    for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU + e.t * 0.05; line(ctx, e.cx, e.cy, e.cx + Math.cos(a) * e.S * 0.5, e.cy + Math.sin(a) * e.S * 0.5); ctx.stroke(); }
  } },
  { id: 'mandala', name: 'まんだら', draw(ctx, e) {
    const p = pulse(e), n = 12;
    ctx.save(); ctx.translate(e.cx, e.cy); ctx.rotate(e.t * 0.15);
    for (let i = 0; i < n; i++) {
      ctx.rotate(TAU / n);
      pen(ctx, e.fg, lw(e, 0.003), 0.8);
      ctx.beginPath(); ctx.ellipse(e.S * 0.18, 0, e.S * (0.16 + 0.04 * p), e.S * 0.05, 0, 0, TAU); ctx.stroke();
      pen(ctx, e.accent, lw(e, 0.004), 0.9);
      circle(ctx, e.S * (0.36 + 0.05 * p), 0, e.S * 0.025); ctx.stroke();
    }
    ctx.restore();
  } },
  { id: 'clock-ticks', name: '目盛りの輪', draw(ctx, e) {
    // 2026-10-20 持ち主「なんか変」：光る目盛りと針がずれていた → 針がなめらかに回り、通った目盛りが光って消えていく
    const n = 60, turn = barPhase(e); // 4 小節で 1 周
    const hand = turn * TAU - Math.PI / 2;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU - Math.PI / 2, big = i % 5 === 0;
      const since = ((turn - i / n) % 1 + 1) % 1; // 針が通ってからの割合
      const glow = Math.max(0, 1 - since * 6);
      const r0 = e.S * (big ? 0.33 : 0.37), r1 = e.S * 0.42;
      pen(ctx, glow > 0.05 ? e.accent : e.fg, lw(e, big ? 0.008 : 0.003), 0.45 + 0.55 * Math.max(glow, big ? 0.6 : 0));
      line(ctx, e.cx + Math.cos(a) * r0, e.cy + Math.sin(a) * r0, e.cx + Math.cos(a) * r1, e.cy + Math.sin(a) * r1); ctx.stroke();
    }
    pen(ctx, e.accent, lw(e, 0.01)); line(ctx, e.cx, e.cy, e.cx + Math.cos(hand) * e.S * 0.36, e.cy + Math.sin(hand) * e.S * 0.36); ctx.stroke();
    const slow = (beatNo(e) % 16 + turn) / 16 * TAU - Math.PI / 2; // もう 1 本はゆっくり
    pen(ctx, e.fg, lw(e, 0.016)); line(ctx, e.cx, e.cy, e.cx + Math.cos(slow) * e.S * 0.22, e.cy + Math.sin(slow) * e.S * 0.22); ctx.stroke();
    ink(ctx, e.fg, 1); circle(ctx, e.cx, e.cy, e.S * 0.018); ctx.fill();
  } },
  { id: 'iris', name: '絞りの羽', draw(ctx, e) {
    // 2026-10-20 持ち主「ほかの演出と足したら使える」：羽が回りながら開閉し、外に目盛りの輪・奥に同心円を足す
    const p = pulse(e, 3), n = 9, open = 0.1 + 0.16 * (0.5 + 0.5 * Math.sin(barPhase(e) * TAU)) + 0.08 * p;
    for (let k = 1; k <= 5; k++) { pen(ctx, e.fg, lw(e, 0.002), 0.35); circle(ctx, e.cx, e.cy, e.S * open * k * 0.9); ctx.stroke(); }
    ctx.save(); ctx.translate(e.cx, e.cy); ctx.rotate(e.t * 0.25);
    for (let i = 0; i < n; i++) {
      ctx.rotate(TAU / n);
      ink(ctx, i % 3 ? e.fg : e.accent, 0.28 + 0.25 * e.energy);
      ctx.beginPath(); ctx.moveTo(e.S * open, 0); ctx.lineTo(e.S * 0.62, -e.S * 0.22); ctx.lineTo(e.S * 0.62, e.S * 0.26); ctx.closePath(); ctx.fill();
      pen(ctx, e.fg, lw(e, 0.003), 0.8); ctx.stroke();
    }
    ctx.restore();
    for (let i = 0; i < 72; i++) { const a = (i / 72) * TAU - e.t * 0.1; const r0 = e.S * (i % 6 ? 0.46 : 0.44); pen(ctx, e.fg, lw(e, 0.003), 0.6); line(ctx, e.cx + Math.cos(a) * r0, e.cy + Math.sin(a) * r0, e.cx + Math.cos(a) * e.S * 0.48, e.cy + Math.sin(a) * e.S * 0.48); ctx.stroke(); }
  } },
  { id: 'sonar', name: 'ソナー', draw(ctx, e) {
    // 2026-10-20 持ち主「探知の量をふやそう」：見つける点を 36 に増やし、見つけた点に輪と照準を付ける
    const a = e.t * 2.2;
    for (let k = 1; k <= 5; k++) { pen(ctx, e.fg, lw(e, 0.003), 0.45); circle(ctx, e.cx, e.cy, e.S * 0.09 * k); ctx.stroke(); }
    pen(ctx, e.fg, lw(e, 0.002), 0.35); line(ctx, e.cx - e.S * 0.46, e.cy, e.cx + e.S * 0.46, e.cy); ctx.stroke(); line(ctx, e.cx, e.cy - e.S * 0.46, e.cx, e.cy + e.S * 0.46); ctx.stroke();
    for (let j = 0; j < 24; j++) {
      pen(ctx, e.accent, lw(e, 0.008), (1 - j / 24) * 0.7);
      const b = a - j * 0.035;
      line(ctx, e.cx, e.cy, e.cx + Math.cos(b) * e.S * 0.45, e.cy + Math.sin(b) * e.S * 0.45); ctx.stroke();
    }
    for (let i = 0; i < 36; i++) {
      const b = hash(i, 3, beatNo(e) >> 1) * TAU, r = e.S * (0.06 + 0.38 * hash(i, 4, beatNo(e) >> 1));
      const seen = ((a - b) % TAU + TAU) % TAU;
      const v = Math.max(0, 1 - seen / 2.5);
      if (v <= 0) continue;
      const x = e.cx + Math.cos(b) * r, y = e.cy + Math.sin(b) * r;
      ink(ctx, i % 5 ? e.fg : e.accent, v); circle(ctx, x, y, e.S * 0.011); ctx.fill();
      pen(ctx, i % 5 ? e.fg : e.accent, lw(e, 0.002), v * 0.8); circle(ctx, x, y, e.S * (0.015 + 0.03 * (1 - v))); ctx.stroke();
      if (i % 5 === 0 && v > 0.6) { const c = e.S * 0.03; path(ctx, [[x - c, y - c * 0.5], [x - c, y - c], [x - c * 0.5, y - c]]); ctx.stroke(); path(ctx, [[x + c, y + c * 0.5], [x + c, y + c], [x + c * 0.5, y + c]]); ctx.stroke(); }
    }
  } },
  { id: 'flower-of-life', name: '花の輪', draw(ctx, e) {
    // 2026-10-20 持ち主「〇が拡大・縮小して、離れたり集まったりしたらもっといい」
    const br = Math.sin(barPhase(e) * TAU);           // 4 小節で集まる⇔離れる
    const r = e.S * 0.1 * (1 + 0.25 * Math.sin(e.t * 1.3) + 0.15 * pulse(e));
    const spread = 1 + 0.55 * br;
    pen(ctx, e.fg, lw(e, 0.003), 0.85);
    circle(ctx, e.cx, e.cy, r); ctx.stroke();
    for (let ring = 1; ring <= 2; ring++) for (let i = 0; i < 6 * ring; i++) {
      const a = (i / (6 * ring)) * TAU + e.t * 0.15 * ring * (ring % 2 ? 1 : -1);
      const rr = r * (1 + 0.2 * Math.sin(e.t * 2 + i));
      pen(ctx, ring === 2 && i % 2 ? e.accent : e.fg, lw(e, 0.003), 0.8);
      circle(ctx, e.cx + Math.cos(a) * r * ring * spread, e.cy + Math.sin(a) * r * ring * spread, rr); ctx.stroke();
    }
  } },
  { id: 'rose', name: 'バラ曲線', draw(ctx, e) {
    const k = 3 + (beatNo(e) >> 2) % 5, p = pulse(e);
    const pts = [];
    for (let i = 0; i <= 720; i++) { const a = (i / 720) * TAU * 2; const r = e.S * 0.42 * Math.cos(k * a / 2) * (0.8 + 0.2 * p); pts.push([e.cx + Math.cos(a + e.t * 0.3) * r, e.cy + Math.sin(a + e.t * 0.3) * r]); }
    pen(ctx, e.fg, lw(e, 0.004)); path(ctx, pts); ctx.stroke();
    pen(ctx, e.accent, lw(e, 0.002), 0.7); circle(ctx, e.cx, e.cy, e.S * 0.42); ctx.stroke();
  } },
  { id: 'segment-ring', name: '区切りの輪', draw(ctx, e) {
    for (let k = 0; k < 4; k++) {
      const n = 6 + k * 4, r = e.S * (0.16 + k * 0.08);
      for (let i = 0; i < n; i++) {
        const on = hash(i, k, beatNo(e)) < 0.4 + 0.4 * e.energy;
        const a = (i / n) * TAU + e.t * 0.2 * (k % 2 ? 1 : -1);
        pen(ctx, on ? e.accent : e.fg, lw(e, 0.02 - k * 0.003), on ? 1 : 0.35);
        ctx.beginPath(); ctx.arc(e.cx, e.cy, r, a + 0.04, a + TAU / n - 0.04); ctx.stroke();
      }
    }
  } },
  { id: 'polar-grid', name: '極の方眼', draw(ctx, e) {
    const p = pulse(e);
    pen(ctx, e.fg, lw(e, 0.002), 0.6);
    for (let k = 1; k <= 7; k++) { circle(ctx, e.cx, e.cy, e.S * 0.07 * k); ctx.stroke(); }
    for (let i = 0; i < 24; i++) { const a = (i / 24) * TAU; line(ctx, e.cx, e.cy, e.cx + Math.cos(a) * e.S * 0.5, e.cy + Math.sin(a) * e.S * 0.5); ctx.stroke(); }
    const hot = beatNo(e) % 24;
    ink(ctx, e.accent, 0.5 + 0.5 * p);
    ctx.beginPath(); ctx.moveTo(e.cx, e.cy); ctx.arc(e.cx, e.cy, e.S * 0.49, (hot / 24) * TAU, ((hot + 1) / 24) * TAU); ctx.closePath(); ctx.fill();
  } },
  { id: 'spiral-arms', name: '渦の腕', draw(ctx, e) {
    const arms = 5;
    for (let a = 0; a < arms; a++) {
      const pts = [];
      for (let i = 0; i < 120; i++) { const r = e.S * 0.004 * i; const ang = (a / arms) * TAU + i * 0.06 + e.t * 0.8; pts.push([e.cx + Math.cos(ang) * r, e.cy + Math.sin(ang) * r]); }
      pen(ctx, a % 2 ? e.fg : e.accent, lw(e, 0.006 + 0.006 * pulse(e))); path(ctx, pts); ctx.stroke();
    }
  } },
  { id: 'gear', name: '歯車', draw(ctx, e) {
    // 2026-10-20 持ち主「歯車あってない」：歯の大きさをそろえ、中心の距離を半径の和にして、歯数の比で回す（かみ合う）
    const tooth = e.S * 0.035; // 歯 1 つの幅（ピッチ円の上）
    const gearAt = (x, y, n, rot, c) => {
      const R = n * tooth / Math.PI; // ピッチ円の半径
      const pts = [];
      for (let i = 0; i < n; i++) for (const [f, rr] of [[0, 0.88], [0.15, 1.1], [0.35, 1.1], [0.5, 0.88]]) {
        const a = rot + ((i + f) / n) * TAU; pts.push([x + Math.cos(a) * R * rr, y + Math.sin(a) * R * rr]);
      }
      pen(ctx, c, lw(e, 0.005)); path(ctx, pts, true); ctx.stroke(); circle(ctx, x, y, R * 0.28); ctx.stroke();
      for (let k = 0; k < 4; k++) { const a = rot + k * TAU / 4; line(ctx, x + Math.cos(a) * R * 0.28, y + Math.sin(a) * R * 0.28, x + Math.cos(a) * R * 0.7, y + Math.sin(a) * R * 0.7); ctx.stroke(); }
      return R;
    };
    const n1 = 16, n2 = 10, R1 = n1 * tooth / Math.PI, R2 = n2 * tooth / Math.PI;
    const turn = e.t * 0.5 + pulse(e) * 0.15;
    const x1 = e.cx - R2 * 0.6, y1 = e.cy + R2 * 0.3;
    const ang = -0.6, x2 = x1 + Math.cos(ang) * (R1 + R2), y2 = y1 + Math.sin(ang) * (R1 + R2);
    gearAt(x1, y1, n1, turn, e.fg);
    // 相手の歯車は逆向きに、歯数の比で回る。接する所で歯と溝が合うよう半歯ずらす
    gearAt(x2, y2, n2, -turn * n1 / n2 + Math.PI + ang * (1 + n1 / n2) + Math.PI / n2, e.accent);
  } },
];
