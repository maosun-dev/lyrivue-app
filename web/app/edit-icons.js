// 行を直す画面の、小さな絵のボタン（自作）。来かた＝カメラ（点）の通る道すじと行の札、傾き＝傾いた札。
// どれも 44×30 の枠に、線（currentColor）で描く。
const svg = body => `<svg viewBox="0 0 44 30" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
const card = (x, y, w = 12, h = 8) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="1.2" fill="currentColor" fill-opacity=".18"/>`;
const dot = (x, y) => `<circle cx="${x}" cy="${y}" r="2.4" fill="currentColor" stroke="none"/>`;
const tip = (x, y, ang) => { // 矢じり（角度は度、向かう向き）
  const r = a => [x - 4 * Math.cos((ang + a) * Math.PI / 180), y - 4 * Math.sin((ang + a) * Math.PI / 180)].map(v => v.toFixed(1)).join(' ');
  return `<path d="M${r(-35)} L${x} ${y} L${r(35)}"/>`;
};
const spark = (x, y) => `<path d="M${x} ${y - 5}v10M${x - 5} ${y}h10M${x - 3} ${y - 3}l6 6M${x + 3} ${y - 3}l-6 6" stroke-width="1.2"/>`;

export const CAM_ICONS = {
  auto: svg(card(10, 13, 16, 10) + spark(33, 9)),
  left: svg(card(28, 11) + dot(4, 22) + '<path d="M7 20 Q14 5 25 14" stroke-dasharray="2.5 2.5"/>' + tip(25.5, 14.5, 40)),
  right: svg(card(4, 11) + dot(40, 22) + '<path d="M37 20 Q30 5 19 14" stroke-dasharray="2.5 2.5"/>' + tip(18.5, 14.5, 140)),
  up: svg(card(16, 19) + dot(7, 3) + '<path d="M9 5 Q24 4 22 16" stroke-dasharray="2.5 2.5"/>' + tip(22, 16.5, 95)),
  down: svg(card(16, 3) + dot(7, 27) + '<path d="M9 25 Q24 26 22 14" stroke-dasharray="2.5 2.5"/>' + tip(22, 13.5, -95)),
  straight: svg('<rect x="3" y="2" width="38" height="26" rx="2" stroke-dasharray="3 3" stroke-width="1.1"/>' + card(16, 11) + '<path d="M7 6l6 4M37 6l-6 4M7 24l6-4M37 24l-6-4"/>'),
  wide: svg('<rect x="3" y="2" width="38" height="26" rx="2" stroke-width="1.1"/>' + card(18, 12, 8, 6) + '<path d="M16 10l-8-5M28 10l8-5M16 20l-8 5M28 20l8 5"/>' + tip(8, 5, 212) + tip(36, 5, -32)),
  cruise: svg('<path d="M2 28L19 13M42 28L25 13" stroke-width="1.1"/>' + card(18, 9, 8, 5) + '<path d="M17 25l5-3 5 3M18 20l4-2.4 4 2.4"/>'),
  dive: svg('<path d="M6 6h12v18H6z" stroke-dasharray="0" fill="currentColor" fill-opacity=".1"/>' + card(32, 12, 9, 6) + dot(2, 22) + '<path d="M4 21 Q13 14 22 15 T31 15" stroke-dasharray="2.5 2.5"/>' + tip(31.5, 15, 0)),
  warp: svg(card(17, 12, 10, 6) + '<path d="M3 4l9 6M41 4l-9 6M3 26l9-6M41 26l-9-6M1 15h9M43 15h-9M22 1v6M22 29v-6" stroke-width="1.3"/>'),
};

const plate = pts => `<path d="M${pts.map(p => p.join(' ')).join(' L')} Z" fill="currentColor" fill-opacity=".18"/>`
  + `<path d="M${lerp(pts[0], pts[3], 0.5).join(' ')} L${lerp(pts[1], pts[2], 0.5).join(' ')}" stroke-width="1.1" stroke-dasharray="2 2"/>`; // 文字の並び
const lerp = (a, b, k) => [+(a[0] + (b[0] - a[0]) * k).toFixed(1), +(a[1] + (b[1] - a[1]) * k).toFixed(1)];
const turned = (deg, body) => `<g transform="rotate(${deg} 22 15)">${body}</g>`;

export const TILT_ICONS = {
  auto: svg(plate([[8, 9], [28, 9], [28, 23], [8, 23]]) + spark(35, 8)),
  front: svg(plate([[9, 8], [35, 8], [35, 22], [9, 22]])),
  left: svg(plate([[9, 6], [33, 10], [33, 20], [9, 24]])),   // 面が左を向く：右の端が奥へ（短く）
  right: svg(plate([[11, 10], [35, 6], [35, 24], [11, 20]])),
  up: svg(plate([[13, 9], [31, 9], [36, 23], [8, 23]])),     // 面が上を向く：上の端が奥へ
  down: svg(plate([[8, 7], [36, 7], [31, 21], [13, 21]])),
  rollL: svg(turned(-20, plate([[9, 8], [35, 8], [35, 22], [9, 22]]))),
  rollR: svg(turned(20, plate([[9, 8], [35, 8], [35, 22], [9, 22]]))),
  slant: svg(plate([[12, 4], [37, 10], [32, 26], [7, 19]])),
  lay: svg(plate([[15, 14], [29, 14], [39, 23], [5, 23]]) + '<path d="M2 27h40" stroke-width="1" stroke-dasharray="1.5 2.5"/>'),
};

// 位置と回転のボタン：行の札を少しずらす・回す・戻す
const arrowTo = (x1, y1, x2, y2, ang) => `<path d="M${x1} ${y1}L${x2} ${y2}"/>` + tip(x2, y2, ang);
export const NUDGE_ICONS = {
  left: svg(card(22, 11) + arrowTo(18, 15, 6, 15, 180)),
  right: svg(card(10, 11) + arrowTo(26, 15, 38, 15, 0)),
  up: svg(card(16, 17) + arrowTo(22, 13, 22, 3, -90)),
  down: svg(card(16, 5) + arrowTo(22, 17, 22, 27, 90)),
  rollL: svg(turned(-18, card(16, 11)) + '<path d="M33 9 A 12 12 0 0 0 11 9"/>' + tip(11, 9, 120)),
  rollR: svg(turned(18, card(16, 11)) + '<path d="M11 9 A 12 12 0 0 1 33 9"/>' + tip(33, 9, 60)),
  center: svg('<path d="M22 2v6M22 22v6M6 15h6M32 15h6" stroke-width="1.2"/>' + card(16, 11)),
  level: svg('<path d="M4 25h36" stroke-width="1.1" stroke-dasharray="2 2"/>' + card(16, 11)),
};
// 前の行・次の行のボタンに添える小さな矢印
export const ARROW_ICONS = {
  prev: '<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 2L4 6l4 4"/></svg>',
  next: '<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 2l4 4-4 4"/></svg>',
};
