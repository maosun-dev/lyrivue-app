// AAC の音のかたまりを mp4 に詰める前の手当て。
// iPhone の Safari の AudioEncoder は、音の札（AudioSpecificConfig＝何ヘルツ・何チャンネルかを書いた 2 バイト）を渡してこないことがある。
// 札なしで詰めると、入れ物はあっても再生する側が音として読めない（2026-10-20 持ち主の iPhone 12 mini、知らせは「音あり」なのに無音）。
// 札が無ければここで作る。かたまりに ADTS の頭（FFF…）が付いていれば外して、頭に書かれた値で札を作る。

const RATES = [96000, 88200, 64000, 48000, 44100, 32000, 24000, 22050, 16000, 12000, 11025, 8000, 7350];

/** AAC-LC の札（AudioSpecificConfig、2 バイト） */
export function aacConfig(sampleRate, channels) {
  const i = RATES.indexOf(sampleRate);
  const freq = i >= 0 ? i : 3; // 知らない細かさは 48kHz として書く
  const v = (2 << 11) | (freq << 7) | ((channels & 15) << 3);
  return new Uint8Array([v >> 8, v & 0xFF]);
}

/**
 * 音のかたまりから、mp4 に詰める中身と札を取り出す
 * @param {Uint8Array} bytes エンコーダーが出したかたまり
 * @param {number} sampleRate 詰めるときの細かさ（ADTS の頭が無いとき使う）
 * @param {number} channels チャンネル数（同上）
 * @returns {{data:Uint8Array, config:Uint8Array}}
 */
export function unwrapAac(bytes, sampleRate, channels) {
  if (bytes.length >= 7 && bytes[0] === 0xFF && (bytes[1] & 0xF0) === 0xF0) {
    const head = (bytes[1] & 1) ? 7 : 9; // CRC なし 7 バイト／あり 9 バイト
    const freq = (bytes[2] >> 2) & 15;
    const ch = ((bytes[2] & 1) << 2) | (bytes[3] >> 6);
    return { data: bytes.subarray(head), config: aacConfig(RATES[freq] ?? sampleRate, ch || channels) };
  }
  return { data: bytes, config: aacConfig(sampleRate, channels) };
}
