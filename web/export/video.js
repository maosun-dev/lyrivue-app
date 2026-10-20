// 動画の書き出し（ブラウザ）。描く関数を1コマずつ呼んで、曲の音と一緒に動画ファイルにする。
// ・WebCodecs（VideoEncoder/AudioEncoder）が使えるとき：コマを順に描いて mp4 にまとめる（コマ落ちなし）
// ・使えないとき：再生しながら録画する（MediaRecorder。曲と同じ時間かかる）
import { Muxer, ArrayBufferTarget } from 'mp4-muxer'; // 置き場所はページの読み込みの決まり（import map）
import { frameTime, audioRanges, videoCodecs } from './plan.js';

const AUDIO_RATE = 48000;   // 音はこの細かさにそろえて詰める（Opus はこれでないと詰められない）
const AUDIO_CHUNK = 4800;   // 一度に渡す音の長さ（0.1 秒）
const QUEUE_MAX = 6;        // 詰め待ちのコマがこれを超えたら、描くのを待つ（使う量を増やしすぎない）

const abortError = () => new DOMException('書き出しをやめました', 'AbortError');

/** コマを順に描いて詰められるか（WebCodecs と mp4 の H.264 が使えるか） */
export async function canEncode(plan) {
  if (typeof VideoEncoder !== 'function' || typeof VideoFrame !== 'function') return false;
  return !!(await pickVideoConfig(plan));
}

/** 曲の音を詰められるか（AudioEncoder で AAC か Opus。iPhone の Safari などには無いことがある） */
export async function canEncodeAudio(audio) {
  const channels = audio ? Math.min(2, audio.numberOfChannels) : 0;
  return channels > 0 && !!(await pickAudioConfig(channels));
}

/** 再生しながら録画できるか */
export const canRecord = () => typeof MediaRecorder === 'function' && typeof HTMLCanvasElement.prototype.captureStream === 'function';

async function pickVideoConfig(plan) {
  for (const codec of videoCodecs()) {
    const config = { codec, width: plan.width, height: plan.height, bitrate: plan.bitrate, framerate: plan.fps, avc: { format: 'avc' } };
    try { if ((await VideoEncoder.isConfigSupported(config)).supported) return config; } catch { /* 次の候補へ */ }
  }
  return null;
}

async function pickAudioConfig(channels) {
  if (typeof AudioEncoder !== 'function' || typeof AudioData !== 'function') return null;
  for (const [codec, muxCodec] of [['mp4a.40.2', 'aac'], ['opus', 'opus']]) {
    const config = { codec, sampleRate: AUDIO_RATE, numberOfChannels: channels, bitrate: 192_000 };
    try { if ((await AudioEncoder.isConfigSupported(config)).supported) return { config, muxCodec }; } catch { /* 次の候補へ */ }
  }
  return null;
}

/**
 * 曲のファイルを、書き出し用の細かさ（48kHz）の音にする。読めなければ null（無音で書き出す）
 * @param {Blob|null} file
 * @returns {Promise<AudioBuffer|null>}
 */
export async function decodeForExport(file) {
  if (!file) return null;
  const AC = window.AudioContext || window.webkitAudioContext;
  let ac;
  try {
    ac = new AC({ sampleRate: AUDIO_RATE });
    const buf = await file.arrayBuffer();
    return await new Promise((resolve, reject) => {
      const p = ac.decodeAudioData(buf, resolve, reject);
      if (p && typeof p.then === 'function') p.then(resolve, reject);
    });
  } catch { return null; } finally { ac?.close?.(); }
}

/** 少し待って、画面を描き直す機会を作る */
const breathe = () => new Promise(r => setTimeout(r, 0));

/**
 * コマを順に描いて mp4 にする。
 * @param {{plan:ReturnType<import('./plan.js').exportPlan>, draw:(ctx:CanvasRenderingContext2D, t:number, size:{width:number,height:number})=>void,
 *   audio?:AudioBuffer|null, onProgress?:(done:number, total:number)=>void, signal?:AbortSignal}} opts
 * @returns {Promise<{blob:Blob, ext:'mp4', audio:boolean}>}
 */
export async function encodeVideo({ plan, draw, audio, onProgress, signal }) {
  const vconf = await pickVideoConfig(plan);
  if (!vconf) throw new Error('このブラウザでは mp4 の映像を作れません');
  const channels = audio ? Math.min(2, audio.numberOfChannels) : 0;
  const aconf = audio && channels > 0 ? await pickAudioConfig(channels) : null;

  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: { codec: 'avc', width: plan.width, height: plan.height, frameRate: plan.fps },
    ...(aconf ? { audio: { codec: aconf.muxCodec, numberOfChannels: channels, sampleRate: AUDIO_RATE } } : {}),
    fastStart: 'in-memory',
    firstTimestampBehavior: 'offset',
  });

  let failed = null;
  const fail = e => { failed ??= e; };

  // 音（先に全部詰める。速い）
  if (aconf) {
    const enc = new AudioEncoder({ output: (chunk, meta) => muxer.addAudioChunk(chunk, meta), error: fail });
    enc.configure(aconf.config);
    const planes = Array.from({ length: channels }, (_, c) => audio.getChannelData(c));
    for (const [a, b] of audioRanges(audio.length, AUDIO_CHUNK)) {
      if (signal?.aborted) { enc.close(); throw abortError(); }
      const n = b - a;
      const data = new Float32Array(n * channels);
      planes.forEach((p, c) => data.set(p.subarray(a, b), c * n));
      const ad = new AudioData({ format: 'f32-planar', sampleRate: AUDIO_RATE, numberOfFrames: n, numberOfChannels: channels, timestamp: Math.round(a / AUDIO_RATE * 1e6), data });
      enc.encode(ad);
      ad.close();
      if (enc.encodeQueueSize > 64) await breathe();
    }
    await enc.flush();
    enc.close();
    if (failed) throw failed;
  }

  // 映像
  const canvas = document.createElement('canvas');
  canvas.width = plan.width; canvas.height = plan.height;
  const ctx = canvas.getContext('2d');
  const size = { width: plan.width, height: plan.height };
  const enc = new VideoEncoder({ output: (chunk, meta) => muxer.addVideoChunk(chunk, meta), error: fail });
  enc.configure(vconf);
  const step = 1e6 / plan.fps;
  try {
    for (let i = 0; i < plan.frames; i++) {
      if (signal?.aborted) throw abortError();
      if (failed) throw failed;
      draw(ctx, frameTime(i, plan.fps), size);
      const frame = new VideoFrame(canvas, { timestamp: Math.round(i * step), duration: Math.round(step) });
      enc.encode(frame, { keyFrame: i % plan.keyEvery === 0 });
      frame.close();
      while (enc.encodeQueueSize > QUEUE_MAX) await new Promise(r => setTimeout(r, 2));
      if (i % 4 === 3) { onProgress?.(i + 1, plan.frames); await breathe(); }
    }
    await enc.flush();
    if (failed) throw failed;
  } finally {
    if (enc.state !== 'closed') enc.close();
  }
  onProgress?.(plan.frames, plan.frames);
  muxer.finalize();
  return { blob: new Blob([muxer.target.buffer], { type: 'video/mp4' }), ext: 'mp4', audio: !!aconf };
}

/** 録画で使えるファイルの形（mp4 を先に） */
function recordMime() {
  for (const m of ['video/mp4;codecs=avc1.640028,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']) {
    if (MediaRecorder.isTypeSupported?.(m)) return m;
  }
  return '';
}

/**
 * 再生しながら録画する（WebCodecs が無いとき）。曲と同じ時間かかる。
 * @param {Parameters<typeof encodeVideo>[0]} opts
 * @returns {Promise<{blob:Blob, ext:'mp4'|'webm', audio:boolean}>}
 */
export async function recordVideo({ plan, draw, audio, onProgress, signal, ac: given }) {
  const canvas = document.createElement('canvas');
  canvas.width = plan.width; canvas.height = plan.height;
  const ctx = canvas.getContext('2d');
  const size = { width: plan.width, height: plan.height };
  const total = plan.frames / plan.fps;
  draw(ctx, 0, size);
  const stream = canvas.captureStream(plan.fps);
  let ac = null, src = null;
  if (audio) {
    // iPhone の Safari は、ボタンを押した瞬間に作った音の仕組みでないと鳴らない（止まったまま時計が進まない）。
    // そのため押したときに作ったもの（given）を使い、念のため動かし直す
    const AC = window.AudioContext || window.webkitAudioContext;
    ac = given ?? new AC({ sampleRate: audio.sampleRate });
    if (ac.state !== 'running') await ac.resume().catch(() => {});
    const dest = ac.createMediaStreamDestination();
    src = ac.createBufferSource();
    src.buffer = audio;
    src.connect(dest);
    dest.stream.getAudioTracks().forEach(t => stream.addTrack(t));
  }
  const mime = recordMime();
  const rec = new MediaRecorder(stream, { ...(mime ? { mimeType: mime } : {}), videoBitsPerSecond: plan.bitrate });
  const parts = [];
  rec.ondataavailable = e => { if (e.data?.size) parts.push(e.data); };
  const stopped = new Promise(r => { rec.onstop = r; });
  rec.start(1000);
  // 音の仕組みが動いていなければ（鳴らせない端末）、音なしでも最後まで録れるよう、ふつうの時計で進める
  const live = ac && ac.state === 'running';
  const t0 = live ? (src.start(), ac.currentTime) : performance.now() / 1000;
  const clock = () => (live ? ac.currentTime : performance.now() / 1000) - t0;
  let aborted = false;
  await new Promise(resolve => {
    const loop = () => {
      if (signal?.aborted) { aborted = true; resolve(); return; }
      const t = clock();
      if (t >= total) { resolve(); return; }
      draw(ctx, t, size);
      onProgress?.(Math.min(plan.frames, Math.round(t * plan.fps)), plan.frames);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  });
  rec.stop();
  await stopped;
  try { src?.stop(); } catch { /* 止まっていてもよい */ }
  ac?.close?.();
  stream.getTracks().forEach(t => t.stop());
  if (aborted) throw abortError();
  onProgress?.(plan.frames, plan.frames);
  const type = rec.mimeType || mime || 'video/webm';
  return { blob: new Blob(parts, { type }), ext: type.includes('mp4') ? 'mp4' : 'webm', audio: !!live };
}

/**
 * できた動画（や解析結果）を保存する。claude.ai の公開ページでは downloads の仕組み（保存の前に確認が出る）、
 * それ以外はふつうのダウンロード。
 * @returns {Promise<'saved'|'declined'>}
 */
export async function saveBlob(blob, filename) {
  const use = globalThis.claude?.use;
  if (typeof use === 'function') {
    let dl = null;
    try { dl = await use('downloads'); } catch { dl = null; }
    if (dl) {
      try { await dl.save({ filename, data: blob }); return 'saved'; } catch (e) {
        if (e?.code === 'declined') return 'declined';
        if (!['unavailable', 'not_granted', 'capability_disabled', 'capability_removed'].includes(e?.code)) throw new Error(e?.message || String(e?.code));
      }
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return 'saved';
}
