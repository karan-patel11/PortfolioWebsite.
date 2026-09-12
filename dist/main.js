const toggle = document.querySelector('.menu-toggle');
const menu = document.querySelector('#menu');
const preference = matchMedia('(prefers-reduced-motion: reduce)');
let observer;
const animations = new Set();
const chapters = [...document.querySelectorAll('main > section.chapter')];
let navigationObserver;

function currentChapter(chapter) {
  const rail = document.querySelector('.rail');
  if (rail) rail.dataset.surface = chapter.classList.contains('dark') ? 'dark'
    : chapter.classList.contains('hero') ? 'hero'
    : chapter.classList.contains('projects') ? 'stone' : 'paper';
  document.querySelectorAll('#menu nav a, .footer-nav a').forEach(link => {
    if (new URL(link.href).hash === `#${chapter.id}`) link.setAttribute('aria-current', 'location');
    else link.removeAttribute('aria-current');
  });
}
if ('IntersectionObserver' in window && chapters.length) {
  navigationObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => { if (entry.isIntersecting) currentChapter(entry.target); });
  }, { rootMargin: '-15% 0px -80% 0px' });
  chapters.forEach(chapter => navigationObserver.observe(chapter));
}

// Content is visible by default. The Web Animations API never supplies
// a persistent hidden state, so cancellation and script failure fail open.
function reveal(element, delay = 0) {
  if (preference.matches || !element.animate) return;
  const animation = element.animate([
    { opacity: 0, transform: 'translateY(24px)' },
    { opacity: 1, transform: 'translateY(0)' },
  ], { duration: 700, delay, easing: 'cubic-bezier(.22,1,.36,1)' });
  animations.add(animation);
  animation.finished.catch(() => {}).finally(() => animations.delete(animation));
}

function stopMotion() {
  observer?.disconnect();
  animations.forEach(animation => animation.cancel());
  animations.clear();
}

if (toggle && menu && typeof menu.showModal === 'function') {
  toggle.hidden = false;
  toggle.setAttribute('aria-label', 'Open chapter menu');
  toggle.addEventListener('click', () => {
    menu.showModal();
    toggle.setAttribute('aria-expanded', 'true');
    if (!preference.matches) reveal(menu, 0);
  });
  document.querySelector('.menu-close').addEventListener('click', () => menu.close());
  menu.addEventListener('close', () => {
    toggle.setAttribute('aria-expanded', 'false');
    if (!menu.returnValue) toggle.focus({ preventScroll: true });
    menu.returnValue = '';
  });
  menu.querySelectorAll('a').forEach(link => link.addEventListener('click', event => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const destination = new URL(link.href);
    const target = destination.pathname === location.pathname
      ? document.getElementById(destination.hash.slice(1)) : null;
    menu.close('navigate');
    if (target) {
      target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
    }
  }));
}

if (!preference.matches && 'IntersectionObserver' in window) {
  observer = new IntersectionObserver(entries => {
    for (const entry of entries) if (entry.isIntersecting) {
      observer.unobserve(entry.target);
      reveal(entry.target);
    }
  }, { threshold: 0.12 });
  document.querySelectorAll('[data-reveal]').forEach(element => observer.observe(element));

}
preference.addEventListener('change', stopMotion);
window.addEventListener('pagehide', () => { stopMotion(); navigationObserver?.disconnect(); });
window.addEventListener('pageshow', event => {
  if (event.persisted) chapters.forEach(chapter => navigationObserver?.observe(chapter));
});
window.addEventListener('resize', () => animations.forEach(animation => animation.cancel()), { passive: true });

const themeToggle = document.querySelector('[data-theme-toggle]');
function applyTheme(light) {
  document.documentElement.dataset.theme = light ? 'light' : 'dark';
  themeToggle?.setAttribute('aria-pressed', String(light));
  themeToggle?.setAttribute('aria-label', `Switch to ${light ? 'dark' : 'light'} theme`);
}
try { applyTheme(localStorage.getItem('portfolio-theme') === 'light'); } catch { applyTheme(false); }
themeToggle?.addEventListener('click', () => {
  const light = document.documentElement.dataset.theme !== 'light';
  applyTheme(light);
  try { localStorage.setItem('portfolio-theme', light ? 'light' : 'dark'); } catch {}
});
