// 直すもの：持ち主が止めた画面で選んだ行を、その行だけ書き換える（設計：docs/superpowers/specs/2026-10-19-line-edits-design.md）。
// edits = { lines: { [行の番号]: { text, emph?, cam?, size?, tilt?, variant? } } }
//   text：直したときの歌詞（今の歌詞と違えば効かせない）。emph：[はじめ, 長さ]（文字の番号。Array.from で数える）か 'none'。
//   cam：カメラの来かた（CAMS）。size：大きさの倍率（SIZES）。tilt：板の傾き（TILTS）。variant：この行だけもう一案の番号（1〜）
//   place：ここから場所を変える（director/places.js の PLACE_KINDS。台本を作る前に区切りを作り直す）
// 台本を作り終えたあとに書き換えるので、ほかの行の置き場所・カメラ・演出、乱数を引く順は変わらない。効くのは S の場面の行だけ。
import { PLACE_KINDS } from './places.js';
import { makeRng } from './rng.js';
import { viewPose, dirOf, stayWindow, placeProps, arriveIndexOf } from './space.js';
import { VIEW_DIST } from './layout.js';
import { weighted, enterWeights, lookWeights, holdWeights, fontWeights, setWeights, exitWeights, kimeWeights, floodRate, floodWeights, vesselRate, pickVessels, isLatinLine, FONTS } from './effects.js';
import { FLOODS } from '../render/parts/flood.js';
import { resolveTuning } from '../shared/tuning.js';

export const CAMS = {
  auto: 'おまかせ', left: '左から', right: '右から', up: '上から', down: '下から',
  straight: 'まっすぐ寄る', wide: '引いて見る', cruise: '前進', dive: 'くぐり抜け', warp: 'ワープ',
};
export const TILTS = {
  auto: 'おまかせ', front: '正面', left: '左へ向く', right: '右へ向く', up: '上を向く', down: '下を向く',
  rollL: '左に回す', rollR: '右に回す', slant: '大きく斜め', lay: '寝かせる',
};
// 板の向き。名前は「文字の面が画面のどちらを向くか」。板の yaw が正だと右の端が手前に来て面は画面の左を向く（設計書の表と左右が逆）。
// 板の pitch はカメラと符号が逆（負で上を向く＝上の端が奥へ倒れる）
export const TILT_ROT = {
  front: { yaw: 0, pitch: 0, roll: 0 }, left: { yaw: 0.6, pitch: 0, roll: 0 }, right: { yaw: -0.6, pitch: 0, roll: 0 },
  up: { yaw: 0, pitch: -0.45, roll: 0 }, down: { yaw: 0, pitch: 0.45, roll: 0 },
  rollL: { yaw: 0, pitch: 0, roll: -0.35 }, rollR: { yaw: 0, pitch: 0, roll: 0.35 },
  slant: { yaw: 0.7, pitch: 0.3, roll: 0.3 }, lay: { yaw: 0, pitch: -0.95, roll: 0 },
};
export const SIZES = [[0.55, 'かなり小さく'], [0.75, '小さく'], [1, 'そのまま'], [1.35, '大きく'], [1.8, 'かなり大きく']];
const SIZE_RANGE = [0.55, 1.8];
const MOVE_MAX = 0.8; // 位置：画面の上でずらす量の上限（画面の中心から端までを 1）
const ROLL_MAX = 1.2; // 回転：足す回転の上限（ラジアン）

const CAM_PICKS = Object.keys(CAMS).filter(k => k !== 'auto');   // もう一案で選ぶ来かた（9種）
const TILT_PICKS = Object.keys(TILTS).filter(k => k !== 'auto'); // もう一案で選ぶ傾き（9種）
const TEXT_ATTRS = ['enter', 'look', 'hold', 'font', 'set'];

const SIDE_SHIFT = 0.9;   // 左右上下から：中継点を横（縦）へずらす距離
const SIDE_BACK = 0.4;    // 左右上下から：中継点を後ろへ引く距離
const WIDE_EXTRA = 2.6;   // 引いて見る：行を見る距離からさらに引く距離
const DIVE_SIDE = 0.12;   // くぐり抜け：前の行の原点から横へずらして通る距離
const DIVE_AT = 0.42;     // くぐり抜け：くぐる瞬間は到着の travel×これ 秒前
const DIVE_YAW = 0.6;
const DIVE_PITCH = 0.35;
const WARP_DIST = 30;     // ワープ：到着の姿勢からこれだけ後ろへ切り替えてから飛ぶ
const WARP_SECONDS = 0.9;

const clamp01 = x => (Number.isFinite(x) ? Math.min(1, Math.max(0, x)) : 0.5);
const isLine = l => l && l.part === 'text.motion' && Number.isInteger(l.line);

/** 壊れた直しを整える（知らない値の項目は落とす。直した項目が1つも無い行は落とす） */
export function normalizeEdits(edits) {
  const out = { lines: {} };
  const src = edits && typeof edits === 'object' && edits.lines && typeof edits.lines === 'object' ? edits.lines : {};
  for (const [key, e] of Object.entries(src)) {
    if (!/^(0|[1-9]\d*)$/.test(key) || !e || typeof e !== 'object' || typeof e.text !== 'string') continue;
    const c = { text: e.text };
    if (e.emph === 'none') c.emph = 'none';
    else if (Array.isArray(e.emph) && e.emph.length === 2 && Number.isInteger(e.emph[0]) && Number.isInteger(e.emph[1]) && e.emph[0] >= 0 && e.emph[1] >= 1) c.emph = [e.emph[0], e.emph[1]];
    if (typeof e.cam === 'string' && e.cam in CAMS && e.cam !== 'auto') c.cam = e.cam;
    if (Number.isFinite(e.size)) c.size = Math.min(SIZE_RANGE[1], Math.max(SIZE_RANGE[0], e.size));
    if (typeof e.tilt === 'string' && e.tilt in TILT_ROT) c.tilt = e.tilt;
    if (Number.isInteger(e.variant) && e.variant >= 1) c.variant = e.variant;
    if (Array.isArray(e.move) && e.move.length === 2 && e.move.every(Number.isFinite) && e.move.some(v => Math.abs(v) > 1e-6)) {
      c.move = e.move.map(v => Math.min(MOVE_MAX, Math.max(-MOVE_MAX, v)));
    }
    if (Number.isFinite(e.roll) && Math.abs(e.roll) > 1e-6) c.roll = Math.min(ROLL_MAX, Math.max(-ROLL_MAX, e.roll));
    if (typeof e.place === 'string' && e.place in PLACE_KINDS) c.place = e.place; // ここから場所を変える（director/places.js）
    if (Object.keys(c).length > 1) out.lines[key] = c;
  }
  return out;
}

/** ここから場所を変えるの種類の名前（画面に出す名前） */
export const PLACE_NAMES = { verse: 'A メロ', bridge: 'つなぎ', chorus: 'サビ', outro: '終わり', none: '変えない' };

/** 直した項目の日本語の名前 */
export function describeEdit(e) {
  const out = [];
  if (!e) return out;
  if (e.emph === 'none') out.push('強調：なし');
  else if (Array.isArray(e.emph)) out.push(`強調：${e.emph[0] + 1}文字目から${e.emph[1]}文字`);
  if (e.cam) out.push(`来かた：${CAMS[e.cam] ?? e.cam}`);
  if (Number.isFinite(e.size)) out.push(`大きさ：${SIZES.find(s => s[0] === e.size)?.[1] ?? `${+e.size.toFixed(2)}倍`}`);
  if (e.tilt) out.push(`傾き：${TILTS[e.tilt] ?? e.tilt}`);
  if (Array.isArray(e.move)) out.push('位置：ずらした');
  if (Number.isFinite(e.roll)) out.push(`回転：${e.roll > 0 ? '右へ' : '左へ'}${Math.round(Math.abs(e.roll) * 180 / Math.PI)}°`);
  if (e.variant) out.push(`もう一案：案${e.variant + 1}`);
  if (e.place) out.push(e.place === 'none' ? '場所：ここでは変えない' : `場所：ここから${PLACE_NAMES[e.place]}`);
  return out;
}

/**
 * 台本の直した行だけを書き換えた新しい台本を返す（元の台本は変えない。効く直しが無ければ同じものを返す）
 * @param {import('./types.js').Script} script
 * @param {{lines?:Object}} edits
 * @param {import('../analyze/types.js').AnalysisResult} analysis 歌詞の照合に使う
 * @param {{fonts?:string[], vessels?:boolean, exits?:boolean}} [opts] fonts はもう一案で使ってよい書体（無い・空なら全部）。vessels が true のときだけ、もう一案で文字を載せる器も選ぶ
 */
export function applyEdits(script, edits, analysis, opts) {
  const lines = analysis?.lines;
  if (!script || !Array.isArray(script.scenes) || !Array.isArray(lines)) return script;
  const n = normalizeEdits(edits);
  // 直す行（S の場面にあって、歌詞が今のものと同じ）。時刻の順に直す
  const where = new Map();
  script.scenes.forEach((s, si) => {
    if (s?.mood !== 'S' || !Array.isArray(s.layers)) return;
    s.layers.forEach((l, li) => { if (isLine(l) && !where.has(l.line)) where.set(l.line, [si, li]); });
  });
  const todo = Object.entries(n.lines).map(([k, e]) => [Number(k), e])
    .filter(([i, e]) => where.has(i) && i < lines.length && String(lines[i]?.text ?? '') === e.text)
    .sort((x, y) => x[0] - y[0]);
  if (!todo.length) return script;

  const scenes = script.scenes.map(s => (s && Array.isArray(s.layers) ? { ...s, layers: [...s.layers] } : s));
  const keys = Array.isArray(script.camera?.keys) ? script.camera.keys.map(k => ({ ...k, pos: [...k.pos] })) : [];
  const tune = resolveTuning(script.tuning);
  const layerAt = i => { const w = where.get(i); return w ? scenes[w[0]].layers[w[1]] : null; };
  const moved = new Set(); // カメラを作り直した行
  const shifted = new Map(); // 位置をずらした行 → 画面の上でずらす量

  for (const [i, e] of todo) {
    const [si, li] = where.get(i);
    const scene = scenes[si];
    const layer = { ...scene.layers[li] };
    scene.layers[li] = layer;
    const text = String(lines[i]?.text ?? '');
    const count = Array.from(text).length;
    if (e.emph === 'none') delete layer.emph;
    else if (Array.isArray(e.emph) && e.emph[0] + e.emph[1] <= count) layer.emph = [...e.emph];
    const pick = e.variant ? variantOf(i, e.variant, scene, !!layer.emph, count, opts?.fonts, isLatinLine(text), opts?.vessels === true, opts?.exits === true) : {};
    for (const attr of TEXT_ATTRS) if (pick[attr]) layer[attr] = pick[attr];
    // 消え方・キメ・歌詞で埋める組み：「なし」が選ばれたら外す（キメは強調語のある行だけ。埋める組みは敷き詰めの組みの行には入れない）
    for (const attr of ['exit', 'kime', 'flood']) {
      if (!pick[attr]) continue;
      if (pick[attr] === 'none' || (attr === 'kime' && !layer.emph) || (attr === 'flood' && layer.set === 'fill')) delete layer[attr]; else layer[attr] = pick[attr];
    }
    // 文字を載せる器：埋める組み・敷き詰めの組みの行には入れない
    if (pick.vessels) {
      if (pick.vessels === 'none' || layer.flood || layer.set === 'fill') delete layer.vessels; else layer.vessels = [...pick.vessels];
    }
    if (Number.isFinite(e.size)) {
      layer.sizeMul = (layer.sizeMul > 0 && Number.isFinite(layer.sizeMul) ? layer.sizeMul : 1) * e.size;
      layer.sizeLock = true; // 持ち主が決めた大きさ：描く係が大きさの下限で大きくしない
    }
    const tilt = e.tilt ?? pick.tilt;
    if (tilt && layer.rot) layer.rot = { ...TILT_ROT[tilt] };
    if (Number.isFinite(e.roll) && layer.rot) layer.rot = { ...layer.rot, roll: Math.min(ROLL_MAX, Math.max(-ROLL_MAX, (layer.rot.roll ?? 0) + e.roll)) };
    // 位置：画面の上でずらす（描く係が映したあとに足す。カメラがどう動いても、指で置いた所に見える）
    if (Array.isArray(e.move)) { layer.shift = [...e.move]; shifted.set(i, e.move); }
    const cam = e.cam ?? pick.cam;
    if (cam && Array.isArray(layer.sing) && Array.isArray(layer.pos)) {
      // 前の行が別の場面なら、場面の頭（くぐり抜けは前の場面の行を通らない）
      const prev = layerAt(i - 1);
      const sameScene = where.get(i - 1)?.[0] === si;
      const ok = recamera(keys, cam, {
        start: layer.sing[0], pos: layer.pos, intensity: scene.intensity, first: i === 0,
        prevStart: prev?.sing?.[0], prevPos: sameScene ? prev?.pos : null, sceneHead: !sameScene,
      }, tune);
      if (ok) moved.add(i);
    }
  }

  if (moved.size || shifted.size) {
    // 寄っている間（stay）を作り直したキーで書き直す（直していない行は、キーが同じなので元と同じ値になる）
    scenes.forEach(s => {
      if (s?.mood !== 'S' || !Array.isArray(s.layers)) return;
      s.layers = s.layers.map(l => {
        if (isLine(l) && Array.isArray(l.sing) && Array.isArray(l.stay)) {
          const stay = stayWindow(keys, l.sing[0], l.sing[1]);
          return stay[0] === l.stay[0] && stay[1] === l.stay[1] ? l : { ...l, stay };
        }
        if (l?.part === 'fx.prop' && (moved.has(l.line) || shifted.has(l.line)) && Array.isArray(l.off)) {
          // 連想の小物は、新しい到着の姿勢から見て行の横・後ろに置き直し、行をずらしたら画面の上で一緒にずらす
          const owner = layerAt(l.line);
          const copy = { ...l };
          if (owner && moved.has(l.line)) placeProps([copy], keys, [{ i: l.line, l: { start: owner.sing[0] } }], [{ pos: owner.pos }]);
          const d = shifted.get(l.line);
          if (d) copy.shift = [...d];
          return copy;
        }
        return l;
      });
    });
  }
  return { ...script, scenes, ...(script.camera ? { camera: { ...script.camera, keys } } : {}) };
}

// この行だけもう一案：行の番号と案の番号だけで決まる乱数（種に関係しない＝全体のもう一案のあとも同じ案）
function variantOf(i, v, scene, emph, count, fonts, latin, vesselsOn, exitsOn) {
  const rng = makeRng(i * 7907 + v * 104723 + 31);
  const I = clamp01(scene?.intensity);
  const allowed = FONTS.filter(f => Array.isArray(fonts) && fonts.includes(f));
  const fw = fontWeights(I);
  if (allowed.length) for (const k of FONTS) if (!allowed.includes(k)) fw[k] = 0;
  // 世界の書体の好みは掛けない：世界は全体の案（種）で変わるので、掛けると全体のもう一案のあとに同じ案にならない
  return {
    enter: weighted(rng, enterWeights(I)),
    look: weighted(rng, lookWeights(I, emph)),
    hold: weighted(rng, holdWeights(I)),
    font: weighted(rng, fw),
    set: weighted(rng, setWeights(I, emph, count, latin)),
    cam: CAM_PICKS[Math.min(CAM_PICKS.length - 1, Math.floor(rng() * CAM_PICKS.length))],
    tilt: TILT_PICKS[Math.min(TILT_PICKS.length - 1, Math.floor(rng() * TILT_PICKS.length))],
    // 2026-10-18 に足した（上の選びのあとに引くので、前からある選びは変わらない）
    exit: weighted(rng, exitWeights(I, exitsOn)), // 消え方は初期オフ（乱数は同じく 1 回）
    kime: weighted(rng, kimeWeights(I, emph)),
    // 2026-10-18 に足した歌詞で埋める組み（入れるかどうかと、どれにするか）
    flood: rng() < floodRate(I, emph) ? weighted(rng, floodWeights(I)) : 'none', // 2026-10-19 持ち主の選び直しに合わせる（乱数は同じく 1 回）
    // 2026-10-19 に足した文字を載せる器（入れるかどうかと、どの 3 つにするか。乱数は同じ数だけ引く）
    vessels: (() => { const on = rng() < vesselRate(I); const v = pickVessels(rng); return on && vesselsOn ? v : 'none'; })(),
  };
}

// 到着キー（space.js の stayWindow と同じ見つけ方）。after より後ろの番号のキーだけから探す
const arriveIndex = arriveIndexOf;

const poseOf = k => ({ pos: [...k.pos], yaw: k.yaw ?? 0, pitch: k.pitch ?? 0, roll: k.roll ?? 0, zoom: k.zoom ?? 1 });

/**
 * その行の到着キーまでのカメラのキーを、来かた kind で作り直す（keys をその場で書き換える）。
 * 範囲：前の行の到着キー（whip の回転を戻すキーも含む）のあと〜この行の到着キー。範囲に場面の頭の切り替え（cut）があれば、
 * そこまでは残す。到着の時刻は変えない。到着のあと、次の行へ動き出す待機キーを新しい到着の姿勢から置き直す。
 * @returns {boolean} 作り直せたら true
 */
function recamera(keys, kind, { start, pos, intensity, first, prevStart, prevPos, sceneHead }, tune) {
  if (!pos.every?.(Number.isFinite)) return false;
  // 前の行の到着を先に見つけ、その後ろからこの行の到着を探す（歌い出しが前の行とほぼ同じでも取り違えない）。
  // 前の行の到着が見つからないのに曲の最初の行でもなければ、作り直さない（曲の頭からのキーを消さないように）
  const pa = first ? -1 : arriveIndex(keys, prevStart);
  if (!first && pa < 0) return false;
  const ai = arriveIndex(keys, start, pa);
  if (ai < 1) return false;
  // 場面の頭で切り替わる到着（場面の頭と歌い出しが同じとき）は、そのまま残す
  if (sceneHead && !first && keys[ai].ease === 'cut') return false;
  let from = pa >= 0 ? pa + 1 : 1;
  while (from < ai && keys[from].ease === 'outCubic' && !keys[from].via) from++;
  for (let k = ai - 1; k >= from; k--) if (keys[k].ease === 'cut') { from = k + 1; break; }
  const P = poseOf(keys[from - 1]);
  const T0 = keys[from - 1].t;
  const A = keys[ai].t;
  const V0 = { ...poseOf(keys[ai]), roll: 0, zoom: 1 };
  const nk = [];
  let last = T0;
  const add = (t, pose, ease, extra, force) => {
    if (!force && !(t > last + 0.002 && t < A)) return;
    nk.push({ t, pos: [...pose.pos], roll: pose.roll ?? 0, yaw: pose.yaw ?? 0, pitch: pose.pitch ?? 0, zoom: pose.zoom ?? 1, ease, ...extra });
    last = t;
  };
  const drifted = Q => { const d = dirOf(Q.yaw, Q.pitch); return { ...Q, pos: Q.pos.map((v, q) => v + d[q] * tune.drift) }; };
  const hold = extra => add(A - tune.travel, drifted(P), 'linear', extra);
  const sharp = 2 + tune.snap * (0.5 + clamp01(intensity));
  const f = dirOf(V0.yaw, V0.pitch);
  let arrival = V0;
  let k = kind;
  if (k === 'dive' && !(Array.isArray(prevPos) && prevPos.every(Number.isFinite))) k = 'straight';
  if (k === 'left' || k === 'right' || k === 'up' || k === 'down') {
    // その側（到着の姿勢から見た右・下の向き）へずらし、少し引いた中継点を通って、勢いよく着く
    const r = [Math.cos(V0.yaw), 0, -Math.sin(V0.yaw)];
    const d = [f[1] * r[2], f[2] * r[0] - f[0] * r[2], -f[1] * r[0]];
    const side = k === 'left' ? r.map(x => -x) : k === 'right' ? r : k === 'up' ? d.map(x => -x) : d;
    hold();
    add(A - tune.travel * 0.55, { ...V0, pos: V0.pos.map((v, q) => v + side[q] * SIDE_SHIFT - f[q] * SIDE_BACK) }, 'inOutCubic', { via: true });
    add(A, V0, 'rush', { sharp }, true);
  } else if (k === 'straight') {
    hold();
    arrival = viewPose(pos, 0, 0, 0, VIEW_DIST);
    add(A, arrival, 'rush', { sharp }, true);
  } else if (k === 'wide') {
    hold();
    arrival = viewPose(pos, V0.yaw, V0.pitch, 0, VIEW_DIST + WIDE_EXTRA);
    add(A, arrival, 'outExpo', undefined, true);
  } else if (k === 'cruise') {
    hold({ via: true });
    add(A, V0, 'linear', { shot: 'cruise', via: true }, true);
  } else if (k === 'dive') {
    const dv = [pos[0] - prevPos[0], pos[1] - prevPos[1], pos[2] - prevPos[2]];
    const yaw = Math.max(-DIVE_YAW, Math.min(DIVE_YAW, Math.atan2(dv[0], dv[2])));
    const pitch = Math.max(-DIVE_PITCH, Math.min(DIVE_PITCH, Math.atan2(dv[1], Math.hypot(dv[0], dv[2]))));
    arrival = viewPose(pos, yaw, pitch, 0, VIEW_DIST);
    hold();
    add(A - tune.travel * DIVE_AT, { pos: [prevPos[0] + DIVE_SIDE, prevPos[1] + DIVE_SIDE * 0.4, prevPos[2] + 0.05], yaw: (P.yaw + yaw) / 2, pitch: (P.pitch + pitch) / 2, roll: 0, zoom: 1 }, 'linear', { shot: 'dive', via: true });
    add(A, arrival, 'rush', { shot: 'dive', sharp: 2 }, true);
  } else if (k === 'warp') {
    // 到着の少し前に、到着の姿勢から遠く後ろへ切り替え、一気に着く
    if (tune.travel > WARP_SECONDS) hold();
    add(A - WARP_SECONDS, { ...V0, pos: V0.pos.map((v, q) => v - f[q] * WARP_DIST) }, 'cut');
    add(A, V0, 'rush', { shot: 'warp', sharp: 2.2 }, true);
  } else return false;
  if (Number.isFinite(keys[ai].cue)) nk[nk.length - 1].cue = keys[ai].cue; // 作り直した到着キーにも歌い出しの時刻を残す
  keys.splice(from, ai + 1 - from, ...nk);
  // 到着のあと：元の whip の回転を戻すキーを消し、次の行へ動き出す待機キーを新しい到着の姿勢から置き直す
  let j = from + nk.length;
  while (j < keys.length && keys[j].ease === 'outCubic' && !keys[j].via) keys.splice(j, 1);
  const next = keys[j];
  if (next && next.ease === 'linear' && !next.shot) {
    const q = drifted({ ...arrival, roll: 0, zoom: 1 });
    Object.assign(next, { pos: [...q.pos], yaw: q.yaw, pitch: q.pitch, roll: 0, zoom: 1 });
  }
  return true;
}
