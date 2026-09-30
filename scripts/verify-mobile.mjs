import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

// Real Chrome and its native DevTools protocol; no browser-test dependency.
// Touch input is emulated, so these checks do not replace physical-device QA.
const {basePath=''} = JSON.parse(readFileSync('dist/site-config.json','utf8'));
const base = (process.env.PORTFOLIO_TEST_URL || `http://localhost:4173${basePath}`).replace(/\/$/,'');
const out = 'comparison/mobile-first';
const viewports = [[320, 568], [375, 667], [390, 844], [767, 900], [768, 1024], [1024, 768], [1440, 900], [844, 390]];
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
  const params = { key, code: key, modifiers, windowsVirtualKeyCode: { Tab: 9, Escape: 27, Enter: 13 }[key] };
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
const stateCode = `(() => {
  const root = document.documentElement;
  const engine = window.portfolioMotion;
  const rail = document.querySelector('.rail');
  const controls = [...document.querySelectorAll('[data-menu-toggle], [data-theme-toggle]')].map(e => {
    const r = e.getBoundingClientRect(), style = getComputedStyle(e);
    return { hook: e.hasAttribute('data-menu-toggle') ? 'menu' : 'theme', width: r.width, height: r.height,
      visible: r.width > 0 && r.height > 0 && style.visibility !== 'hidden', label: e.getAttribute('aria-label') };
  });
  return { width: innerWidth, height: innerHeight, clientWidth: root.clientWidth, scrollWidth: root.scrollWidth,
    theme: root.dataset.theme, horizontal: Boolean(engine), chapter: root.dataset.activeChapter,
    railDisplay: getComputedStyle(rail).display, controls,
    order: [...document.querySelectorAll('[data-horizontal-panel]')].map(p => p.id),
    measurement: engine ? { width: engine.measurement.width, length: engine.measurement.length,
      travel: engine.measurement.travel, boxes: engine.measurement.boxes.map(b => ({ id: b.panel.id,
        left: b.left, width: b.width, start: b.start, overflow: b.overflow })) } : null,
    remoteScripts: [...document.scripts].map(s => s.src).filter(s => /^https?:/.test(s) && new URL(s).origin !== location.origin),
    hint: (() => { const e = document.querySelector('[data-scroll-hint]'); if (!e) return null;
      const r = e.getBoundingClientRect(); return { text: e.textContent.trim(), opacity: getComputedStyle(e).opacity,
        display: getComputedStyle(e).display, width: r.width, height: r.height, hidden: e.hidden, className: e.className }; })()
  };
})()`;
const panelCode = id => `(() => {
  const p = document.getElementById(${JSON.stringify(id)}), r = p.getBoundingClientRect();
  return { id: p.id, left: r.left, top: r.top, width: r.width, height: r.height,
    overflowX: p.scrollWidth - p.clientWidth, overflowY: p.scrollHeight - p.clientHeight,
    documentOverflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    targets: [...p.querySelectorAll('a[href], button')].filter(e => !e.closest('dialog')).map(e => {
      const box = e.getBoundingClientRect(); return { text:e.textContent.trim().slice(0, 50),
        width:box.width, height:box.height, visible:box.right>0 && box.left<innerWidth && box.bottom>0 && box.top<innerHeight };
    }).filter(e => e.visible) };
})()`;
const visibleCode = expression => `(() => {
  const e = ${expression}, r = e.getBoundingClientRect(), s = getComputedStyle(e);
  return { text: e.textContent.trim().slice(0, 100), x: r.x, y: r.y, width: r.width, height: r.height,
    visible: r.right > 0 && r.left < document.documentElement.clientWidth && r.bottom > 0 && r.top < innerHeight,
    opacity: s.opacity, documentOverflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth };
})()`;
const contrastCode = selector => `(() => {
 const rgb = text => (text.match(/[\\d.]+/g)||[]).map(Number);
 const blend = (a,b) => {const alpha=a[3]??1;return [0,1,2].map(i=>a[i]*alpha+b[i]*(1-alpha));};
 const luminance = color => {const c=color.slice(0,3).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return .2126*c[0]+.7152*c[1]+.0722*c[2];};
 return [...document.querySelectorAll(${JSON.stringify(selector)})].filter(e=>!e.closest('.sr-only,dialog:not([open])')&&e.getClientRects().length&&[...e.childNodes].some(n=>n.nodeType===3&&n.textContent.trim())).flatMap(e=>{
  const style=getComputedStyle(e), chain=[];let node=e;
  while(node){chain.unshift(node);node=node.parentElement;}
  let background=[255,255,255];
  chain.forEach(parent=>{background=blend(rgb(getComputedStyle(parent).backgroundColor),background)});
  const foreground=blend([...rgb(style.color).slice(0,3),parseFloat(style.opacity)],background);
  const a=luminance(foreground),b=luminance(background),ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);
  const large=parseFloat(style.fontSize)>=24||(parseFloat(style.fontSize)>=18.667&&parseFloat(style.fontWeight)>=700);
  const required=large?3:4.5;
  return ratio+.01<required?[{text:e.textContent.trim().slice(0,60),color:style.color,background,ratio,required}]:[];
 });
})()`;

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
      message.error ? entry.reject(Error(JSON.stringify(message.error))) : entry.resolve(message.result);
    } else if (message.sessionId === sessionId && message.method === 'Runtime.exceptionThrown') report.console.push(message.params);
  });
  const send = (method, params = {}, session) => new Promise((resolve, reject) => {
    const id = ++nextId; pending.set(id, { resolve, reject });
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

  // Bare first visits exercise the intro bootstrap that verification URLs skip.
  report.firstLoad = [];
  for (const [width, height] of [[1440, 900], [375, 667]]) {
    await configure(width, height);
    await evaluate("if(document.documentElement)document.documentElement.dataset.ready='navigating'");
    await call('Page.navigate', { url: `${base}/` });
    await until(() => evaluate('document.documentElement?.dataset.ready === "true" && !document.documentElement.hasAttribute("data-intro-pending")'), 'bare first-load ready');
    const first = await evaluate(`(() => ({theme:document.documentElement.dataset.theme,
      horizontal:Boolean(window.portfolioMotion), ready:document.documentElement.dataset.ready,
      nameOpacity:getComputedStyle(document.querySelector('[data-name-row]')).opacity,
      nameTransform:getComputedStyle(document.querySelector('[data-name-word]')).transform,
      remote:[...document.scripts].map(s=>s.src).filter(s=>/^https?:/.test(s)&&new URL(s).origin!==location.origin)}))()`);
    assert(first.theme === 'light' && first.horizontal && first.nameOpacity === '1' && first.nameTransform === 'none', `${width}x${height}: bare first load settles with CDN blocked`);
    if (width < 768) assert(first.remote.length === 0, 'mobile first load requests no third-party animation scripts');
    report.firstLoad.push({width,height,...first});
  }

  await configure(375, 667); await navigate('');
  const firstHint = (await evaluate(stateCode)).hint;
  assert(firstHint && !firstHint.hidden && firstHint.width > 0 && Number(firstHint.opacity) > .9,
    'first mobile visit displays the horizontal interaction hint');
  report.firstHint = firstHint; await shot('375x667-light-onboarding');

  for (const [width, height] of viewports) {
    await configure(width, height); await navigate();
    const row = await evaluate(stateCode); row.panels = []; row.longContent = [];
    assert(row.theme === 'light', `${width}x${height}: fresh dark OS preference defaults to light`);
    assert(row.horizontal, `${width}x${height}: horizontal engine available with CDN blocked`);
    assert(JSON.stringify(row.order) === JSON.stringify(order), `${width}x${height}: chapter order retained`);
    assert(row.scrollWidth <= row.clientWidth + 1, `${width}x${height}: document has no horizontal overflow`);
    assert(width < 768 ? row.railDisplay === 'none' : row.railDisplay !== 'none', `${width}x${height}: header breakpoint`);
    assert(row.controls.filter(c => c.visible).every(c => c.width >= 44 && c.height >= 44), `${width}x${height}: visible navigation/theme controls are 44px targets`);
    if (width < 768) assert(row.controls.some(c => c.visible && c.hook === 'menu'), `${width}x${height}: mobile menu control visible`);
    assert(row.measurement && Math.abs(row.measurement.width - row.clientWidth) <= 1 && row.measurement.boxes.length === order.length,
      `${width}x${height}: horizontal measurement uses available width`);
    for (const id of order) {
      await position(id);
      const panel = await evaluate(panelCode(id)); row.panels.push(panel);
      assert(Math.abs(panel.left) <= 1 && Math.abs(panel.width - row.clientWidth) <= 1 && panel.overflowX <= 1 && panel.documentOverflowX <= 1,
        `${width}x${height} ${id}: panel positioned and no X overflow ${JSON.stringify(panel)}`);
      assert(panel.targets.every(target => target.width >= 44 && target.height >= 44),
        `${width}x${height} ${id}: visible actions have 44px targets ${JSON.stringify(panel.targets.filter(target => target.width < 44 || target.height < 44))}`);
    }
    // The bottom of each long chapter must be reachable without nested scroll traps.
    for (const id of ['experience', 'venture', 'contact']) {
      await evaluate(`(() => { const p = document.getElementById(${JSON.stringify(id)});
        const all = [...p.querySelectorAll('p, h2, h3, h4, a, button, dd')].filter(e => !e.closest('dialog, .sr-only'));
        const target = all.at(-1); window.portfolioMotion.reveal(target); })()`);
      await frames();
      const tail = await evaluate(visibleCode(`(() => { const p = document.getElementById(${JSON.stringify(id)});
        return [...p.querySelectorAll('p, h2, h3, h4, a, button, dd')].filter(e => !e.closest('dialog, .sr-only')).at(-1); })()`));
      tail.id = id; row.longContent.push(tail);
      assert(tail.visible && tail.documentOverflowX <= 1, `${width}x${height} ${id}: final content reachable ${JSON.stringify(tail)}`);
    }
    if (width === 375) { await position('intro'); await shot('375x667-light-intro'); await position('venture'); await shot('375x667-light-venture'); }
    if (width === 1440) { await position('intro'); await shot('1440x900-light-intro'); }
    report.matrix.push(row); save();
  }

  // Both desktop and mobile theme controls persist an explicit user preference.
  for (const [width, height] of [[375, 667], [1024, 768]]) {
    await configure(width, height); await navigate(); await click('[data-theme-toggle]');
    const chosen = await evaluate('document.documentElement.dataset.theme');
    await navigate(); const persisted = await evaluate('document.documentElement.dataset.theme');
    await click('[data-theme-toggle]'); const restored = await evaluate('document.documentElement.dataset.theme');
    assert(chosen === 'dark' && persisted === 'dark' && restored === 'light', `${width}x${height}: theme toggle and persistence`);
    report.themes.push({ width, height, chosen, persisted, restored });
  }

  // Actual native vertical input and explicit sideways gestures both progress.
  for (const [kind, axis] of [['wheel', 'vertical'], ['touch', 'vertical'], ['wheel', 'horizontal'], ['touch', 'horizontal']]) {
    const width = kind === 'wheel' ? 1440 : 375, height = kind === 'wheel' ? 900 : 667;
    await configure(width, height);
    await evaluate('sessionStorage.removeItem("portfolio-scroll-discovered")');
    await navigate('');
    await evaluate(`(() => { const e = window.portfolioMotion, b = e.measurement.boxes[0];
      scrollTo({ top: e.trigger.start + b.start + b.overflow, behavior: 'instant' }); })()`);
    await frames();
    const before = await evaluate('({scroll:scrollY,left:document.querySelector("[data-horizontal-track]").getBoundingClientRect().left})');
    if (kind === 'wheel') await call('Input.dispatchMouseEvent', { type: 'mouseWheel', x: width * .8, y: height * .65,
      deltaX: axis === 'horizontal' ? 260 : 0, deltaY: axis === 'vertical' ? 260 : 0 });
    else {
      const startX = width * .85, endX = axis === 'horizontal' ? width * .15 : startX;
      const start = axis === 'horizontal' ? height * .48 : height * .78;
      const end = axis === 'horizontal' ? start : height * .2;
      const x = startX;
      await call('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: start }] });
      for (let n = 1; n <= 10; n++) {
        await call('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: startX + (endX - startX) * n / 10, y: start + (end - start) * n / 10 }] });
        await delay(16);
      }
      await call('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    }
    await until(() => evaluate(`scrollY > ${before.scroll + 60}`), `${axis} ${kind} scroll progression`, 2000);
    await delay(120);
    const after = await evaluate('({scroll:scrollY,left:document.querySelector("[data-horizontal-track]").getBoundingClientRect().left})');
    const hint = (await evaluate(stateCode)).hint;
    assert(after.left < before.left - 30, `${axis} ${kind}: gesture translates horizontal track`);
    await delay(400);
    const faded = (await evaluate(stateCode)).hint;
    assert(!faded || faded.hidden || faded.display === 'none' || Number(faded.opacity) < .05, `${axis} ${kind}: interaction hint fades after input`);
    report.gestures.push({ kind, axis, before, after, hint, faded });
  }

  const content = JSON.parse(readFileSync('content/portfolio.json', 'utf8'));
  const generatedHTML = readFileSync('dist/index.html', 'utf8');
  const esc = text => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
  const bullets = content.items.experience.flatMap(item => item.bullets);
  const missingBullets = bullets.filter(text => !generatedHTML.includes(esc(text)));
  const imagePaths = await evaluate('[...document.querySelectorAll("img")].map(e=>e.getAttribute("src")).filter(Boolean)');
  const missingAssets = imagePaths.filter(path => path.startsWith('/') && !existsSync(join('dist', path.slice(basePath.length+1))));
  report.content = { experienceBullets: bullets.length, missingBullets, images: imagePaths.length, missingAssets };
  assert(missingBullets.length === 0, 'all original experience bullets remain in generated detail content');
  assert(imagePaths.length > 0 && missingAssets.length === 0, 'all generated image assets are available locally');

  // Observe authored numeric spans across a first visit and a revisit.
  await configure(375, 667); await navigate();
  const goals = await evaluate(`(() => {
    const nodes = [...document.querySelectorAll('[data-count-up]')];
    window.__countSamples = nodes.map(e => [e.textContent.trim()]);
    window.__countObserver = new MutationObserver(() => nodes.forEach((e, i) => {
      const value = e.textContent.trim(), values = window.__countSamples[i]; if (values.at(-1) !== value) values.push(value);
    }));
    nodes.forEach(e => window.__countObserver.observe(e, { childList: true, characterData: true, subtree: true }));
    return nodes.map(e => e.textContent.trim());
  })()`);
  assert(goals.length >= 4, 'all Twods metrics have a count-up hook');
  await position('venture');
  await evaluate('window.portfolioMotion.reveal(document.querySelector(".metrics"))'); await frames();
  await delay(160);
  const intermediate = await evaluate('[...document.querySelectorAll("[data-count-up]")].map(e => e.textContent.trim())');
  await until(() => evaluate(`[...document.querySelectorAll('[data-count-up]')].every((e, i) => e.textContent.trim() === ${JSON.stringify(goals)}[i])`), 'metric final values', 3000);
  const samples = await evaluate('window.__countSamples');
  const beforeRevisit = samples.map(values => values.length);
  await position('intro'); await position('venture'); await evaluate('window.portfolioMotion.reveal(document.querySelector(".metrics"))');
  await delay(150);
  const revisit = await evaluate('window.__countSamples.map(values => values.length)');
  assert(samples.every((values, i) => values.some(value => /^0(?:\.0)?(?:K|M)?[%+]*$/.test(value)) && values.some(value => value !== goals[i] && !/^0(?:\.0)?(?:K|M)?[%+]*$/.test(value))),
    `metrics animate from zero through intermediate values: ${JSON.stringify(samples.map(s => s.slice(0, 4)))}`);
  assert(JSON.stringify(beforeRevisit) === JSON.stringify(revisit), 'metrics count only once on revisit');
  const community = await evaluate('document.querySelector(".metrics").textContent.replace(/\\s+/g," ").trim()');
  assert(community.toLowerCase().includes('community members') && goals.includes('300+') && !community.includes('300 to 350'), 'community metric is explicitly 300+ community members');
  report.metrics = { goals, intermediate, samples, revisit, community }; await shot('375x667-light-metrics');

  // Mobile navigation uses a modal sheet with native keyboard trapping.
  await navigate(); await click('[data-menu-toggle]');
  await until(() => evaluate('document.querySelector("#menu").open'), 'navigation sheet open');
  const opened = await evaluate('({modal:document.querySelector("#menu").matches(":modal"),focusInside:Boolean(document.activeElement.closest("#menu")),locked:window.portfolioMotion.lenis.isStopped})');
  assert(opened.modal && opened.focusInside && opened.locked, 'navigation sheet opens modal, focused and scroll locked');
  let trapped = true;
  const tabOrder = [];
  const menuControls = await evaluate('document.querySelector("#menu").querySelectorAll("a[href],button").length');
  const menuTargets = await evaluate('[...document.querySelector("#menu").querySelectorAll("a[href],button")].map(e=>{const r=e.getBoundingClientRect();return {width:r.width,height:r.height}})');
  assert(menuTargets.every(target => target.width >= 44 && target.height >= 44), 'navigation sheet controls have 44px targets');
  // CDP modifier bits: Alt=1, Control=2, Meta=4, Shift=8.
  for (const modifiers of [0, 8]) for (let n = 0; n < menuControls + 2; n++) {
    await key('Tab', modifiers);
    const focus = await evaluate('({inside:Boolean(document.activeElement.closest("#menu")),tag:document.activeElement.tagName,href:document.activeElement.getAttribute("href"),text:document.activeElement.textContent.trim().slice(0,40)})');
    tabOrder.push({ modifiers, ...focus }); trapped &&= focus.inside;
  }
  assert(trapped, 'navigation sheet traps forward and reverse Tab');
  await delay(240);
  await shot('375x667-light-navigation-sheet'); await key('Escape');
  await until(() => evaluate('!document.querySelector("#menu").open'), 'navigation sheet Escape');
  await frames();
  const escaped = await evaluate('({restored:document.activeElement.matches("[data-menu-toggle]"),unlocked:!window.portfolioMotion.lenis.isStopped,tag:document.activeElement.tagName,className:document.activeElement.className})');
  assert(escaped.restored && escaped.unlocked, 'navigation Escape restores toggle focus and scrolling');
  await click('[data-menu-toggle]');
  await evaluate(`document.querySelector(${JSON.stringify('#menu a[href$="#venture"]')}).click()`); await frames();
  const selected = await evaluate('({open:document.querySelector("#menu").open,chapter:document.documentElement.dataset.activeChapter,left:document.querySelector("#venture").getBoundingClientRect().left})');
  assert(!selected.open && selected.chapter === 'venture' && Math.abs(selected.left) <= 1, 'sheet chapter selection closes and positions target');
  report.navigation = { opened, trapped, tabOrder, escaped, selected };

  // Project dialogs retain Escape, Back, and originating-card focus restoration.
  await navigate('#selected-work');
  const route = await evaluate('document.querySelector(".work-row").getAttribute("href")');
  await evaluate('document.querySelector(".work-row").focus()'); await key('Enter');
  await until(() => evaluate('Boolean(document.querySelector("[data-detail][open]"))'), 'project opens');
  const detailOpen = await evaluate('({modal:document.querySelector("[data-detail][open]").matches(":modal"),headingFocused:document.activeElement===document.querySelector("[data-detail][open] h2"),locked:window.portfolioMotion.lenis.isStopped})');
  assert(detailOpen.modal && detailOpen.headingFocused && detailOpen.locked, 'project modal focused and horizontal motion locked');
  await key('Escape');
  await until(() => evaluate(`!document.querySelector('[data-detail][open]') && document.activeElement.getAttribute('href') === ${JSON.stringify(route)}`), 'project Escape focus restoration');
  const escapeFocus = await evaluate(visibleCode('document.activeElement'));
  assert(escapeFocus.visible, 'project Escape returns the originating card to view');
  await evaluate('document.querySelector(".work-row").click()');
  await until(() => evaluate('Boolean(document.querySelector("[data-detail][open]"))'), 'project reopen');
  await evaluate('history.back()');
  await until(() => evaluate(`!document.querySelector('[data-detail][open]') && document.activeElement.getAttribute('href') === ${JSON.stringify(route)}`), 'project Back focus restoration');
  report.detail = { route, detailOpen, escapeFocus, backRestored: true };

  await navigate('#venture'); await configure(1440, 900); await delay(180);
  const grown = await evaluate(stateCode); await configure(390, 844); await delay(180);
  const shrunk = await evaluate(stateCode);
  assert(grown.chapter === 'venture' && shrunk.chapter === 'venture' && grown.horizontal && shrunk.horizontal && shrunk.scrollWidth <= shrunk.clientWidth + 1,
    'resize preserves current chapter and available viewport width');
  report.resize = { grown, shrunk };

  report.releaseChecks = { contrast: [], dialogs: [], routes: [], enlargedText: [], assets: [] };
  await configure(375,667);await navigate('#selected-work');
  const swipe = await evaluate(`(()=>{const r=document.querySelector('.work-row').getBoundingClientRect();return {x:Math.min(r.right-20,340),y:r.top+Math.min(r.height/2,50),scroll:scrollY}})()`);
  await call('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:swipe.x,y:swipe.y}]});
  for(let i=1;i<=8;i++){await call('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:swipe.x-180*i/8,y:swipe.y}]});await delay(16);}
  await call('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await delay(100);
  assert(await evaluate(`scrollY>${swipe.scroll+60}&&!document.querySelector('[data-detail][open]')`),'horizontal drag on a project card scrolls without opening it');
  // Check the exact deployment URL prefix, all modules, fonts and image sources.
  const assets = [...new Set([...generatedHTML.matchAll(/(?:href|src|srcset)="([^"#]+)"/g)].flatMap(match=>match[1].split(',').map(value=>value.trim().split(/\s/)[0])).filter(value=>value.startsWith(`${basePath}/`)&&!value.includes('#')))];
  const style = readFileSync('dist/style.css','utf8');
  assets.push(...[...style.matchAll(/url\(["']?([^"')]+)/g)].map(match=>match[1]),`${basePath}/motion.js`,`${basePath}/metrics.js`,`${basePath}/navigation.js`,`${basePath}/horizontal-layout.js`);
  for(const path of [...new Set(assets)]){
    const response=await fetch(new URL(path,base));
    assert(response.ok,`deployed asset responds successfully: ${path}`);
    report.releaseChecks.assets.push({path,status:response.status});
  }

  for(const [width,height] of [[320,568],[1440,900]])for(const theme of ['light','dark']){
    await configure(width,height,true);await navigate();
    await evaluate(`document.documentElement.dataset.theme=${JSON.stringify(theme)}`);
    const misses=await evaluate(contrastCode('.chapter *, .rail *, .mobile-dock *'));
    assert(misses.length===0,`${width} ${theme}: chapter and control text contrast ${JSON.stringify(misses)}`);
    // Sheet uses the light paper token even while the surrounding page is dark.
    if(width<768){await click('[data-menu-toggle]');await delay(240);const sheet=await evaluate(contrastCode('#menu *'));
      assert(sheet.length===0,`${width} ${theme}: navigation sheet contrast ${JSON.stringify(sheet)}`);await key('Escape');await frames();}
    report.releaseChecks.contrast.push({width,theme,misses});
    if(width===320){
      await navigate('#selected-work');
      const routes=await evaluate('[...document.querySelectorAll("[data-index-card]")].map(e=>e.hash)');
      for(const route of routes){
        await evaluate(`document.querySelector('a[href='+CSS.escape(${JSON.stringify(route)})+']').focus()`);await key('Enter');
        await until(()=>evaluate('Boolean(document.querySelector("[data-detail][open]"))'),'all dialog open');
        const dialog=await evaluate(`(()=>{const d=document.querySelector('[data-detail][open]');return {id:d.dataset.detail,overflowX:d.scrollWidth-d.clientWidth,scrollable:['auto','scroll'].includes(getComputedStyle(d).overflowY)}})()`);
        assert(dialog.overflowX<=1&&dialog.scrollable,`${theme} ${route}: detail content readable`);
        const dialogContrast=await evaluate(contrastCode('[data-detail][open] *'));
        assert(dialogContrast.length===0,`${theme} ${route}: dialog text contrast ${JSON.stringify(dialogContrast)}`);
        await key('Escape');await until(()=>evaluate(`!document.querySelector('[data-detail][open]')&&document.activeElement.hash===${JSON.stringify(route)}`),'all dialog close');await frames();
        const card=await evaluate(visibleCode('document.activeElement'));
        assert(card.y>=-1&&card.y+card.height<=height-90,`${theme} ${route}: full return card above dock ${JSON.stringify(card)}`);
        report.releaseChecks.dialogs.push({theme,...dialog,card});
      }
    }
  }
  for(const route of ['#hero','#projects','#skills','#featured-skills','#%E0%A4%A']){
    await configure(375,667);await navigate(route);
    const result=await evaluate('({hash:location.hash,chapter:document.documentElement.dataset.activeChapter,modal:document.querySelector("[data-detail][open]")?.dataset.detail})');
    assert(route.includes('%')||result.hash===(route==='#hero'?'#intro':route==='#projects'?'#selected-work':'#selected-work/skills'),`v1 bookmark preserved: ${route}`);
    report.releaseChecks.routes.push({route,...result});
  }
  for(const slug of ['verdict','northport','quantera-ai','bnpl-marketplace']){
    await evaluate("if(document.documentElement)document.documentElement.dataset.ready='navigating'");
    await call('Page.navigate',{url:`${base}/projects/${slug}/`});
    await until(()=>evaluate(`document.documentElement?.dataset.ready==='true'&&document.querySelector('[data-detail="selected-work/${slug}"]')?.open`),'project route redirect');
    assert(await evaluate(`location.pathname===${JSON.stringify(`${basePath}/`)}&&location.hash==='#selected-work/${slug}'`),`project redirect retains deployment prefix: ${slug}`);
  }

  // Relative units and enlarged text must never force full-page sideways overflow.
  for(const width of [320,768]){
    await configure(width,800,true);await navigate();
    await call('Runtime.evaluate',{expression:"document.documentElement.style.fontSize='200%'"});await delay(100);
    for(const id of order){await position(id);const panel=await evaluate(panelCode(id));
      assert(panel.overflowX<=1&&panel.documentOverflowX<=1,`${width} enlarged text ${id}: no sideways clipping ${panel.overflowX}`);
      report.releaseChecks.enlargedText.push({width,id,overflowX:panel.overflowX});}
  }

  for (const [width, height] of viewports) {
    await configure(width, height, true); await navigate('#venture');
    const reduced = await evaluate(stateCode);
    reduced.values = await evaluate('[...document.querySelectorAll("[data-count-up]")].map(e => e.textContent.trim())');
    reduced.animations = await evaluate('document.getAnimations().filter(a=>a.playState==="running").map(a=>({name:a.animationName,duration:a.effect.getTiming().duration}))');
    assert(reduced.horizontal && reduced.values.every((value, i) => value === goals[i]) && reduced.animations.length === 0,
      `${width}x${height}: reduced mode retains horizontal chapters, final counters and no decorative animation`);
    await position('contact'); const panel = await evaluate(panelCode('contact'));
    assert(Math.abs(panel.left) <= 1 && panel.documentOverflowX <= 1, `${width}x${height}: reduced chapter navigation fits viewport`);
    report.reduced.push(reduced);
  }

  await configure(375, 667); await call('Emulation.setScriptExecutionDisabled', { value: true });
  await evaluate("if(document.documentElement)document.documentElement.dataset.ready='navigating'");
  const noScriptURL=`${base}/?no-script-mobile=${++navigationId}`;
  await call('Page.navigate', { url: noScriptURL });
  await until(() => evaluate(`location.href===${JSON.stringify(noScriptURL)}&&!document.documentElement?.dataset.ready&&Boolean(document.querySelector("#contact"))`), 'no-script markup'); await delay(80);
  const noScript = await evaluate(`(() => ({ theme: document.documentElement.dataset.theme,
    horizontal: Boolean(window.portfolioMotion), overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    panels: [...document.querySelectorAll('[data-horizontal-panel]')].map(p => {
      const s = getComputedStyle(p); return { id:p.id, display:s.display, overflow:s.overflowY,
        height:p.clientHeight, contentHeight:p.scrollHeight, opacity:s.opacity };
    }), counters:[...document.querySelectorAll('[data-count-up]')].map(e => e.textContent.trim()) }))()`);
  assert(noScript.theme === 'light' && !noScript.horizontal && noScript.overflowX <= 1 && noScript.panels.every(p => p.display !== 'none' && p.opacity === '1' && (p.contentHeight <= p.height + 1 || !['hidden', 'clip'].includes(p.overflow)))
    && JSON.stringify(noScript.counters) === JSON.stringify(goals), 'JS-off fallback is light, readable and contains final metrics');
  report.noScript = noScript; await shot('375x667-no-script-light');
  const fallback = await evaluate(`(()=>{const d=document.querySelector('.fallback-detail');d.open=true;return {count:document.querySelectorAll('.fallback-detail').length,text:d.textContent,overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth}})()`);
  assert(fallback.count===9&&fallback.text.includes(content.items.experience[0].description)&&fallback.overflow<=1,'JavaScript-free project and experience details are available in native disclosures');
  await call('Emulation.setScriptExecutionDisabled', { value: false });
  assert(report.console.length === 0, `no unhandled runtime exceptions (${report.console.length})`);
  report.completed = true;
} catch (error) {
  report.failures.push(error.stack); console.error(error);
  if(!report.browser&&chromeOutput) console.error('Chrome startup diagnostics:',chromeOutput.slice(-4000));
} finally {
  save();
  console.log(`Mobile-first: ${assertions} assertions, ${report.failures.length} failures, ${report.elapsedSeconds}s`);
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
