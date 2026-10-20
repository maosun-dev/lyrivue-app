// 連想の小物（fx.prop）の形の一覧。種類の名前 → (A) => 形。名前と言葉の対応は director/props.js にある（試験で一致を確かめる）
import { TIME_SKY } from './time-sky.js';
import { CITY } from './city.js';
import { HOME } from './home.js';
import { NATURE } from './nature.js';
import { LIFE } from './life.js';
import { MISC } from './misc.js';

export const SHAPES = Object.freeze({ ...TIME_SKY, ...CITY, ...HOME, ...NATURE, ...LIFE, ...MISC });
