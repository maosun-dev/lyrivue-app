// 消すもの：持ち主が一時停止中に選んだ「要らない演出」を台本から抜く。
// removed = { kinds, items }
//   kinds：種類の名前。曲全体からその種類を消す（全部消す）。例 'motif:rain'・'deco:focus'・'hit:chroma'・'enter:spin'・'exit:burn'・'kime:ring'・'sticker:hanamaru'（文字のあとに貼る飾り）・'flood:diag'（歌詞で画面を埋める組み）・'vessel:keycap'（文字を載せる器。1 行に 3 つまで並ぶうちのその器だけ抜く）・'font:dot'・'set:tate'・
//          'look:glow'・'hold:wave'・'tone:color'・'koma'・'part:fx.tunnel'・'prop:clock'（連想の小物）・'world:paper'（場面の世界。
//          背景・文字の台紙・世界の配色が外れて、地の色に戻る。tunnel・void は世界として出さない）
//   items：1回ぶんの名前。その場面のその1回だけ消す（ここだけ消す）。`${雰囲気}/${案の番号}/${場面の中の名前}` なので、
//          「もう一案」で作り直した台本には効かない
// 文字そのもの（歌詞）は消さない。文字の出方・加工・動き・書体・組み方を消すと、いちばん素直なもの（打ち込み・加工なし・動きなし・明朝・横並び）に戻る。
// カメラの切り替え（カット割り）はカメラの動きに溶けているので、ここでは消せない。

import { PROP_LABELS } from './props.js';
import { WORLDS } from './worlds.js';
import { GEO_LIST } from '../shared/geo-list.js';

export const EMPTY_REMOVED = Object.freeze({ kinds: Object.freeze([]), items: Object.freeze([]) });

import { TEXT_FX } from '../render/parts/text-fx.js';
import { STICKERS } from '../render/parts/stickers/index.js';
import { FLOODS } from '../render/parts/flood.js';
import { MAIN_VESSELS } from '../render/parts/vessels/index.js';
// 文字そのものの演出（render/parts/text-fx.js）の名前
const fxNames = cat => Object.fromEntries(Object.values(TEXT_FX[cat]).map(f => [f.id, f.name]));
const HIT_WINDOW = 0.6;  // 一瞬の効果は、終わってからこの秒数までは「今出ている」に数える（止めるのが少し遅れても拾える）

const PART_LABEL = {
  'bg.vignette': '周りの暗がり', 'fx.tunnel': '輪のトンネル', 'fx.dust': 'ちり', 'fx.rays': '光の筋', 'fx.streak': '縦の筋',
  'fx.flash': '場面の頭の白飛び', 'fx.bokeh': 'にじみ', 'fx.floor': '床の格子', 'fx.shapes': '遠くの図形',
  'bg.gradient': '色の地', 'bg.pulse': '脈打つ地', 'fx.ring': '広がる輪', 'fx.dots': '点の粒', 'fx.wave': '音の波形',
  'fx.title': '間奏の大きな文字', 'fx.solids': '間奏の立体', 'fx.stars': '星の粒', 'fx.overlay': '間奏の重ねる模様',
  'fx.rings': '間奏の光の輪のトンネル', 'fx.corridor': '間奏の枠の通路', 'fx.nest': '間奏の平面の模様',
};
// 消す候補にしない層（地の塗り）
const NOT_EFFECT = new Set(['bg.ink']);
const LABEL = {
  prop: PROP_LABELS,
  world: Object.fromEntries(WORLDS.map(w => [w.id, w.name])),
  geo: Object.fromEntries(GEO_LIST.map(([id, name]) => [id, name])),
  motif: { rain: '雨', snow: '雪', petal: '花びら', ember: '火の粉', wind: '風', star: '星と流れ星', firework: '花火', sea: '波', light: '差し込む光', moon: '月', heart: '鼓動の輪' },
  deco: { focus: '集中線', brackets: '四隅の括弧と目盛り', wave: '下の波形', halftone: '隅の網点' },
  hit: { flash: '白飛び', invert: '白黒反転', chroma: '色ずれ', slice: '横に裂ける', shake: '画面の揺れ', zoom: 'ぐっと寄る', bars: '上下の黒帯', echo: '文字の残像', ...fxNames('hit') },
  enter: { drop: '落ちてくる', spin: '回って出る', scatter: '散らばって集まる', stretch: '伸びて出る', random: 'ばらばらの順に出る', ...fxNames('enter') },
  look: { extrude: '立体の厚み', outline: '縁取り', shadow: 'ずれた影', marker: '下の色の帯', glow: '発光', ...fxNames('look') },
  hold: { wave: '波打つ', jitter: 'ふるえる', breathe: '拍でふくらむ', ...fxNames('hold') },
  exit: fxNames('exit'),
  kime: fxNames('kime'),
  sticker: Object.fromEntries(STICKERS.map(d => [d.id, d.name])),
  flood: Object.fromEntries(FLOODS.map(d => [d.id, d.name])),
  vessel: Object.fromEntries(MAIN_VESSELS.map(d => [d.id, d.name])),
  font: { gothic: 'ゴシック体', heavy: '極太の書体', hand: '手書き風の書体', dot: 'ドットの書体' },
  set: { tate: '縦組み', jump: '1文字ずつ大小・上下', fill: '画面いっぱいに敷き詰め', slant: '斜めの段と大きな1語' },
  tone: { paper: '白地への切り替え', color: '色地への切り替え', ink: '黒地への切り替え' },
};
// 一覧に出す順と、見出し
const GROUPS = [
  ['world', '世界'], ['geo', '間奏の模様'], ['motif', '言葉の演出'], ['prop', '連想の小物'], ['deco', '飾り'], ['part', '背景と飾り'], ['hit', '一瞬の効果'], ['tone', '地の色'], ['koma', 'コマ打ち'],
  ['enter', '文字の出方'], ['look', '文字の加工'], ['hold', '文字の動き'], ['exit', '文字の消え方'], ['kime', '強調語のキメ'], ['sticker', '貼る飾り'], ['flood', '歌詞で埋める組み'], ['vessel', '文字を載せる器'], ['font', '文字の書体'], ['set', '文字の組み方'],
];
const GROUP_NAME = Object.fromEntries(GROUPS);
const GROUP_ORDER = Object.fromEntries(GROUPS.map(([g], i) => [g, i]));
// 文字の属性の「いちばん素直なもの」（これは演出として数えない）
const PLAIN = { enter: 'type', look: 'plain', hold: 'none', exit: 'none', kime: 'none', sticker: 'none', flood: 'none', font: 'mincho', set: 'row' };
const TEXT_ATTRS = Object.keys(PLAIN);

const fin = v => (Number.isFinite(v) ? v : 0);
const isText = part => typeof part === 'string' && part.startsWith('text.');

function labelOf(key) {
  if (key === 'koma') return 'コマ打ち（1秒12コマのカクカク）';
  const [g, v] = key.split(':');
  if (g === 'part') return PART_LABEL[v] ?? v;
  return LABEL[g]?.[v] ?? v;
}

// 文字でない層の種類の名前（文字の層は null）
function layerKey(layer) {
  if (!layer || isText(layer.part)) return null;
  if (layer.part === 'fx.motif') return `motif:${layer.kind}`;
  if (layer.part === 'fx.deco') return `deco:${layer.kind}`;
  if (layer.part === 'fx.prop') return `prop:${layer.kind}`;
  if (layer.part === 'fx.world') return `world:${layer.kind}`;
  if (layer.part === 'fx.geo') return `geo:${layer.kind}`;
  return `part:${layer.part}`;
}
// 重ねる模様の層に出ている模様の id（背景向き＋置く形）
const overlayGeos = l => [l.kind, ...(Array.isArray(l.spots) ? l.spots.map(p => p?.id) : [])].filter(x => typeof x === 'string');

// 場面の中での1回ぶんの名前（同じ景色の奥と手前の2層は同じ名前になる）
const layerId = (si, l) => `s${si}/${l.part}/${l.kind ?? ''}/${fin(l.from).toFixed(2)}`;
const textId = (si, l, attr) => `s${si}/line${l.line}/${attr}`;
// 文字を載せる器は 1 行に何種類か並ぶので、器ごとに名前を分ける
const vesselId = (si, l, id) => `s${si}/line${l.line}/vessel/${id}`;
const vesselList = l => (Array.isArray(l.vessels) ? l.vessels.filter(x => typeof x === 'string') : []);
const hitId = (si, h) => `s${si}/hit/${h.kind}/${fin(h.t).toFixed(3)}`;
const toneId = (si, x) => `s${si}/tone/${fin(x.t).toFixed(3)}`;
const prefix = (script, scene) => `${scene?.mood ?? ''}/${script?.seed ?? ''}/`;

/** 壊れた一覧を整える（文字列だけ・重複なし） */
export function normalizeRemoved(removed) {
  const clean = v => (Array.isArray(v) ? [...new Set(v.filter(x => typeof x === 'string' && x))] : []);
  return { kinds: clean(removed?.kinds), items: clean(removed?.items) };
}

/**
 * 時刻 t に出ている演出の一覧（種類ごと。消す候補）
 * @returns {{key:string, label:string, group:string, ids:string[]}[]} ids は「ここだけ消す」に使う1回ぶんの名前
 */
export function effectsAt(script, t) {
  const scenes = Array.isArray(script?.scenes) ? script.scenes : [];
  if (!Number.isFinite(t)) return [];
  const si = scenes.findIndex((s, i) => s && t >= s.start && (t < s.end || (i === scenes.length - 1 && t === s.end)));
  if (si < 0) return [];
  const scene = scenes[si];
  const pre = prefix(script, scene);
  const found = new Map();
  const add = (key, id) => {
    if (!found.has(key)) found.set(key, new Set());
    found.get(key).add(pre + id);
  };
  for (const l of Array.isArray(scene.layers) ? scene.layers : []) {
    if (!l || !(t >= l.from && (t < l.to || (l.to === scene.end && t === scene.end)))) continue;
    if (isText(l.part)) {
      for (const attr of TEXT_ATTRS) {
        const v = l[attr];
        if (typeof v === 'string' && v !== PLAIN[attr]) add(`${attr}:${v}`, textId(si, l, attr));
      }
      for (const id of vesselList(l)) add(`vessel:${id}`, vesselId(si, l, id));
      continue;
    }
    if (NOT_EFFECT.has(l.part)) continue;
    add(layerKey(l), layerId(si, l));
    // 重ねる模様：背景向きの 1 枚と、置いている形を 1 種類ずつ「間奏の模様」として出す（消すと、その模様だけ出なくなる）
    if (l.part === 'fx.overlay') for (const id of overlayGeos(l)) add(`geo:${id}`, `${layerId(si, l)}/${id}`);
  }
  for (const h of Array.isArray(scene.hits) ? scene.hits : []) {
    if (!h || !Number.isFinite(h.t)) continue;
    const dur = Number.isFinite(h.dur) && h.dur > 0 ? h.dur : 0.2;
    if (h.t <= t + 0.05 && t - h.t <= dur + HIT_WINDOW) add(`hit:${h.kind}`, hitId(si, h));
  }
  // 地の色：今効いている切り替え（t 以前の最後のもの）。世界の配色のある場面では効いていないので出さない
  const tones = scene.ink ? [] : (Array.isArray(scene.tones) ? scene.tones : []).filter(x => x && Number.isFinite(x.t) && x.t <= t);
  if (tones.length) add(`tone:${tones[tones.length - 1].tone}`, toneId(si, tones[tones.length - 1]));
  if (scene.koma > 0) add('koma', `s${si}/koma`);
  return [...found.entries()]
    .map(([key, ids]) => {
      const g = key === 'koma' ? 'koma' : key.split(':')[0];
      return { key, label: labelOf(key), group: GROUP_NAME[g] ?? g, ids: [...ids], order: GROUP_ORDER[g] ?? 99 };
    })
    .sort((a, b) => a.order - b.order || a.label.localeCompare(b.label, 'ja'))
    .map(({ order, ...x }) => x);
}

/**
 * 台本から消すものを抜いた新しい台本を返す（元の台本は変えない。消すものが無ければ同じものを返す）
 * @param {import('./types.js').Script} script
 * @param {{kinds?:string[], items?:string[]}} removed
 */
export function applyRemovals(script, removed) {
  const r = normalizeRemoved(removed);
  if (!script || !Array.isArray(script.scenes) || (!r.kinds.length && !r.items.length)) return script;
  const kinds = new Set(r.kinds);
  const items = new Set(r.items);
  const scenes = script.scenes.map((scene, si) => {
    if (!scene) return scene;
    const pre = prefix(script, scene);
    const gone = (key, id) => kinds.has(key) || items.has(pre + id);
    const out = { ...scene };
    // 世界：背景の層 fx.world が消えるなら、文字の台紙と世界の配色も外す（地の色＝tones に戻る）
    const layerList = Array.isArray(scene.layers) ? scene.layers : [];
    const worldLayer = layerList.find(l => l?.part === 'fx.world');
    const worldGone = !!worldLayer && gone(layerKey(worldLayer), layerId(si, worldLayer));
    if (worldGone) { delete out.world; delete out.ink; }
    out.layers = layerList.flatMap(l => {
      if (!l) return [l];
      // 世界の背景の場所には、何もない空間と同じ筋（黒地は光の筋・白地は縦の筋）を戻す（その筋を全部消していれば戻さない）
      if (worldGone && l === worldLayer) {
        const part = scene.tone === 'paper' ? 'fx.streak' : 'fx.rays';
        return kinds.has(`part:${part}`) ? [] : [{ part, on: 'beat', from: scene.start, to: scene.end }];
      }
      if (worldGone && isText(l.part) && 'back' in l) { const { back, ...rest } = l; l = rest; }
      if (l.part === 'fx.overlay') {
        if (gone(layerKey(l), layerId(si, l))) return [];
        // 消した模様だけ抜く（背景向きの 1 枚を消したら、置く形だけ残す）
        const keep = id => !kinds.has(`geo:${id}`) && !items.has(`${pre}${layerId(si, l)}/${id}`);
        const spots = (Array.isArray(l.spots) ? l.spots : []).filter(p => p && keep(p.id));
        const out = { ...l, spots };
        if (!keep(l.kind)) delete out.kind;
        return out.kind || spots.length ? [out] : [];
      }
      if (!isText(l.part)) return gone(layerKey(l), layerId(si, l)) ? [] : [l];
      let copy = l;
      for (const attr of TEXT_ATTRS) {
        const v = l[attr];
        if (typeof v === 'string' && v !== PLAIN[attr] && gone(`${attr}:${v}`, textId(si, l, attr))) {
          if (copy === l) copy = { ...l };
          delete copy[attr];
        }
      }
      // 文字を載せる器：消した器だけ抜く（全部抜けたら器の行でなくなる）
      if (Array.isArray(l.vessels)) {
        const keep = vesselList(l).filter(id => !gone(`vessel:${id}`, vesselId(si, l, id)));
        if (keep.length !== l.vessels.length) {
          if (copy === l) copy = { ...l };
          if (keep.length) copy.vessels = keep; else delete copy.vessels;
        }
      }
      return [copy];
    });
    if (Array.isArray(scene.hits)) out.hits = scene.hits.filter(h => !h || !gone(`hit:${h.kind}`, hitId(si, h)));
    if (Array.isArray(scene.tones)) out.tones = scene.tones.filter(x => !x || !gone(`tone:${x.tone}`, toneId(si, x)));
    if (scene.koma > 0 && gone('koma', `s${si}/koma`)) delete out.koma;
    return out;
  });
  return { ...script, scenes };
}
