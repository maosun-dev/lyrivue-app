// 飾り（雰囲気 S）：画面に重ねる一般の飾り。言葉の演出が無い場面の景色の変化に使う。
// layer.kind：focus（集中線。拍でちらつく）・brackets（四隅の括弧と目盛り）・wave（下の波形）・halftone（隅の網点）
import { hash01 } from '../rand.js';
import { clamp01 } from '../timing.js';

const FADE = 0.6;

export function fxDeco(ctx, t, layer, scene, env) {
  const { width: w, height: h } = env;
  if (!(w > 0 && h > 0)) return;
  const life = clamp01((t - layer.from) / FADE) * clamp01((layer.to - t) / FADE);
  if (!(life > 0)) return;
  const light = env.ink ? env.ink.light : env.tone === 'paper';
  const fg = env.ink?.fg ?? (light ? '#101010' : '#F4F4F4');
  const short = Math.min(w, h);
  const intensity = clamp01(env.intensity);
  const beatK = env.beat?.index >= 0 ? 1 - env.beat.phase : 0;
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = fg;
  ctx.strokeStyle = fg;
  switch (layer.kind) {
    case 'focus': { // 画面の外から中心へ向かう細い三角の線。1/12 秒ごとに並びが変わる
      const step = Math.floor(t * 12);
      const n = env.lite ? 28 : 56;
      const R = Math.hypot(w, h) / 2;
      for (let i = 0; i < n; i++) {
        const ang = (i / n) * Math.PI * 2 + hash01(step, i, 1) * 0.08;
        const inner = R * (0.55 + 0.3 * hash01(step, i, 2));
        const half = 0.004 + 0.01 * hash01(step, i, 3);
        ctx.globalAlpha = life * (0.12 + 0.35 * intensity * beatK) * (0.4 + 0.6 * hash01(step, i, 4));
        ctx.beginPath();
        ctx.moveTo(w / 2 + Math.cos(ang) * inner, h / 2 + Math.sin(ang) * inner);
        ctx.lineTo(w / 2 + Math.cos(ang - half) * R * 1.1, h / 2 + Math.sin(ang - half) * R * 1.1);
        ctx.lineTo(w / 2 + Math.cos(ang + half) * R * 1.1, h / 2 + Math.sin(ang + half) * R * 1.1);
        ctx.closePath();
        ctx.fill();
      }
      return;
    }
    case 'brackets': { // 四隅の L 字（拍で少し内へ寄る）と、上下の短い目盛り
      const m = short * (0.06 - 0.012 * beatK);
      const L = short * 0.09;
      ctx.globalAlpha = life * 0.75;
      ctx.lineWidth = Math.max(1, short * 0.004);
      const corner = (x, y, sx, sy) => { ctx.beginPath(); ctx.moveTo(x + sx * L, y); ctx.lineTo(x, y); ctx.lineTo(x, y + sy * L); ctx.stroke(); };
      corner(m, m, 1, 1); corner(w - m, m, -1, 1); corner(m, h - m, 1, -1); corner(w - m, h - m, -1, -1);
      ctx.globalAlpha = life * 0.4;
      ctx.lineWidth = Math.max(0.5, short * 0.002);
      const ticks = 24;
      for (let i = 1; i < ticks; i++) {
        const x = m + (w - 2 * m) * i / ticks;
        const len = short * (i % 6 === 0 ? 0.02 : 0.008);
        ctx.beginPath(); ctx.moveTo(x, m); ctx.lineTo(x, m + len); ctx.moveTo(x, h - m); ctx.lineTo(x, h - m - len); ctx.stroke();
      }
      return;
    }
    case 'wave': { // 画面の下に、いまの音の波形を上下対称に
      const wf = Array.isArray(env.waveform) ? env.waveform : [];
      const rate = env.waveformRate > 0 ? env.waveformRate : 30;
      const n = 64;
      const base = h * 0.9;
      const amp = h * 0.06;
      ctx.globalAlpha = life * 0.55;
      ctx.lineWidth = Math.max(1, short * 0.003);
      for (const sgn of [-1, 1]) {
        ctx.beginPath();
        for (let i = 0; i <= n; i++) {
          const idx = Math.floor((t - 1 + (2 * i) / n) * rate);
          const v = Number.isFinite(wf[idx]) ? Math.min(1, Math.max(0, wf[idx])) : 0;
          const x = w * 0.08 + (w * 0.84 * i) / n;
          const y = base + sgn * v * amp * (0.6 + 0.4 * Math.sin(i * 0.9 + t * 8));
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      return;
    }
    case 'halftone': { // 右下の隅から広がる網点（ゆっくり流れる）
      const g = short * 0.035;
      const cols = Math.ceil(w / g) + 1, rows = Math.ceil(h / g) + 1;
      const off = (t * 0.05 * g) % g;
      ctx.globalAlpha = life * (light ? 0.18 : 0.22);
      ctx.beginPath();
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const x = c * g - off, y = r * g + (c % 2) * g / 2;
          const d = Math.hypot(w - x, h - y) / Math.hypot(w, h); // 右下に近いほど大きい点
          const rad = g * 0.45 * clamp01(1 - d * 1.6);
          if (rad < 0.4) continue;
          ctx.moveTo(x + rad, y);
          ctx.arc(x, y, rad, 0, Math.PI * 2);
        }
      }
      ctx.fill();
      return;
    }
    default:
  }
}
