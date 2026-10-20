// 文字の大きさを決まった段に丸めて描く包み。
// iPhone の描く係（WebKit）は、使った文字の大きさごとに文字の形を覚えておく。毎コマ違う細かい大きさ（123.4567px など）で描くと、
// 覚える量が際限なく増えて、アプリの描く係が強制終了された（2026-10-20 持ち主の iPhone 12 mini、タップで合わせる途中で紫の画面→再起動。
// WebKit で測ると「強調語が奥から迫る」（flood の warp）が出ている間に記憶が 180MB 跳ね上がった）。
// 大きさは 100px を基準に 2 の 1/4 乗（約 19%）刻みの段に丸め、足りない分は拡大・縮小で補う（見た目は変わらない）。

const STEPS_PER_OCTAVE = 4;

/** 頼まれた大きさに近い段の大きさ（100px はそのまま） */
export function fontStep(px) {
  if (!(px > 0) || !Number.isFinite(px)) return px;
  const q = 100 * 2 ** (Math.round(Math.log2(px / 100) * STEPS_PER_OCTAVE) / STEPS_PER_OCTAVE);
  return Math.round(q * 1000) / 1000;
}

const WRAPPED = Symbol('steppedFonts');
const PX = /^(.*?)(\d+(?:\.\d+)?)px(.*)$/;

/**
 * 描く面を包む。font に入れた大きさを段に丸め、fillText・strokeText・measureText は頼まれた大きさとして振る舞う
 * @template {CanvasRenderingContext2D} T
 * @param {T} ctx
 * @returns {T}
 */
export function steppedFonts(ctx) {
  if (!ctx || ctx[WRAPPED]) return ctx;
  let k = 1;           // 頼まれた大きさ ÷ 段の大きさ
  let asked = null;    // 頼まれたままの font の文字（読み返されたとき用）
  const bound = new Map();
  const stack = []; // save・restore で、文字の大きさと一緒に倍率も戻す
  const text = name => (s, x, y, maxWidth) => {
    if (k === 1) return maxWidth === undefined ? ctx[name](s, x, y) : ctx[name](s, x, y, maxWidth);
    const lw = ctx.lineWidth;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(k, k);
    if (Number.isFinite(lw)) ctx.lineWidth = lw / k;
    if (maxWidth === undefined) ctx[name](s, 0, 0); else ctx[name](s, 0, 0, maxWidth / k);
    ctx.restore();
    if (Number.isFinite(lw)) ctx.lineWidth = lw;
  };
  const own = {
    save() { stack.push([k, asked]); ctx.save(); },
    restore() { const top = stack.pop(); if (top) [k, asked] = top; ctx.restore(); },
    fillText: text('fillText'),
    strokeText: text('strokeText'),
    measureText(s) {
      const m = ctx.measureText(s);
      if (k === 1) return m;
      const out = {};
      for (const key in m) if (typeof m[key] === 'number') out[key] = m[key] * k;
      out.width = m.width * k;
      return out;
    },
  };
  return new Proxy(ctx, {
    get(t, key) {
      if (key === WRAPPED) return true;
      if (key === 'font') return asked ?? t.font;
      if (key in own) return own[key];
      const v = t[key];
      if (typeof v !== 'function') return v;
      if (!bound.has(key)) bound.set(key, v.bind(t));
      return bound.get(key);
    },
    set(t, key, value) {
      if (key === 'font') {
        const m = PX.exec(String(value));
        if (m) {
          const px = Number(m[2]), q = fontStep(px);
          t.font = `${m[1]}${q}px${m[3]}`;
          k = q > 0 ? px / q : 1;
          asked = String(value);
          return true;
        }
        k = 1; asked = null;
      }
      t[key] = value;
      return true;
    },
  });
}
