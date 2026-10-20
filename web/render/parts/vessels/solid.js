// 立体の器：厚み・側面が見え、カメラが回り込む（JIZURA に無い、空間を使う器）。
// S.cam(yaw, pitch, dist) が立体の点を画面へ映す。単位は 1 ≒ 画面の短い辺の 3 割。面の上の文字は S.onPlane（1 単位 = 100）。
import { TAU, cl, ease, back, lerp, poly, seg } from './tools.js';

const depth = (P, p) => P(...p).z;
// 箱を何個か、遠い順に描く（箱どうしは中心の奥行きで並べる）
function drawBoxes(c, S, P, boxes) {
  boxes.map(b => ({ b, z: depth(P, b.at) })).sort((u, v) => u.z - v.z).forEach(({ b }) => {
    c.save(); c.globalAlpha *= b.alpha ?? 1;
    S.drawBox(c, P, S.boxFaces(...b.at, ...b.size), { onFace: b.onFace, onFace3: b.onFace3, stroke: b.stroke, lw: b.lw });
    c.restore();
  });
}
// 横長の画面ほど板を広げる
const wide = S => Math.min(1.6, Math.max(1, S.W / S.H));
// 行の部分：前・強調語・後ろ（空は飛ばす）。強調語の無い行は半分に割る
function parts(S) {
  const p = [[S.chars.slice(0, S.es).join('').trim(), false], [S.emph, true], [S.chars.slice(S.es + S.el).join('').trim(), false]].filter(([s]) => s);
  if (p.length > 1) return p;
  const h = Math.ceil(S.chars.length / 2);
  return [[S.chars.slice(0, h).join('').trim(), false], [S.chars.slice(h).join('').trim(), true]].filter(([s]) => s);
}

export default function solid(add) {
  // 厚い板：側面の見える板が回り込みながら現れ、カメラがゆっくり左右に回る
  add('solid', 'slab', '厚みのある板', (c, S) => {
    const a = 1.2 * wide(S), b = 0.42, d = 0.22;
    const yaw = -1.5 * (1 - back(S.inRaw(0, 0.9))) + Math.sin(S.T * 0.7) * 0.65;
    const P = S.cam(yaw, -0.32 + Math.sin(S.T * 0.5) * 0.14);
    const px = S.fit(a * 170, 46);
    c.lineWidth = S.lw;
    S.drawBox(c, P, S.boxFaces(0, 0, 0, a, b, d), {
      onFace3: f => { if (f.name === 'front') S.line3(c, P, f.o, f.ux, f.uy, px, { each: g => ({ alpha: S.typeA(g.i, 0.5, 0.04) }) }); },
      onFace: (f, cc) => {
        if (f.name === 'top' || f.name === 'bottom' || f.name === 'right' || f.name === 'left') { cc.strokeStyle = S.pal.fg; cc.lineWidth = 0.8; for (let u = -f.w * 50 + 6; u < f.w * 50; u += 8) seg(cc, u, -f.h * 40, u, f.h * 40); }
      },
    });
  });

  // 回る立方体：拍ごとに 90 度回り、面ごとに行の前・強調語・後ろが出る
  add('solid', 'cube', '面ごとに回る立方体', (c, S) => {
    const list = parts(S);
    const s = 0.6;
    const span = (S.OUT - 0.5) / list.length;
    const stepF = Math.min(list.length - 1, Math.max(0, (S.T - 0.3) / span));
    const k = Math.floor(stepF), turn = k + ease((stepF - k - 0.6) / 0.4);
    // yaw が増えると右の面が正面へ来る（前・右・後ろ・左の順に部分を書く）
    const P = S.cam(turn * Math.PI / 2 + Math.sin(S.T * 0.6) * 0.25 - 0.35 * (1 - S.in(0, 0.8)), -0.3);
    const names = ['front', 'right', 'back', 'left'];
    S.drawBox(c, P, S.boxFaces(0, 0, 0, s, s, s), {
      onFace: (f, cc) => {
        const n = names.indexOf(f.name);
        if (n < 0 || !list[n]) return;
        const [str, e] = list[n];
        S.say(cc, str, 0, 0, S.fitStr(str, s * 170, 70, e), { heavy: e, color: e ? S.pal.accent : S.pal.fg });
      },
    });
  });

  // 三角柱：横の軸で回る三角柱。面ごとに行の部分が出る
  add('solid', 'prism', '回る三角柱', (c, S) => {
    const list = parts(S);
    const L = 1.05 * wide(S), r = 0.5;
    const span = (S.OUT - 0.5) / list.length;
    const stepF = Math.min(list.length - 1, Math.max(0, (S.T - 0.3) / span));
    const k = Math.floor(stepF), turn = k + ease((stepF - k - 0.55) / 0.45);
    const phi = -turn * TAU / 3 + (1 - S.in(0, 0.8)) * 1.2;
    const P = S.cam(Math.sin(S.T * 0.6) * 0.35, -0.15);
    const tri = [0, 1, 2].map(j => { const a = phi + j * TAU / 3 + Math.PI / 2 + Math.PI / 3; return [r * Math.cos(a), r * Math.sin(a)]; });
    // 面：辺 j と j+1 の間。外向きになるよう角の順を合わせる
    for (let j = 0; j < 3; j++) {
      let v1 = tri[j], v2 = tri[(j + 1) % 3];
      const A = [-L, v1[1], v1[0]], B = [L, v1[1], v1[0]], D = [-L, v2[1], v2[0]];
      // 外向き＝(B-A)×(D-A) が軸から離れる向き
      const nY = -(2 * L) * (v2[0] - v1[0]), nZ = (2 * L) * (v2[1] - v1[1]);
      const mid = [(v1[1] + v2[1]) / 2, (v1[0] + v2[0]) / 2];
      if (nY * mid[0] + nZ * mid[1] < 0) [v1, v2] = [v2, v1];
      const pts = [[-L, v1[1], v1[0]], [L, v1[1], v1[0]], [L, v2[1], v2[0]], [-L, v2[1], v2[0]]];
      if (!S.facing(P, pts[0], pts[1], pts[3])) continue;
      S.poly3(c, P, pts); c.fillStyle = S.pal.bg; c.fill(); c.strokeStyle = S.pal.fg; c.lineWidth = S.lw; c.stroke();
      const o = [0, (v1[1] + v2[1]) / 2, (v1[0] + v2[0]) / 2];
      const uy = [0, v2[1] - v1[1], v2[0] - v1[0]], ul = Math.hypot(uy[1], uy[2]);
      const part = list[(j + 2) % 3]; // 最初に正面を向くのは面 1。そこから 2・0 の順に回ってくる
      if (!part) continue;
      S.onPlane(c, P, o, [1, 0, 0], [0, uy[1] / ul, uy[2] / ul], cc => S.say(cc, part[0], 0, 0, S.fitStr(part[0], L * 180, ul * 62, part[1]), { heavy: part[1], color: part[1] ? S.pal.accent : S.pal.fg }));
    }
    // 端の三角
    for (const x of [-L, L]) { S.poly3(c, P, tri.map(([z, y]) => [x, y, z])); c.stroke(); }
  });

  // 立体のキー：上から見下ろした立体のキーが並び、打ち込む順に沈む
  add('solid', 'keys3d', '立体のキーボード', (c, S) => {
    const N = S.chars.length, rows = N > 9 ? 2 : 1, per = Math.ceil(N / rows);
    const pitchK = Math.min(0.56, 2.5 * wide(S) / per);
    const ks = pitchK * 0.42;
    const P = S.cam(Math.sin(S.T * 0.5) * 0.45, -0.7 + Math.sin(S.T * 0.4) * 0.1, 2.9);
    const boxes = [];
    // 台
    boxes.push({ at: [0, ks * 0.9, 0], size: [per * pitchK / 2 + ks * 0.5, ks * 0.25, rows * pitchK / 2 + ks * 0.4] });
    S.chars.forEach((ch, i) => {
      if (!ch.trim()) return;
      const r = Math.floor(i / per), col = i % per;
      const at = 0.25 + i * 0.08;
      const press = cl(1 - Math.abs(S.T - at - 0.05) / 0.1);
      const x = (col - (per - 1) / 2) * pitchK, z = (r - (rows - 1) / 2) * pitchK;
      const e = S.isE(i);
      boxes.push({
        at: [x, ks * 0.25 + press * ks * 0.3, z], size: [ks, ks * 0.4, ks], stroke: e ? S.pal.accent : S.pal.fg,
        onFace: (f, cc) => { if (f.name === 'top' && S.T > at) S.say(cc, ch, 0, 0, ks * 120, { heavy: e, color: e ? S.pal.accent : S.pal.fg }); },
      });
    });
    c.lineWidth = S.lw;
    drawBoxes(c, S, P, boxes);
  });

  // 階段：右へ上がる段の、段の前の面に 1 文字ずつ。段が下からせり上がる
  add('solid', 'stairs', '文字の階段', (c, S) => {
    const N = S.chars.length;
    const w = Math.min(0.42, 2.3 * wide(S) / N), rise = Math.min(0.16, 1.4 / N);
    const P = S.cam(-0.55 + Math.sin(S.T * 0.5) * 0.3, -0.3, 3.6);
    const boxes = [];
    S.chars.forEach((ch, i) => {
      const q = back(cl((S.T - 0.1 - i * 0.06) / 0.4));
      if (q <= 0) return;
      const h = (i + 1) * rise * q + 0.04;
      const x = (i - (N - 1) / 2) * w, y = 0.7 - h / 2 - (N * rise) / 2 + 0.2;
      const e = S.isE(i);
      boxes.push({
        at: [x, y, 0], size: [w / 2, h / 2, w * 0.7], stroke: e ? S.pal.accent : S.pal.fg,
        onFace: (f, cc) => { if (f.name === 'front' && ch.trim()) S.say(cc, ch, 0, -Math.max(0, f.h * 50 - w * 45), w * 78, { heavy: e, color: e ? S.pal.accent : S.pal.fg }); },
      });
    });
    c.lineWidth = S.lw;
    drawBoxes(c, S, P, boxes);
  });

  // 枠のトンネル：奥へ連なる四角い枠の中をカメラが進み、いちばん手前の枠に行
  add('solid', 'tunnel', '奥へ連なる枠', (c, S) => {
    const a = 1.2 * wide(S), b = 0.62;
    const go = 1.6 * (1 - ease((S.T - 0.05) / 1.1));
    const P = S.cam(Math.sin(S.T * 0.6) * 0.25, Math.sin(S.T * 0.45) * 0.12, 3.2 - go * 0.2);
    c.lineWidth = S.lw;
    for (let k = 9; k >= 0; k--) {
      const z = -k * 0.55 - go;
      if (z > 1.6) continue;
      const roll = k * 0.06 * Math.sin(S.T * 0.8);
      const pts = [[-a, -b], [a, -b], [a, b], [-a, b]].map(([x, y]) => [x * Math.cos(roll) - y * Math.sin(roll), x * Math.sin(roll) + y * Math.cos(roll), z]);
      c.globalAlpha = S.vis * (k === 0 ? 1 : Math.max(0.15, 1 - k * 0.09));
      c.strokeStyle = k % 3 === 2 ? S.pal.accent : S.pal.fg;
      S.poly3(c, P, pts); c.stroke();
      if (k === 0) {
        S.line3(c, P, [0, 0, z], [1, 0, 0], [0, 1, 0], S.fit(a * 170, 40));
      } else {
        // 角どうしを結ぶ線（通路の稜線）
        const nz = z + 0.55;
        for (const p of pts) { const q = [p[0], p[1], nz]; const A = P(...p), B = P(...q); seg(c, A.x, A.y, B.x, B.y); }
      }
    }
    c.globalAlpha = S.vis;
  });

  // 円柱：縦の軸の円柱に行が巻きつき、回って正面で止まる。裏側の字は薄く
  add('solid', 'drum', '巻きつく円柱', (c, S) => {
    const px = 30;
    const lay = S.layout(px);
    const r = Math.max(0.6, lay.width / 100 / 2.4), h = 0.5;
    const rot = (1 - ease((S.T - 0.05) / 1.2)) * Math.PI * 1.6 + Math.sin(S.T * 0.8) * 0.25;
    const P = S.cam(0, -0.28, 3.4 + r * 0.6);
    c.lineWidth = S.lw; c.strokeStyle = S.pal.fg;
    for (const y of [-h, h]) { S.poly3(c, P, Array.from({ length: 64 }, (_, k) => [r * Math.sin(k * TAU / 64), y, r * Math.cos(k * TAU / 64)])); c.stroke(); }
    const sil = [-1, 1].map(s => [s * r, 0, 0]);
    for (const [x] of sil) { const A = P(x, -h, 0), B = P(x, h, 0); seg(c, A.x, A.y, B.x, B.y); }
    const draw = front => lay.glyphs.forEach(g => {
      if (!g.ch.trim()) return;
      const th = (g.x + g.w / 2 - lay.width / 2) / 100 / r + rot;
      const vis = Math.cos(th) > 0;
      if (vis !== front) return;
      c.save(); c.globalAlpha *= front ? 1 : 0.22;
      S.onPlane(c, P, [r * Math.sin(th), 0, r * Math.cos(th)], [Math.cos(th), 0, -Math.sin(th)], [0, 1, 0], cc => S.say(cc, g.ch, 0, 0, g.px, { heavy: g.e, color: g.e ? S.pal.accent : S.pal.fg }));
      c.restore();
    });
    draw(false); draw(true);
  });

  // 開く箱：ふたが後ろへ開き、中から行のカードがせり上がる
  add('solid', 'box', 'ふたが開く箱', (c, S) => {
    const a = 0.95 * wide(S), b = 0.3, d = 0.45;
    const P = S.cam(Math.sin(S.T * 0.55) * 0.5 - 0.25, -0.5, 3.6);
    const open = ease((S.T - 0.2) / 0.5), rise = back(cl((S.T - 0.55) / 0.6));
    const by = 0.45;
    const faces = S.boxFaces(0, by, 0, a, b, d).filter(f => f.name !== 'top');
    const items = faces.map(f => ({ z: depth(P, f.o), draw: () => { S.poly3(c, P, f.pts); c.fillStyle = S.pal.bg; c.fill(); c.strokeStyle = S.pal.fg; c.lineWidth = S.lw; c.stroke(); } }));
    // カード
    const ch = 0.5, cy = by - b + ch / 2 - rise * (ch + 0.25);
    items.push({ z: depth(P, [0, 0, 0]), draw: () => {
      const pts = [[-a * 0.88, cy - ch / 2, 0], [a * 0.88, cy - ch / 2, 0], [a * 0.88, cy + ch / 2, 0], [-a * 0.88, cy + ch / 2, 0]];
      S.poly3(c, P, pts); c.fillStyle = S.pal.bg; c.fill(); c.strokeStyle = S.pal.fg; c.lineWidth = S.lw; c.stroke();
      S.line3(c, P, [0, cy, 0], [1, 0, 0], [0, 1, 0], S.fit(a * 165, 34));
    } });
    // ふた：後ろの上の辺を軸に開く
    const ph = open * 1.9;
    const lid = [[-a, by - b, -d], [a, by - b, -d], [a, by - b - 2 * d * Math.sin(ph), -d + 2 * d * Math.cos(ph)], [-a, by - b - 2 * d * Math.sin(ph), -d + 2 * d * Math.cos(ph)]];
    items.push({ z: depth(P, [0, by - b - d * Math.sin(ph), -d + d * Math.cos(ph)]) + (open < 0.5 ? 1 : 0), draw: () => { S.poly3(c, P, lid); c.fillStyle = S.pal.bg; c.fill(); c.strokeStyle = S.pal.accent; c.lineWidth = S.lw; c.stroke(); } });
    items.sort((u, v) => u.z - v.z).forEach(it => it.draw());
  });

  // 柱の看板：柱の上に厚い板。カメラが大きく回り込み、裏からも読める
  add('solid', 'post', '柱の上の看板', (c, S) => {
    const a = 1.05 * wide(S), b = 0.36, d = 0.09;
    const yaw = -2.4 + S.T * 0.55 + (1 - S.in(0, 0.8)) * -0.6;
    const P = S.cam(yaw, -0.25, 3.5);
    const px = S.fit(a * 170, 40);
    c.lineWidth = S.lw;
    drawBoxes(c, S, P, [
      { at: [0, 0.75, 0], size: [0.05, 0.62, 0.05] },
      { at: [0, -0.15, 0], size: [a, b, d], onFace3: f => { if (f.name === 'front' || f.name === 'back') S.line3(c, P, f.o, f.ux, f.uy, px); } },
    ]);
  });

  // 立て札が奥へ並ぶ：厚みのある札が奥へ 3 枚、部分ごとに 1 枚。カメラが横へ流れる
  add('solid', 'standees', '奥へ並ぶ立て札', (c, S) => {
    const list = parts(S);
    const n = list.length;
    const pan = lerp(-0.9, 0.9, ease((S.T - 0.1) / (S.OUT - 0.2)));
    const P0 = S.cam(-0.5 + pan * 0.4, -0.18, 3.6);
    const P = (x, y, z) => P0(x - pan * 0.5, y, z);
    const boxes = list.map(([str, e], k) => {
      const q = back(cl((S.T - 0.15 - k * 0.25) / 0.45));
      const px = S.fitStr(str, 190, 56, e);
      const half = Math.max(0.4, S.cw(str, px, e) / 100 / 2 + 0.15);
      return { at: [(k - (n - 1) / 2) * 0.8, 0.5 - 0.5 * q - (k === 1 ? 0.15 : 0), -(k - (n - 1) / 2) * 0.9], size: [half, 0.3, 0.05], alpha: cl(q * 2), stroke: e ? S.pal.accent : S.pal.fg,
        onFace: (f, cc) => { if (f.name === 'front') S.say(cc, str, 0, 0, px, { heavy: e, color: e ? S.pal.accent : S.pal.fg }); } };
    });
    c.lineWidth = S.lw;
    // 床の線
    c.strokeStyle = S.pal.fg; c.globalAlpha = 0.3 * S.vis;
    for (let k = -4; k <= 4; k++) { const A = P(k * 0.5, 0.82, 1.1), B = P(k * 0.5, 0.82, -3); seg(c, A.x, A.y, B.x, B.y); }
    c.globalAlpha = S.vis;
    drawBoxes(c, S, P, boxes);
  });
}
