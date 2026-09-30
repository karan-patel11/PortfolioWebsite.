// Panel 1 owns its data hooks. Static HTML remains the failure/no-script fallback.
(async () => {
  const root = document.documentElement;
  const hero = document.querySelector('[data-hero-name]')?.closest('section');
  if (!hero) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const $ = hook => document.querySelector(`[data-${hook}]`);
  const menu = $('menu-toggle');
  let intro, clockTimer;
  const skipEvents = ['wheel', 'touchstart', 'keydown', 'pointerdown'];
  const clock = () => {
    const now = new Date();
    $('clock').textContent = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
    }).format(now);
    $('clock').dateTime = now.toISOString();
  };
  function finish() {
    clearTimeout(window.introFallback);
    root.removeAttribute('data-intro-pending');
    menu.disabled = false;
    skipEvents.forEach(type => { window.removeEventListener(type, skip); window.removeEventListener(type, window.introSkip); });
    clock();
    if (!clockTimer) clockTimer = setInterval(clock, 1000);
  }
  function skip() { intro?.progress(1); finish(); }
  if (root.hasAttribute('data-intro-pending') && window.portfolioGsapReady) await window.portfolioGsapReady;
  if (!window.gsap || !root.hasAttribute('data-intro-pending')) { finish(); return; }
  menu.disabled = true;
  gsap.set(hero.querySelectorAll('[data-name-word], [data-line]'), { y: 0, yPercent: reduced.matches ? 0 : 100 });
  const duration = value => reduced.matches ? 0 : value;
  // Shared masked-line primitive; wraps authored text without injecting copy.
  function revealLines(timeline, elements, at) {
    timeline.to(elements, { opacity: 1, duration: duration(.15), stagger: duration(.1) }, at)
      .to([...elements].flatMap(el => [...el.querySelectorAll('[data-line]')]), {
        yPercent: 0, duration: duration(.9), stagger: duration(.08), ease: 'expo.out',
      }, at);
  }
  intro = gsap.timeline({ onComplete: finish });
  intro.to($('loading-base-overlay'), { scaleY: 1, duration: duration(2.2), ease: 'power2.inOut' }, 0)
    .to($('year-row'), { opacity: 1, y: 0, duration: duration(.6) }, 0)
    .to($('year-strip'), { yPercent: -100 * 13 / 14, duration: duration(2.2), ease: 'power2.inOut' }, 0)
    .to($('year-row'), { yPercent: -100, duration: duration(.6), ease: 'power3.inOut' })
    .to($('name-row'), { opacity: 1, duration: 0 })
    .to(hero.querySelectorAll('[data-name-word]'), { yPercent: 0, duration: duration(1), stagger: duration(.08), ease: 'expo.out' }, '<')
    .to($('loading-base-overlay'), { scaleY: 0, duration: duration(.6), ease: 'power3.inOut' }, '<');
  revealLines(intro, hero.querySelectorAll('[data-reveal-line]'), reduced.matches ? 0 : 3.1);
  intro.to($('intro-header'), { opacity: 1, duration: duration(.5) }, reduced.matches ? 0 : 4.1);
  skipEvents.forEach(type => window.addEventListener(type, skip, { passive: true }));
  if (reduced.matches || window.introSkipRequested || location.hash || scrollY > 0) skip();
  reduced.addEventListener('change', skip);
  window.addEventListener('pagehide', () => { skip(); clearInterval(clockTimer); clockTimer = null; });
  window.addEventListener('pageshow', event => { if (event.persisted) finish(); });
})();
