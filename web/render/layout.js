// 文字の折り返し（日本語向けに、1文字ずつ足して幅を超えたら改行する）。

/** ctx.font を設定ずみで呼ぶ。空文字は []。maxWidth が 0 以下でも 1文字ずつ返して終わる */
export function wrapText(ctx, text, maxWidth) {
  if (!text) return [];
  const out = [];
  let cur = '';
  // 英単語はひとかたまり（単語の途中で改行しない）、それ以外は 1 文字ずつ
  for (const unit of String(text).match(/[A-Za-z0-9'’]+|[\s\S]/gu) ?? []) {
    if (cur && ctx.measureText(cur + unit).width > maxWidth) {
      out.push(cur.trimEnd());
      cur = unit.trimStart();
      // 1 語が幅より長いときは、その語を 1 文字ずつ折り返す
      while (cur.length > 1 && ctx.measureText(cur).width > maxWidth) {
        const chars = Array.from(cur);
        let k = 1;
        while (k < chars.length && ctx.measureText(chars.slice(0, k + 1).join('')).width <= maxWidth) k++;
        out.push(chars.slice(0, k).join(''));
        cur = chars.slice(k).join('');
      }
    } else cur += unit;
  }
  if (cur.trim()) out.push(cur.trimEnd());
  return out;
}
