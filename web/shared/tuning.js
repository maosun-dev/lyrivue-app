// 調整値：見た目の細かい値を1か所に集める。台本係と描く係の両方が読む（どちらも相手の中身は import しない）。
// 確認ページの調整パネルで動かせる。決めた値は、ここの DEFAULT_TUNING に書き戻して初期値にする。
// 今の初期値は 2026-10-18 に持ち主が空間（S）を見ながら決めた値。
export const DEFAULT_TUNING = Object.freeze({
  // 台本係が使う値
  spin: 2.6,        // 行に着くとき、カメラが余分に回っているラジアン（向きは行ごとに交互）
  settle: 0.84,     // 着いてから、余分な回転が元に戻るまでの秒数
  travel: 1.43,      // カメラが次の行へ動く秒数（行の始まりに着くように、その手前から動く）
  lag: 0.65,        // 空間（S）：次の行への到着を、歌い出しのこれだけ秒あとにする（動き出しも同じだけ遅れる。2026-10-18 持ち主が見比べて「着くのを遅らせる」0.65 に決めた。前は 0）
  drift: 0.3,       // 行を見ているあいだに、ゆっくり寄る距離（2026-10-19 0.54→0.3：寄りきった瞬間に収める分だけ、着いた直後の字が小さかった）
  snap: 4.3,          // 空間（S）：動きの鋭さ（0 でなめらか。大きいほど勢いよく出てぴたっと止まる。強い場面ほど鋭い）
  zStep: 1.25,       // 行ごとに奥へずらす距離（小さいほど、前の行が塊になって見える）
  keepLines: 7,     // 行は、この行数あとの行が始まるまで奥に残す
  lookAhead: 3,     // 空間（S）：歌う前の行を、この行数ぶん先から薄く浮かべる
  tilt: 1,          // 空間（S）：文字の板の向きのばらつき（0 で全部正面）
  spread: 0.95,        // 行の置き場所の広がり（1 で、左右 ±0.5・上下 ±0.3）
  // 描く係が使う値（台本の tuning に入れて渡す）
  punch: 0,         // 拍の頭で拡大がこの割合まで跳ね上がる（強さ 1 のとき）。毎拍は効かないので初期値は 0（2026-10-20。前は 0.15）
  textBase: 0.12,   // 倍率 1 の文字の大きさ（画面の短辺に対する割合）
  emphScale: 2.7,   // 強調する語の大きさの倍率
  blurRange: 4.5,     // 手前から何 dz 奥でぼけが最大になるか（大きいほど、ぼけ方がゆるやか）
  // 空間（S）：歌い終えた行の薄れ方（2026-10-19 持ち主「歌い終えた直後に薄くなるのが早い」。前は 0・1・0.55）
  pastHold: 1.2,    // 歌い終えてから薄くなり始めるまでの秒数
  pastFade: 2,      // 薄くなるのにかける秒数
  pastLevel: 0.65,  // 薄くなったあとの濃さ（1 で薄くならない）
  // 空間（S）：奥へ進む動き（2026-10-18）
  cruise: 1,        // 前進の速さ（行ごとに奥へ進む距離の倍率。0 で前進しない）
  dive: 1,          // 行をくぐり抜ける動きの出やすさ（0 で出ない）
});

// 動かせる範囲 [最小, 最大]。範囲の外の値は、ここに収める
export const TUNING_RANGES = Object.freeze({
  spin: [0, 3], settle: [0.02, 1], travel: [0.1, 1.5], lag: [0, 1], drift: [0, 0.6], snap: [0, 6], zStep: [0.2, 2], keepLines: [0, 10], spread: [0, 2], lookAhead: [0, 8], tilt: [0, 2],
  punch: [0, 0.6], textBase: [0.05, 0.4], emphScale: [1, 5], blurRange: [0.5, 6], pastHold: [0, 5], pastFade: [0.1, 6], pastLevel: [0.1, 1], cruise: [0, 3], dive: [0, 3],
});

/** 渡された値を、初期値とマージして返す。数でない値は初期値、範囲の外は範囲に収める。知らない名前は無視する */
export function resolveTuning(input) {
  const out = { ...DEFAULT_TUNING };
  if (input && typeof input === 'object') {
    for (const key of Object.keys(DEFAULT_TUNING)) {
      if (!(key in input)) continue;
      const raw = input[key];
      // 数、または数字の文字列だけを受け入れる（null・空・真偽・配列などは初期値のまま）
      const v = typeof raw === 'number' ? raw : (typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : NaN);
      if (!Number.isFinite(v)) continue;
      const [lo, hi] = TUNING_RANGES[key];
      out[key] = Math.min(hi, Math.max(lo, v));
    }
    out.keepLines = Math.round(out.keepLines);
    out.lookAhead = Math.round(out.lookAhead);
  }
  return out;
}

/** 強い場面（サビ）の小節の頭で、カメラがぐっと寄る割合（強さ 1 のとき）。毎拍の寄り punch とは別（render/index.js） */
export const BAR_PUNCH = 0.06;
