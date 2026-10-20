// 曲を通して使う色の組み合わせと書体を決める。
import { pick } from './rng.js';

const DARK = '#0B1020';
// [強調色, 明るい色, 暗い色]
const NIGHT = ['#5B8CFF', '#F6E7C1', '#0B1020'];
const SUMMER = ['#FF8A3D', '#FFF3D6', '#10324A'];
const RAIN = ['#6FD3D8', '#E8F4F5', '#0F1F2B'];
const LOVE = ['#FF5C8A', '#FFE8EF', '#2A1030'];
const POP = ['#FFDF3D', '#FFFFFF', '#241A36'];
const BY_MOOD = { night: NIGHT, lonely: NIGHT, summer: SUMMER, rain: RAIN, love: LOVE };
const DEFAULTS = [NIGHT, SUMMER, RAIN, LOVE, POP];
const FONTS = ['Dela Gothic One', 'Zen Kaku Gothic New'];
const MOOD_MIN = 0.3; // 雰囲気の強さがこれ未満なら、雰囲気では決めない

/**
 * @param {import('../analyze/types.js').AnalysisResult} analysis
 * @param {() => number} rng
 * @returns {import('./types.js').Style}
 */
export function chooseStyle(analysis, rng) {
  const palette = Array.isArray(analysis?.palette) ? analysis.palette : [];
  const mood = analysis?.mood ?? {};
  // 乱数は「色の既定の選び → 書体」の順に使う（順番を変えると同じ種でも結果が変わる）
  const fallback = pick(rng, DEFAULTS);
  const font = pick(rng, FONTS);

  if (palette.length >= 2) return { colors: [palette[0], palette[1], DARK], font };

  let best = null;
  for (const [k, v] of Object.entries(mood)) {
    if (BY_MOOD[k] && v >= MOOD_MIN && (best === null || v > mood[best])) best = k;
  }
  return { colors: [...(best ? BY_MOOD[best] : fallback)], font };
}
