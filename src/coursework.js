// Animate only the university currently on screen. A tap pauses without
// swallowing a deck swipe; the explicit button also supports keyboard users.
export function initCourseworkTickers() {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const cards = [...document.querySelectorAll('.education-card')];
  const update = card => {
    const ticker = card.querySelector('[data-course-ticker]');
    const button = card.querySelector('[data-ticker-toggle]');
    const paused = ticker.dataset.paused === 'true';
    if (reduced.matches) { button.removeAttribute('aria-pressed'); button.textContent = 'Next'; button.setAttribute('aria-label', `Next ${card.querySelector('h3').textContent} course`); return; }
    button.setAttribute('aria-pressed', String(paused));
    button.textContent = paused ? 'Play' : 'Pause';
    button.setAttribute('aria-label', `${paused ? 'Play' : 'Pause'} ${card.querySelector('h3').textContent} coursework`);
  };
  cards.forEach(card => {
    const ticker = card.querySelector('[data-course-ticker]');
    const track = ticker.querySelector('.ticker-track');
    ticker.dataset.paused = String(reduced.matches);
    // Constant reading speed regardless of the number/length of course names.
    track.style.setProperty('--ticker-duration', `${track.scrollWidth / 2 / 32}s`);
    let courseIndex = 0;
    const toggle = () => {
      if (reduced.matches) {
        const courses = [...track.firstElementChild.children];
        courseIndex = (courseIndex + 1) % courses.length;
        const offset = courses[courseIndex].offsetLeft - courses[0].offsetLeft;
        track.style.transform = `translate3d(${-offset}px,0,0)`;
      } else ticker.dataset.paused = String(ticker.dataset.paused !== 'true');
      update(card);
    };
    card.querySelector('[data-ticker-toggle]').addEventListener('click', toggle);
    reduced.addEventListener('change', () => { courseIndex = 0; track.style.removeProperty('transform'); });
    let start;
    ticker.addEventListener('pointerdown', event => {
      start = { x: event.clientX, y: event.clientY }; ticker.dataset.held = 'true';
    }, { passive: true });
    const release = event => {
      delete ticker.dataset.held;
      if (start && event.type === 'pointerup' && Math.hypot(event.clientX - start.x, event.clientY - start.y) < 8) {
        toggle();
      }
      start = null;
    };
    ticker.addEventListener('pointerup', release, { passive: true });
    ticker.addEventListener('pointercancel', release, { passive: true });
    ticker.addEventListener('pointerleave', () => { delete ticker.dataset.held; start = null; });
    update(card);
  });
  const activate = () => cards.forEach(card => {
    const panel = card.closest('[data-horizontal-panel]');
    const box = panel.getBoundingClientRect();
    card.querySelector('[data-course-ticker]').dataset.active = String(Math.abs(box.left) < 1);
  });
  document.addEventListener('deck-settled', activate);
  document.addEventListener('deck-layout', () => {
    cards.forEach(card => {
      const track = card.querySelector('.ticker-track');
      track.style.setProperty('--ticker-duration', `${track.scrollWidth / 2 / 32}s`);
    }); activate();
  });
  reduced.addEventListener('change', () => cards.forEach(card => {
    card.querySelector('[data-course-ticker]').dataset.paused = String(reduced.matches); update(card);
  }));
  activate();
}
