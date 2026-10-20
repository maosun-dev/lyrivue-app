// 台本係（雰囲気 S）：間奏の「流れる空間」。2026-10-20 持ち主が 55 点を付けた「立体の空間の見本」（app/space-check.js）と同じ見せ方：
// カメラはいつも同じ速さで、向きをなめらかに変えながら、いろいろな方向へ流れ続ける（曲がる向きへ少し傾く）。
// そのまわりに中抜きの立体を散らし、1〜2 小節ごとに 2D の模様（背景向き 1 枚＋真ん中にまとまる形 3〜6 個）を画面に重ねる。
// 後半は次の行のほうへ少しずつ向きを寄せ、間奏のあとは今までどおり次の行へ飛び込む。
// 持ち主「急に動いて静止じゃなくて、常に一定の速度で動いていろんな方向に移動するほうがいい」
import { dirOf } from './space.js';
import { VIEW_DIST } from './layout.js';
import { GEO_LIST } from '../shared/geo-list.js';
import { SOLID_LIST } from '../shared/solid-list.js';

const SPEED = 3.2;      // カメラが 1 秒に進む距離（いつも同じ速さ）
const DT = 0.1;         // カメラのキーの間隔（秒）
const RAMP = 0.8;       // 間奏の頭で、止まった所から同じ速さになるまでの秒数
const HOME_FROM = 0.35; // 間奏の進み（0〜1）がここから、次の行のほうへ向きを寄せ始める
const HOME_TO = 0.9;    // ここで、まっすぐ次の行のほうを向く
const FIX = 0.4;        // 寄せきれなかったずれを埋める、間奏の終わりの割合
const APPROACH = 2.6;   // 次の行を見る姿勢から、これだけ後ろの所を目指す（そこから次の行へ飛び込む。1.6 秒で着くと出だしが流れの速さに近い）
const PITCH_MAX = 0.75; // 上下の向きの上限
const BANK = 0.35;      // 曲がる速さ（yaw の 1 秒あたり）に掛けて、傾ける量にする
const SOLIDS_PER_SEC = 280 / 48; // 立体の数（見本と同じ密度）
const NEAR_RATE = 0.35; // 道のすぐそば（手前をかすめる）に置く割合
const KEEP_OUT = 1.8;   // 次の行の置き場所から、これより近くには置かない
// 置いた模様の出方（横切る slide は不自然なので使わない。2026-10-20 持ち主「動くと不自然なのがある」）
export const OVERLAY_MODES = ['steady', 'flash', 'strobe', 'pop', 'wipe', 'spin', 'glitch'];
const BG_GEOS = GEO_LIST.filter(g => !g[3]).map(g => g[0]);   // 背景向き（縁まで広がる形）
const SPOT_GEOS = GEO_LIST.filter(g => g[3]).map(g => g[0]);  // 真ん中にまとまる形（置ける）
const FALLBACK_BAR = 2; // 拍が分からないとき、区切る秒数
const EDGE = 0.6;       // 間奏の終わりからこれより近い所では区切らない

const round = v => Math.round(v * 1e4) / 1e4;
const smooth = (a, b, x) => { const u = Math.min(1, Math.max(0, (x - a) / (b - a))); return u * u * (3 - 2 * u); };
const wrap = a => Math.atan2(Math.sin(a), Math.cos(a)); // -π〜π に直す
const pick = (list, r) => list[Math.min(list.length - 1, Math.floor(r * list.length))];

// 向きの揺らぎ（見本の heading と同じ sin の和）。頭で 0 になるようにずらす
function wander(u, ph) {
  const y = s => 1.1 * Math.sin(s * 0.23 + ph[0]) + 0.5 * Math.sin(s * 0.61 + ph[1]);
  const p = s => 0.45 * Math.sin(s * 0.31 + ph[2]) + 0.2 * Math.sin(s * 0.77 + ph[3]);
  return { yaw: y(u) - y(0), pitch: p(u) - p(0) };
}

/**
 * 間奏の中のカメラの道すじ（DT ごとの姿勢）。base は間奏に入るときの姿勢、target は次の行を見る姿勢（無ければ null）。
 * @returns {{t:number,pos:number[],yaw:number,pitch:number,roll:number}[]}
 */
export function flowPath(g, base, target, rng) {
  const ph = [rng() * 6.28, rng() * 6.28, rng() * 6.28, rng() * 6.28];
  const len = g.to - g.from;
  const aim = target ? target.pos.map((v, q) => v - dirOf(target.yaw, target.pitch)[q] * APPROACH) : null;
  const out = [];
  let pos = [...base.pos], yaw = base.yaw, pitch = base.pitch;
  const n = Math.max(1, Math.round(len / DT));
  for (let i = 0; i <= n; i++) {
    const t = g.from + (len * i) / n, u = t - g.from;
    out.push({ t, pos: [...pos], yaw, pitch });
    if (i === n) break;
    const step = len / n;
    // 次の向き：揺らぎ ＋（後半は）次の行のほうへ寄せる
    const wv = wander(u + step, ph);
    let ny = base.yaw + wv.yaw, np = Math.max(-PITCH_MAX, Math.min(PITCH_MAX, base.pitch + wv.pitch));
    let speed = SPEED * smooth(0, RAMP, u + step / 2);
    if (aim) {
      const w = smooth(HOME_FROM, HOME_TO, (u + step) / len);
      const d = aim.map((v, q) => v - pos[q]), dist = Math.hypot(...d);
      if (w > 0 && dist > 1e-6) {
        const dy = Math.atan2(d[0], d[2]), dp = Math.atan2(d[1], Math.hypot(d[0], d[2]));
        ny += wrap(dy - ny) * w;
        np += (Math.max(-PITCH_MAX, Math.min(PITCH_MAX, dp)) - np) * w;
        // 残りの時間で着ける速さへ（速すぎ・遅すぎにはしない）
        const need = dist / Math.max(step, g.to - t);
        speed += (Math.min(SPEED * 2.2, Math.max(SPEED * 0.7, need)) - speed) * w;
      }
    }
    // 1 回の間隔で向きが変わりすぎないように
    yaw += Math.max(-0.12, Math.min(0.12, wrap(ny - yaw)));
    pitch += Math.max(-0.08, Math.min(0.08, np - pitch));
    const f = dirOf(yaw, pitch);
    pos = pos.map((v, q) => v + f[q] * speed * step);
  }
  // 寄せきれなかったずれは、最後の 4 割で少しずつ埋める（必ず次の行の手前に着く）
  if (aim) {
    const end = out.at(-1).pos, miss = aim.map((v, q) => v - end[q]);
    for (const p of out) { const w = smooth(1 - FIX, 1, (p.t - g.from) / len); p.pos = p.pos.map((v, q) => v + miss[q] * w); }
  }
  // 曲がる向きへ少し傾ける（飛行機のように）。頭と終わりは 0（入る前・次の行への飛び込みとつながるように）
  out.forEach((p, i) => {
    const a = out[Math.max(0, i - 1)], b = out[Math.min(out.length - 1, i + 1)];
    const turn = b.t > a.t ? (b.yaw - a.yaw) / (b.t - a.t) : 0;
    const env = Math.min(smooth(0, RAMP, p.t - g.from), smooth(0, 0.5, g.to - p.t));
    p.roll = -turn * BANK * env;
  });
  return out;
}

/** 道すじのまわりに立体を散らす（道のすぐそばにもいくつか＝手前をかすめていく）。keepOut（次の行の置き場所）のまわりには置かない */
export function scatterSolids(path, g, keepOut, rng) {
  const count = Math.round((g.to - g.from) * SOLIDS_PER_SEC);
  const objs = [];
  for (let k = 0; k < count; k++) {
    const near = rng() < NEAR_RATE;
    const ang = rng() * Math.PI * 2;
    const kind = pick(SOLID_LIST, rng());
    const big = kind === 'planet' || (kind === 'sphere' && rng() < 0.5);
    const size = big ? 0.6 + 1.1 * rng() : 0.18 + 0.45 * rng();
    // 大きな球・惑星は道から離す（すぐそばを通ると、輪が画面を覆ってしまう）
    const rad = Math.max(near ? 0.6 + 0.8 * rng() : 1.8 + 4 * rng(), big ? 1.2 + size * 2 : 0);
    const rot = { yaw: round(rng() * 6), pitch: round(rng() * 6), roll: round(rng() * 6) };
    const spin = [(rng() - 0.5) * 1.6, (rng() - 0.5) * 1.2, (rng() - 0.5) * 0.8].map(round);
    const color = rng() < 0.3 ? 'accent' : 'fg';
    // 道の点（少し先）と、その点での横・上の向き
    const P = path[Math.min(path.length - 1, Math.floor(((k + 0.5) / count) * path.length))];
    const f = dirOf(P.yaw, P.pitch), right = [Math.cos(P.yaw), 0, -Math.sin(P.yaw)];
    const up = [f[1] * right[2] - f[2] * right[1], f[2] * right[0] - f[0] * right[2], f[0] * right[1] - f[1] * right[0]];
    const pos = P.pos.map((v, q) => round(v + (right[q] * Math.cos(ang) + up[q] * Math.sin(ang)) * rad + f[q] * 1.5));
    if (keepOut && Math.hypot(...pos.map((v, q) => v - keepOut[q])) < KEEP_OUT + size) continue;
    objs.push({ kind, pos, size: round(size), rot, spin, color });
  }
  return objs;
}

/** 重ねる模様の区切り：小節の頭から 1〜2 小節ずつ。区切りごとに背景向き 1 枚と、置く形 3〜6 個 */
export function overlayLayers(g, beats, rng) {
  const marks = [g.from];
  if (beats.length >= 2) {
    let bi = beats.findIndex((b, i) => i % 4 === 0 && b > g.from + EDGE);
    while (bi >= 0 && bi < beats.length && beats[bi] < g.to - EDGE) { marks.push(beats[bi]); bi += rng() < 0.5 ? 4 : 8; }
  } else {
    for (let t = g.from + FALLBACK_BAR; t < g.to - EDGE; t += FALLBACK_BAR) marks.push(t);
  }
  let prevBg = null;
  return marks.map((from, k) => {
    let bg;
    do { bg = pick(BG_GEOS, rng()); } while (bg === prevBg && BG_GEOS.length > 1);
    prevBg = bg;
    const n = 3 + Math.floor(rng() * 4);
    const spots = [];
    for (let j = 0; j < n; j++) {
      const big = rng() < 0.25;
      spots.push({
        id: pick(SPOT_GEOS, rng()), x: round(0.1 + 0.8 * rng()), y: round(0.08 + 0.84 * rng()),
        size: round(big ? 0.6 + 0.4 * rng() : 0.18 + 0.3 * rng()), vx: round((rng() - 0.5) * 0.015), vy: round((rng() - 0.5) * 0.015),
        mode: pick(OVERLAY_MODES, rng()), key: Math.floor(rng() * 1e6), swap: rng() < 0.35, dir: rng() < 0.5 ? -1 : 1,
      });
    }
    const layer = { part: 'fx.overlay', kind: bg, from: round(from), to: round(marks[k + 1] ?? g.to), spots };
    if (rng() < 0.3) layer.swap = true;
    if (k === 0) layer.fadeIn = true;
    if (k === marks.length - 1) layer.fadeOut = true;
    return layer;
  });
}

/**
 * カメラのキー keys（写し）の、間奏 g の中を流れる道すじで作り直す。base は間奏に入るときの姿勢。
 * 次の行（g.to のあとに最初に着くキー）があれば、後半はそのほうへ寄せ、間奏のあとの待機キーは道の続きに直す
 * （間奏のあとの「切り替え」キーは除く：流れたまま次の行へ飛び込む）。
 * @returns {{path:object[], keepOut:number[]|null}} keepOut は次の行の置き場所（立体を置かない所）
 */
export function flowCamera(keys, g, base, nextStart, rng) {
  const inside = keys.filter(k => k.t >= g.from - 1e-6 && k.t <= g.to + 1e-6);
  for (const k of inside) keys.splice(keys.indexOf(k), 1);
  const arrival = Number.isFinite(nextStart) ? (keys.find(k => Number.isFinite(k.cue) && Math.abs(k.cue - nextStart) < 1e-6) ?? keys.find(k => k.t >= nextStart - 0.06)) : null;
  const target = arrival ? { pos: arrival.pos, yaw: arrival.yaw ?? 0, pitch: arrival.pitch ?? 0 } : null;
  const path = flowPath(g, base, target, rng);
  let at = keys.findIndex(k => k.t > g.to);
  if (at < 0) at = keys.length;
  keys.splice(at, 0, ...path.map(p => ({ t: round(p.t), pos: p.pos.map(round), roll: round(p.roll), yaw: round(p.yaw), pitch: round(p.pitch), zoom: 1, ease: 'linear' })));
  // 間奏のあと、次の行に着くまで：あいだのキー（待機・切り替え・中継点）を除き、流れの勢いのまま飛び込んでぴたっと止まる（outCubic）。
  // 次の行が場面の最初の行だと「切り替え」で着く決まりだが、間奏のあとは切り替えず飛び込む（止まって見えないように）
  if (arrival) {
    for (let i = at + path.length; i < keys.length && keys[i] !== arrival;) keys.splice(i, 1);
    arrival.ease = 'outCubic';
    delete arrival.via; delete arrival.sharp;
    arrival.shot = 'flow';
  }
  const keepOut = target ? target.pos.map((v, q) => v + dirOf(target.yaw, target.pitch)[q] * VIEW_DIST) : null;
  return { path, keepOut };
}
