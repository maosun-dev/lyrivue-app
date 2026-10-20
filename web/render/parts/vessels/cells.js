// 1 文字ずつ器に入れるもの（キー・タイル・升目・判子・さいころ・駒・反転表示・小窓）
import { TAU, cl, ease, back, rr, seg, poly, hash } from './tools.js';

export default function cells(add) {
  // キーボードのキー：打ち込む順にキーが沈み、そのとき字が出る。拍でときどき別のキーも沈む
  add('cell', 'keycap', 'キーボードのキー', (c, S) => {
    const list = S.cells({ gap: 0.14, max: S.U * 0.2 });
    for (const g of list) {
      if (g.space) continue;
      const { x, y, s } = g;
      const at = 0.25 + g.i * 0.08;
      const press = cl(1 - Math.abs(S.T - at - 0.05) / 0.09) + (S.beatN % list.length === g.i && S.T > 1.2 ? S.beatQ * 0.8 : 0);
      const a = cl((S.T - 0.05 - g.i * 0.03) / 0.2);
      c.globalAlpha = a * S.vis;
      c.lineWidth = S.lw;
      c.strokeStyle = g.e ? S.pal.accent : S.pal.fg;
      rr(c, x - s / 2, y - s / 2, s, s, s * 0.16); c.stroke();
      const lift = s * 0.07 * (1 - press), inset = s * 0.11;
      rr(c, x - s / 2 + inset, y - s / 2 + inset * 0.6 - lift, s - inset * 2, s - inset * 2, s * 0.1);
      c.fillStyle = S.pal.bg; c.fill(); c.stroke();
      // 角を結ぶ短い線で、上の面と側面の境目を見せる
      for (const [kx, ky] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) seg(c, x + kx * s / 2 * 0.86, y + ky * s / 2 * 0.86, x + kx * (s / 2 - inset) * 0.95, y + ky * (s / 2 - inset) * 0.9 - lift);
      if (S.T > at) S.say(c, g.ch, x, y - lift + inset * 0.1, s * 0.5, { heavy: g.e, color: g.e ? S.pal.accent : S.pal.fg });
    }
  }, { ownExit: true });

  // 裏返るタイル：1 文字ずつ横の軸で裏返って表が出る。裏は斜線
  add('cell', 'flip-tile', '裏返るタイル', (c, S) => {
    for (const g of S.cells({ gap: 0.12 })) {
      if (g.space) continue;
      const q = ease((S.T - 0.2 - g.i * 0.07) / 0.45) - S.out(g.i * 0.03, 0.4);
      const ang = Math.PI * (1 - q);
      const k = Math.cos(ang);
      c.save();
      c.translate(g.x, g.y);
      c.scale(1, Math.abs(k) < 0.02 ? 0.02 : Math.abs(k));
      c.lineWidth = S.lw / Math.max(0.3, Math.abs(k));
      c.strokeStyle = g.e ? S.pal.accent : S.pal.fg;
      rr(c, -g.s / 2, -g.s / 2, g.s, g.s, g.s * 0.06); c.stroke();
      if (k < 0) {
        c.save(); rr(c, -g.s / 2, -g.s / 2, g.s, g.s, g.s * 0.06); c.clip();
        c.lineWidth = S.lw;
        for (let u = -g.s; u < g.s; u += g.s / 6) seg(c, u, -g.s / 2, u + g.s, g.s / 2);
        c.restore();
      } else S.say(c, g.ch, 0, 0, g.s * 0.6, { heavy: g.e, color: g.e ? S.pal.accent : S.pal.fg });
      c.restore();
    }
  }, { ownExit: true });

  // 原稿用紙：つながった升目に 1 文字ずつ書かれていく。外は二重の枠
  add('cell', 'genkou', '原稿用紙の升目', (c, S) => {
    const list = S.cells({ gap: 0, max: S.U * 0.17 });
    if (!list.length) return;
    const s = list[0].s;
    const xs = list.map(g => g.x), ys = list.map(g => g.y);
    const L = Math.min(...xs) - s / 2, R = Math.max(...xs) + s / 2, Tp = Math.min(...ys) - s / 2, B = Math.max(...ys) + s / 2;
    const q = S.in(0, 0.6);
    c.globalAlpha = S.vis;
    c.strokeStyle = S.pal.band; c.lineWidth = S.lw;
    c.strokeRect(L - s * 0.12, Tp - s * 0.12, (R - L + s * 0.24) * q, B - Tp + s * 0.24);
    c.strokeRect(L, Tp, (R - L) * q, B - Tp);
    c.lineWidth = S.lw * 0.6;
    for (const g of list) {
      if (g.x - s / 2 > L + (R - L) * q) continue;
      c.strokeRect(g.x - s / 2, g.y - s / 2, s, s);
      // 書いていく：左から右へ字が現れる
      const w = cl((S.T - 0.5 - g.i * 0.09) / 0.16);
      if (w <= 0 || g.space) continue;
      c.save(); c.beginPath(); c.rect(g.x - s / 2, g.y - s / 2, s * w, s); c.clip();
      S.say(c, g.ch, g.x, g.y, s * 0.68, { heavy: g.e, color: g.e ? S.pal.accent : S.pal.fg });
      c.restore();
    }
  });

  // 判子：丸い二重の枠に 1 文字ずつ、上から押しつける（少し傾いて止まる）
  add('cell', 'hanko', '1文字ずつの判子', (c, S) => {
    for (const g of S.cells({ gap: 0.1 })) {
      if (g.space) continue;
      const t = (S.T - 0.2 - g.i * 0.1) / 0.22;
      if (t < 0) continue;
      const sc = t < 1 ? 1.9 - 0.9 * ease(t) : 1 + 0.06 * Math.max(0, 1 - (t - 1) * 4);
      const col = g.e ? S.pal.accent : S.pal.fg;
      c.save();
      c.globalAlpha = cl(t * 2) * S.vis;
      c.translate(g.x, g.y); c.rotate((hash(g.i, 3) - 0.5) * 0.35); c.scale(sc, sc);
      c.strokeStyle = col; c.lineWidth = S.lw * 1.3;
      c.beginPath(); c.arc(0, 0, g.s * 0.48, 0, TAU); c.stroke();
      c.lineWidth = S.lw * 0.6;
      c.beginPath(); c.arc(0, 0, g.s * 0.4, 0, TAU); c.stroke();
      S.say(c, g.ch, 0, 0, g.s * 0.5, { heavy: true, color: col });
      c.restore();
    }
  });

  // さいころ：前の面に字のある立方体が上から転がって落ち、奥行きの向きがゆっくり揺れる
  add('cell', 'dice', '転がるさいころ', (c, S) => {
    const list = S.cells({ gap: 0.34, max: S.U * 0.17 });
    const sw = Math.sin(S.T * 0.9);
    for (const g of list) {
      if (g.space) continue;
      const t = (S.T - 0.15 - g.i * 0.07) / 0.5;
      if (t < 0) continue;
      const s = g.s, d = s * 0.3;
      const dx = d * sw, dy = -d * 0.75;
      const y = g.y - (1 - back(t)) * s * 2.2;
      const rot = (1 - ease(t)) * (g.i % 2 ? 1 : -1) * 1.4;
      c.save();
      c.globalAlpha = cl(t * 3) * S.vis;
      c.translate(g.x, y); c.rotate(rot);
      c.strokeStyle = g.e ? S.pal.accent : S.pal.fg; c.lineWidth = S.lw;
      const h = s / 2;
      // 奥の面の線（上と横）
      poly(c, [[-h, -h], [-h + dx, -h + dy], [h + dx, -h + dy], [h, -h]]); c.fillStyle = S.pal.bg; c.fill(); c.stroke();
      poly(c, dx > 0 ? [[h, -h], [h + dx, -h + dy], [h + dx, h + dy], [h, h]] : [[-h, -h], [-h + dx, -h + dy], [-h + dx, h + dy], [-h, h]]); c.fill(); c.stroke();
      c.beginPath(); c.rect(-h, -h, s, s); c.fill(); c.stroke();
      S.say(c, g.ch, 0, 0, s * 0.62, { heavy: g.e, color: g.e ? S.pal.accent : S.pal.fg });
      c.restore();
    }
  });

  // 文字の駒：右下に「何文字目か」の小さな数のある駒が下から並んでいき、傾きが戻る
  add('cell', 'tiles', '数字つきの駒', (c, S) => {
    const list = S.cells({ gap: 0.1 });
    const order = new Map(list.filter(g => !g.space).map((g, k) => [g.i, k + 1]));
    for (const g of list) {
      if (g.space) continue;
      const t = ease((S.T - 0.15 - g.i * 0.06) / 0.4);
      if (t <= 0) continue;
      const col = g.e ? S.pal.accent : S.pal.fg;
      c.save();
      c.globalAlpha = t * S.vis;
      c.translate(g.x, g.y + (1 - t) * g.s * 1.5);
      c.rotate((1 - t) * (hash(g.i, 9) - 0.5) * 1.2 + (hash(g.i, 2) - 0.5) * 0.08);
      c.strokeStyle = col; c.lineWidth = S.lw;
      rr(c, -g.s / 2, -g.s / 2, g.s, g.s, g.s * 0.1); c.stroke();
      seg(c, -g.s * 0.42, g.s * 0.5 + S.lw * 2, g.s * 0.42, g.s * 0.5 + S.lw * 2);
      S.say(c, g.ch, -g.s * 0.04, -g.s * 0.04, g.s * 0.56, { heavy: g.e, color: col });
      S.say(c, String(order.get(g.i)), g.s * 0.32, g.s * 0.3, g.s * 0.2, { color: col });
      c.restore();
    }
  });

  // 反転表示（パタパタ）：上下に割れた板が何回かめくれて、行の字に止まる
  add('cell', 'flap', 'めくれる反転表示', (c, S) => {
    const list = S.cells({ gap: 0.1, aspect: 0.78 });
    const pool = S.chars.filter(ch => ch.trim());
    for (const g of list) {
      if (g.space) continue;
      const w = g.sw, h = g.s;
      const stop = 0.4 + g.i * 0.07 + 0.35;
      const step = 0.06;
      const n = Math.max(0, Math.floor((stop - S.T) / step));
      const ch = S.T >= stop ? g.ch : pool[(g.i * 7 + n * 3) % pool.length];
      const p = S.T >= stop ? 1 : ((stop - S.T) / step) % 1;
      c.save();
      c.globalAlpha = cl((S.T - 0.1) / 0.3) * S.vis;
      c.translate(g.x, g.y);
      c.strokeStyle = g.e ? S.pal.accent : S.pal.fg; c.lineWidth = S.lw;
      rr(c, -w / 2, -h / 2, w, h, w * 0.08); c.stroke();
      S.say(c, ch, 0, 0, h * 0.62, { heavy: g.e, color: g.e ? S.pal.accent : S.pal.fg });
      // めくれ途中の上半分：真ん中の線を軸に縮む板
      if (p < 1) {
        c.save(); c.scale(1, Math.max(0.02, 1 - 2 * Math.abs(p - 0.5)));
        rr(c, -w / 2, -h / 2, w, h / 2, w * 0.08); c.fillStyle = S.pal.bg; c.fill(); c.stroke();
        c.restore();
      }
      c.strokeStyle = S.pal.bg; c.lineWidth = S.lw * 1.6; seg(c, -w / 2, 0, w / 2, 0);
      c.strokeStyle = g.e ? S.pal.accent : S.pal.fg; c.lineWidth = S.lw * 0.6; seg(c, -w / 2, 0, w / 2, 0);
      c.restore();
    }
  });

  // 小窓の扉：1 文字ずつ、ちょうつがいのある扉が開いて中の字が見える
  add('cell', 'doors', '開く小窓', (c, S) => {
    for (const g of S.cells({ gap: 0.16 })) {
      if (g.space) continue;
      const col = g.e ? S.pal.accent : S.pal.fg;
      const q = ease((S.T - 0.3 - g.i * 0.09) / 0.45);
      c.save();
      c.globalAlpha = cl((S.T - 0.05) / 0.25) * S.vis;
      c.translate(g.x, g.y);
      c.strokeStyle = col; c.lineWidth = S.lw;
      c.strokeRect(-g.s / 2, -g.s / 2, g.s, g.s);
      if (q > 0.15) S.say(c, g.ch, 0, 0, g.s * 0.6, { heavy: g.e, color: col });
      // 扉：左の辺を軸に開く（幅が cos で縮み、少しゆがむ）
      const k = Math.cos(q * Math.PI * 0.62); // 開ききっても隣の升目を隠さない角度で止める
      const dw = g.s * k;
      poly(c, [[-g.s / 2, -g.s / 2], [-g.s / 2 + dw, -g.s / 2 - g.s * 0.12 * (1 - Math.abs(k)) * Math.sign(k)], [-g.s / 2 + dw, g.s / 2 + g.s * 0.12 * (1 - Math.abs(k)) * Math.sign(k)], [-g.s / 2, g.s / 2]]);
      c.fillStyle = S.pal.bg; c.fill(); c.stroke();
      if (Math.abs(dw) > g.s * 0.2) { c.beginPath(); c.arc(-g.s / 2 + dw * 0.82, 0, g.s * 0.04, 0, TAU); c.stroke(); }
      c.restore();
    }
  });
}
