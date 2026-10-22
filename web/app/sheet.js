// 下から出る板（2026-10-22 画面の作り直し。止めた画面の操作・使う世界・場所の世界で使い回す）。
// 板は class="sheet" の要素。上に class="grab" の取っ手があれば、下へ引いて閉じられる。Esc でも閉じる。
// onSheetClose の fn は「使う人が閉じた（引いた・Esc）」ときだけ呼ぶ。closeSheet で閉じたときは呼ばない（閉じる側が後片付けをする）
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const closers = new WeakMap();
const opened = [];

export function openSheet(el) {
  if (opened.includes(el)) return;
  opened.push(el);
  el.hidden = false;
  el.style.transform = '';
  el.getBoundingClientRect(); // 下に置いた位置をその場で決めてから上げる（描画を待つと、描画の止まりがちな端末で開かないことがある）
  el.classList.add('open');
}

export function closeSheet(el) {
  const i = opened.indexOf(el);
  if (i < 0) { el.hidden = true; return; }
  opened.splice(i, 1);
  el.classList.remove('open');
  el.style.transform = '';
  if (reduced()) { el.hidden = true; return; }
  setTimeout(() => { if (!opened.includes(el)) el.hidden = true; }, 250);
}

export function onSheetClose(el, fn) {
  closers.set(el, fn);
  const grab = el.querySelector('.grab');
  if (!grab) return;
  // 取っ手を下へ 60px 以上引いたら閉じる。足りなければ元へ戻す
  let y0 = null;
  grab.addEventListener('pointerdown', e => { y0 = e.clientY; grab.setPointerCapture(e.pointerId); el.style.transition = 'none'; });
  grab.addEventListener('pointermove', e => { if (y0 !== null) el.style.transform = `translateY(${Math.max(0, e.clientY - y0)}px)`; });
  const end = e => {
    if (y0 === null) return;
    const dy = e.clientY - y0;
    y0 = null;
    el.style.transition = '';
    if (dy > 60) userClose(el); else el.style.transform = '';
  };
  grab.addEventListener('pointerup', end);
  grab.addEventListener('pointercancel', end);
}

function userClose(el) {
  closeSheet(el);
  closers.get(el)?.();
}

document.addEventListener('keydown', e => {
  if (e.key !== 'Escape' || !opened.length) return;
  userClose(opened.at(-1));
});
