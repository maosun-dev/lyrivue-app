// 文字を載せる「器」の一覧（2026-10-19 見本 app/vessel-check.html で持ち主に選んでもらう候補）。
// 器は draw(c, S)。S は tools.js の vesselTools。ownExit の器は自分で消え、それ以外はここで薄くしながら少し大きくして消す。
import cells from './cells.js';
import paper from './paper.js';
import signs from './signs.js';
import dots from './dots.js';
import solid from './solid.js';

export { vesselTools } from './tools.js';

export const VESSEL_CATS = {
  cell: '1文字ずつ', paper: '紙もの', tape: '帯・切符', sign: '看板・標識', shape: '丸・図形', dot: '点の文字', meter: '計器・画面', solid: '立体（回り込む）',
};
export const VESSELS = [];
const add = (cat, id, name, draw, extra = {}) => VESSELS.push({ cat, id, name, draw, ...extra });
[cells, paper, signs, dots, solid].forEach(f => f(add));
// 種類の順に並べる
const order = Object.keys(VESSEL_CATS);
VESSELS.sort((a, b) => order.indexOf(a.cat) - order.indexOf(b.cat));
// 本編（雰囲気 S）で使う器：持ち主が「いい／直して」にしたもののうち平面の 47 種（2026-10-19）。
// 入れないのは、いらない 2 種（波打つリボン・立体のキーボード）と、器の中で自分のカメラを回している立体（次の段で空間の立体に作り直す）
const NOT_MAIN = new Set(['ribbon', 'keys3d']);
export const MAIN_VESSELS = VESSELS.filter(v => v.cat !== 'solid' && !NOT_MAIN.has(v.id));
export const VESSEL_BY_ID = Object.fromEntries(MAIN_VESSELS.map(v => [v.id, v]));

/** 器を 1 つ描く（c は呼ぶ側で save/restore しなくてよい） */
export function drawVessel(c, def, S) {
  c.save();
  c.textAlign = 'left';
  c.textBaseline = 'alphabetic';
  c.lineJoin = 'round';
  c.lineCap = 'butt';
  c.setLineDash([]);
  if (!def.ownExit) {
    const k = 1 + (1 - S.vis) * 0.08;
    c.globalAlpha = S.vis;
    c.translate(S.cx, S.cy); c.scale(k, k); c.translate(-S.cx, -S.cy);
  }
  def.draw(c, S);
  c.restore();
}
