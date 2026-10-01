import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

// Real Chrome and its native DevTools protocol; no browser-test dependency.
// Touch input is emulated, so these checks do not replace physical-device QA.
const {basePath=''} = JSON.parse(readFileSync('dist/site-config.json','utf8'));
const base = (process.env.PORTFOLIO_TEST_URL || `http://localhost:4173${basePath}`).replace(/\/$/,'');
const out = 'comparison/framing-review';
const viewports = [[320,568],[320,701],[360,640],[375,667],[375,812],[390,844],[393,852],[412,915],[600,960],[767,900],[768,1024],[820,1180],[900,600],[1024,568],[1024,768],[1280,720],[1366,768],[1440,900],[1920,1080],[2560,1440],[667,375],[844,390]];
const order = ['intro', 'about', 'education', 'experience', 'venture', 'selected-work', 'contact'];
mkdirSync(out, { recursive: true });
const profile = mkdtempSync(join(tmpdir(), 'portfolio-mobile-'));
const chrome = spawn(process.env.CHROME_PATH || (process.platform==='darwin'?'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome':'/usr/bin/google-chrome'), [
  '--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`,
  '--no-first-run', '--no-default-browser-check', '--disable-background-networking', '--disable-dev-shm-usage', 'about:blank',
], { stdio: ['ignore', 'ignore', 'pipe'], detached:process.platform!=='win32' });
const report = {
  scope: { targetURL: base, viewports, headless: true, touchEmulated: true, physicalDevice: false },
  browser: null, matrix: [], reduced: [], themes: [], gestures: [], metrics: null,
  navigation: null, detail: null, resize: null, noScript: null, screenshots: [], console: [], failures: [],
};
let chromeOutput = '', server, ws, sessionId, call, evaluate, closeBrowser, navigationId = 0, assertions = 0;
const started = Date.now();
chrome.stderr.on('data', chunk => { chromeOutput += chunk; });
chrome.on('error', error => { chromeOutput += error.message; });
function assert(condition, message) {
  assertions++;
  if (!condition) report.failures.push(message);
  return Boolean(condition);
}
async function until(fn, label, timeout = 5000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const value = await fn();
    if (value) return value;
    await delay(30);
  }
  throw Error(`Timed out: ${label}`);
}
function save() {
  report.assertions = assertions;
  report.elapsedSeconds = Number(((Date.now() - started) / 1000).toFixed(2));
  writeFileSync(join(out, 'results.json'), JSON.stringify(report, null, 2) + '\n');
}
async function configure(width, height, reduced = false) {
  const coarse = width < 1024;
  await call('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: coarse });
  await call('Emulation.setTouchEmulationEnabled', { enabled: coarse, maxTouchPoints: 1 });
  await call('Emulation.setEmulatedMedia', { features: [
    { name: 'prefers-reduced-motion', value: reduced ? 'reduce' : 'no-preference' },
    { name: 'prefers-color-scheme', value: 'dark' },
  ] });
}
async function navigate(hash = '#intro') {
  const url = `${base}/?mobile-verification=${++navigationId}${hash}`;
  await evaluate("if(document.documentElement)document.documentElement.dataset.ready='navigating'");
  await call('Page.navigate', { url });
  await until(() => evaluate(`location.href.split('#')[0] === ${JSON.stringify(url.split('#')[0])} && document.documentElement?.dataset.ready === 'true'`), 'app readiness', 12000);
}
async function frames() {
  await evaluate('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
}
async function position(id) {
  await evaluate(`window.portfolioMotion.go(document.getElementById(${JSON.stringify(id)}))`);
  await frames();
}
async function key(key, modifiers = 0) {
  const params = { key, code: key, modifiers, ...(key==='Enter'?{text:'\r',unmodifiedText:'\r'}:{}), windowsVirtualKeyCode: { Tab: 9, Escape: 27, Enter: 13 }[key] };
  await call('Input.dispatchKeyEvent', { type: 'keyDown', ...params });
  await call('Input.dispatchKeyEvent', { type: 'keyUp', ...params });
}
async function click(selector) {
  const point = await evaluate(`(() => {
    const e = [...document.querySelectorAll(${JSON.stringify(selector)})].find(e => {
      const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden';
    });
    if (!e) throw Error('No visible control: ' + ${JSON.stringify(selector)});
    const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  })()`);
  await call('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button: 'left', clickCount: 1 });
  await call('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point, button: 'left', clickCount: 1 });
}
async function shot(name) {
  const result = await call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  const path = join(out, `${name}.png`);
  writeFileSync(path, Buffer.from(result.data, 'base64'));
  report.screenshots.push(path);
  return path;
}
try {
  try { await fetch(base); } catch {
    server = spawn(process.execPath, ['scripts/serve.mjs'], { stdio: 'ignore' });
    await until(() => fetch(base).then(r => r.ok).catch(() => false), 'local server');
  }
  const endpoint = await until(() => chromeOutput.match(/DevTools listening on (ws:\/\/\S+)/)?.[1], 'Chrome launch',30000);
  ws = new WebSocket(endpoint);
  await new Promise(resolve => ws.addEventListener('open', resolve, { once: true }));
  let nextId = 0;
  const pending = new Map();
  ws.addEventListener('message', ({ data }) => {
    const message = JSON.parse(data);
    if (message.id) {
      const entry = pending.get(message.id); pending.delete(message.id);
      if (!entry) return;
      message.error ? entry.reject(Error(JSON.stringify(message.error))) : entry.resolve(message.result);
    } else if (message.sessionId === sessionId && message.method === 'Runtime.exceptionThrown') report.console.push(message.params);
  });
  const send = (method, params = {}, session) => new Promise((resolve, reject) => {
    const id = ++nextId;
    const timer = setTimeout(() => { pending.delete(id); reject(Error(`${method}: local Chrome timed out`)); }, 15000);
    pending.set(id, { resolve: value => { clearTimeout(timer); resolve(value); }, reject: error => { clearTimeout(timer); reject(error); } });
    ws.send(JSON.stringify({ id, method, params, sessionId: session }));
  });
  closeBrowser=()=>send('Browser.close');
  report.browser = await send('Browser.getVersion');
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  ({ sessionId } = await send('Target.attachToTarget', { targetId, flatten: true }));
  call = (method, params = {}) => send(method, params, sessionId);
  evaluate = async expression => {
    const result = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    return result.result.value;
  };
  await call('Page.enable'); await call('Runtime.enable'); await call('Network.enable');
  // The main UX remains functional when every third-party CDN request is blocked.
  await call('Network.setBlockedURLs', { urls: ['*cdn.jsdelivr.net*', '*unpkg.com*'] });



  await call('Page.addScriptToEvaluateOnNewDocument',{source:`window.__cls=[];new PerformanceObserver(list=>list.getEntries().forEach(e=>{if(!e.hadRecentInput)window.__cls.push(e.value)})).observe({type:'layout-shift',buffered:true})`});
  report.framing=[];
  for(const [width,height] of viewports){
    await configure(width,height);await navigate('#education');await delay(650);
    const row=await evaluate(`(()=>{const panel=document.getElementById('education'),r=panel.getBoundingClientRect(),style=getComputedStyle(panel);const box=n=>{const a=n.getBoundingClientRect();return {x:a.x,y:a.y,width:a.width,height:a.height,right:a.right,bottom:a.bottom}};const cards=[...panel.querySelectorAll('.education-card')].map(card=>({id:card.id,...box(card),padding:getComputedStyle(card).padding,button:box(card.querySelector('button')),ticker:box(card.querySelector('.course-ticker')),degreeSize:parseFloat(getComputedStyle(card.querySelector('.degree')).fontSize),courses:card.querySelector('.ticker-group').children.length}));const bad=[...panel.querySelectorAll('h3,p,button,.course-ticker,picture')].filter(n=>n.getClientRects().length&&!(n.matches('.coursework-label')&&getComputedStyle(n).position==='absolute')).flatMap(n=>{const a=n.getBoundingClientRect();return a.bottom>r.bottom-parseFloat(style.paddingBottom)+1||a.right>r.right-parseFloat(style.paddingRight)+1||a.left<r.left+parseFloat(style.paddingLeft)-1?[n.className||n.tagName]:[]});return {width:innerWidth,height:innerHeight,cards,bad,pages:[...document.querySelectorAll('[data-horizontal-panel]')].filter(n=>(n.dataset.chapter||n.id)==='education').length,overflowX:panel.scrollWidth-panel.clientWidth,overflowY:panel.scrollHeight-panel.clientHeight,documentOverflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,cls:window.__cls.reduce((a,b)=>a+b,0),ready:document.documentElement.dataset.ready,pending:document.documentElement.hasAttribute('data-deck-pending')}})()`);
    const [first,second]=row.cards;const columns=Math.abs(first.y-second.y)<1;
    assert(row.pages===1&&row.cards.length===2,`${width}x${height}: one complete Education section`);
    assert(!row.bad.length&&row.overflowX<=1&&row.overflowY<=1&&row.documentOverflow<=1,`${width}x${height}: cards and tickers stay inside their frames ${JSON.stringify(row)}`);
    assert(row.cards.every(c=>c.degreeSize>=14&&c.button.height>=44&&c.button.width>=44&&c.ticker.height>=33),`${width}x${height}: readable metadata and usable controls`);
    assert(columns?Math.abs(first.height-second.height)<1&&Math.abs(first.button.y-second.button.y)<1:Math.abs(first.x-second.x)<1&&Math.abs(first.width-second.width)<1&&second.y-first.bottom>=9&&second.y-first.bottom<=21,`${width}x${height}: aligned ${columns?'columns and controls':'stacked margins and spacing'} ${JSON.stringify(row.cards)}`);
    assert(row.cls===0&&row.ready==='true'&&!row.pending,`${width}x${height}: deep-link first paint has zero layout shift (${row.cls})`);
    row.columns=columns;report.framing.push(row);
    if([[320,568],[375,667],[375,812],[820,1180],[900,600],[1440,900]].some(([w,h])=>w===width&&h===height))await shot(`${width}x${height}-education`);
    save();console.log(`${width}x${height}: education ${columns?'columns':'stacked'}, CLS ${row.cls}; failures ${report.failures.length}`);
  }
  report.deepLinks=[];
  for(const [width,height] of [[375,812],[820,1180],[1440,900]]){
    await configure(width,height);
    for(const id of order){
      await navigate(`#${id}`);await delay(id==='venture'?2400:650);
      const row=await evaluate(`(()=>{const p=document.getElementById('${id}');return {chapter:document.documentElement.dataset.activeChapter,x:p.getBoundingClientRect().left,overflowX:document.documentElement.scrollWidth-document.documentElement.clientWidth,overflowY:p.scrollHeight-p.clientHeight,cls:window.__cls.reduce((a,b)=>a+b,0)}})()`);
      report.deepLinks.push({width,height,id,...row});
      assert(row.chapter===id&&Math.abs(row.x)<=1&&row.overflowX<=1&&row.overflowY<=1&&row.cls===0,`${width}x${height}: stable fresh ${id} deep link ${JSON.stringify(row)}`);
    }
  }
  assert(report.console.length===0,'no runtime exceptions');
} catch (error) {
  report.failures.push(error.stack); console.error(error);
  if(!report.browser&&chromeOutput) console.error('Chrome startup diagnostics:',chromeOutput.slice(-4000));
} finally {
  save();
  console.log(`Viewport deck: ${assertions} assertions, ${report.failures.length} failures, ${report.elapsedSeconds}s`);
  if (report.failures.length) console.log(report.failures.join('\n'));
  if(closeBrowser&&ws?.readyState===WebSocket.OPEN) await Promise.race([closeBrowser().catch(()=>{}),delay(1500)]);
  ws?.close(); server?.kill();
  // Chrome launchers can exit before their children; terminate only this test's
  // dedicated process group, never an existing user browser.
  const stopChrome = signal => {try{if(process.platform!=='win32'&&chrome.pid)process.kill(-chrome.pid,signal);else chrome.kill(signal)}catch(error){if(error.code!=='ESRCH')throw error}};
  stopChrome('SIGTERM');
  await Promise.race([new Promise(resolve=>{if(chrome.exitCode!==null||chrome.signalCode!==null)resolve();else chrome.once('exit',resolve)}),delay(2000)]);
  stopChrome('SIGKILL');await delay(100);
  try{rmSync(profile, { recursive: true, force: true, maxRetries:5, retryDelay:100 })}catch(error){
    // A disposable CI profile does not invalidate completed application checks.
    report.cleanupWarning=error.message;save();console.warn('Temporary profile cleanup:',error.message);
  }
}
process.exitCode = report.failures.length ? 1 : 0;
