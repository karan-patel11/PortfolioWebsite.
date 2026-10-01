// Final metric values remain in the HTML for no-script and assistive readers.
// Put data-count-up on the aria-hidden visual span, alongside a sr-only value.
export function parseMetricValue(value) {
  const match = String(value).trim().match(/^([^\d-]*)(-?\d[\d,]*(?:\.\d+)?)([^\d]*)$/);
  if (!match) return null;
  const number = match[2].replaceAll(',', '');
  const target = Number(number);
  if (!Number.isFinite(target)) return null;
  return {
    target,
    decimals: number.split('.')[1]?.length || 0,
    prefix: match[1],
    suffix: match[3],
  };
}

export function initMetricCounters({ root = document, duration = 2200 } = {}) {
  const counters = [...root.querySelectorAll('[data-count-up]')];
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const runDuration = Number.isFinite(duration) ? Math.max(0, duration) : 2200;
  const waiting = new Map();
  const running = new Map();
  let observer;
  let frame = 0;

  function finish(element, metric) {
    element.textContent = metric.final;
    element.dataset.countState = 'complete';
    running.delete(element);
    waiting.delete(element);
    observer?.unobserve(element);
  }

  function render(metric, value) {
    return `${metric.prefix}${metric.formatter.format(value)}${metric.suffix}`;
  }

  function tick(now) {
    frame = 0;
    for (const [element, metric] of running) {
      metric.started ??= now;
      const progress = Math.min(1, (now - metric.started) / runDuration);
      if (progress === 1) {
        finish(element, metric);
        continue;
      }
      const eased = 1 - (1 - progress) ** 3;
      const value = render(metric, metric.target * eased);
      if (element.textContent !== value) element.textContent = value;
    }
    if (running.size) frame = requestAnimationFrame(tick);
  }

  function start(element, metric) {
    waiting.delete(element);
    observer?.unobserve(element);
    if (reducedMotion.matches || runDuration === 0) {
      finish(element, metric);
      return;
    }
    element.dataset.countState = 'running';
    element.textContent = render(metric, 0);
    running.set(element, metric);
    if (!frame) frame = requestAnimationFrame(tick);
  }

  function settle() {
    cancelAnimationFrame(frame);
    frame = 0;
    for (const [element, metric] of [...waiting, ...running]) finish(element, metric);
    observer?.disconnect();
  }

  function onSettled(event) {
    for(const [element,metric] of waiting){
      if(element.closest('[data-horizontal-panel]')===event.detail.panel)start(element,metric);
    }
  }

  function onMotionChange() {
    if (reducedMotion.matches) settle();
  }

  for (const element of counters) {
    if (element.dataset.countState === 'complete') continue;
    const parsed = parseMetricValue(element.textContent);
    const target = element.hasAttribute('data-count-target')
      ? Number(element.dataset.countTarget)
      : parsed?.target;
    const decimals = Number(element.dataset.countDecimals ?? parsed?.decimals ?? 0);
    if (!Number.isFinite(target) || !Number.isInteger(decimals) || decimals < 0 || decimals > 6) continue;
    const metric = {
      target,
      prefix: element.dataset.countPrefix ?? parsed?.prefix ?? '',
      suffix: element.dataset.countSuffix ?? parsed?.suffix ?? '',
      final: element.textContent,
      formatter: new Intl.NumberFormat('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }),
      started: null,
    };
    element.dataset.countState = 'pending';
    waiting.set(element, metric);
  }

  if (reducedMotion.matches || runDuration === 0 || !('IntersectionObserver' in window)) {
    settle();
  } else {
    // Observe the numbers themselves: a chapter can be partly onscreen while
    // its metrics are still below the fold, or translated offscreen sideways.
    observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting || entry.intersectionRatio < 0.95) continue;
        const panel=entry.target.closest('[data-horizontal-panel]');
        if(panel && Math.abs(panel.getBoundingClientRect().left)>1)continue;
        const metric = waiting.get(entry.target);
        if (metric) start(entry.target, metric);
      }
      if (!waiting.size) observer.disconnect();
    }, { threshold: [0, 0.95, 1] });
    for (const element of waiting.keys()) observer.observe(element);
    document.addEventListener('deck-settled', onSettled);
    reducedMotion.addEventListener('change', onMotionChange);
  }

  return function destroyMetricCounters() {
    settle();
    reducedMotion.removeEventListener('change', onMotionChange);
    document.removeEventListener('deck-settled', onSettled);
  };
}
