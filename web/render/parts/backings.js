// 文字の台紙（雰囲気 S の世界ごと）：行の文字の後ろに敷くもの。text-motion が文字を描く前に、板の局所座標で呼ぶ。
// 板と一緒に傾く。box = 行の文字の外枠 {x, y, w, h}（局所座標の画素。y は下向き）。色は世界の配色（env.ink）。
// kind は director/worlds.js の back。alpha は行の濃さ（出てくる・歌い終えた・まだ歌う前で変わる）。
import { hash01 } from '../rand.js';

const TAU = Math.PI * 2;

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y); ctx.arcTo(x + w, y, x + w, y + rr, rr);
  ctx.lineTo(x + w, y + h - rr); ctx.arcTo(x + w, y + h, x + w - rr, y + h, rr);
  ctx.lineTo(x + rr, y + h); ctx.arcTo(x, y + h, x, y + h - rr, rr);
  ctx.lineTo(x, y + rr); ctx.arcTo(x, y, x + rr, y, rr);
  ctx.closePath();
}
const seg = (ctx, pts) => { ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke(); };

// 台紙ごとの描き方。b = 少し広げた枠 {x,y,w,h,cx,cy,u（文字の高さ）}、ink、t
const DRAW = {
  // 空と線画：細い下線と、短い目盛り
  line(ctx, b, ink) {
    ctx.strokeStyle = ink.line;
    ctx.globalAlpha *= 0.8;
    const y = b.y + b.h;
    seg(ctx, [[b.x, y], [b.x + b.w, y]]);
    for (let q = 0; q <= 8; q++) { const x = b.x + b.w * q / 8; seg(ctx, [[x, y], [x, y + b.u * (q % 4 === 0 ? 0.22 : 0.1)]]); }
  },
  // 方眼の計器：四隅の角括弧と、行の番号
  bracket(ctx, b, ink, t, no) {
    ctx.strokeStyle = ink.line;
    const L = b.u * 0.35;
    for (const [x, y, dx, dy] of [[b.x, b.y, 1, 1], [b.x + b.w, b.y, -1, 1], [b.x, b.y + b.h, 1, -1], [b.x + b.w, b.y + b.h, -1, -1]]) seg(ctx, [[x + dx * L, y], [x, y], [x, y + dy * L]]);
    ctx.fillStyle = ink.accent;
    ctx.font = `${b.u * 0.22}px "DotGothic16", monospace`;
    ctx.fillText(`#${String(no).padStart(2, '0')}`, b.x, b.y - b.u * 0.08);
  },
  // 紙のカード：少しずれた影、カード、上のテープ
  card(ctx, b, ink) {
    const a = ctx.globalAlpha;
    ctx.fillStyle = ink.line;
    ctx.globalAlpha = a * 0.25;
    ctx.fillRect(b.x + b.u * 0.08, b.y + b.u * 0.1, b.w, b.h);
    ctx.globalAlpha = a * 0.95;
    ctx.fillStyle = ink.card ?? '#fbf9f3'; // 紙の時間で変わる（夜は暗いカード）
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.globalAlpha = a * 0.7;
    ctx.fillStyle = ink.accent;
    ctx.fillRect(b.cx - b.u * 0.45, b.y - b.u * 0.12, b.u * 0.9, b.u * 0.26);
  },
  // ポップな図形：色のずれた角丸の塊
  blob(ctx, b, ink) {
    const a = ctx.globalAlpha;
    ctx.fillStyle = ink.fg;
    ctx.globalAlpha = a;
    roundRect(ctx, b.x + b.u * 0.12, b.y + b.u * 0.12, b.w, b.h, b.u * 0.4); ctx.fill();
    ctx.fillStyle = ink.accent;
    roundRect(ctx, b.x, b.y, b.w, b.h, b.u * 0.4); ctx.fill();
  },
  // 1色の網点：網点の帯
  halftone(ctx, b, ink) {
    ctx.fillStyle = ink.line;
    ctx.globalAlpha *= 0.45;
    const cell = Math.max(2, b.u * 0.16);
    ctx.beginPath();
    for (let y = b.y + cell / 2; y < b.y + b.h; y += cell) {
      for (let x = b.x + cell / 2; x < b.x + b.w; x += cell) {
        const r = cell * 0.42 * (0.4 + 0.6 * Math.sin(((x - b.x) / b.w) * Math.PI));
        ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, TAU);
      }
    }
    ctx.fill();
  },
  // 夜の街の線画：看板の枠と、上から吊る 2 本の線
  sign(ctx, b, ink) {
    ctx.strokeStyle = ink.accent;
    roundRect(ctx, b.x, b.y, b.w, b.h, b.u * 0.12); ctx.stroke();
    for (const x of [b.x + b.w * 0.2, b.x + b.w * 0.8]) seg(ctx, [[x, b.y], [x, b.y - b.u * 0.6]]);
  },
  // 新聞・雑誌：上下の太い罫線（上は二重）
  rule(ctx, b, ink) {
    ctx.strokeStyle = ink.fg;
    const lw = ctx.lineWidth;
    ctx.lineWidth = lw * 3;
    seg(ctx, [[b.x, b.y], [b.x + b.w, b.y]]);
    seg(ctx, [[b.x, b.y + b.h], [b.x + b.w, b.y + b.h]]);
    ctx.lineWidth = lw;
    seg(ctx, [[b.x, b.y - lw * 4], [b.x + b.w, b.y - lw * 4]]);
  },
  // 光る線の枠：太い薄い線と、細い明るい線を重ねた角丸の枠（拍でちらつかない、静かに光る）
  tube(ctx, b, ink) {
    const a = ctx.globalAlpha, lw = ctx.lineWidth;
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = ink.line;
    ctx.globalAlpha = a * 0.18; ctx.lineWidth = lw * 6;
    roundRect(ctx, b.x, b.y, b.w, b.h, b.u * 0.35); ctx.stroke();
    ctx.globalAlpha = a * 0.9; ctx.lineWidth = lw * 1.6;
    roundRect(ctx, b.x, b.y, b.w, b.h, b.u * 0.35); ctx.stroke();
  },
  // 水の中：行の下から広がる波紋の輪
  ripple(ctx, b, ink, t) {
    ctx.strokeStyle = ink.line;
    const a = ctx.globalAlpha;
    for (let q = 0; q < 3; q++) {
      const f = (t * 0.5 + q / 3) % 1;
      ctx.globalAlpha = a * (1 - f) * 0.8;
      ctx.beginPath(); ctx.ellipse(b.cx, b.y + b.h, b.w * (0.3 + 0.4 * f), b.u * (0.12 + 0.2 * f), 0, 0, TAU); ctx.stroke();
    }
  },
  // 星図：行を巡る楕円の軌道線と、その上を回る小さな星
  orbit(ctx, b, ink, t) {
    ctx.strokeStyle = ink.line;
    ctx.beginPath(); ctx.ellipse(b.cx, b.cy, b.w * 0.6, b.h * 0.85, -0.12, 0, TAU); ctx.stroke();
    const an = t * 0.8;
    ctx.fillStyle = ink.accent;
    ctx.beginPath(); ctx.arc(b.cx + Math.cos(an) * b.w * 0.6, b.cy + Math.sin(an) * b.h * 0.85, b.u * 0.07, 0, TAU); ctx.fill();
  },
  // 設計図：行の上の寸法線（両矢印と数字）と、両端の縦線
  dimension(ctx, b, ink) {
    ctx.strokeStyle = ink.fg;
    const y = b.y - b.u * 0.25, ah = b.u * 0.12;
    seg(ctx, [[b.x, b.y + b.h * 0.3], [b.x, y - ah]]);
    seg(ctx, [[b.x + b.w, b.y + b.h * 0.3], [b.x + b.w, y - ah]]);
    seg(ctx, [[b.x, y], [b.x + b.w, y]]);
    seg(ctx, [[b.x + ah, y - ah * 0.6], [b.x, y], [b.x + ah, y + ah * 0.6]]);
    seg(ctx, [[b.x + b.w - ah, y - ah * 0.6], [b.x + b.w, y], [b.x + b.w - ah, y + ah * 0.6]]);
    ctx.fillStyle = ink.fg;
    ctx.font = `${b.u * 0.2}px "DotGothic16", monospace`;
    ctx.textAlign = 'center';
    ctx.fillText(String(Math.round(b.w)), b.cx, y - b.u * 0.06);
    ctx.textAlign = 'left';
  },
  // 映画のフィルム：コマの枠（角は少し丸く、四隅に小さな印）
  frame(ctx, b, ink) {
    ctx.strokeStyle = ink.line;
    roundRect(ctx, b.x, b.y, b.w, b.h, b.u * 0.08); ctx.stroke();
    ctx.fillStyle = ink.accent;
    const d = b.u * 0.07;
    for (const [x, y] of [[b.x, b.y], [b.x + b.w, b.y], [b.x, b.y + b.h], [b.x + b.w, b.y + b.h]]) ctx.fillRect(x - d, y - d, d * 2, d * 2);
  },
  // 黒板：手書きの丸囲み（少しはみ出して閉じきらない）
  chalk(ctx, b, ink, t, no) {
    ctx.strokeStyle = ink.fg;
    ctx.lineWidth *= 1.8;
    ctx.globalAlpha *= 0.75;
    ctx.beginPath();
    for (let q = 0; q <= 30; q++) {
      const an = q / 26 * TAU - 0.4;
      const wob = 1 + 0.05 * Math.sin(q * 1.9 + no);
      const x = b.cx + Math.cos(an) * b.w * 0.58 * wob, y = b.cy + Math.sin(an) * b.h * 0.8 * wob;
      if (q) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    }
    ctx.stroke();
  },
  // 森の葉：ぎざぎざの縁の切り絵の台紙
  cutout(ctx, b, ink, t, no) {
    ctx.fillStyle = ink.line;
    ctx.globalAlpha *= 0.55;
    ctx.beginPath();
    const n = 28;
    for (let q = 0; q < n; q++) {
      const f = q / n, side = Math.floor(f * 4), u = f * 4 - side;
      const jag = (hash01(171, no, q) - 0.5) * b.u * 0.18;
      const [x, y] = side === 0 ? [b.x + b.w * u, b.y + jag] : side === 1 ? [b.x + b.w + jag, b.y + b.h * u] : side === 2 ? [b.x + b.w * (1 - u), b.y + b.h + jag] : [b.x + jag, b.y + b.h * (1 - u)];
      if (q) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
  },
  // 万華鏡：行を囲む逆向きの 2 つの三角
  prism(ctx, b, ink) {
    const r = Math.max(b.w, b.h) * 0.62;
    for (const [sgn, col] of [[1, ink.line], [-1, ink.accent]]) {
      ctx.strokeStyle = col;
      ctx.beginPath();
      for (let q = 0; q <= 3; q++) { const an = -sgn * Math.PI / 2 + q / 3 * TAU; const x = b.cx + Math.cos(an) * r, y = b.cy + Math.sin(an) * r * 0.55; if (q) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
      ctx.stroke();
    }
  },
  // 雨の窓：曇りを指で拭いた跡（明るい横長の塊）
  fog(ctx, b, ink) {
    ctx.fillStyle = ink.fg;
    ctx.globalAlpha *= 0.12;
    roundRect(ctx, b.x - b.u * 0.2, b.y, b.w + b.u * 0.4, b.h, b.h / 2); ctx.fill();
    ctx.globalAlpha *= 0.8;
    roundRect(ctx, b.x, b.y + b.h * 0.15, b.w, b.h * 0.7, b.h / 2); ctx.fill();
  },
  // ゲーム画面：ドットの会話枠（黒い地に白い二重の線）
  dialog(ctx, b, ink) {
    const a = ctx.globalAlpha, d = Math.max(1, b.u * 0.06);
    ctx.globalAlpha = a * 0.85;
    ctx.fillStyle = ink.bg;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.globalAlpha = a;
    ctx.fillStyle = ink.fg;
    ctx.fillRect(b.x, b.y, b.w, d); ctx.fillRect(b.x, b.y + b.h - d, b.w, d);
    ctx.fillRect(b.x, b.y, d, b.h); ctx.fillRect(b.x + b.w - d, b.y, d, b.h);
    ctx.fillStyle = ink.line;
    ctx.fillRect(b.x + b.w - d * 4, b.y + b.h - d * 4, d * 2, d * 2); // 「次へ」の印
  },
  // 夕焼けの影絵：夕日の色の帯（文字は影の色で読める）
  band(ctx, b, ink) {
    ctx.fillStyle = ink.accent;
    ctx.globalAlpha *= 0.85;
    ctx.fillRect(b.x - b.u * 0.6, b.y + b.h * 0.08, b.w + b.u * 1.2, b.h * 0.84);
  },
};

/** 台紙の種類の一覧 */
export const BACKINGS = Object.keys(DRAW);

/**
 * @param {CanvasRenderingContext2D} ctx 板の局所座標になっている ctx
 * @param {string} kind 台紙の種類
 * @param {{x:number,y:number,w:number,h:number}} box 行の文字の外枠
 * @param {Object} env 部品の env（ink を使う）
 * @param {number} t 時刻
 * @param {number} alpha 濃さ
 * @param {number} [no] 行の番号（番号や揺らぎに使う）
 * @param {number} [unit] 1 文字の大きさ（線の太さ・余白・番号の文字の大きさの元。無ければ枠の高さ。
 *   縦組みや折り返しの行は枠が何文字ぶんも高いので、枠の高さで決めると太く大きくなりすぎる）
 */
export function drawBacking(ctx, kind, box, env, t, alpha, no = 0, unit) {
  const draw = DRAW[kind];
  if (!draw || !box || ![box.x, box.y, box.w, box.h].every(Number.isFinite) || !(box.w > 0 && box.h > 0) || !(alpha > 0)) return;
  const ink = env?.ink && typeof env.ink.bg === 'string' ? env.ink : { bg: '#000000', fg: '#f4f4f4', line: '#888888', accent: '#ffffff' };
  const u = Number.isFinite(unit) && unit > 0 ? Math.min(unit, box.h) : box.h;
  const pad = u * 0.22;
  const b = { x: box.x - pad, y: box.y - pad * 0.6, w: box.w + pad * 2, h: box.h + pad * 1.2, u };
  b.cx = b.x + b.w / 2;
  b.cy = b.y + b.h / 2;
  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = Math.min(1, alpha);
  ctx.lineWidth = Math.max(1, u * 0.035);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.textAlign = 'left';
  draw(ctx, b, ink, Number.isFinite(t) ? t : 0, Number.isFinite(no) ? no : 0);
  ctx.restore();
}
