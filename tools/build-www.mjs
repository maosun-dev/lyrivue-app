// iPhone アプリ（Capacitor）用の www/ を、web/（ウェブ版 Lyrivue の写し。npm run pull-web で作る）から作る。
// 画面の中身は変えない。読み込み先を「アプリの中」に直し、アプリだけの見た目（app/app-native.css）と保存の差し替え（js/app-native.js）を足す。
// 使い方: npm run build
import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = join(dirname(fileURLToPath(import.meta.url)), '..');

// Capacitor の部品（ブラウザ側）。読み込む順番どおりに並べる
const CAP = [
  ['capacitor.js', '@capacitor/core/dist/capacitor.js'],
  ['synapse.js', null],   // Filesystem の手伝い役（下で作る）
  ['filesystem.js', '@capacitor/filesystem/dist/plugin.js'],
  ['share.js', '@capacitor/share/dist/plugin.js'],
];

/** ウェブ版の確認ページの HTML を、アプリの中だけで動く形に直す */
export function appHtml(html) {
  let h = html
    .replace(/<script>[^<]*location\.protocol === 'file:'[^<]*<\/script>\s*/g, '') // サーバーへ移る・警告を出す部分
    .replace(/<p class="msg err" id="filewarn"[\s\S]*?<\/p>\s*/, '')
    .replace('src="./play-check.js"', 'src="app/play-check.js"')
    // 外の部品は、アプリの中に入れた写し（vendor/）を読む。AI（transformers）はアプリでは使わないので外す
    .replace(/\s*"@huggingface\/transformers": "[^"]*",?/, '')
    .replace('"./shims/kuromoji.js"', '"./app/shims/kuromoji.js"')
    .replace('"../node_modules/kuromoji/build/"', '"./vendor/kuromoji/build/"')
    .replace('"../node_modules/kuromoji/dict/"', '"./vendor/kuromoji/dict/"')
    .replace('"../node_modules/mp4-muxer/build/mp4-muxer.mjs"', '"./vendor/mp4-muxer.mjs"')
    // 書体：Google Fonts の代わりに、中に入れた書体（fonts/、tools/fetch-fonts.mjs で作る）
    .replace(/<link rel="preconnect" href="https:\/\/fonts\.googleapis\.com">\s*<link rel="preconnect" href="https:\/\/fonts\.gstatic\.com" crossorigin>\s*<link href="https:\/\/fonts\.googleapis\.com\/css2[^"]+" rel="stylesheet">/, '<link rel="stylesheet" href="fonts/fonts.css">');
  const tags = ['<link rel="stylesheet" href="app/app-native.css">', ...CAP.map(([f]) => `<script src="js/vendor/${f}"></script>`), '<script src="js/app-native.js"></script>'];
  if (h.split('</head>').length !== 2) throw new Error('play-check.html の </head> が 1 か所ではありません');
  h = h.replace('</head>', tags.join('\n') + '\n</head>');
  // 書き換えに失敗していないか（外への読み込み・手元の node_modules・file: が残っていたら止める）
  if (/<(script|link)[^>]+(src|href)="https?:\/\//i.test(h)) throw new Error('外部の読み込みが残っています');
  if (/"\.\.\/node_modules|"@huggingface\/transformers"|location\.protocol|fonts\.googleapis/.test(h)) throw new Error('書き換えに失敗しました：play-check.html の形が変わっていないか確かめてください');
  if (!h.includes('src="app/play-check.js"') || !h.includes('"./vendor/mp4-muxer.mjs"') || !h.includes('fonts/fonts.css')) throw new Error('書き換えに失敗しました（読み込み先）');
  return h;
}

export function buildWww({ root = here, out = join(here, 'www') } = {}) {
  const web = join(root, 'web');
  if (!existsSync(join(web, 'app/play-check.html'))) throw new Error('web/ がありません。npm run pull-web を先に');
  if (!existsSync(join(root, 'fonts/fonts.css'))) throw new Error('fonts/fonts.css がありません。node tools/fetch-fonts.mjs を先に');
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  // 画面の部品（HTML は下で作り直すので写さない）
  for (const name of readdirSync(web)) {
    if (name === 'SOURCE.txt') continue;
    cpSync(join(web, name), join(out, name), { recursive: true, filter: s => !s.endsWith('play-check.html') });
  }
  writeFileSync(join(out, 'index.html'), appHtml(readFileSync(join(web, 'app/play-check.html'), 'utf8')));
  copyFileSync(join(root, 'js/app-native.css'), join(out, 'app/app-native.css'));
  // 外の部品の写し（辞書は 12 個の .dat.gz）
  const nm = join(root, 'node_modules');
  mkdirSync(join(out, 'vendor/kuromoji/build'), { recursive: true });
  copyFileSync(join(nm, 'kuromoji/build/kuromoji.js'), join(out, 'vendor/kuromoji/build/kuromoji.js'));
  cpSync(join(nm, 'kuromoji/dict'), join(out, 'vendor/kuromoji/dict'), { recursive: true });
  copyFileSync(join(nm, 'mp4-muxer/build/mp4-muxer.mjs'), join(out, 'vendor/mp4-muxer.mjs'));
  cpSync(join(root, 'fonts'), join(out, 'fonts'), { recursive: true });
  // Capacitor
  mkdirSync(join(out, 'js/vendor'), { recursive: true });
  for (const [to, from] of CAP) if (from) copyFileSync(join(nm, from), join(out, 'js/vendor', to));
  // Filesystem の部品は手伝い役を "synapse" という名前で探す
  writeFileSync(join(out, 'js/vendor/synapse.js'),
    readFileSync(join(nm, '@capacitor/synapse/dist/synapse.js'), 'utf8') + '\nwindow.synapse = window.outsystemsSynapse;\n');
  copyFileSync(join(root, 'js/app-native.js'), join(out, 'js/app-native.js'));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  buildWww();
  console.log('www/ を作りました');
}
