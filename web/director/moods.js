// 雰囲気ごとの、使ってよい部品の候補。部品の中身は render/parts/ にある
// （名前が食い違わないことは tests/render-registry.test.mjs で確かめる）。
export const MOODS = {
  // B：文字が跳ねる（元気）
  B: {
    bg: ['bg.gradient', 'bg.pulse'],
    text: ['text.bounce', 'text.pop', 'text.slide'],
    fx: ['fx.ring', 'fx.dots', 'fx.wave'],
  },
  // S：空間に散らした文字（立体の空間に固定した向きを持つ文字。カメラが寄る・引く・回り込む・勢いよく寄る）
  S: {
    bg: ['bg.vignette'],
    text: ['text.motion'],
    fx: ['fx.flash', 'fx.streak', 'fx.rays', 'fx.tunnel', 'fx.dust', 'fx.motif', 'fx.deco'],
  },
  // D：重ねる文字（文字を大きく重ね、カメラが行から行へ飛ぶ。強い場面は白地、弱い場面は黒地）
  D: {
    bg: ['bg.vignette'],
    text: ['text.motion'],
    fx: ['fx.flash', 'fx.streak', 'fx.rays', 'fx.bokeh'],
  },
};
