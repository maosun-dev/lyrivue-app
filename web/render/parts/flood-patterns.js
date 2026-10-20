// 歌詞そのもので画面を埋める大げさな組み（2026-10-18 持ち主が見本 app/fill-check.html で 53 種中 52 種を「いい」。等高線はいらない）。
// どれも draw(c, S) で行の後ろの層を描く。S は道具と時刻（render/parts/flood.js の floodTools、見本は app/fill-check.js が作る）。
// S.T・S.t は出始めからの秒。濃さは S.ga（全体の濃さ）を掛けて塗る。
// front＝本体の行より手前に描く層（輪が行の前を通る など）。split(S)＝本体の行を上下に割って開くすき間（画素）。
// 線画寄り：縁取りの線・細い線を主にし、塗るのは強調語と帯だけにする。
export const CATS = { tile: '敷き詰め', giant: '巨大な語', band: '帯', ring: '輪・渦', depth: '奥行き', mirror: '鏡・割れ・写し', frame: '枠・図形' };

const TAU = Math.PI * 2;
const cl = x => Math.max(0, Math.min(1, x));
const ease = q => 1 - Math.pow(1 - cl(q), 3);
const frac = x => x - Math.floor(x);

export const PATTERNS = [];
const add = (cat, id, name, draw, extra = {}) => PATTERNS.push({ cat, id, name, draw, ...extra });

// 角丸の四角を折れ線にする（文字を枠に沿わせる用。左上から時計回り）
function roundRectPts(x, y, w, h, r, n = 8) {
  const pts = [];
  const corner = (cx, cy, a0) => { for (let k = 0; k <= n; k++) { const a = a0 + (k / n) * Math.PI / 2; pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); } };
  corner(x + w - r, y + r, -Math.PI / 2);
  corner(x + w - r, y + h - r, 0);
  corner(x + r, y + h - r, Math.PI / 2);
  corner(x + r, y + r, Math.PI);
  return pts;
}
function polyPts(cx, cy, r, sides, a0) {
  return Array.from({ length: sides }, (_, k) => { const a = a0 + k * TAU / sides; return [cx + Math.cos(a) * r, cy + Math.sin(a) * r]; });
}
const line = (c, x0, y0, x1, y1) => { c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); };

// ================= 敷き詰め =================
add('tile', 'diag', '斜めに敷き詰める', (c, S) => {
  const px = S.U * 0.07, lh = px * 1.3, R = Math.hypot(S.W, S.H) / 2 + px * 2;
  c.translate(S.W / 2, S.H / 2); c.rotate(-0.4);
  let k = 0;
  for (let y = -R; y < R; y += lh, k++) {
    const a = S.in(k * 0.02, 0.4);
    S.tile(c, y, px, S.T * px * 0.9 + k * px * 2.3, { left: -R, right: R, alpha: S.dim * a, ealpha: a });
  }
});
add('tile', 'zigzag', '段ごとに逆へ流れる', (c, S) => {
  const px = S.U * 0.085, lh = px * 1.15;
  let k = 0;
  for (let y = px * 0.9; y < S.H + px; y += lh, k++) {
    const dir = k % 2 ? 1 : -1, sp = (0.6 + 0.8 * S.hash(k, 1)) * px * 2;
    const a = S.in(k * 0.04, 0.45);
    S.tile(c, y, px, dir * (S.T * sp + (1 - a) * S.W * 0.7) + k * px * 2, { alpha: S.dim * a, ealpha: 0.95 * a, heavy: k % 3 === 0 });
  }
});
add('tile', 'outline', '縁取りの線で敷き詰める', (c, S) => {
  const px = S.U * 0.15, lh = px * 1.02;
  let k = 0;
  for (let y = px * 0.85; y < S.H + px; y += lh, k++) {
    const a = S.in(k * 0.05, 0.4);
    S.tile(c, y, px, (k % 2 ? 1 : -1) * S.T * px * 0.35 + k * px * 0.7, { mode: 'stroke', emode: 'fill', heavy: true, lw: Math.max(1, px * 0.02), alpha: 0.5 * a, ealpha: 0.85 * a });
  }
});
add('tile', 'mixed', '大小の段', (c, S) => {
  const sizes = [0.19, 0.05, 0.1, 0.045, 0.14, 0.06, 0.08];
  let y = 0, k = 0;
  while (y < S.H + S.U * 0.2 && k < 40) {
    const px = S.U * sizes[k % sizes.length];
    y += px * 1.05;
    const a = S.in(k * 0.05, 0.4), big = px > S.U * 0.09;
    S.tile(c, y, px, (k % 2 ? 1 : -1) * S.T * S.U * (0.6 / (px / S.U * 10)) * 0.4 + k * 50, big
      ? { mode: 'stroke', emode: 'fill', heavy: true, lw: Math.max(1, px * 0.02), alpha: 0.45 * a, ealpha: 0.8 * a }
      : { alpha: S.dim * 1.4 * a, ealpha: a });
    k++;
  }
});
add('tile', 'emphonly', '強調語だけを散らす', (c, S) => {
  const cols = Math.max(3, Math.round(S.W / (S.U * 0.3))), rows = Math.max(3, Math.round(S.H / (S.U * 0.22))) + 1;
  for (let r = 0; r < rows; r++) for (let q = 0; q < cols; q++) {
    const id = r * cols + q, h = S.hash(id, 5);
    const px = S.U * (0.05 + 0.14 * h);
    const x = (q + 0.5 + (S.hash(id, 6) - 0.5) * 0.7) * S.W / cols;
    const span = S.H + S.U * 0.4;
    const y = S.mod((r + 0.5) * span / rows - S.T * S.U * (0.04 + 0.08 * (1 - h)), span) - S.U * 0.2;
    const a = S.in(S.hash(id, 7) * 0.6, 0.3);
    c.save(); c.translate(x, y); c.rotate((S.hash(id, 8) - 0.5) * 0.5);
    S.word(c, 0, px * 0.35, px, id % 5 === 0 ? { mode: 'fill', color: S.pal.accent, alpha: 0.9 * a, heavy: true } : { mode: 'stroke', color: id % 3 ? S.pal.fg : S.pal.accent, alpha: 0.55 * a, heavy: true, lw: Math.max(1, px * 0.025) });
    c.restore();
  }
});
add('tile', 'grid', '方眼に 1 文字ずつ', (c, S) => {
  const s = S.U * 0.1, cols = Math.ceil(S.W / s) + 1, rows = Math.ceil(S.H / s) + 1;
  const ox = (S.W - (cols - 1) * s) / 2 - s / 2, oy = (S.H - (rows - 1) * s) / 2 - s / 2;
  const shift = Math.floor(S.T * 4);
  const px = s * 0.6;
  c.font = S.font(px, true);
  c.lineWidth = 1;
  for (let r = 0; r < rows; r++) for (let q = 0; q < cols; q++) {
    const a = S.in((q + r) * 0.012, 0.3);
    if (!(a > 0)) continue;
    const x = ox + q * s, y = oy + r * s;
    const u = S.unit[S.mod(r * 7 + q + shift, S.unit.length)];
    c.globalAlpha = S.ga * (0.25 * a); c.strokeStyle = S.pal.fg; c.strokeRect(x, y, s, s);
    const sweep = S.mod(q + r - S.T * 9, 26) < 1.5;
    if (u.e) {
      c.globalAlpha = S.ga * (0.95 * a); c.fillStyle = S.pal.accent; c.fillRect(x + 1, y + 1, s - 2, s - 2);
      S.put(c, u, x + (s - S.cw(u.ch, px, true)) / 2, y + s * 0.74, { color: S.pal.bg, ecolor: S.pal.bg, alpha: a });
    } else S.put(c, u, x + (s - S.cw(u.ch, px, true)) / 2, y + s * 0.74, { alpha: (sweep ? 0.9 : S.dim * 1.2) * a });
  }
  c.globalAlpha = S.ga;
});
add('tile', 'rain', '縦の列が降る', (c, S) => {
  const colW = S.U * 0.075;
  const n = Math.ceil(S.W / colW) + 1;
  for (let k = 0; k < n; k++) {
    const big = k % 4 === 1, px = big ? colW * 1.3 : colW * 0.78;
    const sp = (0.4 + S.hash(k, 3)) * px * 4;
    const a = S.in(S.hash(k, 4) * 0.5, 0.3);
    S.vtile(c, (k + 0.5) * colW, px, S.T * sp + S.hash(k, 9) * 999, big
      ? { mode: 'stroke', emode: 'fill', heavy: true, lw: Math.max(1, px * 0.025), alpha: 0.4 * a, ealpha: a }
      : { alpha: S.dim * a, ealpha: 0.9 * a });
  }
});
add('tile', 'checker', '塗りと線の市松', (c, S) => {
  const px = S.U * 0.12, lh = px * 1.05;
  let r = 0;
  for (let y = px * 0.85; y < S.H + px; y += lh, r++) {
    const a = S.in(r * 0.05, 0.35);
    S.tile(c, y, px, (r % 2 ? 1 : -1) * S.T * px * 0.5, {
      heavy: true, lw: Math.max(1, px * 0.022),
      each: k => ((k + r + S.beatN) % 2 ? { mode: 'stroke', alpha: 0.45 * a, emode: 'stroke', ealpha: a } : { mode: 'fill', alpha: S.dim * 0.9 * a, emode: 'fill', ealpha: a }),
    });
  }
});
add('tile', 'wave', '波打つ段', (c, S) => {
  const px = S.U * 0.07, lh = px * 1.5;
  let r = 0;
  for (let y = px; y < S.H + px; y += lh, r++) {
    const a = S.in(r * 0.04, 0.4);
    S.tile(c, y, px, S.T * px * 1.2 * (r % 2 ? 1 : -1), {
      alpha: S.dim * 1.2 * a, ealpha: a,
      each: (k, u, x) => ({ dy: Math.sin(x / S.W * TAU * 1.3 + S.T * 2.4 + r * 0.8) * px * 0.7 * a }),
    });
  }
});
add('tile', 'twolayer', '大きい線と小さい字の二層', (c, S) => {
  const big = S.U * 0.26;
  let k = 0;
  for (let y = big * 0.85; y < S.H + big; y += big * 1.0, k++) {
    const a = S.in(k * 0.08, 0.5);
    S.tile(c, y, big, S.T * big * 0.18 + k * big, { mode: 'stroke', emode: 'stroke', heavy: true, lw: Math.max(1, big * 0.012), alpha: 0.5 * a, ealpha: 0.9 * a });
  }
  const sm = S.U * 0.045;
  k = 0;
  for (let y = sm * 2; y < S.H + sm; y += sm * 2.2, k++) {
    const a = S.in(0.2 + k * 0.02, 0.4);
    S.tile(c, y, sm, -S.T * sm * 6 + k * sm * 5, { alpha: S.dim * 1.3 * a, ealpha: a });
  }
});

// ================= 巨大な語 =================
add('giant', 'hugeoutline', 'はみ出すほど巨大な縁取り', (c, S) => {
  const px = S.fitWord(S.W * 1.35, true);
  const s = (1.5 - 0.5 * S.inQ) * (1 + 0.05 * S.t / 4.8);
  c.translate(S.W / 2, S.H / 2); c.scale(s, s);
  const lw = Math.max(1.5, S.U * 0.006) / s;
  S.word(c, -px * 0.03, px * 0.38, px, { mode: 'stroke', heavy: true, color: S.pal.fg, alpha: 0.35 * S.inQ, lw });
  S.word(c, 0, px * 0.35, px, { mode: 'stroke', heavy: true, color: S.pal.accent, alpha: 0.95 * S.inQ, lw });
});
add('giant', 'splitscreen', '1 文字ずつ画面を割る', (c, S) => {
  const E = S.emphChars, n = E.length;
  const pw = S.W / n;
  const px = Math.min(pw * 0.95, S.H * 0.9);
  c.font = S.font(px, true);
  c.lineWidth = Math.max(1.5, px * 0.012);
  E.forEach((ch, k) => {
    const a = S.in(k * 0.1, 0.45);
    const dy = (1 - a) * S.H * (k % 2 ? 1 : -1);
    const w = S.cw(ch, px, true);
    c.globalAlpha = S.ga * (0.1 * a); c.fillStyle = S.pal.accent; c.fillText(ch, k * pw + (pw - w) / 2, S.H / 2 + px * 0.36 + dy);
    c.globalAlpha = S.ga * (0.9 * a); c.strokeStyle = S.pal.accent; c.strokeText(ch, k * pw + (pw - w) / 2, S.H / 2 + px * 0.36 + dy);
    if (k > 0) { c.globalAlpha = S.ga * (0.5 * S.inQ); c.strokeStyle = S.pal.fg; c.lineWidth = 1; line(c, k * pw, S.H * (1 - S.inQ) / 2, k * pw, S.H * (1 + S.inQ) / 2); c.lineWidth = Math.max(1.5, px * 0.012); }
  });
  c.globalAlpha = S.ga;
});
add('giant', 'stuffed', '巨大な語の中に歌詞を詰める', (c, S) => {
  const px = Math.min(S.fitWord(S.W * 1.1, true), S.H * 1.05);
  const s = 0.85 + 0.15 * S.inQ;
  // 別の画面に歌詞を敷き詰め、巨大な語の形で切り抜いて重ねる（別の画面が作れない所では縁取りだけ）
  const L = S.scratch('stuff');
  if (L) {
    const lc = L.getContext('2d');
    lc.setTransform(1, 0, 0, 1, 0, 0); lc.globalCompositeOperation = 'source-over'; lc.globalAlpha = 1; lc.clearRect(0, 0, L.width, L.height);
    lc.scale(L.width / S.W, L.height / S.H);
    const sm = S.U * 0.05;
    let k = 0;
    for (let y = sm; y < S.H + sm; y += sm * 1.05, k++) S.tile(lc, y, sm, (k % 2 ? 1 : -1) * S.T * sm * 2 + k * sm * 3, { alpha: 1, heavy: true, raw: true });
    lc.globalCompositeOperation = 'destination-in';
    lc.translate(S.W / 2, S.H / 2); lc.scale(s, s);
    S.word(lc, 0, px * 0.36, px, { mode: 'fill', heavy: true, alpha: 1, raw: true });
    lc.setTransform(1, 0, 0, 1, 0, 0); lc.globalCompositeOperation = 'source-over';
    c.globalAlpha = S.ga * (0.85 * S.inQ); c.drawImage(L, 0, 0, S.W, S.H); c.globalAlpha = S.ga;
  }
  c.translate(S.W / 2, S.H / 2); c.scale(s, s);
  S.word(c, 0, px * 0.36, px, { mode: 'stroke', heavy: true, color: S.pal.accent, alpha: 0.9 * S.inQ, lw: Math.max(1.5, S.U * 0.005) / s });
});
add('giant', 'parting', '巨大な語が上下に割れる', (c, S) => {
  const px = Math.min(S.fitWord(S.W * 1.1, true), S.H * 1.1);
  const gap = S.in(0.15, 0.6) * S.m.px * 1.5;
  const cy = S.H / 2;
  for (const side of [-1, 1]) {
    c.save();
    c.translate(0, side * gap);
    c.beginPath(); c.rect(0, side < 0 ? 0 : cy, S.W, cy); c.clip();
    S.word(c, S.W / 2, cy + px * 0.36, px, { mode: 'stroke', heavy: true, color: S.pal.accent, alpha: 0.9 * S.inQ, lw: Math.max(1.5, S.U * 0.006) });
    c.restore();
  }
  c.strokeStyle = S.pal.fg; c.lineWidth = 1; c.globalAlpha = S.ga * (0.7);
  line(c, 0, cy - gap, S.W, cy - gap); line(c, 0, cy + gap, S.W, cy + gap);
  const sm = S.U * 0.028;
  S.tile(c, cy - gap - sm * 0.4, sm, S.T * sm * 4, { alpha: 0.7 * S.inQ, ealpha: S.inQ });
  S.tile(c, cy + gap + sm * 1.1, sm, -S.T * sm * 4, { alpha: 0.7 * S.inQ, ealpha: S.inQ });
});
add('giant', 'slices', '輪切りにしてずらす', (c, S) => {
  const px = Math.min(S.fitWord(S.W * 1.15, true), S.H * 1.1);
  const n = 9, top = S.H / 2 - px * 0.5, h = px * 1.0 / n;
  for (let k = 0; k < n; k++) {
    c.save();
    c.beginPath(); c.rect(0, top + k * h, S.W, h + 0.5); c.clip();
    c.translate(Math.sin(S.T * 1.6 + k * 0.9) * S.U * 0.09 * S.inQ + (1 - S.in(k * 0.03, 0.4)) * S.W * (k % 2 ? 1 : -1), 0);
    S.word(c, S.W / 2, S.H / 2 + px * 0.36, px, { mode: 'fill', heavy: true, color: S.pal.fg, alpha: 0.1 });
    S.word(c, S.W / 2, S.H / 2 + px * 0.36, px, { mode: 'stroke', heavy: true, color: S.pal.accent, alpha: 0.85, lw: Math.max(1.2, S.U * 0.004) });
    c.restore();
  }
});
add('giant', 'spinchar', '巨大な一文字が回る', (c, S) => {
  const ch = S.emphChars[0];
  const px = Math.max(S.W, S.H) * 1.05;
  c.translate(S.W / 2, S.H / 2);
  c.save(); c.rotate(S.T * 0.22 + (1 - S.inQ) * 1.2);
  c.font = S.font(px, true); c.lineWidth = Math.max(1.5, S.U * 0.006);
  c.globalAlpha = S.ga * (0.9 * S.inQ); c.strokeStyle = S.pal.accent; c.strokeText(ch, -S.cw(ch, px, true) / 2, px * 0.36);
  c.restore();
  const p2 = px * 0.55;
  c.rotate(-S.T * 0.4);
  c.font = S.font(p2, true); c.lineWidth = 1;
  c.globalAlpha = S.ga * (0.45 * S.inQ); c.strokeStyle = S.pal.fg; c.strokeText(ch, -S.cw(ch, p2, true) / 2, p2 * 0.36);
  c.globalAlpha = S.ga;
});
add('giant', 'stamp', '拍ごとに叩きつける', (c, S) => {
  const px = S.fitWord(S.W * 0.95, true);
  c.translate(S.W / 2, S.H / 2);
  for (let k = 4; k >= 0; k--) {
    const b = S.beatN - k;
    if (b < 0) continue;
    const age = S.beatAge(k);
    const slam = k === 0 ? 1 + 0.45 * (1 - ease(age / 0.1)) : 1 + k * 0.16;
    c.save(); c.rotate((S.hash(b, 2) - 0.5) * 0.35); c.scale(slam, slam);
    S.word(c, 0, px * 0.36, px, { mode: 'stroke', heavy: true, color: k === 0 ? S.pal.accent : S.pal.fg, alpha: k === 0 ? 0.95 : 0.5 * Math.pow(0.65, k), lw: Math.max(1.2, S.U * 0.005) / slam });
    c.restore();
  }
});

// ================= 帯 =================
add('band', 'thickband', '太い帯の中を歌詞が流れる', (c, S) => {
  const cy = S.H / 2, bh = S.m.px * 2.1;
  let k = 0;
  const sm0 = S.U * 0.05;
  for (let y = sm0; y < S.H + sm0; y += sm0 * 1.25, k++) S.tile(c, y, sm0, (k % 2 ? 1 : -1) * S.T * sm0 * 1.5 + k * sm0 * 3.7, { alpha: S.dim * 0.7 * S.inQ, ealpha: 0.8 * S.inQ });
  const w = S.W * ease(S.in(0.05, 0.45));
  c.fillStyle = S.pal.band; c.globalAlpha = S.ga; c.fillRect(0, cy - bh / 2, w, bh);
  c.save(); c.beginPath(); c.rect(0, cy - bh / 2, w, bh); c.clip();
  const ip = bh * 0.78;
  S.tile(c, cy + ip * 0.36, ip, -S.T * ip * 0.5, { mode: 'stroke', emode: 'stroke', heavy: true, color: S.pal.bg, ecolor: S.pal.bg, lw: Math.max(1, ip * 0.02), alpha: 0.45, ealpha: 0.8 });
  c.restore();
  const sm = S.U * 0.032, a = S.in(0.3, 0.4);
  c.strokeStyle = S.pal.fg; c.lineWidth = 1; c.globalAlpha = S.ga * (0.8 * a);
  for (const side of [-1, 1]) {
    const y = cy + side * (bh / 2 + sm * 1.6);
    line(c, 0, y, S.W * a, y);
    S.tile(c, y + (side < 0 ? -sm * 0.35 : sm * 1.15), sm, side * S.T * sm * 5, { alpha: 0.8 * a, ealpha: a, right: S.W * a });
  }
});
add('band', 'crossing', '何本もの帯が交差する', (c, S) => {
  const R = Math.hypot(S.W, S.H);
  const bands = [[-0.32, -0.22, 1.0, 0], [0.18, 0.05, -1.6, 1], [0.55, 0.26, 0.7, 0], [-0.08, 0.36, -1.1, 0]];
  bands.forEach(([ang, oy, sp, filled], k) => {
    const a = S.in(k * 0.1, 0.45), bh = S.U * 0.11;
    c.save(); c.translate(S.W / 2, S.H / 2 + oy * S.H); c.rotate(ang);
    const len = R * a;
    if (filled) { c.globalAlpha = S.ga * (0.95); c.fillStyle = S.pal.band; c.fillRect(-R / 2, -bh / 2, len, bh); }
    c.globalAlpha = S.ga * (0.6); c.strokeStyle = S.pal.fg; c.lineWidth = 1;
    line(c, -R / 2, -bh / 2, -R / 2 + len, -bh / 2); line(c, -R / 2, bh / 2, -R / 2 + len, bh / 2);
    c.beginPath(); c.rect(-R / 2, -bh / 2, len, bh); c.clip();
    const ip = bh * 0.72;
    S.tile(c, ip * 0.36, ip, S.T * sp * ip, filled
      ? { left: -R / 2, right: R / 2, heavy: true, color: S.pal.bg, ecolor: S.pal.bg, alpha: 0.85, ealpha: 1 }
      : { left: -R / 2, right: R / 2, heavy: true, alpha: 0.6, ealpha: 1 });
    c.restore();
  });
});
add('band', 'vertical', '縦の帯が両脇を流れる', (c, S) => {
  const bw = S.U * 0.13;
  [[0.09, 1, true], [0.91, -1, true], [0.2, -1, false], [0.8, 1, false]].forEach(([fx, dir, wide], k) => {
    const x = S.W * fx, w = wide ? bw : bw * 0.45, a = S.in(k * 0.08, 0.4);
    const h = S.H * a;
    c.globalAlpha = S.ga * (0.6 * a); c.strokeStyle = S.pal.fg; c.lineWidth = 1;
    const y0 = dir > 0 ? 0 : S.H - h;
    line(c, x - w / 2, y0, x - w / 2, y0 + h); line(c, x + w / 2, y0, x + w / 2, y0 + h);
    c.save(); c.beginPath(); c.rect(x - w / 2, y0, w, h); c.clip();
    const px = w * 0.72;
    S.vtile(c, x, px, dir * S.T * px * (wide ? 1.5 : 3), wide ? { mode: 'stroke', emode: 'fill', heavy: true, lw: Math.max(1, px * 0.025), alpha: 0.8 * a, ealpha: a } : { alpha: 0.7 * a, ealpha: a });
    c.restore();
  });
});
add('band', 'tape', 'テープが伸びて横切る', (c, S) => {
  const R = Math.hypot(S.W, S.H) * 1.1;
  [0.16, 0.38, 0.64, 0.86].forEach((fy, k) => {
    const a = ease(S.in(k * 0.12, 0.35)), th = S.U * (k % 2 ? 0.075 : 0.1);
    c.save(); c.translate(k % 2 ? S.W : 0, S.H * fy); c.rotate((S.hash(k, 4) - 0.5) * 0.45); if (k % 2) c.scale(-1, 1);
    c.fillStyle = k % 2 ? S.pal.accent : S.pal.band; c.globalAlpha = S.ga * (0.95);
    c.fillRect(-S.U * 0.1, -th / 2, R * a, th);
    c.beginPath(); c.rect(-S.U * 0.1, -th / 2, R * a, th); c.clip();
    if (k % 2) c.scale(-1, 1);
    const ip = th * 0.7;
    S.tile(c, ip * 0.36, ip, S.T * ip * 2 * (k % 2 ? 1 : -1), { left: -R, right: R, heavy: true, color: S.pal.bg, ecolor: S.pal.bg, alpha: 0.9, ealpha: 1 });
    c.restore();
  });
});
add('band', 'hazard', '斜めの縞で上下を挟む', (c, S) => {
  const zh = S.H * 0.13;
  const a = S.inQ;
  c.strokeStyle = S.pal.fg; c.lineWidth = Math.max(1, S.U * 0.004);
  for (const top of [true, false]) {
    const y0 = top ? (1 - a) * -zh : S.H - zh + (1 - a) * zh;
    c.save(); c.beginPath(); c.rect(0, y0, S.W, zh); c.clip();
    const sp = S.U * 0.05, off = S.mod(S.T * S.U * 0.12 * (top ? 1 : -1), sp);
    c.globalAlpha = S.ga * (0.7);
    for (let x = -zh - sp + off; x < S.W + zh; x += sp) line(c, x, y0 + zh, x + zh, y0);
    c.restore();
    c.globalAlpha = S.ga * (0.9); line(c, 0, top ? y0 + zh : y0, S.W, top ? y0 + zh : y0);
    const sm = S.U * 0.04;
    S.tile(c, top ? y0 + zh + sm * 1.25 : y0 - sm * 0.45, sm, S.T * sm * 3 * (top ? -1 : 1), { heavy: true, alpha: 0.85 * a, ealpha: a });
  }
});
add('band', 'border', '画面の縁を一周する', (c, S) => {
  const lap = (d, px, sp, o) => {
    const pts = [[d, d], [S.W - d, d], [S.W - d, S.H - d], [d, S.H - d]];
    S.path(c, pts, true, px, S.T * sp, o);
  };
  const a = S.inQ;
  const d1 = S.U * 0.06, d2 = S.U * 0.15;
  c.strokeStyle = S.pal.fg; c.lineWidth = 1; c.globalAlpha = S.ga * (0.5 * a);
  c.strokeRect(d1 - S.U * 0.035, d1 - S.U * 0.035, S.W - 2 * d1 + S.U * 0.07, S.H - 2 * d1 + S.U * 0.07);
  lap(d1, S.U * 0.05, S.U * 0.3, { alpha: 0.85 * a, ealpha: a, heavy: true });
  lap(d2, S.U * 0.075, -S.U * 0.18, { mode: 'stroke', emode: 'fill', heavy: true, lw: 1, alpha: 0.55 * a, ealpha: a });
});
add('band', 'stairs', '階段のようにずれる帯', (c, S) => {
  const n = 7, h = S.H / (n + 1);
  for (let k = 0; k < n; k++) {
    const a = ease(S.in(k * 0.07, 0.4));
    const x0 = -S.W * 0.15 + k * S.W * 0.1, y0 = h * 0.5 + k * h, w = S.W * 0.75 * a;
    c.globalAlpha = S.ga * (0.6); c.strokeStyle = S.pal.fg; c.lineWidth = 1; c.strokeRect(x0, y0, w, h * 0.82);
    c.save(); c.beginPath(); c.rect(x0, y0, w, h * 0.82); c.clip();
    const px = h * 0.6;
    S.tile(c, y0 + h * 0.62, px, S.T * px * (k % 2 ? 1.2 : -1.2), { left: x0, right: x0 + w, heavy: k % 2 === 0, mode: k % 3 === 1 ? 'stroke' : 'fill', emode: 'fill', lw: 1, alpha: 0.55, ealpha: 1 });
    c.restore();
  }
});

// ================= 輪・渦 =================
add('ring', 'rings', '同心の輪が逆に回る', (c, S) => {
  const cx = S.W / 2, cy = S.H / 2;
  [0.22, 0.35, 0.5, 0.68, 0.88].forEach((f, k) => {
    const a = S.in(k * 0.06, 0.45);
    const r = S.U * f * (0.7 + 0.3 * a), px = Math.min(S.U * 0.065, r * 0.2);
    S.path(c, S.circle(cx, cy, r, 120, 0), true, px, (k % 2 ? 1 : -1) * S.T * S.U * 0.12 * (1 + k * 0.15), k % 2
      ? { alpha: S.dim * 1.6 * a, ealpha: a }
      : { mode: 'stroke', emode: 'fill', heavy: true, lw: 1, alpha: 0.6 * a, ealpha: a });
  });
});
add('ring', 'spiral', '渦巻きに吸い込まれる', (c, S) => {
  c.translate(S.W / 2, S.H / 2); c.rotate(S.T * 0.7);
  const R = Math.hypot(S.W, S.H) * 0.55;
  for (const arm of [0, Math.PI]) {
    let th = 0, i = arm ? 7 : 0;
    const b = S.U * 0.07;
    for (let n = 0; n < 900; n++) {
      const r = S.U * 0.12 + b * th;
      if (r > R) break;
      const px = Math.max(6, Math.round(r * 0.2 / 3) * 3);
      const u = S.unit[S.mod(i, S.unit.length)];
      const w = S.cw(u.ch, px, true);
      const a = S.in(th * 0.012, 0.3);
      c.save(); c.rotate(th + arm); c.translate(r, 0); c.rotate(Math.PI / 2);
      c.font = S.font(px, true); c.lineWidth = 1;
      S.put(c, u, -w / 2, px * 0.35, arm ? { mode: 'stroke', emode: 'fill', alpha: 0.6 * a, ealpha: a } : { alpha: S.dim * 1.5 * a, ealpha: a });
      c.restore();
      th += (w * 1.05) / r; i++;
    }
  }
});
add('ring', 'radial', '中心から放射する', (c, S) => {
  c.translate(S.W / 2, S.H / 2); c.rotate(S.T * 0.12);
  const n = 18, px = S.U * 0.045, r0 = S.U * 0.2, R = Math.hypot(S.W, S.H) * 0.55;
  for (let k = 0; k < n; k++) {
    const a = S.in(k * 0.025, 0.4);
    c.save(); c.rotate(k * TAU / n);
    S.run(c, r0 + (1 - a) * R * 0.3 + S.mod(S.T * px * 2, S.UW(px, true)) - S.UW(px, true), px * 0.35, px, { until: R, heavy: true, mode: k % 2 ? 'stroke' : 'fill', emode: 'fill', lw: 1, alpha: (k % 2 ? 0.6 : S.dim * 1.5) * a, ealpha: a, start: k * 3, after: r0 });
    c.restore();
  }
});
const orbit = front => (c, S) => {
  const R = Math.min(S.W * 0.46, S.U * 0.75), px = S.U * 0.065;
  const n = Math.floor(TAU * R / (px * 1.0));
  const rings = [[0.32, -0.28, 1], [0.22, 0.35, -0.7]];
  rings.forEach(([tilt, roll, sp], ri) => {
    const a = S.in(ri * 0.15, 0.5);
    c.save(); c.translate(S.W / 2, S.H / 2); c.rotate(roll * a);
    c.font = S.font(px, true); c.lineWidth = 1;
    for (let j = 0; j < n; j++) {
      const phi = j * TAU / n + S.T * 0.5 * sp + ri;
      const z = Math.sin(phi);
      if ((z > 0) !== front) continue;
      const u = S.unit[S.mod(j + ri * 5, S.unit.length)];
      const s = 1 + 0.4 * z;
      const sx = Math.sign(z || 1) * Math.max(0.15, Math.abs(z));
      c.save(); c.translate(Math.cos(phi) * R * a, Math.sin(phi) * R * tilt * a); c.scale(s * sx, s);
      S.put(c, u, -S.cw(u.ch, px, true) / 2, px * 0.35, front ? { alpha: 0.8 * a, ealpha: a } : { mode: 'stroke', emode: 'stroke', alpha: 0.45 * a, ealpha: 0.8 * a });
      c.restore();
    }
    c.restore();
  });
};
add('ring', 'orbit', '傾いた輪が行の前後を回る', orbit(false), { front: orbit(true) });
add('ring', 'ripple', '拍ごとに波紋が広がる', (c, S) => {
  for (let k = 0; k < 5; k++) {
    const b = S.beatN - k;
    if (b < 0) continue;
    const age = S.beatAge(k);
    const r = S.U * 0.12 + age * S.U * 0.3;
    const a = cl(1 - age / 2.5) * (k === 0 ? ease(age / 0.15) : 1);
    if (!(a > 0)) continue;
    const px = Math.min(S.U * 0.09, S.U * 0.035 + r * 0.06);
    c.strokeStyle = S.pal.fg; c.lineWidth = 1; c.globalAlpha = S.ga * (0.5 * a);
    c.beginPath(); c.arc(S.W / 2, S.H / 2, r + px * 0.75, 0, TAU); c.stroke();
    S.path(c, S.circle(S.W / 2, S.H / 2, r, 120, S.hash(b, 1) * TAU), true, px, S.T * S.U * 0.05 * (b % 2 ? 1 : -1), b % 2 ? { alpha: 0.7 * a, ealpha: a } : { mode: 'stroke', emode: 'fill', heavy: true, lw: 1, alpha: 0.8 * a, ealpha: a });
  }
});
add('ring', 'clock', '文字盤の針が強調語を指す', (c, S) => {
  const cx = S.W / 2, cy = S.H / 2, R = S.U * 0.4;
  const chars = S.unit.filter(u => u.ch.trim());
  const ang = S.T * TAU / 2.4 - Math.PI / 2;
  const a = S.inQ;
  c.strokeStyle = S.pal.fg; c.lineWidth = 1;
  for (let k = 0; k < 60; k++) {
    const th = k * TAU / 60, l = k % 5 ? 0.04 : 0.09;
    c.globalAlpha = S.ga * ((k % 5 ? 0.35 : 0.8) * a);
    line(c, cx + Math.cos(th) * R * 1.12, cy + Math.sin(th) * R * 1.12, cx + Math.cos(th) * R * (1.12 - l), cy + Math.sin(th) * R * (1.12 - l));
  }
  const near = S.mod(Math.round((ang + Math.PI / 2) / (TAU / 12)), 12);
  for (let k = 0; k < 12; k++) {
    const u = chars[k % chars.length];
    const th = k * TAU / 12 - Math.PI / 2;
    const hit = k === near, px = S.U * (hit ? 0.13 : 0.075);
    c.font = S.font(px, true);
    S.put(c, hit ? { ...u, e: true } : u, cx + Math.cos(th) * R * 0.88 - S.cw(u.ch, px, true) / 2, cy + Math.sin(th) * R * 0.88 + px * 0.35, { alpha: 0.6 * a, ealpha: a });
  }
  c.globalAlpha = S.ga * (0.95 * a); c.strokeStyle = S.pal.accent; c.lineWidth = Math.max(1.5, S.U * 0.006);
  line(c, cx - Math.cos(ang) * R * 0.15, cy - Math.sin(ang) * R * 0.15, cx + Math.cos(ang) * R * 0.72, cy + Math.sin(ang) * R * 0.72);
  c.globalAlpha = S.ga;
});
add('ring', 'kaleido', '万華鏡のように強調語を回す', (c, S) => {
  c.translate(S.W / 2, S.H / 2);
  const rings = [[0.36, 0.1, 8, 1], [0.2, 0.06, 8, -1.6], [0.62, 0.14, 12, 0.6]];
  rings.forEach(([rf, pf, n, sp], ri) => {
    const a = S.in(ri * 0.12, 0.45), px = S.U * pf;
    for (let k = 0; k < n; k++) {
      c.save(); c.rotate(k * TAU / n + S.T * 0.25 * sp + (1 - a) * sp); c.translate(0, -S.U * rf * (0.6 + 0.4 * a));
      if (k % 2) c.scale(-1, 1);
      S.word(c, 0, px * 0.36, px, { mode: ri === 1 ? 'fill' : 'stroke', heavy: true, color: (k + ri) % 2 ? S.pal.fg : S.pal.accent, alpha: (ri === 1 ? 0.45 : 0.8) * a, lw: 1 });
      c.restore();
    }
  });
  c.strokeStyle = S.pal.fg; c.lineWidth = 1; c.globalAlpha = S.ga * (0.25 * S.inQ);
  for (let k = 0; k < 16; k++) { const th = k * TAU / 16 + S.T * 0.05; line(c, Math.cos(th) * S.U * 0.12, Math.sin(th) * S.U * 0.12, Math.cos(th) * S.U * 1.2, Math.sin(th) * S.U * 1.2); }
});

// ================= 奥行き =================
add('depth', 'tunnel', '写しが奥へ遠ざかる', (c, S) => {
  const lw = S.lineW(100, false);
  const list = [];
  const ph = Math.floor(S.T * 0.6);
  for (let k = 0; k < 14; k++) {
    const z = 1.3 + k * 0.7 - frac(S.T * 0.6) * 0.7;
    list.push([z, (k + ph) % 2]);
  }
  list.sort((p, q) => q[0] - p[0]);
  for (const [z, side] of list) {
    const a = cl((z - 1.3) / 0.6) * cl((11 - z) / 4) * S.in(z * 0.03, 0.4);
    const P = S.proj(Math.sin(z * 0.8 + S.T * 0.5) * 0.25, side ? 0.42 : -0.42, z);
    const s = (S.W * 0.9 / lw) * (1.3 / z);
    c.save(); c.translate(P.x, P.y); c.scale(s, s);
    c.font = S.font(100, z < 2.5);
    S.run(c, -lw / 2, 35, 100, { n: S.chars.length, mode: z < 2.6 ? 'fill' : 'stroke', emode: 'stroke', lw: 1.2 / s, alpha: (z < 2.6 ? S.dim : 0.75) * a, ealpha: a });
    c.restore();
  }
});
add('depth', 'warp', '強調語が奥から迫る', (c, S) => {
  const list = [];
  for (let i = 0; i < 26; i++) {
    const ph = frac(S.T * 0.32 + S.hash(i, 1));
    const z = 0.5 + 11 * (1 - ph);
    let x = (S.hash(i, 2) - 0.5) * 4.4, y = (S.hash(i, 3) - 0.5) * 2.6;
    if (Math.abs(x) < 0.5 && Math.abs(y) < 0.4) x += x < 0 ? -0.6 : 0.6;
    list.push({ i, z, x, y, ph });
  }
  list.sort((p, q) => q.z - p.z);
  const px0 = 0.36;
  for (const p of list) {
    const a = cl(p.ph * 4) * cl((p.z - 0.5) / 0.8) * S.inQ;
    const P = S.proj(p.x, p.y, p.z), B = S.proj(p.x, p.y, p.z + 1.4);
    c.globalAlpha = S.ga * (0.5 * a); c.strokeStyle = S.pal.fg; c.lineWidth = 1; line(c, B.x, B.y, P.x, P.y);
    const px = px0 * P.s;
    if (px < 2) continue;
    S.word(c, P.x, P.y + px * 0.35, px, { mode: p.i % 4 ? 'stroke' : 'fill', heavy: true, color: p.i % 3 ? S.pal.fg : S.pal.accent, alpha: 0.9 * a, lw: 1 });
  }
});
const floorRows = (c, S, yw, flip) => {
  const step = 0.75;
  const list = [];
  for (let r = 0; r < 18; r++) list.push({ r, z: 1.0 + r * step - frac(S.T * 0.9) * step, ri: r + Math.floor(S.T * 0.9) });
  list.sort((p, q) => q.z - p.z);
  for (const { z, ri } of list) {
    const a = cl((z - 1.0) / 0.5) * cl((13 - z) / 5) * S.inQ;
    if (!(a > 0)) continue;
    const ch = 0.34;
    const P0 = S.proj(0, yw, z);
    const s = ch * P0.s / 100;
    const sq = Math.abs(yw) / z * 1.4;
    c.save(); c.translate(P0.x, P0.y); c.scale(s, s * Math.min(1, sq) * (flip ? -1 : 1));
    c.font = S.font(100, true);
    const uw = S.UW(100, true), span = S.W / s;
    S.run(c, -span / 2 - S.mod(ri * 230, uw), 0, 100, { until: span / 2, heavy: true, mode: ri % 3 ? 'stroke' : 'fill', emode: 'fill', lw: 1.2 / s, alpha: (ri % 3 ? 0.6 : S.dim * 1.4) * a, ealpha: a });
    c.restore();
  }
  c.strokeStyle = S.pal.fg; c.lineWidth = 1;
  for (let k = -6; k <= 6; k++) {
    const A = S.proj(k * 0.8, yw, 1.0), B = S.proj(k * 0.8, yw, 14);
    c.globalAlpha = S.ga * (0.18 * S.inQ); line(c, A.x, A.y, B.x, B.y);
  }
};
add('depth', 'floor', '床一面に歌詞が流れてくる', (c, S) => {
  floorRows(c, S, 1, false);
  c.globalAlpha = S.ga * (0.6 * S.inQ); c.strokeStyle = S.pal.fg; line(c, 0, S.H / 2, S.W, S.H / 2);
});
add('depth', 'floorceil', '床と天井の両方', (c, S) => {
  floorRows(c, S, 1, false);
  floorRows(c, S, -1, true);
});
add('depth', 'box', '四方の壁の歌詞の中を進む', (c, S) => {
  const walls = [[-1.5, -0.7], [-1.5, 0.05], [-1.5, 0.8], [1.5, -0.7], [1.5, 0.05], [1.5, 0.8]];
  const ch = 0.42;
  walls.forEach(([wx, wy], k) => {
    const uw = S.UW(100, true) / 100 * ch;
    let zw = 1.0 - S.mod(S.T * 1.6 + k * 0.37, uw);
    let i = 0;
    while (zw < 14 && i < 200) {
      const u = S.unit[S.mod(i + k * 3, S.unit.length)];
      const w = S.cw(u.ch, 100, true) / 100 * ch;
      const zc = zw + w / 2;
      if (zc > 0.9) {
        const P = S.proj(wx, wy, zc);
        const s = ch * P.s / 100;
        const a = cl((zc - 0.9) / 0.6) * cl((14 - zc) / 6) * S.in(k * 0.03, 0.4);
        c.save(); c.translate(P.x, P.y);
        c.scale(s * 0.45, s);
        c.font = S.font(100, true); c.lineWidth = 1.2 / s;
        S.put(c, u, -S.cw(u.ch, 100, true) / 2, 35, k % 2 ? { mode: 'stroke', emode: 'fill', alpha: 0.7 * a, ealpha: a } : { alpha: S.dim * 1.6 * a, ealpha: a });
        c.restore();
      }
      zw += w; i++;
    }
  });
  c.strokeStyle = S.pal.fg; c.lineWidth = 1; c.globalAlpha = S.ga * (0.35 * S.inQ);
  for (const [x, y] of [[-1.5, -1.05], [1.5, -1.05], [-1.5, 1.15], [1.5, 1.15]]) { const A = S.proj(x, y, 0.9), B = S.proj(x, y, 14); line(c, A.x, A.y, B.x, B.y); }
});
add('depth', 'stepsback', '段になって奥へ並ぶ', (c, S) => {
  const lw = S.lineW(100, false);
  for (const dir of [1, -1]) {
    const list = [];
    for (let k = 0; k < 8; k++) list.push(k + 1 - frac(S.T * 0.7));
    list.sort((p, q) => q - p);
    for (const f of list) {
      const a = cl(f / 0.5) * cl((8 - f) / 2.5) * S.in(f * 0.04, 0.4);
      const sc = 1 / (1 + f * 0.22);
      const s = (S.W * 0.82 / lw) * sc;
      c.save(); c.translate(S.W / 2 + dir * f * S.W * 0.075, S.H / 2 - dir * f * S.H * 0.095); c.scale(s, s);
      S.run(c, -lw / 2, 35, 100, { n: S.chars.length, mode: 'stroke', emode: f < 1.5 ? 'fill' : 'stroke', lw: 1.2 / s, alpha: 0.75 * a, ealpha: a });
      c.restore();
    }
  }
});
add('depth', 'cylinder', '回る円柱に巻きつく', (c, S) => {
  const Rx = Math.min(S.W * 0.42, S.U * 0.7), px = S.U * 0.095;
  const n = Math.floor(TAU * Rx / (px * 1.02));
  const rows = Math.ceil(S.H / (px * 1.3)) + 1;
  for (const back of [true, false]) {
    for (let r = 0; r < rows; r++) {
      const y = (r + 0.5) * S.H / rows + px * 0.35;
      const a = S.in(r * 0.04, 0.4);
      c.font = S.font(px, true); c.lineWidth = 1;
      for (let j = 0; j < n; j++) {
        const phi = -(j * TAU / n) + S.T * 0.45 * (r % 2 ? 1 : -1.3);
        const z = Math.cos(phi);
        if ((z < 0) !== back) continue;
        const u = S.unit[S.mod(j + r * 4, S.unit.length)];
        const sx = Math.sign(z || 1) * Math.max(0.12, Math.abs(z));
        c.save(); c.translate(S.W / 2 + Math.sin(phi) * Rx, y); c.scale(sx * (1 + 0.15 * z), 1 + 0.15 * z);
        S.put(c, u, -S.cw(u.ch, px, true) / 2, 0, back ? { mode: 'stroke', emode: 'stroke', alpha: 0.3 * a, ealpha: 0.6 * a } : { alpha: (0.25 + 0.4 * z) * a, ealpha: a });
        c.restore();
      }
    }
  }
});
add('depth', 'pillars', '縦の列が奥まで並ぶ', (c, S) => {
  const list = [];
  for (const side of [-1, 1]) for (let k = 0; k < 10; k++) list.push({ side, k, z: 1.2 + k * 1.2 - frac(S.T * 0.55) * 1.2, ki: k + Math.floor(S.T * 0.55) });
  list.sort((p, q) => q.z - p.z);
  for (const p of list) {
    const a = cl((p.z - 1.2) / 0.6) * cl((13 - p.z) / 5) * S.inQ;
    if (!(a > 0)) continue;
    const x = p.side * (0.9 + 0.25 * S.hash(p.ki, p.side + 3));
    const ch = 0.24;
    const P = S.proj(x, -1.3, p.z);
    const s = ch * P.s / 100;
    c.save(); c.translate(P.x, P.y); c.scale(s, s);
    c.font = S.font(100, true);
    S.run(c, 0, 0, 100, { vertical: true, until: 2.6 / ch * 100, start: p.ki * 5, heavy: true, mode: p.ki % 2 ? 'stroke' : 'fill', emode: 'fill', lw: 1.2 / s, alpha: (p.ki % 2 ? 0.75 : S.dim * 1.6) * a, ealpha: a });
    c.restore();
  }
});

// ================= 鏡・割れ・写し =================
add('mirror', 'water', '水面に映る', (c, S) => {
  const m = S.m, y0 = m.L.bottom + m.px * 0.12, h = (m.L.bottom - m.L.top) * 1.1;
  const n = 14;
  for (let k = 0; k < n; k++) {
    c.save();
    c.beginPath(); c.rect(0, y0 + k * h / n, S.W, h / n + 0.5); c.clip();
    c.translate(Math.sin(S.T * 3 + k * 0.8) * S.U * 0.012 * (0.3 + k / n), 0);
    c.translate(0, y0 * 2); c.scale(1, -1);
    S.drawMain(c, { plain: true, alpha: 0.5 * (1 - k / n) * S.inQ, outline: false });
    c.restore();
  }
  c.strokeStyle = S.pal.fg; c.globalAlpha = S.ga * (0.7 * S.inQ); c.lineWidth = 1; line(c, S.W * (0.5 - 0.5 * S.inQ), y0, S.W * (0.5 + 0.5 * S.inQ), y0);
  const sm = S.U * 0.03;
  for (let k = 0; k < 6; k++) {
    const y = y0 + h + sm * (1.2 + k * 1.5);
    if (y > S.H + sm) break;
    S.tile(c, y, sm, S.T * sm * (2 + k) * (k % 2 ? 1 : -1), { alpha: 0.5 * (1 - k / 6) * S.inQ, ealpha: (1 - k / 6) * S.inQ });
  }
  for (let k = 0; k < 5; k++) {
    const y = m.L.top - sm * (1 + k * 1.6);
    if (y < 0) break;
    S.tile(c, y, sm, -S.T * sm * (2 + k), { alpha: 0.3 * (1 - k / 5) * S.inQ, ealpha: 0.6 * S.inQ });
  }
});
add('mirror', 'lr', '左右の鏡写し', (c, S) => {
  const half = () => {
    const px = S.U * 0.09;
    let k = 0;
    for (let y = px; y < S.H + px; y += px * 1.15, k++) {
      const a = S.in(k * 0.05, 0.4);
      S.tile(c, y, px, S.T * px * (k % 2 ? 0.8 : -0.8) + k * px * 2, { right: S.W / 2, heavy: true, mode: k % 2 ? 'stroke' : 'fill', emode: 'fill', lw: 1, alpha: (k % 2 ? 0.5 : S.dim) * a, ealpha: a });
    }
    const big = S.fitWord(S.W * 0.42, true);
    S.word(c, S.W * 0.27, S.H / 2 + big * 0.36, big, { mode: 'stroke', heavy: true, color: S.pal.accent, alpha: 0.85 * S.inQ, lw: Math.max(1.2, S.U * 0.005) });
  };
  c.save(); c.beginPath(); c.rect(0, 0, S.W / 2, S.H); c.clip(); half(); c.restore();
  c.save(); c.beginPath(); c.rect(S.W / 2, 0, S.W / 2, S.H); c.clip(); c.translate(S.W, 0); c.scale(-1, 1); half(); c.restore();
  c.strokeStyle = S.pal.accent; c.lineWidth = Math.max(1, S.U * 0.004); c.globalAlpha = S.ga * (S.inQ);
  line(c, S.W / 2, S.H * (0.5 - 0.5 * S.inQ), S.W / 2, S.H * (0.5 + 0.5 * S.inQ));
});
const splitGap = S => ease(S.in(0.35, 0.5)) * S.H * 0.2;
add('mirror', 'splitopen', '行が上下に割れて開く', (c, S) => {
  const m = S.m, cy = (m.L.top + m.L.bottom) / 2;
  const gap = splitGap(S);
  const big = Math.min(S.fitWord(S.W * 0.95, true), gap * 1.6);
  if (big > 4) {
    c.save(); c.beginPath(); c.rect(0, cy - gap / 2, S.W, gap); c.clip();
    S.word(c, S.W / 2, cy + big * 0.36, big, { mode: 'stroke', heavy: true, color: S.pal.accent, alpha: 0.95, lw: Math.max(1.2, S.U * 0.005) });
    const sm = S.U * 0.026;
    S.tile(c, cy - gap / 2 + sm * 1.1, sm, S.T * sm * 5, { alpha: 0.7, ealpha: 1 });
    S.tile(c, cy + gap / 2 - sm * 0.35, sm, -S.T * sm * 5, { alpha: 0.7, ealpha: 1 });
    c.restore();
  }
  c.strokeStyle = S.pal.fg; c.lineWidth = 1; c.globalAlpha = S.ga * (0.8);
  line(c, 0, cy - gap / 2, S.W, cy - gap / 2); line(c, 0, cy + gap / 2, S.W, cy + gap / 2);
}, { split: splitGap });
add('mirror', 'echo', '残像が階段のように残る', (c, S) => {
  const th = S.T * 0.9;
  for (let k = 8; k >= 1; k--) {
    const d = k * S.m.px * 0.13 * S.inQ;
    S.drawMain(c, { dx: Math.cos(th) * d, dy: Math.sin(th) * d * 0.7, mode: 'stroke', color: k % 2 ? S.pal.accent : S.pal.fg, alpha: 0.85 * (1 - k / 10), lw: 1 });
  }
});
add('mirror', 'quad', '四つに割って回した写し', (c, S) => {
  const hw = S.W / 2, hh = S.H / 2;
  for (let q = 0; q < 4; q++) {
    const qx = q % 2 ? hw : 0, qy = q > 1 ? hh : 0;
    const a = S.in(q * 0.1, 0.4);
    c.save(); c.beginPath(); c.rect(qx, qy, hw, hh); c.clip();
    c.translate(qx + hw / 2, qy + hh / 2); c.rotate(q * Math.PI / 2 + Math.sin(S.T * 0.5) * 0.08);
    const R = Math.hypot(hw, hh) / 2 + 10, px = S.U * 0.07;
    let k = 0;
    for (let y = -R; y < R; y += px * 1.1, k++) S.tile(c, y, px, S.T * px * 1.2 * (k % 2 ? 1 : -1) + k * 40, { left: -R, right: R, heavy: true, mode: (k + q) % 2 ? 'stroke' : 'fill', emode: 'fill', lw: 1, alpha: ((k + q) % 2 ? 0.5 : S.dim) * a, ealpha: a });
    c.restore();
  }
  c.strokeStyle = S.pal.accent; c.lineWidth = Math.max(1, S.U * 0.004); c.globalAlpha = S.ga * (S.inQ);
  line(c, hw, 0, hw, S.H); line(c, 0, hh, S.W, hh);
});
add('mirror', 'multiply', '強調語がどんどん増える', (c, S) => {
  const every = 0.22;
  const id0 = Math.floor(S.T / every);
  for (let k = 18; k >= 0; k--) {
    const id = id0 - k;
    if (id < 0) continue;
    const age = S.T - id * every;
    const a = cl(1 - age / 4);
    const px = S.U * (0.05 + 0.2 * Math.pow(S.hash(id, 1), 2));
    const pop = 1 + 0.4 * (1 - ease(age / 0.08));
    c.save(); c.translate(S.hash(id, 2) * S.W, S.hash(id, 3) * S.H); c.rotate((S.hash(id, 4) - 0.5) * 0.9); c.scale(pop, pop);
    S.word(c, 0, px * 0.36, px, id % 4 ? { mode: 'stroke', heavy: true, color: id % 3 ? S.pal.fg : S.pal.accent, alpha: 0.85 * a, lw: Math.max(1, px * 0.02) } : { mode: 'fill', heavy: true, color: S.pal.accent, alpha: 0.9 * a });
    c.restore();
  }
});
add('mirror', 'zoomstack', '拡大した写しが重なり続ける', (c, S) => {
  const base = S.fitWord(S.W * 0.3, true);
  c.translate(S.W / 2, S.H / 2);
  const f = frac(S.T * 0.45);
  for (let k = -2; k < 7; k++) {
    const e = k + f;
    const s = Math.pow(1.65, e);
    const a = cl((e + 2) / 1.5) * cl((6.5 - e) / 2) * S.inQ;
    if (!(a > 0)) continue;
    c.save(); c.scale(s, s); c.rotate(e * 0.06);
    S.word(c, 0, base * 0.36, base, { mode: 'stroke', heavy: true, color: Math.floor(e + 100 - f) % 2 ? S.pal.fg : S.pal.accent, alpha: 0.8 * a, lw: 1.2 / s });
    c.restore();
  }
});

// ================= 枠・図形 =================
add('frame', 'roundframe', '半透明の角丸の枠に沿って流れる', (c, S) => {
  const m = S.m, pad = m.px * 0.55;
  const sm0 = S.U * 0.045;
  let k = 0;
  for (let y = sm0; y < S.H + sm0; y += sm0 * 1.3, k++) S.tile(c, y, sm0, (k % 2 ? 1 : -1) * S.T * sm0 + k * 30, { alpha: S.dim * 0.6 * S.inQ, ealpha: 0.7 * S.inQ });
  const a = ease(S.in(0.05, 0.45)), s = 0.85 + 0.15 * a;
  const cx = (m.L.left + m.L.right) / 2, cy = (m.L.top + m.L.bottom) / 2;
  const w = (m.L.right - m.L.left + pad * 2) * s, h = (m.L.bottom - m.L.top + pad * 2) * s;
  const box = (ww, hh) => roundRectPts(cx - ww / 2, cy - hh / 2, ww, hh, Math.min(hh / 2, S.U * 0.07));
  c.beginPath(); box(w, h).forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath();
  c.globalAlpha = S.ga * (0.14 * a); c.fillStyle = S.pal.fg; c.fill();
  c.globalAlpha = S.ga * (0.8 * a); c.strokeStyle = S.pal.fg; c.lineWidth = 1; c.stroke();
  const sm = S.U * 0.032;
  S.path(c, box(w + sm * 2.4, h + sm * 2.4), true, sm, S.T * S.U * 0.15, { alpha: 0.85 * a, ealpha: a, heavy: true });
  S.path(c, box(w + sm * 5.4, h + sm * 5.4), true, sm * 1.3, -S.T * S.U * 0.1, { mode: 'stroke', emode: 'fill', heavy: true, lw: 1, alpha: 0.6 * a, ealpha: a });
});
add('frame', 'shapes', '歌詞で描く丸・三角・四角', (c, S) => {
  const cx = S.W / 2, cy = S.H / 2, R = S.U * 0.42;
  const shape = (kind, r, a0) => kind === 0 ? S.circle(cx, cy, r, 120, a0) : polyPts(cx, cy, r, kind === 1 ? 3 : 4, a0 + (kind === 1 ? -Math.PI / 2 : Math.PI / 4));
  const per = 1.2, idx = Math.floor(S.T / per), q = frac(S.T / per);
  for (const [k, age] of [[idx - 1, 1 + q], [idx, q]]) {
    if (k < 0) continue;
    const kind = S.mod(k, 3);
    const grow = age < 1 ? 0.75 + 0.25 * ease(age / 0.25) : 1 + (age - 1) * 0.8;
    const a = age < 1 ? ease(age / 0.15) : cl(1 - (age - 1) * 2.5);
    const pts = shape(kind, R * grow, S.T * 0.3);
    c.strokeStyle = S.pal.fg; c.lineWidth = 1; c.globalAlpha = S.ga * (0.35 * a);
    c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); c.stroke();
    S.path(c, shape(kind, R * grow * 0.93, S.T * 0.3), true, S.U * 0.055, S.T * S.U * 0.2, { heavy: true, alpha: 0.85 * a * S.inQ, ealpha: a * S.inQ });
  }
});
add('frame', 'brackets', '巨大なかぎ括弧で挟む', (c, S) => {
  const a = ease(S.in(0, 0.5)), off = (1 - a) * S.U * 0.4;
  const m = S.U * 0.07, w = S.W * 0.36, h = S.H * 0.42, lw = Math.max(3, S.U * 0.018);
  const tl = [[m + w - off, m - off], [m - off, m - off], [m - off, m + h - off]];
  const br = [[S.W - m - w + off, S.H - m + off], [S.W - m + off, S.H - m + off], [S.W - m + off, S.H - m - h + off]];
  c.strokeStyle = S.pal.accent; c.lineWidth = lw; c.lineCap = 'square';
  for (const pts of [tl, br]) { c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.stroke(); }
  const sm = S.U * 0.042, inset = lw / 2 + sm * 0.75;
  S.path(c, [[tl[0][0], tl[0][1] + inset], [tl[1][0] + inset, tl[1][1] + inset], [tl[2][0] + inset, tl[2][1]]], false, sm, -S.mod(S.T * S.U * 0.2, S.UW(sm, true)), { heavy: true, alpha: 0.85, ealpha: 1 });
  S.path(c, [[br[0][0], br[0][1] - inset], [br[1][0] - inset, br[1][1] - inset], [br[2][0] - inset, br[2][1]]], false, sm, -S.mod(S.T * S.U * 0.2, S.UW(sm, true)), { heavy: true, alpha: 0.85, ealpha: 1, rot: Math.PI });
});
add('frame', 'underline', '太い下線と小さな歌詞の段', (c, S) => {
  const m = S.m, y = m.L.bottom + m.px * 0.28, th = m.px * 0.14;
  const a = ease(S.in(0.1, 0.45));
  c.fillStyle = S.pal.accent; c.globalAlpha = S.ga; c.fillRect(S.W * 0.04, y, S.W * 0.92 * a, th);
  c.strokeStyle = S.pal.fg; c.lineWidth = 1; c.globalAlpha = S.ga * (0.6 * a);
  line(c, S.W * 0.04, m.L.top - m.px * 0.3, S.W * (0.04 + 0.92 * a), m.L.top - m.px * 0.3);
  const sm = S.U * 0.03;
  for (let k = 0; k < 7; k++) {
    const yy = y + th + sm * (1.4 + k * 1.35);
    if (yy > S.H) break;
    S.tile(c, yy, sm, S.T * sm * 3 * (k % 2 ? 1 : -1) + k * 60, { left: S.W * 0.04, right: S.W * (0.04 + 0.92 * a), alpha: 0.75 * (1 - k / 8) * a, ealpha: a });
  }
  for (let k = 0; k < 6; k++) {
    const yy = m.L.top - m.px * 0.3 - sm * (0.5 + k * 1.35);
    if (yy < sm) break;
    S.tile(c, yy, sm, S.T * sm * 2 * (k % 2 ? -1 : 1) + k * 90, { left: S.W * 0.04, right: S.W * (0.04 + 0.92 * a), alpha: 0.4 * (1 - k / 7) * a, ealpha: 0.8 * a });
  }
});
add('frame', 'lattice', '斜めの格子の交点に文字', (c, S) => {
  const s = S.U * 0.17;
  c.translate(S.W / 2, S.H / 2); c.rotate(Math.PI / 4);
  const R = Math.hypot(S.W, S.H) / 2 + s;
  const off = S.mod(S.T * s * 0.4, s);
  c.strokeStyle = S.pal.fg; c.lineWidth = 1; c.globalAlpha = S.ga * (0.25 * S.inQ);
  for (let x = -R + off; x < R; x += s) { line(c, x, -R, x, R); line(c, -R, x, R, x); }
  const px = s * 0.3;
  c.font = S.font(px, true);
  let i = 0;
  for (let gy = -R + off; gy < R; gy += s) for (let gx = -R + off; gx < R; gx += s) {
    const idx = Math.round((gx - off) / s) * 7 + Math.round((gy - off) / s) * 3 + Math.floor(S.T * 2);
    const u = S.unit[S.mod(idx, S.unit.length)];
    const a = S.in(S.hash(i++, 2) * 0.5, 0.3);
    c.save(); c.translate(gx, gy); c.rotate(-Math.PI / 4);
    if (u.e) { c.globalAlpha = S.ga * (0.9 * a); c.strokeStyle = S.pal.accent; c.beginPath(); c.arc(0, 0, px * 0.85 * (1 + 0.25 * S.beatQ), 0, TAU); c.stroke(); }
    S.put(c, u, -S.cw(u.ch, px, true) / 2, px * 0.36, { alpha: 0.65 * a, ealpha: a });
    c.restore();
  }
});
add('frame', 'diagonals', '対角線で交差する', (c, S) => {
  const px = S.U * 0.06, a = ease(S.in(0, 0.5));
  for (const [x0, y0, x1, y1, dir] of [[0, 0, S.W, S.H, 1], [0, S.H, S.W, 0, -1]]) {
    const len = Math.hypot(x1 - x0, y1 - y0), ang = Math.atan2(y1 - y0, x1 - x0);
    c.save(); c.translate(x0, y0); c.rotate(ang);
    c.strokeStyle = S.pal.fg; c.lineWidth = 1; c.globalAlpha = S.ga * (0.6 * a);
    line(c, 0, -px * 1.0, len * a, -px * 1.0); line(c, 0, px * 0.45, len * a, px * 0.45);
    S.tile(c, px * 0.32, px, S.T * px * 3 * dir, { left: 0, right: len * a, heavy: true, mode: dir > 0 ? 'fill' : 'stroke', emode: 'fill', lw: 1, alpha: 0.8 * a, ealpha: a });
    const sm = px * 0.4;
    S.tile(c, -px * 1.25, sm, -S.T * sm * 6 * dir, { left: 0, right: len * a, alpha: 0.6 * a, ealpha: a });
    c.restore();
  }
});
