// 文字（雰囲気 D・S）：世界に置かれた1行を、カメラから見た位置・大きさ・傾きで描く。
// ・layer.rot があれば「板モード」（S）：空間に固定した向きを持つ板として描く（斜めに見える・遠近で歪む）。
//   歌っている行（layer.sing）だけ明るく打ち込み、前後は薄く浮かべる。rot が無ければ、カメラのほうを向く廊下の文字（D）
// ・1文字ずつ打ち込まれる（行の長さに合わせた秒数 layer.typeSec）
// ・強調する語（layer.emph = [開始, 長さ]）は極太で特大、助詞は細めで小さい
// ・奥の行ほどぼけて薄くなる（ctx.filter は iPhone の Safari で使えないことがあるので、少しずらして重ね描きする）
// ・出方 layer.enter：type（打ち込み）・drop（落ちてくる）・spin（回って出る）・scatter（散らばって集まる）・
//   stretch（縦に伸びて縮む）・random（ばらばらの順にちらついて出る）
// ・加工 layer.look：plain・extrude（奥へ厚みのある立体）・outline（縁取り）・shadow（色のずれた影）・marker（後ろに色の帯）・glow（発光）
// ・落ち着いたあとの動き layer.hold：none・wave（文字ごとに波打つ）・jitter（コマごとにふるえる）・breathe（拍でふくらむ）
// ・境目の一瞬の効果 env.hit：chroma（赤と青に割れる）・echo（大きくなりながら消える残像）
// ・2026-10-18 文字そのものの演出を増やした（render/parts/text-fx.js）：出方・待機・加工に新しい種類、layer.exit（消え方）、
//   layer.kime（強調語のキメ）、env.hit の文字に掛かる一瞬（文字化け・点滅など）。行の線・輪・箱は板の上に描く
import { clamp01, easeOutCubic } from '../timing.js';
import { DEFAULT_TUNING, BAR_PUNCH } from '../../shared/tuning.js';
import { rotate, project, projectPlane } from '../camera.js';
import { hash01 } from '../rand.js';
import { drawBacking } from './backings.js';
import { fxOf, TEXT_FX } from './text-fx.js';
import { TEXT_HIT_KINDS } from '../hits.js';
import { STICKER_BY_ID, drawSticker } from './stickers/index.js';
import { FLOOD_BY_ID, drawFlood } from './flood.js';
import { validVessels, vesselCuts, drawLineVessel, vesselFrac } from './vessel-line.js';

// 書体 layer.font（無い・知らない書体は明朝）。light は普通の文字、heavy は強調語の太さ（太さが1つしかない書体は同じ）
export const TYPEFACES = {
  mincho: { family: '"Shippori Mincho B1", "Hiragino Mincho ProN", serif', light: '500', heavy: '800' },
  gothic: { family: '"Zen Kaku Gothic New", "Hiragino Sans", sans-serif', light: '500', heavy: '900' },
  heavy: { family: '"Dela Gothic One", "Hiragino Sans", sans-serif', light: '400', heavy: '400' },
  hand: { family: '"Yusei Magic", "Hiragino Maru Gothic ProN", sans-serif', light: '400', heavy: '400' },
  dot: { family: '"DotGothic16", "Hiragino Sans", monospace', light: '400', heavy: '400' },
};
// 組み方 layer.set：row（横並び）・tate（縦組み）・jump（1文字ずつ大小と上下）・fill（上下に写しを敷き詰める）・slant（斜めの段と大きな1語）
const TATE_COL = 8;           // 縦組みの1列の文字数の目安（長い行は右から左へ列を折る）
const LATIN = /[A-Za-z0-9'’]/; // 英単語の文字（単語の途中で改行しない）
const TATE_TURN = new Set(Array.from('ー－―〜～…‥-—「」『』（）()'));  // 縦組みで90度回す文字
const TATE_SMALL = new Set(Array.from('、。，．'));                     // 縦組みで右上へ寄せる文字
const FILL_ROWS = 2;          // 敷き詰め：上と下に敷く写しの段数
const FILL_A = 0.16;          // 敷き詰め：写しの薄さ
const SLANT = -0.12;          // 斜めの段の傾き（ラジアン）
const KEY_RUN = /[\p{Script=Han}\p{Script=Katakana}ー々]+/gu;          // 斜めの段で、強調語が無いときに大きくする塊
// 次の2つは調整値（shared/tuning.js）の初期値。実際には env.tune（台本の調整値）を使う
export const TEXT_BASE = DEFAULT_TUNING.textBase;
export const EMPH_SCALE = DEFAULT_TUNING.emphScale;
const PARTICLE_SCALE = 0.7;   // 助詞の大きさ
// 強調語は、ほかの文字のこの倍まで（2026-10-19 方針「主役は歌詞」：強調語だけ大きくてほかが米粒になり、行ごと縮んで読めなかった）
export const EMPH_MAX = 2.5;
const PARTICLES = new Set(Array.from('のはをにがとでもへや'));
const FAR = 6;                // これより奥の行は描かない（廊下の D）
const FAR_PLANE = 14;         // 板モード（S）は、引いた絵でも見えるよう、もっと奥まで描く
// 板モード：カメラに近い板（dz がこの範囲）は薄くなり、手前では描かない（近い板は遠近が崩れるので）。
// 上の端は、行を見ながらカメラが寄りきった距離（VIEW_DIST 1.2 − 寄る距離 drift の上限 0.6 = 0.6）。これより遠ければ必ず濃い。
// 2026-10-19 まで [0.5, 1] で、寄りきった行（dz 0.66）が歌っている最中に 3 割の濃さになっていた
const NEAR_FADE = [0.3, 0.6];
const CLOSE_DZ = 1.0;          // これより近い板は1文字ずつ映す（板1枚の近似は近いと崩れるので。2026-10-18 くぐり抜けのため）
const GLYPH_NEAR = [0.06, 0.2]; // 1文字ずつのとき、文字がこの近さで薄くなり消える（歌っている行の寄りきった距離 0.66 より十分手前）
const EXTRUDE_NEAR = 1;       // 立体の厚みは、これより近い板では描かない（近いと遠近の近似が崩れて塊に見える）
const CENTER = [[0, 0]];
const GHOST = 0.22;           // 板モード：歌う前・まだ打たれていない文字の薄さ
const POP_SECONDS = 0.1;      // 打ち込まれた最新の文字が、1.25倍から縮んで落ち着く秒数
const FADE_SECONDS = 0.3;     // 出番の終わりに消える秒数
const SHARP_LEAD = 0.25;      // 板モード：歌い出しのこの秒数前から、ぼけを外し始める
const MAX_HEIGHT = 0.85;      // 文字のかたまりが画面の高さに占めてよい割合
const ENTER_SECONDS = 0.24;   // 出方（type 以外）で、1文字が出てから落ち着くまでの秒数
const EXTRUDE_DEPTH = 0.09;   // 立体の厚み（世界の単位）
const EXTRUDE_STEPS = 7;      // 厚みを重ね描きする枚数
const CHROMA = ['#ff2d55', '#20d8ff'];
// 文字そのものの演出（render/parts/text-fx.js）の時間
const NEW_ENTER_SECONDS = 0.5; // 新しい出方で、1 文字が出てから落ち着くまで（演出が自分の秒数を持てばそちら）
const EXIT_SECONDS = 0.7;      // 消え方で、1 文字が飛び去るまで
const EXIT_STAGGER = 0.06;     // 消え方で、文字ごとにずらす秒数
const KIME_SECONDS = 0.9;      // 強調語のキメが効いている秒数
const EXIT_AFTER_TYPED = 0.4;  // 消え方は、打ち込みが終わってからこの秒数より前には始めない
// 文字のあとに貼る飾り（render/parts/stickers/）
const STICKER_DELAY = 0.15;      // 打ち込みが終わってから貼るまで
const STICKER_MIN_SECONDS = 0.6; // 貼ってから、少なくともこの秒数は残す
const STICKER_OUT_SECONDS = 0.3; // 消えるまで
const STICKER_INK = '#16121F';   // 後ろに明るい紙を敷いたときの文字の色
const STICKER_C2 = '#FFD23D', STICKER_C3 = '#3DD9FF'; // 飾りの 2・3 番目の色（1 番目は場面の目立たせる色）
// 歌詞で画面を埋める大げさな組み（render/parts/flood.js）
const FLOOD_MIN_SECONDS = 1.2;  // 出始めから、少なくともこの秒数は残す
const FLOOD_OUT_SECONDS = 0.35; // 消えるまで
const FLOOD_A = 0.9;            // 全体の濃さ（文字より少し控えめ）
const FLOOD_BAND = '#FF7A1A';   // 太い帯・テープの色（持ち主が見せたコマのだいだい）
const FLOOD_REGION = 1.15;      // 模様の四角は、カメラが行に寄りきったときの画面のこの倍
const FLOOD_REGION_MAX = 20000; // 模様の四角の上限（板の局所座標）
// 文字を載せる器（render/parts/vessel-line.js）
const VESSEL_MIN_SECONDS = 1.2;  // 歌い出しから、少なくともこの秒数は器を出す
const VESSEL_HOLD = 0.3;         // 歌い終わってから、少なくともこの秒数は器を消し始めない
const VESSEL_OUT_SECONDS = 1;    // 器が消えきるまで（自分で消える器も 0.95 秒で消える）
const VESSEL_PAST_IN = 0.6;      // 器が消え始めてから、板に薄い文字が戻ってくるまで
const SPLIT_FAR = 1e5;          // 本体の行を上下に割って描くときの切り抜きの広さ
const easeOutBack = x => { const c = 1.9; const v = clamp01(x) - 1; return 1 + (c + 1) * v * v * v + c * v * v; };

export function textMotion(ctx, t, layer, scene, env) {
  const text = env.text;
  if (!text) return;
  const pos = layer.pos ?? [0, 0, env.cam.pos[2] + env.viewDist];
  const plane = layer.rot ? (env.projectPlane?.(pos, layer.rot) ?? null) : null;
  if (layer.rot && !plane) return; // 板が真横・カメラの後ろ・向きが不正のときは描かない
  const pr = plane ?? env.project(pos);
  if (!pr || pr.dz > (plane ? FAR_PLANE : FAR)) return;
  // 近い板は1文字ずつ映す（カメラが文字のあいだをくぐり抜けられる。文字ごとに近さで薄くする）。
  // 台紙・色の帯・敷き詰めの写しは、今までどおり板ごとに薄くする（plateNearA）
  // （画面の行列を読めない環境では今までどおり板ごと）。ここではまだ座標を動かしていないので、今の行列が板の外の行列
  const baseTf = plane && pr.dz < CLOSE_DZ && typeof ctx.getTransform === 'function' ? (ctx.getTransform() ?? null) : null;
  const closeUp = !!baseTf;
  const plateNearA = plane ? clamp01((pr.dz - NEAR_FADE[0]) / (NEAR_FADE[1] - NEAR_FADE[0])) : 1;
  const nearA = closeUp ? 1 : plateNearA;
  if (nearA <= 0) return;

  const tune = { ...DEFAULT_TUNING, ...env.tune }; // 一部だけ渡されても、欠けた値は初期値
  const chars = Array.from(text);
  const N = chars.length;
  // 何文字まで打ち込まれたか（まだ0文字なら、並べ直さずに終わる）
  const singFrom = plane ? (layer.sing?.[0] ?? layer.from) : layer.from; // 打ち込みを始める時刻（板モードは歌い出し）
  const u = t - singFrom;
  const typeSec = Math.max(layer.typeSec ?? 0.5, 0.05);
  const enter = layer.enter ?? 'type';
  const look = layer.look ?? 'plain';
  const hold = layer.hold ?? 'none';
  // i 番目の文字が打たれる時刻（歌い出しから）。random は順番をばらばらにする（行ごとに決まった順）
  const rank = Array.from({ length: N }, (_, i) => i);
  if (enter === 'random') rank.sort((x, y) => hash01(layer.line ?? 0, x, 41) - hash01(layer.line ?? 0, y, 41));
  const order = new Array(N);
  rank.forEach((ci, k) => { order[ci] = k; });
  const appearAt = i => (order[i] + 1) * typeSec / N;
  const isShown = i => u >= appearAt(i);
  const shownCount = chars.reduce((n, _, i) => n + (isShown(i) ? 1 : 0), 0);
  if (shownCount <= 0 && !plane) return; // 廊下の D は、打ち込み前は何も描かない（板モードは薄く浮かべる）
  const sizeMul = layer.sizeMul > 0 && Number.isFinite(layer.sizeMul) ? layer.sizeMul : 1; // 行ごとの大きさの倍率
  const skew = Number.isFinite(layer.skew) ? layer.skew : 0;                              // 斜体のゆがみ
  const U = Math.min(env.width, env.height) * tune.textBase * sizeMul; // 倍率 1 の文字の大きさ（scale を掛ける前）
  const emph = layer.emph;
  const face = TYPEFACES[layer.font] ?? TYPEFACES.mincho;
  const isEmph = i => !!emph && i >= emph[0] && i < emph[0] + emph[1];
  const maxW = env.width * 0.9 * env.viewDist;
  // 英単語の強調は丸ごと大きくするので、単語が行の幅（の 85%）に収まる大きさまでに抑える（日本語の強調は最大 4 文字なので今までどおり）
  const emphBase = Math.min(tune.emphScale, EMPH_MAX);
  let emphF = emphBase;
  if (emph && chars.slice(emph[0], emph[0] + emph[1]).every(c => LATIN.test(c))) {
    ctx.font = `${face.heavy} ${U}px ${face.family}`;
    const w1 = ctx.measureText(chars.slice(emph[0], emph[0] + emph[1]).join('')).width;
    if (w1 > 0) emphF = Math.min(emphF, maxW * 0.85 / w1);
  }
  const styleOf = i => {
    if (isEmph(i)) return { w: face.heavy, f: emphF, heavy: true };
    if (PARTICLES.has(chars[i])) return { w: face.light, f: PARTICLE_SCALE };
    return { w: face.light, f: 1 };
  };
  const fontOf = st => `${st.w} ${U * st.f}px ${face.family}`;
  let curFont = '';
  const setFont = f => { if (f !== curFont) { ctx.font = f; curFont = f; } };
  const lay = layoutGlyphs(layer.set, chars, {
    U, maxW, line: layer.line ?? 0, emphScale: emphF === emphBase ? emphBase : emphF / 1.25, emphMax: EMPH_MAX, emph, styleOf, // 組み方 slant は強調語を emphScale の 1.25 倍にする
    measure: (ch, st) => { setFont(fontOf(st)); return ctx.measureText(ch).width; },
  });
  const rows = lay.rows;
  const total = lay.total;

  // 板モード：出てくるときはふわっと現れ、歌い終えた行は pastHold 秒待ってから pastFade 秒で pastLevel まで落ち、歌う前と打たれていない文字は GHOST
  const fadeIn = plane ? clamp01((t - layer.from) / FADE_SECONDS) : 1;
  const singTo = layer.sing?.[1];
  const past = plane && Number.isFinite(singTo) ? clamp01((t - singTo - tune.pastHold) / Math.max(0.05, tune.pastFade)) : 0;
  // 奥のぼけと薄さ。板モードで歌っている行はぼかさない（2026-10-19：カメラは歌い出しの 0.65 秒あとに着くので、
  // 飛んでいる途中の遠い行がぼけて薄く、歌い出しのコマに読める字が無かった）。歌い出しの SHARP_LEAD 秒前から少しずつくっきりにし、
  // 歌い終えて薄れていく（past）のと一緒に、また奥の行としてぼける
  const sharp = plane && Number.isFinite(singFrom) && Number.isFinite(singTo) ? clamp01((t - singFrom + SHARP_LEAD) / SHARP_LEAD) * (1 - past) : 0;
  const blurK = clamp01((pr.dz - env.viewDist) / tune.blurRange) * (1 - sharp);
  const blurPx = blurK * U * 0.35;
  const alpha = (1 - 0.5 * blurK) * clamp01((layer.to - t) / FADE_SECONDS);
  // 文字を載せる器（板モードだけ）：歌い出しから、歌い終わって pastHold 秒とカメラが行を離れ始める時刻の早いほう（最低 1.2 秒、歌い終わり＋0.3 秒より前にはしない）まで、
  // 行の文字の代わりに器が文字を描く。器が消えると、板には薄い文字（pastLevel）が戻ってくる
  const vesselIds = plane ? validVessels(layer.vessels) : [];
  const vesselLine = vesselIds.length > 0;
  let vesselEnd = Infinity;
  if (vesselLine) {
    const leave = Array.isArray(layer.stay) && Number.isFinite(layer.stay[1]) ? layer.stay[1] : Infinity;
    // 器は文字そのものなので、カメラが歌い終わる前に離れ始めても、歌い終わり（＋VESSEL_HOLD）までは消さない（離れていく行と一緒に遠ざかる）
    vesselEnd = Math.max(singFrom + VESSEL_MIN_SECONDS, Math.min(Number.isFinite(singTo) ? singTo + tune.pastHold : Infinity, leave));
    if (Number.isFinite(singTo)) vesselEnd = Math.max(vesselEnd, singTo + VESSEL_HOLD);
    if (!Number.isFinite(vesselEnd)) vesselEnd = singFrom + typeSec + VESSEL_MIN_SECONDS;
  }
  const vesselNow = vesselLine && t >= singFrom && t < vesselEnd + VESSEL_OUT_SECONDS;
  const activeA = vesselLine ? tune.pastLevel * clamp01((t - vesselEnd) / VESSEL_PAST_IN) : 1 - (1 - tune.pastLevel) * past;
  const charAlpha = i => (plane ? (isShown(i) ? activeA : GHOST) : 1);

  // 立体の厚み：板の奥向き（法線）へ少し進めた所が画面でどこに映るかを、板の局所座標のずれに直す
  let extrudeVec = null;
  if (look === 'extrude') {
    if (plane) {
      const n = rotate([0, 0, 1], layer.rot);
      const back = env.projectPlane?.([pos[0] + n[0] * EXTRUDE_DEPTH, pos[1] + n[1] * EXTRUDE_DEPTH, pos[2] + n[2] * EXTRUDE_DEPTH], layer.rot);
      const [a, b, c, d] = plane.m;
      const det = a * d - b * c;
      if (back && Math.abs(det) > 1e-9) {
        const ex = back.m[4] - plane.m[4], ey = back.m[5] - plane.m[5];
        extrudeVec = [(d * ex - c * ey) / det, (-b * ex + a * ey) / det];
      }
    } else {
      extrudeVec = [U * 0.05, U * 0.07];
    }
    // カメラに近すぎる板（薄くして消す距離）や、厚みが文字の 3 割を超えるほど崩れたときは描かない（近いと遠近の近似が崩れて塊に見える）
    if (extrudeVec && (!extrudeVec.every(Number.isFinite) || Math.hypot(extrudeVec[0], extrudeVec[1]) > U * 0.3 || (plane && pr.dz < EXTRUDE_NEAR))) extrudeVec = null;
  }
  // 長い行が画面の高さを超えないように縮める（組み方によっては横幅も）。
  // 板モードで寄っている間（layer.stay）があれば、その間のカメラで画面の内側に収まる縮め（stayFit）を使う（行の間は変えない）
  const sf = plane ? stayFit(layer, lay, pos, env, skew, U) : null;
  const fitH = total > 0 ? env.height * MAX_HEIGHT / (total * pr.scale) : 1;
  const fitW = lay.width > 0 ? env.width * 0.9 * env.viewDist / lay.width : 1;
  const fit = sf ?? Math.min(1, fitH, fitW);
  if (plane) {
    ctx.transform(...plane.m); // 板の局所座標（短辺の画素）→ 画面
  } else {
    ctx.translate(pr.x, pr.y);
    ctx.rotate((layer.roll ?? 0) - env.cam.roll);
    ctx.scale(pr.scale, pr.scale);
  }
  if (fit !== 1) ctx.scale(fit, fit);
  if (skew) ctx.transform(1, 0, skew, 1, 0, 0);
  if (lay.rot) ctx.rotate(lay.rot);
  if (plane) {
    // 文字の外枠の四隅が画面のどこに描かれたか（確認ページが、直している行の枠に使う）
    const cs = glyphCorners(lay, U, skew);
    const k = fit, m = plane.m;
    if (cs) DRAWN_BOX.set(layer, cs.map(([lx, ly]) => [m[0] * lx * k + m[2] * ly * k + m[4], m[1] * lx * k + m[3] * ly * k + m[5]]));
  }
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  let fg = env.ink?.fg ?? (env.tone === 'paper' ? '#101010' : '#F4F4F4'); // 後ろに明るい紙の飾りを貼っている間は濃い色に変える
  const lightBg = env.ink ? env.ink.light : env.tone === 'paper';
  const accent = env.ink?.accent ?? env.colors?.[0] ?? '#5B8CFF'; // 世界のある場面は世界の目立たせる色
  ctx.fillStyle = fg;
  const hit = env.hit ?? {};

  const blurred = blurPx >= 0.6;
  // ぼけの重ね描き：中心と、周りの 6 点（軽い版は左右の 2 点）
  const ring = env.lite ? 2 : 6;
  const offsets = blurred
    ? [[0, 0], ...Array.from({ length: ring }, (_, k) => [Math.cos(k * 2 * Math.PI / ring) * blurPx, Math.sin(k * 2 * Math.PI / ring) * blurPx])]
    : [[0, 0]];
  if (!plane) ctx.globalAlpha = blurred ? alpha * 0.3 : alpha;

  // ---- 文字そのものの演出（render/parts/text-fx.js。2026-10-18 持ち主が見本で選んだもの） ----
  const enterFx = fxOf('enter', enter);
  const holdFx = fxOf('hold', hold);
  const lookFx = fxOf('look', look);
  // 消え方：明るい文字が消え方を演じて飛び去り、その場には薄い文字（pastLevel）が残る（板モードだけ）。
  // 始まりは、歌い終わって pastHold 秒待った時刻と、カメラがこの行を離れ始める時刻（layer.stay の終わり）の早いほう。
  // ただし打ち込みが終わって EXIT_AFTER_TYPED 秒より前にはしない（2026-10-18：カメラは歌い終わる約 1.4 秒前に次の行へ動き出すので、
  // 歌い終わってからだと 44 行のうち 5 行ほどしか画面に映らなかった）
  const exitFx = plane && Number.isFinite(singTo) && !vesselLine ? fxOf('exit', layer.exit) : null;
  const kimeFx = emph && !vesselLine ? fxOf('kime', layer.kime) : null;
  // 境目の一瞬（文字に掛かるもの）：いちばん強いものを 1 つ
  let hitFx = null;
  let hitQ = 0.02;
  for (const id of TEXT_HIT_KINDS) if ((hit[id] ?? 0) > hitQ && TEXT_FX.hit[id]) { hitQ = Math.min(1, hit[id]); hitFx = TEXT_FX.hit[id]; }
  const enterDur = enterFx?.dur ?? NEW_ENTER_SECONDS;
  const leaveAt = Array.isArray(layer.stay) && Number.isFinite(layer.stay[1]) ? layer.stay[1] : Infinity;
  const exitAt = exitFx ? Math.max(singFrom + typeSec + EXIT_AFTER_TYPED, Math.min(singTo + tune.pastHold, leaveAt)) : Infinity;
  const exitStag = exitFx?.stagger ?? EXIT_STAGGER;
  const exitDur = exitFx?.dur ?? EXIT_SECONDS;
  // 文字のあとに貼る飾り（板モードだけ）：打ち込みが終わって少しして貼り、消え方の始まり（無ければ、歌い終わって pastHold 秒と
  // カメラが行を離れ始める時刻の早いほう）で消える。2026-10-18 持ち主「字の上にかぶるのは下のほうがいい」→ 文字の後ろに描く
  const stickerDef = plane && !vesselLine ? STICKER_BY_ID[layer.sticker] ?? null : null;
  const pasteAt = singFrom + typeSec + STICKER_DELAY;
  const unstickAt = exitFx ? exitAt : Math.max(pasteAt + STICKER_MIN_SECONDS, Math.min(Number.isFinite(singTo) ? singTo + tune.pastHold : Infinity, leaveAt));
  const stickerOut = clamp01((t - unstickAt) / STICKER_OUT_SECONDS);
  const stickerOn = !!stickerDef && t >= pasteAt && stickerOut < 1;
  if (stickerOn && stickerDef.inkText && !lightBg) fg = STICKER_INK;
  // 歌詞で画面を埋める組み（板モードだけ）：歌い出しから行の後ろに描き、消え方の始まり（無ければ、歌い終わって pastHold 秒と
  // カメラが行を離れ始める時刻の早いほう）で消える
  const floodDef = plane && !vesselLine ? FLOOD_BY_ID[layer.flood] ?? null : null;
  const floodEnd = Math.max(singFrom + FLOOD_MIN_SECONDS, exitFx ? exitAt : Math.min(Number.isFinite(singTo) ? singTo + tune.pastHold : Infinity, leaveAt));
  const floodOut = clamp01((t - floodEnd) / FLOOD_OUT_SECONDS);
  const floodOn = !!floodDef && t >= singFrom && floodOut < 1;
  const exitQ = i => (exitFx ? (t - exitAt - (exitFx.rev ? N - 1 - i : i) * exitStag) / exitDur : -1);
  // キメ：強調語のうち最初に打たれる文字の時刻から KIME_SECONDS 秒
  let kimeAt = Infinity;
  if (kimeFx) for (let i = emph[0]; i < Math.min(N, emph[0] + emph[1]); i++) kimeAt = Math.min(kimeAt, appearAt(i));
  const kimeQ = (u - kimeAt) / KIME_SECONDS;
  const kimeOn = !!kimeFx && kimeQ >= 0 && kimeQ < 1;
  // 打たれた文字の濃さ（ほかは今までどおり activeA）。消え方のある行は、消え方が始まった文字はいったん消え、
  // 飛び去る途中（進み 0.6）から薄い文字（pastLevel）がふわっと戻る（同じ濃さのまま残ると、飛び去ったのが分かりにくかった）
  const glyphLevel = i => {
    if (!exitFx) return activeA;
    const q = exitQ(i);
    return q > 0 ? tune.pastLevel * clamp01((q - 0.6) / 0.6) : 1;
  };

  // 行・強調語の外枠（板の局所座標。敷き詰めの写しは除く）。行の飾り（線・輪・箱）に使う
  const boundsOf = pick => {
    let l = Infinity, r = -Infinity, tp = Infinity, b = -Infinity, base = -Infinity;
    for (const row of rows) {
      if (row.filler) continue;
      for (const g of row.glyphs) {
        if (g.filler || !pick(g)) continue;
        const px = U * g.st.f;
        l = Math.min(l, g.x); r = Math.max(r, g.x + g.w); tp = Math.min(tp, g.y - px * 0.9); b = Math.max(b, g.y + px * 0.15); base = Math.max(base, g.y);
      }
    }
    return r > l && b > tp ? { left: l, right: r, top: tp, bottom: b, base, cx: (l + r) / 2, cy: (tp + b) / 2, r: Math.max(r - l, b - tp) / 2 } : null;
  };
  const L = boundsOf(() => true);
  const E = emph ? boundsOf(g => isEmph(g.i)) : null;
  let lastRight = -Infinity;
  for (const row of rows) for (const g of row.glyphs) if (!g.filler && isShown(g.i)) lastRight = Math.max(lastRight, g.x + g.w);
  let curOffsets = offsets;
  const P = {
    px: U, t, step: Math.floor(t * 24), n: N, fg, accent, bg: env.ink?.bg ?? (lightBg ? '#F2F1EC' : '#000000'), light: lightBg,
    L: L ?? { left: 0, right: 0, top: 0, bottom: 0, base: 0, cx: 0, cy: 0, r: 0 }, E: E ?? L, gA: 1, lineQ: 0, lastRight, lite: !!env.lite,
    singTo: Number.isFinite(singTo) ? singTo : Infinity,
  };
  // 1 文字を塗る（ぼけの重ね描き・色ずれ・発光・ぼけ・入れ替えた文字に対応）。o：{color, alpha, dx, dy, once}
  P.fill = (c, gg, s, o = {}) => {
    const a = P.gA * (s?.a ?? 1) * (o.alpha ?? 1);
    if (!(a > 0.003)) return;
    const ch = s?.ch ?? gg.ch;
    if (gg.font !== curFont) { c.font = gg.font; curFont = gg.font; }
    const x = gg.x + (o.dx ?? 0), y = gg.y + (o.dy ?? 0);
    if (!o.once && s?.split > 0.3) {
      c.save();
      c.globalCompositeOperation = lightBg ? 'multiply' : 'lighter';
      c.globalAlpha = a * 0.9;
      c.fillStyle = CHROMA[0]; c.fillText(ch, x - s.split, y);
      c.fillStyle = CHROMA[1]; c.fillText(ch, x + s.split, y);
      c.restore();
    }
    c.fillStyle = o.color ?? s?.color ?? fg;
    if (!o.once && s?.glow && !env.lite && !blurred) {
      c.save(); c.shadowColor = accent; c.shadowBlur = gg.px * 0.5 * (s.glow === true ? 1 : s.glow); c.globalAlpha = a; c.fillText(ch, x, y); c.restore();
      return;
    }
    if (!o.once && s?.blur >= 0.6) {
      c.globalAlpha = a * 0.3; c.fillText(ch, x, y);
      for (let k = 0; k < (env.lite ? 2 : 6); k++) { const th = k * 2 * Math.PI / (env.lite ? 2 : 6); c.fillText(ch, x + Math.cos(th) * s.blur, y + Math.sin(th) * s.blur); }
      return;
    }
    c.globalAlpha = a;
    for (const [ox, oy] of o.once ? CENTER : curOffsets) c.fillText(ch, x + ox, y + oy);
  };
  const glyphOf = (g, px) => ({ i: g.i, ch: g.ch, x: g.x, y: g.y, w: g.w, px, font: fontOf(g.st), cx: g.x + g.w / 2, cy: g.y - px * 0.35 });

  // 落ち着いたあとの動き（After Effects の範囲セレクタのように、文字の番号で少しずつずらす）。null なら動きなし
  const holdMotion = (g, px) => {
    switch (hold) {
      case 'wave': return { tx: 0, ty: Math.sin(t * 5 - g.i * 0.7) * px * 0.08, rot: Math.sin(t * 5 - g.i * 0.7 - 1) * 0.06, sx: 1, sy: 1, a: 1 };
      case 'jitter': { const st = Math.floor(t * 12); return { tx: (hash01(st, g.i, 61) - 0.5) * px * 0.06, ty: (hash01(st, g.i, 62) - 0.5) * px * 0.06, rot: (hash01(st, g.i, 63) - 0.5) * 0.08, sx: 1, sy: 1, a: 1 }; }
      case 'breathe': { const b = env.beat?.index >= 0 ? 1 - env.beat.phase : 0; const k = 1 + 0.08 * b * b * Math.max(0.3, clamp01(env.intensity)); return { tx: 0, ty: 0, rot: 0, sx: k, sy: k, a: 1 }; }
      default: return null;
    }
  };
  // 1文字の出方の動き（今までの出方）。null なら動きなし（落ち着いた文字）
  const glyphMotion = (g, px) => {
    if (!isShown(g.i)) return null;
    const since = u - appearAt(g.i);
    if (enter === 'type' || since >= ENTER_SECONDS) {
      if (enter === 'type' && since < POP_SECONDS) { // 打ち込まれたばかりの文字は、1.25倍から縮んで落ち着く
        const k = 1.25 - 0.25 * easeOutCubic(since / POP_SECONDS);
        return { tx: 0, ty: 0, rot: 0, sx: k, sy: k, a: 1 };
      }
      return null;
    }
    const q = clamp01(since / ENTER_SECONDS);
    const e = easeOutCubic(q);
    const r1 = hash01(layer.line ?? 0, g.i, 51) - 0.5;
    const r2 = hash01(layer.line ?? 0, g.i, 52) - 0.5;
    switch (enter) {
      case 'drop': return { tx: 0, ty: -(1 - easeOutBack(q)) * px * 1.4, rot: 0, sx: 1, sy: 1, a: clamp01(q * 3) };
      case 'spin': { const k = 0.2 + 0.8 * easeOutBack(q); return { tx: 0, ty: 0, rot: (1 - e) * Math.PI * 0.9 * (r1 < 0 ? -1 : 1), sx: k, sy: k, a: clamp01(q * 2.5) }; }
      case 'scatter': return { tx: r1 * px * 4 * (1 - e), ty: r2 * px * 4 * (1 - e), rot: r1 * 2.4 * (1 - e), sx: 1, sy: 1, a: clamp01(q * 2) };
      case 'stretch': return { tx: 0, ty: 0, rot: 0, sx: 0.45 + 0.55 * e, sy: 1 + 2.6 * (1 - e), a: clamp01(q * 3) };
      case 'random': return { tx: 0, ty: 0, rot: 0, sx: 1, sy: 1, a: hash01(Math.floor(t * 24), g.i, 53) < 0.35 + 0.65 * q ? 1 : 0.15 };
      default: return null;
    }
  };
  // 打たれた文字の姿と塗り方：出方 → 落ち着いたあとの動き → 一瞬の効果 → キメ（塗り方は後のものが勝つ。無ければ加工の塗り方）
  const glyphState = (g, px, gg) => {
    let s = null, paint = null, pq = 0;
    const since = u - appearAt(g.i);
    if (enterFx && since < enterDur) {
      const q = clamp01(since / enterDur);
      s = mergeState(null, enterFx.glyph ? enterFx.glyph(q, gg, P) : null, px);
      if (enterFx.paint) { paint = enterFx.paint; pq = q; }
    } else {
      const settled = enterFx || enter === 'type' ? since >= (enterFx ? enterDur : POP_SECONDS) : since >= ENTER_SECONDS;
      if (!enterFx) s = mergeState(null, glyphMotion(g, px), px);
      if (settled) {
        if (holdFx) {
          s = mergeState(s, holdFx.glyph ? holdFx.glyph(0, gg, P) : null, px);
          if (holdFx.paint) { paint = holdFx.paint; pq = 0; }
        } else s = mergeState(s, holdMotion(g, px), px);
      }
    }
    if (hitFx) {
      s = mergeState(s, hitFx.glyph ? hitFx.glyph(hitQ, gg, P) : null, px);
      if (hitFx.paint) { paint = hitFx.paint; pq = hitQ; }
    }
    if (kimeOn && isEmph(g.i)) {
      s = mergeState(s, kimeFx.glyph ? kimeFx.glyph(kimeQ, gg, P) : null, px);
      if (kimeFx.paint) { paint = kimeFx.paint; pq = kimeQ; }
    }
    if (!paint && lookFx) {
      if (lookFx.glyph) s = mergeState(s, lookFx.glyph(1, gg, P), px);
      paint = lookFx.paint ?? null;
      pq = 1;
    }
    return { s, paint, pq };
  };
  // 座標を文字の所へ動かす（近い板は文字ごとに映し直す・切り口・姿の移動と回転と伸び）。描かない文字は null（このときは restore 済み）
  const place = (g, px, s) => {
    ctx.save();
    let glyphA = 1;
    const half = g.w / 2;
    if (baseTf) {
      // この文字の中心の世界の位置を求め、そこで板を映し直す（板の局所 → 組み方の回転・斜体・fit → 世界）
      const cx = g.x + half, cy = g.y - px * 0.35;
      let lx = cx, ly = cy;
      if (lay.rot) { const c = Math.cos(lay.rot), s2 = Math.sin(lay.rot); [lx, ly] = [lx * c - ly * s2, lx * s2 + ly * c]; }
      if (skew) lx += skew * ly;
      lx *= fit; ly *= fit;
      const short = Math.min(env.width, env.height);
      const ex = rotate([1, 0, 0], layer.rot), ey = rotate([0, 1, 0], layer.rot);
      const wp = [0, 1, 2].map(q => pos[q] + (ex[q] * lx + ey[q] * ly) / short);
      const gp = env.projectPlane?.(wp, layer.rot);
      if (!gp) { ctx.restore(); return null; }
      glyphA = clamp01((gp.dz - GLYPH_NEAR[0]) / (GLYPH_NEAR[1] - GLYPH_NEAR[0]));
      if (glyphA <= 0) { ctx.restore(); return null; }
      ctx.setTransform(baseTf);
      ctx.transform(...gp.m);
      if (fit !== 1) ctx.scale(fit, fit);
      if (skew) ctx.transform(1, 0, skew, 1, 0, 0);
      if (lay.rot) ctx.rotate(lay.rot);
      ctx.translate(-cx, -cy);
    }
    // 切り口（せり上がる・沈む・ぬぐう・焼ける）：文字のもとの場所の枠で切る（動かす前に）
    if (s && (s.mask || Number.isFinite(s.clipX) || Number.isFinite(s.cut))) {
      const l = Number.isFinite(s.clipX) ? s.clipX : g.x - px * 0.3;
      const top = g.y - px * 0.95 + (Number.isFinite(s.cut) ? s.cut : 0) * px * 1.15;
      ctx.beginPath();
      ctx.rect(l, top, Math.max(0, g.x + g.w + px * 0.3 - l), Math.max(0, g.y + px * 0.2 - top));
      ctx.clip();
    }
    const moving = s && (s.tx || s.ty || s.rot || s.skew || s.sx !== 1 || s.sy !== 1);
    if (moving || g.turn) {
      const cx = g.x + half, py = g.y - px * 0.35 + (Number.isFinite(s?.pivot) ? s.pivot : 0) * px;
      ctx.translate(cx + (s?.tx ?? 0), py + (s?.ty ?? 0));
      const rot = (s?.rot ?? 0) + (g.turn ?? 0);
      if (rot) ctx.rotate(rot);
      if (s?.skew) ctx.transform(1, 0, s.skew, 1, 0, 0);
      if (s && (s.sx !== 1 || s.sy !== 1)) ctx.scale(s.sx, s.sy);
      ctx.translate(-cx, -py);
    }
    return glyphA;
  };

  // 文字を載せる器：器が出ている間は、行の文字・台紙・飾りの代わりに器だけを描く（組み方の回転・斜体は戻して、まっすぐ置く）
  if (vesselNow) {
    const reg = vesselRegion(layer, plane, fit, env, pos, tune);
    if (reg) {
      if (lay.rot) ctx.rotate(-lay.rot);
      if (skew) ctx.transform(1, 0, -skew, 1, 0, 0);
      drawLineVessel(ctx, {
        ids: vesselIds, cuts: vesselCuts(chars, emph, Number.isFinite(singTo) && singTo > singFrom ? singTo - singFrom : typeSec, vesselEnd - singFrom), u, W: reg[0], H: reg[1],
        pal: { bg: P.bg, fg, accent, band: FLOOD_BAND, light: lightBg }, face, beatLen: env.beatLen, ga: alpha * fadeIn * plateNearA,
      });
    }
    return;
  }

  // 歌詞で画面を埋める組み：行の文字・台紙より先（いちばん後ろ）に描く。四角は、カメラが行に寄りきったときの画面くらい
  let floodO = null, floodSplit = { gap: 0, cy: 0 };
  if (floodOn && L) {
    const reg = floodRegion(layer, plane, fit, env, pos);
    if (reg) {
      const glyphs = [];
      for (const r of rows) {
        if (r.filler) continue;
        for (const g of r.glyphs) if (!g.filler) glyphs.push({ ch: g.ch, x: g.x, y: g.y, w: g.w, px: U * g.st.f, font: fontOf(g.st), e: isEmph(g.i) });
      }
      floodO = {
        W: reg[0], H: reg[1], T: t - singFrom, beat: { ...(env.beat ?? {}), len: env.beatLen }, pal: { bg: P.bg, fg, accent, band: FLOOD_BAND, light: lightBg },
        face, chars, emph, glyphs, px: U, ga: (plane ? alpha * fadeIn * plateNearA : alpha) * (1 - floodOut) * FLOOD_A,
      };
      floodSplit = drawFlood(ctx, floodDef, floodO, 'draw');
      curFont = '';
    }
  }

  // 世界の台紙：行の文字（敷き詰めの写しは除く）の外枠に、文字より先に敷く（板モードだけ）
  if (plane && layer.back) {
    let left = Infinity, right = -Infinity, upper = Infinity, lower = -Infinity;
    for (const r of rows) {
      if (r.filler) continue;
      for (const g of r.glyphs) {
        if (g.filler) continue;
        const px = U * g.st.f;
        left = Math.min(left, g.x); right = Math.max(right, g.x + g.w);
        upper = Math.min(upper, g.y - px * 0.88); lower = Math.max(lower, g.y + px * 0.14);
      }
    }
    if (right > left && lower > upper) {
      drawBacking(ctx, layer.back, { x: left, y: upper, w: right - left, h: lower - upper }, env, t, alpha * fadeIn * plateNearA * (shownCount > 0 ? activeA : GHOST), layer.line ?? 0, U);
    }
  }

  // 行の飾り（線・輪・箱など）：出方・消え方・加工・キメ・一瞬の効果の pre（文字の後ろ）と post（文字の前）
  const lineA = plane ? alpha * fadeIn * plateNearA : alpha;
  const hooks = [];
  if (L && shownCount > 0) {
    if (enterFx && (enterFx.pre || enterFx.post)) hooks.push({ fx: enterFx, q: clamp01(u / (typeSec + enterDur)), a: lineA * activeA });
    if (lookFx && (lookFx.pre || lookFx.post)) hooks.push({ fx: lookFx, q: 1, a: lineA * activeA });
    if (kimeOn && E && (kimeFx.pre || kimeFx.post)) hooks.push({ fx: kimeFx, q: kimeQ, a: lineA * activeA });
    if (hitFx && (hitFx.pre || hitFx.post)) hooks.push({ fx: hitFx, q: hitQ, a: lineA * activeA });
    if (exitFx && (exitFx.pre || exitFx.post)) {
      const q = (t - exitAt) / (N * exitStag + exitDur);
      if (q > 0 && q < 1) hooks.push({ fx: exitFx, q, a: lineA });
    }
  }
  if (exitFx) P.lineQ = clamp01((t - exitAt) / (N * exitStag + exitDur));
  const drawHooks = which => {
    for (const h of hooks) {
      if (!h.fx[which]) continue;
      ctx.save();
      P.gA = h.a;
      const lq = P.lineQ;
      if (h.fx === exitFx) P.lineQ = h.q;
      h.fx[which](ctx, P, h.q);
      P.lineQ = lq;
      ctx.restore();
      curFont = '';
    }
  };
  drawHooks('pre');
  if (stickerOn && L) {
    P.gA = lineA;
    const word = (emph ? chars.slice(emph[0], emph[0] + emph[1]) : chars.slice(0, 6)).join('');
    const beat = env.beat?.index >= 0 && Number.isFinite(env.beat.phase) ? Math.pow(1 - clamp01(env.beat.phase), 3) : 0;
    drawSticker(ctx, stickerDef, P, { t: t - pasteAt, out: stickerOut, word, font: face.family, colors: [accent, STICKER_C2, STICKER_C3], seed: layer.stickerSeed, beat });
    P.gA = 1;
    curFont = '';
  }

  const drawRows = () => rows.forEach(r => {
    // 色の帯（蛍光ペン）：打たれた文字の下半分に敷く。敷き詰めの写しには敷かない。
    // 2026-10-18 文字の高さの 7 割の帯に色の文字だと読みにくい（持ち主）→ 下側だけの細めの帯にして、文字はふつうの色
    if (look === 'marker' && !r.filler) {
      let right = -Infinity, leftmost = Infinity, upper = Infinity, lower = -Infinity;
      for (const g of r.glyphs) {
        if (!isShown(g.i)) continue;
        const px = U * g.st.f;
        leftmost = Math.min(leftmost, g.x);
        right = Math.max(right, g.x + g.w);
        upper = Math.min(upper, g.y - px * 0.32);
        lower = Math.max(lower, g.y + px * 0.1);
      }
      if (right > leftmost) {
        ctx.save();
        ctx.globalAlpha = (plane ? alpha * fadeIn * plateNearA * activeA : alpha) * 0.85;
        ctx.fillStyle = accent;
        ctx.fillRect(leftmost - U * 0.08, upper, right - leftmost + U * 0.16, lower - upper);
        ctx.restore();
      }
    }
    for (const g of r.glyphs) {
      const shownNow = isShown(g.i);
      if (!shownNow && (!plane || g.filler)) continue;
      setFont(fontOf(g.st));
      const px = U * g.st.f;
      // 敷き詰めの写し：打たれた文字だけ、薄く1回描く（強調語は強調色）
      if (g.filler) {
        ctx.globalAlpha = (plane ? alpha * fadeIn * plateNearA * activeA : alpha) * FILL_A * (isEmph(g.i) ? 2.5 : 1);
        ctx.fillStyle = isEmph(g.i) ? accent : fg;
        ctx.fillText(g.ch, g.x, g.y);
        continue;
      }
      // 先に浮かべる薄い文字（まだ打たれていない文字）は、ぼけの重ね描きをせず中心の1回だけ（重さ対策。濃さで補う）
      const glyphOffsets = plane && !shownNow ? CENTER : offsets;
      const blurMul = blurred ? (glyphOffsets === CENTER ? 0.6 : 0.3) : 1;
      const baseA = plane ? alpha * fadeIn * nearA * (shownNow ? glyphLevel(g.i) : GHOST) * blurMul : (blurred ? alpha * 0.3 : alpha);
      const gg = glyphOf(g, px);
      const st = shownNow ? glyphState(g, px, gg) : { s: null, paint: null, pq: 0 };
      const s = st.s;
      if (s?.hide) continue;
      const glyphA = place(g, px, s);
      if (glyphA == null) continue;
      const X = g.x, Y = g.y, half = g.w / 2;
      const a = baseA * (s?.a ?? 1) * glyphA;
      curOffsets = glyphOffsets;
      P.gA = baseA * glyphA;
      // 本体はぼけの重ね描きをする。飾りの写し（影・色ずれ）は 1 回だけ（once）
      const fill = (color, alphaMul, dx = 0, dy = 0, once = false) => {
        ctx.globalAlpha = a * alphaMul;
        ctx.fillStyle = color;
        for (const [ox, oy] of once ? CENTER : glyphOffsets) ctx.fillText(g.ch, X + ox + dx, Y + oy + dy);
      };
      if (shownNow) {
        // 立体の厚み：奥から手前へ、暗い色で重ねる
        if (extrudeVec) {
          const steps = env.lite || blurred ? 3 : EXTRUDE_STEPS; // ぼけた奥の行は厚みを粗く
          ctx.fillStyle = lightBg ? '#6b6660' : accent;
          for (let k = steps; k >= 1; k--) {
            const f = k / steps;
            ctx.globalAlpha = a * (0.9 - 0.4 * f);
            ctx.fillText(g.ch, X + extrudeVec[0] * f, Y + extrudeVec[1] * f);
          }
        }
        if (look === 'shadow') fill(accent, 0.85, px * 0.07, px * 0.07, true);
        // 発光：強調色のにじんだ光を下に敷く（ぼけた奥の行・軽い版は飛ばす）
        if (look === 'glow' && !blurred && !env.lite) {
          ctx.save();
          ctx.shadowColor = accent;
          ctx.shadowBlur = px * 0.5;
          fill(lightBg ? accent : fg, 0.9, 0, 0, true);
          ctx.restore();
        }
        // 色ずれ：赤と青に左右へ割れる（暗い地は光を足す、明るい地は掛け合わせる）
        if (hit.chroma > 0.02) {
          const d = px * 0.12 * Math.min(1.2, hit.chroma);
          ctx.save();
          ctx.globalCompositeOperation = lightBg ? 'multiply' : 'lighter';
          fill(CHROMA[0], 0.9, -d, 0, true);
          fill(CHROMA[1], 0.9, d, 0, true);
          ctx.restore();
        }
        // 残像：大きくなりながら薄れる写し
        if (hit.echo > 0.02 && !env.lite) {
          for (let k = 1; k <= 3; k++) {
            const sc = 1 + 0.18 * k * (1.2 - Math.min(1, hit.echo));
            ctx.save();
            ctx.translate(X + half, Y - px * 0.35);
            ctx.scale(sc, sc);
            ctx.translate(-X - half, -Y + px * 0.35);
            ctx.globalAlpha = a * Math.min(1, hit.echo) * 0.35 / k;
            ctx.fillStyle = fg;
            ctx.fillText(g.ch, X, Y);
            ctx.restore();
          }
        }
      }
      if (shownNow && look === 'outline' && !g.st.heavy && !st.paint) { // 縁取り（強調の極太はそのまま塗る）
        ctx.globalAlpha = a;
        ctx.strokeStyle = fg;
        ctx.lineWidth = Math.max(1, px * 0.035);
        ctx.lineJoin = 'round';
        ctx.strokeText(g.ch, X, Y);
        fill(fg, 0.12);
      } else if (shownNow) {
        const ss = { tx: 0, ty: 0, rot: 0, sx: 1, sy: 1, a: 1, ...s, q: st.pq };
        if (st.paint) st.paint(ctx, gg, ss, P); else P.fill(ctx, gg, ss);
        curFont = ctx.font;
      } else {
        fill(fg, 1);
      }
      ctx.restore();
      curFont = '';
      // 消え方：明るい文字が飛び去る（その場には上で描いた薄い文字が残る）
      if (exitFx && shownNow) {
        const q = exitQ(g.i);
        if (q > 0 && q < 1) {
          const fs = mergeState(null, exitFx.glyph ? exitFx.glyph(q, gg, P) : null, px);
          if (!fs?.hide) {
            const fa = place(g, px, fs);
            if (fa != null) {
              P.gA = alpha * fadeIn * nearA * blurMul * fa;
              curOffsets = glyphOffsets;
              const ss = { tx: 0, ty: 0, rot: 0, sx: 1, sy: 1, a: 1, ...fs, q };
              const fp = exitFx.paint ?? lookFx?.paint;
              if (fp) fp(ctx, gg, ss, P); else P.fill(ctx, gg, ss);
              ctx.restore();
              curFont = '';
            }
          }
        }
      }
    }
  });
  // 本体の行。歌詞で埋める組みの「行が上下に割れて開く」は、上半分と下半分をすき間の分だけ離して描く（1 文字ずつ映し直す近い板は割らない）
  if (floodSplit.gap > 0 && !closeUp) {
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.translate(0, side * floodSplit.gap / 2);
      ctx.beginPath();
      if (side < 0) ctx.rect(-SPLIT_FAR, -SPLIT_FAR, SPLIT_FAR * 2, SPLIT_FAR + floodSplit.cy);
      else ctx.rect(-SPLIT_FAR, floodSplit.cy, SPLIT_FAR * 2, SPLIT_FAR);
      ctx.clip();
      curFont = '';
      drawRows();
      ctx.restore();
    }
    curFont = '';
  } else drawRows();
  drawHooks('post');
  // 歌詞で埋める組みの、行の手前を通る部分（傾いた輪など）
  if (floodO && floodDef.front) { drawFlood(ctx, floodDef, floodO, 'front'); curFont = ''; }
}

// 歌詞で埋める組みの四角の大きさ（板の局所座標）：カメラが行に寄っている間（layer.stay の真ん中）の映り方で、画面のちょうど
// FLOOD_REGION 倍。寄っている間が分からなければ今の映り方で。カメラが離れると、模様も行と一緒に遠ざかる
const floodRegionCache = new WeakMap();
function floodRegion(layer, plane, fit, env, pos, factor = FLOOD_REGION) {
  const stay = layer.stay;
  const useStay = Array.isArray(stay) && Number.isFinite(stay[0]) && Number.isFinite(stay[1]) && typeof env.camAt === 'function';
  const key = `${env.width}x${env.height}|${fit}|${stay?.[0]}|${stay?.[1]}|${factor}`;
  if (useStay) { const hit = floodRegionCache.get(layer); if (hit?.key === key) return hit.reg; }
  let m = plane.m;
  if (useStay) {
    const cam = env.camAt((stay[0] + stay[1]) / 2);
    const pp = cam && projectPlane(cam, pos, layer.rot, { width: env.width, height: env.height });
    if (pp?.m?.every(Number.isFinite)) m = pp.m;
  }
  const s = Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2])) * fit;
  const reg = s > 1e-6 && env.width > 0 && env.height > 0 ? [env.width, env.height].map(v => Math.min(FLOOD_REGION_MAX, v / s * factor)) : null;
  if (useStay) floodRegionCache.set(layer, { key, reg });
  return reg;
}
// 器の四角（板の局所座標）：画面に占める割合を vesselFrac で決める（カメラが着いたとき 8 割、寄るとゆっくり大きく 95% まで）。
// 着いたときの映る倍率は、歌い出し＋lag 秒（カメラが着く時刻）のカメラで測って層ごとに覚える
const arriveCache = new WeakMap();
function vesselRegion(layer, plane, fit, env, pos, tune) {
  if (!(env.width > 0 && env.height > 0)) return null;
  const scaleOf = m => Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2])) * fit;
  const sNow = scaleOf(plane.m);
  if (!(sNow > 1e-6)) return null;
  const at = (layer.sing?.[0] ?? layer.from) + (tune.lag ?? 0);
  const key = `${env.width}x${env.height}|${fit}|${at}`;
  let hit = arriveCache.get(layer);
  if (hit?.key !== key) {
    let sArr = null;
    if (typeof env.camAt === 'function' && Number.isFinite(at)) {
      const t = Array.isArray(layer.stay) && Number.isFinite(layer.stay[1]) ? Math.min(at, layer.stay[1]) : at;
      const cam = env.camAt(t);
      const m = cam && projectPlane(cam, pos, layer.rot, { width: env.width, height: env.height })?.m;
      if (m?.every(Number.isFinite)) sArr = scaleOf(m);
    }
    hit = { key, sArr };
    arriveCache.set(layer, hit);
  }
  const f = vesselFrac(sNow, hit.sArr ?? sNow);
  return [env.width, env.height].map(v => Math.min(FLOOD_REGION_MAX, v * f / sNow));
}

// 文字の姿を重ねる：移動は足し、伸びと濃さは掛け、ほかの印（入れ替えた文字・色・切り口など）は後のものが勝つ。
// unit が true の姿は、移動を文字の大きさ px 倍にする。b が無ければ a のまま
function mergeState(a, b, px) {
  if (!b) return a;
  const base = a ?? { tx: 0, ty: 0, rot: 0, sx: 1, sy: 1, a: 1 };
  const out = { ...base };
  for (const k of Object.keys(b)) if (b[k] != null && !NUMERIC_STATE.has(k)) out[k] = b[k];
  const k = b.unit ? px : 1;
  out.tx = (base.tx ?? 0) + (Number.isFinite(b.tx) ? b.tx : 0) * k;
  out.ty = (base.ty ?? 0) + (Number.isFinite(b.ty) ? b.ty : 0) * k;
  out.rot = (base.rot ?? 0) + (Number.isFinite(b.rot) ? b.rot : 0);
  out.sx = (base.sx ?? 1) * (Number.isFinite(b.sx) ? b.sx : 1);
  out.sy = (base.sy ?? 1) * (Number.isFinite(b.sy) ? b.sy : 1);
  out.a = (base.a ?? 1) * (Number.isFinite(b.a) ? clamp01(b.a) : 1);
  out.unit = false;
  return out;
}
const NUMERIC_STATE = new Set(['tx', 'ty', 'rot', 'sx', 'sy', 'a', 'unit']);

// 収まり（2026-10-19）：歌っている間、カメラは行へ寄り続け（近さ 1.2 → 0.66）、板が斜めなら片側はもっと近い。
// 寄っている間（layer.stay）のカメラを何度か取り出し、行の文字（敷き詰めの写しは除く）の外枠の四隅が
// 画面の内側（端から FIT_MARGIN。拍の寄り punch の分も見込む）に入る縮めを、いちばん厳しい姿勢で求める。
// カメラが行を見ていない姿勢（板の原点が画面の外）は数えない。結果は層ごとに覚える（同じ層・大きさ・組みなら同じ）
const FIT_MARGIN = 0.04;
const FIT_MIN = 0.35;      // これより小さくはしない（読めなくなるので）
const AUTO_SIZE_MAX = 1.5; // 台本係が自動で選ぶ大きさの上限（director/space.js の placeCloud）。手直しでこれより大きくした行は、そのぶん下限を下げる
// 大きさの下限（2026-10-19 持ち主の録画「遠い」）：カメラが着いたとき（歌い出し＋lag 秒）の映り方で、1 文字の高さが画面の短い辺の
// SIZE_FLOOR_H 以上、かつ横長では行の幅が画面の幅の SIZE_FLOOR_W 以上になるまで大きくする（両方。2026-10-19 持ち主「小さいよね？」。最大 SIZE_GROW_MAX 倍。
// 画面からはみ出すなら、その手前まで）。持ち主が手直しで大きさを決めた行（layer.sizeLock）は大きくしない
const SIZE_FLOOR_H = 0.12;
const SIZE_FLOOR_W = 0.45; // 横長だけ
const SIZE_GROW_MAX = 2.5;
const FIT_NEAR = 0.25;     // 四隅のどれかがこれより近いと、収まっていないとみなす（近すぎる文字は崩れて消える）
const fitCache = new WeakMap();
/** 板モードの層ごとに、最後に描いた文字の外枠の四隅（画面の画素。[左上, 右上, 左下, 右下]） */
export const DRAWN_BOX = new WeakMap();
// 行の文字（敷き詰めの写しは除く）の外枠の四隅を、組みの回転・斜体を掛けた板の局所座標で返す。文字が無ければ null
function glyphCorners(lay, U, skew) {
  let l = Infinity, r = -Infinity, tp = Infinity, b = -Infinity;
  for (const row of lay.rows) {
    if (row.filler) continue;
    for (const g of row.glyphs) {
      if (g.filler) continue;
      const px = U * g.st.f;
      l = Math.min(l, g.x); r = Math.max(r, g.x + g.w); tp = Math.min(tp, g.y - px * 0.88); b = Math.max(b, g.y + px * 0.14);
    }
  }
  if (!(r > l && b > tp)) return null;
  const c = Math.cos(lay.rot ?? 0), s = Math.sin(lay.rot ?? 0);
  return [[l, tp], [r, tp], [l, b], [r, b]].map(([x, y]) => {
    let lx = x * c - y * s;
    const ly = x * s + y * c;
    lx += skew * ly;
    return [lx, ly];
  });
}
// 大きさの下限で大きくする倍率（1〜SIZE_GROW_MAX）。カメラが着いたときに行を見ていなければ 1
function sizeFloor(layer, corners, pos, env, U, ex, ey, short, size) {
  const lag = Number.isFinite(env.tune?.lag) ? env.tune.lag : DEFAULT_TUNING.lag;
  const s0 = layer.sing?.[0] ?? layer.stay[0];
  const cam = env.camAt(Math.min(layer.stay[1], Math.max(layer.stay[0], s0 + lag)));
  if (!cam) return 1;
  const at = (lx, ly) => project(cam, [0, 1, 2].map(q => pos[q] + (ex[q] * lx + ey[q] * ly) / short), size);
  const o = at(0, 0), up = at(0, -U);
  if (!o || !up || o.x < 0 || o.x > env.width || o.y < 0 || o.y > env.height) return 1;
  const hU = Math.hypot(up.x - o.x, up.y - o.y);
  const xs = corners.map(([lx, ly]) => at(lx, ly)?.x).filter(Number.isFinite);
  const bw = xs.length === 4 ? Math.max(...xs) - Math.min(...xs) : 0;
  if (!(hU > 0) || !(bw > 0)) return 1;
  const g = Math.max(SIZE_FLOOR_H * short / hU, env.width > env.height ? SIZE_FLOOR_W * env.width / bw : 1);
  return Math.min(SIZE_GROW_MAX, Math.max(1, g));
}
function stayFit(layer, lay, pos, env, skew, U) {
  const stay = layer.stay;
  if (!Array.isArray(stay) || !(stay[1] >= stay[0]) || typeof env.camAt !== 'function' || !(env.width > 0 && env.height > 0)) return null;
  const sh = env.shift ?? [0, 0]; // 行の手直し「位置」：画面の上でのずらし（画素。render/index.js が渡す）
  const key = `${env.width}x${env.height}|${(lay.width ?? 0).toFixed(1)}|${(lay.total ?? 0).toFixed(1)}|${U.toFixed(2)}|${env.tune?.punch ?? ''}|${sh[0]},${sh[1]}|${env.tune?.lag ?? ''}|${!!layer.sizeLock}`;
  const hit = fitCache.get(layer);
  if (hit?.key === key) return hit.fit;
  const corners = glyphCorners(lay, U, skew);
  if (!corners) { fitCache.set(layer, { key, fit: null }); return null; }
  const short = Math.min(env.width, env.height);
  const ex = rotate([1, 0, 0], layer.rot), ey = rotate([0, 1, 0], layer.rot);
  const size = { width: env.width, height: env.height };
  const grow = 1 + ((env.tune?.punch ?? 0) + BAR_PUNCH) * clamp01(env.intensity ?? 0); // 拍の頭でぐっと寄る分（サビの小節の頭の寄りも見込む）
  const mx = env.width * FIT_MARGIN, my = env.height * FIT_MARGIN;
  const inside = (cam, f) => corners.every(([lx, ly]) => {
    const p = project(cam, [0, 1, 2].map(q => pos[q] + (ex[q] * lx + ey[q] * ly) * f / short), size);
    if (!p || p.dz < FIT_NEAR) return false;
    const px = p.x + sh[0], py = p.y + sh[1];
    const x = env.width / 2 + (px - env.width / 2) * grow, y = env.height / 2 + (py - env.height / 2) * grow;
    return x >= mx && x <= env.width - mx && y >= my && y <= env.height - my;
  });
  // 下限：手直しで大きくした行（sizeMul > 1.5）も、自動でいちばん大きい行と同じ大きさまでは縮められる
  const sizeMul = layer.sizeMul > 0 && Number.isFinite(layer.sizeMul) ? layer.sizeMul : 1;
  const floor = FIT_MIN * Math.min(1, AUTO_SIZE_MAX / sizeMul);
  const n = Math.min(12, Math.max(3, Math.ceil((stay[1] - stay[0]) / 0.15) + 1));
  let fit = layer.sizeLock ? 1 : sizeFloor(layer, corners, pos, env, U, ex, ey, short, size);
  for (let k = 0; k < n; k++) {
    const cam = env.camAt(stay[0] + (stay[1] - stay[0]) * k / (n - 1));
    const o = cam && project(cam, pos, size);
    if (!o || o.x + sh[0] < 0 || o.x + sh[0] > env.width || o.y + sh[1] < 0 || o.y + sh[1] > env.height) continue; // 行を見ていない姿勢
    if (inside(cam, fit)) continue;
    // どれだけ縮めても収まらない姿勢（カメラが行に近づきすぎる一瞬など）は数えない。数えると行全体が下限まで縮み、ずっと小さく映っていた（2026-10-19）
    if (!inside(cam, floor)) continue;
    let lo = floor, hi = fit;
    for (let it = 0; it < 8; it++) { const m = (lo + hi) / 2; if (inside(cam, m)) lo = m; else hi = m; }
    fit = lo;
  }
  fitCache.set(layer, { key, fit });
  return fit;
}

/**
 * 組み方：文字を板の局所座標に並べる（中心が原点）。文字の位置 x は左端、y は文字の下の線（ベースライン）。
 * @returns {{rows:{glyphs:{i:number,ch:string,x:number,y:number,w:number,st:Object,turn?:number,filler?:boolean}[],filler?:boolean}[],
 *   total:number, width:number, rot:number}} total は縦の広がり（画面に収める縮めに使う）
 */
export function layoutGlyphs(set, chars, o) {
  const N = chars.length;
  const all = Array.from({ length: N }, (_, i) => i);
  // 左から並べて、幅を超える手前で次の行へ。lift で1文字ずつ上下にずらせる。
  // 英単語は途中で切らず、単語ごと次の行へ送る。1 語が幅より長くても切らない（行がはみ出した分は、画面に収める縮め stayFit で縮む）。
  // 行の頭と終わりの空白は落とす
  const flow = (idx, stOf, lift = () => 0) => {
    const rows = [];
    let row = { glyphs: [], width: 0, maxF: 0 };
    const push = () => {
      while (row.glyphs.length && row.glyphs[row.glyphs.length - 1].ch === ' ') row.width -= row.glyphs.pop().w;
      if (row.glyphs.length) rows.push(row);
      row = { glyphs: [], width: 0, maxF: 0 };
    };
    for (let p = 0; p < idx.length; p++) {
      const i = idx[p];
      const st = stOf(i);
      const w = o.measure(chars[i], st);
      if (chars[i] === ' ' && row.glyphs.length === 0) continue;
      const inWord = LATIN.test(chars[i]) && p > 0 && idx[p - 1] === i - 1 && LATIN.test(chars[i - 1]);
      if (row.glyphs.length > 0 && LATIN.test(chars[i]) && !inWord) {
        // 英単語の頭：単語の幅ぶん入らなければ、単語の前で改行
        let ww = 0;
        for (let q = p; q < idx.length && idx[q] === i + (q - p) && LATIN.test(chars[idx[q]]); q++) ww += o.measure(chars[idx[q]], stOf(idx[q]));
        if (row.width + ww > o.maxW) push();
      } else if (!inWord && row.glyphs.length > 0 && row.width + w > o.maxW) push();
      if (chars[i] === ' ' && row.glyphs.length === 0) continue;
      row.glyphs.push({ i, ch: chars[i], x: row.width, y: lift(i), w, st });
      row.width += w;
      row.maxF = Math.max(row.maxF, st.f);
    }
    if (row.glyphs.length || rows.length === 0) rows.push(row); else push();
    return rows;
  };
  // 行を上から積む（行の高さは行の中のいちばん大きい文字の lineH 倍）。各行は真ん中ぞろえ
  const stack = (rows, lineH = 1.2) => {
    const heights = rows.map(r => r.maxF * o.U * lineH);
    const total = heights.reduce((a, b) => a + b, 0);
    let top = -total / 2;
    rows.forEach((r, ri) => {
      const base = top + heights[ri] * 0.82;
      for (const g of r.glyphs) { g.x += -r.width / 2; g.y += base; }
      top += heights[ri];
    });
    return total;
  };
  // 全部の文字の外枠に合わせて真ん中へ寄せ、縦の広がりと横幅を返す
  const center = (rows, rot = 0) => {
    let l = Infinity, r = -Infinity, t = Infinity, b = -Infinity;
    for (const row of rows) for (const g of row.glyphs) {
      const px = o.U * g.st.f;
      l = Math.min(l, g.x); r = Math.max(r, g.x + g.w); t = Math.min(t, g.y - px * 0.9); b = Math.max(b, g.y + px * 0.2);
    }
    if (!(r > l)) return { rows, total: 0, width: 0, rot };
    const cx = (l + r) / 2, cy = (t + b) / 2;
    for (const row of rows) for (const g of row.glyphs) { g.x -= cx; g.y -= cy; }
    return { rows, total: b - t, width: r - l, rot };
  };
  switch (set) {
    case 'tate': {
      // 縦組み：上から下へ。長い行は同じくらいの長さの列に分けて、右から左へ並べる
      const cols = Math.max(1, Math.ceil(N / TATE_COL));
      const per = Math.ceil(N / cols);
      const maxF = Math.max(1, ...all.map(i => o.styleOf(i).f));
      const colW = o.U * maxF * 1.3;
      const rows = [];
      for (let c = 0; c < cols; c++) {
        const cx = ((cols - 1) / 2 - c) * colW;
        let cursor = 0;
        const glyphs = [];
        for (const i of all.slice(c * per, (c + 1) * per)) {
          const st = o.styleOf(i);
          const px = o.U * st.f;
          const w = o.measure(chars[i], st);
          const g = { i, ch: chars[i], x: cx - w / 2, y: cursor + px * 0.88, w, st };
          if (TATE_TURN.has(chars[i])) g.turn = Math.PI / 2;
          if (TATE_SMALL.has(chars[i])) { g.x += px * 0.55; g.y -= px * 0.55; }
          glyphs.push(g);
          cursor += px * 1.04;
        }
        rows.push({ glyphs });
      }
      return center(rows);
    }
    case 'jump': {
      // 1文字ずつ大きさ（0.6〜1.5 倍）と高さを変える。強調語はそのまま特大
      const stOf = i => {
        const st = o.styleOf(i);
        return st.heavy ? st : { ...st, f: st.f * (0.6 + 0.9 * hash01(o.line, i, 71)) };
      };
      const rows = flow(all, stOf, i => (hash01(o.line, i, 72) - 0.5) * o.U * 0.6);
      stack(rows, 1.55);
      return center(rows);
    }
    case 'fill': {
      // 本体の上下に、歌詞の写しを本体と同じ幅で敷き詰める（段ごとに始まりの文字をずらす）
      const main = flow(all, o.styleOf);
      stack(main);
      const width = Math.max(...main.map(r => r.width));
      const firstY = Math.min(...main[0].glyphs.map(g => g.y));
      const lastY = Math.max(...main[main.length - 1].glyphs.map(g => g.y));
      const h = o.U * 1.2;
      const fillers = [];
      for (let k = -FILL_ROWS; k <= FILL_ROWS; k++) {
        if (k === 0) continue;
        const y = k < 0 ? firstY + k * h : lastY + k * h;
        const glyphs = [];
        let x = -width / 2;
        for (let n = 0; x < width / 2 && n < 200 && N > 0; n++) {
          const i = (n + (k + FILL_ROWS + 1) * 3) % N;
          const st = { w: o.styleOf(i).w, f: 1 };
          const w = o.measure(chars[i], st);
          if (!(w > 0)) break;
          glyphs.push({ i, ch: chars[i], x, y, w, st, filler: true });
          x += w;
        }
        fillers.push({ glyphs, filler: true });
      }
      return center([...fillers, ...main]); // 写しを先に（奥に）描く
    }
    case 'slant': {
      // 強調語（無ければ漢字・カタカナのいちばん長い塊、それも無ければ真ん中の2文字）を特大の段にし、
      // 前は小さく左ぞろえで上の段、後ろは右ぞろえで下の段。全体を少し傾ける
      let ks = 0, kl = N;
      const text = chars.join('');
      if (o.emph && o.emph[0] >= 0 && o.emph[0] < N && o.emph[1] > 0) { ks = o.emph[0]; kl = Math.min(o.emph[1], N - ks); } else {
        let best = null;
        for (const m of text.matchAll(KEY_RUN)) {
          const start = Array.from(text.slice(0, m.index)).length;
          const len = Array.from(m[0]).length;
          if (len < N && (!best || len > best[1])) best = [start, len];
        }
        if (best) [ks, kl] = best;
        else if (N >= 4) { ks = Math.floor(N / 2) - 1; kl = 2; }
      }
      const heavyW = o.styleOf(ks).heavy ? o.styleOf(ks).w : null;
      // 大きな 1 語は emphScale の 1.25 倍。ただし前後の小さい段（0.8 倍）の emphMax 倍まで
      const keySt = i => ({ w: heavyW ?? o.styleOf(i).w, f: Math.min(o.emphScale * 1.25, (o.emphMax ?? Infinity) * 0.8), heavy: true });
      const smallSt = i => { const st = o.styleOf(i); return { ...st, f: st.f * 0.8 }; };
      const before = ks > 0 ? flow(all.slice(0, ks), smallSt) : [];
      const key = flow(all.slice(ks, ks + kl), keySt);
      const after = ks + kl < N ? flow(all.slice(ks + kl), smallSt) : [];
      const rows = [...before, ...key, ...after];
      stack(rows);
      const keyW = Math.max(...key.map(r => r.width));
      for (const r of before) for (const g of r.glyphs) g.x += (r.width - keyW) / 2;
      for (const r of after) for (const g of r.glyphs) g.x += (keyW - r.width) / 2;
      return center(rows, SLANT);
    }
    default: {
      // 横並び（今までどおり）
      const rows = flow(all, o.styleOf);
      const total = stack(rows);
      return { rows, total, width: Math.max(0, ...rows.map(r => r.width)), rot: 0 };
    }
  }
}
