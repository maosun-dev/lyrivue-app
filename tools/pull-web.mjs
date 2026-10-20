// ウェブ版 Lyrivue（となりのフォルダ ../Lyrivue）から、アプリに入れるファイルを web/ に写す。
// 写すのは確認ページ（app/play-check.html）と、それが読む JS（台本係・描く係・共通・解析・書き出し）だけ。
// 持ち主の曲・解析結果・開発の記録・試験は写さない。web/SOURCE.txt に元の版（コミット）を残す。
// 使い方: npm run pull-web
import { copyFileSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const here = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = process.env.LYRIVUE_DIR || join(here, '..', 'Lyrivue');
const out = join(here, 'web');

// 画面と、画面が読む部品（AI の部品 whisper-worker.js は、アプリでは使わないので写さない）
const APP_FILES = ['app/play-check.html', 'app/play-check.js', 'app/demo-analysis.js', 'app/store.js', 'app/edit-icons.js',
  'app/make-song.js', 'app/song-set.js', 'app/themes.js', 'app/flood-jump.js', 'app/japanese-worker.js', 'app/shims/kuromoji.js'];
const DIRS = ['director', 'render', 'shared', 'analyze', 'export'];

rmSync(out, { recursive: true, force: true });
const put = rel => {
  mkdirSync(dirname(join(out, rel)), { recursive: true });
  copyFileSync(join(src, rel), join(out, rel));
};
for (const f of APP_FILES) put(f);
let n = APP_FILES.length;
const walk = dir => {
  for (const name of readdirSync(join(src, dir))) {
    const rel = join(dir, name);
    if (statSync(join(src, rel)).isDirectory()) walk(rel);
    else if (name.endsWith('.js')) { put(rel); n++; }
  }
};
for (const d of DIRS) walk(d);

const commit = execFileSync('git', ['-C', src, 'log', '-1', '--format=%h %s'], { encoding: 'utf8' }).trim();
writeFileSync(join(out, 'SOURCE.txt'), `../Lyrivue のコミット ${commit} から写した（${n} ファイル）\n`);
console.log(`web/ に ${n} ファイルを写しました（${commit}）`);
