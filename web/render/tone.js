// 地の色（tone）：黒地 ink・白地 paper・色地 color。部品はここから地の色・文字の色・明るい地かどうかを読む。
// color は曲の強調色（colors[0]）を地にする。文字の色は地の明るさで白か墨を選ぶ。

const PAPER_BG = '#EDEBE6';
const INK_BG = '#000000';
const LIGHT_FG = '#F4F4F4';
const DARK_FG = '#101010';

/** '#rgb' / '#rrggbb' の明るさ（0〜1）。読めなければ 0 */
export function luminance(hex) {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(hex ?? '').trim());
  if (!m) return 0;
  const s = m[1].length === 3 ? m[1].split('').map(c => c + c).join('') : m[1];
  const [r, g, b] = [0, 2, 4].map(i => parseInt(s.slice(i, i + 2), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * @param {string} tone 'ink' | 'paper' | 'color'（ほかは ink として扱う）
 * @param {string[]} colors 曲の色 [強調, 明るい, 暗い]
 * @returns {{bg:string, fg:string, light:boolean}} light は「明るい地」（飾りは墨で、足し合わせない）
 */
export function toneStyle(tone, colors) {
  if (tone === 'paper') return { bg: PAPER_BG, fg: DARK_FG, light: true };
  if (tone === 'color') {
    const bg = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(String(colors?.[0] ?? '')) ? colors[0] : '#5B3BFF';
    const light = luminance(bg) > 0.55;
    return { bg, fg: light ? DARK_FG : LIGHT_FG, light };
  }
  return { bg: INK_BG, fg: LIGHT_FG, light: false };
}

const HEX6 = /^#[0-9a-f]{6}$/i;
/**
 * 世界のある場面の配色（台本の scene.ink。director/worlds.js の palette）。無い・壊れていれば null（今までどおり地の色で描く）
 * @returns {{bg:string, fg:string, line:string, accent:string, light:boolean}|null}
 */
export function worldInk(scene) {
  const k = scene?.ink;
  if (!k || typeof k !== 'object' || typeof k.light !== 'boolean') return null;
  return ['bg', 'fg', 'line', 'accent'].every(n => HEX6.test(String(k[n] ?? ''))) ? k : null;
}

/** 場面の時刻 t の地の色。scene.tones = [{t, tone}]（時刻順）があれば、t 以前の最後のもの。無ければ scene.tone */
export function toneAt(scene, t) {
  let tone = scene?.tone ?? 'dark'; // 無いときは今までどおり 'dark'（ink と同じ扱い）
  const list = Array.isArray(scene?.tones) ? scene.tones : [];
  for (const x of list) { if (Number.isFinite(x?.t) && x.t <= t) tone = x.tone; else break; }
  return tone;
}
