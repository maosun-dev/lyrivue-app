// 動画の書き出し（3段階目）の決めごと。ブラウザの機能を使わない部分だけをここに置く（試験できるように）。

const FPS = 30;
const SIZES = {
  portrait: { 1080: [1080, 1920], 720: [720, 1280] },
  landscape: { 1080: [1920, 1080], 720: [1280, 720] },
};
const BITRATE = { 1080: 8_000_000, 720: 5_000_000 }; // 映像の細かさ（1秒あたりの量）。文字の線がつぶれない程度
const KEY_EVERY = 2; // この秒数ごとに、途中から見られる区切りのコマを入れる

/**
 * @param {{aspect?:'portrait'|'landscape', quality?:1080|720, duration?:number}} [opts]
 * @returns {{aspect:'portrait'|'landscape', quality:1080|720, width:number, height:number, fps:number, frames:number, bitrate:number, keyEvery:number}}
 */
export function exportPlan(opts) {
  const aspect = opts?.aspect === 'landscape' ? 'landscape' : 'portrait';
  const quality = opts?.quality === 720 ? 720 : 1080;
  const [width, height] = SIZES[aspect][quality];
  const d = Number.isFinite(opts?.duration) && opts.duration > 0 ? opts.duration : 0;
  return { aspect, quality, width, height, fps: FPS, frames: Math.max(0, Math.ceil(d * FPS - 1e-9)), bitrate: BITRATE[quality], keyEvery: KEY_EVERY * FPS };
}

/** i コマ目の時刻（秒） */
export const frameTime = (i, fps = FPS) => i / fps;

/** 音を chunk 個ずつ区切った範囲 [始め, 終わり) の並び */
export function audioRanges(total, chunk) {
  if (!(total > 0) || !(chunk > 0)) return [];
  const out = [];
  for (let a = 0; a < total; a += chunk) out.push([a, Math.min(total, a + chunk)]);
  return out;
}

/** 保存するファイル名。曲のファイル名（拡張子は除く）から、ファイル名に使えない文字を除く */
export function exportFileName(songName, aspect, ext = 'mp4') {
  const base = String(songName ?? '').replace(/\.[^.]+$/, '').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '').trim().slice(0, 60) || 'mv';
  return `lyrivue-${base}-${aspect === 'landscape' ? '横' : '縦'}.${ext}`;
}

/** H.264 の候補（よい順）。High → Main → Baseline。どれも 1080p まで（level 4.0） */
export const videoCodecs = () => ['avc1.640028', 'avc1.4d0028', 'avc1.420028'];

/**
 * 動画の作り方を選ぶ。'encode'＝1 コマずつ描いて詰める（速い・コマ落ちなし）／'record'＝再生しながら録画（曲と同じ時間）／null＝作れない。
 * 曲があるのに音を詰められない端末（iPhone の Safari など、AudioEncoder が無い）では、音を入れるために録画を選ぶ。
 * @param {{encode:boolean, audioEncode:boolean, record:boolean, hasSound:boolean}} can
 */
export function exportMode({ encode, audioEncode, record, hasSound }) {
  if (encode && (audioEncode || !hasSound || !record)) return 'encode';
  return record ? 'record' : null;
}
