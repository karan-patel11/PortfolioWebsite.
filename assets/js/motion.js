/* =============================================================
   motion.js
   Requires: gsap 3, ScrollTrigger, lenis  (all loaded before this file)

   Contract with motion.css:
     - CSS owns every initial + resting state.
     - JS animates between them and never invents colours or sizes.
   Contract with the DOM:
     - every effect is addressed by a data-* hook, never by a class.
   ============================================================= */
(() => {
'use strict';

/* ---------- 0. env + utils ---------------------------------- */
const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

const DESKTOP = '(min-width: 768px)';
const MOBILE  = '(max-width: 767px)';
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const EASE = { rise: 'expo.out', draw: 'power3.out', swell: 'power2.inOut', fly: 'power2.in' };
const DUR  = { line: .9, group: .8, curtain: .7, hold: .5 };

/* split a text node into <span class="word"> — replaces GSAP SplitText (paid) */
function splitWords(el) {
  if (el.dataset.split === 'done') return $$('.word', el);
  const words = el.textContent.trim().split(/\s+/);
  el.innerHTML = words.map(w => `<span class="word">${w}</span>`).join(' ');
  el.dataset.split = 'done';
  return $$('.word', el);
}

/* one-shot enter detection.
   IntersectionObserver is used on purpose instead of ScrollTrigger's
   containerAnimation: IO reports real rendered geometry, so it works
   identically for a horizontally translated track and a vertical page,
   and it cannot drift after a resize. */
const enterObserver = new IntersectionObserver((entries, io) => {
  entries.forEach(e => {
    if (!e.isIntersecting) return;
    io.unobserve(e.target);
    const fn = e.target.__onEnter;
    if (fn) fn(e.target);
  });
}, { root: null, threshold: 0, rootMargin: '-8% -12% -8% -12%' });

function onEnter(el, fn) {
  if (!el) return;
  el.__onEnter = fn;
  enterObserver.observe(el);
}

/* ---------- 1. reduced motion: stop here -------------------- */
if (reduced) {
  initClock(); initMenu(); initThemeToggle();
  $('[data-header]')?.style.setProperty('opacity', '1');
  $('#menu-toggle')?.removeAttribute('disabled');
  $('[data-clients-list]')?.setAttribute('data-clients-list-interactive', '');
  return;
}

gsap.registerPlugin(ScrollTrigger);

/* ---------- 2. smooth scroll -------------------------------- */
const lenis = new Lenis({ lerp: 0.1, wheelMultiplier: 1, smoothWheel: true });
lenis.on('scroll', ScrollTrigger.update);
gsap.ticker.add(t => lenis.raf(t * 1000));
gsap.ticker.lagSmoothing(0);

/* ---------- 3. intro sequence (CH 0) ------------------------ */
function buildIntro() {
  const strip   = $('[data-year-strip]');
  const cells   = $$('.odometer__cell');
  const nameRow = $('[data-name-row]');
  const words   = $$('[data-hero-name] [data-split-words]').flatMap(splitWords);

  gsap.set(words, { yPercent: 110 });

  const tl = gsap.timeline({ defaults: { ease: EASE.rise } });

  tl.to('[data-intro-sweep]', { scaleY: 1, duration: .8, ease: EASE.swell }, 0)
    .to('[data-year-row]',    { opacity: 1, y: 0, duration: .6 }, .3)
    // ODOMETER: only the trailing cells move; the "20" prefix is static.
    .to(strip, {
      y: () => -($('.odometer__cell').offsetHeight * (cells.length - 1)),
      duration: 2.2, ease: EASE.swell
    }, .5)
    // hand off: year wipes up out of its clip shell, name lands in the same slot
    .to('[data-hero-year]', { yPercent: -110, duration: .6, ease: EASE.swell }, '>-0.1')
    .to('[data-intro-sweep]', { scaleY: 0, transformOrigin: 'top left', duration: .7, ease: EASE.swell }, '<')
    .to(nameRow, { opacity: 1, duration: .1 }, '<')
    .to(words,   { yPercent: 0, duration: 1, stagger: .08 }, '<')
    .to('[data-intro-tagline]', { opacity: 1, y: 0, duration: .8 }, '-=0.6')
    .to('[data-intro-journey]', { opacity: 1, y: 0, duration: .8 }, '-=0.7')
    .add(() => revealLines($('.hero__meta')), '-=0.6')
    .add(() => revealLines($('.hero__avail')), '-=0.55')
    .add(() => revealLines($('.hero__scroll')), '-=0.5')
    .to('[data-header]', { opacity: 1, duration: .5 }, '-=0.4')
    .add(() => $('#menu-toggle')?.removeAttribute('disabled'));

  // skip on first interaction — recruiters are not here for the show
  const skip = () => { tl.progress(1); off(); };
  const off  = () => ['wheel', 'touchstart', 'keydown', 'pointerdown']
    .forEach(ev => window.removeEventListener(ev, skip));
  ['wheel', 'touchstart', 'keydown', 'pointerdown']
    .forEach(ev => window.addEventListener(ev, skip, { once: true, passive: true }));
  tl.eventCallback('onComplete', off);

  return tl;
}

/* ---------- 4. reveal primitives ---------------------------- */
/* (a) masked lines */
function revealLines(scope) {
  if (!scope) return;
  gsap.to(scope, { opacity: 1, duration: .3 });
  gsap.to($$('.line-mask__inner', scope), {
    yPercent: 0, duration: DUR.line, ease: EASE.rise, stagger: .08
  });
}

/* (a2) grouped cluster: label + paragraph + quote move as one idea */
function revealGroup(scope) {
  gsap.to($$('[data-reveal-item]', scope), {
    opacity: 1, y: 0, duration: DUR.group, ease: EASE.rise, stagger: .1
  });
}

/* (b) two-stage curtain: colour card sweeps across, leaves the photo behind */
function revealCurtain(fig) {
  const card = $('[data-curtain-card]', fig);
  const clip = $('[data-curtain-clip]', fig);
  gsap.timeline({ defaults: { ease: EASE.swell, duration: DUR.curtain } })
    .to(card, { clipPath: 'inset(0 0% 0 0)' })
    .to(clip, { clipPath: 'inset(0 0% 0 0)', opacity: 1 }, '-=0.35')
    .to(card, { clipPath: 'inset(0 0 0 100%)' }, '-=0.45');
}

/* (c) hairline draw */
function drawRules(scope) {
  gsap.to($$('[data-work-rule]', scope), {
    scaleX: 1, duration: .8, ease: EASE.draw, stagger: .06
  });
}

/* ---------- 5. horizontal engine + pause phase -------------- */
let master = null;
let panelBox = [];              // cached geometry, refreshed on ScrollTrigger.refresh

const mm = gsap.matchMedia();

mm.add(DESKTOP, () => {
  const track = $('[data-horizontal-track]');
  const pin   = $('[data-horizontal-pin]');
  const panels = $$('[data-horizontal-panel]', track);
  const expand = $('[data-expand-panel]');

  const distance = () => track.scrollWidth - window.innerWidth;

  /* x at which the expand panel is centred in the viewport */
  const centreX = () => {
    const raw = expand.offsetLeft + expand.offsetWidth / 2 - window.innerWidth / 2;
    return Math.min(Math.max(raw, 0), distance());
  };

  /* Timeline durations are expressed in PIXELS OF TRACK MOTION, so scroll
     speed stays constant across phases. The hold phase adds extra scroll
     length during which track x does not change. */
  const total = distance();
  const cx    = centreX();
  const HOLD  = Math.round(total * 0.45);

  master = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: {
      trigger: pin,
      pin: true,
      scrub: 1,
      anticipatePin: 1,
      invalidateOnRefresh: true,
      end: () => '+=' + (distance() + HOLD),
      onUpdate: self => {
        setProgress(self.progress);
        syncHeaderTheme(-gsap.getProperty(track, 'x'));
        runParallax(-gsap.getProperty(track, 'x'));
      }
    }
  });

  // phase 1 — slide to the expand panel
  master.to(track, { x: -cx, duration: cx });
  // phase 2 — TRACK HELD STILL. nothing in here touches track.x
  master.add(buildExpand(HOLD, 'x'), '>');
  // phase 3 — resume to the end
  master.to(track, { x: () => -distance(), duration: total - cx }, '>');

  cacheGeometry('x');
  ScrollTrigger.addEventListener('refresh', () => cacheGeometry('x'));

  /* keyboard: focusing an off-screen panel must scroll it into view.
     The reference site does not solve this; horizontal layouts are
     unusable with a keyboard without it. */
  document.addEventListener('focusin', e => {
    const panel = e.target.closest('[data-horizontal-panel]');
    if (!panel || !master.scrollTrigger) return;
    const st = master.scrollTrigger;
    const i  = panels.indexOf(panel);
    const box = panelBox[i];
    if (!box) return;
    const target = st.start + (box.start / distance()) * (st.end - st.start);
    lenis.scrollTo(target, { immediate: false });
  });

  return () => { master?.scrollTrigger?.kill(); master?.kill(); master = null; };
});

mm.add(MOBILE, () => {
  /* vertical document flow. Only the expand panel pins. */
  const expand = $('[data-expand-panel]');
  const tl = gsap.timeline({
    scrollTrigger: {
      trigger: expand, pin: true, scrub: 1, start: 'top top', end: '+=120%',
      invalidateOnRefresh: true
    }
  });
  tl.add(buildExpand(1, 'y'));

  ScrollTrigger.create({
    trigger: '[data-horizontal-story]', start: 'top top', end: 'bottom bottom',
    onUpdate: self => setProgress(self.progress)
  });

  cacheGeometry('y');
  ScrollTrigger.addEventListener('refresh', () => cacheGeometry('y'));
  window.addEventListener('scroll', () => syncHeaderTheme(window.scrollY), { passive: true });
  initMobileLogos();

  return () => tl.scrollTrigger?.kill();
});

/* ---------- 6. CH II — the expand panel --------------------- */
/* axis 'x' = desktop (words fly left/right), 'y' = mobile (up/down) */
function buildExpand(duration, axis) {
  const rect  = $('[data-expand-rect]');
  const lead  = $('[data-expand-word="lead"]');
  const trail = $('[data-expand-word="trail"]');

  const cover = () => Math.max(
    window.innerWidth  / rect.offsetWidth,
    window.innerHeight / rect.offsetHeight
  ) * 1.02;

  const out = axis === 'x'
    ? [{ xPercent: -120 }, { xPercent: 120 }]
    : [{ yPercent: -140 }, { yPercent: 140 }];

  const tl = gsap.timeline({ defaults: { ease: 'none' } });
  tl.fromTo(rect, { scale: 0 }, { scale: cover, duration, ease: EASE.swell }, 0)
    .to(lead,  { ...out[0], duration: duration * .8, ease: EASE.fly }, 0)
    .to(trail, { ...out[1], duration: duration * .8, ease: EASE.fly }, 0)
    .to([lead, trail], { opacity: 0, duration: duration * .25 }, duration * .55);
  return tl;
}

/* ---------- 7. header: progress, theme, menu ---------------- */
const rail = $('[data-header]');
const progressEl = $('[data-header-scroll-progress]');
const setProgressX = gsap.quickSetter(progressEl, 'scaleX');
const setProgressY = gsap.quickSetter(progressEl, 'scaleY');

function setProgress(p) {
  if (window.matchMedia(DESKTOP).matches) setProgressY(p);
  else setProgressX(p);
}

/* cache panel offsets so the per-frame theme check does zero DOM reads */
function cacheGeometry(axis) {
  panelBox = $$('[data-horizontal-panel]').map(el => ({
    el,
    start: axis === 'x' ? el.offsetLeft : el.offsetTop,
    size:  axis === 'x' ? el.offsetWidth : el.offsetHeight,
    theme: el.dataset.headerTheme,
    transparent: el.hasAttribute('data-header-transparent')
  }));
}

let activeTheme = null;
function syncHeaderTheme(scrolled) {
  const probe = scrolled + (window.matchMedia(DESKTOP).matches ? rail.offsetWidth : rail.offsetHeight);
  const box = panelBox.find(b => probe >= b.start && probe < b.start + b.size);
  if (!box || box.theme === activeTheme) return;
  activeTheme = box.theme;
  /* values come from CSS custom properties on the panel, so the
     dark/light site theme keeps working. No hex literals in JS. */
  const cs = getComputedStyle(box.el);
  gsap.to(rail, {
    duration: .4, ease: 'power2.out',
    '--header-bg':   box.transparent ? 'rgba(0,0,0,0)' : cs.getPropertyValue('--panel-bg').trim(),
    '--header-fg':   cs.getPropertyValue('--panel-fg').trim(),
    '--header-rule': box.transparent ? 'rgba(0,0,0,0)' : cs.getPropertyValue('--panel-rule').trim()
  });
}

function initMenu() {
  const btn = $('#menu-toggle'), menu = $('[data-menu]');
  if (!btn || !menu) return;
  btn.addEventListener('click', () => {
    const open = btn.getAttribute('aria-expanded') === 'true';
    btn.setAttribute('aria-expanded', String(!open));
    menu.hidden = open;
    if (!open) $('a', menu)?.focus();
  });
  menu.addEventListener('click', e => {
    if (!e.target.closest('a')) return;
    btn.setAttribute('aria-expanded', 'false');
    menu.hidden = true;
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !menu.hidden) btn.click();
  });
}

function initThemeToggle() {
  const btn = $('[data-theme-toggle]');
  if (!btn) return;
  const saved = localStorage.getItem('theme');
  if (saved) document.documentElement.dataset.theme = saved;
  btn.addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    localStorage.setItem('theme', next);
    activeTheme = null;                      // force a header re-sync
  });
}

/* ---------- 8. CH III — project list hover ------------------ */
function initWorkList() {
  const list = $('[data-work-list]');
  if (!list || !window.matchMedia('(pointer: fine)').matches) return;
  const imgs = $$('[data-work-image]');

  $$('[data-work-row]', list).forEach(row => {
    row.addEventListener('pointerenter', () => {
      list.classList.add('is-hovering');
      $$('[data-work-row]', list).forEach(r => r.classList.toggle('is-active', r === row));
      imgs.forEach(img => img.classList.toggle('is-active', img.dataset.workImage === row.dataset.workRow));
    });
  });
  list.addEventListener('pointerleave', () => {
    list.classList.remove('is-hovering');
    $$('[data-work-row]', list).forEach(r => r.classList.remove('is-active'));
    imgs.forEach(img => img.classList.remove('is-active'));
  });
}

/* ---------- 9. CH IV — card parallax ------------------------ */
let parallaxItems = [];
function initParallax() {
  parallaxItems = $$('[data-parallax]').map(el => ({
    el,
    media: $('[data-parallax-media]', el),
    set: gsap.quickSetter($('[data-parallax-media]', el), 'x', 'px')
  }));
}
/* driven from the master onUpdate — no per-frame getBoundingClientRect */
function runParallax() {
  if (!parallaxItems.length) return;
  const vw = window.innerWidth;
  parallaxItems.forEach(item => {
    const r = item.el.getBoundingClientRect();
    if (r.right < -200 || r.left > vw + 200) return;      // off-screen: skip
    const centre = r.left + r.width / 2;
    const ratio = (centre - vw / 2) / vw;                  // -1 … 1
    item.set(-ratio * r.width * 0.06);                     // ±6% drift
  });
}

/* ---------- 10. CH V — experience list ---------------------- */
function initMobileLogos() {
  const rows = $$('[data-client-row]');
  const logos = $$('[data-client-mobile-logo]');
  rows.forEach((row, i) => {
    ScrollTrigger.create({
      trigger: row, start: 'top 55%', end: 'bottom 45%',
      onToggle: self => logos.forEach((l, j) => l.classList.toggle('is-active', self.isActive && j === i))
    });
  });
}

/* ---------- 11. live clock ---------------------------------- */
function initClock() {
  const el = $('[data-clock]');
  if (!el) return;
  const tick = () => {
    el.textContent = new Intl.DateTimeFormat('en-US', {
      hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/New_York'
    }).format(new Date());
  };
  tick(); setInterval(tick, 1000);
}

/* ---------- 12. page transition ----------------------------- */
function initTransition() {
  const mount = $('#dissolve-mount');
  if (!mount) return;

  const stored = sessionStorage.getItem('transition-in');
  if (stored) {
    sessionStorage.removeItem('transition-in');
    mount.style.setProperty('--transition-color', stored);
    gsap.set(mount, { opacity: 1 });
    gsap.to(mount, { opacity: 0, duration: .5, ease: EASE.swell });
  }

  document.addEventListener('click', e => {
    const a = e.target.closest('a[data-transition-color]');
    if (!a || a.origin !== location.origin || e.metaKey || e.ctrlKey) return;
    e.preventDefault();
    const colour = a.dataset.transitionColor;
    mount.style.setProperty('--transition-color', colour);
    mount.classList.add('is-active');
    sessionStorage.setItem('transition-in', colour);
    gsap.to(mount, {
      opacity: 1, duration: .5, ease: EASE.swell,
      onComplete: () => { location.href = a.href; }
    });
  });
  /* bfcache / back button: never leave the overlay stuck */
  window.addEventListener('pageshow', () => gsap.set(mount, { opacity: 0, clearProps: 'opacity' }));
}

/* ---------- 13. wire the chapters --------------------------- */
function initChapters() {
  onEnter($('[data-reveal-group]'), revealGroup);
  onEnter($('[data-curtain]'), revealCurtain);
  $$('.about__quote, .about__foot').forEach(el => onEnter(el, revealLines));

  const projects = $('[data-panel="projects"]');
  onEnter(projects, scope => {
    revealLines($('.label', scope));
    const list = $('[data-work-list]', scope);
    gsap.to(list, { opacity: 1, duration: .3 });
    gsap.to($$('.line-mask__inner', list), { yPercent: 0, duration: DUR.line, ease: EASE.rise, stagger: .08 });
    drawRules(scope);
  });

  const build = $('[data-panel="build"]');
  onEnter(build, scope => $$('[data-reveal-line]', scope).forEach(revealLines));
  /* NOTE: the cards themselves get NO entrance animation.
     Their entrance is the horizontal scroll. Do not add one. */

  const exp = $('[data-panel="experience"]');
  onEnter(exp, scope => {
    revealLines($('.label', scope));
    const list = $('[data-clients-list]', scope);
    gsap.to(list, { opacity: 1, duration: .3 });
    gsap.to($$('.line-mask__inner', list), {
      yPercent: 0, duration: DUR.line, ease: EASE.rise, stagger: .08,
      // hover is dead until the reveal finishes — prevents broken mid-reveal states
      onComplete: () => list.setAttribute('data-clients-list-interactive', '')
    });
  });

  const contact = $('[data-panel="contact"]');
  onEnter(contact, scope => {
    const words = $$('[data-char-line-heading] [data-split-words]', scope).flatMap(splitWords);
    gsap.set(words, { yPercent: 110 });
    gsap.to($('[data-char-line-heading]', scope), { opacity: 1, duration: .2 });
    gsap.to(words, { yPercent: 0, duration: 1, ease: EASE.rise, stagger: .08 });
    $$('[data-reveal-line]', scope).forEach((el, i) => gsap.delayedCall(.2 + i * .12, () => revealLines(el)));
  });
}

/* ---------- 14. boot ---------------------------------------- */
document.fonts.ready.then(() => {
  buildIntro();
  initChapters();
  initWorkList();
  initParallax();
  initClock();
  initMenu();
  initThemeToggle();
  initTransition();
  ScrollTrigger.refresh();
});

let rt;
window.addEventListener('resize', () => {
  clearTimeout(rt);
  rt = setTimeout(() => ScrollTrigger.refresh(), 150);
});

})();
