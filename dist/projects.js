// Adapt the reference work-list state and hairline draw to both project panels.
// Pointer and keyboard interactions share the same per-list active row.
const preference = matchMedia('(prefers-reduced-motion: reduce)');
const lists = [...document.querySelectorAll('[data-work-list]')];
for (const list of lists) {
  const rows = [...list.querySelectorAll('[data-work-row]')];
  const activate = row => {
    if (!list.contains(row)) row = null;
    list.classList.toggle('is-hovering', Boolean(row));
    rows.forEach(item => item.classList.toggle('is-active', item === row));
  };
  rows.forEach(row => row.addEventListener('pointerenter', () => activate(row)));
  list.addEventListener('pointerleave', () => activate(document.activeElement.closest('[data-work-row]')));
  list.addEventListener('focusin', event => activate(event.target.closest('[data-work-row]')));
  list.addEventListener('focusout', event => activate(event.relatedTarget?.closest('[data-work-row]')));
}
let observer;
function syncRules() {
  observer?.disconnect();
  lists.forEach(list => {
    list.removeAttribute('data-work-motion');
    list.querySelectorAll('[data-work-row]').forEach(row => row.classList.remove('is-revealed'));
  });
  if (preference.matches || !('IntersectionObserver' in window)) return;
  observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-revealed');
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.15 });
  lists.forEach(list => {
    list.setAttribute('data-work-motion', '');
    list.querySelectorAll('[data-work-row]').forEach((row, index) => {
      row.style.setProperty('--work-rule-delay', `${index * 0.06}s`);
      observer.observe(row);
    });
  });
}
syncRules();
preference.addEventListener('change', syncRules);
