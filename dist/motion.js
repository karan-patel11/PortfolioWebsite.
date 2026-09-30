import { measureTrack } from './horizontal-layout.js';

// Native document scrolling owns the gesture. Every chapter gets enough reading
// distance for its full content before the next horizontal transition.
export function initHorizontal({ currentChapter, onReady = () => {} }) {
  const root = document.documentElement;
  const story = document.querySelector('[data-horizontal-story]');
  const pin = story?.querySelector('[data-horizontal-pin]');
  const track = story?.querySelector('[data-horizontal-track]');
  if (!track) return;
  const panels = [...track.children];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  let measurement, frame = 0, measureFrame = 0, locked = false, disposed = false;
  let horizontalTouch = null, suppressClickUntil = 0;
  const trigger = { start: 0, end: 0, enabled: true };
  const lenis = { isStopped: false }; // Existing dialog/QA integration facade.

  function render() {
    frame = 0;
    if (disposed || locked || !measurement) return;
    const progress = clamp(scrollY - trigger.start, 0, measurement.travel);
    const index = Math.max(0, measurement.boxes.findLastIndex(box => progress >= box.start));
    const box = measurement.boxes[index];
    const transition = clamp(progress - box.start - box.overflow, 0, measurement.width);
    let x = box.left + (index === panels.length - 1 ? 0 : transition);
    if (reduced.matches) x = Math.round(x / measurement.width) * measurement.width;
    track.style.transform = `translate3d(${-x}px,0,0)`;
    measurement.boxes.forEach(item => {
      const top = clamp(progress - item.start, 0, item.overflow);
      if (Math.abs(item.panel.scrollTop - top) > .5) item.panel.scrollTop = top;
    });
    const active = panels[clamp(Math.round(x / measurement.width), 0, panels.length - 1)];
    currentChapter(active, measurement.travel ? progress / measurement.travel : 0);
  }
  function schedule() { if (!frame && !disposed && !locked) frame = requestAnimationFrame(render); }

  function measure(preserve = true) {
    if (disposed) return;
    const old = measurement;
    const oldProgress = old ? clamp(scrollY - trigger.start, 0, old.travel) : 0;
    const oldIndex = old ? Math.max(0, old.boxes.findLastIndex(box => oldProgress >= box.start)) : 0;
    const oldBox = old?.boxes[oldIndex];
    root.setAttribute('data-horizontal-active', '');
    measurement = measureTrack(track, panels);
    let distance = 0;
    measurement.boxes.forEach((box, index) => {
      box.start = distance;
      box.overflow = Math.max(0, box.panel.scrollHeight - box.panel.clientHeight);
      distance += box.overflow + (index < panels.length - 1 ? measurement.width : 0);
    });
    measurement.travel = distance;
    story.style.height = `${pin.clientHeight + distance}px`;
    trigger.start = story.getBoundingClientRect().top + scrollY;
    trigger.end = trigger.start + distance;
    if (preserve && oldBox) {
      const local = oldProgress - oldBox.start;
      const next = measurement.boxes[oldIndex];
      const offset = local <= oldBox.overflow
        ? Math.min(local, next.overflow)
        : next.overflow + (local - oldBox.overflow) / old.width * measurement.width;
      scrollTo({ top: trigger.start + next.start + offset, behavior: 'instant' });
    }
    render();
  }
  function queueMeasure() {
    if (!measureFrame && !disposed) measureFrame = requestAnimationFrame(() => { measureFrame = 0; measure(); });
  }
  function go(panel) {
    const box = measurement?.boxes.find(item => item.panel === panel);
    if (!box) return;
    story.scrollLeft = pin.scrollLeft = track.scrollLeft = root.scrollLeft = 0;
    scrollTo({ top: trigger.start + box.start, behavior: 'instant' });
    render();
  }
  function reveal(element) {
    const panel = element.closest('[data-horizontal-panel]');
    const box = measurement?.boxes.find(item => item.panel === panel);
    if (!box) return;
    const bounds = panel.getBoundingClientRect();
    const rect = element.getBoundingClientRect();
    const header = parseFloat(getComputedStyle(root).getPropertyValue('--header')) || 0;
    const bottom = innerWidth < 768 ? 112 : 28;
    if (Math.abs(bounds.left) < 1 && rect.top >= header + 8 && rect.bottom <= pin.clientHeight - bottom) return;
    const top = clamp(rect.top - bounds.top + panel.scrollTop - header - 24, 0, box.overflow);
    scrollTo({ top: trigger.start + box.start + top, behavior: 'instant' });
    story.scrollLeft = pin.scrollLeft = track.scrollLeft = root.scrollLeft = 0;
    render();
  }
  function onWheel(event) {
    if (locked || event.target.closest('dialog') || Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return;
    event.preventDefault();
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? pin.clientHeight : 1;
    scrollTo({ top: scrollY + event.deltaX * unit, behavior: 'instant' });
  }
  function onPointerDown(event) {
    if (locked || event.pointerType !== 'touch' || !event.isPrimary || event.target.closest('button,input,textarea,select,dialog')) return;
    horizontalTouch = { id: event.pointerId, x: event.clientX, y: event.clientY, scroll: scrollY };
  }
  function onPointerMove(event) {
    if (!horizontalTouch || event.pointerId !== horizontalTouch.id || locked) return;
    const dx = event.clientX - horizontalTouch.x, dy = event.clientY - horizontalTouch.y;
    if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) * 1.2) {
      horizontalTouch.swiping = true;
      scrollTo({ top: horizontalTouch.scroll - dx, behavior: 'instant' });
    }
  }
  const endPointer = () => {
    if (horizontalTouch?.swiping) suppressClickUntil = performance.now() + 500;
    horizontalTouch = null;
  };
  // A sideways drag on a linked card must not activate its project afterward.
  track.addEventListener('click', event => {
    if (event.isTrusted && performance.now() < suppressClickUntil) { event.preventDefault(); event.stopImmediatePropagation(); }
  }, true);
  const engine = {
    lenis, trigger, get measurement() { return measurement; }, go, reveal, refresh: queueMeasure,
    lock() { locked = true; lenis.isStopped = true; trigger.enabled = false; },
    unlock() { locked = false; lenis.isStopped = false; trigger.enabled = true; schedule(); },
  };
  window.portfolioMotion = engine;
  measure(false);
  addEventListener('scroll', schedule, { passive: true });
  addEventListener('resize', queueMeasure, { passive: true });
  reduced.addEventListener('change', schedule);
  track.addEventListener('wheel', onWheel, { passive: false });
  track.addEventListener('pointerdown', onPointerDown, { passive: true });
  track.addEventListener('pointermove', onPointerMove, { passive: true });
  track.addEventListener('pointerup', endPointer, { passive: true });
  track.addEventListener('pointercancel', endPointer, { passive: true });
  const observer = new ResizeObserver(queueMeasure);
  const observeSizes = () => {
    observer.observe(pin);
    panels.forEach(panel => [...panel.children].filter(child => child.tagName !== 'DIALOG').forEach(child => observer.observe(child)));
  };
  observeSizes();
  document.fonts.ready.then(queueMeasure).catch(() => {});
  addEventListener('pagehide', () => {
    disposed = true;
    cancelAnimationFrame(frame); cancelAnimationFrame(measureFrame); frame = measureFrame = 0;
    horizontalTouch = null; observer.disconnect();
  });
  addEventListener('pageshow', event => {
    if (!event.persisted) return;
    disposed = false; observeSizes(); measure();
  });
  onReady();
  return engine;
}
