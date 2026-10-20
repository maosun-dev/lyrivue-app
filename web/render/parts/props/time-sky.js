// 連想の小物：時間と暦・空と天気・宇宙。A = {t（現れてからの秒）, T（曲の時刻）, ph（拍の中の位置 0〜1）, bi（拍の番号）, b（拍の頭の強さ）, i（場面の強さ）, r（小物ごとの 0〜1）}
import { TAU, line, loop, pl, arc, circle, oval, ngon, rect, rrect, box, cyl, cone, ball, star, spiral, coil, wave, zig, spokes, bez, grid, dashed, textLines, rep, mv, sc, rotZ, rotY, rotX, mirror, hot, tri, saw } from './geo.js';

// 時計回りの角度 a（0 = 12 時）・長さ L の針
const hand = (a, L, back = 0.12) => line([-Math.sin(a) * back, -Math.cos(a) * back], [Math.sin(a) * L, Math.cos(a) * L]);
// 拍で 1 目盛りずつ進む秒針の角度
const tick = (A, steps = 16) => ((A.bi + Math.min(1, A.ph * 5)) / steps) * TAU;
/** 歯車（歯の数 n・外 r1・内 r2・回転 rot） */
export function gear(n, r1, r2, c = [0, 0, 0], rot = 0) {
  const pts = [];
  for (let k = 0; k < n; k++) {
    const a = rot + (k / n) * TAU, d = TAU / n;
    for (const [u, r] of [[0, r2], [0.15, r1], [0.5, r1], [0.65, r2]]) pts.push([c[0] + Math.cos(a + u * d) * r, c[1] + Math.sin(a + u * d) * r, c[2] ?? 0]);
  }
  pts.push([...pts[0]]);
  return pts;
}
// 文字盤（目盛りと奥の板つき）
const face = (r = 1, n = 12) => [circle(r), circle(r * 0.93), circle(r, [0, 0, 0.18]), spokes(n, r * 0.78, r * 0.9), spokes(4, r * 0.7, r * 0.9)];
// 雲の輪郭（幅 w・高さ h）
export function cloudShape(w = 1, h = 0.5, c = [0, 0, 0], z = 0) {
  return rep(49, k => { const a = (k / 48) * TAU; const bump = 1 + 0.16 * Math.abs(Math.sin(a * 3.5)); const y = Math.sin(a) * h * bump; return [c[0] + Math.cos(a) * w * bump, c[1] + Math.max(y, -h * 0.55), (c[2] ?? 0) + z]; });
}

export const TIME_SKY = {
  // ── 時間と暦
  clock: A => [face(1), hand(-A.T * 0.02, 0.45), hand(A.T * 0.25, 0.72), hot(hand(tick(A), 0.85, 0.2)), circle(0.05)],
  watch: A => [face(0.62), rect(0.5, 0.55, [0, 0.9]), rect(0.5, 0.55, [0, -0.9]), hand(A.T * 0.25, 0.42), hot(hand(tick(A), 0.52))],
  hourglass: A => {
    const fall = saw(A.T / 6);
    const glass = rep(4, k => { const a = (k / 4) * TAU + 0.6, x = Math.cos(a), z = Math.sin(a); return line([x * 0.55, 0.85, z * 0.55], [x * 0.08, 0, z * 0.08], [x * 0.55, -0.85, z * 0.55]); });
    return [circle(0.62, [0, 0.9, 0], 'y'), circle(0.62, [0, -0.9, 0], 'y'), glass, hot(oval(0.45 * (1 - fall) + 0.05, 0.45 * (1 - fall) + 0.05, [0, 0.2 + 0.5 * (1 - fall), 0], 'y', 16)),
      hot(dashed([0, 0], [0, -0.8 + 0.3 * fall], 4)), hot(cone(0.4 * fall + 0.04, 0.35 * fall + 0.02, [0, -0.85, 0], 12, 0))];
  },
  alarm: A => rotZ([face(0.8), arc(0.3, 0, Math.PI, [-0.55, 0.75]), arc(0.3, 0, Math.PI, [0.55, 0.75]), line([-0.5, -0.75], [-0.7, -1]), line([0.5, -0.75], [0.7, -1]), hand(A.T * 0.25, 0.55), hot(hand(tick(A, 12), 0.65))], Math.sin(A.T * 45) * 0.08 * A.b),
  calendar: A => {
    const flip = Math.min(1, (saw(A.T / 2.4) * 2.4) / 0.5);
    const page = [rect(1.6, 1.5, [0, -0.15]), textLines(1.2, 0.2, 1, [0, 0.4]), grid(1.3, 0.9, 7, 4, [0, -0.35])];
    return [rect(1.7, 1.6, [0, -0.15, 0.08]), rep(4, k => circle(0.07, [-0.6 + k * 0.4, 0.62], 'x')), page, hot(rotX(rect(1.6, 1.5, [0, -0.15]), -flip * Math.PI * 0.95, [0, 0.6, 0]))];
  },
  metronome: A => [pl([-0.6, -0.9, 0.6, -0.9, 0.25, 0.9, -0.25, 0.9], true), pl([-0.6, -0.9, -0.5, -0.9, -0.6, -0.9], false, 0.3), line([-0.6, -0.9, 0.3], [-0.25, 0.9, 0.3], [0.25, 0.9, 0.3], [0.6, -0.9, 0.3]), line([-0.4, -0.5], [0.4, -0.5]),
    hot(rotZ([line([0, -0.5], [0, 0.95]), rect(0.18, 0.12, [0, 0.45])], Math.sin((A.bi + A.ph) * Math.PI) * 0.55, [0, -0.5]))],
  sundial: A => [circle(1, [0, 0, 0], 'y'), circle(0.85, [0, 0, 0], 'y'), spokes(12, 0.85, 1, [0, 0, 0], 0, 'y'), line([0, 0, 0], [0, 0.7, 0], [0, 0, 0.7]), hot(line([0, 0.01, 0], [Math.cos(A.T * 0.2) * 0.8, 0.01, Math.sin(A.T * 0.2) * 0.8]))],
  pendulum: A => { const a = Math.sin(A.T * 2.2) * 0.6; return [rect(1.4, 2, [0, 0, 0.1]), line([-0.7, 0.95], [0.7, 0.95]), hot(rotZ([line([0, 0.9], [0, -0.55]), circle(0.2, [0, -0.7])], a, [0, 0.9]))]; },
  stopwatch: A => [face(0.85, 60), rect(0.2, 0.18, [0, 1.0]), line([0, 0.85], [0, 0.92]), line([0.6, 0.7], [0.72, 0.82]), hot(hand(A.T * 3, 0.75)), circle(0.22, [0, -0.35]), hand(A.T * 0.3, 0.18)],
  gear: A => [gear(12, 0.75, 0.6, [-0.3, 0.1], A.T * 0.6), circle(0.2, [-0.3, 0.1]), hot(gear(8, 0.5, 0.38, [0.62, -0.5], -A.T * 0.9 + 0.2)), circle(0.12, [0.62, -0.5]), mv(gear(12, 0.75, 0.6, [-0.3, 0.1], A.T * 0.6), 0, 0, 0.15)],
  countdown: A => { const n = 3 - (A.bi % 4); const digits = { 3: [-0.4, 0.7, 0.4, 0.7, 0, 0.05, 0.4, -0.3, 0, -0.7, -0.4, -0.6], 2: [-0.4, 0.5, 0, 0.75, 0.4, 0.45, -0.4, -0.7, 0.4, -0.7], 1: [-0.15, 0.55, 0.1, 0.75, 0.1, -0.7], 0: [0, 0.75, 0.4, 0, 0, -0.75, -0.4, 0, 0, 0.75] }; return [circle(1), circle(0.9), hot(pl(digits[n] ?? digits[0])), hot(arc(0.95, Math.PI / 2, Math.PI / 2 - A.ph * TAU))]; },
  // ── 空と天気
  cloud: A => { const d = Math.sin(A.T * 0.25) * 0.25; return [cloudShape(1, 0.5, [d, 0.1]), cloudShape(1, 0.5, [d, 0.1], 0.2), hot(cloudShape(0.55, 0.28, [-d - 0.4, -0.55, 0.4]))]; },
  sun: A => [circle(0.45), circle(0.45, [0, 0, 0.1]), hot(spokes(12, 0.6, 0.85 + 0.2 * A.b, [0, 0, 0], A.T * 0.3)), spokes(12, 0.62, 0.72, [0, 0, 0], A.T * 0.3 + TAU / 24)],
  rainbow: A => [rep(5, k => arc(1 - k * 0.13, 0, Math.PI, [0, -0.4, k * 0.03])), hot(arc(1 - (A.bi % 5) * 0.13, 0, Math.PI, [0, -0.4])), cloudShape(0.35, 0.18, [-0.88, -0.42]), cloudShape(0.35, 0.18, [0.88, -0.42])],
  lightning: A => { const bolt = pl([0.15, 1, -0.35, 0.05, 0.05, 0.05, -0.25, -1, 0.4, 0.2, 0, 0.2, 0.3, 1], true); return [bolt, mv(bolt, 0, 0, 0.18), A.b > 0.25 ? hot(sc(bolt, 1.15)) : []]; },
  umbrella: A => {
    const n = 8, rot = A.T * 0.7, canopy = [];
    for (let k = 0; k < n; k++) {
      const a0 = rot + (k / n) * TAU, a1 = rot + ((k + 1) / n) * TAU;
      canopy.push(line([0, 0.75, 0], [Math.cos(a0) * 0.35, 0.62, Math.sin(a0) * 0.35], [Math.cos(a0) * 0.95, 0.15, Math.sin(a0) * 0.95]));
      canopy.push(rep(7, j => { const a = a0 + ((a1 - a0) * j) / 6; const lift = Math.sin((j / 6) * Math.PI) * 0.12; return [Math.cos(a) * 0.95, 0.15 + lift, Math.sin(a) * 0.95]; }));
    }
    return [canopy, line([0, 0.75], [0, 0.95]), hot([line([0, 0.75], [0, -0.75]), arc(0.16, Math.PI, TAU, [-0.16, -0.75])])];
  },
  windchime: A => { const s = Math.sin(A.T * 3) * 0.35; return [line([0, 1], [0, 0.85]), arc(0.4, 0, Math.PI, [0, 0.4]), line([-0.4, 0.4], [0.4, 0.4]), arc(0.4, 0, Math.PI, [0, 0.4], 'x'), hot(rotZ([line([0, 0.6], [0, -0.3]), rect(0.25, 0.6, [0, -0.6])], s, [0, 0.6]))]; },
  kite: A => [pl([0, 1, 0.6, 0.15, 0, -0.7, -0.6, 0.15], true), line([0, 1], [0, -0.7]), line([-0.6, 0.15], [0.6, 0.15]), hot(rep(12, k => [Math.sin(A.T * 3 + k * 0.6) * 0.15 * (k / 12), -0.7 - k * 0.07, 0])), rep(3, k => rotZ(pl([-0.08, 0, 0.08, 0.06, 0.08, -0.06], true), A.T + k, [0, 0])).map((b, k) => mv(b, Math.sin(A.T * 3 + (k + 1) * 2.4) * 0.12, -0.9 - k * 0.22))],
  tornado: A => rep(9, k => { const y = 0.9 - k * 0.22, r = 0.85 - k * 0.09; return k % 3 === 0 ? hot(oval(r, r * 0.3, [Math.sin(A.T * 2 + k) * 0.08, y], 'y', 20)) : oval(r, r * 0.3, [Math.sin(A.T * 2 + k) * 0.08, y], 'y', 20); }).map(o => rotY(o, A.T * 2)),
  thermometer: A => [rrect(0.3, 1.6, 0.15, [0, 0.15]), circle(0.25, [0, -0.85]), rep(6, k => line([0.17, -0.4 + k * 0.22], [0.3, -0.4 + k * 0.22])), hot([line([0, -0.7], [0, -0.5 + 0.9 * (0.5 + 0.3 * A.i + 0.2 * A.b)]), circle(0.15, [0, -0.85])])],
  snowflake: A => rotZ([rep(6, k => { const a = (k / 6) * TAU; const arm = [line([0, 0], [0, 1]), line([0, 0.5], [0.22, 0.72]), line([0, 0.5], [-0.22, 0.72]), line([0, 0.78], [0.14, 0.92]), line([0, 0.78], [-0.14, 0.92])]; return rotZ(arm, a); }), hot(ngon(6, 0.25))], A.T * 0.4),
  raindrop: A => { const u = saw(A.T / 1.6); const drop = pl([0, 0.5, 0.25, 0.05, 0.2, -0.2, 0, -0.32, -0.2, -0.2, -0.25, 0.05], true); return [mv(drop, 0, 0.9 - u * 1.6), u > 0.85 ? hot(oval((u - 0.85) * 5, (u - 0.85) * 1.2, [0, -0.85], 'y', 20)) : [], oval(0.6, 0.15, [0, -0.85], 'y', 20)]; },
  puddle: A => [oval(1, 0.35, [0, 0], 'y'), rep(3, k => { const u = saw(A.T / 2 + k / 3); return k === 0 ? hot(oval(u * 0.8, u * 0.28, [0, 0.01], 'y', 24)) : oval(u * 0.8, u * 0.28, [0, 0.01], 'y', 24); })],
  weathervane: A => [line([0, -1], [0, 0.4]), cone(0.25, 0.25, [0, -1], 12, 3), rotY([line([-0.8, 0.4], [0.7, 0.4]), pl([0.55, 0.55, 0.85, 0.4, 0.55, 0.25], true), pl([-0.8, 0.4, -0.95, 0.6, -0.65, 0.4, -0.95, 0.2], true)], Math.sin(A.T * 0.8) * 1.4), hot(line([-0.4, 0, 0], [0.4, 0, 0])), line([0, 0, -0.4], [0, 0, 0.4])],
  comet: A => { const x = tri(A.T / 3) * 1.4 - 0.7; return [hot(circle(0.18, [x, 0.3])), rep(5, k => line([x - 0.15, 0.3 + (k - 2) * 0.06], [x - 0.9 + k * 0.08, 0.6 + (k - 2) * 0.12])), star(4, 0.1, 0.03, [0.7, -0.6]), star(4, 0.08, 0.025, [-0.6, -0.4])]; },
  planet: A => [ball(0.55, [0, 0, 0], 1).map(c => rotY(c, A.T * 0.4)), hot(rotX(oval(1, 1, [0, 0], 'y', 40), 0.45)), rotX(oval(0.85, 0.85, [0, 0], 'y', 40), 0.45), circle(0.07, [Math.cos(A.T) * 1.1, Math.sin(A.T) * 0.3])],
  earth: A => [circle(0.85), rotY([circle(0.85, [0, 0, 0], 'x'), rotY(circle(0.85, [0, 0, 0], 'x'), 1.05), rotY(circle(0.85, [0, 0, 0], 'x'), 2.1)], A.T * 0.5), oval(0.85, 0.85, [0, 0], 'y'), oval(0.74, 0.74, [0, 0.42], 'y'), oval(0.74, 0.74, [0, -0.42], 'y'), hot(rotY(pl([0.2, 0.3, 0.45, 0.2, 0.4, -0.1, 0.15, -0.2, 0.05, 0.1], true, 0.82), A.T * 0.5))],
  constellation: A => { const P = [[-0.8, 0.5], [-0.35, 0.7], [0.1, 0.4], [0.5, 0.6], [0.85, 0.2], [0.4, -0.2], [-0.1, -0.6]]; return [line(...P), rep(P.length, k => (Math.floor(A.T * 2 + k) % 3 === 0 ? hot(star(4, 0.12, 0.04, P[k])) : star(4, 0.08, 0.03, P[k])))]; },
  telescope: A => [rotZ([cyl(0.18, 1.5, [0, 0], 16, 4).map(c => rotZ(c, Math.PI / 2)), circle(0.24, [0.8, 0], 'x'), hot(circle(0.12, [-0.78, 0], 'x'))], 0.5 + Math.sin(A.T * 0.5) * 0.08), line([0, 0], [-0.5, -1]), line([0, 0], [0.5, -1]), line([0, 0], [0, -1, 0.5])],
  rocket: A => { const y = saw(A.T / 5) * 0.6 - 0.3; return mv([pl([0, 1, 0.25, 0.55, 0.25, -0.4, -0.25, -0.4, -0.25, 0.55], true), circle(0.12, [0, 0.35]), pl([0.25, -0.1, 0.5, -0.55, 0.25, -0.4]), pl([-0.25, -0.1, -0.5, -0.55, -0.25, -0.4]), pl([0, 1, 0, 0.55, 0, -0.4], false, 0.25), hot(zig(-0.18, 0.18, -0.6 - 0.15 * Math.abs(Math.sin(A.T * 20)), 0.12, 6))], 0, y); },
  ufo: A => [oval(1, 0.25, [0, 0], 'y', 40), oval(0.6, 0.15, [0, 0.12], 'y', 32), arc(0.42, 0, Math.PI, [0, 0.12]), arc(0.42, 0, Math.PI, [0, 0.12], 'x'), rep(6, k => circle(0.05, [Math.cos(A.T * 2 + k) * 0.8, -0.02, Math.sin(A.T * 2 + k) * 0.2])), hot([line([-0.2, -0.15], [-0.55 - 0.2 * A.b, -1]), line([0.2, -0.15], [0.55 + 0.2 * A.b, -1]), oval(0.55 + 0.2 * A.b, 0.12, [0, -1], 'y', 24)])],
  satellite: A => rotY([box(0.4, 0.4, 0.4), grid(0.8, 0.35, 4, 2, [-0.75, 0]), grid(0.8, 0.35, 4, 2, [0.75, 0]), line([-0.2, 0], [-0.35, 0]), line([0.2, 0], [0.35, 0]), hot([line([0, 0.2], [0, 0.55]), arc(0.2, Math.PI * 0.2, Math.PI * 0.8, [0, 0.45])])], A.T * 0.5),
  aurora: A => rep(4, k => { const pts = wave(-1, 1, 0.3 - k * 0.15, 0.15, 1.5, A.T * (0.6 + k * 0.2) + k, k * 0.2, 20); const cur = pts.map(p => line(p, [p[0], p[1] - 0.5, p[2]])); return k === 1 ? [hot(pts), cur.filter((_, j) => j % 3 === 0)] : [pts, cur.filter((_, j) => j % 4 === 0)]; }),
  sunrise: A => { const y = -0.4 + Math.min(1, A.t / 6) * 0.6; return [line([-1, -0.4], [1, -0.4]), hot(arc(0.5, 0, Math.PI, [0, y])), spokes(9, 0.65, 0.9, [0, y], 0).filter((_, k) => k < 5), rep(3, k => line([-0.7 + k * 0.1, -0.55 - k * 0.12], [0.7 - k * 0.1, -0.55 - k * 0.12]))]; },
  sunset: A => { const y = 0.1 - Math.min(1, A.t / 6) * 0.45; return [line([-1, -0.3], [1, -0.3]), hot(arc(0.5, 0, Math.PI, [0, Math.max(-0.3, y)])), rep(5, k => line([-0.5 + k * 0.08 + Math.sin(A.T + k) * 0.05, -0.4 - k * 0.1], [0.5 - k * 0.08, -0.4 - k * 0.1]))]; },
  galaxy: A => rotZ([hot(spiral(0.05, 1, 1.4, [0, 0])), rotZ(spiral(0.05, 1, 1.4, [0, 0]), Math.PI), oval(0.25, 0.15), rep(14, k => circle(0.02, [Math.cos(k * 2.4) * (0.3 + (k % 5) * 0.15), Math.sin(k * 2.4) * (0.3 + (k % 5) * 0.12)]))], A.T * 0.3),
  blackhole: A => [rep(5, k => { const u = saw(A.T / 2 - k / 5); return rotX(oval(1.1 - u * 0.9, 1.1 - u * 0.9, [0, 0], 'y', 36), 0.35); }), hot(circle(0.25)), circle(0.32)],
  meteor: A => { const u = saw(A.T / 1.8); const x = 0.9 - u * 1.8, y = 0.9 - u * 1.5; return [hot(ngon(7, 0.2, [x, y], A.T * 3)), rep(4, k => line([x + 0.12, y + 0.1 + (k - 1.5) * 0.05], [x + 0.6 + k * 0.1, y + 0.55 + k * 0.05])), oval(0.8, 0.12, [0, -0.85], 'y')]; },
  eclipse: A => [hot(circle(0.6)), circle(0.6, [0.7 - Math.min(1, A.t / 4) * 0.7, 0, -0.05]), spokes(24, 0.68, 0.8 + 0.1 * A.b, [0, 0], A.T * 0.1)],
  moonphase: A => [circle(0.7), hot(rep(25, k => { const a = -Math.PI / 2 + (k / 24) * Math.PI; const ph = Math.cos(A.T * 0.5); return [Math.cos(a) * 0.7 * ph, Math.sin(a) * 0.7, 0]; })), rep(3, k => star(4, 0.08, 0.025, [-0.9 + k * 0.9, 0.85 - (k % 2) * 0.3]))],
};
