import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

// Real Chrome and its native DevTools protocol; no browser-test dependency.
// Touch input is emulated, so these checks do not replace physical-device QA.
const {basePath=''} = JSON.parse(readFileSync('dist/site-config.json','utf8'));
const base = (process.env.PORTFOLIO_TEST_URL || `http://localhost:4173${basePath}`).replace(/\/$/,'');
const out = 'comparison/viewport-deck';
const gesturesOnly = process.env.PORTFOLIO_GESTURES_ONLY === '1';
const viewports = gesturesOnly ? [] : [[320,568],[320,701],[360,640],[375,667],[375,812],[390,844],[393,852],[412,915],[600,960],[767,900],[768,1024],[820,1180],[900,600],[1024,568],[1024,768],[1280,720],[1366,768],[1440,900],[1920,1080],[2560,1440],[667,375],[844,390]];
const order = ['intro', 'about', 'education', 'experience', 'venture', 'selected-work', 'contact'];
mkdirSync(out, { recursive: true });
const profile = mkdtempSync(join(tmpdir(), 'portfolio-mobile-'));
const chrome = spawn(process.env.CHROME_PATH || (process.platform==='darwin'?'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome':'/usr/bin/google-chrome'), [
  '--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`,
  '--no-first-run', '--no-default-browser-check', '--disable-background-networking', '--disable-dev-shm-usage', 'about:blank',
], { stdio: ['ignore', 'ignore', 'pipe'], detached:process.platform!=='win32' });
const report = {
  scope: { targetURL: base, viewports, mode: gesturesOnly ? 'gestures-and-navigation' : 'full', headless: true, touchEmulated: true, physicalDevice: false },
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
  await call('Emulation.setTouchEmulationEnabled', { enabled: coarse, maxTouchPoints: 2 });
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
  // Device emulation can report DOM readiness before its new hit-test frame.
  // Dispatch gestures only after the visible page has been painted.
  await frames();
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
    theme: root.dataset.theme, horizontal: Boolean(engine), native:engine?.native, chapter: root.dataset.activeChapter,
    railDisplay: getComputedStyle(rail).display, controls,
    order: [...document.querySelectorAll('[data-horizontal-panel]')].map(p => p.id),
    measurement: engine ? { width: engine.measurement.width, length: engine.measurement.length,
      travel: engine.measurement.travel, layoutMilliseconds:engine.measurement.layoutMilliseconds, boxes: engine.measurement.boxes.map(b => ({ id: b.panel.id,
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
  let { targetId } = await send('Target.createTarget', { url: 'about:blank' });
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
  async function freshTouchDevice(){
    // A phone is a separate input device, not a desktop wheel widget resized
    // into one. Chrome can drop its first touch stream after that mode switch.
    const previous=targetId;
    ({targetId}=await send('Target.createTarget',{url:'about:blank'}));
    ({sessionId}=await send('Target.attachToTarget',{targetId,flatten:true}));
    await call('Page.enable');await call('Runtime.enable');await call('Network.enable');
    await call('Network.setBlockedURLs',{urls:['*cdn.jsdelivr.net*','*unpkg.com*']});
    await send('Target.closeTarget',{targetId:previous});
  }


  for (const [width,height] of viewports) {
    await configure(width,height); await navigate(); await evaluate("window.introSkip?.()"); await delay(100);
    const row=await evaluate(stateCode); row.panels=[]; row.details=[];
    assert(row.native, `${width}x${height}: native horizontal deck`);
    assert(width<768?row.railDisplay==='none':row.railDisplay!=='none',`${width}x${height}: header breakpoint`);
    assert(row.theme==='light',`${width}x${height}: light by default`);
    assert(row.order.filter(id=>id==='education'||id.startsWith('education-part-')).length===1,`${width}x${height}: both university cards on one Education page`);
    const ventureParts=row.order.filter(id=>id==='venture'||id.startsWith('venture-part-'));
    assert(ventureParts.length>=(width<768?2:1),`${width}x${height}: Twods Capital partitions only as needed`);
    for(const id of row.order){
      await position(id);
      const data=await evaluate(`(()=>{const p=document.getElementById(${JSON.stringify(id)}),r=p.getBoundingClientRect(),s=getComputedStyle(p); const edge=r.bottom-parseFloat(s.paddingBottom);
        const misses=[...p.querySelectorAll('p,h1,h2,h3,h4,li,a,button,dd,picture,figure')].filter(n=>!n.closest('dialog,noscript,.sr-only,.ticker-track')&&!(n.matches('.coursework-label')&&getComputedStyle(n).position==='absolute')&&n.getClientRects().length).flatMap(n=>{const b=n.getBoundingClientRect();return b.bottom>edge+1||b.top<r.top+parseFloat(s.paddingTop)-1||b.right>r.right-parseFloat(s.paddingRight)+1?[{text:n.textContent.slice(0,70),top:b.top,bottom:b.bottom,right:b.right,edge}]:[]});
        const scrollable=[...p.querySelectorAll('*')].filter(n=>!n.closest('dialog,noscript')&&['auto','scroll'].includes(getComputedStyle(n).overflowY));
        return {id:p.id,width:r.width,height:r.height,overflowY:p.scrollHeight-p.clientHeight,overflowX:p.scrollWidth-p.clientWidth,top:scrollY,left:r.left,misses,scrollable:scrollable.length,fitError:p.dataset.fitError,empty:p.classList.contains('deck-part')&&!p.querySelector('.deck-content')?.textContent.trim(),content:p.querySelector('.deck-content')?.textContent};})()`);
      row.panels.push(data);
      assert(data.overflowY<=1&&data.overflowX<=1&&data.misses.length===0&&!data.scrollable&&!data.fitError&&!data.empty,`${width}x${height} ${id}: bounded ${JSON.stringify(data)}`);
      if((width===375&&height===812)||(width===820&&height===1180)||(width===1440&&height===900)||(width===375&&height===667&&['intro','venture','venture-part-2','education','selected-work','contact'].includes(id))||(id==='education'&&[[320,568],[320,701],[900,600],[1024,568],[667,375]].some(([w,h])=>w===width&&h===height))){
        await delay(await evaluate(`Boolean(document.getElementById(${JSON.stringify(id)}).querySelector('[data-count-state="running"]'))`)?2400:850);
        await shot(`${width}x${height}-${id}`);
      }
    }
    const grouping=await evaluate(`({roles:[...document.querySelectorAll('.experience-role')].map(role=>({name:role.querySelector('.role-name')?.textContent,employer:role.closest('.employer')?.querySelector('h3')?.textContent})),work:[...document.querySelectorAll('.work-row')].map(row=>({title:row.querySelector('h3')?.textContent,result:row.querySelector('.work-result')?.textContent,stack:row.querySelector('.stack')?.textContent,columns:getComputedStyle(row).gridTemplateColumns})),schools:[...document.querySelectorAll('[data-chapter="education"]')].map(p=>p.textContent).join(' ')})`);
    assert(grouping.roles.length===4&&grouping.roles.every(role=>role.employer?.trim()),`${width}x${height}: every role stays grouped with its employer`);
    assert(grouping.work.length===4&&grouping.work.every(row=>row.title&&row.result&&row.stack),`${width}x${height}: each project remains a complete row`);
    assert(grouping.schools.includes('George Washington University')&&grouping.schools.includes('NMIMS'),`${width}x${height}: both institutions remain visible in the education deck`);
    row.grouping=grouping;
    const routes=await evaluate('[...document.querySelectorAll("[data-detail]")].map(d=>d.dataset.detail)');
    for(const route of routes){
      await navigate(`#${route}`);await delay(30);
      const pages=await evaluate('document.querySelector("[data-detail][open]")._deckPages.pages.length');
      for(let i=0;i<pages;i++){
        const detail=await evaluate(`(()=>{const d=document.querySelector('[data-detail][open]');const c=d.querySelector('.detail-copy'),r=c.getBoundingClientRect(); return {route:d.dataset.detail,page:${i+1},pages:${pages},overflow:d.scrollHeight-d.clientHeight,contentOverflow:c.scrollHeight-c.clientHeight,misses:[...c.querySelectorAll('p,h3,li,a,button')].filter(n=>n.getClientRects().length).flatMap(n=>{const b=n.getBoundingClientRect();return b.bottom>r.bottom+1||b.right>r.right+1?[n.textContent.slice(0,80)]:[]})};})()`);
        row.details.push(detail);assert(detail.overflow<=1&&detail.contentOverflow<=1&&!detail.misses.length,`${width}x${height} detail: ${JSON.stringify(detail)}`);
        if(i<pages-1)await evaluate('document.querySelector("[data-detail][open] .detail-pager button:last-child").click()');
      }
    }
    report.matrix.push(row);save();console.log(`${width}x${height}: ${row.order.length} slides, ${row.details.length} detail pages; failures ${report.failures.length}`);
  }

  // Vertical pulls translate to one horizontal page; document/content Y stays
  // fixed. Reverse pulls, boundaries and both axes share the same snap rules.
  await configure(375,667);await navigate();
  const phoneOrder=await evaluate('[...document.querySelectorAll("[data-horizontal-panel]")].map(p=>p.id)');
  const gestureState=()=>evaluate('({x:document.querySelector("[data-horizontal-track]").scrollLeft,y:scrollY,chapter:document.documentElement.dataset.activeChapter,tops:[...document.querySelectorAll("[data-horizontal-panel]")].map(p=>p.scrollTop)})');
  let touchPaint = -1;
  async function readyTouch(){
    if(touchPaint===navigationId)return;
    await call('Page.bringToFront');await frames();
    // Flush the emulated viewport's compositor surface before its first touch.
    // DOM-ready alone can target a retired surface after desktop/mobile resize.
    await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
    touchPaint=navigationId;
  }
  async function drag(x,y,dx,dy,steps=8,ms=16){
    await readyTouch();
    await call('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
    for(let i=1;i<=steps;i++){await call('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+dx*i/steps,y:y+dy*i/steps}]});await delay(ms);}
    await call('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await delay(650);
  }
  for(const id of phoneOrder){
    await position(id);const before=await gestureState();await drag(260,340,0,-160);const after=await gestureState();
    const expected=Math.min(before.x+375,(phoneOrder.length-1)*375);
    assert(Math.abs(after.x-expected)<=1,`vertical swipe up advances exactly one page: ${id}`);
    assert(after.y===0&&after.tops.every(y=>y===0),`vertical swipe has no document/content Y travel: ${id}`);
    await drag(260,340,0,160);const reverse=await gestureState();
    assert(Math.abs(reverse.x-Math.max(0,expected-375))<=1,`vertical swipe down returns exactly one page: ${id}`);
    report.gestures.push({kind:'vertical-pull',id,before,after});
  }
  for(const [width,height] of [[375,667],[393,852],[412,915],[820,1180]]){
    await configure(width,height);await navigate();
    for(const [name,dx,dy,steps,ms] of [['vertical-slow',0,-160,12,30],['vertical-flick',0,-80,4,5],['horizontal-slow',-160,0,12,30],['horizontal-flick',-80,0,4,5],['diagonal',-80,-80,8,16]]){
      await position('intro');await drag(width*.65,height*.55,dx,dy,steps,ms);
      const forward=await gestureState();
      assert(Math.abs(forward.x-width)<=1&&forward.y===0&&forward.tops.every(y=>y===0),`${width}x${height} ${name}: one page forward, Y locked`);
      await drag(width*.25,height*.4,-dx,-dy,steps,ms);
      assert(Math.abs((await gestureState()).x)<=1,`${width}x${height} ${name}: one page back`);
      report.gestures.push({kind:name,width,height,forward});
    }
    await position('intro');await drag(width*.6,height*.5,0,-8,4,20);
    assert(Math.abs((await gestureState()).x)<=1,`${width}x${height}: 8px vertical jitter does not navigate`);
    await drag(width*.6,height*.5,-8,0,4,20);
    assert(Math.abs((await gestureState()).x)<=1,`${width}x${height}: 8px horizontal jitter does not navigate`);
    await drag(width*.6,height*.5,0,-16,4,80);
    assert(Math.abs((await gestureState()).x)<=1,`${width}x${height}: slow subthreshold pull returns to its page`);
    await drag(width*.6,height*.5,0,80);
    assert(Math.abs((await gestureState()).x)<=1,`${width}x${height}: previous-page edge cannot overscroll`);
  }
  await configure(820,1180);await navigate();
  await drag(400,1080,0,-960,16,8);
  assert(Math.abs((await gestureState()).x-820)<=1,'vertical swipe longer than page width cannot skip pages');
  await configure(375,667);await navigate();
  await readyTouch();
  const startPoint={x:260,y:350,id:1};
  await call('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[startPoint]});
  await call('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...startPoint,y:270}]});await delay(50);
  await call('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});await delay(650);
  assert(Math.abs((await gestureState()).x)<=1,'cancelled gesture returns to its original page');
  await call('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[startPoint]});
  await call('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...startPoint,y:270}]});await delay(50);
  await call('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...startPoint,y:270},{x:100,y:270,id:2}]});
  await call('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});await delay(650);
  assert(Math.abs((await gestureState()).x)<=1,'adding a second finger cancels page navigation');
  assert(await evaluate('getComputedStyle(document.querySelector("[data-horizontal-track]")).touchAction.includes("pinch-zoom")'),'CSS keeps pinch zoom available');
  await position('intro');
  await evaluate(`window.__touchSamples=[];window.__touchStart=performance.now();requestAnimationFrame(function sample(now){window.__touchSamples.push({ms:now-window.__touchStart,x:document.querySelector('[data-horizontal-track]').scrollLeft});if(now-window.__touchStart<1200)requestAnimationFrame(sample);})`);
  await drag(260,350,0,-160,12,30);
  const touchSamples=await evaluate('window.__touchSamples');
  const touchSteps=touchSamples.slice(1).map((sample,index)=>sample.x-touchSamples[index].x);
  assert(touchSamples.filter(sample=>sample.x>0&&sample.x<375).length>=12,'vertical drag/release renders intermediate frames');
  assert(touchSteps.every(step=>step>=-1)&&Math.max(...touchSteps)<375*.3,'vertical drag/release is monotonic without a snap jump');
  report.gestures.push({kind:'vertical-touch-trajectory',samples:touchSamples,maxStep:Math.max(...touchSteps)});
  for(const [name,steps,ms] of [['slow-drag',12,30],['rapid-flick',4,5]]){
    await position('intro');const before=await gestureState();await drag(315,300,-230,0,steps,ms);const after=await gestureState();
    assert(Math.abs(after.x-375)<=1,`${name}: advances exactly one slide ${JSON.stringify(after)}`);
    assert(after.y===0&&after.tops.every(y=>y===0),`${name}: no vertical movement`);
    report.gestures.push({kind:name,before,after});
    await drag(60,300,230,0,steps,ms);const reversed=await gestureState();
    assert(Math.abs(reversed.x)<=1,`${name}: reverse swipe returns exactly one slide`);
  }
  await position('selected-work');const projectSwipeStart=await gestureState();
  const card=await evaluate('(()=>{const r=document.querySelector(".work-row").getBoundingClientRect();return {x:300,y:r.top+Math.min(45,r.height/2)}})()');
  await drag(card.x,card.y,-230,0);
  assert(!await evaluate('Boolean(document.querySelector("[data-detail][open]"))'),'card swipe does not activate detail');
  assert((await gestureState()).x>projectSwipeStart.x,'card swipe hands off to deck');
  await position('selected-work');
  const verticalCard=await evaluate('(()=>{const r=document.querySelector(".work-row").getBoundingClientRect();return {x:r.left+r.width*.65,y:r.top+Math.min(45,r.height/2)}})()');
  await drag(verticalCard.x,verticalCard.y,0,-100);
  assert(!await evaluate('Boolean(document.querySelector("[data-detail][open]"))'),'vertical card swipe does not activate detail');
  assert((await gestureState()).x>projectSwipeStart.x,'vertical card swipe hands off to deck');

  await configure(1440,900);await navigate();
  for(let n=0;n<8;n++)await call('Input.dispatchMouseEvent',{type:'mouseWheel',x:600,y:400,deltaX:0,deltaY:120});
  await delay(750);const wheel=await gestureState();assert(Math.abs(wheel.x-1440)<=1&&wheel.y===0,'desktop wheel burst advances one page with no document travel');
  report.gestures.push({kind:'wheel-burst',after:wheel});
  await delay(200);
  await call('Input.dispatchMouseEvent',{type:'mouseWheel',x:600,y:400,deltaX:0,deltaY:-120});await delay(650);
  assert(Math.abs((await gestureState()).x)<=1,'negative vertical wheel input returns one page');
  await delay(200);
  await call('Input.dispatchMouseEvent',{type:'mouseWheel',x:600,y:400,deltaX:120,deltaY:0});await delay(650);
  assert(Math.abs((await gestureState()).x-1440)<=1,'horizontal trackpad input advances one page');

  // Low-effort navigation, long trackpad tails and idle desktop reflow were
  // reported regressions: exercise the actual browser event/scroll paths.
  report.navigationStability=[];
  for(const [width,height] of [[1280,720],[1440,900],[1920,1080]]){
    await configure(width,height);await navigate();
    for(const id of ['education','venture']){
      await position(id);await delay(200);
      const before=await gestureState();
      await evaluate(`(()=>{window.__stablePage=document.getElementById(${JSON.stringify(id)});document.querySelectorAll('img').forEach(img=>img.dispatchEvent(new Event('load')));window.portfolioMotion.refresh();})()`);
      await delay(250);
      // Simulate a delayed native snap-anchor adjustment without user input.
      await evaluate('document.querySelector("[data-horizontal-track]").scrollTo({left:document.querySelector("[data-horizontal-track]").scrollLeft+innerWidth,behavior:"instant"})');
      await delay(300);
      const after=await gestureState();
      assert(after.chapter===id&&Math.abs(after.x-before.x)<=1,`${width} ${id}: passive layout/anchor events cannot select another page`);
      assert(await evaluate(`window.__stablePage===document.getElementById(${JSON.stringify(id)})`),`${width} ${id}: layout retains slide identity`);
      await delay(1500);const idle=await gestureState();
      assert(idle.chapter===id&&Math.abs(idle.x-before.x)<=1,`${width} ${id}: remains stationary without input`);
      report.navigationStability.push({width,height,id,before,after,idle});
    }
  }
  await configure(1440,900);await navigate();
  await evaluate(`window.__glideSamples=[];window.__glideStart=performance.now();requestAnimationFrame(function sample(now){window.__glideSamples.push({ms:now-window.__glideStart,x:document.querySelector('[data-horizontal-track]').scrollLeft});if(now-window.__glideStart<700)requestAnimationFrame(sample);})`);
  await call('Input.dispatchMouseEvent',{type:'mouseWheel',x:600,y:400,deltaX:0,deltaY:4});
  await delay(750);
  const glide=await evaluate('window.__glideSamples');
  const steps=glide.slice(1).map((s,i)=>s.x-glide[i].x);
  assert(Math.abs((await gestureState()).x-1440)<=1,'light 4px wheel input advances one slide');
  assert(glide.filter(s=>s.x>0&&s.x<1440).length>=15,'wheel transition renders intermediate frames');
  assert(steps.every(dx=>dx>=-1)&&Math.max(...steps)<1440*.18,'wheel glide is monotonic with no abrupt snap jump');
  assert(glide.find(s=>s.x>=1439)?.ms>=450,'wheel glide eases over time rather than jumping to a snap point');
  report.gestures.push({kind:'smooth-wheel-trajectory',samples:glide,maxStep:Math.max(...steps)});
  await delay(200);await position('intro');
  await call('Input.dispatchMouseEvent',{type:'mouseWheel',x:600,y:400,deltaX:0,deltaY:14});
  await delay(650);
  assert(Math.abs((await gestureState()).x-1440)<=1,'light 14px wheel input advances one slide');
  await delay(200);await position('intro');
  for(let n=0;n<22;n++){
    await call('Input.dispatchMouseEvent',{type:'mouseWheel',x:600,y:400,deltaX:0,deltaY:n===0?80:6});await delay(90);
  }
  await delay(350);const tail=await gestureState();
  assert(Math.abs(tail.x-1440)<=1,'two seconds of trackpad inertia cannot advance additional pages');
  await call('Input.dispatchMouseEvent',{type:'mouseWheel',x:600,y:400,deltaX:0,deltaY:14});await delay(650);
  const nextIntent=await gestureState();assert(Math.abs(nextIntent.x-2880)<=1,'next deliberate gesture works without a long cooldown');
  report.gestures.push({kind:'inertia-tail',after:tail,nextIntent});
  await freshTouchDevice();await configure(375,667);await navigate();
  await drag(260,300,-28,0,4,25);const assisted=await gestureState();
  assert(Math.abs(assisted.x-375)<=1,'short 28px mobile swipe advances without a half-screen drag');
  await drag(100,300,28,0,4,25);assert(Math.abs((await gestureState()).x)<=1,'short reverse swipe returns to previous slide');
  report.gestures.push({kind:'short-assisted-swipe',after:assisted});
  // Breakpoint changes reflow the existing nodes without changing page choice.
  await position('education');await configure(1920,1080);await delay(250);
  const responsiveWide=await gestureState();assert(responsiveWide.chapter==='education','phone-to-desktop reflow keeps Education selected');
  const responsiveBounds=await evaluate(`(()=>{const p=document.getElementById('education'),r=p.getBoundingClientRect();return {overflow:p.scrollHeight-p.clientHeight,wide:p.scrollWidth-p.clientWidth,left:r.left};})()`);
  assert(responsiveBounds.overflow<=1&&responsiveBounds.wide<=1&&Math.abs(responsiveBounds.left)<=1,'phone-to-desktop education layout remains bounded');
  await configure(375,667);await navigate();
  await configure(375,667);await navigate();
  await click('[data-menu-toggle]');await delay(240);
  const menu=await evaluate('(()=>{const d=document.querySelector("#menu");return {open:d.open,overflow:d.scrollHeight-d.clientHeight,locked:window.portfolioMotion.lenis.isStopped}})()');
  assert(menu.open&&menu.overflow<=1&&menu.locked,'chapter sheet is bounded and locks deck');
  await key('Escape');await frames();
  assert(await evaluate('document.activeElement.matches("[data-menu-toggle]")&&!window.portfolioMotion.lenis.isStopped'),'menu Escape returns focus and unlocks');
  await navigate('#selected-work/verdict');await key('Escape');await delay(100);
  assert(await evaluate('!document.querySelector("[data-detail][open]")&&document.activeElement.matches(".work-row")'),'detail Escape restores card focus');
  await evaluate('document.querySelector(".work-row").click()');await delay(100);await evaluate('history.back()');await delay(100);
  assert(await evaluate('!document.querySelector("[data-detail][open]")&&document.activeElement.matches(".work-row")'),'detail Back restores originating card');

  await navigate();
  await evaluate(`window.__metricStarts=[];window.__metricEnds=[];window.__metricObserver=new MutationObserver(entries=>{for(const entry of entries){const el=entry.target;if(entry.type==='attributes'&&el.matches('[data-count-up]')){if(el.dataset.countState==='running')window.__metricStarts.push(performance.now());if(el.dataset.countState==='complete')window.__metricEnds.push(performance.now());}}});document.querySelectorAll('[data-count-up]').forEach(e=>window.__metricObserver.observe(e,{attributes:true,attributeFilter:['data-count-state']}))`);
  const pendingCounters=await evaluate('[...document.querySelectorAll("[data-count-up]")].map(e=>e.dataset.countState)');
  assert(pendingCounters.every(s=>s==='pending'),'counters wait while slide is out of focus');
  const metricPage=await evaluate('document.querySelector(".metrics").closest("[data-horizontal-panel]").id');
  await position(metricPage);await delay(180);
  const intermediate=await evaluate('[...document.querySelectorAll("[data-count-up]")].map(e=>e.textContent)');
  await delay(2250);
  const counter=await evaluate('({values:[...document.querySelectorAll("[data-count-up]")].map(e=>e.textContent),durations:window.__metricEnds.map((v,i)=>v-window.__metricStarts[i]),runs:window.__metricStarts.length})');
  assert(JSON.stringify(counter.values)===JSON.stringify(['658K+','104K+','15.9%','300+']),'exact final metric values');
  assert(counter.durations.length===4&&counter.durations.every(ms=>ms>=1800&&ms<=2400),'metric animation uses 1.8–2.4s budget');
  assert(intermediate.every((v,i)=>v!==counter.values[i]),'counter visibly passes intermediate values');
  await position('intro');await position(metricPage);await delay(100);
  assert(await evaluate('window.__metricStarts.length')===4,'counter does not replay on revisit');
  report.metrics={pending:pendingCounters,intermediate,...counter};await shot('375x667-metrics-settled');
  const anchor=await evaluate('window.__resizeAnchor=document.getElementById(document.documentElement.dataset.activeChapter).querySelector(".deck-content > .deck-block");({chapter:document.documentElement.dataset.activeChapter,content:window.__resizeAnchor.textContent})');
  await configure(375,760);await delay(150);
  const resized=await evaluate('({chapter:document.documentElement.dataset.activeChapter,anchor:window.__resizeAnchor.closest("[data-horizontal-panel]").id,x:document.querySelector("[data-horizontal-track]").scrollLeft,y:scrollY})');
  assert(resized.chapter===anchor.chapter&&resized.y===0&&Math.abs(resized.x%375)<=1,'address-bar height change preserves selected page and snap grid');
  report.resize={anchor,resized};

  for(const [width,height] of [[320,568],[320,701],[360,640],[375,667],[1440,900]])for(const theme of ['light','dark']){
    await configure(width,height,true);await navigate();await evaluate(`document.documentElement.dataset.theme=${JSON.stringify(theme)}`);
    const misses=await evaluate(contrastCode('.chapter *, .rail *, .mobile-dock *'));
    assert(misses.length===0,`${width} ${theme}: text meets WCAG contrast ${JSON.stringify(misses)}`);
    report.themes.push({width,height,theme,misses});
  }
  await configure(375,667,true);await navigate();await position(await evaluate('document.querySelector(".metrics").closest("[data-horizontal-panel]").id'));
  assert(await evaluate('[...document.querySelectorAll("[data-count-up]")].every(e=>e.dataset.countState==="complete")'),'reduced motion displays final counters immediately');
  // Preserve each required canonical copy string after DOM partitioning.
  const copy=await evaluate('document.querySelector("[data-horizontal-track]").textContent.replace(/\\s+/g," ")');
  const canonical=JSON.parse(readFileSync('content/portfolio.json','utf8'));
  assert(await evaluate('!document.querySelector(".system-diagram,[data-diagram-node]")'),'removed system-design page is absent');
  const numbering=await evaluate(`({heads:[...document.querySelectorAll('.chapter-head')].map(el=>el.textContent),menu:[...document.querySelectorAll('#menu nav .label')].map(el=>el.textContent)})`);
  assert(numbering.heads.every(text=>!(/[0-9]/.test(text))),'chapter and part headings use Roman numerals');
  assert(JSON.stringify(numbering.menu)===JSON.stringify(['I','II','III','IV','V','VI','VII']),'chapter menu uses Roman numerals I–VII');
  for(const course of canonical.chapters.find(c=>c.slug==='education').entries.flatMap(e=>e.highlights))assert(copy.includes(course),`course preserved: ${course}`);
  for(const statement of canonical.intro.trim().split('\n').filter((_,i)=>[2,5,6].includes(i)))assert(copy.includes(statement),`intro statement preserved: ${statement}`);
  for(const statement of canonical.items.venture[0].copy.split('\n').slice(3,5))assert(copy.includes(statement),`venture narrative preserved: ${statement}`);

  // Verify generated deployment URLs, including the newly modular paginator.
  const generatedHTML=readFileSync('dist/index.html','utf8');
  const assets=[...new Set([...generatedHTML.matchAll(/(?:href|src|srcset)="([^"#]+)"/g)].flatMap(match=>match[1].split(',').map(value=>value.trim().split(/\s/)[0])).filter(value=>value.startsWith(`${basePath}/`)&&!value.includes('#')))];
  assets.push(...[...readFileSync('dist/style.css','utf8').matchAll(/url\(["']?([^"')]+)/g)].map(match=>match[1]),...['motion.js','metrics.js','navigation.js','horizontal-layout.js','deck-pagination.js','numerals.js'].map(name=>`${basePath}/${name}`));
  report.assets=[];
  for(const path of [...new Set(assets)]){const response=await fetch(new URL(path,base));assert(response.ok,`production asset: ${path}`);report.assets.push({path,status:response.status});}
  report.redirects=[];
  for(const project of canonical.items['selected-work']){
    const response=await fetch(`${base}/projects/${project.slug}/`),html=await response.text();
    assert(response.ok&&html.includes(`url=${basePath}/#selected-work/${project.slug}`),`project redirect retains deployment prefix: ${project.slug}`);
    report.redirects.push({slug:project.slug,status:response.status});
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
