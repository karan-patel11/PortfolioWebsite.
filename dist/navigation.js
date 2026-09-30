export function initMobileNavigation() {
  const dialog = document.querySelector('#menu');
  const toggles = [...document.querySelectorAll('[data-menu-toggle]')];
  const dock = document.querySelector('.mobile-dock');
  const hint = document.querySelector('[data-scroll-hint]');
  const mobile = matchMedia('(max-width: 767px)');
  let origin, overflow = '', hintDone = false, closingForRoute = false, suspended = false;
  dock.hidden = false;
  toggles.forEach(toggle => { toggle.hidden = false; });
  function close(forRoute = false) {
    if (!dialog.open) return;
    closingForRoute = forRoute;
    dialog.close();
  }
  function restore() {
    if (!suspended) return;
    suspended = false;
    document.body.style.overflow = overflow;
    window.portfolioMotion?.unlock();
    toggles.forEach(toggle => toggle.setAttribute('aria-expanded', 'false'));
    if (!closingForRoute && origin?.getClientRects().length) origin.focus({ preventScroll: true });
    closingForRoute = false;
  }
  toggles.forEach(toggle => toggle.addEventListener('click', () => {
    if (dialog.open) { close(); return; }
    origin = toggle; overflow = document.body.style.overflow; suspended = true;
    window.portfolioMotion?.lock();
    document.body.style.overflow = 'hidden';
    toggles.forEach(button => button.setAttribute('aria-expanded', 'true'));
    dialog.showModal();
    dialog.querySelector('.menu-close').focus({ preventScroll: true });
    dismissHint();
  }));
  dialog.querySelector('.menu-close').addEventListener('click', () => close());
  dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
  dialog.addEventListener('keydown', event => {
    if (event.key !== 'Tab') return;
    const controls = [...dialog.querySelectorAll('a[href],button')].filter(control => control.getClientRects().length);
    const first = controls[0], last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });
  dialog.addEventListener('close', restore);
  dialog.addEventListener('click', event => {
    if (event.target.closest('a[href]')) {
      // Unlock before the document's chapter routing handler.
      close(true); restore();
    } else if (event.target === dialog) {
      const rect = dialog.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) close();
    }
  });
  mobile.addEventListener('change', () => { if (dialog.open) close(true); });
  function dismissHint() {
    if (hintDone) return;
    hintDone = true;
    hint.classList.add('is-dismissed');
    hint.setAttribute('aria-hidden', 'true');
    hint.inert = true;
    try { sessionStorage.setItem('portfolio-scroll-discovered', 'true'); } catch {}
    removeEventListener('wheel', onWheel);
    removeEventListener('touchmove', dismissHint);
    removeEventListener('keydown', onKey);
    removeEventListener('scroll', onScroll);
  }
  function onWheel(event) { if (Math.abs(event.deltaY) + Math.abs(event.deltaX) > 2) dismissHint(); }
  function onKey(event) { if (['ArrowDown','ArrowUp','ArrowLeft','ArrowRight','PageDown','PageUp',' ','End','Home'].includes(event.key)) dismissHint(); }
  const initialScroll = scrollY;
  function onScroll() { if (Math.abs(scrollY - initialScroll) > 24) dismissHint(); }
  let discovered = false;
  try { discovered = sessionStorage.getItem('portfolio-scroll-discovered') === 'true'; } catch {}
  if (!discovered && !location.hash) {
    hint.hidden = false;
    addEventListener('wheel', onWheel, { passive: true });
    addEventListener('touchmove', dismissHint, { passive: true });
    addEventListener('keydown', onKey);
    addEventListener('scroll', onScroll, { passive: true });
    hint.querySelector('[data-hint-dismiss]').addEventListener('click', dismissHint);
  }
  document.addEventListener('click', event => {
    if (event.target.closest('a[href^="#"],a[href^="/#"]')) dismissHint();
  });
}
