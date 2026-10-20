// 確認ページ用：選んだファイル（曲・解析結果）をブラウザの中（IndexedDB）に覚えておき、次に開いたとき自動で読み込む。
// ファイルは外へ出ない。使えない環境（プライベートウィンドウなど）では何もせず、黙って失敗する。
const DB_NAME = 'lyrivue-play-check';
const STORE = 'files';

function open() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('IndexedDB が他のタブで使われています'));
  });
}

function run(mode, fn) {
  return open().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const out = fn(tx.objectStore(STORE));
    tx.oncomplete = () => { db.close(); resolve(out?.result); };
    tx.onerror = () => { db.close(); reject(tx.error); };
    tx.onabort = () => { db.close(); reject(tx.error ?? new Error('保存が中止されました')); }; // 容量の上限など
  }));
}

/** ファイルを key で覚える（失敗しても例外は投げない） */
export async function saveFile(key, file) {
  try { await run('readwrite', s => s.put({ blob: file, name: file.name, type: file.type }, key)); } catch { /* 覚えられなくても動く */ }
}

/** 覚えたファイルを返す。無い・読めないときは null */
export async function loadFile(key) {
  try {
    const rec = await run('readonly', s => s.get(key));
    if (!rec?.blob) return null;
    return new File([rec.blob], rec.name || key, { type: rec.type || rec.blob.type });
  } catch { return null; }
}

/** 覚えたファイルをすべて消す */
export async function forgetAll() {
  try { await run('readwrite', s => s.clear()); } catch { /* 何もしない */ }
}
