// 点で描く文字（点の並び・積み上がるブロック・網点・電光掲示板・クロスステッチ・ピン）と、計器（液晶・端末・メーター・ラジオの目盛り・波形・バーコード）
import { TAU, cl, ease, back, lerp, rr, seg, poly, hash, newPath, paintPath } from './tools.js';

// 行を点の升目にする：行の前・強調語・後ろを別々に小さく描いて拾い、横につなぐ。p は点の間隔（画素）
function dotGrid(S, rows, wK = 0.88, hK = 0.5) {
  // 漢字は細かいので、日本語の行は点の段を増やして読めるようにする
  if (!S.english) rows = Math.round(rows * 1.45);
  const parts = [[S.chars.slice(0, S.es).join(''), false], [S.emph, true], [S.chars.slice(S.es + S.el).join(''), false]].filter(([s]) => s);
  const maps = parts.map(([s, e]) => ({ e, b: S.bitmap(s, e ? Math.round(rows * 1.15) : rows) }));
  const total = maps.reduce((a, m) => a + m.b.w, 0) || 1, tall = Math.max(1, ...maps.map(m => m.b.h));
  const p = Math.min(S.W * wK / total, S.H * hK / tall);
  const x0 = S.cx - total * p / 2, y0 = S.cy - tall * p / 2;
  const list = [];
  let ox = 0;
  for (const m of maps) {
    const dy = tall - m.b.h;
    for (let y = 0; y < m.b.h; y++) for (let x = 0; x < m.b.w; x++) if (m.b.on(x, y)) list.push({ gx: ox + x, gy: dy + y, x: x0 + (ox + x + 0.5) * p, y: y0 + (dy + y + 0.5) * p, e: m.e });
    ox += m.b.w;
  }
  const cell = new Uint8Array(total * tall);
  for (const d of list) cell[d.gy * total + d.gx] = d.e ? 2 : 1;
  // 画面の点 (x, y) が字の中か：0＝外・1＝字・2＝強調語
  const at = (x, y) => { const gx = Math.floor((x - x0) / p), gy = Math.floor((y - y0) / p); return gx < 0 || gy < 0 || gx >= total || gy >= tall ? 0 : cell[gy * total + gx]; };
  return { list, p, cols: total, rows: tall, x0, y0, at };
}
// 丸い点をまとめて塗る（色ごとに 1 回で塗ると軽い）
function dotsFill(c, pts, color) {
  if (!pts.length) return;
  c.beginPath();
  for (const [x, y, r] of pts) { if (r > 0.2) { c.moveTo(x + r, y); c.arc(x, y, r, 0, TAU); } }
  c.fillStyle = color; c.fill();
}

export default function dots(add) {
  // 点の並び：丸い点で描いた文字が、左の列から順に点く
  add('dot', 'dot-matrix', '丸い点の文字', (c, S) => {
    const G = dotGrid(S, 16);
    const front = ease((S.T - 0.1) / 0.8) * (G.cols + 4);
    const fg = [], ac = [];
    for (const d of G.list) {
      const k = cl((front - d.gx) / 3);
      if (k > 0) (d.e ? ac : fg).push([d.x, d.y, G.p * 0.38 * k]);
    }
    dotsFill(c, fg, S.pal.fg); dotsFill(c, ac, S.pal.accent);
  });

  // 積み上がるブロック：四角い粒が上から落ちて、下の段から字を組み上げる
  add('dot', 'blocks', '積み上がるブロック', (c, S) => {
    const G = dotGrid(S, 12);
    c.lineWidth = Math.max(1, G.p * 0.08);
    const fg = newPath(), ac = newPath(), k = G.p * 0.4;
    for (const d of G.list) {
      const at = 0.1 + (G.rows - d.gy) * 0.05 + hash(d.gx, d.gy) * 0.25;
      const q = ease((S.T - at) / 0.3);
      if (q <= 0) continue;
      (d.e ? ac : fg).rect(d.x - k, d.y - (1 - q) * S.H * 0.6 - k, k * 2, k * 2);
    }
    // 中を塗って読みやすく（線だけだと点が細かい漢字がつぶれる）
    c.fillStyle = S.pal.fg; paintPath(c, fg);
    c.fillStyle = S.pal.accent; paintPath(c, ac);
  });

  // 網点：画面いっぱいの小さな点の中に、大きな点で字が浮かぶ。波が通ると点がふくらむ
  add('dot', 'halftone', '網点の文字', (c, S) => {
    const G = dotGrid(S, 20, 0.9, 0.56);
    const q = ease((S.T - 0.1) / 0.7);
    const pitch = Math.max(G.p, S.U / 90);
    const fg = [], ac = [];
    const ox = G.x0 % pitch, oy = G.y0 % pitch;
    for (let y = oy - pitch / 2; y < S.H + pitch; y += pitch) for (let x = ox - pitch / 2; x < S.W + pitch; x += pitch) {
      const wave = 0.5 + 0.5 * Math.sin((x + y) / (pitch * 9) - S.T * 4);
      const v = G.at(x, y);
      const k = v ? (0.34 + 0.08 * wave) * q + 0.06 : 0.04 + 0.05 * wave; // 字の点は大きくそろえ、地の点は小さく
      (v === 2 ? ac : fg).push([x, y, pitch * k]);
    }
    dotsFill(c, fg, S.pal.fg); dotsFill(c, ac, S.pal.accent);
  });

  // 電光掲示板：暗い点の並ぶ板の上を、行が右から流れてきて止まる
  add('dot', 'led', '電光掲示板', (c, S) => {
    const G = dotGrid(S, 14, 0.86, 0.44);
    const pad = 2, cols = G.cols + pad * 2, rows = G.rows + pad * 2;
    const L = G.x0 - pad * G.p, Tp = G.y0 - pad * G.p;
    c.strokeStyle = S.pal.fg; c.lineWidth = S.lw;
    rr(c, L - G.p, Tp - G.p, cols * G.p + G.p * 2, rows * G.p + G.p * 2, G.p); c.stroke();
    const dim = [];
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) dim.push([L + (i + 0.5) * G.p, Tp + (j + 0.5) * G.p, G.p * 0.18]);
    c.globalAlpha = 0.1 * S.vis; dotsFill(c, dim, S.pal.fg); c.globalAlpha = S.vis;
    const shift = Math.round((1 - ease((S.T - 0.1) / 1.2)) * cols);
    const lit = [], ac = [];
    for (const d of G.list) {
      const gx = d.gx + shift;
      if (gx < G.cols + pad) (d.e ? ac : lit).push([G.x0 + (gx + 0.5) * G.p, d.y, G.p * 0.46]);
    }
    dotsFill(c, lit, S.pal.band); dotsFill(c, ac, S.pal.accent);
  });

  // クロスステッチ：刺しゅうの枠の中に、×の糸で字が縫われていく
  add('dot', 'stitch', 'クロスステッチ', (c, S) => {
    const G = dotGrid(S, 13, 0.7, 0.4);
    const R = Math.hypot(G.cols * G.p, G.rows * G.p) * 0.56;
    c.strokeStyle = S.pal.fg; c.lineWidth = S.lw * 1.4;
    c.beginPath(); c.ellipse(S.cx, S.cy, R, R * Math.min(1, (G.rows * G.p * 1.9) / R), 0, 0, TAU); c.stroke();
    c.lineWidth = S.lw * 0.6;
    c.beginPath(); c.ellipse(S.cx, S.cy, R * 0.95, R * 0.95 * Math.min(1, (G.rows * G.p * 1.9) / R), 0, 0, TAU); c.stroke();
    const k = G.p * 0.36;
    c.lineWidth = Math.max(1, G.p * 0.16); c.lineCap = 'round';
    const fg = newPath(), ac = newPath();
    for (const d of G.list) {
      const at = 0.15 + hash(d.gx, d.gy + 3) * 1.0;
      const q = cl((S.T - at) / 0.12);
      if (q <= 0) continue;
      const path = d.e ? ac : fg;
      path.moveTo(d.x - k, d.y - k); path.lineTo(d.x - k + 2 * k * q, d.y - k + 2 * k * q);
      if (q >= 1) { path.moveTo(d.x + k, d.y - k); path.lineTo(d.x - k, d.y + k); }
    }
    c.strokeStyle = S.pal.fg; paintPath(c, fg, 'stroke');
    c.strokeStyle = S.pal.accent; paintPath(c, ac, 'stroke');
  });

  // ピン：縦の短い線の並びで、字の所だけ線が長く起き上がる
  add('dot', 'pins', '起き上がるピン', (c, S) => {
    const G = dotGrid(S, 18, 0.9, 0.5);
    c.lineCap = 'round';
    // 線は「字の外・字・強調語」の 3 つにまとめて描く
    const groups = [[newPath(), S.pal.fg, 0.14, 0.3], [newPath(), S.pal.fg, 0.26, 1], [newPath(), S.pal.accent, 0.26, 1]];
    for (let gy = -2; gy < G.rows + 2; gy++) for (let gx = -2; gx < G.cols + 2; gx++) {
      const x = G.x0 + (gx + 0.5) * G.p, y = G.y0 + (gy + 0.5) * G.p;
      const v = G.at(x, y);
      const q = v ? ease((S.T - 0.1 - gx * 0.008) / 0.4) : 0;
      const len = G.p * (0.12 + 0.75 * q);
      const path = groups[v][0];
      path.moveTo(x - len * 0.25, y + len * 0.5); path.lineTo(x + len * 0.25, y - len * 0.5);
    }
    for (const [path, col, lw, a] of groups) { c.strokeStyle = col; c.lineWidth = Math.max(1, G.p * lw); c.globalAlpha = a * S.vis; paintPath(c, path, 'stroke'); }
    c.globalAlpha = S.vis;
  });

  // ---- 計器 ----
  // 液晶：外枠と画面、電池と電波の印、点の書体で打ち込まれる。隅に時刻の数字
  add('meter', 'lcd', '液晶の文字盤', (c, S) => {
    const px = S.fit(S.W * 0.62, S.U * 0.11);
    const w = S.layout(px).width + px * 1.6, h = px * 2.8;
    const x = S.cx - w / 2, y = S.cy - h / 2;
    c.strokeStyle = S.pal.fg; c.lineWidth = S.lw;
    rr(c, x - px * 0.4, y - px * 0.4, w + px * 0.8, h + px * 0.8, px * 0.4); c.stroke();
    c.lineWidth = S.lw * 0.7; c.strokeRect(x, y, w, h);
    // 電池・電波
    const s = px * 0.28;
    c.strokeRect(x + w - s * 3.4, y + s * 0.7, s * 2.2, s); c.strokeRect(x + w - s * 1.2, y + s * 0.95, s * 0.25, s * 0.5);
    for (let k = 0; k < Math.floor(S.T * 3) % 4 + 1; k++) c.fillRect(x + w - s * 3.2 + k * s * 0.5, y + s * 0.85, s * 0.35, s * 0.7);
    for (let k = 0; k < 4; k++) c.strokeRect(x + s * 0.8 + k * s * 0.5, y + s * 1.7 - s * 0.25 * k, s * 0.3, s * 0.25 * (k + 1));
    // 点の書体（DotGothic16）で打つ
    const shown = Math.floor((S.T - 0.3) / 0.07);
    const lay = S.layout(px), left = S.cx - lay.width / 2;
    c.font = `${px}px "DotGothic16", monospace`;
    lay.glyphs.forEach((g, n) => {
      if (n > shown) return;
      c.fillStyle = g.e ? S.pal.accent : S.pal.fg;
      c.font = `${g.px}px "DotGothic16", monospace`;
      c.fillText(g.ch, left + g.x, S.cy + px * 0.5);
    });
    if (Math.floor(S.T * 2.5) % 2 === 0) { const cx = left + (lay.glyphs[Math.min(lay.glyphs.length - 1, Math.max(0, shown))]?.x ?? 0) + px * 0.9; c.fillStyle = S.pal.fg; c.fillRect(Math.min(cx, x + w - px * 0.4), S.cy + px * 0.62, px * 0.5, px * 0.08); }
    c.font = `${px * 0.32}px "DotGothic16", monospace`; c.fillStyle = S.pal.fg;
    const sec = Math.floor(S.T * 10);
    c.fillText(`00:${String(Math.floor(sec / 10)).padStart(2, '0')}.${sec % 10}`, x + px * 0.3, y + h - px * 0.3);
  });

  // 端末の窓：題名の帯と閉じる×、前の行が薄く残り、行が打ち込まれて四角いカーソルが点滅
  add('meter', 'terminal', '端末の窓', (c, S) => {
    const px = S.fit(S.W * 0.62, S.U * 0.1);
    const w = S.layout(px).width + px * 2.6, h = px * 4.2;
    const x = S.cx - w / 2, y = S.cy - h / 2, bar = px * 0.75;
    const q = ease((S.T - 0.05) / 0.35);
    c.save(); c.translate(S.cx, S.cy); c.scale(1, q); c.translate(-S.cx, -S.cy);
    c.strokeStyle = S.pal.fg; c.lineWidth = S.lw;
    c.strokeRect(x, y, w, h); seg(c, x, y + bar, x + w, y + bar);
    S.say(c, 'lyrics.txt', x + px * 0.4, y + bar / 2, bar * 0.45, { align: 'left' });
    const xx = x + w - bar * 0.6; seg(c, xx - bar * 0.15, y + bar * 0.35, xx + bar * 0.15, y + bar * 0.65); seg(c, xx + bar * 0.15, y + bar * 0.35, xx - bar * 0.15, y + bar * 0.65);
    c.globalAlpha *= 0.35;
    S.say(c, '> ' + S.chars.slice(0, Math.max(1, S.es)).join('') + '…', x + px * 0.5, y + bar + px * 0.8, px * 0.45, { align: 'left' });
    c.globalAlpha /= 0.35;
    S.say(c, '>', x + px * 0.5, y + bar + px * 2.0, px * 0.8, { align: 'left', color: S.pal.accent });
    const shown = Math.floor((S.T - 0.35) / 0.06);
    const lay = S.layout(px * 0.95), left = x + px * 1.4;
    lay.glyphs.forEach((g, n) => { if (n <= shown) S.say(c, g.ch, left + g.x + g.w / 2, y + bar + px * 2.0, g.px, { heavy: g.e, color: g.e ? S.pal.accent : S.pal.fg }); });
    const curX = left + (shown >= lay.glyphs.length ? lay.width : (lay.glyphs[Math.max(0, shown)]?.x ?? 0));
    if (Math.floor(S.T * 2.4) % 2 === 0) { c.fillStyle = S.pal.fg; c.fillRect(curX + px * 0.1, y + bar + px * 1.5, px * 0.5, px); }
    c.restore();
  });

  // メーター：半円の目盛りに針が振れて止まり、拍で少しふるえる。下に行
  add('meter', 'gauge', '針のメーター', (c, S) => {
    const R = S.U * 0.3;
    const oy = S.cy + R * 0.25;
    const px = S.fit(S.W * 0.6, S.U * 0.09);
    c.strokeStyle = S.pal.fg; c.lineWidth = S.lw;
    c.beginPath(); c.arc(S.cx, oy, R, Math.PI, TAU); c.stroke();
    for (let k = 0; k <= 20; k++) {
      const a = Math.PI + k * Math.PI / 20, l = k % 5 ? 0.07 : 0.15;
      c.strokeStyle = k >= 16 ? S.pal.accent : S.pal.fg;
      seg(c, S.cx + Math.cos(a) * R, oy + Math.sin(a) * R, S.cx + Math.cos(a) * R * (1 - l), oy + Math.sin(a) * R * (1 - l));
    }
    const v = back(S.inRaw(0.1, 0.8)) * 0.82 + S.beatQ * 0.04 + Math.sin(S.T * 23) * 0.006;
    const a = Math.PI + v * Math.PI;
    c.strokeStyle = S.pal.accent; c.lineWidth = S.lw * 1.5;
    seg(c, S.cx, oy, S.cx + Math.cos(a) * R * 0.88, oy + Math.sin(a) * R * 0.88);
    c.beginPath(); c.arc(S.cx, oy, R * 0.05, 0, TAU); c.stroke();
    c.strokeStyle = S.pal.fg; c.lineWidth = S.lw;
    c.strokeRect(S.cx - R * 1.15, oy - R * 1.15, R * 2.3, R * 1.15 + px * 2.3);
    seg(c, S.cx - R * 1.15, oy + px * 0.2, S.cx + R * 1.15, oy + px * 0.2);
    S.line(c, S.cx, oy + px * 1.0, px);
  });

  // ラジオの目盛り：横の目盛りの上を赤い針が動き、強調語の所で止まる
  add('meter', 'dial', 'ラジオの目盛り', (c, S) => {
    const px = S.fit(S.W * 0.7, S.U * 0.1);
    const lay = S.layout(px), left = S.cx - lay.width / 2;
    const y = S.cy;
    c.strokeStyle = S.pal.fg; c.lineWidth = S.lw;
    const x0 = left - px, x1 = left + lay.width + px;
    c.strokeRect(x0 - px * 0.3, y - px * 2.2, x1 - x0 + px * 0.6, px * 3.4);
    seg(c, x0, y - px * 0.9, x1, y - px * 0.9);
    for (let k = 0; k <= 40; k++) { const x = x0 + (x1 - x0) * k / 40; seg(c, x, y - px * 0.9, x, y - px * (k % 5 ? 1.15 : 1.4)); }
    for (let k = 0; k <= 4; k++) S.say(c, String(76 + k * 4), x0 + (x1 - x0) * k / 4, y - px * 1.75, px * 0.3);
    const eg = lay.glyphs.filter(g => g.e);
    const target = eg.length ? left + (eg[0].x + eg[eg.length - 1].x + eg[eg.length - 1].w) / 2 : S.cx;
    const q = ease((S.T - 0.2) / 1.2);
    const nx = lerp(x0, target, q) + Math.sin(S.T * 6) * px * 0.15 * (1 - q);
    c.strokeStyle = S.pal.accent; c.lineWidth = S.lw * 1.6; seg(c, nx, y - px * 2.0, nx, y + px * 1.0);
    S.line(c, S.cx, y + px * 0.25, px, { each: g => ({ alpha: 0.35 + 0.65 * cl(1 - Math.abs(left + g.x + g.w / 2 - nx) / (px * 2.5)) + (q >= 1 ? 1 : 0) }) });
  });

  // 波形の窓：方眼の窓に波形の線が走り、拍で振れが大きくなる。行は地の色で縁取って上に
  add('meter', 'scope', '波形の窓', (c, S) => {
    const px = S.fit(S.W * 0.62, S.U * 0.11);
    const w = S.layout(px).width + px * 2, h = px * 3.4;
    const x = S.cx - w / 2, y = S.cy - h / 2;
    c.strokeStyle = S.pal.fg; c.lineWidth = S.lw;
    rr(c, x, y, w, h, px * 0.3); c.stroke();
    c.lineWidth = S.lw * 0.4; c.globalAlpha = 0.5 * S.vis;
    for (let k = 1; k < 10; k++) seg(c, x + w * k / 10, y, x + w * k / 10, y + h);
    for (let k = 1; k < 4; k++) seg(c, x, y + h * k / 4, x + w, y + h * k / 4);
    c.globalAlpha = S.vis;
    const amp = h * (0.12 + 0.22 * S.beatQ), run = ease((S.T - 0.1) / 0.6);
    c.strokeStyle = S.pal.band; c.lineWidth = S.lw * 1.3;
    c.beginPath();
    for (let k = 0; k <= 120 * run; k++) { const f = k / 120, xx = x + w * f; const yy = S.cy + Math.sin(f * 22 + S.T * 7) * amp * Math.sin(f * Math.PI) + Math.sin(f * 61 - S.T * 11) * amp * 0.25; k ? c.lineTo(xx, yy) : c.moveTo(xx, yy); }
    c.stroke();
    S.line(c, S.cx, S.cy, px, { outline: true, alpha: cl((S.T - 0.4) / 0.3) });
  });

  // バーコード：太さの違う線が左から並び、下に行の字が等間隔に
  add('meter', 'barcode', 'バーコード', (c, S) => {
    const px = S.fit(S.W * 0.6, S.U * 0.1);
    const lay = S.layout(px);
    const w = lay.width + px * 1.4, h = px * 2.2;
    const x = S.cx - w / 2, y = S.cy - h * 0.75;
    const q = ease((S.T - 0.1) / 0.6);
    c.strokeStyle = S.pal.fg;
    let bx = x, k = 0;
    while (bx < x + w * q) {
      const code = S.chars[k % S.chars.length].codePointAt(0) ?? 0;
      const thick = ((code >> (k % 5)) & 1) ? 2.4 : 0.9;
      c.lineWidth = S.lw * thick;
      c.strokeStyle = S.isE(k % S.chars.length) ? S.pal.accent : S.pal.fg;
      seg(c, bx, y, bx, y + h * (k % 9 === 0 ? 1.12 : 1));
      bx += S.lw * (thick + 2 + hash(k, 1) * 3);
      k++;
    }
    S.line(c, S.cx, y + h + px * 0.8, px, { each: g => ({ alpha: S.typeA(g.i, 0.6, 0.04) }) });
  });
}
