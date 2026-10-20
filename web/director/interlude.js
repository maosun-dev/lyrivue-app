// 台本係（雰囲気 S）：間奏の場面。歌詞の無い間が 6 秒以上ある所を、台本ができたあとに場面として切り出し、
// 歌詞に合った世界の配色で、流れる空間（director/interlude-flow.js：同じ速さで流れ続けるカメラ・星の粒・中抜きの立体・
// 1〜2 小節ごとに重ねる 2D の模様）と頭の白飛びを入れる。カメラの無い台本では、画面に貼る幾何学模様（fx.geo）にする。
// 題名・言葉の巨大文字（fx.title）は 2026-10-20 にやめた（持ち主「かえって文字が出てくるとださくなる」。部品は残す）。
// 設計：docs/superpowers/specs/2026-10-20-interlude-design.md
// 乱数は台本の本体とは別の列（種から作る）：足しても、ほかの選び（置き場所・カメラ・演出）は変わらない。
import { makeRng } from './rng.js';
import { worldById, WORLD_WORDS, dawnInk } from './worlds.js'; // 歌詞の言葉 → 世界の表は worlds.js（旅の組み立てと同じ表）
import { GEO_LIST } from '../shared/geo-list.js';
import { flowCamera, scatterSolids, overlayLayers, OVERLAY_MODES } from './interlude-flow.js';
import { interludeCuts, sceneShot, applyShots, toneInk, trackOf } from './interlude-scenes.js';
export { OVERLAY_MODES };

const GAP_MIN = 6;        // 歌詞の無い間がこれ以上（秒）なら間奏にする
const AFTER = 1;          // 前の行は、歌い終わりからこれだけ残す
const LEAD = 1.6;         // 次の行の歌い出しのこれだけ前に間奏を終える（カメラが次の行へ動き出すのが見える）
const MIN_LEN = 3;        // 切り出した間奏がこれより短ければ作らない
const STRONG_FROM = 0.45; // これ以上の強さの間奏は、ときどき 2 拍で切り替える（director/effects.js の STRONG_FROM と同じ）
const HALF_RATE = 0.3;    // 強い間奏で 2 拍にする割合
const FALLBACK_CHUNK = 2; // 拍が分からないとき、切り替える秒数
const EDGE = 0.6;         // 間奏の頭・終わりからこれより近い所では切り替えない
const SWAP_RATE = 0.2;    // 線の色と目立たせる色を入れ替える割合
const CUT_FLASH = 0.067;  // カットの頭で色を反転する秒数（2 コマ）
// テーマの背景の上に重ねる間奏の景色の濃さ（背景が透けて見えるように）。平面の模様は四角を地の色で塗りつぶすので薄め
const VEIL_3D = 0.85, VEIL_OVERLAY = 0.6, VEIL_NEST = 0.55;
const BG_GEOS = GEO_LIST.filter(g => !g[3]).map(g => g[0]); // 背景向きの模様（縁まで広がる形）
const pickBg = r => BG_GEOS[Math.min(BG_GEOS.length - 1, Math.floor(r * BG_GEOS.length))];
// 切り替わりごとの動き方（描く係 render/parts/fx-geo.js。カメラの無い台本のときだけ使う）
export const MOVES = ['zoom-in', 'zoom-out', 'spin', 'slide', 'tilt', 'push'];

// 歌詞の言葉 → 世界（上から順に調べる）

/**
 * 歌詞の無い間（前奏・行と行の間・後奏）のうち、間奏にする範囲。
 * @returns {{from:number, to:number, kind:'intro'|'gap'|'outro', before:number, after:number}[]} before・after は前後の行の番号（無ければ -1）
 */
export function findGaps(lines, duration) {
  const ls = (Array.isArray(lines) ? lines : []).map((l, i) => ({ i, s: l?.start, e: Number.isFinite(l?.end) ? Math.max(l.end, l.start) : l?.start }))
    .filter(x => Number.isFinite(x.s));
  if (!ls.length) return [];
  ls.sort((x, y) => x.s - y.s);
  const D = Number.isFinite(duration) && duration > 0 ? duration : ls.at(-1).e;
  const out = [];
  const add = (from, to, kind, before, after) => { if (to - from >= MIN_LEN) out.push({ from: round(from), to: round(to), kind, before, after }); };
  if (ls[0].s >= GAP_MIN) add(0, ls[0].s - LEAD, 'intro', -1, ls[0].i);
  let end = ls[0].e, endI = ls[0].i;
  for (let k = 1; k < ls.length; k++) {
    if (ls[k].s - end >= GAP_MIN) add(end + AFTER, ls[k].s - LEAD, 'gap', endI, ls[k].i);
    if (ls[k].e >= end) { end = ls[k].e; endI = ls[k].i; }
  }
  if (D - end >= GAP_MIN) add(end + AFTER, D, 'outro', endI, -1);
  return out;
}

/** 前後の歌詞の言葉で世界を選ぶ。allowed（使ってよい世界）に無ければ fallback、それも無ければ使える最初の世界 */
export function pickWorldFor(texts, allowed, fallback) {
  const ok = id => !Array.isArray(allowed) || !allowed.length || allowed.includes(id);
  const s = (Array.isArray(texts) ? texts : []).map(x => String(x ?? '')).join(' ');
  for (const [id, re] of WORLD_WORDS) if (re.test(s) && ok(id)) return id;
  if (fallback && ok(fallback)) return fallback;
  return Array.isArray(allowed) && allowed.length ? allowed[0] : 'void';
}

/**
 * 台本に間奏の場面を足す（雰囲気 S の台本に掛ける）。間奏が無ければ同じ台本を返す。
 * @param {import('./types.js').Script} script
 * @param {import('../analyze/types.js').AnalysisResult} a
 * @param {{seed?:number, worlds?:string[], open?:string|null, bright?:boolean}} [opts] open：曲の終わりの間奏に使う開けた場所（旅の最後。director/worlds.js の planJourney）。
 *   bright：曲の終わりの間奏を、前の場面と同じ世界の夜明けの配色にする（2026-10-19）
 */
export function addInterludes(script, a, opts) {
  const lines = Array.isArray(a?.lines) ? a.lines : [];
  const gaps = findGaps(lines, a?.duration);
  if (!gaps.length || !Array.isArray(script?.scenes)) return script;
  const seed = Number.isFinite(opts?.seed) ? Math.trunc(opts.seed) : 1;
  const rng = makeRng(seed * 2683 + 77711);
  const flowRng = makeRng(seed * 4099 + 3517); // 流れる空間（道すじの揺らぎ・立体・重ねる模様）の列
  const beats = (Array.isArray(a.beats) ? a.beats : []).filter(Number.isFinite);
  let scenes = script.scenes;
  let prevGeo = null;
  const made = [];
  // カメラのキーは写して書き換える（間奏の中を流れ続ける）
  const keys = Array.isArray(script.camera?.keys) ? script.camera.keys.map(k => ({ ...k, pos: [...k.pos] })) : null;
  for (const g of gaps) {
    const host = scenes.find(s => s && g.from >= s.start && g.from < s.end) ?? scenes.find(s => s && g.to > s.start && g.to <= s.end);
    scenes = cutOut(scenes, g.from, g.to);
    // 間奏のあとに残る前の場面の短い切れ端（歌い出しが無い）は、間奏の空間で埋める（前の景色が一瞬はさまらないように）。
    // カメラは g.to まで流れ、そこから次の行へ飛び込む（その間も空間が見えている）
    let end = g.to;
    const tail = scenes.find(s => s && Math.abs(s.start - g.to) < 1e-6);
    if (keys && tail && tail.end - tail.start <= LEAD + 0.05 && !(tail.layers ?? []).some(l => typeof l?.part === 'string' && l.part.startsWith('text.') && lines[l.line]?.start >= tail.start - 1e-6 && lines[l.line]?.start < tail.end)) {
      scenes = scenes.filter(s => s !== tail);
      end = tail.end;
    }
    const texts = [lines[g.before - 1], lines[g.before], lines[g.after], lines[g.after + 1]].filter(Boolean).map(l => l.text);
    // テーマ（世界）は前後の場面と同じ（2026-10-20 持ち主「紙のカードにしてるのに黒背景と赤に切り替わるのは雰囲気全然違う」）。
    // 前後の場面に背景のある世界が無いときだけ、歌詞の言葉で選ぶ
    // 前奏は前の場面が無いので、間奏のあとの場面に合わせる
    const near = g.kind === 'intro' ? scenes.filter(s => s && s.start >= end - 1e-6).sort((x, y) => x.start - y.start)[0] : host;
    // 曲の終わりの間奏は、旅の最後の開けた場所へ抜ける（2026-10-19 方針の決まり②「最後は開ける」）
    const openEnd = g.kind === 'outro' && worldById(opts?.open)?.palette ? opts.open : null;
    const wid = openEnd ?? (worldById(near?.world)?.palette ? near.world : pickWorldFor(texts, opts?.worlds, host?.world));
    // 前後の場面と同じ世界なら、その配色をそのまま使う（紙の時間も同じ）
    const sameInk = () => (near?.world === wid && near?.ink ? { ...near.ink } : worldById(wid).palette(script.style?.colors ?? []));
    // 曲の終わりの間奏で明るくするとき：前の場面がもう夜明けの配色ならそのまま、まだなら夜明けに
    const dawnEnd = g.kind === 'outro' && opts?.bright && !openEnd;
    const inkOf = () => (dawnEnd && !near?.dawn ? dawnInk(sameInk(), wid) : sameInk());
    const world = worldById(wid);
    const layers = [{ part: 'bg.vignette', from: g.from, to: g.to }];
    if (world?.palette) layers.push({ part: 'fx.world', kind: world.id, from: g.from, to: g.to });
    const intensity = Number.isFinite(host?.intensity) ? host.intensity : 0.5;
    const hits = [{ t: g.from, kind: 'flash', amp: 1, dur: 0.3 }];
    const base = keys ? poseBefore(keys, g.from) : null;
    if (base) {
      // 流れる空間（2026-10-20 持ち主が 55 点を付けた「立体の空間の見本」と同じ見せ方）。カメラは同じ速さで流れ続け、後半は次の行のほうへ寄る。
      // 場面展開（見本 Version 8 で持ち主 OK）：4 小節ごとに場面を分け、カット・場面の種類・配色・寄りと引きを変える（director/interlude-scenes.js）
      const { path, keepOut } = flowCamera(keys, g, base, lines[g.after]?.start, flowRng);
      const plan = interludeCuts(g.from, g.to, beats, Math.floor(flowRng() * 1e6));
      plan.at(-1).to = end;
      applyShots(keys, path, plan, plan.map((sc, i) => sceneShot(sc, i, flowRng)), g.to);
      // テーマの背景がある世界：テーマの背景を敷き、配色はテーマのまま（場面ごとに変えない）。間奏の景色は半透明で重ねる。
      // 背景の無い世界（tunnel・void）：今までどおり無地の地に、黒地 → 色地 → 白地 を回す
      const themed = !!world?.palette;
      const themeInk = themed ? inkOf() : null;
      const baseInk = themeInk ?? { bg: '#000000', fg: '#F4F4F4', line: '#8C8C8C', accent: script.style?.colors?.[0] };
      plan.forEach((sc, k) => {
        const first = k === 0, last = k === plan.length - 1;
        const sub = { from: sc.from, to: sc.to };
        const slice = path.filter(p => p.t >= sc.from - 1e-6 && p.t <= sc.to + 1e-6);
        const ls = [themed ? { part: 'fx.world', kind: wid, from: sc.from, to: sc.to } : { part: 'bg.ink', from: sc.from, to: sc.to }];
        const veil = (l, a) => { if (themed) l.alpha = a; return l; };
        const fades = l => { if (first) l.fadeIn = true; if (last) l.fadeOut = true; return l; };
        if (sc.kind === 'space') {
          ls.push(veil(fades({ part: 'fx.stars', ...sub }), VEIL_3D));
          const own = path.filter(p => p.t >= sc.from - 1e-6 && p.t <= Math.min(sc.to, g.to) + 1e-6);
          ls.push(veil(fades({ part: 'fx.solids', ...sub, objects: own.length ? scatterSolids(own, { from: sc.from, to: Math.min(sc.to, g.to) }, keepOut, flowRng) : [] }), VEIL_3D));
        } else if (sc.kind === 'tunnel') {
          ls.push(veil({ part: 'fx.rings', ...sub, track: trackOf(slice) }, VEIL_3D));
        } else if (sc.kind === 'corridor') {
          // 壁の看板の模様は 3 種類を順に（左右交互）
          const kinds = [pickBg(flowRng()), pickBg(flowRng()), pickBg(flowRng())];
          ls.push(veil({ part: 'fx.corridor', ...sub, track: trackOf(slice), kinds, swaps: kinds.map(() => flowRng() < 0.4) }, VEIL_3D));
        } else {
          const a = pickBg(flowRng());
          let b; do { b = pickBg(flowRng()); } while (b === a && BG_GEOS.length > 1);
          ls.push(veil({ part: 'fx.nest', ...sub, ids: [a, b] }, VEIL_NEST));
        }
        const over = overlayLayers({ from: sc.from, to: sc.to }, beats, flowRng);
        for (const l of over) { if (!first) delete l.fadeIn; if (!last) delete l.fadeOut; veil(l, VEIL_OVERLAY); }
        ls.push(...over);
        const ink = themeInk ?? toneInk(baseInk, sc.tone);
        made.push({
          section: '間奏', start: sc.from, end: sc.to, mood: 'S', tone: ink.light ? 'paper' : 'ink',
          intensity, world: wid, interlude: true, sceneKind: sc.kind, layers: ls,
          // 間奏の頭は白飛び、カットの頭は 2 コマだけ色を反転する
          hits: [first ? { t: sc.from, kind: 'flash', amp: 1, dur: 0.3 } : { t: sc.from, kind: 'invert', amp: 1, dur: CUT_FLASH }],
          ink,
        });
      });
      continue;
    } else {
      // カメラの無い台本：幾何学模様を画面に貼り、1〜2 小節ごと（強い間奏はときどき 2 拍）に動き方と速さを付けて切り替える
      // （2026-10-20 持ち主「1 小節・2 小節（または拍）くらいにランダムに疾走感あふれる感じに動かしまくればかっこいい」）
      const marks = segmentMarks(g, beats, intensity >= STRONG_FROM, rng);
      marks.forEach((from, k) => {
        let id;
        do { id = GEO_LIST[Math.min(GEO_LIST.length - 1, Math.floor(rng() * GEO_LIST.length))][0]; } while (id === prevGeo && GEO_LIST.length > 1);
        prevGeo = id;
        const layer = { part: 'fx.geo', kind: id, from: round(from), to: round(marks[k + 1] ?? g.to), move: MOVES[Math.floor(rng() * MOVES.length)], speed: Math.round((1.5 + 1.5 * rng()) * 100) / 100 };
        if (rng() < SWAP_RATE) layer.swap = true; // ときどき線の色と目立たせる色を入れ替える
        if (k === 0) layer.fadeIn = true;
        if (k === marks.length - 1) layer.fadeOut = true;
        layers.push(layer);
        if (k > 0) hits.push({ t: layer.from, kind: rng() < 0.5 ? 'slice' : 'chroma', amp: 0.7, dur: 0.12 });
      });
    }
    const scene = {
      section: '間奏', start: g.from, end, mood: 'S', tone: world?.light ? 'paper' : 'ink',
      intensity, world: wid, interlude: true, layers, hits,
    };
    if (world?.palette) scene.ink = inkOf();
    made.push(scene);
  }
  return { ...script, ...(keys ? { camera: { ...script.camera, keys } } : {}), scenes: [...scenes, ...made].sort((x, y) => x.start - y.start) };
}

// 場面の並びから [a, b) を抜く。かかっていた場面は前後に分け、層・hits・tones を時刻で切り詰める
function cutOut(scenes, a, b) {
  const out = [];
  for (const s of scenes) {
    if (!s || !(s.end > a && s.start < b)) { out.push(s); continue; }
    if (s.start < a) out.push(piece(s, s.start, a));
    if (s.end > b) out.push(piece(s, b, s.end));
  }
  return out;
}
function piece(s, from, to) {
  const layers = (s.layers ?? []).map(l => ({ ...l, from: Math.max(l.from, from), to: Math.min(l.to, to) })).filter(l => l.to > l.from);
  const p = { ...s, start: from, end: to, layers };
  if (Array.isArray(s.hits)) p.hits = s.hits.filter(h => h && h.t >= from && h.t < to);
  if (Array.isArray(s.tones)) {
    // 後ろの切れ端は、切れ目までに切り替わっていた地の色から始める
    const before = s.tones.filter(x => x && x.t <= from);
    if (before.length) p.tone = before.at(-1).tone;
    p.tones = s.tones.filter(x => x && x.t > from && x.t < to);
  }
  return p;
}

// 小数の誤差を消す
const round = v => Math.round(v * 1e6) / 1e6;

// 間奏の中の切り替えの時刻（最初は間奏の頭）。拍が分かれば小節の頭から始めて 1〜2 小節（強ければときどき 2 拍）ずつ進む
function segmentMarks(g, beats, strong, rng) {
  const marks = [g.from];
  if (beats.length >= 2) {
    let bi = beats.findIndex((b, i) => i % 4 === 0 && b > g.from + EDGE);
    while (bi >= 0 && bi < beats.length && beats[bi] < g.to - EDGE) {
      marks.push(round(beats[bi]));
      bi += strong && rng() < HALF_RATE ? 2 : rng() < 0.5 ? 4 : 8;
    }
  } else {
    for (let t = g.from + FALLBACK_CHUNK; t < g.to - EDGE; t += FALLBACK_CHUNK) marks.push(round(t));
  }
  return marks;
}

// 時刻 t 以前の最後のカメラのキー（間奏に入るときの姿勢）
function poseBefore(keys, t) {
  let k = null;
  for (const x of keys) { if (x.t <= t) k = x; else break; }
  k = k ?? keys[0];
  return k && Array.isArray(k.pos) ? { pos: [...k.pos], yaw: k.yaw ?? 0, pitch: k.pitch ?? 0 } : null;
}
