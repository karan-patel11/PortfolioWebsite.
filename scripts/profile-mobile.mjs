import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

// CDP touch input + renderer metrics. rAF cadence is a lab proxy, not proof of
// physical-device compositor FPS. The trace can be opened in Chrome Performance.
const { basePath = '' } = JSON.parse(readFileSync('dist/site-config.json', 'utf8'));
const url = `http://localhost:4173${basePath}/`;
const label = process.env.PROFILE_LABEL || 'final';
const out = `comparison/mobile-overhaul/${label}`;
mkdirSync(out, { recursive: true });
const profile = mkdtempSync(join(tmpdir(), 'portfolio-profile-'));
const chrome = spawn(process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
  '--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`,
  '--no-first-run', '--no-default-browser-check', '--disable-background-networking', 'about:blank',
], { stdio: ['ignore', 'ignore', 'pipe'] });
let output = '', ws;
chrome.stderr.on('data', chunk => { output += chunk; });
const report = { url, physicalDevice: false, touchEmulated: true, cases: [], failures: [] };
async function until(fn, name, timeout = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeout) { const value = await fn(); if (value) return value; await delay(30); }
  throw Error(`Timeout: ${name}`);
}
try {
  const endpoint = await until(() => output.match(/DevTools listening on (ws:\/\/\S+)/)?.[1], 'Chrome');
  ws = new WebSocket(endpoint);
  await new Promise(resolve => ws.addEventListener('open', resolve, { once: true }));
  let next = 0;
  const pending = new Map(), listeners = new Map();
  ws.addEventListener('message', ({ data }) => {
    const message = JSON.parse(data);
    if (message.id) {
      const entry = pending.get(message.id); pending.delete(message.id);
      message.error ? entry.reject(Error(JSON.stringify(message.error))) : entry.resolve(message.result);
    } else listeners.get(message.method)?.(message.params);
  });
  const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
    const id = ++next; pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params, sessionId }));
  });
  report.browser = await send('Browser.getVersion');
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  const call = (method, params = {}) => send(method, params, sessionId);
  const evaluate = async expression => {
    const result = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    return result.result.value;
  };
  await call('Page.enable'); await call('Runtime.enable'); await call('Performance.enable');
  await call('Page.addScriptToEvaluateOnNewDocument', { source: `
    window.__shifts = []; window.__longTasks = [];
    new PerformanceObserver(list => list.getEntries().forEach(e => window.__shifts.push({value:e.value,recentInput:e.hadRecentInput}))).observe({type:'layout-shift',buffered:true});
    new PerformanceObserver(list => list.getEntries().forEach(e => window.__longTasks.push(e.duration))).observe({type:'longtask',buffered:true});
  ` });
  const metrics = async () => Object.fromEntries((await call('Performance.getMetrics')).metrics
    .filter(m => ['LayoutCount', 'RecalcStyleCount', 'LayoutDuration', 'ScriptDuration', 'TaskDuration'].includes(m.name)).map(m => [m.name, m.value]));
  const diff = (before, after) => Object.fromEntries(Object.keys(before).map(k => [k, +(after[k] - before[k]).toFixed(6)]));
  const shot = async name => {
    const result = await call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    writeFileSync(join(out, `${name}.png`), Buffer.from(result.data, 'base64'));
  };
  const swipe = async (width, height, axis, reverse = false) => {
    const x = width * (reverse ? .18 : .82), y = height * .55;
    await call('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    for (let n = 1; n <= 12; n++) {
      await call('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{
        x: axis === 'x' ? x + width * .64 * n / 12 * (reverse ? 1 : -1) : x,
        y: axis === 'y' ? y - height * .4 * n / 12 : y,
      }] });
      await delay(16);
    }
    await call('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await delay(650);
  };
  for (const [device, width, height] of [
    ['small-phone', 320, 568], ['iPhone-SE', 375, 667], ['iPhone-15', 390, 844], ['iPhone-15-Pro', 393, 852],
    ['Pixel-8', 412, 915], ['iPad-portrait', 820, 1180], ['iPad-landscape', 1180, 820], ['laptop', 1440, 900],
  ]) {
    await call('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 2, mobile: true });
    await call('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    await call('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });
    await evaluate("if(document.documentElement)document.documentElement.dataset.ready='navigating'");
    await call('Page.navigate', { url: `${url}?profile=${device}-${label}` });
    await until(() => evaluate('document.documentElement?.dataset.ready === "true"'), 'ready');
    await until(() => evaluate("document.documentElement?.dataset.introState === 'complete'"), 'intro completion');
    const state = await evaluate(`(() => ({native:document.documentElement.hasAttribute('data-native-scroll'),
      theme:document.documentElement.dataset.theme,overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,
      snap:getComputedStyle(document.querySelector('[data-horizontal-track]')).scrollSnapType,
      touch:getComputedStyle(document.querySelector('[data-horizontal-panel]')).touchAction}))()`);
    // Screenshot the actual layouts, including long education copy and metrics.
    const panels = [];
    for (const id of ['intro', 'about', 'education', 'experience', 'venture', 'selected-work', 'contact']) {
      await evaluate(`window.portfolioMotion.go(document.getElementById('${id}'))`); await delay(850);
      panels.push(await evaluate(`(() => {const p=document.getElementById('${id}'),r=p.getBoundingClientRect();return {id:p.id,left:r.left,overflow:p.scrollWidth-p.clientWidth,vertical:p.scrollHeight-p.clientHeight}})()`));
      await shot(`${device}-${id}`);
      if (id === 'intro') await evaluate("document.querySelector('[data-hint-dismiss]').click()");
      if (id === 'education') {
        await evaluate("window.portfolioMotion.reveal(document.querySelector('#nmims h3'))");
        await delay(100); await shot(`${device}-nmims`);
        // Coursework is clipped by a paint boundary, never an inner scroller.
      }
    }
    await evaluate("window.portfolioMotion.go(document.getElementById('intro'))"); await delay(200);
    const before = await metrics();
    await evaluate(`window.__frames=[];window.__sampling=true;window.__last=undefined;
      requestAnimationFrame(function sample(t){if(window.__last!==undefined)window.__frames.push(t-window.__last);window.__last=t;if(window.__sampling)requestAnimationFrame(sample)})`);
    const trace = [];
    let completed;
    const traceDone = new Promise(resolve => { completed = resolve; });
    listeners.set('Tracing.dataCollected', params => trace.push(...params.value));
    listeners.set('Tracing.tracingComplete', completed);
    if (device === 'iPhone-15') await call('Tracing.start', { categories: 'devtools.timeline,blink.user_timing,cc,benchmark', transferMode: 'ReportEvents' });
    for (let i = 0; i < 3; i++) await swipe(width, height, 'x');
    for (let i = 0; i < 3; i++) await swipe(width, height, 'x', true);
    await swipe(width, height, 'y');
    await evaluate('window.__sampling=false');
    if (device === 'iPhone-15') {
      await call('Tracing.end'); await traceDone;
      writeFileSync(join(out, 'touch-trace.json'), JSON.stringify({ traceEvents: trace }));
    }
    const after = await metrics();
    const cadence = await evaluate(`(() => {const t=window.__frames.sort((a,b)=>a-b);return {frames:t.length,
      medianMs:t[Math.floor(t.length*.5)],p95Ms:t[Math.floor(t.length*.95)],maxMs:t.at(-1),over34ms:t.filter(n=>n>34).length,
      approximateFPS:1000/(t.reduce((a,b)=>a+b,0)/t.length),longTasks:window.__longTasks,
      totalLayoutShift:window.__shifts.reduce((s,e)=>s+e.value,0),cls:window.__shifts.filter(e=>!e.recentInput).reduce((s,e)=>s+e.value,0)}})()`);
    await evaluate("window.portfolioMotion.go(document.getElementById('venture'));window.portfolioMotion.reveal(document.querySelector('.metrics'))");
    await delay(2500); await shot(`${device}-metrics`);
    const metricsShift = await evaluate('window.__shifts.reduce((s,e)=>s+e.value,0)');
    const row = { device, width, height, state, panels, cadence, renderer: diff(before, after), metricsShift };
    report.cases.push(row);
    if (panels.some(p => p.overflow > 1) || state.overflow > 1) report.failures.push(`${device}: horizontal overflow`);
    if (cadence.cls > 0 || metricsShift > 0) report.failures.push(`${device}: layout shift`);
    if (cadence.p95Ms > 17 || cadence.over34ms) report.failures.push(`${device}: frame cadence exceeds lab budget`);
    console.log(JSON.stringify(row));
    writeFileSync(join(out, 'results.json'), JSON.stringify(report, null, 2) + '\n');
  }
} catch (error) {
  report.failures.push(error.stack); console.error(error);
} finally {
  writeFileSync(join(out, 'results.json'), JSON.stringify(report, null, 2) + '\n');
  ws?.close(); chrome.kill(); await delay(200); rmSync(profile, { recursive: true, force: true });
}
if (report.failures.length) process.exitCode = 1;
