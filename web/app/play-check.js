// 再生の確認ページ：解析結果から台本を作り、曲の再生位置に合わせて1コマずつ描く。
import { buildScript } from '../director/index.js';
import { renderFrameMotion } from '../render/motion.js';
import { makeDemoAnalysis } from './demo-analysis.js';
import { SONG_SET, songSetUrls } from './song-set.js';
import { floodMoments, jumpTarget, momentIndex } from './flood-jump.js';
import { saveFile, loadFile, forgetAll } from './store.js';
import { TUNING_RANGES, resolveTuning } from '../shared/tuning.js';
import { effectsAt, applyRemovals, normalizeRemoved } from '../director/removals.js';
import { TYPEFACES, DRAWN_BOX } from '../render/parts/text-motion.js';
import { WORLDS, sectionKind } from '../director/worlds.js';
import { THEMES, themeWorlds, themeOf } from './themes.js';
import { CAMS, TILTS, SIZES, normalizeEdits, describeEdit, PLACE_NAMES } from '../director/edits.js';
import { cameraAt, project, projectPlane } from '../render/camera.js';
import { CAM_ICONS, TILT_ICONS, NUDGE_ICONS, ARROW_ICONS, PLACE_ICONS } from './edit-icons.js';
import { makeSong, MAKE_STEPS, aiOnByDefault } from './make-song.js';
import { retimeLines, tapMoment } from '../analyze/retime.js';
import { exportPlan, exportFileName, exportMode } from '../export/plan.js';
import { canEncode, canEncodeAudio, canRecord, encodeVideo, recordVideo, decodeForExport, saveBlob } from '../export/video.js';

const $ = id => document.getElementById(id);
const cv = $('cv');
const ctx = cv.getContext('2d');
const audio = new Audio();
audio.preload = 'auto';

// 調整値はこのブラウザに覚える（使えない環境では覚えない）
function loadTuning() {
  try {
    const saved = JSON.parse(localStorage.getItem('lyrivue-tuning') ?? 'null');
    // 2026-10-20 拍の拡大（punch）の初期値を 0.15 → 0 にした。前に覚えた値は一度だけ新しい初期値に置き換える
    if (saved && typeof saved === 'object' && localStorage.getItem('lyrivue-tuning-v') !== '2') {
      delete saved.punch;
      localStorage.setItem('lyrivue-tuning', JSON.stringify(saved));
    }
    localStorage.setItem('lyrivue-tuning-v', '2');
    return resolveTuning(saved);
  } catch { return resolveTuning(null); }
}
function saveTuning(t) { try { localStorage.setItem('lyrivue-tuning', JSON.stringify(t)); } catch { /* 覚えなくても動く */ } }
function loadMotifs() { try { return localStorage.getItem('lyrivue-motifs') !== 'off'; } catch { return true; } }
// 使う書体（S）。覚えていなければ全部
const FONT_NAMES = { mincho: '明朝', gothic: 'ゴシック', heavy: '極太', hand: '手書き風', dot: 'ドット' };
function loadFonts() {
  try {
    const v = JSON.parse(localStorage.getItem('lyrivue-fonts') ?? 'null');
    const ok = Array.isArray(v) ? v.filter(f => f in FONT_NAMES) : [];
    return ok.length ? ok : Object.keys(FONT_NAMES);
  } catch { return Object.keys(FONT_NAMES); }
}
// 使う世界（S）。覚えていなければ全部
const WORLD_KEYS = WORLDS.map(w => w.id);
function loadWorlds() {
  try {
    const v = JSON.parse(localStorage.getItem('lyrivue-worlds') ?? 'null');
    const ok = Array.isArray(v) ? v.filter(w => WORLD_KEYS.includes(w)) : [];
    return ok.length ? ok : [...WORLD_KEYS];
  } catch { return [...WORLD_KEYS]; }
}
function saveWorlds(list) { try { localStorage.setItem('lyrivue-worlds', JSON.stringify(list)); } catch { /* 覚えなくても動く */ } }
function saveFonts(list) { try { localStorage.setItem('lyrivue-fonts', JSON.stringify(list)); } catch { /* 覚えなくても動く */ } }
// 文字のあとに貼る飾り：none（初期）・doodle・all
// 2026-10-18 持ち主が要らないと決めたので、切り替えを隠して常になし（前に選んだ値が残っていても使わない）
function loadStickers() { return 'none'; }
function saveStickers(v) { try { localStorage.setItem('lyrivue-stickers', v); } catch { /* 覚えなくても動く */ } }
function saveMotifs(on) { try { localStorage.setItem('lyrivue-motifs', on ? 'on' : 'off'); } catch { /* 覚えなくても動く */ } }
// 最後の世界：bright（同じ世界の明るい色・初期）か stay（そのまま）
function loadEnding() { try { return localStorage.getItem('lyrivue-ending') === 'stay' ? 'stay' : 'bright'; } catch { return 'bright'; } }
function saveEnding(v) { try { localStorage.setItem('lyrivue-ending', v); } catch { /* 覚えなくても動く */ } }
function loadUnify() { try { return localStorage.getItem('lyrivue-unify') !== 'off'; } catch { return true; } }
function saveUnify(v) { try { localStorage.setItem('lyrivue-unify', v ? 'on' : 'off'); } catch { /* 覚えなくても動く */ } }
function loadRemoved() { try { return normalizeRemoved(JSON.parse(localStorage.getItem('lyrivue-removed') ?? 'null')); } catch { return normalizeRemoved(null); } }
function saveRemoved(r) { try { localStorage.setItem('lyrivue-removed', JSON.stringify(r)); } catch { /* 覚えなくても動く */ } }
function loadEdits() { try { return normalizeEdits(JSON.parse(localStorage.getItem('lyrivue-edits') ?? 'null')); } catch { return normalizeEdits(null); } }
function saveEdits(e) { try { localStorage.setItem('lyrivue-edits', JSON.stringify(e)); } catch { /* 覚えなくても動く */ } }
function loadPickMode() { try { return localStorage.getItem('lyrivue-pick-mode') === 'edit' ? 'edit' : 'remove'; } catch { return 'remove'; } }
function savePickMode(m) { try { localStorage.setItem('lyrivue-pick-mode', m); } catch { /* 覚えなくても動く */ } }

const state = {
  analysis: null,
  script: null,
  seed: 1,
  mood: 'S', // 'S' 空間に散らす／'D' 廊下に重ねる／'B' 跳ねる
  tuning: loadTuning(), // 調整パネルの値
  motifs: loadMotifs(), // 言葉の演出（月・雨・時計などの小物）を入れるか（S のとき）
  ending: loadEnding(), // 最後の世界（S のとき）
  unify: loadUnify(), // 場所の中の演出をそろえる（S のとき）
  stickers: loadStickers(), // 文字のあとに貼る飾り（S のとき）
  fonts: loadFonts(),   // 使う書体（S のとき）
  worlds: loadWorlds(), // 使う世界（S のとき）
  worldOnly: false,     // 世界のボタンを押したとき：false＝出なくする／true＝その世界だけにする
  removed: loadRemoved(), // 消した演出（director/removals.js）
  edits: loadEdits(),     // 直した行（director/edits.js）
  pickMode: loadPickMode(), // 止めた画面でやること：'remove' 演出を消す／'edit' この行を直す
  sel: null,      // 直している行の番号（無ければ null）
  cands: [],      // タップしたときに見えていた行（タップした位置に近い順）
  emphFrom: null, // 強調の「はじめの文字」を押したところ（おわりを待っている）
  stopAt: null,   // 「この行を見る」で止める時刻
  history: [],    // ひとつ戻す：直す前の state.edits（JSON の文字列。新しいものが最後。50 個まで。ページを開き直すと消える）
  compare: null,  // 「直す前を見る」を押している間だけ、その行を直す前の台本
  live: null,     // つまむ・2本指・ホイールの途中（{ i, move, size, roll }。離すと覚える）
  selHit: null,   // 選んだ行の枠の、画面での中心と半径（つまめる範囲）
  dragged: false, // つまんで動かした直後（そのクリックは行の選び直しにしない）
  peek: null, // 一覧の行に指を置いている間だけ、その演出を消した絵を見せる（{items:[...]}）
  pickAt: null, // 一覧を開いた時刻（開いていなければ null）
  raf: 0,    // requestAnimationFrame の番号（二重に回さないため）
  hasSong: false,
  songFile: null, // 読み込んだ曲のファイル（動画の音と、ファイル名に使う）
  analysisName: '', // 解析結果の名前（保存するとき）
  dragging: false, // シークのつまみを押している間 true
  playing: false,
  touched: { song: false, analysis: false }, // ユーザーが先に選んだ・デモを押したら、前回のファイルの自動読み込みで上書きしない
  // 曲がないときの時計（performance.now から進める）
  clockT: 0,
  clockStart: 0,
};

const ICON_PLAY = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5v15l13-7.5z"/></svg>';
const ICON_PAUSE = '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4.5" width="4.2" height="15" rx="1"/><rect x="13.8" y="4.5" width="4.2" height="15" rx="1"/></svg>';

const fmt = s => {
  const v = Math.max(0, s);
  const m = Math.floor(v / 60);
  return `${m}:${(v - m * 60).toFixed(1).padStart(4, '0')}`;
};
function say(text, isErr = false) {
  const el = $('msg');
  el.textContent = text;
  el.className = isErr ? 'msg err' : 'msg';
}

const duration = () => (state.hasSong && Number.isFinite(audio.duration) ? audio.duration : state.analysis?.duration ?? 0);
const now = () => (state.hasSong ? audio.currentTime : state.clockT);

function setTime(t) {
  const d = duration();
  const v = Math.min(Math.max(0, t), d);
  if (state.hasSong) audio.currentTime = v; else { state.clockT = v; state.clockStart = performance.now() - v * 1000; }
  draw();
}

// 画面の大きさに合わせて Canvas の画素数を決める
function fitCanvas() {
  const r = cv.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = Math.max(2, Math.round(r.width * dpr));
  const h = Math.max(2, Math.round(r.height * dpr));
  if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
}

// ぶれを重ねるための、もう1枚の画面（同じ大きさなら使い回す）
let scratch = null;
const makeCanvas = (w, h) => {
  if (!scratch) { const c = document.createElement('canvas'); scratch = { canvas: c, ctx: c.getContext('2d') }; }
  if (scratch.canvas.width !== w) scratch.canvas.width = w;
  if (scratch.canvas.height !== h) scratch.canvas.height = h;
  return scratch;
};

// 歌詞の文字ぶんの書体を読み込んでから描く（読み込み前だと代わりの書体で描かれる）
async function prepareFonts() {
  const text = (state.analysis?.lines ?? []).map(l => l.text).join('').slice(0, 3000);
  try {
    // 雰囲気 S は行ごとに書体を変えるので、全部の書体の普通と強調の太さを読む
    const faces = Object.values(TYPEFACES).flatMap(f => [...new Set([f.light, f.heavy])].map(w => `${w} 40px ${f.family}`));
    await Promise.all(faces.map(f => document.fonts.load(f, text)));
  } catch { /* 読み込めなくても代わりの書体で描く */ }
  draw();
}

function draw() {
  fitCanvas();
  const t = now();
  const base = state.compare ?? state.script; // 「直す前を見る」を押している間は、その行を直す前の台本
  const script = state.peek ? applyRemovals(base, state.peek) : base;
  if (script) renderFrameMotion(ctx, script, state.analysis, t, { width: cv.width, height: cv.height }, { makeCanvas });
  else { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, cv.width, cv.height); }
  drawSelection(t);
  $('stage').classList.toggle('editing', !!state.selHit); // 行を直している間は、画面の上の指でページを動かさない
  $('time').textContent = `${fmt(t)} / ${fmt(duration())}`;
  showJump(t);
  const seek = $('seek');
  if (!state.dragging) seek.value = String(t); // ドラッグ中だけは、つまみを動かさない
  markScene(t);
}

// 歌詞で埋める組みの出る所へ飛ぶ：一覧は台本が変わったときだけ作り直す（消した・直した演出も反映される）
let jumpCache = { script: null, list: [] };
const jumpList = () => {
  if (jumpCache.script !== state.script) jumpCache = { script: state.script, list: floodMoments(state.script) };
  return jumpCache.list;
};
let jumpShown = '';
function showJump(t) {
  const list = jumpList();
  const n = momentIndex(list, t);
  const cur = list[n - 1];
  const html = !state.script ? '' : list.length === 0 ? 'この案には埋める組みがありません'
    : `<b>${n} / ${list.length}</b>　${cur ? `<em>${cur.name}</em>（${cur.cat}・${fmt(cur.t)}）` : '最初の埋める組みより前'}`;
  if (html !== jumpShown) { $('fl-now').innerHTML = html; jumpShown = html; } // 毎コマ書き換えない
  $('fl-prev').disabled = !jumpTarget(list, t, -1);
  $('fl-next').disabled = !jumpTarget(list, t, 1);
}
for (const [id, dir] of [['fl-prev', -1], ['fl-next', 1]]) {
  $(id).insertAdjacentHTML(dir < 0 ? 'afterbegin' : 'beforeend', ARROW_ICONS[dir < 0 ? 'prev' : 'next']);
  $(id).addEventListener('click', () => {
    const m = jumpTarget(jumpList(), now(), dir);
    if (!m) return;
    state.stopAt = null;
    setTime(m.at); // 再生中ならそのまま流れ、止めていれば止まったまま
  });
}

function markScene(t) {
  const items = document.querySelectorAll('ol.scenes li');
  state.script?.scenes.forEach((s, i) => items[i]?.classList.toggle('now', t >= s.start && t < s.end));
}

function tick() {
  if (!state.playing) return;
  if (!state.hasSong) {
    state.clockT = (performance.now() - state.clockStart) / 1000;
    if (state.clockT >= duration()) { pause(); state.clockT = duration(); }
  } else if (audio.ended) pause();
  // 「この行を見る」：歌い終わりで止める
  if (state.stopAt !== null && now() >= state.stopAt) {
    const at = state.stopAt - 0.05;
    pause(); setTime(at); state.pickAt = at;
    // 止めた瞬間に見えている行で「ほかの行」の候補を作り直す（直している行を先頭に）
    state.cands = [state.sel, ...visibleLines(at).map(c => c.line).filter(x => x !== state.sel)].filter(x => x !== null);
    if (!$('picker').hidden) showPicker();
  }
  // 画面が見えていない間（タップで合わせるなどでスクロールして隠れている）は MV を描かず、時刻の表示だけ進める。
  // iPhone では描くのに手いっぱいになり、タップの合図の処理が遅れた（2026-10-20 持ち主の録画）
  if (stageSeen) draw(); else showClock();
  if (state.playing) state.raf = requestAnimationFrame(tick);
}
// 舞台（MV の画面）が画面に見えているか。見えなくなったら描くのを休む（IntersectionObserver が無ければいつも描く）
let stageSeen = true;
if (typeof IntersectionObserver === 'function') {
  new IntersectionObserver(([en]) => {
    const was = stageSeen;
    stageSeen = en.isIntersecting;
    if (stageSeen && !was) draw(); // 見えたら、今の時刻の絵にすぐ追いつく
  }).observe($('stage'));
}
function showClock() {
  const t = now();
  $('time').textContent = `${fmt(t)} / ${fmt(duration())}`;
  if (!state.dragging) $('seek').value = String(t);
}

function play(keepPicker = false) {
  if (!state.analysis) return;
  if (!keepPicker) state.stopAt = null;
  if (state.hasSong) {
    if (audio.ended) audio.currentTime = 0;
    audio.play().catch(e => { if (e?.name === 'AbortError') return; say('再生できませんでした：' + e.message, true); pause(); }); // 直後の一時停止で出る AbortError は無視する
  } else {
    if (state.clockT >= duration()) state.clockT = 0;
    state.clockStart = performance.now() - state.clockT * 1000;
  }
  state.playing = true;
  if (!keepPicker) closePicker();
  $('play').innerHTML = ICON_PAUSE;
  $('play').setAttribute('aria-label', '一時停止');
  cancelAnimationFrame(state.raf);
  state.raf = requestAnimationFrame(tick);
}
function pause() {
  state.stopAt = null; // 手で止めたら「この行を見る」の止める時刻も忘れる
  if (state.hasSong) audio.pause();
  state.playing = false;
  cancelAnimationFrame(state.raf);
  $('play').innerHTML = ICON_PLAY;
  $('play').setAttribute('aria-label', '再生');
}

// 台本を作るときの選び（「直す前を見る」も同じ選びで、その行の直しだけ外して作る）
const scriptOpts = () => ({ seed: state.seed, mood: state.mood, tuning: state.tuning, motifs: state.motifs, ending: state.ending, unify: state.unify, stickers: state.stickers, fonts: state.fonts, worlds: state.worlds, removed: state.removed, edits: state.edits });
function rebuildScript() {
  state.compare = null;
  state.script = buildScript(state.analysis, scriptOpts());
  showSummary();
  showEdited(); // 直した行が今の歌詞に効いているかも出し直す
  if (state.pickAt !== null) showPicker(); // 作り直したら、一覧も今の台本で出し直す
  draw();
}

function showSummary() {
  const s = state.script;
  const chips = s.style.colors.map(c => `<i style="background:${c}"></i>`).join('');
  const scenes = s.scenes.map(sc => {
    const names = [...new Set(sc.layers.map(l => l.part))].join('、');
    const label = sc.section || '前奏';
    const tone = (sc.tone === 'paper' ? '・白地' : sc.tone === 'ink' ? '・黒地' : '') + (sc.tones?.length ? `・地の色の切り替え ${sc.tones.length}回` : '') + (sc.koma ? '・コマ打ち' : '');
    return `<li><b>${label}</b> ${fmt(sc.start)}〜${fmt(sc.end)}（強さ ${sc.intensity.toFixed(2)}${tone}）<br>${names}</li>`;
  }).join('');
  $('summary').innerHTML = `案 ${s.seed}：色 <span class="chips">${chips}</span>　書体 <b>${s.style.font}</b>　場面 <b>${s.scenes.length}</b>つ　カメラのキー <b>${s.camera?.keys.length ?? 0}</b><ol class="scenes">${scenes}</ol>`;
}

function setReady(on) {
  $('play').disabled = !on;
  $('seek').disabled = !on;
  $('again').disabled = !on;
  $('tap-start').disabled = !on;
  $('save-analysis').disabled = !on;
  for (const b of $('route').querySelectorAll('[data-step="2"], [data-step="3"]')) b.disabled = !on;
  if (!state.exporting) $('ex-go').disabled = !on;
  $('play').innerHTML = ICON_PLAY;
  $('seek').max = String(duration());
}

// ---- 入力 ----
// 解析結果の文字列を読んで使う。remember が true なら、次に開いたとき自動で読み込めるよう覚えておく
let analysisToken = 0; // 同時に2つ読み込んだとき、あとから選んだほうを使う
async function applyAnalysis(file, remember) {
  pause();
  const mine = ++analysisToken;
  try {
    const data = JSON.parse(await file.text());
    if (mine !== analysisToken) return false; // 読んでいる間に、別のものが選ばれた
    if (data?.version !== 1) throw new Error(`解析結果の版が合いません（version ${data?.version}）。この確認ページは version 1 用です`);
    if (!Array.isArray(data.lines) || !Array.isArray(data.sections)) throw new Error('解析結果の形が違います（lines と sections が必要です）');
    state.analysis = data;
    state.analysisName = file.name;
    state.seed = 1;
    state.clockT = 0;
    if (state.hasSong) audio.currentTime = 0;
    setReady(true);
    rebuildScript();
    prepareFonts();
    if (remember) { saveFile('analysis', file); $('forget').hidden = false; }
    $('view-msg').textContent = '';
    goStep(2); // できたら見る段へ
    say(`読み込みました：${file.name}（${data.lines.length}行・${data.sections.length}区切り・${fmt(data.duration)}）。${state.hasSong ? '' : '曲はまだ選ばれていません（無音で進みます）。'}`);
    return true;
  } catch (err) {
    state.analysis = null; state.script = null;
    setReady(false);
    say('解析結果を読めませんでした：' + err.message, true);
    draw();
    return false;
  }
}

function applySong(file, remember) {
  pause();
  if (audio.src) URL.revokeObjectURL(audio.src);
  audio.src = URL.createObjectURL(file);
  state.songFile = file;
  audio.onloadedmetadata = () => {
    state.hasSong = true;
    $('seek').max = String(duration());
    if (remember) { saveFile('song', file); $('forget').hidden = false; }
    say(`曲を読み込みました：${file.name}（${fmt(audio.duration)}）`);
    draw();
  };
  audio.onerror = () => { state.hasSong = false; say('この曲ファイルは読めませんでした。', true); };
}

$('analysis').addEventListener('change', e => { const f = e.target.files[0]; if (f) { state.touched.analysis = true; unpressSet(); applyAnalysis(f, true); } });
$('song').addEventListener('change', e => { const f = e.target.files[0]; if (f) { state.touched.song = true; applySong(f, true); } });

// 前回選んだファイルがあれば、自動で読み込む（毎回選ばなくてよいように）
async function restore() {
  const [song, analysis] = await Promise.all([loadFile('song'), loadFile('analysis')]);
  if (song || analysis) $('forget').hidden = false; // 曲だけ覚えているときも、消す手段を出す
  // 待っている間にユーザーが選んだ・デモを押したものは、上書きしない
  if (song && !state.touched.song) applySong(song, false);
  if (analysis && !state.touched.analysis && await applyAnalysis(analysis, false)) {
    say(`前回のファイルを読み込みました：${analysis.name}${song && !state.touched.song ? '、' + song.name : ''}。`);
  }
}
$('forget').addEventListener('click', async () => { await forgetAll(); $('forget').hidden = true; say('覚えていたファイルを忘れました。'); });

// いつもの曲：ボタン 1 つで曲と解析結果を読み込む（公開ページの songs/ から。手元のサーバーには無い）
for (const s of SONG_SET) {
  const b = document.createElement('button');
  b.type = 'button'; b.className = 'small song'; b.dataset.id = s.id; b.textContent = s.title; b.setAttribute('aria-pressed', 'false');
  b.addEventListener('click', () => loadSongSet(s, b));
  $('song-set').append(b);
}
// ほかの解析結果に替えたら、いつもの曲の印を外す
function unpressSet() { for (const x of $('song-set').children) x.setAttribute('aria-pressed', 'false'); }
async function loadSongSet(s, b) {
  const urls = songSetUrls(s.id, import.meta.url);
  const sayHere = (text, err) => { const m = $('set-msg'); m.textContent = text; m.classList.toggle('err', !!err); };
  b.setAttribute('aria-busy', 'true');
  sayHere(`「${s.title}」を読み込んでいます…`);
  try {
    const get = async url => { const r = await fetch(url); if (!r.ok) throw new Error(`${r.status}`); return r.blob(); };
    const [json, mp3] = await Promise.all([get(urls.analysis), get(urls.song)]);
    state.touched.analysis = true; state.touched.song = true; // 前回のファイルの自動読み込みより優先する
    applySong(new File([mp3], `${s.title}.mp3`, { type: 'audio/mpeg' }), false);
    if (await applyAnalysis(new File([json], `${s.title}-analysis.json`, { type: 'application/json' }), false)) {
      for (const x of $('song-set').children) x.setAttribute('aria-pressed', String(x === b));
      sayHere(`「${s.title}」を読み込みました。再生ボタンを押してください。`);
      $('view-msg').textContent = `「${s.title}」を読み込みました。`;
    } else sayHere(`「${s.title}」の解析結果を読めませんでした。`, true);
  } catch {
    sayHere(`「${s.title}」を読み込めませんでした（手元のサーバーには曲を置いていません。公開ページで押すか、下でファイルを選んでください）。`, true);
  } finally {
    b.removeAttribute('aria-busy');
  }
}

// 見本の解析結果で見る（ファイルを選べないときでも確かめられる）
$('demo').addEventListener('click', () => {
  pause();
  unpressSet();
  state.touched.analysis = true;
  analysisToken++; // 読み込み中の解析結果があっても、デモを優先する
  state.analysis = makeDemoAnalysis();
  state.seed = 1;
  state.clockT = 0;
  if (state.hasSong) audio.currentTime = 0;
  setReady(true);
  rebuildScript();
  prepareFonts();
  goStep(2);
  say('デモを読み込みました（60秒・架空の歌詞）。再生ボタンを押してください。');
});

$('play').addEventListener('click', () => (state.playing ? pause() : play()));
$('seek').addEventListener('input', e => { state.stopAt = null; setTime(Number(e.target.value)); });
$('again').addEventListener('click', () => { state.seed += 1; rebuildScript(); });

function setAspect(kind) {
  $('stage').dataset.aspect = kind;
  $('portrait').setAttribute('aria-pressed', String(kind === 'portrait'));
  $('landscape').setAttribute('aria-pressed', String(kind === 'landscape'));
  draw();
}
$('portrait').addEventListener('click', () => setAspect('portrait'));
$('landscape').addEventListener('click', () => setAspect('landscape'));
function setMood(m) {
  state.mood = m;
  $('moodS').setAttribute('aria-pressed', String(m === 'S'));
  $('moodD').setAttribute('aria-pressed', String(m === 'D'));
  $('moodB').setAttribute('aria-pressed', String(m === 'B'));
  if (state.analysis) rebuildScript();
}
$('moodS').addEventListener('click', () => setMood('S'));
$('moodD').addEventListener('click', () => setMood('D'));
$('moodB').addEventListener('click', () => setMood('B'));
function showMotifs() {
  $('motifs').setAttribute('aria-pressed', String(state.motifs));
  $('motifs').textContent = `言葉の演出（月・雨・時計などの小物）：${state.motifs ? 'オン' : 'オフ'}`;
}
showMotifs();
$('motifs').addEventListener('click', () => {
  state.motifs = !state.motifs;
  saveMotifs(state.motifs);
  showMotifs();
  if (state.analysis) rebuildScript();
});
function showEnding() {
  $('ending-bright').setAttribute('aria-pressed', String(state.ending === 'bright'));
  $('ending-stay').setAttribute('aria-pressed', String(state.ending === 'stay'));
}
showEnding();
for (const [id, v] of [['ending-bright', 'bright'], ['ending-stay', 'stay']]) $(id).addEventListener('click', () => {
  if (state.ending === v) return;
  state.ending = v;
  saveEnding(state.ending);
  showEnding();
  if (state.analysis) rebuildScript();
});
function showUnify() {
  $('unify-on').setAttribute('aria-pressed', String(state.unify));
  $('unify-off').setAttribute('aria-pressed', String(!state.unify));
}
showUnify();
for (const [id, v] of [['unify-on', true], ['unify-off', false]]) $(id).addEventListener('click', () => {
  if (state.unify === v) return;
  state.unify = v;
  saveUnify(v);
  showUnify();
  if (state.analysis) rebuildScript();
});
function showStickers() {
  for (const b of $('stickers').querySelectorAll('button')) b.setAttribute('aria-pressed', String(b.dataset.stickers === state.stickers));
}
showStickers();
for (const b of $('stickers').querySelectorAll('button')) b.addEventListener('click', () => {
  state.stickers = b.dataset.stickers;
  saveStickers(state.stickers);
  showStickers();
  if (state.analysis) rebuildScript();
});
// 使う書体：ボタンの文字はその書体で書く。最後の1つは消せない
const fontBox = $('fonts');
for (const [key, name] of Object.entries(FONT_NAMES)) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'small face';
  b.dataset.font = key;
  b.textContent = name;
  b.style.fontFamily = TYPEFACES[key].family;
  b.addEventListener('click', () => {
    const on = state.fonts.includes(key);
    if (on && state.fonts.length === 1) return;
    state.fonts = on ? state.fonts.filter(f => f !== key) : Object.keys(FONT_NAMES).filter(f => f === key || state.fonts.includes(f));
    saveFonts(state.fonts);
    showFonts();
    if (state.analysis) rebuildScript();
  });
  fontBox.append(b);
}
function showFonts() {
  for (const b of fontBox.children) {
    const on = state.fonts.includes(b.dataset.font);
    b.setAttribute('aria-pressed', String(on));
    b.title = on && state.fonts.length === 1 ? '最後の1つは外せません' : '';
  }
}
showFonts();
// 使う世界：ボタンには色見本（地の色と線の色）。「これだけにする」にすると、押した世界だけで曲全体を見られる
// ---- 見る段のテーマ（app/themes.js）：使う世界のおすすめの組み合わせ。押すと「使う世界」を書き換える ----
const themeBox = $('themes');
const swatchOf = id => {
  const w = WORLDS.find(x => x.id === id);
  const p = w?.palette?.(['#5B8CFF']);
  return p ? `linear-gradient(transparent 66%, ${p.line} 66% 78%, transparent 78%), ${p.bg}` : '#000';
};
for (const t of THEMES) {
  const b = document.createElement('button');
  b.type = 'button'; b.className = 'theme'; b.dataset.theme = t.id;
  const strip = document.createElement('span');
  strip.className = 'strip';
  // おまかせは全部だと細かすぎるので、性格の違う 6 つだけ見せる
  const shown = t.worlds ?? ['paper', 'water', 'city', 'sunset', 'neon', 'pop'];
  for (const id of shown) { const i = document.createElement('i'); i.style.background = swatchOf(id); strip.append(i); }
  const name = document.createElement('b'); name.textContent = t.name;
  const note = document.createElement('small'); note.textContent = t.note;
  b.append(strip, name, note);
  b.addEventListener('click', () => {
    state.worlds = themeWorlds(t.id);
    state.worldOnly = false;
    saveWorlds(state.worlds);
    showWorlds();
    if (state.analysis) rebuildScript();
  });
  themeBox.append(b);
}
const themeNote = document.createElement('p');
themeNote.className = 'themes-note';
themeBox.after(themeNote);
function showThemes() {
  const cur = themeOf(state.worlds);
  for (const b of themeBox.children) b.setAttribute('aria-pressed', String(b.dataset.theme === cur));
  themeNote.textContent = cur ? '' : `いまは「作る側の道具」で選んだ ${state.worlds.length} の世界を使っています。`;
  themeNote.hidden = !!cur;
}

const worldBox = $('worlds');
for (const w of WORLDS) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'small world';
  b.dataset.world = w.id;
  const sw = document.createElement('i');
  const p = w.palette?.(['#5B8CFF']);
  sw.style.background = p ? `linear-gradient(transparent 62%, ${p.line} 62% 80%, transparent 80%), ${p.bg}` : w.id === 'tunnel' ? 'radial-gradient(circle, transparent 30%, #8ea6ff 31% 42%, transparent 43%), #000' : '#000';
  b.append(sw, document.createTextNode(w.name));
  b.addEventListener('click', () => {
    if (state.worldOnly) state.worlds = [w.id];
    else {
      const on = state.worlds.includes(w.id);
      if (on && state.worlds.length === 1) return;
      state.worlds = on ? state.worlds.filter(x => x !== w.id) : WORLD_KEYS.filter(x => x === w.id || state.worlds.includes(x));
    }
    saveWorlds(state.worlds);
    showWorlds();
    if (state.analysis) rebuildScript();
  });
  worldBox.append(b);
}
function showWorlds() {
  for (const b of worldBox.children) {
    const on = state.worlds.includes(b.dataset.world);
    b.setAttribute('aria-pressed', String(on));
    b.title = on && state.worlds.length === 1 && !state.worldOnly ? '最後の1つは外せません' : '';
  }
  $('worldMode').textContent = state.worldOnly ? '押すと：これだけにする' : '押すと：出なくする';
  $('worldMode').setAttribute('aria-pressed', String(state.worldOnly));
  showThemes(); // 見る段のテーマも、いまの世界の選びに合わせる
}
$('worldMode').addEventListener('click', () => { state.worldOnly = !state.worldOnly; showWorlds(); });
$('worldAll').addEventListener('click', () => {
  state.worlds = [...WORLD_KEYS];
  saveWorlds(state.worlds);
  showWorlds();
  if (state.analysis) rebuildScript();
});
showWorlds();
window.addEventListener('resize', draw);

// ---- 演出を消す：画面をタップすると止まり、そのとき出ている演出の一覧を出す ----
cv.addEventListener('click', e => {
  if (!state.script) return;
  if (state.dragged) { state.dragged = false; return; } // つまんで動かした直後のクリックは、行の選び直しにしない
  if (state.playing) pause();
  state.stopAt = null;
  state.pickAt = now();
  // タップした位置（Canvas の画素）に近い順に、今見えている行を並べる
  const r = cv.getBoundingClientRect();
  const x = (e.clientX - r.left) * cv.width / r.width, y = (e.clientY - r.top) * cv.height / r.height;
  state.cands = visibleLines(state.pickAt).sort((p, q) => Math.hypot(p.x - x, p.y - y) - Math.hypot(q.x - x, q.y - y)).map(c => c.line);
  state.sel = state.cands[0] ?? null;
  state.emphFrom = null;
  showPicker();
  draw();
  $('picker').scrollIntoView({ block: 'nearest', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
});
$('picker-close').addEventListener('click', closePicker);
function closePicker() {
  state.pickAt = null;
  state.sel = null;
  state.emphFrom = null;
  setPeek(null);
  $('picker').hidden = true;
}
function setPeek(ids, row) {
  document.querySelectorAll('.fx-row.peeking').forEach(el => el.classList.remove('peeking'));
  state.peek = ids ? { items: ids } : null;
  if (row) row.classList.add('peeking');
  $('stage').classList.toggle('peek', !!ids);
  $('peek-badge').hidden = !ids;
  draw();
}
function showPicker() {
  const t = state.pickAt;
  const list = $('picker-list');
  list.textContent = '';
  $('picker').hidden = false;
  const editing = state.pickMode === 'edit';
  $('mode-remove').setAttribute('aria-pressed', String(!editing));
  $('mode-edit').setAttribute('aria-pressed', String(editing));
  $('remove-panel').hidden = editing;
  $('edit-panel').hidden = !editing;
  $('picker-title').innerHTML = editing ? `<b>${fmt(t)}</b> の行を直す` : `<b>${fmt(t)}</b> に出ている演出`;
  if (editing) { showEditPanel(); return; }
  const items = effectsAt(state.script, t);
  if (!items.length) {
    const p = document.createElement('p');
    p.className = 'fx-empty';
    p.textContent = 'この瞬間に消せる演出はありません。少しずらして、もう一度タップしてください。';
    list.appendChild(p);
    return;
  }
  let group = '';
  for (const it of items) {
    if (it.group !== group) {
      group = it.group;
      const h = document.createElement('p');
      h.className = 'fx-group';
      h.textContent = group;
      list.appendChild(h);
    }
    const row = document.createElement('div');
    row.className = 'fx-row';
    const name = document.createElement('span');
    name.className = 'name';
    name.textContent = it.label;
    if (it.ids.length > 1) { const n = document.createElement('small'); n.textContent = `${it.ids.length}か所`; name.appendChild(n); }
    const here = document.createElement('button');
    here.type = 'button'; here.className = 'small'; here.textContent = 'ここだけ';
    here.setAttribute('aria-label', `${it.label}をこの場面だけ消す`);
    const all = document.createElement('button');
    all.type = 'button'; all.className = 'small all'; all.textContent = '全部';
    all.setAttribute('aria-label', `${it.label}を曲全体から消す`);
    here.addEventListener('click', () => removeEffects({ items: it.ids }, `「${it.label}」をこの場面だけ消しました。`));
    all.addEventListener('click', () => removeEffects({ kinds: [it.key] }, `「${it.label}」を曲全体から消しました。`));
    // 指を置く・マウスを乗せる・キーで選ぶと、消したときの見え方を見せる
    row.addEventListener('pointerenter', () => setPeek(it.ids, row));
    row.addEventListener('pointerleave', () => setPeek(null));
    row.addEventListener('focusin', () => setPeek(it.ids, row));
    row.addEventListener('focusout', e => { if (!row.contains(e.relatedTarget)) setPeek(null); });
    row.append(name, here, all);
    list.appendChild(row);
  }
}
function removeEffects(add, message) {
  state.removed = normalizeRemoved({ kinds: [...state.removed.kinds, ...(add.kinds ?? [])], items: [...state.removed.items, ...(add.items ?? [])] });
  saveRemoved(state.removed);
  state.peek = null;
  $('stage').classList.remove('peek');
  $('peek-badge').hidden = true;
  showRemoved();
  if (state.analysis) rebuildScript();
  say(message);
}
// 消した演出の一覧（種類ごとの「全部」と、「ここだけ」の数）。押すと戻す
const LABELS_CACHE = new Map(); // 種類の名前 → 表示名（一覧で見たもの）
function labelOfKind(key) {
  if (LABELS_CACHE.has(key)) return LABELS_CACHE.get(key);
  // 一覧で見ていない種類（前に消したもの）は、架空の場面に置いて名前を引く
  const [g, v] = key.split(':');
  const layer = g === 'motif' ? { part: 'fx.motif', kind: v } : g === 'deco' ? { part: 'fx.deco', kind: v } : g === 'part' ? { part: v } : g === 'koma' ? null : g === 'vessel' ? { part: 'text.motion', line: 0, vessels: [v] } : { part: 'text.motion', line: 0, [g]: v };
  const scene = { start: 0, end: 1, mood: '', layers: layer ? [{ ...layer, from: 0, to: 1 }] : [] };
  if (g === 'hit') scene.hits = [{ t: 0, kind: v, dur: 1 }];
  if (g === 'tone') scene.tones = [{ t: 0, tone: v }];
  if (g === 'koma') scene.koma = 12;
  const found = effectsAt({ scenes: [scene] }, 0).find(x => x.key === key);
  const label = found ? found.label : key;
  LABELS_CACHE.set(key, label);
  return label;
}
function showRemoved() {
  const box = $('removed-box');
  box.textContent = '';
  const { kinds, items } = state.removed;
  for (const key of kinds) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = labelOfKind(key);
    const s = document.createElement('span'); s.textContent = '全部'; b.appendChild(s);
    b.setAttribute('aria-label', `${labelOfKind(key)}を元に戻す`);
    b.addEventListener('click', () => restoreRemoved({ kinds: kinds.filter(k => k !== key), items }));
    box.appendChild(b);
  }
  if (items.length) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = 'ここだけ消したもの';
    const s = document.createElement('span'); s.textContent = `${items.length}個`; b.appendChild(s);
    b.setAttribute('aria-label', `ここだけ消したもの ${items.length} 個を元に戻す`);
    b.addEventListener('click', () => restoreRemoved({ kinds, items: [] }));
    box.appendChild(b);
  }
  if (!kinds.length && !items.length) box.textContent = 'まだありません。';
  $('removed-json').value = JSON.stringify(state.removed, null, 2);
}
function restoreRemoved(next) {
  state.removed = normalizeRemoved(next);
  saveRemoved(state.removed);
  showRemoved();
  if (state.analysis) rebuildScript();
  say('元に戻しました。');
}
$('removed-clear').addEventListener('click', () => restoreRemoved(null));
$('removed-copy').addEventListener('click', async () => {
  const text = JSON.stringify({ ...state.removed, names: state.removed.kinds.map(labelOfKind) }, null, 2);
  try { await navigator.clipboard.writeText(text); say('消したものをコピーしました。'); }
  catch { $('removed-json').select(); say('下の枠を選びました。コピーしてください。'); }
});
showRemoved();
audio.addEventListener('seeked', draw);

// 書体を読み込んでから最初の絵を描く（読み込み前だと代わりの書体で描かれる）
$('play').innerHTML = ICON_PLAY;
Promise.all([
  document.fonts.load('40px "Dela Gothic One"', 'きみとふたり'),
  document.fonts.load('700 40px "Zen Kaku Gothic New"', 'きみとふたり'),
]).catch(() => {}).finally(draw);

// つまみを押している間だけ、再生の進みでつまみを動かさない（焦点が残っても動くようにする）
const seekEl = $('seek');
seekEl.addEventListener('pointerdown', () => { state.dragging = true; });
for (const ev of ['pointerup', 'pointercancel', 'change', 'blur']) seekEl.addEventListener(ev, () => { state.dragging = false; });

restore();

// ---- 調整パネル ----
const TUNING_UI = [
  ['spin', '到着の回転（ラジアン。大きいほどぐるっと回る）', 0.05],
  ['settle', '回転が戻る秒数（小さいほどぴたっと止まる）', 0.01],
  ['travel', '次の行へ動く秒数（小さいほど速い）', 0.01],
  ['lag', '次の行に着くのを歌い出しより遅らせる秒数（S。動き出しも遅れ、前の行に長く寄る）', 0.01],
  ['drift', '見ている間に寄る距離', 0.01],
  ['cruise', '奥へ前進する速さ（S。0 で前進しない）', 0.05],
  ['dive', '行をくぐり抜ける動きの出やすさ（S。0 で出ない）', 0.05],
  ['snap', '動きの鋭さ（S。0 でなめらか、大きいほど勢いよく出てぴたっと止まる）', 0.1],
  ['zStep', '行の奥行きの間隔（D のみ。小さいほど塊になる）', 0.05],
  ['keepLines', '奥に残す行数（歌い終えた行を残す）', 1],
  ['spread', '置き場所の広がり', 0.05],
  ['tilt', '文字の向きのばらつき（S。0 で全部正面）', 0.05],
  ['lookAhead', '先に薄く浮かべる行数（S）', 1],
  ['punch', '拍の拡大', 0.01],
  ['textBase', '文字の大きさ', 0.005],
  ['emphScale', '強調語の倍率', 0.1],
  ['blurRange', 'ぼけ幅（大きいほどゆるやか）', 0.1],
  ['pastHold', '歌い終えてから薄くなり始めるまで（秒・S）', 0.1],
  ['pastFade', '薄くなるのにかける秒数（S）', 0.1],
  ['pastLevel', '歌い終えた行の濃さ（1 で薄くならない・S）', 0.05],
];
function showTuningJson() { $('tune-json').value = JSON.stringify(state.tuning, null, 2); }
function buildTuningPanel() {
  const box = $('tuning-rows');
  box.innerHTML = '';
  for (const [key, label, step] of TUNING_UI) {
    const [lo, hi] = TUNING_RANGES[key];
    const row = document.createElement('label');
    row.innerHTML = `<span>${label}</span><b></b><input type="range" min="${lo}" max="${hi}" step="${step}">`;
    const input = row.querySelector('input');
    const out = row.querySelector('b');
    input.value = String(state.tuning[key]);
    // 覚えていた値がつまみの刻みに乗っていないとき、つまみの位置（刻みに丸められる）に state を合わせる
    if (Number(input.value) !== state.tuning[key]) state.tuning = resolveTuning({ ...state.tuning, [key]: Number(input.value) });
    out.textContent = String(state.tuning[key]);
    input.addEventListener('input', () => {
      state.tuning = resolveTuning({ ...state.tuning, [key]: Number(input.value) });
      out.textContent = String(state.tuning[key]);
      saveTuning(state.tuning);
      showTuningJson();
      if (state.analysis) rebuildScript();
    });
    box.appendChild(row);
  }
  showTuningJson();
}
$('tune-reset').addEventListener('click', () => {
  state.tuning = resolveTuning(null);
  saveTuning(state.tuning);
  buildTuningPanel();
  if (state.analysis) rebuildScript();
});
$('tune-copy').addEventListener('click', async () => {
  const text = JSON.stringify(state.tuning, null, 2);
  try { await navigator.clipboard.writeText(text); say('調整値をコピーしました。'); }
  catch { $('tune-json').select(); say('下の枠を選びました。コピーしてください。'); }
});
buildTuningPanel();

// ---- この行を直す：止めた画面でタップした行だけ、強調・来かた・大きさ・傾き・もう一案を直す（director/edits.js） ----
function setPickMode(m) {
  state.pickMode = m;
  savePickMode(m);
  state.emphFrom = null;
  setPeek(null);
  if (state.pickAt !== null) showPicker();
  draw();
}
$('mode-remove').addEventListener('click', () => setPickMode('remove'));
$('mode-edit').addEventListener('click', () => setPickMode('edit'));

const sceneAt = (script, t) => script?.scenes.find((s, i, all) => t >= s.start && (t < s.end || (i === all.length - 1 && t === s.end)));
const lineLayer = (script, i) => {
  for (const s of script?.scenes ?? []) for (const l of s.layers) if (l.part === 'text.motion' && l.line === i) return { layer: l, scene: s };
  return null;
};
// 時刻 t に見えている行（S のとき）：板の原点を今のカメラで映した位置
function visibleLines(t) {
  const s = state.script;
  const scene = sceneAt(s, t);
  if (!scene || scene.mood !== 'S' || !s.camera) return [];
  const cam = cameraAt(s.camera, t);
  const size = { width: cv.width, height: cv.height };
  const out = [];
  for (const l of scene.layers) {
    if (l.part !== 'text.motion' || !(t >= l.from && t < l.to)) continue;
    const p = project(cam, l.pos, size);
    const [sx, sy] = shiftPx(l);
    if (p && p.x + sx >= 0 && p.x + sx <= cv.width && p.y + sy >= 0 && p.y + sy <= cv.height) out.push({ line: l.line, x: p.x + sx, y: p.y + sy });
  }
  return out;
}
// 直している行に、黄色の点線の枠（描く係が実際に文字を描いた四隅を、少し外へ広げて囲む）
function drawSelection(t) {
  state.selHit = null;
  if (state.pickMode !== 'edit' || state.pickAt === null || state.sel === null || !state.script?.camera) return;
  const sc = state.compare ?? state.script;
  const l = lineLayer(sc, state.sel)?.layer;
  if (!l?.rot || !(t >= l.from && t < l.to)) return;
  const q = DRAWN_BOX.get(l);
  if (!q) return;
  const [a, b, c, d] = q; // 左上・右上・左下・右下
  const cx = (a[0] + b[0] + c[0] + d[0]) / 4, cy = (a[1] + b[1] + c[1] + d[1]) / 4;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const pad = 10 * dpr;
  const out = [a, b, d, c].map(([x, y]) => { const dx = x - cx, dy = y - cy, n = Math.hypot(dx, dy) || 1; return [x + dx / n * pad, y + dy / n * pad]; });
  ctx.save();
  ctx.strokeStyle = '#FFDF3D';
  ctx.lineWidth = 2.5 * dpr;
  ctx.setLineDash([9 * dpr, 6 * dpr]);
  ctx.beginPath();
  out.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
  const r = Math.max(...out.map(([x, y]) => Math.hypot(x - cx, y - cy)));
  state.selHit = { x: cx, y: cy, r: Math.max(40 * dpr, r) };
}
// 層の画面の上でのずらし（画素）。render/index.js と同じ（中心から端までを 1）
const shiftPx = l => (Array.isArray(l?.shift) && l.shift.length === 2 && l.shift.every(Number.isFinite) ? [l.shift[0] * cv.width / 2, l.shift[1] * cv.height / 2] : [0, 0]);

// 直す：patch の値が null の項目は消す（直していない状態に戻す）
// ひとつ戻す：直す前の状態を覚える（同じものは重ねない）
function remember() {
  const snap = JSON.stringify(state.edits);
  if (state.history[state.history.length - 1] !== snap) state.history.push(snap);
  if (state.history.length > 50) state.history.shift();
}
function undoEdit() {
  const snap = state.history.pop();
  if (!snap) return;
  state.edits = normalizeEdits(JSON.parse(snap));
  saveEdits(state.edits);
  if (state.analysis) rebuildScript(); else showEdited();
  say('ひとつ前に戻しました。');
}
function setEdit(i, patch) {
  remember();
  const text = String(state.analysis?.lines?.[i]?.text ?? '');
  const next = { ...(state.edits.lines[i] ?? {}), ...patch, text };
  for (const k of Object.keys(patch)) if (patch[k] === null) delete next[k];
  state.edits = normalizeEdits({ lines: { ...state.edits.lines, [i]: next } });
  saveEdits(state.edits);
  if (state.analysis) rebuildScript(); else showEdited();
}
function resetEdit(i) {
  remember();
  const lines = { ...state.edits.lines };
  delete lines[i];
  state.edits = normalizeEdits({ lines });
  saveEdits(state.edits);
  if (state.analysis) rebuildScript(); else showEdited();
}

// 折ってよい所（かなり／小さく、まっすぐ／寄る）に幅のない空白を入れる
const breakable = name => name.replace(/^(かなり|まっすぐ|くぐり|引いて)/, '$1​');
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const btn = (cls, text, key, onClick) => {
  const b = el('button', cls, text);
  b.type = 'button';
  b.dataset.focus = key; // 作り直したあとも、押したボタンに焦点を戻す
  b.addEventListener('click', onClick);
  return b;
};
function block(label, note) {
  const box = el('div', 'ed-block');
  const head = el('p', 'ed-label');
  head.append(el('b', '', label));
  if (note) { const em = el('em', '', note); head.append(em); }
  box.append(head);
  return box;
}

function showEditPanel() {
  const box = $('edit-panel');
  const focusKey = box.contains(document.activeElement) ? document.activeElement.dataset.focus : null;
  box.textContent = '';
  if (state.mood !== 'S') { box.append(el('p', 'ed-empty', '行を直すのは「空間に散らす（S）」のときだけ使えます。')); return; }
  const i = state.sel;
  const found = i === null ? null : lineLayer(state.script, i);
  if (!found) {
    box.append(el('p', 'ed-empty', 'この瞬間に見えている行がありません。行が映っているところで止めて、行の上をタップしてください。'));
    return;
  }
  const { layer } = found;
  const line = state.analysis.lines[i];
  const chars = Array.from(String(line.text ?? ''));
  const e = state.edits.lines[i] ?? {};

  // 行の歌詞と、操作
  const head = el('div', 'ed-head');
  const title = el('p', 'ed-line');
  title.append(el('span', 'no', `${i + 1}行目`), document.createTextNode(line.text));
  const tools = el('div', 'ed-tools');
  // 前の行・次の行へ（S の場面にある行だけ）
  const prevBtn = btn('small arrow', '前の行', 'prev', () => goLine(i - 1));
  prevBtn.disabled = !lineLayer(state.script, i - 1);
  const nextBtn = btn('small arrow', '次の行', 'next', () => goLine(i + 1));
  nextBtn.disabled = !lineLayer(state.script, i + 1);
  prevBtn.insertAdjacentHTML('afterbegin', ARROW_ICONS.prev); nextBtn.insertAdjacentHTML('beforeend', ARROW_ICONS.next);
  const other = btn('small', `ほかの行${state.cands.length > 1 ? `（${state.cands.length}行）` : ''}`, 'other', () => {
    const k = state.cands.indexOf(state.sel);
    state.sel = state.cands[(k + 1) % state.cands.length];
    state.emphFrom = null;
    showPicker(); draw();
  });
  other.disabled = state.cands.length <= 1;
  const watch = btn('small', 'この行を見る', 'watch', () => {
    setTime(Math.max(0, line.start - 2));
    state.stopAt = Math.max(line.end, line.start + 0.5);
    play(true);
  });
  // 1行前から見る：前の行の歌い出しの少し前から、この行の歌い終わりまで
  const before = state.analysis.lines[i - 1];
  const watchPrev = btn('small', '1行前から見る', 'watch-prev', () => {
    setTime(Math.max(0, before.start - 0.3));
    state.stopAt = Math.max(line.end, line.start + 0.5);
    play(true);
  });
  watchPrev.disabled = !before;
  // 直す前を見る：押している間だけ
  const cmp = btn('small hold', '直す前を見る', 'compare', () => {});
  cmp.title = '押している間だけ、直す前の見え方になります';
  cmp.disabled = !state.edits.lines[i];
  holdToCompare(cmp, i);
  const undoOne = btn('small', 'ひとつ戻す', 'undo-one', undoEdit);
  undoOne.disabled = !state.history.length;
  const undo = btn('small', 'この行を元に戻す', 'undo', () => { resetEdit(i); say(`${i + 1}行目を元に戻しました。`); });
  undo.disabled = !state.edits.lines[i];
  const row1 = el('div', 'ed-tools'), row2 = el('div', 'ed-tools');
  tools.append(prevBtn, nextBtn, other);
  row1.append(watchPrev, watch, cmp);
  row2.append(undoOne, undo);
  head.append(title, tools, row1, row2);
  box.append(head);

  // ここから場所を変える（director/places.js）：この行から先の区切りの種類。同じ種類は同じ場所に戻り、サビは派手な場所
  const sc = found.scene;
  const worldName = WORLDS.find(w => w.id === sc?.world)?.name;
  const kindName = PLACE_NAMES[sectionKind(sc?.section)];
  const pl = block('ここから場所を変える', worldName ? `いまは ${worldName}${kindName ? `（${kindName}）` : ''}` : '');
  const plRow = el('div', 'icons places');
  for (const key of ['auto', 'verse', 'bridge', 'chorus', 'outro', 'none']) {
    const name = key === 'auto' ? 'おまかせ' : PLACE_NAMES[key];
    const b = btn('ic', null, `place-${key}`, () => {
      setEdit(i, { place: key === 'auto' ? null : key });
      say(key === 'auto' ? `${i + 1}行目の場所の区切りを、おまかせに戻しました。` : key === 'none' ? `${i + 1}行目では場所を変えないようにしました。` : `${i + 1}行目から先を「${name}」の場所にしました。`);
    });
    b.innerHTML = PLACE_ICONS[key];
    b.append(el('span', '', name));
    b.setAttribute('aria-pressed', String((e.place ?? 'auto') === key));
    plRow.append(b);
  }
  pl.append(plRow, el('p', 'ed-note', 'この行から先の場所が変わります（次に場所を変える所まで）。同じ種類にした所は同じ場所に戻り、サビは派手な場所になります。'));
  box.append(pl);

  // ① 強調する文字：はじめの文字 → おわりの文字の順に押す
  const em = block('強調する文字', state.emphFrom !== null ? 'おわりの文字を押してください' : 'はじめとおわりの文字を押します');
  const row = el('div', 'chars');
  const on = Array.isArray(layer.emph) ? layer.emph : null;
  chars.forEach((ch, k) => {
    const b = btn(`ch${ch.trim() ? '' : ' sp'}`, ch.trim() ? ch : '', `ch${k}`, () => {
      if (state.emphFrom === null) { state.emphFrom = k; showPicker(); return; }
      const a = Math.min(state.emphFrom, k), z = Math.max(state.emphFrom, k);
      state.emphFrom = null;
      setEdit(i, { emph: [a, z - a + 1] });
    });
    if (on && k >= on[0] && k < on[0] + on[1]) b.classList.add('on');
    if (state.emphFrom === k) b.classList.add('from');
    b.setAttribute('aria-label', `${k + 1}文字目「${ch.trim() ? ch : '空白'}」`);
    b.setAttribute('aria-pressed', String(!!on && k >= on[0] && k < on[0] + on[1]));
    row.append(b);
  });
  const emRow = el('div', 'row');
  const none = btn('small', 'なし', 'emph-none', () => { state.emphFrom = null; setEdit(i, { emph: 'none' }); });
  none.setAttribute('aria-pressed', String(e.emph === 'none'));
  const auto = btn('small', 'おまかせ', 'emph-auto', () => { state.emphFrom = null; setEdit(i, { emph: null }); });
  auto.setAttribute('aria-pressed', String(!e.emph));
  emRow.append(none, auto);
  em.append(row, emRow);
  box.append(em);

  // ② カメラの来かた
  const cam = block('カメラの来かた', CAMS[e.cam ?? 'auto']);
  const camRow = el('div', 'icons');
  for (const [key, name] of Object.entries(CAMS)) {
    const b = btn('ic', null, `cam-${key}`, () => setEdit(i, { cam: key === 'auto' ? null : key }));
    b.innerHTML = CAM_ICONS[key];
    b.append(el('span', '', breakable(name)));
    b.setAttribute('aria-pressed', String((e.cam ?? 'auto') === key));
    camRow.append(b);
  }
  cam.append(camRow);
  box.append(cam);

  // ③ 文字の大きさ：その行のはじめの2文字を、その大きさで見せる
  const size = block('文字の大きさ', SIZES.find(x => x[0] === (e.size ?? 1))?.[1] ?? `${+(e.size).toFixed(2)}倍`);
  const sizeRow = el('div', 'sizes');
  const sample = chars.filter(c => c.trim()).slice(0, 2).join('') || '字';
  for (const [v, name] of SIZES) {
    const b = btn('sz', null, `size-${v}`, () => setEdit(i, { size: v === 1 ? null : v }));
    const sp = el('span', '', sample);
    sp.style.fontSize = `${Math.round(15 * v)}px`;
    b.append(sp, el('small', '', breakable(name)));
    b.setAttribute('aria-pressed', String((e.size ?? 1) === v));
    b.setAttribute('aria-label', `文字の大きさ：${name}`);
    sizeRow.append(b);
  }
  size.append(sizeRow);
  box.append(size);

  // ④ 板の傾き
  const tilt = block('板の傾き', TILTS[e.tilt ?? 'auto']);
  const tiltRow = el('div', 'icons');
  for (const [key, name] of Object.entries(TILTS)) {
    const b = btn('ic', null, `tilt-${key}`, () => setEdit(i, { tilt: key === 'auto' ? null : key }));
    b.innerHTML = TILT_ICONS[key];
    b.append(el('span', '', breakable(name)));
    b.setAttribute('aria-pressed', String((e.tilt ?? 'auto') === key));
    tiltRow.append(b);
  }
  tilt.append(tiltRow);
  box.append(tilt);

  // ⑥ 位置と回転：画面の行をつまんで動かす・2本指で大きさと回転（パソコンはホイールで大きさ、Shift で回転）。ボタンでも少しずつ
  const mv = e.move ?? [0, 0], rl = e.roll ?? 0;
  const moved = !!(mv[0] || mv[1]);
  const pos = block('位置と回転', moved || rl ? describeEdit({ move: moved ? mv : undefined, roll: rl || undefined }).join('・') : '画面の行をつまんでも動かせます');
  const nudge = el('div', 'icons nudge');
  const step = (dx, dy) => () => setEdit(i, { move: [mv[0] + dx, mv[1] + dy] });
  const turn = d => () => setEdit(i, { roll: rl + d });
  const DEG5 = 5 * Math.PI / 180;
  for (const [key, label, fn] of [['left', '左へ', step(-0.05, 0)], ['up', '上へ', step(0, -0.05)], ['down', '下へ', step(0, 0.05)], ['right', '右へ', step(0.05, 0)], ['rollL', '左へ回す', turn(-DEG5)], ['rollR', '右へ回す', turn(DEG5)]]) {
    const b = btn('ic', null, `nudge-${key}`, fn);
    b.innerHTML = NUDGE_ICONS[key];
    b.append(el('span', '', label));
    nudge.append(b);
  }
  const r1 = btn('ic', null, 'move-reset', () => setEdit(i, { move: null })); r1.innerHTML = NUDGE_ICONS.center; r1.append(el('span', '', '位置を戻す')); r1.disabled = !e.move;
  const r2 = btn('ic', null, 'roll-reset', () => setEdit(i, { roll: null })); r2.innerHTML = NUDGE_ICONS.level; r2.append(el('span', '', '回転を戻す')); r2.disabled = !e.roll;
  nudge.append(r1, r2);
  pos.append(nudge, el('p', 'ed-note', '画面の枠の中をつまんで引っぱると動きます。指2本で広げると大きく、ひねると回ります。パソコンでは画面の上でホイールを回すと大きさ、Shift を押しながらだと回転です。'));
  box.append(pos);

  // ⑤ この行だけもう一案
  const vb = block('この行だけもう一案', '出方・書体・来かたなどを選び直す');
  const vr = el('div', 'variant');
  const v = e.variant ?? 0;
  const more = btn('small', 'この行だけもう一案', 'variant-more', () => setEdit(i, { variant: v + 1 }));
  const back = btn('small', '元の案', 'variant-back', () => setEdit(i, { variant: null }));
  back.disabled = !v;
  const cur = el('span', 'now');
  cur.append(document.createTextNode('いまは '), el('b', '', v ? `案${v + 1}` : '元の案'));
  vr.append(more, back, cur);
  vb.append(vr);
  box.append(vb);

  if (focusKey) {
    // 押したボタンが押せなくなっていたら（元に戻したあとなど）、パネルの最初のボタンへ
    const target = box.querySelector(`[data-focus="${focusKey}"]`);
    (target && !target.disabled ? target : box.querySelector('button:not(:disabled)'))?.focus();
  }
}

// 直した行の一覧。押すとその行へ移って、続けて直せる
function showEdited() {
  const box = $('edited-box');
  box.textContent = '';
  const entries = Object.entries(state.edits.lines).sort((a, b) => Number(a[0]) - Number(b[0]));
  if (!entries.length) box.append(el('p', 'none', 'まだありません。止めた画面で「この行を直す」を選び、行をタップしてください。'));
  else if (state.mood !== 'S') box.append(el('p', 'none', 'いまは「空間に散らす（S）」ではないので、直した行は効いていません。'));
  for (const [k, e] of entries) {
    const i = Number(k);
    const line = state.analysis?.lines?.[i];
    const live = !!line && String(line.text ?? '') === e.text;
    const b = el('button', live ? '' : 'stale');
    b.type = 'button';
    b.append(document.createTextNode(`${i + 1}行目「${e.text}」`), el('span', '', describeEdit(e).join('、') + (live ? '' : '（いまの歌詞にない行なので、効いていません）')));
    b.disabled = !live || !state.script;
    b.addEventListener('click', () => {
      goLine(i);
      $('picker').scrollIntoView({ block: 'nearest', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    });
    box.append(b);
  }
  $('edits-json').value = JSON.stringify(state.edits, null, 2);
  $('edits-undo').disabled = !state.history.length;
}
$('edits-undo').addEventListener('click', undoEdit);
$('edits-clear').addEventListener('click', () => {
  remember();
  state.edits = normalizeEdits(null);
  saveEdits(state.edits);
  if (state.analysis) rebuildScript(); else showEdited();
  say('直した行を全部元に戻しました。');
});
$('edits-copy').addEventListener('click', async () => {
  // 行ごとに、歌詞と直した項目の日本語の名前を付ける
  const names = Object.fromEntries(Object.entries(state.edits.lines).map(([k, e]) => [k, { 歌詞: e.text, 直したもの: describeEdit(e) }]));
  const text = JSON.stringify({ ...state.edits, names }, null, 2);
  try { await navigator.clipboard.writeText(text); say('直したものをコピーしました。'); }
  catch { $('edits-json').select(); say('下の枠を選びました。コピーしてください。'); }
});
showEdited();

// ---- 行を直す：前の行・次の行へ移る／直す前を見比べる／つまむ・2本指・ホイールで位置・大きさ・回転 ----
// 行 j が映る時刻（歌い出しの少しあと）へ移って、その行を直す
function goLine(j) {
  if (!lineLayer(state.script, j)) return;
  const l = state.analysis.lines[j];
  pause();
  setTime(l.start + Math.min(0.6, Math.max(0, l.end - l.start) / 2));
  state.pickAt = now();
  state.cands = [j, ...visibleLines(state.pickAt).map(c => c.line).filter(x => x !== j)];
  state.sel = j;
  state.emphFrom = null;
  if (state.pickMode !== 'edit') { state.pickMode = 'edit'; savePickMode('edit'); }
  showPicker();
  draw();
}

// 指を追いかける（離すまでその要素に届く）。できなくても続ける
const capture = (el, e) => { try { el.setPointerCapture(e.pointerId); } catch { /* 追いかけなくても動く */ } };
// 押している間だけ、その行を直す前の台本で描く
function holdToCompare(b, i) {
  const on = () => {
    if (b.disabled || state.compare) return;
    const lines = { ...state.edits.lines };
    delete lines[i];
    state.compare = buildScript(state.analysis, { ...scriptOpts(), edits: { lines } });
    $('peek-badge').textContent = '直す前の見え方';
    $('peek-badge').hidden = false;
    $('stage').classList.add('peek');
    b.classList.add('holding');
    draw();
  };
  const off = () => {
    if (!state.compare) return;
    state.compare = null;
    $('peek-badge').hidden = true;
    $('peek-badge').textContent = '消したときの見え方';
    $('stage').classList.remove('peek');
    b.classList.remove('holding');
    draw();
  };
  b.addEventListener('pointerdown', e => { capture(b, e); on(); });
  for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture', 'blur']) b.addEventListener(ev, off);
  b.addEventListener('keydown', e => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); on(); } });
  b.addEventListener('keyup', e => { if (e.key === ' ' || e.key === 'Enter') off(); });
  b.addEventListener('contextmenu', e => e.preventDefault()); // 長押しで出る項目の一覧を出さない
}

// つまむ・2本指・ホイールの途中は、台本を作り直さずに今の台本の層を書き換えて見せ、離したら覚える
const clampTo = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
function makeGesture(i) {
  const e = state.edits.lines[i] ?? {};
  const layer = lineLayer(state.script, i)?.layer;
  if (!layer) return null;
  const start = { move: [...(e.move ?? [0, 0])], size: e.size ?? 1, roll: e.roll ?? 0 };
  return { i, start, base: { ...start, move: [...start.move] }, cur: { ...start, move: [...start.move] }, orig: { sizeMul: layer.sizeMul ?? 1, rot: { ...layer.rot } }, moved: false };
}
function previewGesture(g) {
  for (const s of state.script.scenes) for (const l of s.layers) {
    if (l.line !== g.i) continue;
    if (l.part === 'text.motion') {
      l.shift = [...g.cur.move];
      l.sizeMul = g.orig.sizeMul * g.cur.size / g.start.size;
      l.rot = { ...g.orig.rot, roll: (g.orig.rot.roll ?? 0) + g.cur.roll - g.start.roll };
    } else if (l.part === 'fx.prop') l.shift = [...g.cur.move];
  }
  draw();
}
function commitGesture(g) {
  const c = g.cur;
  setEdit(g.i, { move: c.move[0] || c.move[1] ? c.move : null, size: Math.abs(c.size - 1) > 1e-3 ? c.size : null, roll: Math.abs(c.roll) > 1e-3 ? c.roll : null });
}

const editingLine = () => state.pickMode === 'edit' && state.pickAt !== null && state.sel !== null && state.mood === 'S' && !state.playing && !!state.script;
const toCanvas = e => { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) * cv.width / r.width, y: (e.clientY - r.top) * cv.height / r.height, k: cv.width / r.width }; };
const inBox = p => !!state.selHit && Math.hypot(p.x - state.selHit.x, p.y - state.selHit.y) <= state.selHit.r;
const pointers = new Map(); // 画面に触れている指（pointerId → Canvas の画素の位置）
let gesture = null;
const pinchOf = () => { const [a, b] = [...pointers.values()]; return { d: Math.max(1, Math.hypot(b.x - a.x, b.y - a.y)), ang: Math.atan2(b.y - a.y, b.x - a.x) }; };
cv.addEventListener('pointerdown', e => {
  state.dragged = false;
  if (!editingLine()) return;
  const p = toCanvas(e);
  pointers.set(e.pointerId, p);
  if (pointers.size === 1) {
    // 枠の中をつまんだときだけ動かす（枠の外は、今までどおりタップで行を選ぶ）
    gesture = inBox(p) ? makeGesture(state.sel) : null;
    if (gesture) { gesture.x0 = p.x; gesture.y0 = p.y; capture(cv, e); }
  } else if (pointers.size === 2) {
    // 2本目の指：大きさと回転（1本目が枠の外でも使える）
    gesture = gesture ?? makeGesture(state.sel);
    if (!gesture) return;
    gesture.pinch = { ...pinchOf(), size: gesture.cur.size, roll: gesture.cur.roll };
    gesture.moved = true;
    capture(cv, e);
  }
});
cv.addEventListener('pointermove', e => {
  const p = toCanvas(e);
  if (!pointers.has(e.pointerId)) {
    // つまめる所の上では、手の形のカーソル
    cv.style.cursor = editingLine() && inBox(p) ? 'grab' : '';
    return;
  }
  pointers.set(e.pointerId, p);
  const g = gesture;
  if (!g) return;
  if (pointers.size >= 2 && g.pinch) {
    const now2 = pinchOf();
    g.cur.size = clampTo(g.pinch.size * now2.d / g.pinch.d, 0.55, 1.8);
    g.cur.roll = clampTo(g.pinch.roll + now2.ang - g.pinch.ang, -1.2, 1.2);
  } else if (pointers.size === 1) {
    const dx = p.x - g.x0, dy = p.y - g.y0;
    if (!g.moved && Math.hypot(dx, dy) < 6 * p.k) return; // 少し動いただけならタップ
    g.moved = true;
    cv.style.cursor = 'grabbing';
    g.cur.move = [clampTo(g.base.move[0] + dx / (cv.width / 2), -0.8, 0.8), clampTo(g.base.move[1] + dy / (cv.height / 2), -0.8, 0.8)];
  }
  previewGesture(g);
});
function endPointer(e) {
  if (!pointers.delete(e.pointerId)) return;
  const g = gesture;
  if (!g) return;
  if (pointers.size === 1) {
    // 2本指から1本に戻った：残った指の位置から、続けて動かせるように
    const [q] = [...pointers.values()];
    g.pinch = null;
    g.base = { ...g.cur, move: [...g.cur.move] };
    g.x0 = q.x; g.y0 = q.y;
    return;
  }
  if (pointers.size === 0) {
    gesture = null;
    cv.style.cursor = '';
    if (g.moved) { state.dragged = true; commitGesture(g); }
  }
}
for (const ev of ['pointerup', 'pointercancel']) cv.addEventListener(ev, endPointer);

// パソコン：ホイールで大きさ、Shift を押しながらで回転（止めて 0.3 秒たったら覚える）
let wheelG = null, wheelTimer = 0;
cv.addEventListener('wheel', e => {
  if (!editingLine() || !state.selHit) return;
  e.preventDefault();
  if (!wheelG || wheelG.i !== state.sel) wheelG = makeGesture(state.sel);
  if (!wheelG) return;
  const d = e.deltaY || e.deltaX;
  if (e.shiftKey) wheelG.cur.roll = clampTo(wheelG.cur.roll + Math.sign(d) * 3 * Math.PI / 180, -1.2, 1.2);
  else wheelG.cur.size = clampTo(wheelG.cur.size * Math.exp(-d * 0.0015), 0.55, 1.8);
  previewGesture(wheelG);
  clearTimeout(wheelTimer);
  wheelTimer = setTimeout(() => { const g = wheelG; wheelG = null; if (g) commitGesture(g); }, 300);
}, { passive: false });

// ---- 新しい曲で作る（app/make-song.js） ----
const nsAI = { on: aiOnByDefault() }; // iPhone・iPad の Safari では AI が落ちるので「使わない」に（iPhone アプリは whisper.cpp で聞けるので「使う」）
function showNsAI() {
  $('ns-ai').setAttribute('aria-pressed', String(nsAI.on));
  $('ns-ai').textContent = `AI で歌に合わせる：${nsAI.on ? 'オン' : 'オフ'}`;
}
showNsAI();
let nsRunning = false;
const nsReady = () => { $('ns-go').disabled = nsRunning || !$('ns-song').files[0] || !$('ns-lyrics').value.trim(); };
$('ns-song').addEventListener('change', nsReady);
$('ns-lyrics').addEventListener('input', nsReady);
$('ns-ai').addEventListener('click', () => { nsAI.on = !nsAI.on; showNsAI(); });

function showSteps() {
  const ol = $('ns-steps');
  ol.textContent = '';
  for (const st of MAKE_STEPS) {
    const li = document.createElement('li');
    li.id = `ns-st-${st.key}`;
    li.append(st.label);
    const note = document.createElement('i');
    li.append(note);
    ol.append(li);
  }
  ol.hidden = false;
}
// 作るときの記録：段階の出入りと、いま何秒その段階にいるか（ページが本当に止まると、この秒数も止まる）
const nsLog = { t0: 0, lines: [], cur: null, curAt: 0, tick: 0, states: {} };
function logNs(text) {
  // 使っている記憶の量も残す（専用ページで重くなって落ちる場所を調べるため。数えられないブラウザでは出さない）
  const mem = performance.memory ? `・記憶 ${Math.round(performance.memory.usedJSHeapSize / 1048576)}/${Math.round(performance.memory.jsHeapSizeLimit / 1048576)}MB` : '';
  nsLog.lines.push(`${((performance.now() - nsLog.t0) / 1000).toFixed(1)}s ${text}${mem}`);
  $('ns-log').value = nsLog.lines.join(String.fromCharCode(10)); // 1行ずつ
}
function startNsLog() {
  nsLog.t0 = performance.now(); nsLog.lines = []; nsLog.cur = null; nsLog.states = {};
  $('ns-log-box').hidden = false;
  clearInterval(nsLog.tick);
  nsLog.tick = setInterval(() => {
    if (!nsLog.cur) return;
    const label = MAKE_STEPS.find(s => s.key === nsLog.cur)?.label ?? nsLog.cur;
    $('ns-msg').textContent = `いま：${label}（${Math.round((performance.now() - nsLog.curAt) / 1000)} 秒）`;
  }, 500);
}
function stopNsLog() { clearInterval(nsLog.tick); nsLog.cur = null; }
$('ns-log-copy').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText($('ns-log').value); $('ns-log-copy').textContent = 'コピーしました'; }
  catch { $('ns-log').select(); $('ns-log-copy').textContent = '選んだので Ctrl+C でコピー'; }
});
function markStep(key, ratio, note) {
  const st = ratio >= 1 ? 'done' : 'run';
  if (nsLog.states[key] !== st) {
    nsLog.states[key] = st;
    logNs(`${MAKE_STEPS.find(s => s.key === key)?.label ?? key}：${st === 'run' ? '始め' : '終わり'}${note ? `（${note}）` : ''}`);
    if (st === 'run') { nsLog.cur = key; nsLog.curAt = performance.now(); } else if (nsLog.cur === key) nsLog.cur = null;
  }
  const li = $(`ns-st-${key}`);
  if (!li) return;
  li.className = ratio >= 1 ? (note === 'なし' || note === '使わない' ? 'done skip' : 'done') : 'run';
  li.style.setProperty('--r', `${Math.round(Math.min(1, Math.max(0, ratio)) * 100)}%`);
  if (note !== undefined) li.querySelector('i').textContent = note;
}

$('ns-go').addEventListener('click', async () => {
  const file = $('ns-song').files[0];
  const lyrics = $('ns-lyrics').value;
  if (!file || !lyrics.trim() || nsRunning) return;
  nsRunning = true; nsReady();
  pause();
  showSteps();
  startNsLog();
  const msg = $('ns-msg');
  msg.className = 'msg';
  msg.textContent = '作っています。曲の長さによっては数分かかります（AI を使うと長め）。';
  const t0 = performance.now();
  try {
    const { analysis, notes } = await makeSong({ file, lyrics, useAI: nsAI.on, onStep: markStep, onLog: logNs });
    stopNsLog();
    logNs(`できた：${analysis.lines.length} 行・合わせ方 ${analysis.usedFallback ? '代わり' : 'AI'}`);
    state.touched.song = true; state.touched.analysis = true;
    analysisToken++; // 読み込み中の古い解析結果より、いま作ったものを優先する
    applySong(file, true);
    const base = file.name.replace(/\.[^.]+$/, '') || 'song';
    const made = new File([JSON.stringify(analysis)], `${base}-analysis.json`, { type: 'application/json' });
    if (await applyAnalysis(made, true)) {
      const sec = ((performance.now() - t0) / 1000).toFixed(0);
      msg.textContent = `できました（${sec} 秒・${analysis.lines.length} 行）。再生ボタンで見られます。` + (notes.length ? ' ' + notes.join(' ') : '');
      $('view-msg').textContent = msg.textContent; // 見る段に移ったので、そこにも出す
      if (analysis.usedFallback) $('tap-fold').open = true; // 時刻がざっくりのときは、タップで合わせるを開いておく
    }
  } catch (err) {
    stopNsLog();
    logNs(`止まった：${err?.message ?? err}`);
    msg.className = 'msg err';
    msg.textContent = `作れませんでした：${err?.message ?? err}（曲のファイルが読める形か確かめてください）`;
  } finally {
    nsRunning = false; nsReady();
  }
});

$('save-analysis').addEventListener('click', async () => {
  if (!state.analysis) return;
  const name = (state.analysisName || 'lyrivue-analysis.json').replace(/\.json$/i, '') + '.json';
  try {
    const r = await saveBlob(new Blob([JSON.stringify(state.analysis, null, 1)], { type: 'application/json' }), name);
    say(r === 'saved' ? `解析結果を保存しました：${name}` : '保存をやめました。');
  } catch (err) { say('保存できませんでした：' + (err?.message ?? err), true); }
});

// ---- タップで合わせる（analyze/retime.js） ----
const tap = { on: false, taps: [], idx: 0 };
const tapLines = () => state.analysis?.lines ?? [];
function showTap() {
  const lines = tapLines();
  const cur = lines[tap.idx];
  $('tap-now').textContent = cur ? cur.text : '最後の行まで押しました。「ここまでで合わせる」を押してください。';
  $('tap-next').textContent = lines[tap.idx + 1] ? `つぎ：${lines[tap.idx + 1].text}` : '';
  $('tap-count').textContent = `${Math.min(tap.idx + 1, lines.length)} / ${lines.length} 行目`;
  $('tap-hit').disabled = !cur;
  $('tap-undo').disabled = tap.taps.length === 0;
  $('tap-done').disabled = tap.taps.length === 0;
}
function fillTapFrom() {
  const sel = $('tap-from');
  sel.textContent = '';
  tapLines().forEach((l, i) => {
    const o = document.createElement('option');
    o.value = String(i);
    o.textContent = `${i + 1}. ${String(l.text).slice(0, 18)}（${fmt(l.start)}）`;
    sel.append(o);
  });
}
function tapFrom(i) {
  const lines = tapLines();
  tap.idx = Math.min(Math.max(0, i), Math.max(0, lines.length - 1));
  tap.taps = [];
  $('tap-from').value = String(tap.idx);
  // 1つ前の行の頭から流す（最初の行なら曲の頭から）
  setTime(tap.idx > 0 ? Math.max(0, lines[tap.idx - 1].start) : 0);
  showTap();
  play();
}
$('tap-start').addEventListener('click', () => {
  if (!state.analysis) return;
  if (!state.hasSong) { say('タップで合わせるには、曲を読み込んでください（音を聞きながら押すため）。', true); return; }
  tap.on = true;
  $('tap-box').hidden = false;
  $('tap-start').hidden = true;
  fillTapFrom();
  // AI の時刻なら一部分だけ直すことが多いので、いま見ている所の行から（ざっくりの時刻なら最初の行から）
  const t0 = now();
  const here = state.analysis.usedFallback ? 0 : Math.max(0, tapLines().findLastIndex(l => l.start <= t0));
  tapFrom(here);
  $('tap-hit').focus();
});
$('tap-from').addEventListener('change', e => tapFrom(Number(e.target.value)));
function tapHit(e) {
  if (!tap.on || !tapLines()[tap.idx]) return;
  const was = state.playing;
  if (!was) play();
  // 押した瞬間の曲の位置（処理が遅れて届いても、合図の時刻まで戻す。analyze/retime.js の tapMoment）
  const time = was ? tapMoment({ playhead: now(), nowMs: performance.now(), eventMs: e?.timeStamp, prev: tap.taps.at(-1)?.time }) : now();
  tap.taps.push({ line: tap.idx, time });
  tap.idx++;
  const b = $('tap-hit');
  b.classList.remove('hit'); void b.offsetWidth; b.classList.add('hit'); // 押したことが見えるように、輪を広げる
  showTap();
}
// 指を置いた瞬間に数える（離すまで待つと、その分遅れる）
$('tap-hit').addEventListener('pointerdown', e => { e.preventDefault(); tapHit(e); });
$('tap-hit').addEventListener('keydown', e => { if ((e.key === 'Enter') && !e.repeat) { e.preventDefault(); tapHit(e); } });
$('tap-undo').addEventListener('click', () => {
  const last = tap.taps.pop();
  if (!last) return;
  tap.idx = last.line;
  setTime(Math.max(0, last.time - 3)); // 戻した行の少し前から聞き直す
  showTap();
});
function closeTap() {
  tap.on = false; tap.taps = [];
  $('tap-box').hidden = true;
  $('tap-start').hidden = false;
}
$('tap-cancel').addEventListener('click', () => { pause(); closeTap(); });
$('tap-done').addEventListener('click', async () => {
  pause();
  const n = tap.taps.length;
  const fixed = retimeLines(state.analysis, tap.taps);
  closeTap();
  const name = (state.analysisName || 'analysis.json').replace(/(-tapped)?\.json$/i, '') + '-tapped.json';
  const keepTouched = state.touched.analysis;
  state.touched.analysis = true;
  if (await applyAnalysis(new File([JSON.stringify(fixed)], name, { type: 'application/json' }), true)) {
    const msg = `${n} 行の時刻を、タップに合わせました${fixed?.usedFallback ? '' : '（ほかの行はそのまま）'}。再生して確かめてください。`;
    say(msg);
    $('view-msg').textContent = msg;
  } else state.touched.analysis = keepTouched;
});

// ---- 動画にする（export/） ----
const ex = { aspect: 'portrait', quality: 1080, ctrl: null };
function showEx() {
  $('ex-portrait').setAttribute('aria-pressed', String(ex.aspect === 'portrait'));
  $('ex-landscape').setAttribute('aria-pressed', String(ex.aspect === 'landscape'));
  $('ex-1080').setAttribute('aria-pressed', String(ex.quality === 1080));
  $('ex-720').setAttribute('aria-pressed', String(ex.quality === 720));
}
$('ex-portrait').addEventListener('click', () => { ex.aspect = 'portrait'; showEx(); });
$('ex-landscape').addEventListener('click', () => { ex.aspect = 'landscape'; showEx(); });
$('ex-1080').addEventListener('click', () => { ex.quality = 1080; showEx(); });
$('ex-720').addEventListener('click', () => { ex.quality = 720; showEx(); });
showEx();

// 書き出し用の「ぶれを重ねる画面」（見ている画面のものとは別にして、大きさを行き来させない）
let exScratch = null;
const makeExportCanvas = (w, h) => {
  if (!exScratch) { const c = document.createElement('canvas'); exScratch = { canvas: c, ctx: c.getContext('2d') }; }
  if (exScratch.canvas.width !== w) exScratch.canvas.width = w;
  if (exScratch.canvas.height !== h) exScratch.canvas.height = h;
  return exScratch;
};

$('ex-stop').addEventListener('click', () => ex.ctrl?.abort());
$('ex-go').addEventListener('click', async () => {
  if (!state.script || state.exporting) return;
  pause(); closePicker();
  // 録画になったときのための音の仕組みは、押した瞬間（待つ前）に作って動かしておく（iPhone の Safari はそうしないと鳴らない）
  const AC = window.AudioContext || window.webkitAudioContext;
  let liveAC = null;
  try { if (state.hasSong && AC && canRecord()) { liveAC = new AC(); liveAC.resume().catch(() => {}); } } catch { liveAC = null; }
  const script = state.script, analysis = state.analysis; // 書き出し中に台本を変えても、押したときの MV で作る
  const plan = exportPlan({ aspect: ex.aspect, quality: ex.quality, duration: duration() });
  const msg = $('ex-msg');
  const bar = $('ex-bar').firstElementChild;
  msg.className = 'msg';
  if (plan.frames === 0) { liveAC?.close?.().catch(() => {}); msg.textContent = '長さが 0 秒なので、動画にできません。'; return; }
  state.exporting = true;
  ex.ctrl = new AbortController();
  $('ex-go').disabled = true; $('ex-stop').hidden = false; $('ex-bar').hidden = false; bar.style.width = '0';
  msg.textContent = '準備しています（書体と曲を読んでいます）…';
  try {
    await prepareFonts();
    const sound = state.hasSong ? await decodeForExport(state.songFile) : null;
    const mode = exportMode({ encode: await canEncode(plan), audioEncode: await canEncodeAudio(sound), record: canRecord(), hasSound: !!sound });
    if (!mode) throw new Error('このブラウザには、動画を作る機能がありません（パソコンの Chrome・Edge・Safari で試してください）');
    const encode = mode === 'encode';
    // 音を詰められない端末では、音を入れるために再生しながら録画する（曲と同じ時間かかる）
    if (!encode && sound) msg.textContent = 'この端末は音を 1 コマずつ詰められないので、再生しながら録画します（曲と同じ時間かかります。画面を消さずに待ってください）…';
    const draw = (c, t, size) => renderFrameMotion(c, script, analysis, t, size, { makeCanvas: makeExportCanvas });
    const t0 = performance.now();
    const onProgress = (done, total) => {
      bar.style.width = `${(done / total * 100).toFixed(1)}%`;
      const el = (performance.now() - t0) / 1000;
      const left = done > 10 ? el / done * (total - done) : NaN;
      msg.textContent = `${encode ? '1コマずつ描いています' : '再生しながら録画しています'}：${done} / ${total} コマ` + (Number.isFinite(left) ? `・残り 約 ${left >= 90 ? Math.ceil(left / 60) + ' 分' : Math.ceil(left) + ' 秒'}` : '');
    };
    const opts = { plan, draw, audio: sound, onProgress, signal: ex.ctrl.signal, ac: liveAC };
    const out = encode ? await encodeVideo(opts) : await recordVideo(opts);
    const name = exportFileName(state.hasSong ? state.songFile?.name : (state.analysisName || 'demo'), plan.aspect, out.ext);
    const mb = (out.blob.size / 1048576).toFixed(1);
    msg.textContent = `できました（${plan.width}×${plan.height}・${fmt(plan.frames / plan.fps)}・${mb} MB・${out.audio ? '音あり' : '音なし'}）。保存しています…`;
    const r = await saveBlob(out.blob, name);
    msg.textContent = r === 'saved'
      ? `保存しました：${name}（${plan.width}×${plan.height}・${mb} MB・${out.audio ? '音あり' : '音なし'}）` + (!out.audio && state.hasSong ? `。この端末では曲の音を入れられませんでした（${sound ? (encode ? '音を詰める部品が無い' : '録画で音を鳴らせない') : '曲を読めない'}）` : '')
      : '保存をやめました。もう一度「動画にする」を押すと作り直します。';
  } catch (err) {
    if (err?.name === 'AbortError') { msg.textContent = '書き出しをやめました。'; }
    else { msg.className = 'msg err'; msg.textContent = '動画にできませんでした：' + (err?.message ?? err); }
  } finally {
    state.exporting = false;
    ex.ctrl = null;
    if (liveAC && liveAC.state !== 'closed') liveAC.close().catch(() => {});
    $('ex-go').disabled = !state.script; $('ex-stop').hidden = true;
    draw();
  }
});

// ---- 3 段の画面：1 曲と歌詞 → 2 見る → 3 動画にする（一度に 1 つの段だけ出す） ----
const STEP_FILL = { 1: '0%', 2: '50%', 3: '100%' };
function goStep(n) {
  const leg = document.querySelector(`.leg[data-step="${n}"]`);
  if (!leg || (n > 1 && !state.script)) return;
  if (n !== 2) { pause(); closePicker(); }
  for (const el of document.querySelectorAll('.leg')) el.hidden = el !== leg;
  for (const b of $('route').querySelectorAll('button')) {
    const k = Number(b.dataset.step);
    if (k === n) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
    b.classList.toggle('done', k < n);
  }
  $('route').style.setProperty('--p', STEP_FILL[n]);
  if (n === 2) draw(); // 隠れていた画面の大きさを測り直して描く
  if (n === 3) {
    // 動画の向きは、見ていた向きから始める（変えてもよい）
    ex.aspect = $('stage').dataset.aspect === 'landscape' ? 'landscape' : 'portrait';
    showEx();
    const title = (state.hasSong ? state.songFile?.name : state.analysisName || 'デモ').replace(/(-analysis)?\.[^.]+$/i, '');
    $('ex-what').innerHTML = '';
    $('ex-what').append(title, Object.assign(document.createElement('small'), { textContent: `${Math.floor(Math.round(duration()) / 60)} 分 ${String(Math.round(duration()) % 60).padStart(2, '0')} 秒の MV（案 ${state.seed}）` }));
  }
  // 段の頭が画面の上に隠れていたら、そこまで戻す
  if ($('route').getBoundingClientRect().top < 0) $('route').scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
}
for (const b of $('route').querySelectorAll('button')) b.addEventListener('click', () => goStep(Number(b.dataset.step)));
for (const b of document.querySelectorAll('[data-go]')) b.addEventListener('click', () => goStep(Number(b.dataset.go)));

// 作る側の道具は、開いたかどうかを覚える（持ち主は開いたまま使う）
try { $('tools').open = localStorage.getItem('lyrivue-tools') === 'open'; } catch { /* 覚えなくても動く */ }
$('tools').addEventListener('toggle', () => { try { localStorage.setItem('lyrivue-tools', $('tools').open ? 'open' : 'closed'); } catch { /* 覚えなくても動く */ } });
