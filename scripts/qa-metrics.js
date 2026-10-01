// Loaded only by the local /__qa/ fixture, never by production pages.
const report = document.createElement('output');
report.id = 'qa-metrics';
report.hidden = true;
document.body.append(report);
const metrics = { lcpMs: null, cls: 0, maximumInteractionMs: null };
const observers = [];
function observe(type, callback, options = {}) {
  if (!PerformanceObserver.supportedEntryTypes.includes(type)) return;
  const observer = new PerformanceObserver(list => {
    list.getEntries().forEach(callback);
    report.textContent = JSON.stringify(metrics);
  });
  observer.observe({ type, buffered: true, ...options });
  observers.push(observer);
}
observe('largest-contentful-paint', entry => { metrics.lcpMs = Math.round(entry.startTime); });
observe('layout-shift', entry => { if (!entry.hadRecentInput) metrics.cls += entry.value; });
observe('event', entry => {
  if (entry.interactionId) metrics.maximumInteractionMs = Math.max(metrics.maximumInteractionMs || 0, entry.duration);
}, { durationThreshold: 16 });
window.addEventListener('pagehide', () => observers.forEach(observer => observer.disconnect()));
