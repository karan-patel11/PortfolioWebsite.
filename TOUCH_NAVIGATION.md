# Bidirectional touch navigation — complete drop-in code

Replace the complete contents of `src/motion.js` starting at line 1 with the JavaScript below. The existing `src/main.js` import at line 3 and `initHorizontal({currentChapter,pagination})` call at line 117 already initialize it. The measured paginator and `src/horizontal-layout.js` remain the existing dependencies. The generated `dist/motion.js` is produced by the build.

Update the existing track and panel CSS declarations in `src/viewport-deck.css` at lines 17–27 with the CSS below, preserving their other sizing/layout properties. Its selectors also allow it to be pasted at the end of that stylesheet.

Up/left advances; down/right reverses. A single finger locks to its dominant axis after 10px, follows the finger through one requestAnimationFrame write per frame, and can travel/release only to the adjacent page. A 24px deliberate swipe qualifies, or a 12px flick at 0.18px/ms with a recent velocity sample. Short pulls return to their starting page. Diagonals lock once and cannot switch axes midway. Swipe-generated clicks are suppressed for 500ms; taps remain available. Cancellation or adding a second finger returns to the starting page. CSS permits pinch zoom and prevents native page pan/bounce. Dialogs lock the background deck.

Wheel input uses the dominant deltaX/deltaY, converts line/page units to pixels and accumulates a signed 4px intent threshold. It moves the horizontal scrollLeft to one adjacent snap point with a 560ms glide. Events in the same inertia burst are consumed until 180ms of silence; raw wheel accumulation cannot skip several pages. Ctrl-wheel remains available for browser zoom. Keyboard and chapter-link navigation continue through the same engine.

## Complete JavaScript

```js
import { measureTrack } from './horizontal-layout.js';

// Both touch axes drive the horizontal track. Page selection belongs to input,
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
  let animationFrame = 0, touchFrame = 0;
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
    if (touch) return;
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
  // Own single-finger panning on both axes; CSS still permits pinch zoom.
  // Lock direction after 10px, follow the finger once per animation frame,
  // and clamp travel/release to one neighboring page for the entire gesture.
  const AXIS_THRESHOLD = 10, SWIPE_THRESHOLD = 24, FLICK_THRESHOLD = 12;
  function drawTouch() {
    touchFrame = 0;
    if (!touch?.axis || locked || disposed) return;
    const delta = touch.axis === 'x' ? touch.lastX - touch.x : touch.lastY - touch.y;
    const minimum = clamp(touch.index - 1) * measurement.width;
    const maximum = clamp(touch.index + 1) * measurement.width;
    track.scrollTo({ left: Math.max(minimum, Math.min(maximum, touch.left - delta)), behavior: 'instant' });
  }
  function updateTouch(point, now) {
    const dx = point.clientX - touch.x, dy = point.clientY - touch.y;
    if (!touch.axis && Math.max(Math.abs(dx), Math.abs(dy)) >= AXIS_THRESHOLD) {
      touch.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
    }
    if (touch.axis) {
      const delta = touch.axis === 'x' ? point.clientX - touch.lastX : point.clientY - touch.lastY;
      // End coordinates often repeat the last move; retain its flick velocity.
      if (delta) { touch.velocity = delta / Math.max(1, now - touch.time); touch.velocityTime = now; }
      track.style.scrollSnapType = 'none';
      if (Math.max(Math.abs(dx), Math.abs(dy)) >= FLICK_THRESHOLD) suppressClickUntil = now + 500;
    }
    touch.lastX = point.clientX; touch.lastY = point.clientY; touch.time = now;
  }
  function finishTouch(cancelled = false) {
    if (!touch) return;
    cancelAnimationFrame(touchFrame); touchFrame = 0;
    if (!cancelled) drawTouch();
    const gesture = touch; touch = null;
    const delta = gesture.axis === 'x' ? gesture.lastX - gesture.x : gesture.lastY - gesture.y;
    const deliberate = Math.abs(delta) >= SWIPE_THRESHOLD;
    const flick = Math.abs(delta) >= FLICK_THRESHOLD && Math.abs(gesture.velocity) >= .18 && performance.now() - gesture.velocityTime < 100;
    const index = !cancelled && gesture.axis && (deliberate || flick) ? clamp(gesture.index - Math.sign(delta)) : gesture.index;
    if (!locked && !disposed) glideTouch(panels[index]);
  }
  track.addEventListener('touchstart', event => {
    if (event.touches.length !== 1) { finishTouch(true); return; }
    if (locked || disposed || !measurement || event.target.closest('dialog')) return;
    // A new finger contact is fresh intent, including a tap just after a swipe.
    suppressClickUntil = 0;
    const point = event.touches[0];
    stopAnimation(); moving = false;
    cancelAnimationFrame(touchFrame); touchFrame = 0;
    // Stop a prior smooth release at its actual location before a new drag.
    track.scrollTo({ left: track.scrollLeft, behavior: 'instant' });
    track.style.removeProperty('scroll-snap-type');
    const index = clamp(Math.round(track.scrollLeft / measurement.width));
    selectedPanel = panels[index];
    touch = { index, id: point.identifier, left: track.scrollLeft, axis: null, x: point.clientX, y: point.clientY, lastX: point.clientX, lastY: point.clientY, time: performance.now(), velocity: 0, velocityTime: -Infinity };
  }, { passive: true });
  track.addEventListener('touchmove', event => {
    if (!touch || locked || disposed) return;
    if (event.touches.length !== 1) { finishTouch(true); return; }
    const point = [...event.touches].find(point => point.identifier === touch.id);
    if (!point) { finishTouch(true); return; }
    updateTouch(point, performance.now());
    if (touch.axis) {
      if (event.cancelable) event.preventDefault();
      if (!touchFrame) touchFrame = requestAnimationFrame(drawTouch);
    }
  }, { passive: false });
  track.addEventListener('touchend', event => {
    if (!touch) return;
    const point = [...event.changedTouches].find(point => point.identifier === touch.id);
    if (point) updateTouch(point, performance.now());
    finishTouch();
  }, { passive: true });
  track.addEventListener('touchcancel', () => finishTouch(true), { passive: true });
  track.addEventListener('click', event => {
    if (event.isTrusted && event.detail > 0 && performance.now() < suppressClickUntil) { event.preventDefault(); event.stopImmediatePropagation(); }
  }, true);
  const engine = {
    native: true, lenis, trigger, get measurement() { return measurement; }, go,
    reveal(element) { if (!measuring) go(element.closest('[data-horizontal-panel]')); }, refresh: queueMeasure,
    lock() { stopAnimation(); cancelAnimationFrame(touchFrame); touchFrame = 0; moving = false; touch = null; restorePosition(); track.style.removeProperty('scroll-snap-type'); locked = true; lenis.isStopped = true; trigger.enabled = false; root.setAttribute('data-scroll-locked', ''); },
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
  addEventListener('pagehide', () => { disposed = true; stopAnimation(); cancelAnimationFrame(touchFrame); touchFrame = 0; touch = null; cancelAnimationFrame(frame); cancelAnimationFrame(resizeFrame); observer.disconnect(); });
  addEventListener('pageshow', event => { if (event.persisted) { disposed = false; observer.observe(pin); measure(); } });
  onReady(); return engine;
}
```

## Required CSS

```css
html, body, main { overflow: hidden; overscroll-behavior: none; }
[data-horizontal-track],
html[data-horizontal-active] [data-horizontal-track],
html[data-native-scroll] [data-horizontal-track] {
  overflow-x: auto;
  overflow-y: hidden;
  scroll-snap-type: x mandatory;
  scroll-behavior: smooth;
  overscroll-behavior: none;
  touch-action: pinch-zoom;
  -webkit-overflow-scrolling: touch;
}
[data-horizontal-panel],
html[data-horizontal-active] [data-horizontal-panel],
html[data-native-scroll] [data-horizontal-panel] {
  touch-action: pinch-zoom;
  overscroll-behavior: none;
}
html[data-scroll-locked] [data-horizontal-track] { overflow: hidden; }
```

## Build and verify

```sh
npm run build
npm run lint
PORTFOLIO_GESTURES_ONLY=1 npm test
npm test
```

Testing uses local Chrome with emulated touch input, including phone and tablet sizes. Physical iOS/Android devices are not represented by these measurements.

## Local verification notes

Final production-path navigation regression: 219 checks passed with zero failures in 134.72 seconds. This includes vertical/horizontal/diagonal input on phone and tablet profiles, small-motion rejection, reverse gestures, page boundaries, cancellation, adding a second finger, monotonic drag/release frames, card gesture handoff, vertical/horizontal desktop wheel input, inertia tails and idle-page stability.

Intro/ticker regression: 143 checks passed with zero failures in 77.35 seconds across seven emulated sizes. Immediate tap/keyboard activation plus short and diagonal gestures passed seven focused browser checks. Build, syntax lint and whitespace checks passed.

Chrome's emulated touch input received a fresh phone target after desktop wheel tests because the reused widget could drop the entire first touch stream; this is isolated in the test driver. The production handler requires no browser-specific workaround. The full 22-size regression and framing audit also run as deployment gates in GitHub Actions.
