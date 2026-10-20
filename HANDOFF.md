# Lyrivue iPhone アプリ（lyrivue-app）

ウェブ版 Lyrivue（となりのフォルダ ../Lyrivue、3 段の画面 app/play-check.html）を、Capacitor（ウェブのページを iPhone アプリに包む道具）で包んだもの。
いまは「iPhone アプリとして動くか」の試し（広告・課金なし）。

- このリポジトリに入れるのは「画面の写し（web/）」「中に入れた書体（fonts/）」「iPhone の包み」だけ。持ち主の曲・解析結果・開発の記録は入れない
- 背番号（バンドルID）：`com.maosundev.lyrivue`（変えられない）
- 置き場：GitHub `maosun-dev/lyrivue-app`（作っている間は公開。ストアに出たら非公開にする）

## 作り方
1. ../Lyrivue で直してコミット
2. ここで `npm run pull-web`（web/ に写す。web/SOURCE.txt に元のコミットが残る）
3. 書体が変わったときだけ `node tools/fetch-fonts.mjs`
4. `npm test` → `npm run sync`（www/ を作って ios に入れる）→ コミットして push
5. `gh workflow run ios-testflight.yml --repo maosun-dev/lyrivue-app`（GitHub の Mac で組み立てて TestFlight へ）

## アプリだけの違い（tools/build-www.mjs・js/app-native.css・js/app-native.js）
- Google Fonts → 中に入れた書体（fonts/）。辞書（kuromoji）と動画の部品（mp4-muxer）も中に入れる（電波なしで動く）
- AI の歌合わせは使わない（iPhone では落ちる）。新しい曲はざっくりの時刻＋タップで合わせる
- 作る側の道具・いつもの曲は隠す
- 動画の保存は iPhone の「共有」の画面（「ビデオを保存」で写真へ）
