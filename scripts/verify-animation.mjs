import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

// Real Chrome and its native DevTools protocol; no browser-test dependency.
// Touch input is emulated, so these checks do not replace physical-device QA.
const {basePath=''} = JSON.parse(readFileSync('dist/site-config.json','utf8'));
const base = (process.env.PORTFOLIO_TEST_URL || `http://localhost:4173${basePath}`).replace(/\/$/,'');
const out = 'comparison/animation-review';
const viewports = [[320,568],[375,667],[375,812],[390,844],[393,852],[412,915],[600,960],[767,900],[768,1024],[820,1180],[1024,768],[1280,720],[1366,768],[1440,900],[1920,1080],[2560,1440],[844,390]];
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



  await call('Page.addScriptToEvaluateOnNewDocument', {source:`
    window.__shifts=[];window.__longTasks=[];window.__introStates=[];
    new PerformanceObserver(list=>list.getEntries().forEach(e=>window.__shifts.push({value:e.value,input:e.hadRecentInput}))).observe({type:'layout-shift',buffered:true});
    new PerformanceObserver(list=>list.getEntries().forEach(e=>window.__longTasks.push(e.duration))).observe({type:'longtask',buffered:true});
    new MutationObserver(()=>{const state=document.documentElement?.dataset.introState;if(state&&window.__introStates.at(-1)!==state)window.__introStates.push(state)}).observe(document,{subtree:true,attributes:true,attributeFilter:['data-intro-state']});
  `});
  report.animations=[];
  for(const [device,width,height] of [['small-phone',320,568],['iPhone-SE',375,667],['iPhone-15',390,844],['iPhone-15-Pro',393,852],['Pixel-8',412,915],['tablet',820,1180],['laptop',1440,900]]){
    await configure(width,height);
    const row={device,width,height,loads:[],tickers:[]};
    for(const reload of [false,true]){
      await evaluate("if(document.documentElement)document.documentElement.dataset.ready='navigating'");
      if(reload)await call('Page.reload',{ignoreCache:true});
      else await call('Page.navigate',{url:`${base}/?animation=${device}`});
      await until(()=>evaluate("document.documentElement?.dataset.introState==='running'"),'intro running',12000);
      assert(await evaluate("document.documentElement.hasAttribute('data-intro-pending')&&document.documentElement.dataset.ready==='true'&&Boolean(window.portfolioMotion)"),`${device}: intro armed ${reload?'refresh':'fresh'}`);
      if(!reload){
        await delay(400);
        const overlay=await evaluate(`(()=>{const y=document.querySelector('[data-hero-year]'),n=document.querySelector('[data-hero-name]'),a=y.getBoundingClientRect(),b=n.getBoundingClientRect();return {x:Math.abs(a.left-b.left),y:Math.abs(a.top-b.top),opacity:+getComputedStyle(y.firstElementChild).opacity,font:getComputedStyle(y).fontSize,nameFont:getComputedStyle(n.querySelector('h1')).fontSize}})()`);
        assert(overlay.x<1&&overlay.y<1&&overlay.opacity>.9&&overlay.font===overlay.nameFont,`${device}: visible year stays anchored to reserved name: ${JSON.stringify(overlay)}`);
        await shot(`${device}-opening`);
      }
      await until(()=>evaluate("document.documentElement?.dataset.introState==='complete'"),'intro complete',5000);
      const intro=await evaluate(`({states:window.__introStates,cls:window.__shifts.filter(e=>!e.input).reduce((s,e)=>s+e.value,0),overflow:document.getElementById('intro').scrollHeight-document.getElementById('intro').clientHeight,left:document.querySelector('[data-horizontal-track]').scrollLeft,remote:[...document.scripts].filter(s=>s.src&&new URL(s.src).origin!==location.origin).map(s=>s.src)})`);
      row.loads.push({reload,...intro});
      assert(intro.states.includes('running')&&intro.states.includes('complete')&&intro.cls===0&&intro.overflow<=1&&intro.left===0&&!intro.remote.length,`${device}: local intro completes without shift, overflow or drift on ${reload?'refresh':'fresh load'}: ${JSON.stringify(intro)}`);
    }
    await call('Input.dispatchMouseEvent',{type:'mouseMoved',x:1,y:1});
    for(const id of ['gwu','nmims']){
      await evaluate(`window.portfolioMotion.go(document.getElementById('${id}').closest('[data-horizontal-panel]'))`);await delay(200);
      const selector=`#${id} .ticker-track`;
      const ticker=await evaluate(`(()=>{const el=document.querySelector('${selector}'),card=el.closest('.education-card'),groups=[...el.children],r=card.getBoundingClientRect(),p=card.closest('[data-horizontal-panel]');return {id:'${id}',courses:groups[0].children.length,duplicate:groups[1].getAttribute('aria-hidden'),same:groups[0].textContent===groups[1].textContent,widths:groups.map(g=>g.getBoundingClientRect().width),duration:parseFloat(getComputedStyle(el).animationDuration),state:getComputedStyle(el).animationPlayState,overflow:p.scrollHeight-p.clientHeight,cardBottom:r.bottom,panelBottom:p.getBoundingClientRect().bottom-parseFloat(getComputedStyle(p).paddingBottom)}})()`);
      assert(ticker.courses===(id==='gwu'?6:10)&&ticker.same&&ticker.duplicate==='true'&&Math.abs(ticker.widths[0]-ticker.widths[1])<.1&&ticker.state==='running'&&ticker.overflow<=1&&ticker.cardBottom<=ticker.panelBottom+1,`${device} ${id}: identical accessible ticker loops fit on one page: ${JSON.stringify(ticker)}`);
      // Seek to either side of one whole cycle: duplicate occupies the same pixels.
      const seam=await evaluate(`(()=>{const el=document.querySelector('${selector}'),a=el.getAnimations()[0];a.pause();a.currentTime=0;const first=el.children[0].getBoundingClientRect().left;a.currentTime=${ticker.duration}*1000-.01;const duplicate=el.children[1].getBoundingClientRect().left;a.play();return Math.abs(first-duplicate)})()`);
      assert(seam<.1,`${device} ${id}: seamless loop boundary (${seam}px)`);
      await click(`#${id} [data-ticker-toggle]`);
      assert(await evaluate(`document.querySelector('#${id} [data-course-ticker]').dataset.paused==='true'&&getComputedStyle(document.querySelector('${selector}')).animationPlayState==='paused'`),`${device} ${id}: pause button`);
      await click(`#${id} [data-ticker-toggle]`);
      await call('Input.dispatchMouseEvent',{type:'mouseMoved',x:1,y:1});
      if(width===1440){
        await evaluate(`document.querySelector('#${id} [data-ticker-toggle]').focus({preventScroll:true})`);
        await key('Enter');await frames();
        assert(await evaluate(`getComputedStyle(document.querySelector('${selector}')).animationPlayState==='paused'`),`${device} ${id}: keyboard pause`);
        await key('Enter');await frames();
        assert(await evaluate(`getComputedStyle(document.querySelector('${selector}')).animationPlayState==='running'`),`${device} ${id}: keyboard resumes while focused`);
        const hover=await evaluate(`(()=>{const r=document.querySelector('#${id} .education-card-copy').getBoundingClientRect();return {x:r.left+10,y:r.top+10}})()`);
        await call('Input.dispatchMouseEvent',{type:'mouseMoved',...hover});
        assert(await evaluate(`getComputedStyle(document.querySelector('${selector}')).animationPlayState==='paused'`),`${device} ${id}: hover pauses`);
        await call('Input.dispatchMouseEvent',{type:'mouseMoved',x:1,y:1});
      }
      await evaluate('document.activeElement?.blur()');
      if(width<1024){
        const pt=await evaluate(`(()=>{const r=document.querySelector('#${id} [data-course-ticker]').getBoundingClientRect();return {x:r.left+40,y:r.top+r.height/2}})()`);
        await call('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[pt]});await delay(100);
        assert(await evaluate(`getComputedStyle(document.querySelector('${selector}')).animationPlayState==='paused'`),`${device} ${id}: touch hold pauses`);
        await call('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await delay(100);
        assert(await evaluate(`document.querySelector('#${id} [data-course-ticker]').dataset.paused==='true'`),`${device} ${id}: tap keeps pills readable`);
        await click(`#${id} [data-ticker-toggle]`);await evaluate('document.activeElement?.blur()');
      }
      await call('Input.dispatchMouseEvent',{type:'mouseMoved',x:1,y:1});
      await evaluate(`window.__sample=[];window.__sampleStart=performance.now();requestAnimationFrame(function frame(t){if(window.__previous)window.__sample.push(t-window.__previous);window.__previous=t;if(t-window.__sampleStart<2000)requestAnimationFrame(frame)})`);
      await delay(2100);
      const cadence=await evaluate(`(()=>{const a=window.__sample.sort((a,b)=>a-b);window.__previous=0;return {frames:a.length,medianMs:a[Math.floor(a.length*.5)],p95Ms:a[Math.floor(a.length*.95)],over34ms:a.filter(t=>t>34).length,approximateFPS:1000/(a.reduce((s,t)=>s+t,0)/a.length),longTasks:window.__longTasks,cls:window.__shifts.filter(e=>!e.input).reduce((s,e)=>s+e.value,0)}})()`);
      ticker.cadence=cadence;row.tickers.push(ticker);
      assert(cadence.p95Ms<20&&cadence.over34ms===0&&cadence.cls===0,`${device} ${id}: ticker frame cadence within lab budget: ${JSON.stringify(cadence)}`);
      await shot(`${device}-${id}`);
      await position('intro');
      assert(await evaluate(`getComputedStyle(document.querySelector('${selector}')).animationPlayState==='paused'`),`${device} ${id}: offscreen pauses`);
    }
    report.animations.push(row);save();console.log(`${device}: fresh/refresh intro + one Education page with two bounded tickers; failures ${report.failures.length}`);
  }
  await configure(375,667,true);await navigate();
  await position('education');
  assert(await evaluate(`!document.documentElement.hasAttribute('data-intro-pending')&&[...document.querySelectorAll('.ticker-track')].every(el=>(getComputedStyle(el).animationPlayState==='paused'||getComputedStyle(el).animationName==='none'))`),'reduced motion skips intro and pauses tickers');
  await click('#gwu [data-ticker-toggle]');
  assert(await evaluate(`document.querySelector('#gwu [data-ticker-toggle]').textContent==='Next'&&new DOMMatrix(getComputedStyle(document.querySelector('#gwu .ticker-track')).transform).m41<0`),'reduced motion exposes courses with an instant Next control');
  report.introHandoff=[];
  await configure(393,852);
  for(let attempt=0;attempt<5;attempt++){
    const url=`${base}/?intro-skip=${attempt}`;
    await call('Page.navigate',{url});
    await until(()=>evaluate(`location.href===${JSON.stringify(url)}&&document.documentElement?.dataset.introState==='running'`),'skip running',12000);
    await key('ArrowRight');await delay(700);
    const state=await evaluate(`({intro:document.documentElement.dataset.introState,ready:document.documentElement.dataset.ready,chapter:document.documentElement.dataset.activeChapter,x:document.querySelector('[data-horizontal-track]').scrollLeft})`);
    report.introHandoff.push(state);
    assert(state.intro==='complete'&&state.ready==='true'&&state.chapter==='about'&&Math.abs(state.x-393)<=1,`immediate intro input advances on fresh load ${attempt}: ${JSON.stringify(state)}`);
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
