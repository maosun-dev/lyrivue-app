// 看板・標識（注意の看板・ひし形の標識・ぶら下がる板・ネオンの枠・矢印の板・電球の看板・駅名標）と、丸・図形
import { TAU, cl, ease, back, lerp, rr, seg, poly, hash, dashOn } from './tools.js';

const plate = (S, wK, maxPx, padX, padY) => {
  const px = S.fit(S.W * wK, S.U * maxPx);
  return { px, w: S.layout(px).width + px * padX * 2, h: px * padY };
};

export default function signs(add) {
  // 注意の看板：縁が斜めの縞の板。左に三角の「！」。振り子のように揺れて止まる
  add('sign', 'caution', '注意の看板', (c, S) => {
    const { px, w, h } = plate(S, 0.62, 0.11, 0.8, 2.6);
    const icon = h * 0.62, W2 = w + icon + px * 0.4;
    const t = S.T - 0.1;
    const swing = t < 0 ? 0 : Math.exp(-t * 3.2) * Math.cos(t * 10) * 0.35;
    c.save();
    c.globalAlpha *= S.in(0, 0.2);
    c.translate(S.cx, S.cy - h / 2); c.rotate(swing); c.translate(0, h / 2);
    rr(c, -W2 / 2, -h / 2, W2, h, px * 0.3); c.fillStyle = S.pal.bg; c.fill();
    c.strokeStyle = S.pal.fg; c.lineWidth = S.lw; c.stroke();
    // 縞：外と内の角丸のあいだだけ
    const b = px * 0.32;
    c.save();
    rr(c, -W2 / 2, -h / 2, W2, h, px * 0.3); c.clip();
    c.strokeStyle = S.pal.band; c.lineWidth = b * 0.45;
    for (let u = -W2 - h; u < W2; u += b * 1.1) seg(c, u, -h / 2 - b, u + h + b, h / 2 + b);
    c.restore();
    // 内側は地の色で塗りつぶして、縞を縁だけに残す
    rr(c, -W2 / 2 + b, -h / 2 + b, W2 - b * 2, h - b * 2, px * 0.15); c.fillStyle = S.pal.bg; c.fill(); c.stroke();
    // 三角の「！」
    const ix = -W2 / 2 + b + icon * 0.62, k = icon * 0.42;
    c.strokeStyle = S.pal.accent; c.lineWidth = S.lw * 1.6; c.lineJoin = 'round';
    poly(c, [[ix, -k], [ix + k * 1.05, k * 0.8], [ix - k * 1.05, k * 0.8]]); c.stroke();
    seg(c, ix, -k * 0.35, ix, k * 0.25); c.beginPath(); c.arc(ix, k * 0.52, S.lw * 1.2, 0, TAU); c.fillStyle = S.pal.accent; c.fill();
    S.line(c, ix + icon * 0.55 + w / 2 - px * 0.6, 0, px);
    c.restore();
  });

  // ひし形の標識：縦の軸で回って現れる、二重の縁のひし形。中に強調語、下の小さな板に行
  add('sign', 'diamond', 'ひし形の標識', (c, S) => {
    const R = S.U * 0.3;
    const k = Math.cos(Math.PI * (1 - back(S.inRaw(0, 0.7))));
    c.save();
    c.translate(S.cx, S.cy - R * 0.25);
    c.scale(Math.max(0.02, Math.abs(k)), 1);
    c.strokeStyle = S.pal.fg; c.lineWidth = S.lw;
    const dia = r => poly(c, [[0, -r], [r, 0], [0, r], [-r, 0]]);
    dia(R); c.fillStyle = S.pal.bg; c.fill(); c.stroke();
    c.strokeStyle = S.pal.accent; dia(R * 0.86); c.stroke();
    if (k > 0) { const word = S.emph || S.text; S.say(c, word, 0, 0, S.fitStr(word, R * 1.05, R * 0.42, true), { heavy: true, color: S.pal.accent }); }
    c.restore();
    // 下の板
    const px = S.fit(S.W * 0.62, S.U * 0.07), pw = S.layout(px).width + px * 1.2, py = S.cy + R * 0.95;
    const q = ease((S.T - 0.6) / 0.4);
    c.save(); c.globalAlpha *= q;
    c.strokeStyle = S.pal.fg; c.lineWidth = S.lw;
    seg(c, S.cx, S.cy + R * 0.75, S.cx, py - px * 0.8);
    c.strokeRect(S.cx - pw / 2, py - px * 0.8, pw, px * 1.6);
    S.line(c, S.cx, py, px);
    c.restore();
  });

  // ぶら下がる板：画面の上から 2 本の紐で吊られた板が揺れる。紐の先は釘
  add('sign', 'hanging', 'ぶら下がる板', (c, S) => {
    const { px, w, h } = plate(S, 0.66, 0.12, 0.8, 2.2);
    const t = S.T - 0.1, drop = back(cl(t / 0.6));
    const ang = t < 0 ? 0 : Math.sin(t * 2.4) * 0.12 * Math.exp(-t * 0.5) + (S.beatQ * 0.02);
    const nail = [S.cx, S.cy - h * 1.6];
    c.save();
    c.strokeStyle = S.pal.fg; c.lineWidth = S.lw;
    c.translate(nail[0], nail[1] - (1 - drop) * S.H); c.rotate(ang);
    const by = h * 1.6;
    seg(c, 0, 0, -w * 0.38, by - h / 2); seg(c, 0, 0, w * 0.38, by - h / 2);
    c.beginPath(); c.arc(0, 0, S.lw * 2.5, 0, TAU); c.stroke();
    rr(c, -w / 2, by - h / 2, w, h, px * 0.12); c.fillStyle = S.pal.bg; c.fill(); c.stroke();
    for (const sx of [-1, 1]) { c.beginPath(); c.arc(sx * w * 0.38, by - h / 2 + px * 0.2, S.lw * 1.5, 0, TAU); c.stroke(); }
    S.line(c, 0, by + px * 0.08, px);
    c.restore();
  });

  // ネオンの枠：線だけの看板の枠が、ちらついてから点く。字も光る線
  add('sign', 'neon', 'ネオン管の枠', (c, S) => {
    const { px, w, h } = plate(S, 0.66, 0.12, 0.8, 2.3);
    const on = S.T < 0.2 ? 0 : S.T < 0.75 ? (hash(Math.floor(S.T * 22), 1) > 0.45 ? 1 : 0.15) : 1;
    const glow = (col, draw) => {
      c.save();
      c.shadowColor = col; c.shadowBlur = px * 0.5 * on;
      c.strokeStyle = col; c.globalAlpha *= 0.25 + 0.75 * on; c.lineWidth = S.lw * 2.2; draw(); c.stroke();
      c.shadowBlur = 0; c.globalAlpha *= 0.9; c.strokeStyle = S.pal.light ? col : '#fff'; c.lineWidth = S.lw * 0.7; draw(); c.stroke();
      c.restore();
    };
    glow(S.pal.band, () => rr(c, S.cx - w / 2, S.cy - h / 2, w, h, h * 0.5));
    glow(S.pal.band, () => rr(c, S.cx - w / 2 + px * 0.25, S.cy - h / 2 + px * 0.25, w - px * 0.5, h - px * 0.5, h * 0.4));
    // 留め具
    c.strokeStyle = S.pal.fg; c.lineWidth = S.lw * 0.6;
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) seg(c, S.cx + sx * w * 0.3, S.cy + sy * h / 2, S.cx + sx * w * 0.3, S.cy + sy * (h / 2 + px * 0.4));
    c.save(); c.shadowColor = S.pal.accent; c.shadowBlur = px * 0.35 * on; c.globalAlpha *= 0.3 + 0.7 * on;
    S.line(c, S.cx, S.cy, px, { stroke: true, estroke: true, lw: Math.max(1.2, px * 0.05) });
    c.restore();
  });

  // 矢印の板：先がとがった案内の板が左から伸び、先が拍で光る
  add('sign', 'arrow', '矢印の案内板', (c, S) => {
    const { px, w, h } = plate(S, 0.6, 0.11, 0.7, 2.0);
    const q = back(S.inRaw(0, 0.55)), tip = h * 0.55;
    const x0 = S.cx - (w + tip) / 2, len = (w + tip) * q;
    c.save();
    c.strokeStyle = S.pal.fg; c.lineWidth = S.lw;
    seg(c, x0 + w * 0.2, S.cy + h / 2, x0 + w * 0.2, S.cy + h * 1.6);
    poly(c, [[x0, S.cy - h / 2], [x0 + len - tip, S.cy - h / 2], [x0 + len, S.cy], [x0 + len - tip, S.cy + h / 2], [x0, S.cy + h / 2]]);
    c.fillStyle = S.pal.bg; c.fill(); c.stroke();
    c.strokeStyle = S.pal.accent; c.globalAlpha *= 0.3 + 0.7 * S.beatQ;
    poly(c, [[x0 + len - tip * 0.6, S.cy - h * 0.3], [x0 + len - tip * 0.05, S.cy], [x0 + len - tip * 0.6, S.cy + h * 0.3]], false); c.stroke();
    c.restore();
    c.save(); c.beginPath(); c.rect(x0, 0, len, S.H); c.clip();
    S.line(c, x0 + w / 2, S.cy, px); c.restore();
  });

  // 電球の看板：縁に並ぶ電球が順に光って回る
  add('sign', 'marquee', '電球の看板', (c, S) => {
    const { px, w, h } = plate(S, 0.64, 0.12, 1.0, 2.6);
    const x = S.cx - w / 2, y = S.cy - h / 2, step = px * 0.42;
    const pts = [];
    for (let u = 0; u < w; u += step) pts.push([x + u, y]);
    for (let u = 0; u < h; u += step) pts.push([x + w, y + u]);
    for (let u = 0; u < w; u += step) pts.push([x + w - u, y + h]);
    for (let u = 0; u < h; u += step) pts.push([x, y + h - u]);
    const shown = Math.floor(pts.length * ease((S.T - 0.1) / 0.6));
    c.strokeStyle = S.pal.fg; c.lineWidth = S.lw;
    rr(c, x - px * 0.3, y - px * 0.3, w + px * 0.6, h + px * 0.6, px * 0.2); c.stroke();
    const chase = Math.floor(S.T * 9);
    pts.slice(0, shown).forEach(([bx, by], k) => {
      const lit = (k + chase) % 3 === 0;
      c.beginPath(); c.arc(bx, by, px * 0.1, 0, TAU);
      if (lit) { c.fillStyle = S.pal.band; c.fill(); } else { c.lineWidth = S.lw * 0.6; c.stroke(); }
    });
    S.line(c, S.cx, S.cy, px, { each: g => ({ alpha: S.typeA(g.i, 0.5, 0.05) }) });
  });

  // 駅名標：大きく強調語、下の帯に前と次（行の前と後ろ）。帯は左から引かれる
  add('sign', 'station', '駅名標', (c, S) => {
    const word = S.emph || S.text;
    const big = S.fitStr(word, S.W * 0.62, S.U * 0.24, true);
    const ww = Math.max(S.cw(word, big, true) + big * 1.2, S.W * 0.62), hh = big * 2.6;
    const x = S.cx - ww / 2, y = S.cy - hh / 2;
    const q = ease((S.T - 0.1) / 0.5);
    c.save(); c.globalAlpha *= q;
    c.strokeStyle = S.pal.fg; c.lineWidth = S.lw;
    c.strokeRect(x, y, ww, hh);
    seg(c, x + ww * 0.12, y + hh, x + ww * 0.12, y + hh + big * 0.8); seg(c, x + ww * 0.88, y + hh, x + ww * 0.88, y + hh + big * 0.8);
    S.say(c, word, S.cx, y + big * 0.95, big, { heavy: true });
    const by = y + hh * 0.66, bw = ww * ease((S.T - 0.35) / 0.6);
    c.strokeStyle = S.pal.accent; c.lineWidth = big * 0.12; seg(c, x, by, x + bw, by);
    const small = big * 0.26;
    c.strokeStyle = S.pal.fg; c.lineWidth = S.lw;
    const prev = S.head || '…', next = S.tail || '…';
    S.say(c, '◀', x + small * 1.0, by + small * 1.4, small * 0.8, {});
    S.say(c, prev, x + small * 1.8, by + small * 1.4, small, { align: 'left' });
    S.say(c, '▶', x + ww - small * 1.0, by + small * 1.4, small * 0.8, {});
    S.say(c, next, x + ww - small * 1.8, by + small * 1.4, small, { align: 'right' });
    c.restore();
  });

  // ---- 丸・図形 ----
  // 丸：線で描かれる丸と、回る目盛り。中に行
  add('shape', 'circle', '目盛りの丸', (c, S) => {
    const R = S.U * 0.4;
    const px = S.fit(R * 1.75, S.U * 0.12);
    c.strokeStyle = S.pal.fg; c.lineWidth = S.lw;
    dashOn(c, TAU * R, S.in(0, 0.6));
    c.beginPath(); c.arc(S.cx, S.cy, R, -Math.PI / 2, Math.PI * 1.5); c.stroke();
    c.setLineDash([]);
    const rot = S.T * 0.4;
    for (let k = 0; k < 60; k++) {
      const a = rot + k * TAU / 60, l = k % 5 ? 0.04 : 0.09;
      if (k / 60 > S.in(0.2, 0.6)) break;
      c.lineWidth = k % 5 ? S.lw * 0.5 : S.lw;
      seg(c, S.cx + Math.cos(a) * R * 0.95, S.cy + Math.sin(a) * R * 0.95, S.cx + Math.cos(a) * R * (0.95 - l), S.cy + Math.sin(a) * R * (0.95 - l));
    }
    S.line(c, S.cx, S.cy, px, { each: g => ({ alpha: S.typeA(g.i, 0.4, 0.04) }) });
  });

  // 輪の文字：外の輪に行が回り、真ん中に強調語
  add('shape', 'ring-text', '回る輪の文字', (c, S) => {
    const R = S.U * 0.38;
    const q = S.in(0, 0.6);
    const word = S.emph || S.text;
    c.strokeStyle = S.pal.fg; c.lineWidth = S.lw;
    c.beginPath(); c.arc(S.cx, S.cy, R * 1.12, 0, TAU); c.stroke();
    c.beginPath(); c.arc(S.cx, S.cy, R * 0.82, 0, TAU); c.stroke();
    const unit = [...S.chars, '・'];
    const px = R * 0.2;
    const n = Math.floor(TAU * R * 0.97 / (px * 1.05));
    for (let k = 0; k < n * q; k++) {
      const a = -S.T * 0.5 + k * TAU / n;
      const u = unit[k % unit.length], i = k % unit.length;
      c.save(); c.translate(S.cx + Math.cos(a) * R * 0.97, S.cy + Math.sin(a) * R * 0.97); c.rotate(a + Math.PI / 2);
      S.say(c, u, 0, 0, px, { color: S.isE(i) ? S.pal.accent : S.pal.fg, heavy: S.isE(i) });
      c.restore();
    }
    const big = S.fitStr(word, R * 1.4, R * 0.6, true);
    c.save(); c.translate(S.cx, S.cy); const s = back(S.inRaw(0.3, 0.5)); c.scale(s, s);
    S.say(c, word, 0, 0, big, { heavy: true, color: S.pal.accent }); c.restore();
  });

  // 蜂の巣：六角形の升目に 1 文字ずつ、ぽんぽんと開く
  add('shape', 'hex', '六角形の升目', (c, S) => {
    const list = S.cells({ gap: 0.02, max: S.U * 0.2 });
    for (const g of list) {
      if (g.space) continue;
      const q = back(cl((S.T - 0.15 - g.i * 0.06) / 0.35));
      if (q <= 0) continue;
      const r = g.s * 0.56 * q, y = g.y + (g.col % 2 ? g.s * 0.28 : -g.s * 0.28) * 0.6;
      c.strokeStyle = g.e ? S.pal.accent : S.pal.fg; c.lineWidth = S.lw;
      poly(c, Array.from({ length: 6 }, (_, k) => [g.x + Math.cos(k * TAU / 6) * r, y + Math.sin(k * TAU / 6) * r]));
      c.stroke();
      S.say(c, g.ch, g.x, y, g.s * 0.5 * q, { heavy: g.e, color: g.e ? S.pal.accent : S.pal.fg });
    }
  });

  // カプセル：丸長の殻が左右に割れて開き、中の行が出る
  add('shape', 'capsule', '割れるカプセル', (c, S) => {
    const { px, w, h } = plate(S, 0.6, 0.12, 0.6, 2.0);
    const open = ease((S.T - 0.35) / 0.5);
    const gap = (w / 2 + h * 0.2) * open;
    c.strokeStyle = S.pal.fg; c.lineWidth = S.lw;
    for (const side of [-1, 1]) {
      const cx = S.cx + side * gap;
      c.beginPath();
      if (side < 0) { c.moveTo(cx, S.cy - h / 2); c.lineTo(cx - w / 2 + h / 2, S.cy - h / 2); c.arc(cx - w / 2 + h / 2, S.cy, h / 2, -Math.PI / 2, Math.PI / 2, true); c.lineTo(cx, S.cy + h / 2); }
      else { c.moveTo(cx, S.cy - h / 2); c.lineTo(cx + w / 2 - h / 2, S.cy - h / 2); c.arc(cx + w / 2 - h / 2, S.cy, h / 2, -Math.PI / 2, Math.PI / 2); c.lineTo(cx, S.cy + h / 2); }
      c.stroke();
      c.lineWidth = S.lw * 0.5; seg(c, cx, S.cy - h / 2, cx, S.cy + h / 2); c.lineWidth = S.lw;
    }
    if (open < 0.05) { c.beginPath(); c.arc(S.cx, S.cy, h * 0.12, 0, TAU); c.stroke(); }
    c.save(); c.beginPath(); c.rect(S.cx - gap, 0, gap * 2, S.H); c.clip(); S.line(c, S.cx, S.cy, px); c.restore();
  });

  // 三角：入れ子の三角がゆっくり回って正位置に止まる。下の辺の上に行
  add('shape', 'triangle', '入れ子の三角', (c, S) => {
    const R = S.U * 0.44;
    const px = S.fit(R * 1.05, S.U * 0.1);
    for (let k = 0; k < 3; k++) {
      const q = ease((S.T - 0.1 - k * 0.12) / 0.7);
      const r = R * (1 - k * 0.12), a0 = -Math.PI / 2 + (1 - q) * (k % 2 ? -1 : 1) * 1.6;
      c.globalAlpha = q * S.vis;
      c.strokeStyle = k === 1 ? S.pal.accent : S.pal.fg; c.lineWidth = S.lw * (k === 0 ? 1.2 : 0.7);
      poly(c, Array.from({ length: 3 }, (_, j) => [S.cx + Math.cos(a0 + j * TAU / 3) * r, S.cy + R * 0.2 + Math.sin(a0 + j * TAU / 3) * r]));
      c.stroke();
    }
    c.globalAlpha = S.vis;
    S.line(c, S.cx, S.cy + R * 0.38, px, { each: g => ({ alpha: S.typeA(g.i, 0.5, 0.04) }) });
  }, { ownExit: false });

  // 照準：大きな輪と十字が縮んで行に合い、角の括弧が止まる
  add('shape', 'target', '合わさる照準', (c, S) => {
    const px = S.fit(S.W * 0.62, S.U * 0.11);
    const lay = S.layout(px);
    const lock = ease((S.T - 0.1) / 0.6);
    const hw = lay.width / 2 + px * 0.5, hh = px * 0.95;
    const R = lerp(S.U * 0.9, hw * 1.08, lock);
    c.strokeStyle = S.pal.fg; c.lineWidth = S.lw * 0.7;
    c.beginPath(); c.arc(S.cx, S.cy, R, 0, TAU); c.stroke();
    c.setLineDash([S.lw * 2, S.lw * 3]); c.beginPath(); c.arc(S.cx, S.cy, R * 0.9, S.T, S.T + TAU); c.stroke(); c.setLineDash([]);
    seg(c, S.cx - R * 1.15, S.cy, S.cx - hw - px * 0.3, S.cy); seg(c, S.cx + hw + px * 0.3, S.cy, S.cx + R * 1.15, S.cy);
    seg(c, S.cx, S.cy - R * 1.15, S.cx, S.cy - hh - px * 0.4); seg(c, S.cx, S.cy + hh + px * 0.4, S.cx, S.cy + R * 1.15);
    const ex = lerp(S.W * 0.48, hw, lock), ey = lerp(S.H * 0.48, hh, lock), k = px * 0.4;
    c.strokeStyle = S.pal.accent; c.lineWidth = S.lw * 1.4;
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) poly(c, [[S.cx + sx * ex, S.cy + sy * (ey - k)], [S.cx + sx * ex, S.cy + sy * ey], [S.cx + sx * (ex - k), S.cy + sy * ey]], false), c.stroke();
    S.line(c, S.cx, S.cy, px, { alpha: cl((S.T - 0.6) / 0.15) });
  });

  // 重なる二つの丸：左に行の前、右に後ろ、重なりに強調語
  add('shape', 'venn', '重なる二つの丸', (c, S) => {
    const R = S.U * 0.34;
    const q = back(S.inRaw(0, 0.6));
    const off = lerp(S.W * 0.5, R * 0.62, q);
    c.strokeStyle = S.pal.fg; c.lineWidth = S.lw;
    for (const side of [-1, 1]) { c.beginPath(); c.arc(S.cx + side * off, S.cy, R, 0, TAU); c.stroke(); }
    const a = S.head || S.chars.slice(0, Math.ceil(S.chars.length / 2)).join('');
    const b = S.tail || (S.head ? '' : S.chars.slice(Math.ceil(S.chars.length / 2)).join(''));
    const word = S.emph || '';
    const sm = Math.min(S.fitStr(a || '・', R * 0.9, R * 0.3), S.fitStr(b || '・', R * 0.9, R * 0.3));
    S.say(c, a, S.cx - off - R * 0.3, S.cy, sm);
    S.say(c, b, S.cx + off + R * 0.3, S.cy, sm);
    if (word) {
      c.save(); c.beginPath(); c.arc(S.cx - off, S.cy, R, 0, TAU); c.clip();
      c.beginPath(); c.arc(S.cx + off, S.cy, R, 0, TAU); c.clip();
      c.globalAlpha *= 0.18; c.strokeStyle = S.pal.accent; c.lineWidth = S.lw * 0.6;
      for (let u = -R * 2; u < R * 2; u += S.lw * 4) seg(c, S.cx + u, S.cy - R, S.cx + u + R, S.cy + R);
      c.restore();
      S.say(c, word, S.cx, S.cy, S.fitStr(word, R * 0.75, R * 0.5, true), { heavy: true, color: S.pal.accent, outline: true });
    }
  });

  // ぎざぎざの星：線だけの星形が拍でふくらみ、ゆっくり回る
  add('shape', 'burst', 'ぎざぎざの星', (c, S) => {
    const px = S.fit(S.W * 0.56, S.U * 0.12);
    const lay = S.layout(px);
    const Rx = lay.width / 2 + px * 1.1, Ry = Math.max(px * 1.9, Rx * (S.H / S.W) * 0.9);
    const q = back(S.inRaw(0, 0.45)), pulse = 1 + S.beatQ * 0.05;
    const n = 26;
    c.strokeStyle = S.pal.fg; c.lineWidth = S.lw;
    for (const [k, col] of [[1, S.pal.fg], [0.86, S.pal.accent]]) {
      poly(c, Array.from({ length: n * 2 }, (_, j) => {
        const a = j * Math.PI / n + S.T * 0.15 * (k === 1 ? 1 : -1), r = (j % 2 ? 0.78 : 1) * k * q * pulse;
        return [S.cx + Math.cos(a) * Rx * r, S.cy + Math.sin(a) * Ry * r];
      }));
      c.strokeStyle = col; c.stroke();
    }
    S.line(c, S.cx, S.cy, px);
  });
}
