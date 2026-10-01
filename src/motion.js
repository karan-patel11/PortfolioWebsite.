import { measureTrack } from './horizontal-layout.js';

// The browser renders touch travel. Page selection belongs to explicit input,
// never to image decoding, layout changes or a trackpad's lingering momentum.
export function initHorizontal({ currentChapter, pagination, onReady = () => {} }) {
  const root = document.documentElement;
  const track = document.querySelector('[data-horizontal-track]');
  const pin = document.querySelector('[data-horizontal-pin]');
  if (!track) return;
  root.setAttribute('data-horizontal-active', ''); root.setAttribute('data-native-scroll', '');
  let panels = [], measurement, activeIndex = 0, selectedPanel = null;
  let locked = false, measuring = false, moving = false, touch = null, disposed = false;
  let frame = 0, resizeFrame = 0, settleTimer = 0, pendingMeasure = false, sizeKey = '';
  let animationFrame = 0;
  let suppressClickUntil = 0;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const lenis = { isStopped: false }, trigger = { start: 0, end: 0, enabled: true };
  const clamp = value => Math.max(0, Math.min(panels.length - 1, value));
  const selectedIndex = () => Math.max(0, panels.indexOf(selectedPanel));
  function restorePosition() {
    const left = selectedIndex() * measurement.width;
    if (Math.abs(track.scrollLeft - left) > 1) track.scrollTo({ left, behavior: 'instant' });
  }
  function publish(settled = false) {
    frame = 0;
    if (locked || measuring || !measurement || disposed) return;
    // Native scroll anchoring/focus can move a snap container without input.
    // Restore its selected page instead of treating that as navigation.
    if (!moving && !touch) restorePosition();
    const index = clamp(Math.round(track.scrollLeft / measurement.width));
    activeIndex = index;
    currentChapter(panels[index], index / Math.max(1, panels.length - 1));
    if (settled) document.dispatchEvent(new CustomEvent('deck-settled', { detail: { panel: panels[index] } }));
  }
  function settle() {
    clearTimeout(settleTimer); settleTimer = 0;
    if (touch || measuring || locked || animationFrame) return;
    moving = false;
    if (pendingMeasure) measure();
    else { restorePosition(); publish(true); }
  }
  function schedule() {
    if (measuring || locked) return;
    if (!frame) frame = requestAnimationFrame(() => publish());
    if (animationFrame || touch) return;
    clearTimeout(settleTimer); settleTimer = setTimeout(settle, 140);
  }
  function stopAnimation() {
    cancelAnimationFrame(animationFrame); animationFrame = 0;
    clearTimeout(settleTimer); settleTimer = 0;
  }
  function glideTouch(panel) {
    stopAnimation();
    selectedPanel = panel;
    track.style.removeProperty('scroll-snap-type');
    const left = selectedIndex() * measurement.width;
    moving = Math.abs(track.scrollLeft - left) > 1;
    // Keep native mandatory snap and hand the destination to the compositor.
    // No instant scroll or JS frame loop interrupts finger momentum on release.
    track.scrollTo({ left, behavior: reduced.matches ? 'instant' : 'smooth' });
    if (!moving || reduced.matches) { moving = false; publish(true); }
    else { clearTimeout(settleTimer); settleTimer = setTimeout(settle, 700); }
  }
  function go(panel, smooth = false, releaseVelocity = 0) {
    const index = panels.indexOf(panel);
    if (index < 0 || !measurement) return;
    stopAnimation();
    selectedPanel = panel;
    const left = index * measurement.width, from = track.scrollLeft, distance = left - from;
    moving = smooth && !reduced.matches && Math.abs(distance) > 1;
    track.style.scrollSnapType = 'none';
    // Cancel native inertia before one continuous, frame-driven glide. CSS snap
    // is restored at the exact boundary, so it cannot interrupt the easing.
    track.scrollTo({ left: from, behavior: 'instant' });
    if (!moving) {
      track.scrollTo({ left, behavior: 'instant' });
      track.style.removeProperty('scroll-snap-type'); publish(true); return;
    }
    const duration = releaseVelocity ? Math.max(280, Math.min(500, 500 * Math.abs(distance) / measurement.width)) : 560;
    // Wheel/keyboard/link changes use a cubic curve with zero endpoint
    // velocities. Touch releases take the native compositor path above.
    const tangent = Math.max(0, Math.min(2.4, releaseVelocity * duration / distance));
    const started = performance.now();
    function glide(now) {
      const t = Math.min(1, (now - started) / duration);
      const eased = (3 * t * t - 2 * t * t * t) + tangent * (t * t * t - 2 * t * t + t);
      track.scrollTo({ left: from + distance * eased, behavior: 'instant' });
      publish();
      if (t < 1) animationFrame = requestAnimationFrame(glide);
      else {
        animationFrame = 0; moving = false;
        track.style.removeProperty('scroll-snap-type'); settle();
      }
    }
    animationFrame = requestAnimationFrame(glide);
  }
  function measure(initial = false) {
    if (locked || touch || moving) { pendingMeasure = true; return; }
    pendingMeasure = false;
    const nextKey = `${root.clientWidth}:${pin.clientHeight}:${document.fonts.status}`;
    // Stable image frames do not need a DOM rebuild for each lazy-image load.
    if (!initial && nextKey === sizeKey && !pagination.needsLayout()) return;
    const layoutStarted = performance.now();
    measuring = true;
    track.style.scrollSnapType = 'none';
    const target = pagination.layout(selectedPanel);
    panels = [...track.children];
    measurement = measureTrack(track, panels);
    measurement.layoutMilliseconds = performance.now() - layoutStarted;
    measurement.boxes.forEach(box => { box.start = box.left; box.overflow = 0; });
    trigger.end = measurement.travel;
    selectedPanel = initial ? panels[0] : target;
    sizeKey = nextKey;
    restorePosition();
    track.style.removeProperty('scroll-snap-type');
    measuring = false;
    publish(true);
  }
  function queueMeasure() {
    if (!resizeFrame && !disposed) resizeFrame = requestAnimationFrame(() => { resizeFrame = 0; measure(); });
  }

  // A light wheel gesture advances once. All inertial events in that same
  // gesture are consumed until it goes quiet, rather than retriggering a timer.
  let wheelDelta = 0, wheelLast = -Infinity, wheelConsumed = false;
  function onWheel(event) {
    if (locked || event.ctrlKey || event.target.closest('dialog')) return;
    event.preventDefault();
    const now = performance.now();
    const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    if (now - wheelLast > 180) { wheelDelta = 0; wheelConsumed = false; }
    wheelLast = now;
    if (wheelConsumed) return;
    wheelDelta += delta * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? innerWidth : 1);
    if (Math.abs(wheelDelta) < 4) return;
    wheelConsumed = true;
    go(panels[clamp(selectedIndex() + Math.sign(wheelDelta))], true);
  }
  function onKey(event) {
    if (locked || event.target.closest('dialog,input,textarea,select') || event.altKey || event.ctrlKey || event.metaKey) return;
    const offsets = { ArrowRight: 1, ArrowDown: 1, PageDown: 1, ' ': event.shiftKey ? -1 : 1, ArrowLeft: -1, ArrowUp: -1, PageUp: -1 };
    if (event.key === ' ' && event.target.closest('a,button')) return;
    const index = offsets[event.key] !== undefined ? clamp(selectedIndex() + offsets[event.key]) : event.key === 'Home' ? 0 : event.key === 'End' ? panels.length - 1 : null;
    if (index === null) return;
    event.preventDefault(); go(panels[index], true);
  }
  track.addEventListener('touchstart', event => {
    if (locked || event.touches.length !== 1 || event.target.closest('dialog')) return;
    const point = event.touches[0];
    stopAnimation(); moving = false;
    track.style.removeProperty('scroll-snap-type');
    const index = clamp(Math.round(track.scrollLeft / measurement.width));
    selectedPanel = panels[index];
    touch = { index, x: point.clientX, y: point.clientY, lastX: point.clientX, lastY: point.clientY, time: performance.now(), velocity: 0 };
  }, { passive: true });
  track.addEventListener('touchmove', event => {
    if (!touch || event.touches.length !== 1) return;
    const point = event.touches[0], now = performance.now();
    touch.velocity = (point.clientX - touch.lastX) / Math.max(1, now - touch.time);
    touch.lastX = point.clientX; touch.lastY = point.clientY; touch.time = now;
    if (Math.abs(touch.lastX - touch.x) > 12) suppressClickUntil = now + 500;
  }, { passive: true });
  track.addEventListener('touchend', () => {
    if (!touch) return;
    const gesture = touch; touch = null;
    const dx = gesture.lastX - gesture.x, dy = gesture.lastY - gesture.y;
    const horizontal = Math.abs(dx) > Math.abs(dy) * 1.15;
    const deliberate = Math.abs(dx) >= 24;
    const flick = Math.abs(dx) >= 12 && Math.abs(gesture.velocity) >= .18;
    const index = horizontal && (deliberate || flick) ? clamp(gesture.index - Math.sign(dx)) : gesture.index;
    // Native dragging stays continuous; only the release target is assisted.
    requestAnimationFrame(() => { if (!locked && !disposed) glideTouch(panels[index]); });
  }, { passive: true });
  track.addEventListener('touchcancel', () => { touch = null; glideTouch(selectedPanel); }, { passive: true });
  track.addEventListener('click', event => {
    if (event.isTrusted && performance.now() < suppressClickUntil) { event.preventDefault(); event.stopImmediatePropagation(); }
  }, true);
  const engine = {
    native: true, lenis, trigger, get measurement() { return measurement; }, go,
    reveal(element) { if (!measuring) go(element.closest('[data-horizontal-panel]')); }, refresh: queueMeasure,
    lock() { stopAnimation(); moving = false; touch = null; restorePosition(); track.style.removeProperty('scroll-snap-type'); locked = true; lenis.isStopped = true; trigger.enabled = false; root.setAttribute('data-scroll-locked', ''); },
    unlock() { locked = false; lenis.isStopped = false; trigger.enabled = true; root.removeAttribute('data-scroll-locked'); if (pendingMeasure) measure(); else publish(true); },
  };
  window.portfolioMotion = engine;
  measure(true);
  track.addEventListener('scroll', schedule, { passive: true });
  track.addEventListener('load', queueMeasure, true);
  track.addEventListener('scrollend', () => {
    if (!touch && measurement && Math.abs(track.scrollLeft - selectedIndex() * measurement.width) <= 1) settle();
  });
  track.addEventListener('wheel', onWheel, { passive: false });
  addEventListener('keydown', onKey); addEventListener('resize', queueMeasure, { passive: true });
  const observer = new ResizeObserver(queueMeasure); observer.observe(pin);
  document.fonts.ready.then(queueMeasure);
  addEventListener('pagehide', () => { disposed = true; stopAnimation(); cancelAnimationFrame(frame); cancelAnimationFrame(resizeFrame); observer.disconnect(); });
  addEventListener('pageshow', event => { if (event.persisted) { disposed = false; observer.observe(pin); measure(); } });
  onReady(); return engine;
}
