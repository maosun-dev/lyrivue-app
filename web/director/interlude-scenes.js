// 台本係（雰囲気 S）：間奏の場面展開。2026-10-20 持ち主が立体の空間の見本（app/space-check.js Version 8）で「とりあえずこれでいこう」と OK した形を本編の間奏へ。
// 間奏を 4 小節ごとの場面に分け（director/scenes.js の scenePlan。強い一打は本編の解析にまだ無いので 4 小節の区切りだけ）、
// 場面ごとに カット（カメラを道すじから横・上下へずらし向きを変える）・場面の種類（宇宙・光の輪のトンネル・枠の通路・平面の模様）・
// 配色（世界の色から 黒地 → 色地 → 白地）・寄りと引き を変える。
// 間奏の長さと、最後に次の行の手前へ滑り込む着き方は変えない（最後の場面は、終わりへ向けてずらしを 0 に戻す）。
import { scenePlan } from './scenes.js';
import { dirOf } from './space.js';

const FALLBACK_BAR = 2; // 拍が分からないときの 1 小節の秒数
const EPS = 0.001;      // カットの直前のキーを置く、カットの時刻からの差（秒）
const BACK = 0.6;       // 最後の場面で、ずらしを戻し始める所（場面の中の割合）

const round = v => Math.round(v * 1e4) / 1e4;
const smooth = (a, b, x) => { const u = Math.min(1, Math.max(0, (x - a) / (b - a))); return u * u * (3 - 2 * u); };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

/** 拍の列から 1 小節の秒数（拍の間隔のまん中の値 × 4） */
function barOf(beats) {
  if (beats.length < 2) return FALLBACK_BAR;
  const d = beats.slice(1).map((b, i) => b - beats[i]).filter(x => x > 0).sort((x, y) => x - y);
  return d.length ? d[Math.floor(d.length / 2)] * 4 : FALLBACK_BAR;
}

/**
 * 間奏 [from, to) の場面の区切り。4 小節ごとに切り、切れ目はいちばん近い小節の頭（拍の 4 つごと）にそろえる。
 * @returns {{from:number, to:number, kind:string, tone:string, frame:'wide'|'close', seed:number}[]}
 */
export function interludeCuts(from, to, beats, seed) {
  if (!(to - from > 0)) return [];
  const bs = (Array.isArray(beats) ? beats : []).filter(Number.isFinite);
  const bar = barOf(bs);
  const heads = bs.filter((_, i) => i % 4 === 0);
  const plan = scenePlan({ duration: to - from, bar, seed }).map(p => ({ ...p, from: from + p.from, to: from + p.to }));
  for (let i = 1; i < plan.length; i++) {
    const c = plan[i].from;
    const h = heads.reduce((best, x) => (Math.abs(x - c) < Math.abs(best - c) ? x : best), Infinity);
    // そろえても、前の切れ目から 1 小節・終わりまで 1 小節はあける（あかなければそろえない）
    const at = Number.isFinite(h) && Math.abs(h - c) <= bar / 2 && h > plan[i - 1].from + bar - 1e-6 && h < to - bar + 1e-6 ? h : c;
    plan[i].from = plan[i - 1].to = round(at);
  }
  plan[0].from = round(from);
  plan.at(-1).to = round(to);
  return plan;
}

// 色の明るさ（0〜255）・混ぜる・暗くする
const rgb = h => { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
const hex = c => '#' + c.map(v => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('');
const lum = h => { const [r, g, b] = rgb(h); return (r * 299 + g * 587 + b * 114) / 1000; };
const mix = (a, b, k) => { const x = rgb(a), y = rgb(b); return hex(x.map((v, q) => v + (y[q] - v) * k)); };
const HEX6 = /^#[0-9a-f]{6}$/i;
const ok = (h, d) => (HEX6.test(String(h ?? '')) ? h : d);
const PAPER = '#F2F1EC', NIGHT = '#0B0820', CREAM = '#FFF7EC';

/**
 * 世界の配色 base から、場面の配色を作る（見本の inkOf と同じ考え方）。
 * dark＝黒地（世界の地が明るければ夜の色を借りる）・color＝世界の目立たせる色の地に明るい線・light＝白地に暗い線
 * @returns {{bg:string, fg:string, line:string, accent:string, light:boolean}}
 */
export function toneInk(base, tone) {
  const b = { bg: ok(base?.bg, '#000000'), fg: ok(base?.fg, '#F4F4F4'), line: ok(base?.line, '#8C8C8C'), accent: ok(base?.accent, '#7FD1FF') };
  const dark = lum(b.bg) > 150 ? NIGHT : lum(b.bg) >= 80 ? mix(b.bg, '#000000', 0.6) : b.bg;
  const onDark = lum(b.fg) > 150 ? b.fg : '#D9E4FF';
  if (tone === 'color') {
    const c = [b.accent, b.line].find(x => lum(x) >= 50 && lum(x) <= 190) ?? mix(b.accent, dark, 0.5);
    const light = lum(c) > 150;
    const fg = light ? dark : CREAM;
    return { bg: c, fg, line: fg, accent: light ? mix(dark, c, 0.3) : dark, light };
  }
  if (tone === 'light') {
    const accent = [b.accent, b.line].find(x => lum(x) < 190) ?? dark;
    return { bg: PAPER, fg: dark, line: mix(dark, PAPER, 0.4), accent, light: true };
  }
  return { bg: dark, fg: onDark, line: lum(b.line) > 90 ? b.line : onDark, accent: b.accent, light: false };
}

/**
 * 場面 i のカメラのずらし方（見本の sc.shot）。最初の場面はずらさない（前の行から流れたまま入る）。
 * 宇宙は道すじから横・上下へ離れて斜め・横向きに見る。トンネル・通路・平面は道の真ん中からほんの少しだけ向きを変える（トンネルは回る）。
 * 中を進む場面は寄り（1.6 倍）だと向きのずれが大きく見え、輪や枠の列が画面の端へ寄るので、見本より小さくした
 */
export function sceneShot(sc, i, rng) {
  if (i === 0) return null;
  const sgn = () => (rng() < 0.5 ? -1 : 1);
  const space = sc.kind === 'space';
  return {
    off: space ? [sgn() * (0.8 + 1.4 * rng()), sgn() * 1.2 * rng()] : [0, 0],
    dyaw: space ? sgn() * (0.3 + 0.6 * rng()) : (rng() - 0.5) * 0.1,
    dpitch: space ? (rng() - 0.5) * 0.6 : (rng() - 0.5) * 0.06,
    droll: space ? (rng() - 0.5) : 0,
    spin: sc.kind === 'tunnel' ? sgn() * (0.25 + 0.3 * rng()) : 0,
    zoom: sc.frame === 'close' ? 1.6 : 0.8, // 寄り（大写し）と引き（全体）
  };
}

// 道すじ（DT ごとの姿勢）の時刻 t の姿勢（前後の点の間をまっすぐつなぐ）
function poseAt(path, t) {
  let i = 0;
  while (i + 1 < path.length - 1 && path[i + 1].t <= t) i++;
  const a = path[i], b = path[Math.min(path.length - 1, i + 1)];
  const f = b.t > a.t ? Math.min(1, Math.max(0, (t - a.t) / (b.t - a.t))) : 0;
  const L = (x, y) => x + (y - x) * f;
  return { pos: a.pos.map((v, q) => L(v, b.pos[q])), yaw: L(a.yaw, b.yaw), pitch: L(a.pitch, b.pitch), roll: L(a.roll ?? 0, b.roll ?? 0) };
}

// 姿勢 p にずらし sh を w の強さで掛けたカメラのキー（el は場面に入ってからの秒数）
function shifted(p, sh, w, el, t, ease) {
  const f = dirOf(p.yaw, p.pitch), right = [Math.cos(p.yaw), 0, -Math.sin(p.yaw)], up = cross(f, right);
  const k = sh && w > 0 ? w : 0;
  const s = sh ?? { off: [0, 0], dyaw: 0, dpitch: 0, droll: 0, spin: 0, zoom: 1 };
  return {
    t: round(t), pos: p.pos.map((v, q) => round(v + (right[q] * s.off[0] + up[q] * s.off[1]) * k)),
    yaw: round(p.yaw + s.dyaw * k), pitch: round(p.pitch + s.dpitch * k), roll: round(p.roll + (s.droll + s.spin * el) * k),
    zoom: round(s.zoom ** k), ease,
  };
}

/**
 * カメラのキー keys のうち、間奏の流れる道すじ（path。flowCamera が入れたキー）に、場面ごとのずらしを掛ける。
 * カットの時刻には「直前の姿勢」と「切り替えた姿勢（ease 'cut'＝一瞬で変わる）」の 2 つのキーを置く。
 * flowEnd（道すじの終わり＝次の行へ飛び込み始める時刻）までに、最後の場面のずらしは 0 に戻る。
 */
export function applyShots(keys, path, plan, shots, flowEnd) {
  if (!path.length || plan.length < 2) return;
  const n = plan.length;
  const weight = (i, t) => (i < n - 1 ? 1 : 1 - smooth(plan[i].from + (flowEnd - plan[i].from) * BACK, flowEnd, t));
  const idxAt = t => { let i = 0; while (i + 1 < n && plan[i + 1].from <= t + 1e-9) i++; return i; };
  const from = path[0].t, to = path.at(-1).t;
  for (let j = 0; j < keys.length; j++) {
    const k = keys[j];
    if (!(k.t >= from - 1e-6 && k.t <= to + 1e-6)) continue;
    const i = idxAt(k.t);
    if (!shots[i]) continue;
    keys[j] = shifted(poseAt(path, k.t), shots[i], weight(i, k.t), k.t - plan[i].from, k.t, k.ease ?? 'linear');
  }
  for (let i = 1; i < n; i++) {
    const c = plan[i].from;
    if (!(c > from && c < to)) continue;
    for (let j = keys.length - 1; j >= 0; j--) if (Math.abs(keys[j].t - c) < EPS * 1.5) keys.splice(j, 1);
    const before = shifted(poseAt(path, c - EPS), shots[i - 1], weight(i - 1, c - EPS), c - EPS - plan[i - 1].from, c - EPS, 'linear');
    const after = shifted(poseAt(path, c), shots[i], weight(i, c), 0, c, 'cut');
    let at = keys.findIndex(k => k.t > c);
    if (at < 0) at = keys.length;
    keys.splice(at, 0, before, after);
  }
}

/**
 * 道すじ（DT ごとの姿勢）を進んだ道のりの表 [[時刻, 道のり], …]（every 秒ごと＋最後）。光の輪・通路の枠が近づいてくる量に使う。
 * 輪や枠は道すじに沿って置かず、描く係がカメラの前にまっすぐ並べる（間奏の後半は次の行へ向かって道すじが曲がるので、
 * 道に沿って置くと列がカメラの前から外れて画面の端へ流れた）。
 */
export function trackOf(path, every = 0.5) {
  const out = [];
  if (!Array.isArray(path) || !path.length) return out;
  let d = 0, last = -Infinity;
  path.forEach((p, i) => {
    if (i > 0) d += Math.hypot(...p.pos.map((v, q) => v - path[i - 1].pos[q]));
    if (p.t - last >= every - 1e-9 || i === path.length - 1) { out.push([round(p.t), round(d)]); last = p.t; }
  });
  return out;
}
