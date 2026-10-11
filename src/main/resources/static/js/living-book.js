/* Living Book scroll engine: one number (scroll progress 0..1) drives the whole scene. */
(() => {
  'use strict';
  const W = 520, H = 640;                       // keep in sync with --W / --H in living-book.css
  const root = document.documentElement;
  const $ = id => document.getElementById(id);
  const track = $('track'), stage = $('stage'), camEl = $('cam'), book = $('book');
  const hint = $('hint'), left = $('left'), right = $('right'), dust = $('dust');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const mq = matchMedia('(max-width: 860px), (max-height: 560px), (prefers-reduced-motion: reduce)');
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const seg = (x, a, b) => clamp((x - a) / (b - a));
  const ease = x => x * x * (3 - 2 * x);
  const STOPS = [0.77, 0.865, 0.96];            // scroll positions that rest on each chapter

  let flat = false, fit = 1, span = 1, cur = 0, last = -1, chapter = 0, raf = 0, live = null, wantFocus = false;

  function setChapter(i) {
    if (i === chapter) return;
    chapter = i;
    dispatchEvent(new CustomEvent('chapter', { detail: i }));
  }

  function focusNav() {
    const b = document.querySelector('#nav button[aria-current="page"]') || document.querySelector('#nav button');
    if (b) b.focus({ preventScroll: true });
  }

  function measure() {
    fit = clamp(Math.min((innerWidth - 32) / (2 * W), (innerHeight - 56) / H), 0.4, 1.25);
    span = track.offsetHeight - innerHeight;
    last = -1;
  }

  function apply(p, t) {
    const cam = ease(seg(p, 0.08, 0.42));        // phase B: camera approach
    const open = ease(seg(p, 0.42, 0.72));       // phase C/D: cover opens, spread settles
    const idle = 1 - seg(p, 0, 0.05);            // phase A: gentle turntable sway
    const sway = Math.sin(t / 1800) * 16 * idle;
    const ry = (22 + sway) * (1 - 0.55 * cam) * (1 - open);
    const rx = -11 * (1 - 0.5 * cam) * (1 - open);
    const s = fit * (0.72 + 0.28 * cam);
    camEl.style.transform = `scale(${s}) rotateX(${rx}deg) rotateY(${ry}deg)`;
    book.style.setProperty('--o', open.toFixed(4));
    book.style.setProperty('--sh', (50 + ry * 2.2).toFixed(1) + '%');
    stage.style.setProperty('--ss', (0.5 + 0.35 * cam + 0.3 * open).toFixed(3));
    stage.style.setProperty('--sy', (H / 2 * s + 18).toFixed(0) + 'px');
    hint.classList.toggle('hide', p > 0.04);

    const isLive = open > 0.98;                  // pages become interactive only once settled
    if (isLive !== live) {
      live = isLive;
      left.inert = right.inert = !isLive;
      if (isLive && wantFocus) { wantFocus = false; focusNav(); }
    }
    if (isLive) setChapter(p < 0.82 ? 0 : p < 0.91 ? 1 : 2);
  }

  function tick(now) {
    raf = requestAnimationFrame(tick);
    const target = span > 0 ? clamp(scrollY / span) : 0;
    cur += (target - cur) * 0.12;
    if (Math.abs(target - cur) < 5e-4) cur = target;
    if (cur !== last || cur < 0.05) { last = cur; apply(cur, performance.now()); }
  }

  function mode() {
    cancelAnimationFrame(raf);
    flat = mq.matches;
    root.classList.toggle('flat', flat);
    if (flat) {
      camEl.removeAttribute('style'); book.removeAttribute('style'); stage.removeAttribute('style');
      left.inert = right.inert = false; live = true;
      return;
    }
    live = null; measure();
    cur = span > 0 ? clamp(scrollY / span) : 0;
    raf = requestAnimationFrame(tick);
  }

  function goto(i, focus) {
    if (flat) { setChapter(i); if (focus) focusNav(); return; }
    wantFocus = !!focus && !live;
    scrollTo({ top: STOPS[i] * span, behavior: reduce.matches ? 'auto' : 'smooth' });
  }

  // restrained atmospheric particles
  if (!reduce.matches) {
    for (let i = 0; i < 26; i++) {
      const d = document.createElement('span'), z = 1 + Math.random() * 2;
      d.style.cssText = `left:${Math.random() * 100}%;top:${20 + Math.random() * 75}%;width:${z}px;height:${z}px;--a:${(0.2 + Math.random() * 0.4).toFixed(2)};--d:${(9 + Math.random() * 9).toFixed(1)}s;--dl:${(-Math.random() * 14).toFixed(1)}s`;
      dust.appendChild(d);
    }
  }

  hint.addEventListener('click', () => goto(0, true));
  $('skip').addEventListener('click', e => { e.preventDefault(); goto(chapter, true); });
  mq.addEventListener('change', mode);
  addEventListener('resize', () => { if (!flat) measure(); });

  window.LB = { goto, get chapter() { return chapter; }, get flat() { return flat; } };
  mode();
})();
