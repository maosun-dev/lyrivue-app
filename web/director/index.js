// 台本係：解析結果（AnalysisResult）から台本（Script）を作る。例外は投げない。
// 乱数は makeRng(seed) 1本を、「色と書体 → 場面ごと／行ごとの選び」の順に使う。
// この順番が変わると同じ種でも台本が変わる。
import { applyPlaces } from './places.js';
import { makeRng, pick } from './rng.js';
import { chooseStyle } from './style.js';
import { sectionIntensity, stretch } from './intensity.js';
import { MOODS } from './moods.js';
import { placeLines, emphasisSpan, typeSeconds, cameraKeys } from './layout.js';
import { placeCloud, spaceCameraKeys, planForward, placeProps, stayWindow } from './space.js';
import { planEffects } from './effects.js';
import { resolveTuning } from '../shared/tuning.js';
import { applyRemovals } from './removals.js';
import { applyEdits } from './edits.js';
import { planJourney, worldById, paperTime, dawnInk, sectionKind } from './worlds.js';
import { addInterludes } from './interlude.js';

const PRELUDE_MIN = 0.5;      // 最初の区切りがこれより後ろから始まるとき、前奏の場面を付ける
const MIN_LINE_SECONDS = 0.5; // 文字の出番の最短
const FX_TWO_FROM = 0.6;      // B：盛り上がりがこれ以上なら飾りを2つにする
const PAPER_FROM = 0.45;      // D：引き伸ばした強さがこれ以上の場面は白地（paper）、未満は黒地（ink）
const FLASH_SECONDS = 0.4;    // D：白地の場面の頭の白飛び
const CHORUS_BONUS = 0.3;     // D：見出しが Chorus・サビの場面は、音の大きさに足して強い場面として扱う
const CHORUS_NAME = /chorus|サビ/i;
const SLOW_FIRST = 1.7;       // 曲の最初の行が、1 文字あたりほかの行の中央値のこれ倍以上ゆっくりなら、頭が早すぎると見る
const FIRST_PACE = 1.25;      // そのときは、行の終わりから「中央値 × これ × 文字数」だけ前を歌い出しにする
const PRE_NAME = /pre|プレ|Aメロ|Bメロ/i; // Pre-Chorus（サビの前）は強い場面にしない

/**
 * @param {import('../analyze/types.js').AnalysisResult} analysis
 * @param {{seed?:number, mood?:'B'|'D'|'S', tuning?:Object<string,number>, motifs?:boolean, fonts?:string[], worlds?:string[], stickers?:'none'|'doodle'|'all', floods?:boolean, vessels?:boolean, exits?:boolean, ending?:'bright'|'stay'|'sky', paperTimes?:string[], removed?:{kinds?:string[],items?:string[]}, edits?:Object, unify?:boolean}} [opts] mood の既定は 'S'（空間に散らした文字・あちこち動くカメラ）。'D' は廊下に並べた重ねる文字、'B' は跳ねる文字。tuning は見た目の細かい値（無ければ初期値）。motifs が false なら S に言葉の演出（月・雨など）を入れない。fonts は S で使ってよい書体（無い・空なら全部）。worlds は S で使ってよい世界（director/worlds.js。無い・空なら全部）。stickers は S で文字のあとに貼る飾り（none＝貼らない・既定／doodle＝手描きの記号だけ／all＝全部）。floods が false なら S に歌詞で画面を埋める組みを入れない（初期は入れる）。vessels が true のときだけ S に文字を載せる器を入れる（2026-10-19 方針で初期オフ）。ending は S の最後の世界（bright＝同じ世界の夜明けの色・初期／stay＝そのまま／sky＝空と線画へ抜ける）。paperTimes は紙に戻るたびに使う時間の順。exits が true のときだけ S に文字の消え方を入れる（2026-10-19 持ち主の判断で初期オフ）。
 *   removed は持ち主が消した演出（director/removals.js。台本を作ったあとに抜くので、カメラや置き場所は変わらない）。
 *   edits は持ち主が直した行（director/edits.js。S のときだけ。消すより先に掛ける）
 *   unify が false なら、場所（世界）ごとの演出の語彙でそろえない（初期はそろえる。director/effects.js の pickVocab）
 * @returns {import('./types.js').Script}
 */
export function buildScript(analysis, opts) {
  const seed = Number.isFinite(opts?.seed) ? opts.seed : 1;
  const rng = makeRng(seed);
  // ここから場所を変える（持ち主が行ごとに決めた区切り。director/places.js）を先に掛けて、区切りを作り直す
  const a = trimSlowFirstLine(applyPlaces(analysis ?? {}, opts?.edits));
  const duration = Number.isFinite(a.duration) && a.duration > 0 ? a.duration : 0;
  const lines = Array.isArray(a.lines) ? a.lines : [];
  const style = chooseStyle(a, rng);

  // 場面の範囲を決める
  /** @type {{section:string,start:number,end:number}[]} */
  let ranges = (Array.isArray(a.sections) ? a.sections : [])
    .map(s => ({ section: String(s.name ?? ''), start: s.start, end: s.end }));
  if (ranges.length === 0) {
    ranges = [{ section: '', start: 0, end: duration }];
  } else if (ranges[0].start > PRELUDE_MIN) {
    ranges.unshift({ section: '', start: 0, end: ranges[0].start });
  }

  // 行は「その行の start 以前に始まる最後の場面」に入れる（取りこぼさない）
  const owner = lines.map(l => {
    let idx = 0;
    ranges.forEach((r, i) => { if (r.start <= l.start) idx = i; });
    return idx;
  });

  if (opts?.mood === 'B') return applyRemovals(buildB({ seed, rng, a, lines, style, ranges, owner }), opts?.removed);
  const tuning = resolveTuning(opts?.tuning);
  if (opts?.mood === 'D') return applyRemovals(buildD({ seed, rng, a, lines, style, ranges, owner, tuning }), opts?.removed);
  // 直す → 消すの順（もう一案で出た演出も「全部消す」が効く）
  // 間奏（6 秒以上歌詞の無い所）は、台本ができたあとに場面として切り出す（director/interlude.js）
  const { journey, ...base } = buildS({ seed, rng, a, lines, style, ranges, owner, tuning, motifs: opts?.motifs !== false, fonts: opts?.fonts, worlds: opts?.worlds, placeWorlds: opts?.placeWorlds, paperTimes: opts?.paperTimes, ending: opts?.ending, stickers: opts?.stickers, floods: opts?.floods, vessels: opts?.vessels, exits: opts?.exits, unify: opts?.unify });
  // 曲の終わりの間奏は、旅の最後（journey.open の空へ抜ける／明るくする（bright）／そのまま）
  const s = addInterludes(base, a, { seed, worlds: opts?.worlds, open: journey?.open, bright: journey?.ending === 'bright' });
  return applyRemovals(applyEdits(s, opts?.edits, a, { fonts: opts?.fonts, vessels: opts?.vessels, exits: opts?.exits }), opts?.removed);
}

// B：文字が跳ねる（版 1。カメラなし）
function buildB({ seed, rng, a, lines, style, ranges, owner }) {
  const B = MOODS.B;
  const scenes = ranges.map((r, si) => {
    const intensity = sectionIntensity(a, r.start, r.end);
    const layers = [];
    layers.push({ part: pick(rng, B.bg), from: r.start, to: r.end });
    const fxCount = intensity >= FX_TWO_FROM ? 2 : 1;
    const fxPool = [...B.fx];
    for (let k = 0; k < fxCount; k++) {
      const part = pick(rng, fxPool);
      fxPool.splice(fxPool.indexOf(part), 1);
      layers.push({ part, from: r.start, to: r.end, on: 'beat' });
    }
    lines.forEach((l, i) => {
      if (owner[i] !== si) return;
      let to = Math.min(Math.max(l.end, l.start + MIN_LINE_SECONDS), r.end);
      if (!(to > l.start)) to = l.start + MIN_LINE_SECONDS; // 場面の終わりより後ろの行
      layers.push({ part: pick(rng, B.text), line: i, from: l.start, to });
    });
    return { section: r.section, start: r.start, end: r.end, mood: 'B', intensity, layers };
  });
  return { version: 1, seed, style, scenes };
}

// D：重ねる文字（版 2）。曲全体で1本のカメラが、行から行へ飛ぶ。強い場面は白地、弱い場面は黒地
function buildD({ seed, rng, a, lines, style, ranges, owner, tuning }) {
  const intensities = stretch(ranges.map(r => sectionIntensity(a, r.start, r.end) + (CHORUS_NAME.test(r.section) && !PRE_NAME.test(r.section) ? CHORUS_BONUS : 0)));
  const placements = placeLines(lines.length, rng, tuning); // 行の通し番号で置く（場面をまたぐ）
  const words = Array.isArray(a.words) ? a.words : [];
  const scenes = ranges.map((r, si) => {
    const intensity = intensities[si];
    const tone = intensity >= PAPER_FROM ? 'paper' : 'ink';
    const layers = [{ part: 'bg.vignette', from: r.start, to: r.end }];
    if (tone === 'paper') {
      if (r.start > 0) layers.push({ part: 'fx.flash', from: r.start, to: r.start + FLASH_SECONDS });
      layers.push({ part: 'fx.streak', on: 'beat', from: r.start, to: r.end });
    } else {
      // 黒地には、光の筋とにじみ（文字より奥に描く）
      layers.push({ part: 'fx.rays', on: 'beat', from: r.start, to: r.end });
      layers.push({ part: 'fx.bokeh', on: 'beat', from: r.start, to: r.end });
    }
    lines.forEach((l, i) => {
      if (owner[i] !== si) return;
      // 行は、KEEP_LINES 行あとの行が始まるまで（無ければ場面の終わりまで）奥に残す
      const keepEnd = Math.min(lines[i + tuning.keepLines]?.start ?? r.end, r.end);
      let to = Math.min(Math.max(l.end, l.start + MIN_LINE_SECONDS, keepEnd), r.end);
      if (!(to > l.start)) to = l.start + MIN_LINE_SECONDS;
      const layer = {
        part: 'text.motion', line: i, from: l.start, to,
        pos: placements[i].pos, roll: placements[i].roll, sizeMul: placements[i].size,
        typeSec: typeSeconds(l.start, l.end, Array.from(String(l.text ?? '')).length),
      };
      const emph = emphasisSpan(l.text, words);
      if (emph) layer.emph = emph;
      if (placements[i].skew) layer.skew = placements[i].skew;
      layers.push(layer);
    });
    return { section: r.section, start: r.start, end: r.end, mood: 'D', tone, intensity, layers };
  });
  return { version: 2, seed, style, tuning, camera: { keys: cameraKeys(placements, lines, tuning) }, scenes };
}

// S：空間に散らした文字（版 2）。区切りの全行を立体の空間に散らして置き、歌っている行だけ明るく打ち込む。
// カメラは空間の中を、寄る・引く・回り込む・勢いよく寄るで動く。場面の見た目（白地・黒地、飾り）は D と同じ決め方
function buildS({ seed, rng, a, lines, style, ranges, owner, tuning, motifs, fonts, worlds, placeWorlds, paperTimes, ending, stickers, floods, vessels, exits, unify }) {
  const intensities = stretch(ranges.map(r => sectionIntensity(a, r.start, r.end) + (CHORUS_NAME.test(r.section) && !PRE_NAME.test(r.section) ? CHORUS_BONUS : 0)));
  // 場面ごとの世界：旅の組み立て（区切りの種類ごとに場所。同じ種類は同じ場所に戻り、紙なら時間が進む。2026-10-19）。
  // 別の乱数の列なので、ほかの選びは変わらない
  const journey = planJourney(ranges.map(r => r.section), intensities, seed, { worlds, placeWorlds, paperTimes, ending, texts: ranges.map((_, si) => lines.filter((_, i) => owner[i] === si).map(l => l.text).join(' ')) });
  const worldIds = journey.worlds;
  const words = Array.isArray(a.words) ? a.words : [];
  // 場面ごとの行の列と、空間への置き場所（場面ごとに、同じ形のらせんの雲）
  const groups = ranges.map((r, si) => lines.map((l, i) => ({ l, i })).filter(({ i }) => owner[i] === si));
  const places = groups.map(g => placeCloud(g.length, rng, tuning));
  // 奥へ進む動き（前進・くぐり抜け・場面の頭のワープ）：行ごとの種類と奥へのずらし。別の乱数の列なので、ほかの選びは変わらない
  const plan = planForward(groups.map((g, si) => ({ intensity: intensities[si], items: g.map(({ l }) => ({ start: l.start })) })), seed, tuning);
  places.forEach((ps, si) => ps.forEach((p, k) => { p.pos = [p.pos[0], p.pos[1], p.pos[2] + plan[si][k].z]; }));
  const keys = spaceCameraKeys(
    groups.map((g, si) => ({ intensity: intensities[si], start: ranges[si].start, items: g.map(({ l }, k) => ({ start: l.start, pos: places[si][k].pos, kind: plan[si][k].kind, side: plan[si][k].side })) })),
    tuning, rng);
  // 演出の詰め込み（行ごとの出方・加工、境目の一瞬の効果、地の色の切り替え）。別の乱数の列なので、上の置き場所・カメラは変わらない
  const fx = planEffects(ranges.map((r, si) => ({
    start: r.start, end: r.end, intensity: intensities[si], tone: intensities[si] >= PAPER_FROM ? 'paper' : 'ink', world: worldIds[si],
    lines: groups[si].map(({ l, i }, k) => ({ index: i, start: l.start, end: Math.max(l.end, l.start + MIN_LINE_SECONDS), emph: !!emphasisSpan(l.text, words), text: l.text, pos: places[si][k].pos, until: lineWindow(groups[si], k, r, tuning).to })),
  })), a.beats, seed, { motifs, fonts, stickers, floods, vessels, exits, unify });
  cutCamera(keys, fx.cuts);
  fx.scenes.forEach((sf, si) => placeProps(sf.back, keys, groups[si], places[si]));
  const scenes = ranges.map((r, si) => {
    const intensity = intensities[si];
    const tone = intensity >= PAPER_FROM ? 'paper' : 'ink';
    // 空間に固定した飾り（トンネル・ちり）で奥行きを出す。ちりは奥を文字の前に、手前（near）を文字のあとに描く。
    // 床の格子（fx.floor）と遠くの図形（fx.shapes）は 2026-10-18 に外した（部品は古い台本のために残す）
    // 世界：tunnel・void 以外は背景の層 fx.world を一番奥に置き、光の筋・縦の筋は置かない（世界の背景とぶつかるため）
    const world = worldById(worldIds[si]);
    const own = !!world?.palette;
    const layers = [{ part: 'bg.vignette', from: r.start, to: r.end }];
    if (own) layers.push({ part: 'fx.world', kind: world.id, from: r.start, to: r.end });
    if (r.start > 0 && tone === 'paper') layers.push({ part: 'fx.flash', from: r.start, to: r.start + FLASH_SECONDS });
    if (!own && tone === 'paper') layers.push({ part: 'fx.streak', on: 'beat', from: r.start, to: r.end });
    const sf = fx.scenes[si];
    if (world?.id === 'tunnel') layers.push({ part: 'fx.tunnel', sides: sf.sides, from: r.start, to: r.end });
    if (!own && tone === 'ink') layers.push({ part: 'fx.rays', on: 'beat', from: r.start, to: r.end });
    layers.push({ part: 'fx.dust', from: r.start, to: r.end }, ...sf.back);
    const g = groups[si];
    g.forEach(({ l, i }, k) => {
      const singEnd = Math.max(l.end, l.start + MIN_LINE_SECONDS);
      const { from, to } = lineWindow(g, k, r, tuning);
      const p = places[si][k];
      const layer = {
        part: 'text.motion', line: i, from, to, pos: p.pos, rot: p.rot, sing: [l.start, singEnd],
        typeSec: typeSeconds(l.start, l.end, Array.from(String(l.text ?? '')).length), sizeMul: p.size,
      };
      const emph = emphasisSpan(l.text, words);
      if (emph) layer.emph = emph;
      const lf = fx.lines.get(i);
      if (lf) { layer.enter = lf.enter; layer.look = lf.look; layer.hold = lf.hold; layer.font = lf.font; layer.set = lf.set; }
      // 消え方と強調語のキメ（「なし」は書かない。キメは強調語のある行だけ）
      if (lf?.exit && lf.exit !== 'none') layer.exit = lf.exit;
      if (lf?.kime && lf.kime !== 'none' && layer.emph) layer.kime = lf.kime;
      if (lf?.sticker) { layer.sticker = lf.sticker; layer.stickerSeed = lf.stickerSeed; } // 文字のあとに貼る飾り
      if (lf?.flood) layer.flood = lf.flood; // 歌詞で画面を埋める組み
      if (lf?.vessels) layer.vessels = [...lf.vessels]; // 文字を載せる器（カットごとに順に使う）
      if (world?.back) layer.back = world.back; // 文字の後ろに敷く台紙
      layer.stay = stayWindow(keys, l.start, singEnd); // 描く係はこの間のカメラで、文字が画面に収まる大きさを決める
      layers.push(layer);
    });
    layers.push({ part: 'fx.dust', near: true, from: r.start, to: r.end }, ...sf.front);
    const scene = { section: r.section, start: r.start, end: r.end, mood: 'S', tone, intensity, world: worldIds[si], layers };
    if (own) scene.ink = journey.times[si] ? paperTime(journey.times[si]) : world.palette(style.colors); // 世界の配色（紙は時間の配色。描く係はこれで描き、地の色の途中切り替えは使わない）
    if (journey.times[si]) scene.time = journey.times[si];
    // 最後の区切り（Outro）：明るく（初期）なら同じ世界の夜明けの配色
    if (own && journey.ending === 'bright' && sectionKind(r.section) === 'outro') { scene.ink = dawnInk(scene.ink, world.id); scene.dawn = true; }
    if (sf.hits.length) scene.hits = sf.hits;
    if (sf.tones.length) scene.tones = sf.tones;
    if (sf.koma > 0) scene.koma = sf.koma;
    return scene;
  });
  return { version: 2, seed, style, tuning, camera: { keys }, scenes, journey: { open: journey.open, ending: journey.ending } };
}

// 行の出る窓：lookAhead 行前の歌い出しから、keepLines 行あとの歌い出しまで（場面の中。同時に出る行の数に上限をつける）。
// 場面の最初の行は、歌い出しまで出さない（カメラが正面に見ているので、場面の頭が歌い出しより前だと先に見えてしまう。2026-10-18）
function lineWindow(g, k, r, tuning) {
  const l = g[k].l;
  const singEnd = Math.max(l.end, l.start + MIN_LINE_SECONDS);
  const from = k === 0 ? Math.max(r.start, l.start) : Math.max(r.start, g[k - tuning.lookAhead]?.l.start ?? r.start);
  let to = Math.min(Math.max(g[k + tuning.keepLines]?.l.start ?? r.end, singEnd), r.end);
  if (!(to > from)) to = from + MIN_LINE_SECONDS;
  return { from, to };
}

/**
 * 曲の最初の行の歌い出しが早すぎる見積もりを直す（2026-10-18。Beyond the clouds の最初の行は、1 文字あたりほかの行の 2 倍の長さで、
 * 歌声より 2 秒ほど前から打ち込まれていた。前に行が無いので、解析が頭をさかのぼりすぎる）。
 * 1 文字あたりの秒数がほかの行の中央値の SLOW_FIRST 倍以上なら、行の終わりから「中央値 × FIRST_PACE × 文字数」前を歌い出しにし、
 * 最初の区切りがその行から始まっていれば、区切りの頭も合わせる。直すときは写しを返す（渡された解析結果は書き換えない）
 */
export function trimSlowFirstLine(a) {
  const lines = Array.isArray(a?.lines) ? a.lines : [];
  if (lines.length < 4) return a;
  const pace = l => {
    const n = Array.from(String(l?.text ?? '')).length;
    const d = l?.end - l?.start;
    return n >= 3 && Number.isFinite(d) && d > 0 ? d / n : NaN;
  };
  const rest = lines.slice(1).map(pace).filter(Number.isFinite).sort((x, y) => x - y);
  if (rest.length < 3) return a;
  const median = rest[rest.length >> 1];
  const first = lines[0];
  if (!(pace(first) >= SLOW_FIRST * median)) return a;
  const start = first.end - median * FIRST_PACE * Array.from(String(first.text)).length;
  if (!(start > first.start)) return a;
  const out = { ...a, lines: [{ ...first, start }, ...lines.slice(1)] };
  const sec = Array.isArray(a.sections) ? a.sections : [];
  if (sec.length && Math.abs(sec[0].start - first.start) < 0.05) out.sections = [{ ...sec[0], start }, ...sec.slice(1)];
  return out;
}

// カット割り：時刻 cuts（行の歌い出し）に着く「到着キー」（rush。cue で探す）の手前の中継点（via）と待機キーを消し、到着を cut にして
// 歌い出しちょうどに置く（到着キーが lag 秒あとでも、切り替えは歌い出し）。
// カメラは前の行を見たまま待って、歌い出しの瞬間に次の行を見る姿勢へ切り替わる（移動しない）。
// くぐり抜け（dive）とワープ（warp）の到着には掛けない（持ち主が気に入った動きを消さない）
function cutCamera(keys, cuts) {
  for (const c of cuts ?? []) {
    const ai = keys.findIndex(k => k.ease === 'rush' && k.shot !== 'dive' && k.shot !== 'warp' && (Number.isFinite(k.cue) ? Math.abs(k.cue - c) < 0.06 : Math.abs(k.t - c) < 0.06));
    if (ai <= 0) continue;
    let j = ai - 1;
    while (j > 0 && keys[j].via) j--;
    if (!(keys[j].t < c)) continue; // 前の行の動き出しが歌い出しより後ろ（行の間隔が極端に短い）なら、カットにしない
    // keys[j] は中継点でない直前のキー。それが待機キー（linear で、前の到着より後）なら、そこまでは前の行を見続ける
    keys.splice(j + 1, ai - (j + 1));
    const arrive = keys[j + 1];
    arrive.ease = 'cut';
    if (Number.isFinite(arrive.cue)) arrive.t = arrive.cue;
    delete arrive.sharp;
  }
}
