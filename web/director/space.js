// 台本係（雰囲気 S：空間）：区切りの全行を立体の空間に散らして置き、カメラが空間のあちこちを動く。
// 世界座標：画面の短辺 = 1、x は右、y は下、z は奥が +。カメラの yaw>0 は右、pitch>0 は下を向く（render/camera.js と同じ）。
import { DEFAULT_TUNING } from '../shared/tuning.js';
import { VIEW_DIST } from './layout.js';
import { makeRng } from './rng.js';

const GOLDEN = 2.399963;   // 黄金角（らせん状に散らす）
const WIDE_EXTRA = 2.6;    // 「引く」動きで、行を見る距離からさらに引く距離
const ARC_SIDE = 0.8;      // 「回り込む」動きで、中継点を横へずらす距離
// 奥へ進む動き（2026-10-18。設計：docs/superpowers/specs/2026-10-18-forward-camera-design.md）
const WARP_FROM = 0.4;     // 場面の強さがこれ以上なら、場面の頭はワープ（未満は今までどおり切り替わる）
const WARP_DIST = 30;      // ワープで進む奥行き
const WARP_SECONDS = 0.9;  // ワープにかける秒数
const WARP_LEAD = 0.35;    // 場面の頭の何秒前に飛び出すか
const DIVE_GAP = 2.6;      // くぐり抜けた先の次の行は、前の行よりこれ以上奥
const SCENE_GAP = 3;       // 切り替わる場面は、前の場面からこれだけ奥へ離す
const DIVE_YAW = 0.6;      // くぐり抜けで見る向きの上限（左右）
const DIVE_PITCH = 0.35;   // くぐり抜けで見る向きの上限（上下）
const DIVE_AT = 0.42;      // くぐる瞬間は到着の travel×これ 秒前
const LAG_SHARE = 0.25;    // 到着を遅らせるのは、前後の行との間隔のこの割合まで

/**
 * count 行ぶんを、らせん状の雲に散らして置く。k 番目の行は、乱数を 6 つ固定の順
 * （奥行きのゆらぎ・yaw・pitch・roll・roll の種類・大きさ）で使う。行数が変わっても前の行は変わらない。
 * rot は板の向き（tilt で全体のばらつきを変える。0 なら正面）。
 * @returns {{pos:[number,number,number], rot:{yaw:number,pitch:number,roll:number}, size:number}[]}
 */
export function placeCloud(count, rng, tuning) {
  const t = { ...DEFAULT_TUNING, ...tuning };
  const out = [];
  for (let k = 0; k < count; k++) {
    const h = rng(); const a = rng(); const b = rng(); const c = rng(); const kind = rng(); const s = rng();
    const th = k * GOLDEN;
    const r = Math.min(2.4, 0.5 + 0.55 * Math.sqrt(k)) * t.spread;
    // 横に寝た行（±π/2）は 2026-10-19 にやめた（持ち主「最初から出さないで」）。kind は引く順を変えないために残す
    void kind;
    const roll = (c - 0.5) * 0.5 * t.tilt;
    out.push({
      pos: [Math.cos(th) * r, Math.sin(th) * r * 0.6, k * 0.28 + h * 0.8],
      rot: { yaw: (a - 0.5) * 1.1 * t.tilt, pitch: (b - 0.5) * 0.5 * t.tilt, roll },
      size: 0.8 + 0.7 * s,
    });
  }
  return out;
}

/** 向き d = [sin az·cos el, sin el, cos az·cos el] で、点 target を距離 dist から見る姿勢 */
export function viewPose(target, az, el, roll, dist) {
  const d = dirOf(az, el);
  return { pos: [target[0] - d[0] * dist, target[1] - d[1] * dist, target[2] - d[2] * dist], yaw: az, pitch: el, roll, zoom: 1 };
}

export const dirOf = (yaw, pitch) => [Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)];

// 強さが高いほど pull（引く）・whip（勢いよく寄る）、低いほど push（寄る）が出やすい。arc（回り込む）はどの強さでも出る。
// noPush なら push を除く（奥へ進む動きでは、push の代わりに前進 cruise を使う）
function pickShot(r, intensity, noPush) {
  const w = { push: noPush ? 0 : 1.2 - intensity, arc: 1, pull: 0.2 + 0.9 * intensity, whip: 0.1 + 0.9 * intensity };
  const total = w.push + w.arc + w.pull + w.whip;
  let x = r * total;
  for (const k of ['push', 'arc', 'pull', 'whip']) { if ((x -= w[k]) < 0) return k; }
  return noPush ? 'whip' : 'push';
}

const clamp01 = x => (Number.isFinite(x) ? Math.min(1, Math.max(0, x)) : 0.5);

/**
 * 奥へ進む動きの計画。groups は spaceCameraKeys と同じ形（場面ごと {intensity, start, items:[{start}]}）。
 * 行ごと（場面の順・行の順）に {kind, z, side} を返す。kind：first（曲の最初）／warp・cut（場面の最初の行）／
 * dive（くぐり抜け）・cruise（前進）・jump（今までの回り込む・引く・勢いよく寄る）。z は奥へのずらし（減らない）、
 * side は dive で前の行の横を通るずれ。台本本体と別の乱数の列（seed から作る）なので、ほかの選びは変わらない。
 * @returns {{kind:string, z:number, side:number}[][]}
 */
export function planForward(groups, seed, tuning) {
  const t = { ...DEFAULT_TUNING, ...tuning };
  const rng = makeRng((Number.isFinite(seed) ? seed : 1) * 7919 + 104729);
  let z = 0;
  let prevStart = null;
  let first = true;
  return (groups ?? []).map(g => (g?.items ?? []).map((item, j) => {
    const I = clamp01(g.intensity);
    const r = rng(); const r2 = rng(); const r3 = rng(); // 引く数は行ごとに固定（種類 → 横のずれの向き・大きさ）
    const start = Number.isFinite(item?.start) ? item.start : (prevStart ?? 0);
    const gap = prevStart === null ? 0 : Math.max(0.05, start - prevStart);
    prevStart = Math.max(start, prevStart ?? start);
    let kind;
    if (first) { kind = 'first'; first = false; }
    else if (j === 0) kind = I >= WARP_FROM ? 'warp' : 'cut';
    else {
      const w = { dive: (0.6 + 0.6 * I) * t.dive, cruise: 1.2 - I, jump: 0.2 + 0.7 * I };
      let x = r * (w.dive + w.cruise + w.jump);
      kind = (x -= w.dive) < 0 ? 'dive' : (x -= w.cruise) < 0 ? 'cruise' : 'jump';
    }
    if (kind !== 'first') {
      // 前進：前の行からの間隔ぶん進む。歌っている行に寄りすぎないよう上限がある
      const step = Math.min((0.25 + 0.35 * I) * gap, 0.5 + 0.4 * I) * t.cruise;
      z += kind === 'warp' ? WARP_DIST : kind === 'dive' ? Math.max(step, DIVE_GAP) : kind === 'cut' ? step + SCENE_GAP : step;
    }
    const side = kind === 'dive' ? (r2 < 0.5 ? -1 : 1) * (0.08 + 0.1 * r3) : 0;
    return { kind, z, side };
  }));
}

/**
 * 曲全体で1本のカメラのキー列。groups は場面ごと {intensity, items:[{start, pos}]}（行の歌い出しと置き場所。時刻順）。
 * 行ごとに「到着キー」（歌い出しに、斜めにずらした方向から見る姿勢へ。rush：勢いよく出てぴたっと止まる。鋭さ sharp は
 * 場面の強さと snap で決まる）を置く。型は乱数で選ぶ：
 * push（直行）／arc（前の姿勢と到着の中間から横へずらした中継点を通る）／pull（行から大きく引いた中継点を通る）／
 * whip（到着で roll が余分に回っていて、settle 秒で戻る）。場面の最初の行は cut（場面の頭で切り替わる）。
 * 中継点は via（通り過ぎる点。描く係が待機キー〜到着キーを1本の曲線と1つの速さでつなぐ）。
 * 到着の手前（travel 秒前）に、前の姿勢から少し寄った「待機キー」を置く。キーの t は必ず増える順。
 * 到着キーは歌い出しの lag 秒あと（2026-10-18。動き出しも lag 秒遅れ、前の行を歌い終わる近くまで寄っていられる。
 * rush は前半でほとんど進むので、歌い出しには見た目はほぼ着いている）。曲の最初の行と、場面の頭の切り替え（cut）は歌い出しちょうど。
 * 到着キーには歌い出しの時刻 cue を付ける（寄っている間・小物・カット割り・行の手直しは cue で到着キーを探す）。
 * items に kind（planForward の種類）があればそれに従う：cruise（待機と到着を via にして止まらず流れる）／
 * dive（前の行の横 side を通る中継点を抜けて、前の行 → この行の向きで着く）／warp（場面の頭で一気に飛ぶ）／
 * jump（arc・pull・whip）。kind が無ければ今までどおり。乱数は kind に関係なく行ごとに 4 回引く。
 * @returns {{t:number,pos:number[],roll:number,yaw:number,pitch:number,zoom:number,ease:string,shot?:string}[]}
 */
export function spaceCameraKeys(groups, tuning, rng) {
  const t = { ...DEFAULT_TUNING, ...tuning };
  const entries = [];
  groups.forEach((g, gi) => g.items.forEach((item, j) => entries.push({ item, gi, j, intensity: g.intensity, sceneStart: g.start })));
  if (entries.length === 0) return [];

  // 到着の時刻（歌い出し。前の到着より 0.05 秒は後ろにする）
  const arrives = [];
  let prevA = 0;
  for (const e of entries) {
    const start = Number.isFinite(e.item.start) ? e.item.start : 0;
    prevA = Math.max(start, prevA + 0.05);
    arrives.push(prevA);
  }

  // 行ごとの遅れ：前後の行との間隔の LAG_SHARE まで（行が詰まっている所では、カメラが歌に置いていかれないように）
  const lagMax = Number.isFinite(t.lag) ? Math.max(0, t.lag) : 0;
  const lagOf = i => {
    const prevGap = i > 0 ? arrives[i] - arrives[i - 1] : Infinity;
    const nextGap = i + 1 < arrives.length ? arrives[i + 1] - arrives[i] : Infinity;
    return Math.min(lagMax, LAG_SHARE * Math.min(prevGap, nextGap));
  };
  const keys = [];
  let lastT = -Infinity;
  const push = (time, pose, ease, shot, extra) => {
    const tt = Math.max(time, lastT + 0.001);
    keys.push({ t: tt, pos: [...pose.pos], roll: pose.roll, yaw: pose.yaw, pitch: pose.pitch, zoom: pose.zoom ?? 1, ease, ...(shot ? { shot } : {}), ...extra });
    lastT = tt;
  };

  let prev = null; // 直前の行を見る姿勢（回転の余分を除いたもの）
  let firstGroup = true;
  entries.forEach((e, idx) => {
    const az = (rng() - 0.5) * 0.9;
    const el = (rng() - 0.5) * 0.3;
    const shotR = rng();
    const sign = rng() < 0.5 ? -1 : 1;
    const kind = e.item.kind;
    let vAz = az, vEl = el;
    if (kind === 'dive' && idx > 0) {
      // くぐり抜け：前の行から、この行へ向かう向きで見る（前の行をくぐって、そのまま次の行へ）
      const p0 = entries[idx - 1].item.pos;
      const d = [e.item.pos[0] - p0[0], e.item.pos[1] - p0[1], e.item.pos[2] - p0[2]];
      if (d.every(Number.isFinite)) {
        vAz = Math.max(-DIVE_YAW, Math.min(DIVE_YAW, Math.atan2(d[0], d[2])));
        vEl = Math.max(-DIVE_PITCH, Math.min(DIVE_PITCH, Math.atan2(d[1], Math.hypot(d[0], d[2]))));
      }
    }
    const V = viewPose(e.item.pos, vAz, vEl, 0, VIEW_DIST);
    const arrive = arrives[idx];
    const sceneFirst = e.j === 0 && !firstGroup;
    if (e.j === 0) firstGroup = false;

    if (idx === 0) {
      push(0, viewPose(e.item.pos, az, el, 0, VIEW_DIST + 1.5), 'linear'); // 最初は少し遠くから
      push(arrive, V, 'outExpo', undefined, { cue: arrive });
    } else if (sceneFirst && kind === 'warp') {
      // ワープ：場面の頭の少し前に飛び出し、一気に奥の場面へ。場面の頭が歌い出しより前なら、少し遠くから見る姿勢へ着いてから寄る
      const s0 = e.sceneStart;
      const end = arrive + lagOf(idx);
      let goT = end - WARP_SECONDS;
      let landT = end;
      if (Number.isFinite(s0) && s0 < arrive && s0 - WARP_LEAD > lastT + 0.002) { goT = s0 - WARP_LEAD; landT = Math.min(end, goT + WARP_SECONDS); }
      const dp = dirOf(prev.yaw, prev.pitch);
      if (goT > lastT) push(goT, { ...prev, pos: [prev.pos[0] + dp[0] * t.drift, prev.pos[1] + dp[1] * t.drift, prev.pos[2] + dp[2] * t.drift] }, 'linear');
      if (landT < end - 0.002) {
        push(landT, viewPose(e.item.pos, az, el, 0, VIEW_DIST + 1.5), 'rush', 'warp', { sharp: 2.2 });
        push(end, V, 'outExpo', undefined, { cue: arrive });
      } else {
        push(end, V, 'rush', 'warp', { sharp: 2.2, cue: arrive });
      }
    } else if (sceneFirst) {
      // 場面の頭で切り替わる（間奏があって最初の歌い出しが遅いときも、場面の頭から空間が映る）
      const cutT = Number.isFinite(e.sceneStart) && e.sceneStart < arrive - 0.05 ? e.sceneStart : arrive;
      if (cutT < arrive) {
        push(cutT, viewPose(e.item.pos, az, el, 0, VIEW_DIST + 1.5), 'cut');
        push(arrive, V, 'outExpo', undefined, { cue: arrive });
      } else {
        push(arrive, V, 'cut', undefined, { cue: arrive });
      }
    } else {
      const land = arrive + lagOf(idx); // 到着キーの時刻
      const holdT = land - t.travel;
      const dp = dirOf(prev.yaw, prev.pitch);
      const cruise = kind === 'cruise';
      if (holdT > lastT) push(holdT, { ...prev, pos: [prev.pos[0] + dp[0] * t.drift, prev.pos[1] + dp[1] * t.drift, prev.pos[2] + dp[2] * t.drift] }, 'linear', undefined, cruise ? { via: true } : undefined);
      if (cruise) {
        // 前進：止まらずに1本のなめらかな道で流れ続ける（待機キーも到着キーも通り過ぎる点）
        push(land, V, 'linear', 'cruise', { via: true, cue: arrive });
        prev = V;
        return;
      }
      if (kind === 'dive') {
        // くぐり抜け：前の行の原点から少し横（side）を通る。くぐる所が一番速い（sharp 2）
        const p0 = entries[idx - 1].item.pos;
        const side = Number.isFinite(e.item.side) ? e.item.side : 0;
        const viaT = land - t.travel * DIVE_AT;
        if (viaT > lastT + 0.002 && viaT < land) {
          push(viaT, { pos: [p0[0] + side, p0[1] + side * 0.4, p0[2] + 0.05], yaw: (prev.yaw + V.yaw) / 2, pitch: (prev.pitch + V.pitch) / 2, roll: 0, zoom: 1 }, 'linear', 'dive', { via: true });
        }
        push(land, V, 'rush', 'dive', { sharp: 2, cue: arrive });
        prev = V;
        return;
      }
      const shot = pickShot(shotR, e.intensity, kind === 'jump');
      const midT = land - t.travel * 0.55;
      // 動きの鋭さ：強い場面ほど勢いよく出てぴたっと止まる（snap 0 なら、どの場面も 2＝なめらか）
      const sharp = 2 + t.snap * (0.5 + (Number.isFinite(e.intensity) ? Math.min(1, Math.max(0, e.intensity)) : 0.5));
      if ((shot === 'arc' || shot === 'pull') && midT > lastT + 0.002 && midT < land) {
        if (shot === 'pull') {
          push(midT, viewPose(e.item.pos, az * 0.3, el * 0.3, 0, VIEW_DIST + WIDE_EXTRA), 'inOutCubic', 'pull', { via: true });
        } else {
          const dx = V.pos[0] - prev.pos[0]; const dz = V.pos[2] - prev.pos[2];
          const len = Math.hypot(dx, dz);
          const perp = len > 1e-6 ? [-dz / len, 0, dx / len] : [1, 0, 0]; // 進行方向に垂直（水平）
          push(midT, {
            pos: [(prev.pos[0] + V.pos[0]) / 2 + perp[0] * sign * ARC_SIDE, (prev.pos[1] + V.pos[1]) / 2, (prev.pos[2] + V.pos[2]) / 2 + perp[2] * sign * ARC_SIDE],
            yaw: (prev.yaw + V.yaw) / 2, pitch: (prev.pitch + V.pitch) / 2, roll: 0, zoom: 1,
          }, 'inOutCubic', 'arc', { via: true });
        }
      }
      // whip：到着で roll が余分に回っている。行の間隔が短いときは小さくする（往復し続けないように）
      const gap = arrive - arrives[idx - 1];
      const spin = shot === 'whip' ? sign * t.spin * 1.3 * Math.min(1, gap / (t.travel + t.settle)) : 0;
      push(land, { ...V, roll: V.roll + spin }, 'rush', shot === 'whip' ? 'whip' : undefined, { sharp, cue: arrive });
      if (spin !== 0) {
        const settleT = land + t.settle;
        const nextHold = idx + 1 < entries.length ? arrives[idx + 1] + lagOf(idx + 1) - t.travel : Infinity;
        if (settleT < nextHold) push(settleT, V, 'outCubic');
      }
    }
    prev = V;
  });
  return keys;
}

/**
 * 歌い出し start の行の到着キーの番号。cue（歌い出しの時刻）が同じキーがあればそれ、無ければ（古い台本）歌い出しに一番近い到着キー。
 * after より後ろの番号のキーだけから探す。見つからなければ -1
 */
export function arriveIndexOf(keys, start, after = -1) {
  if (!Number.isFinite(start)) return -1;
  let ai = -1;
  keys.forEach((c, i) => { if (i > after && ai < 0 && Number.isFinite(c.cue) && Math.abs(c.cue - start) < 1e-6) ai = i; });
  if (ai >= 0) return ai;
  keys.forEach((c, i) => { if (i > after && (!c.via || c.shot === 'cruise') && (ai < 0 || Math.abs(c.t - start) < Math.abs(keys[ai].t - start))) ai = i; });
  return ai;
}

// 連想の小物を、行を歌う瞬間のカメラ（到着キー）から見て、行の横・後ろに来るように置き直す。
// off = [画面の横, 画面の縦（下が +）, 奥行き]。カメラの右・下・前の向きで、行の置き場所からずらす
export function placeProps(layers, keys, g, places) {
  for (const l of layers) {
    if (l.part !== 'fx.prop' || !Array.isArray(l.off)) continue;
    const k = g.findIndex(x => x.i === l.line);
    if (k < 0) continue;
    const start = g[k].l.start;
    const key = keys[arriveIndexOf(keys, start)]; // 前進の到着は via でも歌う瞬間の姿勢
    if (!key) continue;
    const yaw = key.yaw ?? 0, pitch = key.pitch ?? 0;
    const f = [Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)];
    const r = [Math.cos(yaw), 0, -Math.sin(yaw)];
    const d = [f[1] * r[2], f[2] * r[0] - f[0] * r[2], -f[1] * r[0]];
    const p = places[k].pos;
    l.at = [0, 1, 2].map(q => p[q] + r[q] * l.off[0] + d[q] * l.off[1] + f[q] * l.off[2]);
  }
}

// 行に寄っている間：歌い出しから、カメラが次の行へ動き出す時刻（到着キーの次のキー。whip の回転を戻すキーは飛ばす）まで。
// 到着キーが歌い出しより後ろ（lag）でも、寄っている間は歌い出しから数える
// 歌い終わり singEnd より後ろにはしない。短すぎるときは歌い出しから 0.3 秒（2026-10-19。文字を画面に収めるため）
export function stayWindow(keys, start, singEnd) {
  const ai = arriveIndexOf(keys, start);
  let leave = singEnd;
  if (ai >= 0) {
    let j = ai + 1;
    while (j < keys.length && keys[j].ease === 'outCubic' && !keys[j].via) j++;
    if (j < keys.length) leave = Math.min(leave, keys[j].t);
  }
  return [start, Math.max(start + 0.3, leave)];
}
