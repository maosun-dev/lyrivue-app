// 台本の型定義（JSDoc のみ。実行時には何もしない）。時刻はすべて秒。

/**
 * 1つの部品の出番。
 * - part：部品の名前（bg.* / text.* / fx.*）
 * - from・to：出番の時刻。bg・fx は場面全体、text はその行の間（D は行が終わったあとも、調整値 keepLines の行数あとの行が始まるまで奥に残す）
 * - line：text のとき、AnalysisResult.lines の何番目か
 * - on：fx のとき、何に合わせて動くか（今は 'beat' のみ）
 * 以下は雰囲気 D の text.motion のとき：
 * - pos：世界での置き場所 [x, y, z]（画面の短辺 = 1。z は奥が +）、roll：行の傾き（ラジアン）
 * - emph：強調する語の [開始位置, 長さ]（無ければ省く）、typeSec：打ち込みにかける秒数
 * - sizeMul：行ごとの大きさの倍率（0.8〜1.5）、skew：斜体のゆがみ（±0.2。無ければ 0）
 * @typedef {{part:string, from:number, to:number, line?:number, on?:'beat', pos?:[number,number,number], roll?:number, emph?:[number,number], typeSec?:number, sizeMul?:number, skew?:number, near?:boolean, enter?:string, look?:string, hold?:string, kind?:string, sides?:number}} Layer
 */
/**
 * 1つの場面（解析結果の区切り1つ分。前奏だけ section が空）
 * - mood：雰囲気のまとまり（'B' 跳ねる／'D' 重ねる）
 * - intensity：動きの強さ（0〜1。D は曲の中で最小 0・最大 1 に引き伸ばした値）
 * - tone：D の地の色（'paper' 白地・'ink' 黒地）。B には無い
 * @typedef {{section:string, start:number, end:number, mood:'B'|'D', intensity:number, tone?:'paper'|'ink', layers:Layer[]}} Scene
 */
/**
 * カメラのキー。t の増える順に並べる。ease は、前のキーからこのキーへ動くときの緩急
 * （'linear' | 'outCubic' | 'inOutCubic' | 'outExpo' | 'rush' | 'cut'。rush は sharp で鋭さを持つ。via: true は通り過ぎる中継点）
 * @typedef {{t:number, pos:[number,number,number], roll:number, zoom:number, ease?:string}} CameraKey
 */
/**
 * 曲を通して1つの見た目。colors は [強調色, 明るい色, 暗い色]
 * @typedef {{colors:[string,string,string], font:string}} Style
 */
/**
 * 台本。同じ解析結果と同じ seed からは、必ず同じ台本ができる。
 * 版 1 は雰囲気 B（camera なし）、版 2 は雰囲気 D（曲全体で1本のカメラ camera.keys と、調整値 tuning を持つ）
 * @typedef {{version:1|2, seed:number, style:Style, tuning?:Object<string,number>, camera?:{keys:CameraKey[]}, scenes:Scene[]}} Script
 */

export {};
