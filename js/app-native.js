/* ---------- 保存の差し替え（iPhone アプリだけ。ウェブ版では読み込まれない） ----------
 * 画面は保存のときに window.claude.use('downloads') を探し、あればそれで保存する（無ければブラウザのダウンロード。export/video.js の saveBlob）。
 * アプリの中ではブラウザのダウンロードが使えないので、同じ形のものを作って渡す。
 * ・動画をアプリの一時ファイルに書いて、iPhone の「共有」の画面を出す（「ビデオを保存」で写真に入る）
 * ・大きな動画でも固まらないよう、3MB ずつ書く
 */
(() => {
'use strict';
const cap = window.Capacitor;
if (!cap || !cap.isNativePlatform || !cap.isNativePlatform()) return;
const FS = window.capacitorFilesystemPluginCapacitor;
const Filesystem = FS && FS.Filesystem;
const Share = window.capacitorShare && window.capacitorShare.Share;

const CHUNK = 3 * 1024 * 1024;   // 3 の倍数にしておくと、区切った base64 をそのまま追記できる
const fail = code => Object.assign(new Error(code), { code });

async function toBytes(data) {
  if (typeof data === 'string') return new TextEncoder().encode(data);
  if (data instanceof Uint8Array) return data;
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  if (data && typeof data.arrayBuffer === 'function') return new Uint8Array(await data.arrayBuffer());   // Blob
  throw new Error('保存できない形のデータです');
}
function base64(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

const downloads = {
  async save({ filename, data }) {
    const bytes = await toBytes(data);
    const dir = FS.Directory.Cache;
    let uri = null;
    for (let i = 0; i === 0 || i < bytes.length; i += CHUNK) {
      const part = base64(bytes.subarray(i, i + CHUNK));
      if (i === 0) uri = (await Filesystem.writeFile({ path: filename, directory: dir, data: part })).uri;
      else await Filesystem.appendFile({ path: filename, directory: dir, data: part });
    }
    try { await Share.share({ title: filename, files: [uri] }); }
    catch (e) { throw /cancel/i.test((e && e.message) || '') ? fail('declined') : e; }
  },
};

window.claude = {
  async use(name) {
    if (name === 'downloads') return Filesystem && Share ? downloads : null;
    return null;
  },
};
/* ---------- AI の聞き取りを iPhone 本体の whisper.cpp で（自作プラグイン LyrivueWhisper、plugins/whisper/） ----------
 * ウェブの AI は iPhone 12 mini では記憶が足りず、歌を聞いて 20 秒ほどで落ちた（2026-10-21）。
 * 画面（Lyrivue の app/make-song.js）は window.lyrivueWhisper があればそれで聞く。曲は画面の側で 15 秒ずつに切って 1 切れずつ渡す
 */
if (cap.isPluginAvailable && cap.isPluginAvailable('LyrivueWhisper')) {
  const Whisper = cap.registerPlugin('LyrivueWhisper');
  window.lyrivueWhisper = {
    // AI のデータ（57MB）が無ければ読み込んでから、AI を読む。onRatio(割合, 全体のバイト数)
    async prepare(onRatio) {
      const listener = await Whisper.addListener('progress', p => { if (p && p.total) onRatio && onRatio(p.loaded / p.total, p.total); });
      try { await Whisper.prepare(); } finally { await listener.remove(); }
    },
    // 16kHz・1ch の音（Float32Array）→ 言葉ごとの時刻 [{text, start, end}]（秒・切れの頭から）
    async transcribeChunk(mono, language) {
      const bytes = new Uint8Array(mono.buffer, mono.byteOffset, mono.byteLength);
      const { tokens } = await Whisper.transcribe({ audio: base64(bytes), language: language === 'english' ? 'en' : 'ja' });
      return tokens || [];
    },
    // AI を手放す（データはアプリの中に残る）
    release() { return Whisper.release(); },
  };
}
})();
