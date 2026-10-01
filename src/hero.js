// Local Web Animations: transform/opacity only; authored text reserves its space.
(async () => {
  const root = document.documentElement;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const animations = [];
  let clockTimer;
  const clock = () => {
    const el = document.querySelector('[data-clock]');
    if (!el) return;
    const now = new Date();
    el.textContent = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).format(now);
    el.dateTime = now.toISOString();
  };
  function finish() {
    animations.forEach(animation => animation.cancel());
    window.introSkip?.();
    root.dataset.introState = 'complete';
    clock();
    if (!clockTimer) clockTimer = setInterval(clock, 1000);
  }
  addEventListener('pagehide', () => { finish(); clearInterval(clockTimer); clockTimer = null; });
  addEventListener('pageshow', event => { if (event.persisted) finish(); });
  reduced.addEventListener('change', finish);
  // Deferred scripts can run while readyState is interactive, before the main
  // module assigns portfolioReady. DOMContentLoaded waits for both script types.
  if (document.readyState !== 'complete') await new Promise(resolve => addEventListener('DOMContentLoaded', resolve, { once: true }));
  await window.portfolioReady;
  if (!root.hasAttribute('data-intro-pending') || reduced.matches) { finish(); return; }
  const hero = document.getElementById('intro');
  root.dataset.introState = 'running';
  const animate = (element, frames, duration, delay = 0, easing = 'cubic-bezier(.22,1,.36,1)') => {
    if (!element) return;
    const animation = element.animate(frames, { duration, delay, easing, fill: 'both' });
    animations.push(animation); return animation;
  };
  animate(hero.querySelector('[data-year-row]'), [{ opacity: 0, transform: 'translateY(12px)' },
    { opacity: 1, transform: 'translateY(0)', offset: .22 }, { opacity: 1, transform: 'translateY(0)', offset: .78 },
    { opacity: 0, transform: 'translateY(-100%)' }], 1300, 0, 'linear');
  animate(hero.querySelector('[data-year-strip]'), [{ transform: 'translate3d(0,0,0)' },
    { transform: 'translate3d(0,-92.857142857%,0)' }], 1100, 0, 'cubic-bezier(.65,0,.35,1)');
  animate(hero.querySelector('[data-name-row]'), [{ opacity: 0 }, { opacity: 1 }], 100, 1050);
  hero.querySelectorAll('[data-name-word]').forEach((el, i) => animate(el,
    [{ transform: 'translate3d(0,105%,0)' }, { transform: 'translate3d(0,0,0)' }], 850, 1080 + i * 70));
  hero.querySelectorAll('[data-reveal-line]').forEach((el, i) => {
    animate(el, [{ opacity: 0 }, { opacity: 1 }], 250, 1250 + i * 45);
    el.querySelectorAll('[data-line]').forEach(line => animate(line,
      [{ transform: 'translate3d(0,105%,0)' }, { transform: 'translate3d(0,0,0)' }], 750, 1250 + i * 45));
  });
  // Input removes the pending state synchronously, including before this file loads.
  const observer = new MutationObserver(() => { if (!root.hasAttribute('data-intro-pending')) { observer.disconnect(); finish(); } });
  observer.observe(root, { attributes: true, attributeFilter: ['data-intro-pending'] });
  await Promise.allSettled(animations.map(animation => animation.finished));
  observer.disconnect(); finish();
})();
