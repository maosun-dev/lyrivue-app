// 紙もの（カード・破れた紙・情報カード・折り紙・封筒・レシート・重なった紙）と、帯・切符（切符・テープ・ラベル・リボン・フィルム）
import { TAU, cl, ease, back, lerp, rr, seg, poly, hash, dashOn } from './tools.js';

// 行を載せる板の大きさ：文字の大きさ px と、板の幅・高さ
function plate(S, wK = 0.74, maxPx = 0.13, padX = 0.9, padY = 1.9) {
  const px = S.fit(S.W * wK, S.U * maxPx);
  const w = S.layout(px).width + px * padX * 2;
  return { px, w, h: px * padY };
}
// ぎざぎざの縁（破れ・テープの端）：x0→x1 を細かく上下させた点の列
function jag(x0, y0, x1, y1, n, amp, seed) {
  return Array.from({ length: n + 1 }, (_, k) => { const f = k / n; return [lerp(x0, x1, f) + (hash(k, seed) - 0.5) * amp * 0.4, lerp(y0, y1, f) + (hash(k, seed + 1) - 0.5) * amp]; });
}

export default function paper(add) {
  // 裏返るカード：裏（同心の角丸の線）から表へ、縦の軸で回る。真ん中でもう一回転
  add('paper', 'flip-card', '裏返るカード', (c, S) => {
    const { px, w, h } = plate(S, 0.7, 0.12, 0.8, 2.3);
    const ang = Math.PI * (1 - back(S.inRaw(0, 0.75))) + TAU * ease((S.T - 2.1) / 0.7);
    const k = Math.cos(ang);
    c.save();
    c.translate(S.cx, S.cy);
    c.rotate(Math.sin(S.T * 0.8) * 0.03);
    c.scale(Math.max(0.01, Math.abs(k)), 1);
    c.strokeStyle = S.pal.fg; c.lineWidth = S.lw / Math.max(0.3, Math.abs(k));
    rr(c, -w / 2, -h / 2, w, h, px * 0.25); c.fillStyle = S.pal.bg; c.fill(); c.stroke();
    if (k < 0) {
      c.lineWidth = S.lw * 0.7;
      for (let r = 1; r <= 5; r++) { const f = r / 6; rr(c, -w / 2 * f, -h / 2 * f, w * f, h * f, px * 0.25 * f); c.stroke(); }
      c.strokeStyle = S.pal.accent; c.beginPath(); c.arc(0, 0, h * 0.12, 0, TAU); c.stroke();
    } else {
      S.line(c, 0, 0, px);
      c.lineWidth = S.lw * 0.6; rr(c, -w / 2 + px * 0.2, -h / 2 + px * 0.2, w - px * 0.4, h - px * 0.4, px * 0.15); c.stroke();
    }
    c.restore();
  });

  // 破れた紙：上下の縁がぎざぎざの紙が、傾いて下から差し込まれる
  add('paper', 'torn', '破れた紙', (c, S) => {
    const { px, w, h } = plate(S, 0.64, 0.13, 0.9, 2.4);
    const q = back(S.inRaw(0, 0.6));
    c.save();
    c.translate(S.cx, S.cy + (1 - q) * S.H * 0.6);
    c.rotate(-0.06 + (1 - q) * 0.3);
    const top = jag(-w / 2, -h / 2, w / 2, -h / 2, 26, px * 0.28, 4), bot = jag(w / 2, h / 2, -w / 2, h / 2, 26, px * 0.28, 9);
    // ずれた影の線
    c.save(); c.translate(px * 0.14, px * 0.16); poly(c, [...top, ...bot]); c.setLineDash([S.lw * 3, S.lw * 3]); c.strokeStyle = S.pal.fg; c.lineWidth = S.lw * 0.7; c.stroke(); c.restore();
    poly(c, [...top, ...bot]); c.fillStyle = S.pal.bg; c.fill(); c.strokeStyle = S.pal.fg; c.lineWidth = S.lw; c.stroke();
    S.line(c, 0, 0, px, { each: g => ({ alpha: S.typeA(g.i, 0.4, 0.04) }) });
    c.restore();
  });

  // 情報カード：罫線と左の縦線のあるカードに、左から書かれていく
  add('paper', 'index-card', '罫線のカード', (c, S) => {
    const { px, w, h } = plate(S, 0.7, 0.12, 1.1, 3.0);
    const q = S.in(0, 0.5);
    c.save();
    c.translate(S.cx, S.cy); c.rotate(0.03 - (1 - q) * 0.12); c.scale(0.85 + 0.15 * q, 0.85 + 0.15 * q);
    c.globalAlpha *= q;
    c.strokeStyle = S.pal.fg; c.lineWidth = S.lw;
    c.strokeRect(-w / 2, -h / 2, w, h);
    c.lineWidth = S.lw * 0.6; c.strokeStyle = S.pal.band;
    for (let r = 1; r <= 4; r++) seg(c, -w / 2, -h / 2 + h * (0.1 + r * 0.2) , w / 2, -h / 2 + h * (0.1 + r * 0.2));
    c.strokeStyle = S.pal.accent; seg(c, -w / 2 + px * 0.7, -h / 2, -w / 2 + px * 0.7, h / 2);
    seg(c, -w / 2, -h / 2 + h * 0.18, w / 2, -h / 2 + h * 0.18);
    const wipe = cl((S.T - 0.4) / 0.9);
    c.save(); c.beginPath(); c.rect(-w / 2, -h / 2, w * wipe, h); c.clip();
    S.line(c, px * 0.3, h * 0.12, px * 0.95);
    c.restore();
    c.restore();
  });

  // 折りたたんだ紙：じゃばらに 4 つ折りの紙が開いて、行が読める
  add('paper', 'fold', 'じゃばら折りの紙', (c, S) => {
    const { px, w, h } = plate(S, 0.72, 0.13, 0.7, 2.2);
    const q = ease((S.T - 0.15) / 0.8) * (1 - S.out(0, 0.5));
    const n = 4, pw = w / n, sk = (1 - q) * 0.55;
    const total = pw * n * (0.25 + 0.75 * q);
    for (let k = 0; k < n; k++) {
      const x0 = S.cx - total / 2 + total / n * k;
      const dir = k % 2 ? -1 : 1;
      c.save();
      c.translate(x0, S.cy);
      c.transform((0.25 + 0.75 * q), dir * sk * 0.35, 0, 1, 0, 0);
      c.beginPath(); c.rect(0, -h / 2, pw, h); c.fillStyle = S.pal.bg; c.fill();
      c.strokeStyle = S.pal.fg; c.lineWidth = S.lw; c.stroke();
      c.clip();
      S.line(c, w / 2 - pw * k, 0, px);
      // 折り目の影：線を 1 本
      c.lineWidth = S.lw * 0.5; seg(c, dir > 0 ? pw - S.lw : S.lw, -h / 2, dir > 0 ? pw - S.lw : S.lw, h / 2);
      c.restore();
    }
  }, { ownExit: true });

  // 封筒：ふたが開いて、中のカードがせり上がる
  add('paper', 'envelope', '封筒から出るカード', (c, S) => {
    const { px, w } = plate(S, 0.5, 0.1, 0.6, 2.0);
    const ew = w * 1.12, eh = Math.min(ew * 0.42, S.H * 0.3);
    const ex = S.cx - ew / 2, ey = S.cy + eh * 0.15;
    const open = ease((S.T - 0.2) / 0.4), rise = ease((S.T - 0.55) / 0.6);
    c.save();
    c.globalAlpha *= S.in(0, 0.3);
    c.strokeStyle = S.pal.fg; c.lineWidth = S.lw;
    c.strokeRect(ex, ey, ew, eh);
    // ふた：上の辺を軸に、下向きの三角が上向きへ
    const fy = ey + eh * 0.55 * Math.cos(open * Math.PI);
    if (open < 0.5) { poly(c, [[ex, ey], [S.cx, fy], [ex + ew, ey]]); c.fillStyle = S.pal.bg; c.fill(); c.stroke(); }
    else { poly(c, [[ex, ey], [S.cx, fy], [ex + ew, ey]]); c.stroke(); }
    // カード（封筒の口より上だけ見える）
    if (open >= 0.5) {
      const ch = px * 2.2, cy = ey + eh * 0.5 - rise * (ch * 0.95 + eh * 0.2);
      c.save(); c.beginPath(); c.rect(0, 0, S.W, ey + eh * 0.5); c.clip();
      rr(c, S.cx - w / 2, cy - ch / 2, w, ch, px * 0.12); c.fillStyle = S.pal.bg; c.fill(); c.stroke();
      S.line(c, S.cx, cy, px);
      c.restore();
    }
    // 前の折り返し（左右と下の三角）
    poly(c, [[ex, ey + eh], [S.cx, ey + eh * 0.5], [ex + ew, ey + eh]], false); c.stroke();
    seg(c, ex, ey, S.cx - ew * 0.1, ey + eh * 0.55); seg(c, ex + ew, ey, S.cx + ew * 0.1, ey + eh * 0.55);
    c.restore();
  });

  // レシート：上から細長い紙が伸びてくる。点線の区切りと、下はぎざぎざ
  add('paper', 'receipt', 'のびるレシート', (c, S) => {
    const vertical = S.H > S.W;
    const px = S.fit(S.W * (vertical ? 0.7 : 0.46), S.U * 0.08);
    const w = Math.max(S.layout(px).width + px * 1.6, S.U * 0.4), full = px * 7.2;
    const hNow = full * ease((S.T - 0.1) / 1.0);
    const x = S.cx - w / 2, y = S.cy - full / 2;
    c.save();
    c.beginPath(); c.rect(x - 4, y - 4, w + 8, hNow + px * 0.5); c.clip();
    const pts = [[x, y], [x + w, y], ...Array.from({ length: 13 }, (_, k) => [x + w - k * w / 12, y + hNow + (k % 2 ? px * 0.25 : 0)])];
    poly(c, pts); c.fillStyle = S.pal.bg; c.fill(); c.strokeStyle = S.pal.fg; c.lineWidth = S.lw; c.stroke();
    const row = r => y + px * (0.9 + r * 1.15);
    S.say(c, 'No.' + String(400 + S.chars.length * 7).padStart(4, '0'), S.cx, row(0), px * 0.45, {});
    c.setLineDash([S.lw * 2, S.lw * 2]); seg(c, x + px * 0.4, row(0.6), x + w - px * 0.4, row(0.6)); c.setLineDash([]);
    S.line(c, S.cx, row(1.6), px);
    c.setLineDash([S.lw * 2, S.lw * 2]); seg(c, x + px * 0.4, row(2.5), x + w - px * 0.4, row(2.5)); c.setLineDash([]);
    S.say(c, S.emph || S.text, x + px * 0.5, row(3.3), px * 0.55, { align: 'left', color: S.pal.accent, heavy: true });
    S.say(c, '×1', x + w - px * 0.5, row(3.3), px * 0.5, { align: 'right' });
    // バーの並び
    for (let k = 0; k < 28; k++) { const bx = x + px * 0.5 + k * (w - px) / 28; c.lineWidth = hash(k, 3) > 0.6 ? S.lw * 1.6 : S.lw * 0.6; seg(c, bx, row(4.1), bx, row(4.7)); }
    c.restore();
  });

  // 重なった紙：3 枚の紙がずれて重なり、拍でずれ方が変わる
  add('paper', 'stack', '重なった紙', (c, S) => {
    const { px, w, h } = plate(S, 0.66, 0.12, 0.9, 2.4);
    const beatK = S.beatN % 4;
    for (let k = 2; k >= 0; k--) {
      const q = ease((S.T - 0.1 - (2 - k) * 0.12) / 0.4);
      if (q <= 0) continue;
      const rot = (hash(k, beatK) - 0.5) * 0.16 * k + (k === 0 ? -0.02 : 0);
      c.save();
      c.translate(S.cx + k * px * 0.18, S.cy + k * px * 0.14 + (1 - q) * px);
      c.rotate(rot);
      c.globalAlpha *= q;
      c.beginPath(); c.rect(-w / 2, -h / 2, w, h); c.fillStyle = S.pal.bg; c.fill();
      c.strokeStyle = k === 0 ? S.pal.fg : S.pal.band; c.lineWidth = S.lw; c.stroke();
      if (k === 0) S.line(c, 0, 0, px);
      c.restore();
    }
  });

  // ---- 帯・切符 ----
  // 切符：切り欠きとミシン目のある切符。半券には番号、拍で穴が開く
  add('tape', 'ticket', '切符', (c, S) => {
    const { px, w, h } = plate(S, 0.62, 0.11, 0.8, 2.6);
    const stub = h * 0.9, W2 = w + stub;
    const q = back(S.inRaw(0, 0.55));
    c.save();
    c.translate(S.cx + (1 - q) * S.W * 0.7, S.cy); c.rotate(-0.04);
    const x = -W2 / 2, y = -h / 2, nx = x + w, r = h * 0.1;
    c.beginPath();
    c.moveTo(x, y); c.lineTo(nx - r, y); c.arc(nx, y, r, Math.PI, 0, true); c.lineTo(x + W2, y);
    c.lineTo(x + W2, y + h); c.lineTo(nx + r, y + h); c.arc(nx, y + h, r, 0, Math.PI, true); c.lineTo(x, y + h); c.closePath();
    c.fillStyle = S.pal.bg; c.fill(); c.strokeStyle = S.pal.fg; c.lineWidth = S.lw; c.stroke();
    c.setLineDash([S.lw * 2, S.lw * 2.5]); seg(c, nx, y + r, nx, y + h - r); c.setLineDash([]);
    c.lineWidth = S.lw * 0.6; c.strokeRect(x + px * 0.25, y + px * 0.25, w - px * 0.5, h - px * 0.5);
    S.line(c, x + w / 2, 0, px);
    c.save(); c.translate(nx + stub / 2, 0); c.rotate(-Math.PI / 2);
    S.say(c, 'No.' + String(S.chars.length * 37).padStart(4, '0'), 0, 0, stub * 0.16, { color: S.pal.accent });
    c.restore();
    const holes = Math.min(3, Math.floor((S.T - 1.2) / (S.beat * 2)) + 1);
    for (let k = 0; k < holes; k++) { c.beginPath(); c.arc(nx + stub * 0.5, y + h * (0.22 + 0.28 * k), h * 0.05, 0, TAU); c.stroke(); }
    c.restore();
  });

  // テープ：端がぎざぎざの斜めのテープに行を書き、細いテープがもう 1 本交差する
  add('tape', 'masking', '斜めのテープ', (c, S) => {
    const { px, w, h } = plate(S, 0.7, 0.12, 0.9, 1.7);
    const q = ease((S.T - 0.1) / 0.45);
    c.save();
    c.translate(S.cx, S.cy);
    // 交差する細いテープ（後ろ）
    c.save(); c.rotate(0.5); const w2 = S.U * 0.8 * ease((S.T - 0.35) / 0.4), h2 = h * 0.42;
    poly(c, [...jag(-w2 / 2, -h2 / 2, -w2 / 2, h2 / 2, 5, h2 * 0.2, 2), ...jag(w2 / 2, h2 / 2, w2 / 2, -h2 / 2, 5, h2 * 0.2, 7)]);
    c.fillStyle = S.pal.bg; c.fill(); c.strokeStyle = S.pal.band; c.lineWidth = S.lw; c.stroke();
    c.restore();
    c.rotate(-0.08);
    const ww = w * q;
    poly(c, [...jag(-w / 2, -h / 2, -w / 2, h / 2, 6, px * 0.25, 1), ...jag(-w / 2 + ww, h / 2, -w / 2 + ww, -h / 2, 6, px * 0.25, 5)]);
    c.fillStyle = S.pal.bg; c.fill(); c.strokeStyle = S.pal.fg; c.lineWidth = S.lw; c.stroke();
    c.save(); c.clip();
    c.globalAlpha *= 0.25; c.lineWidth = S.lw * 0.5;
    for (let u = -w; u < w; u += px * 0.3) seg(c, u, -h / 2, u + h * 0.3, h / 2);
    c.restore();
    c.save(); c.beginPath(); c.rect(-w / 2, -h, ww, h * 2); c.clip(); S.line(c, 0, 0, px); c.restore();
    c.restore();
  });

  // 立ち入り禁止のテープ：縞の縁取りの帯が画面を横切り、中の行が少しずつ流れる
  add('tape', 'barrier', '縞の縁のテープ', (c, S) => {
    const px = S.fit(S.W * 0.62, S.U * 0.11);
    const h = px * 1.9, q = ease((S.T - 0.1) / 0.5);
    c.save();
    c.translate(S.cx, S.cy); c.rotate(-0.12);
    const L = Math.hypot(S.W, S.H) * 0.6;
    c.beginPath(); c.rect(-L, -h / 2, L * 2 * q, h); c.fillStyle = S.pal.bg; c.fill(); c.clip();
    c.strokeStyle = S.pal.band; c.lineWidth = px * 0.12;
    const off = (S.T * px * 1.2) % (px * 0.8);
    for (let u = -L; u < L; u += px * 0.8) { seg(c, u + off, -h / 2, u + off + px * 0.3, -h / 2 + px * 0.3); seg(c, u - off, h / 2 - px * 0.3, u - off + px * 0.3, h / 2); }
    c.strokeStyle = S.pal.fg; c.lineWidth = S.lw;
    seg(c, -L, -h / 2 + px * 0.34, L, -h / 2 + px * 0.34); seg(c, -L, h / 2 - px * 0.34, L, h / 2 - px * 0.34);
    S.line(c, (S.T - 2) * px * 0.15, 0, px * 0.9);
    c.restore();
  });

  // ラベルライター：細長い濃い帯が左から打ち出され、字は型押し（地の色の縁取り）
  add('tape', 'label', 'ラベルライター', (c, S) => {
    const px = S.fit(S.W * 0.7, S.U * 0.1);
    const lw = S.layout(px).width + px * 1.4, h = px * 1.6;
    const q = cl((S.T - 0.1) / 1.0);
    const x = S.cx - lw / 2;
    c.save();
    c.translate(0, S.cy); c.rotate(0.02);
    c.beginPath(); c.moveTo(x, -h / 2); c.lineTo(x + lw * q, -h / 2); c.lineTo(x + lw * q, h / 2); c.lineTo(x, h / 2); c.closePath();
    c.fillStyle = S.pal.fg; c.fill();
    c.save(); c.clip();
    S.line(c, S.cx, 0, px, { color: S.pal.bg, ecolor: S.pal.accent, heavy: true });
    S.line(c, S.cx - px * 0.03, -px * 0.03, px, { stroke: true, color: S.pal.bg, estroke: true, ecolor: S.pal.bg, lw: Math.max(1, px * 0.025) });
    c.restore();
    // 切り口：斜めに切った端
    if (q >= 1) { c.strokeStyle = S.pal.bg; c.lineWidth = S.lw * 2; seg(c, x + lw - px * 0.3, -h / 2, x + lw, h / 2); }
    c.restore();
  });

  // リボン：両端が V 字に切れた帯が波打ち、字も一緒に上下する
  add('tape', 'ribbon', '波打つリボン', (c, S) => {
    const px = S.fit(S.W * 0.52, S.U * 0.11);
    const w = S.layout(px).width + px * 1.4, h = px * 1.7, q = ease((S.T - 0.1) / 0.6);
    const wave = x => Math.sin(x / w * 5 + S.T * 3) * px * 0.22;
    const n = 40, x0 = S.cx - w / 2 * q;
    // 後ろに折れた端
    c.strokeStyle = S.pal.fg; c.lineWidth = S.lw; c.fillStyle = S.pal.bg;
    for (const side of [-1, 1]) {
      const ex = S.cx + side * w / 2 * q, ey = S.cy + wave(side * w / 2) + h * 0.3;
      poly(c, [[ex - side * px * 0.4, ey - h / 2], [ex + side * px * 1.6, ey - h / 2], [ex + side * px * 1.1, ey], [ex + side * px * 1.6, ey + h / 2], [ex - side * px * 0.4, ey + h / 2]]);
      c.fill(); c.stroke();
    }
    const top = [], bot = [];
    for (let k = 0; k <= n; k++) { const x = x0 + w * q * k / n; top.push([x, S.cy - h / 2 + wave(x - S.cx)]); bot.unshift([x, S.cy + h / 2 + wave(x - S.cx)]); }
    poly(c, [...top, ...bot]); c.fill(); c.stroke();
    c.lineWidth = S.lw * 0.5;
    poly(c, top.map(([x, y]) => [x, y + px * 0.2]), false); c.stroke();
    poly(c, bot.map(([x, y]) => [x, y - px * 0.2]), false); c.stroke();
    S.line(c, S.cx, S.cy, px, { alpha: q, each: g => ({ dy: wave(g.x - S.layout(px).width / 2 + g.w / 2) }) });
  });

  // フィルム：穴の並ぶ帯がコマ送りで流れてきて止まる。1 コマに 1 文字
  add('tape', 'film', 'フィルムのコマ', (c, S) => {
    const list = S.cells({ gap: 0.08, rowGap: 0.95, max: S.U * 0.16, h: 0.62 });
    if (!list.length) return;
    const s = list[0].s;
    const rows = new Map();
    for (const g of list) { if (!rows.has(g.row)) rows.set(g.row, []); rows.get(g.row).push(g); }
    const slide = (1 - ease((S.T - 0.1) / 0.9)) * S.W;
    for (const [r, row] of rows) {
      const dx = (r % 2 ? -1 : 1) * slide;
      const L = row[0].x - s * 0.6 + dx, R = row[row.length - 1].x + s * 0.6 + dx, y = row[0].y;
      c.strokeStyle = S.pal.fg; c.lineWidth = S.lw;
      c.strokeRect(L, y - s * 0.85, R - L, s * 1.7);
      for (let x = L + s * 0.15; x < R - s * 0.1; x += s * 0.3) { c.strokeRect(x, y - s * 0.76, s * 0.14, s * 0.13); c.strokeRect(x, y + s * 0.63, s * 0.14, s * 0.13); }
      for (const g of row) {
        c.lineWidth = S.lw * 0.7;
        c.strokeRect(g.x - s / 2 + dx, y - s * 0.52, s, s * 1.04);
        if (!g.space) S.say(c, g.ch, g.x + dx, y, s * 0.6, { heavy: g.e, color: g.e ? S.pal.accent : S.pal.fg });
      }
    }
  });
}
