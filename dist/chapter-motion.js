// One owner for once-only chapter entrances. Nothing is hidden before an arrival.
(() => {
  const root = document.documentElement;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const panels = [...document.querySelectorAll('[data-horizontal-panel]')];
  const diagram = document.querySelector('.system-diagram');
  const tooltip = diagram?.querySelector('.diagram-tooltip');
  const nodes = [...document.querySelectorAll('.diagram-node')];
  const visited = new WeakSet();
  const revealed = new WeakSet();
  const timers = new Set();
  const candidates = new Map();
  const completions = new Map();
  const targetCompletions = new Map();
  let observer, lastTravel = scrollY, direction = 'forward', disposed = true;
  const later = (callback, milliseconds) => {
    const id = setTimeout(() => { timers.delete(id); callback(); }, milliseconds);
    timers.add(id);
    return id;
  };
  const cancel = id => { clearTimeout(id); timers.delete(id); };

  // Each mask is a word, so the actual font and available width decide wrapping.
  // The original heading remains the only accessible heading and retains its text.
  document.querySelectorAll('#about-title, .employer > h3, #venture-title, #contact-title').forEach(heading => {
    if (heading.querySelector('.chapter-word-mask')) return;
    const words = heading.textContent.match(/\S+|\s+/g) || [];
    const line = document.createElement('span');
    line.className = 'reveal-line';
    let index = 0;
    for (const word of words) {
      if (/^\s+$/.test(word)) { line.append(document.createTextNode(word)); continue; }
      const mask = document.createElement('span');
      const text = document.createElement('span');
      mask.className = 'chapter-word-mask';
      text.className = 'chapter-word';
      text.textContent = word;
      // A restrained word offset fits within the chapter's short entrance budget.
      text.style.setProperty('--word-delay', `${Math.min(index++ * 30, 90)}ms`);
      mask.append(text); line.append(mask);
    }
    heading.classList.add('chapter-masked-heading');
    heading.replaceChildren(line);
  });
  const stage = (element, kind, delay, duration) => {
    if (!element) return;
    element.dataset.motionKind = kind;
    element.dataset.motionState = 'waiting';
    element.style.setProperty('--entry-delay', `${delay}ms`);
    element.style.setProperty('--entry-duration', `${duration}ms`);
  };
  const stages = (selector, kind, delay, duration, offset = 0) =>
    document.querySelectorAll(selector).forEach((element, index) => stage(element, kind, delay + index * offset, duration));
  stages('.about .portrait', 'cover', 0, 500);
  stages('#about-title', 'words', 80, 420);
  stages('.about .lead > p', 'support', 200, 360, 70);
  stages('.about figcaption', 'support', 250, 340);
  stages('.about .keywords', 'support', 340, 340);
  document.querySelectorAll('.education-card').forEach((card, index) => {
    stage(card.querySelector('.education-media'), 'cover', index * 80, 500);
    stage(card.querySelector('.education-card-copy'), 'support', 190 + index * 80, 380);
    card.style.setProperty('--rule-delay', `${110 + index * 80}ms`);
  });
  document.querySelectorAll('.employer').forEach((employer, index) => {
    stage(employer, 'rule', index * 80, 440);
    stage(employer.querySelector('h3'), 'words', 60 + index * 80, 430);
    employer.style.setProperty('--rule-delay', `${index * 80}ms`);
    employer.querySelectorAll('.experience-role').forEach((role, roleIndex) => {
      stage(role, 'support', 170 + index * 80 + roleIndex * 80, 380);
      role.style.setProperty('--rule-delay', `${170 + index * 80 + roleIndex * 80}ms`);
    });
  });
  stages('#venture-title', 'words', 70, 430);
  stages('.venture-statement > p', 'support', 180, 340, 70);
  stages('.venture-story > p', 'support', 260, 340, 70);
  stages('.venture .metrics', 'support', 340, 340);
  stages('.venture .initiative', 'support', 360, 340);
  // The contained Venture artwork, and all of its ancestors, remain stable.
  stages('.work-row', 'support', 110, 400, 70);
  document.querySelectorAll('.work-row').forEach((row, index) => row.style.setProperty('--rule-delay', `${index * 70}ms`));
  stages('.selected-work .skills-link', 'support', 390, 340);
  stages('#contact-title', 'words', 20, 440);
  stages('.contact .lead > p', 'support', 170, 340, 70);
  // Email never moves or disappears; its focus and activation stay immediate.
  stages('.contact footer', 'support', 400, 340);
  const entranceTargets = [...document.querySelectorAll('[data-motion-kind]')];
  const targetsByPanel = new Map(panels.map(panel => [panel,
    entranceTargets.filter(target => target.closest('[data-horizontal-panel]') === panel)]));

  function showNode(node, pressed = false) {
    if (!diagram || !tooltip) return;
    if (pressed) {
      const next = node.getAttribute('aria-pressed') !== 'true';
      nodes.forEach(item => item.setAttribute('aria-pressed', 'false'));
      node.setAttribute('aria-pressed', String(next));
    }
    tooltip.textContent = `${diagram.dataset.stageLabel} ${Number(node.dataset.diagramNode) + 1} · ${node.querySelector('span:last-child').textContent} — ${node.dataset.note}`;
  }
  const onHover = event => showNode(event.currentTarget);
  const onClick = event => showNode(event.currentTarget, true);
  function settleTarget(target) {
    const completion = targetCompletions.get(target);
    if (completion) { cancel(completion); targetCompletions.delete(target); }
    target.classList.remove('is-motion-entering');
    target.dataset.motionState = 'complete';
    ['--motion-delay', '--motion-rule-delay', '--cover-width', '--cover-height'].forEach(property => target.style.removeProperty(property));
  }
  function visibleTarget(target) {
    const rect = target.getBoundingClientRect();
    const width = Math.max(0, Math.min(rect.right, innerWidth) - Math.max(rect.left, 0));
    const top = Math.max(rect.top, parseFloat(getComputedStyle(root).getPropertyValue('--header')) || 0);
    const height = Math.max(0, Math.min(rect.bottom, innerHeight) - top);
    const fraction = target.dataset.motionKind === 'cover' ? .6 : .4;
    return rect.width > 0 && rect.height > 0 && width >= Math.min(rect.width, innerWidth) * .6
      && height >= Math.min(rect.height, innerHeight * .4) * fraction;
  }
  function revealTarget(target, initial) {
    if (revealed.has(target)) return;
    if (!visibleTarget(target)) { target.dataset.motionState = 'pending'; return; }
    revealed.add(target);
    const delay = initial ? parseFloat(target.style.getPropertyValue('--entry-delay')) || 0 : 0;
    const ruleDelay = initial ? parseFloat(target.style.getPropertyValue('--rule-delay')) || 0 : 0;
    const duration = parseFloat(target.style.getPropertyValue('--entry-duration')) || 400;
    target.style.setProperty('--motion-delay', `${delay}ms`);
    target.style.setProperty('--motion-rule-delay', `${ruleDelay}ms`);
    if (target.dataset.motionKind === 'cover') {
      const rect = target.querySelector('img')?.getBoundingClientRect();
      if (rect) {
        target.style.setProperty('--cover-width', `${rect.width}px`);
        target.style.setProperty('--cover-height', `${rect.height}px`);
      }
    }
    target.dataset.motionState = 'entering';
    target.classList.add('is-motion-entering');
    const wordOffset = target.dataset.motionKind === 'words' ? 90 : 0;
    const budget = Math.max(delay + duration + wordOffset, ruleDelay + 440);
    targetCompletions.set(target, later(() => settleTarget(target), budget + 16));
  }
  function revealAvailable(panel, initial = false) {
    targetsByPanel.get(panel)?.forEach(target => revealTarget(target, initial));
  }
  function settle(target) {
    const completion = completions.get(target);
    if (completion) { cancel(completion); completions.delete(target); }
    target.classList.remove('is-entering');
    target.classList.add('is-visible', 'entry-complete');
    target.removeAttribute('data-entry-direction');
    target.dataset.entryState = 'complete';
  }
  function enter(target) {
    target.classList.add('is-visible');
    if (visited.has(target)) return;
    visited.add(target);
    if (reduced.matches || target.id === 'intro') { settle(target); return; }
    target.dataset.entryDirection = direction;
    target.dataset.entryState = 'entering';
    target.classList.add('is-entering');
    if (panels.includes(target)) revealAvailable(target, true);
    // Longest group is Contact's footer: 400 ms delay + 340 ms duration.
    completions.set(target, later(() => settle(target), 760));
    if (target.id === 'venture') inspectDiagram();
  }
  function arrived(panel, horizontal = root.hasAttribute('data-horizontal-active')) {
    const rect = panel.getBoundingClientRect();
    if (rect.right <= 0 || rect.left >= innerWidth || rect.bottom <= 0 || rect.top >= innerHeight) return false;
    return horizontal
      ? Math.abs(rect.left) <= innerWidth * .12
      : rect.top <= Math.max(parseFloat(getComputedStyle(root).getPropertyValue('--header')) || 0, innerHeight * .12)
        && rect.bottom > innerHeight * .5;
  }
  function inspectDiagram() {
    if (!diagram || !visited.has(diagram.closest('[data-horizontal-panel]')) || visited.has(diagram)) return;
    const rect = diagram.getBoundingClientRect();
    const width = Math.max(0, Math.min(rect.right, innerWidth) - Math.max(rect.left, 0));
    const height = Math.max(0, Math.min(rect.bottom, innerHeight) - Math.max(rect.top, 0));
    if (width >= rect.width * .6 && height >= Math.min(rect.height, innerHeight) * .6) enter(diagram);
  }
  function travel() {
    if (disposed) return;
    const delta = scrollY - lastTravel;
    if (Math.abs(delta) > .5) direction = delta < 0 ? 'reverse' : 'forward';
    lastTravel = scrollY;
    const horizontal = root.hasAttribute('data-horizontal-active');
    for (const panel of panels) {
      if (!visited.has(panel) && !reduced.matches) {
        if (arrived(panel, horizontal)) {
          if (!candidates.has(panel)) {
            // Confirm the chapter stays near arrival. A partial glance followed
            // by snap-back does not consume the once-only entrance.
            candidates.set(panel, later(() => {
              candidates.delete(panel);
              if (!disposed && arrived(panel)) enter(panel);
            }, 64));
          }
        } else if (candidates.has(panel)) { cancel(candidates.get(panel)); candidates.delete(panel); }
      }
      if (reduced.matches) continue;
      const rect = panel.getBoundingClientRect();
      if (rect.right <= 0 || rect.left >= innerWidth || rect.bottom <= 0 || rect.top >= innerHeight) continue;
      const offset = horizontal ? -rect.left / innerWidth : -rect.top / innerHeight;
      const value = `${Math.max(-10, Math.min(10, offset * 10))}px`;
      panel.style.setProperty('--parallax-x', horizontal ? value : '0px');
      panel.style.setProperty('--parallax-y', horizontal ? '0px' : value);
      if (visited.has(panel)) revealAvailable(panel);
    }
    if (!reduced.matches) inspectDiagram();
  }
  // Existing rail/engine callbacks own scroll updates; no second scroll ticker.
  window.portfolioAtmosphere = { travel };
  function observe() {
    observer?.disconnect(); observer = null;
    root.classList.toggle('motion-ready', !reduced.matches);
    if (reduced.matches) {
      timers.forEach(clearTimeout); timers.clear(); candidates.clear(); completions.clear(); targetCompletions.clear();
      entranceTargets.forEach(target => { revealed.add(target); target.classList.remove('is-in-view'); settleTarget(target); });
      [...panels, diagram].filter(Boolean).forEach(target => {
        target.style.removeProperty('--parallax-x'); target.style.removeProperty('--parallax-y');
        target.classList.remove('is-in-view'); visited.add(target); settle(target);
      });
      return;
    }
    observer = new IntersectionObserver(entries => {
      travel();
      for (const entry of entries) entry.target.classList.toggle('is-in-view', entry.isIntersecting);
      inspectDiagram();
    }, { threshold: [0, .18, .3, .6] });
    panels.forEach(panel => observer.observe(panel));
    entranceTargets.forEach(target => observer.observe(target));
    if (diagram) observer.observe(diagram);
    travel();
  }
  const visibility = () => root.classList.toggle('motion-document-hidden', document.hidden);
  function setup() {
    if (!disposed) return;
    disposed = false;
    nodes.forEach(node => {
      node.addEventListener('mouseenter', onHover); node.addEventListener('focus', onHover); node.addEventListener('click', onClick);
    });
    reduced.addEventListener('change', observe);
    document.addEventListener('visibilitychange', visibility); visibility();
    // Fail open even with a font response that never resolves.
    observe();
    document.fonts.ready.then(() => { if (!disposed) travel(); }).catch(() => {});
  }
  function cleanup() {
    disposed = true;
    observer?.disconnect(); observer = null;
    timers.forEach(clearTimeout); timers.clear(); candidates.clear(); completions.clear(); targetCompletions.clear();
    entranceTargets.forEach(target => { target.classList.remove('is-in-view'); if (revealed.has(target)) settleTarget(target); });
    reduced.removeEventListener('change', observe);
    document.removeEventListener('visibilitychange', visibility);
    nodes.forEach(node => {
      node.removeEventListener('mouseenter', onHover); node.removeEventListener('focus', onHover); node.removeEventListener('click', onClick);
    });
    [...panels, diagram].filter(Boolean).forEach(target => {
      target.classList.remove('is-in-view');
      target.style.removeProperty('--parallax-x'); target.style.removeProperty('--parallax-y');
      if (visited.has(target)) settle(target);
    });
  }
  setup();
  addEventListener('pagehide', cleanup);
  addEventListener('pageshow', event => { if (event.persisted) setup(); });
})();
