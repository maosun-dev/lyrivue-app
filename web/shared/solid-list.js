// 立体物の種類の一覧（台本係が間奏に散らす種類を選ぶのに読む）。描く係の render/parts/solid3d.js の SOLID_KINDS と同じ並び
// （台本係と描く係はたがいの中身を import しないので、ここに写しを置く。tests/render-interlude.test.mjs で同じか確かめる）
export const SOLID_LIST = Object.freeze(['cube', 'octa', 'tetra', 'icosa', 'prism', 'crystal', 'slab', 'sphere', 'planet']);
