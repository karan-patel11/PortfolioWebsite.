import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
// Real Chrome, controlled through its native DevTools protocol. No test dependency.
const viewports=[[320,568],[360,640],[390,844],[844,390],[768,1024],[1280,800],[1440,900],[1920,1080]];
const content=JSON.parse(readFileSync('content/portfolio.json','utf8'));
const profile=mkdtempSync(join(tmpdir(),'portfolio-chrome-'));
const chromePath=process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const chrome=spawn(chromePath,['--headless=new','--remote-debugging-port=0',`--user-data-dir=${profile}`,'--no-first-run','--no-default-browser-check','--disable-background-networking','--hide-scrollbars','about:blank'],{stdio:['ignore','ignore','pipe']});
let server,ws,report={browser:null,viewports:[],reducedMotion:[],static:{},failures:[]};
const fail=(condition,message)=>{if(!condition)report.failures.push(message);return Boolean(condition)};
let chromeOutput='';chrome.stderr.on('data',chunk=>chromeOutput+=chunk);
async function until(fn,label,timeout=15000){const start=Date.now();while(Date.now()-start<timeout){const value=await fn();if(value)return value;await delay(50)}throw Error(`Timed out: ${label}`)}
try{
 try{await fetch('http://localhost:4173/')}catch{server=spawn(process.execPath,['scripts/serve.mjs'],{stdio:'ignore'});await until(()=>fetch('http://localhost:4173/').then(r=>r.ok).catch(()=>false),'server')}
 const endpoint=await until(()=>chromeOutput.match(/DevTools listening on (ws:\/\/\S+)/)?.[1],'Chrome launch');
 ws=new WebSocket(endpoint);await new Promise(resolve=>ws.addEventListener('open',resolve,{once:true}));
 let nextId=0;const pending=new Map();
 ws.addEventListener('message',({data})=>{const message=JSON.parse(data);if(message.id){const entry=pending.get(message.id);pending.delete(message.id);message.error?entry.reject(Error(JSON.stringify(message.error))):entry.resolve(message.result)}});
 const send=(method,params={},sessionId)=>new Promise((resolve,reject)=>{const id=++nextId;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params,sessionId}))});
 report.browser=await send('Browser.getVersion');
 const {targetId}=await send('Target.createTarget',{url:'about:blank'});
 const {sessionId}=await send('Target.attachToTarget',{targetId,flatten:true});
 const call=(method,params={})=>send(method,params,sessionId);
 const evaluate=async expression=>{const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value};
 const key=async(key,code=key,modifiers=0)=>{await call('Input.dispatchKeyEvent',{type:'keyDown',key,code,modifiers,windowsVirtualKeyCode:{Tab:9,Escape:27,Enter:13}[key]});await call('Input.dispatchKeyEvent',{type:'keyUp',key,code,modifiers})};
 await call('Page.enable');await call('Runtime.enable');
 let navigationId=0;
 const navigate=async(hash='')=>{await evaluate('document.documentElement.dataset.ready="navigating"');await call('Page.navigate',{url:`http://localhost:4173/?verification=${++navigationId}${hash}`});await until(()=>evaluate('document.documentElement.dataset.ready === "true"'),'portfolio ready',25000)};
 const position=async id=>{await evaluate(`(async()=>{const p=document.getElementById(${JSON.stringify(id)});if(window.portfolioMotion)window.portfolioMotion.go(p);else scrollTo({top:p.offsetTop,behavior:'instant'});await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));for(const img of p.querySelectorAll('img')){await img.decode().catch(()=>{})}})()`)};
 const fonts=`(()=>{let min=Infinity,count=0;for(const e of document.querySelectorAll('body *')){if(!e.getClientRects().length||e.closest('.sr-only')||getComputedStyle(e).visibility==='hidden')continue;if(![...e.childNodes].some(n=>n.nodeType===3&&n.textContent.trim()))continue;min=Math.min(min,parseFloat(getComputedStyle(e).fontSize));count++}return {min,count}})()`;
 for(const [width,height] of viewports){
  await call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
  await call('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});
  await navigate();
  const row={viewport:`${width}x${height}`,a:[],b:[],c:{},d:{},e:{minimum:Infinity,textNodes:0},f:[],g:{},h:[],deepLinks:[]};
  row.mode=await evaluate('window.portfolioMotion ? "horizontal" : "vertical"');
  fail(row.mode===((width>=1024&&height>=500)?'horizontal':'vertical'),`${row.viewport}: wrong mode ${row.mode}`);
  const ids=await evaluate('[...document.querySelectorAll("[data-horizontal-panel]")].map(p=>p.id)');
  for(const id of ids){
   await position(id);
   const result=await evaluate(`(()=>{const p=document.getElementById(${JSON.stringify(id)}),r=p.getBoundingClientRect();const css=getComputedStyle(p);return {id:p.id,width:r.width,height:r.height,overflowY:p.scrollHeight-p.clientHeight,overflowX:p.scrollWidth-p.clientWidth,overflow:css.overflow,contentBottom:Math.max(r.top,...[...p.querySelectorAll('*')].filter(e=>e.getClientRects().length&&!e.closest('dialog,.sr-only,[data-inline-detail]')).map(e=>e.getBoundingClientRect().bottom))-r.top}})()`);
   if((width===320&&id==='experience')||(width===1280&&id==='venture')){
    const shot=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});writeFileSync(`verification-${width}x${height}-${id}.png`,Buffer.from(shot.data,'base64'));
   }
   row.a.push(result);fail(result.overflowY===0&&result.overflowX===0&&result.width===width&&result.height===height,`${row.viewport} 5a ${id}: ${JSON.stringify(result)}`);
   fail(result.contentBottom<=height+.5,`${row.viewport} 5a clipped content ${id}: ${result.contentBottom-height}px`);
   const images=await evaluate(`(()=>{const panel=document.getElementById(${JSON.stringify(id)}),p=panel.getBoundingClientRect();return [...panel.querySelectorAll('img')].filter(i=>i.getClientRects().length).map(i=>{const r=i.getBoundingClientRect(),natural=i.naturalWidth/i.naturalHeight,rendered=r.width/r.height,delta=Math.abs(rendered-natural)/natural;return {panel:panel.id,src:new URL(i.currentSrc).pathname,naturalWidth:i.naturalWidth,naturalHeight:i.naturalHeight,width:r.width,height:r.height,naturalRatio:natural,renderedRatio:rendered,delta,inside:r.left>=p.left-.5&&r.right<=p.right+.5&&r.top>=p.top-.5&&r.bottom<=p.bottom+.5,fit:getComputedStyle(i).objectFit,attributes:{width:i.getAttribute('width'),height:i.getAttribute('height'),srcset:Boolean(i.srcset),sizes:Boolean(i.sizes),loading:i.getAttribute('loading'),decoding:i.decoding},sourceSets:[...i.parentElement.querySelectorAll('source')].map(s=>s.srcset)}})})()`);
   for(const image of images){image.pass=fail(image.delta<=.005&&image.inside&&image.fit!=='cover'&&image.naturalWidth>0,`${row.viewport} 5h ${image.src}: ${JSON.stringify(image)}`);fail(image.attributes.loading==='lazy'&&image.attributes.decoding==='async'&&image.attributes.srcset&&image.attributes.sizes,`${row.viewport}: image attributes ${image.src}`);row.h.push(image)}
   const inline=await evaluate(`(()=>{const d=document.getElementById(${JSON.stringify(id)}).querySelector('[data-inline-detail]');if(!d)return null;return {id:d.dataset.inlineDetail,overflowY:d.scrollHeight-d.clientHeight,overflowX:d.scrollWidth-d.clientWidth,width:d.getBoundingClientRect().width,height:d.getBoundingClientRect().height}})()`);
   if(inline){inline.scrollAllowed=width<768||height<500;inline.pass=fail((inline.scrollAllowed||inline.overflowY===0)&&inline.overflowX===0&&inline.width<=width,`${row.viewport} 5b ${inline.id}: ${JSON.stringify(inline)}`);row.b.push(inline)}
  }
  const cards=await evaluate('[...document.querySelectorAll("[data-index-card]")].map(a=>a.getAttribute("href").slice(1))');
  const expected=Object.entries(content.items).filter(([section])=>section!=='venture').flatMap(([section,items])=>items.map(i=>`${section}/${i.slug}`));
  const details=await evaluate('[...document.querySelectorAll("[data-detail], [data-inline-detail]")].map(d=>d.dataset.detail||d.dataset.inlineDetail)');
  row.d={expected:expected.length,cards:cards.length,itemCards:expected.filter(id=>cards.includes(id)).length,details:details.length,ventureDirect:details.includes('venture/twods-capital')?1:0,orphans:expected.filter(id=>!cards.includes(id)||!details.includes(id))};
  fail(row.d.orphans.length===0&&row.d.ventureDirect===1,`${row.viewport} 5d ${JSON.stringify(row.d)}`);
  // Walk the browser's actual sequential Tab order; focusin positions its owner.
  await evaluate('document.activeElement.blur();document.querySelector(".skip").focus()');
  const tabbed=new Map();
  for(let n=0;n<80&&tabbed.size<cards.length;n++){
   await key('Tab');
   const focus=await evaluate(`(()=>{const a=document.activeElement;if(!a.matches('[data-index-card]'))return null;const r=a.getBoundingClientRect(),header=document.querySelector('.rail').getBoundingClientRect();return {id:a.hash.slice(1),inView:a.closest('[data-horizontal-panel]').scrollTop===0&&r.left>=-.5&&r.right<=innerWidth+.5&&r.top>=header.bottom-.5&&r.bottom<=innerHeight+.5}})()`);
   if(focus)tabbed.set(focus.id,focus.inView);
  }
  for(const id of cards){
   const encoded=JSON.stringify(id);
   await evaluate(`document.querySelector('a[href="#'+${encoded}+'"]').focus()`);await key('Enter');
   await until(()=>evaluate(`Boolean(document.querySelector('[data-detail="'+${encoded}+'"]').open)`),'detail open');
   const detail=await evaluate(`(()=>{const d=document.querySelector('[data-detail="'+${encoded}+'"]'),r=d.getBoundingClientRect();return {id:${encoded},overflowY:d.scrollHeight-d.clientHeight,overflowX:d.scrollWidth-d.clientWidth,width:r.width,height:r.height,headingFocused:document.activeElement===d.querySelector('h2'),modal:d.matches(':modal'),lenisStopped:window.portfolioMotion?.lenis.isStopped??null,triggerEnabled:window.portfolioMotion?.trigger.enabled??null}})()`);
   detail.scrollAllowed=width<768||height<500;
   detail.pass=fail((detail.scrollAllowed||detail.overflowY===0)&&detail.overflowX===0&&detail.width<=width&&detail.height<=height,`${row.viewport} 5b ${id}: ${JSON.stringify(detail)}`);row.b.push(detail);
   fail(detail.headingFocused&&detail.modal,`${row.viewport}: heading/modal ${id}`);
   if(row.mode==='horizontal')fail(detail.lenisStopped&&!detail.triggerEnabled,`${row.viewport}: motion lock ${id}`);
   const f=await evaluate(fonts);row.e.minimum=Math.min(row.e.minimum,f.min);row.e.textNodes=Math.max(row.e.textNodes,f.count);
   let trapped=true;
   const count=await evaluate(`document.querySelector('[data-detail="'+${encoded}+'"]').querySelectorAll('a[href],button').length`);
   for(let n=0;n<count+2;n++){await key('Tab');trapped&&=await evaluate(`Boolean(document.activeElement.closest('[data-detail="'+${encoded}+'"]'))`)}
   for(let n=0;n<count+2;n++){await key('Tab','Tab',1);trapped&&=await evaluate(`Boolean(document.activeElement.closest('[data-detail="'+${encoded}+'"]'))`)}
   await key('Escape');await until(()=>evaluate('!document.querySelector("[data-detail][open]")'),'Escape close');
   const restored=await evaluate(`document.activeElement.getAttribute('href')==='#'+${encoded}`);
   const unlocked=await evaluate('!window.portfolioMotion || (!window.portfolioMotion.lenis.isStopped && window.portfolioMotion.trigger.enabled)');
   row.f.push({id,tabReachable:Number(tabbed.has(id)),inView:Number(tabbed.get(id)||false),trapped:Number(trapped),restored:Number(restored),motionRestored:Number(unlocked)});
   fail(tabbed.get(id)&&trapped&&restored&&unlocked,`${row.viewport} 5f ${id}: ${JSON.stringify(row.f.at(-1))}`);
  }
  row.history=[];
  for(const id of cards){
   const encoded=JSON.stringify(id);
   await evaluate(`document.querySelector('a[href="#'+${encoded}+'"]').click()`);
   await until(()=>evaluate('Boolean(document.querySelector("[data-detail][open]"))'),'click open');
   await evaluate('history.back()');await until(()=>evaluate('!document.querySelector("[data-detail][open]")'),'Back close');
   await evaluate('history.forward()');await until(()=>evaluate('Boolean(document.querySelector("[data-detail][open]"))'),'Forward open');
   await evaluate('document.querySelector("[data-detail][open] [data-detail-close]").click()');await until(()=>evaluate('!document.querySelector("[data-detail][open]")'),'explicit close');
   const returned=await evaluate(`document.activeElement.getAttribute('href')==='#'+${encoded}`);
   row.history.push({id,back:1,forward:1,close:1,restored:Number(returned)});fail(returned,`${row.viewport}: close control focus ${id}`);
  }
  row.c=await evaluate(`(()=>{const panels=[...document.querySelectorAll('[data-horizontal-panel]')],expected=(panels.length-1)*innerWidth;return {panelCount:panels.length,expected,travel:panels.reduce((sum,p)=>sum+p.getBoundingClientRect().width,0)-innerWidth,engineTravel:window.portfolioMotion?.measurement.travel??null,trackLength:window.portfolioMotion?document.querySelector('[data-horizontal-track]').getBoundingClientRect().width:panels.length*innerWidth}})()`);
  fail(Math.abs(row.c.travel-row.c.expected)<=1&&(!row.c.engineTravel||Math.abs(row.c.engineTravel-row.c.expected)<=1),`${row.viewport} 5c ${JSON.stringify(row.c)}`);
  if(row.mode==='horizontal'){
   await position(ids[0]);const start=await evaluate('document.querySelector("[data-horizontal-track]").getBoundingClientRect().left');await position(ids.at(-1));const end=await evaluate('document.querySelector("[data-horizontal-track]").getBoundingClientRect().left');row.c.actualTravel=start-end;fail(Math.abs(row.c.actualTravel-row.c.expected)<=1,`${row.viewport} 5c actual travel ${row.c.actualTravel}`);
  }
  row.g=await evaluate(`(()=>{const a=[...document.querySelectorAll('[data-rail-label]')],ids=[...document.querySelectorAll('[data-horizontal-panel]')].map(p=>p.id),rects=a.map(a=>a.getBoundingClientRect());return {labels:a.length,panels:ids.length,missing:ids.filter(id=>!a.some(a=>a.hash==='#'+id)).length,duplicates:a.length-new Set(a.map(a=>a.hash)).size,gaps:rects.slice(1).filter((r,i)=>Math.abs(r.top-rects[i].top)<1&&Math.abs(r.left-rects[i].right)>1).length,clipped:rects.filter(r=>r.left<0||r.right>innerWidth||r.top<0||r.bottom>innerHeight).length}})()`);
  fail(row.g.labels===ids.length&&row.g.missing===0&&row.g.duplicates===0&&row.g.gaps===0&&row.g.clipped===0,`${row.viewport} 5g ${JSON.stringify(row.g)}`);
  fail(row.e.minimum>=14,`${row.viewport} 5e ${row.e.minimum}`);
  // A direct load must position the owner before opening its modal.
  for(const id of ['experience/gwu-technical-assistant','projects/verdict','projects-b/codekraft']){
   await navigate(`#${id}`);const deep=await evaluate(`(()=>{const d=document.querySelector('[data-detail][open]'),p=d?.closest('[data-horizontal-panel]'),r=p?.getBoundingClientRect();return {id:${JSON.stringify(id)},open:Number(Boolean(d)),ownerLeft:r?.left,ownerTop:r?.top,focused:Number(document.activeElement===d?.querySelector('h2'))}})()`);row.deepLinks.push(deep);fail(deep.open&&deep.focused&&Math.abs(deep.ownerLeft)<1&&Math.abs(deep.ownerTop)<1,`${row.viewport}: deep link ${JSON.stringify(deep)}`);await key('Escape');
  }
  report.viewports.push(row);console.log(`Measured ${row.viewport}: ${row.a.length} panels, ${row.b.length} details, ${row.h.length} images`);
 }
 // Desktop reduced motion must retain fixed vertical pages and direct links.
 for(const [width,height] of [[1280,800],[1920,1080]]){
  await call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});await call('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});await navigate('#experience/gwu-technical-assistant');
  const result=await evaluate('({horizontal:Number(Boolean(window.portfolioMotion)),modal:Number(Boolean(document.querySelector("[data-detail][open]"))),panelOverflows:[...document.querySelectorAll("[data-horizontal-panel]")].map(p=>p.scrollHeight-p.clientHeight)})');report.reducedMotion.push({width,height,...result});fail(result.horizontal===0&&result.modal===1&&result.panelOverflows.every(v=>v===0),`reduced motion ${width}x${height}: ${JSON.stringify(result)}`);
 }
 const css=readFileSync('dist/style.css','utf8'),html=readFileSync('dist/index.html','utf8');
 report.static={cover:(css.match(/(?:object-fit|background-size)\s*:\s*cover/g)||[]).length,maxContentWidth:(css.match(/width\s*:\s*max-content/g)||[]).length,minHeight1000:(css.match(/min-height\s*:\s*1000px/g)||[]).length,experienceBullets:content.items.experience.reduce((n,i)=>n+i.bullets.length,0),missingBullets:content.items.experience.flatMap(i=>i.bullets).filter(b=>!html.includes(b.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;'))).length};
 fail(Object.entries(report.static).filter(([k])=>k!=='experienceBullets').every(([,v])=>v===0),`static ${JSON.stringify(report.static)}`);
}catch(error){report.failures.push(error.stack);console.error(error)}finally{
 report.mediaChanges=['src/style.css: .photo img object-fit:cover → contain','src/motion-source.css: .curtain__clip img object-fit:cover → contain','src/motion-source.css: .expand__rect video object-fit:cover → contain','src/motion-source.css: .projects__preview img object-fit:cover → contain','src/motion-source.css: .card__bg img object-fit:cover → contain','dist/style.css: regenerated .photo img'];
 writeFileSync('verification-results.json',JSON.stringify(report,null,2)+'\n');
 const n=value=>typeof value==='number'?Number(value.toFixed(6)):value;
 let out=`# Chrome measurements\n\n${report.browser?.product||'Chrome unavailable'}\n\n`;
 for(const v of report.viewports){
  out+=`## ${v.viewport} (${v.mode})\n\n5a\n\n| Panel | width | height | overflow X | overflow Y | content bottom |\n|---|---:|---:|---:|---:|---:|\n`+v.a.map(p=>`| ${p.id} | ${n(p.width)} | ${n(p.height)} | ${p.overflowX} | ${p.overflowY} | ${n(p.contentBottom)} |`).join('\n');
  out+='\n\n5b\n\n| Detail | width | height | overflow X | overflow Y | scroll allowed | pass |\n|---|---:|---:|---:|---:|---:|---:|\n'+v.b.map(d=>`| ${d.id} | ${n(d.width)} | ${n(d.height)} | ${d.overflowX} | ${d.overflowY} | ${Number(d.scrollAllowed)} | ${Number(d.pass)} |`).join('\n');
  out+=`\n\n5c: \`${JSON.stringify(v.c)}\`\n\n5d: \`${JSON.stringify(v.d)}\`\n\n5e: \`${JSON.stringify(v.e)}\`\n\n5f\n\n| Card | Tab | in view | trapped | restored | motion restored |\n|---|---:|---:|---:|---:|---:|\n`+v.f.map(f=>`| ${f.id} | ${f.tabReachable} | ${f.inView} | ${f.trapped} | ${f.restored} | ${f.motionRestored} |`).join('\n');
  out+=`\n\n5g: \`${JSON.stringify(v.g)}\`\n\n5h\n\n| src | natural ratio | rendered ratio | delta | inside panel | pass/fail |\n|---|---:|---:|---:|---:|---|\n`+v.h.map(i=>`| ${i.src} | ${n(i.naturalRatio)} | ${n(i.renderedRatio)} | ${n(i.delta)} | ${Number(i.inside)} | ${i.pass?'PASS':'FAIL'} |`).join('\n')+'\n\n';
 }
 out+=`Media changes\n\n${report.mediaChanges.map(s=>'- '+s).join('\n')}\n\n`;
 out+=`Static: \`${JSON.stringify(report.static)}\`\n\nFailures: ${report.failures.length}\n\n`+report.failures.map(f=>`- ${f}`).join('\n')+'\n';
 writeFileSync('verification-results.md',out);console.log(out);ws?.close();chrome.kill();server?.kill();await delay(300);rmSync(profile,{recursive:true,force:true});
}
process.exitCode=report.failures.length?1:0;
