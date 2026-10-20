// カメラ：時刻のカメラの姿勢を求める・世界の点を画面に映す。
// 世界座標の単位は「画面の短辺 = 1」。x は右、y は下、z はカメラの前方（奥）が +。
import { clamp01, easeOutCubic } from './timing.js';

export const NEAR = 0.05;      // これより手前（近すぎる・後ろ）の点は映さない
export const MAX_SCALE = 50;   // 近づきすぎたときの拡大の上限
export const VIEW_DIST = 1.2;  // 1行を見るときの、カメラと行の距離（director/layout.js と同じ値にする）
export const DEFAULT_CAMERA = Object.freeze({ pos: Object.freeze([0, 0, 0]), roll: 0, yaw: 0, pitch: 0, zoom: 1 });

// yaw（左右。正で右を向く）・pitch（上下。正で下を向く）はキーに無ければ 0
/** カメラの向き（yaw・pitch）の前方の単位ベクトル。空間の飾りを、カメラの前に敷き詰めるのに使う */
export const forwardOf = cam => {
  const yaw = cam?.yaw ?? 0, pitch = cam?.pitch ?? 0;
  return [Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)];
};

const copy = c => ({ pos: [...c.pos], roll: c.roll, yaw: c.yaw ?? 0, pitch: c.pitch ?? 0, zoom: c.zoom });

const EASE = {
  linear: x => x,
  outCubic: easeOutCubic,
  inOutCubic: x => { const v = clamp01(x); return v < 0.5 ? 4 * v * v * v : 1 - Math.pow(-2 * v + 2, 3) / 2; },
  outExpo: x => { const v = clamp01(x); return v >= 1 ? 1 : 1 - Math.pow(2, -10 * v); },
};

// rush：止まった所から勢いよく出て、到着でぴたっと止まる。f(x) = 1 - (1-x)^p (1 + p x)。
// 速さの山は x = 1/p にあり、p が大きいほど出だしが鋭い（p = 2 はなめらかな smoothstep と同じ）。
const SHARP_DEFAULT = 4;
const SHARP_RANGE = [2, 20];
function rush(sharp) {
  const p = Number.isFinite(sharp) ? Math.min(SHARP_RANGE[1], Math.max(SHARP_RANGE[0], sharp)) : SHARP_DEFAULT;
  return x => { const v = clamp01(x); return 1 - Math.pow(1 - v, p) * (1 + p * v); };
}
const easeOf = k => (k.ease === 'rush' ? rush(k.sharp) : (EASE[k.ease] ?? EASE.linear));

// 補間する値を並べる順：位置 x,y,z・roll・yaw・pitch・zoom
const vec = k => [k.pos[0], k.pos[1], k.pos[2], k.roll, k.yaw ?? 0, k.pitch ?? 0, k.zoom];
const fromVec = v => ({ pos: [v[0], v[1], v[2]], roll: v[3], yaw: v[4], pitch: v[5], zoom: v[6] });

/**
 * 時刻 t のカメラ。keys は t の増える順。2つのキーの間は、後ろのキーの ease で補間する
 * （ease が 'cut' なら、後ろのキーの時刻までは前のキーの値のまま。'rush' は後ろのキーの sharp で鋭さが決まる）。
 * via: true のキーは「通り過ぎる中継点」：前後の via でないキーまでを1回の移動として、
 * 道筋はキーを通るなめらかな曲線（エルミート曲線。中継点での向きは前後のキーから決める）、
 * 進み方は移動の最後のキーの ease を移動全体に1回だけ掛ける（中継点で止まらない）。
 * @param {{keys:{t:number,pos:number[],roll:number,zoom:number,ease?:string,sharp?:number,via?:boolean}[]}|undefined} camera
 */
export function cameraAt(camera, t) {
  const keys = camera?.keys;
  if (!Array.isArray(keys) || keys.length === 0) return copy(DEFAULT_CAMERA);
  if (!Number.isFinite(t) || t <= keys[0].t) return copy(keys[0]);
  const last = keys[keys.length - 1];
  if (t >= last.t) return copy(last);
  let i = 0;
  while (i < keys.length - 2 && keys[i + 1].t <= t) i++; // keys[i].t <= t < keys[i+1].t
  const a = keys[i];
  const b = keys[i + 1];
  if (b.ease === 'cut') return copy(a);
  if (a.via || b.via) return moveAt(keys, i, t);
  const span = b.t - a.t;
  const u = span > 0 ? easeOf(b)((t - a.t) / span) : 1;
  const mix = (x, y) => x + (y - x) * u;
  return {
    pos: [mix(a.pos[0], b.pos[0]), mix(a.pos[1], b.pos[1]), mix(a.pos[2], b.pos[2])],
    roll: mix(a.roll, b.roll), yaw: mix(a.yaw ?? 0, b.yaw ?? 0), pitch: mix(a.pitch ?? 0, b.pitch ?? 0), zoom: mix(a.zoom, b.zoom),
  };
}

// 中継点を含む1回の移動（keys[s]〜keys[e]）の中の、時刻 t の姿勢。keys[i].t <= t < keys[i+1].t
function moveAt(keys, i, t) {
  let s = i;
  while (s > 0 && keys[s].via && keys[s].ease !== 'cut') s--;
  let e = i + 1;
  while (e < keys.length - 1 && keys[e].via && keys[e + 1].ease !== 'cut') e++;
  const k0 = keys[s];
  const k1 = keys[e];
  const span = k1.t - k0.t;
  // 移動全体の進み具合を、曲線の上の「道のり時刻」tau に直す
  const tau = k0.t + (span > 0 ? easeOf(k1)((t - k0.t) / span) : 1) * span;
  let j = s;
  while (j < e - 1 && keys[j + 1].t <= tau) j++;
  const P = m => vec(keys[m]);
  // 各キーでの曲線の向き：両端は隣への直線の向き、中は前後のキーを結ぶ向き（時刻の間隔で割る）
  const slope = (m0, m1) => { const dt = keys[m1].t - keys[m0].t; const p0 = P(m0), p1 = P(m1); return p1.map((x, k) => (dt > 0 ? (x - p0[k]) / dt : 0)); };
  const tangent = m => {
    if (m <= s) return slope(s, s + 1);
    if (m >= e) return slope(e - 1, e);
    const d = slope(m - 1, m + 1);
    // 行って戻る道（大きく引いて戻るなど）では前後を結ぶ向きが短く、折り返しで止まりかける。
    // 位置の勢いを、前後の区間の平均の速さまで足す（大回りしすぎないよう 2.5 倍まで）
    const speed = v => Math.hypot(v[0], v[1], v[2]);
    const want = (speed(slope(m - 1, m)) + speed(slope(m, m + 1))) / 2;
    const have = speed(d);
    const k = have > 1e-9 ? Math.min(2.5, Math.max(1, want / have)) : 1;
    return d.map((x, q) => (q < 3 ? x * k : x));
  };
  const h = keys[j + 1].t - keys[j].t;
  if (!(h > 0)) return fromVec(P(j + 1));
  const x = clamp01((tau - keys[j].t) / h);
  const x2 = x * x, x3 = x2 * x;
  const h00 = 2 * x3 - 3 * x2 + 1, h10 = x3 - 2 * x2 + x, h01 = -2 * x3 + 3 * x2, h11 = x3 - x2;
  const p0 = P(j), p1 = P(j + 1), m0 = tangent(j), m1 = tangent(j + 1);
  const v = p0.map((_, k) => h00 * p0[k] + h10 * h * m0[k] + h01 * p1[k] + h11 * h * m1[k]);
  if (!v.every(Number.isFinite)) return copy(keys[j]);
  return fromVec(v);
}

/**
 * 世界の点 p を、カメラ cam から見た画面の位置に映す。映せなければ null
 * （点がカメラの後ろ・近すぎる／大きさが数でない・0 以下）。
 * @returns {{x:number, y:number, scale:number, dz:number}|null}
 */
export function project(cam, p, size) {
  const w = size?.width;
  const h = size?.height;
  if (!(w > 0 && h > 0 && Number.isFinite(w) && Number.isFinite(h))) return null;
  if (!Array.isArray(p) || p.length < 3) return null;
  // 相対位置を、カメラの向き（yaw：Y 軸 → pitch：X 軸）に合わせて回す。yaw・pitch が 0 なら何も変わらない
  const ox = p[0] - cam.pos[0];
  const oy = p[1] - cam.pos[1];
  const oz = p[2] - cam.pos[2];
  const yaw = cam.yaw ?? 0;
  const pitch = cam.pitch ?? 0;
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  const dx = ox * cy - oz * sy;
  const z1 = ox * sy + oz * cy;
  const dy = oy * cp - z1 * sp;
  const dz = oy * sp + z1 * cp;
  if (!(dz >= NEAR)) return null;
  const c = Math.cos(cam.roll);
  const s = Math.sin(cam.roll);
  const rx = dx * c + dy * s;
  const ry = -dx * s + dy * c;
  const scale = Math.min(MAX_SCALE, cam.zoom / dz);
  const short = Math.min(w, h);
  return { x: w / 2 + rx * scale * short, y: h / 2 + ry * scale * short, scale, dz };
}

const PLANE_STEP = 0.05; // 板の2軸の向きを測るために、原点から進める世界の距離

// 板の向きの行列：roll（Z 軸）→ pitch（X 軸）→ yaw（Y 軸）の順に、ベクトルを回す。
// 注意：板の rot.pitch = p は、カメラの pitch = -p に正対する（yaw・roll はカメラと同じ向き）。板をカメラに向けるときは符号に気をつける
export function rotate(v, rot) {
  const cr = Math.cos(rot.roll ?? 0), sr = Math.sin(rot.roll ?? 0);
  const cp = Math.cos(rot.pitch ?? 0), sp = Math.sin(rot.pitch ?? 0);
  const cw = Math.cos(rot.yaw ?? 0), sw = Math.sin(rot.yaw ?? 0);
  let [x, y, z] = v;
  [x, y] = [x * cr - y * sr, x * sr + y * cr];
  [y, z] = [y * cp - z * sp, y * sp + z * cp];
  [x, z] = [x * cw + z * sw, -x * sw + z * cw];
  return [x, y, z];
}

/**
 * 空間に固定した文字の板を、カメラから見た画面に映す。
 * 板の局所座標は「短辺 = 1 のとき 1 単位 = 短辺の画素」（文字の大きさ U と同じ）。
 * pos が板の原点、rot = {yaw, pitch, roll} が板の向き。返す m = [a,b,c,d,e,f] は ctx.transform に渡す行列：
 * 原点と、板の右（ex）・下（ey）へ少し進めた2点を project して、その差から作る（遠近の収束は無視する近似）。
 * 映せない（どの点もカメラの後ろ・近すぎる、真横でつぶれる、NaN が混じる）ときは null。
 * @returns {{m:number[], x:number, y:number, scale:number, dz:number}|null}
 */
export function projectPlane(cam, pos, rot, size) {
  const p0 = project(cam, pos, size);
  if (!p0 || !rot) return null;
  const ex = rotate([1, 0, 0], rot);
  const ey = rotate([0, 1, 0], rot);
  const k = PLANE_STEP;
  const p1 = project(cam, [pos[0] + ex[0] * k, pos[1] + ex[1] * k, pos[2] + ex[2] * k], size);
  const p2 = project(cam, [pos[0] + ey[0] * k, pos[1] + ey[1] * k, pos[2] + ey[2] * k], size);
  if (!p1 || !p2) return null;
  const short = Math.min(size.width, size.height);
  const f = k * short;
  const m = [(p1.x - p0.x) / f, (p1.y - p0.y) / f, (p2.x - p0.x) / f, (p2.y - p0.y) / f, p0.x, p0.y];
  if (!m.every(Number.isFinite)) return null;
  const scale = Math.hypot(m[0], m[1]);
  // 面積（行列式）が正でなければ、真横でつぶれたか、裏向き（鏡文字になる）。映さない
  if (!(m[0] * m[3] - m[1] * m[2] > 1e-4 * scale * scale) || !(scale > 0)) return null;
  return { m, x: p0.x, y: p0.y, scale, dz: p0.dz };
}
