import {readFileSync,writeFileSync,mkdirSync,copyFileSync,cpSync} from 'node:fs';
import {parseMetricValue} from '../src/metrics.js';
const content=JSON.parse(readFileSync('content/portfolio.json','utf8'));
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const lines=s=>s.trim().split('\n').filter(Boolean);
const intro=lines(content.intro);
const nav=content.chapters.map(({slug,label})=>[slug,label]);
const chapterCopy=id=>content.chapters.find(c=>c.slug===id).copy;
const basePath = (process.env.BASE_PATH || '').replace(/^\/+|\/+$/g, '');
if (basePath && !/^[\w./-]+$/.test(basePath)) throw Error('BASE_PATH must be a URL path.');
const prefix = basePath ? `/${basePath}` : '';
const homePath = `${prefix}/`;
const publicURLs = value => value.replace(/((?:href|src|srcset)=["']|;url=)\/(?!\/)/g, `$1${homePath}`)
 .replace(/(url\(\s*["']?)\/(?!\/)/g, `$1${homePath}`)
 .replace(/(,\s*)\/assets\//g, `$1${homePath}assets/`);
const writePublic = (path, value) => writeFileSync(path, publicURLs(value));
// Arm before CSS/paint; hero.js keeps its existing 4.6 second timeline. Every
// armed state has a deadline independent of the CDN, deferred scripts or fonts.
const introBootstrap=`(() => {
 const root=document.documentElement;
 const events=['wheel','touchstart','keydown','pointerdown'];
 const motion=matchMedia('(prefers-reduced-motion: reduce)');
 const navigation=performance.getEntriesByType('navigation')[0];
 if(location.pathname!==${JSON.stringify(homePath)}||location.search||location.hash||scrollY>0||motion.matches||navigation?.type==='back_forward'||(history.state?.portfolioReturnChapter&&history.state.portfolioReturnChapter!=='intro')||!matchMedia('(min-width: 1024px) and (min-height: 500px) and (pointer: fine) and (hover: hover)').matches)return;
 let observer;
 function cleanup(){
  clearTimeout(window.introFallback);
  events.forEach(type=>removeEventListener(type,settle));
  removeEventListener('scroll',restored);
  removeEventListener('hashchange',settle);
  removeEventListener('pagehide',settle);
  removeEventListener('pageshow',restore);
  motion.removeEventListener('change',settle);
  observer?.disconnect();
 }
 function settle(){
  window.introSkipRequested=true;
  root.removeAttribute('data-intro-pending');
  cleanup();
 }
 // Input skips directly; reserve this guard for meaningful restored scroll.
 function restored(){if(scrollY>8)settle()}
 function restore(event){if(event.persisted)settle()}
 window.introSkip=settle;
 events.forEach(type=>addEventListener(type,settle,{passive:true}));
 addEventListener('scroll',restored,{passive:true});
 addEventListener('hashchange',settle);
 addEventListener('pagehide',settle);
 addEventListener('pageshow',restore);
 motion.addEventListener('change',settle);
 root.setAttribute('data-intro-pending','');
 observer=new MutationObserver(()=>{if(!root.hasAttribute('data-intro-pending'))cleanup()});
 observer.observe(root,{attributes:true,attributeFilter:['data-intro-pending']});
 window.introFallback=setTimeout(settle,4900);
 // A failed font request must never strand a masked name. Loading itself is
 // bounded by the same deadline, so a stalled fonts.ready cannot extend it.
 addEventListener('DOMContentLoaded',()=>{
  if(!window.gsap&&!window.portfolioGsapReady){settle();return}
  document.fonts?.ready.then(()=>{
   if([...document.fonts].some(font=>font.status==='error'))settle();
  });
 },{once:true});
})();`;
const shell=(body,title='Karan Patel | AI Systems Engineer')=>`<!doctype html><html lang="en" data-theme="light"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="description" content="${esc(intro[2])}"><meta name="theme-color" content="#FAF9F6"><script>try{const stored=localStorage.getItem("portfolio-theme");document.documentElement.dataset.theme=stored==="dark"||stored==="light"?stored:"light"}catch{document.documentElement.dataset.theme="light"}</script><script>${introBootstrap}</script><title>${esc(title)}</title><link rel="icon" href="/assets/favicon.svg" type="image/svg+xml"><link rel="preload" href="/fonts/fraunces-latin-full-normal.woff2" as="font" type="font/woff2" crossorigin><link rel="preload" href="/fonts/geist-latin-wght-normal.woff2" as="font" type="font/woff2" crossorigin><link rel="stylesheet" href="/style.css"><script>if(document.documentElement.hasAttribute("data-intro-pending")){window.portfolioGsapReady=new Promise(resolve=>{const script=document.createElement("script");let timer=setTimeout(resolve,2000);script.src="https://cdn.jsdelivr.net/npm/gsap@3.13.0/dist/gsap.min.js";script.onload=script.onerror=()=>{clearTimeout(timer);resolve()};document.head.append(script)})}</script><script src="/hero.js" defer></script><script type="module" src="/main.js"></script><script src="/chapter-motion.js" defer></script></head><body><a class="skip" href="#main">Skip to content</a><header class="rail" data-intro-header><a class="wordmark" href="/#intro" aria-label="Karan Patel, intro">KP</a><button class="menu-toggle" data-menu-toggle aria-haspopup="dialog" aria-controls="menu" aria-expanded="false" hidden><span class="desktop-menu" aria-hidden="true">☰</span><span class="mobile-menu">Menu</span></button><noscript><a href="/#chapters">Chapters</a></noscript><nav class="header-rail" aria-label="Chapters">${nav.map(([id,label])=>`<a href="#${id}" data-rail-label>${esc(label)}</a>`).join('')}</nav><button class="theme-toggle" data-theme-toggle aria-label="Switch to dark theme" aria-pressed="true">◐</button><span data-header-scroll-progress aria-hidden="true"></span></header><nav class="mobile-dock" aria-label="Mobile controls" hidden><a href="#intro" class="dock-home" aria-label="Karan Patel, intro">KP</a><button type="button" data-menu-toggle class="dock-menu" aria-haspopup="dialog" aria-controls="menu" aria-expanded="false"><svg class="menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M4 8h16M4 16h16"/></svg>Chapters</button><button type="button" class="dock-theme" data-theme-toggle aria-label="Switch to dark theme" aria-pressed="true"><span aria-hidden="true">◐</span></button></nav><aside class="scroll-hint" data-scroll-hint hidden aria-label="Scrolling tip"><span class="gesture-cue" aria-hidden="true"></span><p><span class="hint-touch">Scroll down to move sideways</span><span class="hint-pointer">Scroll to explore the chapters →</span></p><button type="button" data-hint-dismiss aria-label="Dismiss scrolling tip"><span aria-hidden="true">×</span></button></aside><dialog id="menu" class="navigation-sheet" aria-labelledby="menu-title"><div class="menu-heading"><h2 id="menu-title">Explore chapters</h2><button type="button" class="menu-close" autofocus>Close <span aria-hidden="true">×</span></button></div><nav aria-label="Chapters">${nav.map(([id,label],i)=>`<a href="/#${id}" data-rail-label><span class="label">${(i+1).toString().padStart(2,'0')}</span>${esc(label)}<span aria-hidden="true">↗</span></a>`).join('')}</nav></dialog><main id="main" tabindex="-1">${body}</main></body></html>`;
const masked = value => `<span class="line-mask"><span data-line>${esc(value)}</span></span>`;
const hero=`<section class="chapter hero" id="intro" aria-labelledby="identity" data-horizontal-panel data-header-bg="transparent" data-header-text="var(--hero-text)" data-header-border="var(--hero-border)">
<div data-loading-base-overlay aria-hidden="true"></div>
<div data-hero-year aria-hidden="true"><div data-year-row><span data-year-start-text><span class="char">2</span><span class="char">0</span></span><span class="year-window"><span data-year-strip>${Array.from({length:14},(_,i)=>`<span class="year-strip-cell">${i+13}</span>`).join('')}</span></span></div></div>
<div data-hero-name><h1 id="identity" data-name-heading><span class="sr-only">Karan Patel</span><span data-name-row aria-hidden="true">${['KARAN','PATEL'].map(word=>`<span class="name-mask"><span data-name-line-text><span class="word" data-name-word>${word}</span></span></span>`).join('')}</span></h1></div>
<p class="hero-role" data-loading-tagline data-reveal-line>${masked(intro[1])}</p>
<p class="hero-intro" data-loading-journey-line data-reveal-line>${masked(intro[2])}</p>
<p class="hero-statement" data-reveal-line>${masked(intro[5])}</p>
<div class="hero-bottom"><p data-reveal-line><span class="line-mask"><span data-line><time data-clock datetime="">00:00:00</time> · ET</span></span></p><p data-reveal-line>${masked('Open for collaborations')}</p><a class="explore to-link-underline" href="#about" data-reveal-line>${masked('SCROLL ↘')}</a></div></section>`;
const panels=new Map([['intro',hero]]);

const paras=arr=>arr.map(x=>`<p>${esc(x)}</p>`).join('');
const chapterHead=(id,label)=>`<div class="chapter-head"><p>Chapter ${nav.findIndex(([panel])=>panel===id)+1}</p><p class="label">${label}</p></div>`;
const imageDimensions={karan:[960,960],nmims:[959,692],twods:[960,1358]};
const photo=(name,alt,cls='')=>{
 const ratio=imageDimensions[name][0]/imageDimensions[name][1];
 const sizes=`(max-height:499px) min(160px, ${(name==='twods'?12:16)*ratio}dvh), (max-width:767px) min(160px, ${12*ratio}dvh), min(320px, ${(name==='twods'?12:30)*ratio}dvh)`;
 return `<picture class="photo ${cls}"><source media="(max-width:767px), (max-height:499px)" type="image/webp" srcset="/assets/${name}-160.webp 1x, /assets/${name}-320.webp 2x" sizes="${sizes}"><img src="/assets/${name}-320.webp" srcset="/assets/${name}-320.webp 1x, /assets/${name}-640.webp 2x" sizes="${sizes}" width="${imageDimensions[name][0]}" height="${imageDimensions[name][1]}" alt="${esc(alt)}" loading="lazy" decoding="async"></picture>`;
};
const about=lines(chapterCopy('about'));
panels.set('about',`<section id="about" data-horizontal-panel class="chapter about" aria-labelledby="about-title">${chapterHead('about',nav.find(([id])=>id==='about')[1])}<div class="two-col about-grid"><figure>${photo('karan','Karan Patel','portrait')}<figcaption>${esc(about.slice(4,6).join(' · '))}</figcaption></figure><div><h2 id="about-title" class="medium-title" data-reveal>${esc(about[0])}</h2><div class="lead">${paras(about.slice(1,3))}</div></div></div><p class="keywords">${esc(about.slice(6).join(' · '))}</p></section>`);
const education=content.chapters.find(c=>c.slug==='education').entries;
const educationSizes='(max-width:767px) calc(100vw - 78px), (max-width:1200px) 41.5vw, calc(47vw - 68px)';
const educationPhoto=e=>e.id==='gwu'
 ? `<picture class="education-media"><source type="image/webp" srcset="/assets/gwu-campus-400.webp 400w, /assets/gwu-campus-800.webp 800w" sizes="${educationSizes}"><img src="/assets/gwu-campus.jpg" srcset="/assets/gwu-campus.jpg 800w" sizes="${educationSizes}" width="800" height="533" alt="Students walking beside the George Washington University campus dome in autumn" loading="lazy" decoding="async"></picture>`
 : `<picture class="education-media"><source type="image/webp" srcset="/assets/nmims-320.webp 320w, /assets/nmims-640.webp 640w, /assets/nmims-960.webp 960w" sizes="${educationSizes}"><img src="/assets/nmims-640.webp" srcset="/assets/nmims-320.webp 320w, /assets/nmims-640.webp 640w, /assets/nmims-960.webp 960w" sizes="${educationSizes}" width="959" height="692" alt="NMIMS campus building" loading="lazy" decoding="async"></picture>`;
// TODO: Confirm any NMIMS academic highlights beyond the integrated program supplied by the owner.
const educationCard=e=>`<article class="education-card" id="${esc(e.id)}">${educationPhoto(e)}<div class="education-card-copy"><h3>${esc(e.institution)}</h3><p class="degree">${esc(e.degree)}</p><p class="education-dates">${esc(e.dates)}</p><ul>${e.highlights.map(h=>`<li>${esc(h)}</li>`).join('')}</ul></div></article>`;
panels.set('education',`<section id="education" data-horizontal-panel class="chapter education" aria-labelledby="education-title">${chapterHead('education','Education')}<h2 class="sr-only" id="education-title">Education</h2><div class="education-cards">${education.map(educationCard).join('')}</div></section>`);
const venture=lines(content.items.venture[0].copy);
const vIndex=x=>venture.indexOf(x);
const growth=venture.slice(vIndex('Growth')+1,vIndex('Flagship Initiative'));
// TODO: Confirm exact source adapters, storage, model boundaries, and deployment before specifying them.
const architecture=content.items['selected-work'].find(p=>p.slug==='quantera-ai').groups['Core Architecture'];
const stages=architecture.map(x=>x.replace(/^→\s*/,'').replace('Validation / fail-closed checks','Fail-closed checks'));
const diagramCopy=content.items.venture[0].diagram;
if(stages.length!==diagramCopy.labels.length||stages.length!==diagramCopy.notes.length)throw Error('QuantEra diagram copy must match the architecture stages.');
const diagram=`<div class="system-diagram" aria-label="${esc(diagramCopy.title)}" data-stage-label="${esc(diagramCopy.stageLabel)}"><h4>${esc(diagramCopy.title)}</h4><ol class="diagram-flow">${stages.map((name,i)=>`<li class="diagram-stage" style="--stage:${i}"><button type="button" class="diagram-node" data-diagram-node="${i}" data-note="${esc(diagramCopy.notes[i])}" aria-label="${esc(name)}" aria-pressed="false"><span class="stage-number" aria-hidden="true">0${i+1}</span><span aria-hidden="true">${esc(diagramCopy.labels[i])}</span></button>${i<stages.length-1?`<svg class="diagram-connector" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path class="edge-horizontal" d="M0 12H24"/><path class="edge-vertical" d="M12 0V24"/><circle class="data-packet" cx="3" cy="12" r="2"/></svg>`:''}</li>`).join('')}</ol><p class="diagram-tooltip" id="diagram-tooltip" role="status" aria-live="polite">${esc(diagramCopy.instruction)}</p></div>`;
const metricNumber = value => {
 const metric = parseMetricValue(value);
 if (!metric) return esc(value);
 return `<span class="sr-only">${esc(value)}</span><span aria-hidden="true" data-count-up data-count-target="${metric.target}" data-count-decimals="${metric.decimals}" data-count-prefix="${esc(metric.prefix)}" data-count-suffix="${esc(metric.suffix)}">${esc(value)}</span>`;
};
const ventureMetrics=`<dl class="metrics">${growth.filter((_,i)=>i%2===0).map((x,i)=>`<div><dt>${esc(growth[i*2+1])}</dt><dd>${metricNumber(x)}</dd></div>`).join('')}</dl>`;
const ventureInitiative=`<div class="initiative"><p class="label">Flagship Initiative</p><h3>QuantEra AI</h3><p class="degree">${esc(venture[vIndex('QuantEra AI')+1])}</p>${paras(venture.slice(vIndex('QuantEra AI')+2,vIndex('Investment Thesis')))}<h4 class="label">Investment Thesis</h4><p>${esc(venture[vIndex('Investment Thesis')+1])}</p><ol class="principles">${[0,1,2].map(i=>`<li><h4>${esc(venture[vIndex('Investment Thesis')+2+i*2])}</h4><p>${esc(venture[vIndex('Investment Thesis')+3+i*2])}</p></li>`).join('')}</ol></div>`;
panels.set('venture',`<section id="venture" data-horizontal-panel class="chapter venture dark" aria-labelledby="venture-title">${chapterHead('venture','Venture')}<article data-inline-detail="venture/twods-capital" class="inline-detail venture-split" tabindex="0" aria-labelledby="venture-title"><div class="venture-statement"><h2 id="venture-title" data-reveal>${esc(venture[0])}</h2><p class="degree">${esc(venture[1])}</p><p class="muted">${esc(venture[2])}</p>${photo('twods','Twods Capital financial research and education preview','twods')}<div class="venture-story lead">${paras(venture.slice(3,5))}</div>${ventureMetrics}</div><div class="venture-support">${ventureInitiative}${diagram}</div></article></section>`);
const projectCopy=chapterCopy('selected-work');
const skills=projectCopy.split('\nSKILLS\n')[1].trim().split('\n\n').map(lines);
const projectLinks=name=>`<div class="project-links">${Object.entries(content.projectLinks[name] || {}).filter(([,url])=>url).map(([kind,url])=>`<a href="${esc(url)}" target="_blank" rel="noopener noreferrer" aria-label="${esc(name)} ${kind==='repo'?'repository':'demo'} (opens in a new tab)">${kind==='repo'?'Repository':'Demo'} <span aria-hidden="true">↗</span></a>`).join('')}</div>`;
const contact=lines(chapterCopy('contact'));
panels.set('contact',`<section id="contact" data-horizontal-panel class="chapter contact dark" aria-labelledby="contact-title">${chapterHead('contact',nav.find(([id])=>id==='contact')[1])}<div class="two-col contact-grid"><h2 id="contact-title" data-reveal>${esc(contact[0])}</h2><div class="lead">${paras(contact.slice(1,4))}<a class="contact-email" href="mailto:${esc(content.contact.email)}">${esc(content.contact.email)}</a></div></div><footer><div><p class="footer-name">Karan Patel</p><p class="muted">${esc(intro[1])}</p></div><p class="footer-principle">Make the system intelligent. Make the intelligence accountable.</p></footer></section>`);
for (const p of content.items['selected-work']) {
 mkdirSync(`dist/projects/${p.slug}`,{recursive:true});
 writePublic(`dist/projects/${p.slug}/index.html`, `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="refresh" content="0;url=/#selected-work/${p.slug}"><title>${esc(p.name)}</title></head><body><a href="/#selected-work/${p.slug}">Open ${esc(p.name)}</a></body></html>`);
}
// Card summaries and full item content share the canonical JSON slug.
const detailBody = (section,p) => section==='experience'
 ? `<p>${esc(p.employer)} · ${esc(p.dates)}</p><h3>${esc(p.subtitle)}</h3><p>${esc(p.description)}</p><ul>${p.bullets.map(b=>`<li>${esc(b)}</li>`).join('')}</ul><h3>Technologies</h3><p>${esc(p.stack)}</p>`
 : p.groups ? `<p>${esc(p.subtitle)}</p>` + Object.entries(p.groups).map(([heading,copy])=>`<section class="detail-section"><h3>${esc(heading)}</h3>${paras(copy)}</section>`).join('')
 : `<p>${esc(p.subtitle)}</p><p>${esc(p.description)}</p><h3>Technologies</h3><p>${esc(p.stack)}</p>`;
const dialog = (section,p,body) => `<dialog data-detail="${section}/${p.slug}" id="detail-${section}-${p.slug}" role="dialog" aria-modal="true" aria-labelledby="title-${section}-${p.slug}"><div class="detail-top"><h2 tabindex="-1" id="title-${section}-${p.slug}">${esc(p.name)}</h2><button type="button" data-detail-close aria-label="Close ${esc(p.name)} details">Close ×</button></div><div class="detail-copy">${body}${projectLinks(p.name)}</div></dialog>`;
const fallbackDetail = (section,p,body) => `<noscript><details class="fallback-detail"><summary>${esc(p.name)} details</summary><div id="${section}/${p.slug}" class="detail-copy">${body}${projectLinks(p.name)}</div></details></noscript>`;
// Distinct compositions retain the same canonical detail routes and dialog bodies.
for (const section of ['experience','selected-work']) {
 const items=content.items[section];
 const index=section==='selected-work'
  ? `<div class="work-rows">${items.map(p=>`<a class="index-card work-row" data-index-card href="#${section}/${p.slug}"><h3>${esc(p.name)}</h3><p class="work-result">${esc(p.indexImpact||p.impact)}</p><p class="stack">${esc(p.indexStack)}</p></a>`).join('')}</div><a class="skills-link" data-index-card href="#selected-work/skills">Explore all skills →</a>`
  : `<div class="employers">${[items.slice(0,2),items.slice(2)].map(group=>`<article class="employer"><h3>${esc(group[0].employer)}</h3><div class="roles">${group.map(p=>`<a class="experience-role" data-index-card href="#experience/${p.slug}"><p class="role-name">${esc(p.name)}</p><p>${esc(p.indexDates)}</p></a>`).join('')}</div></article>`).join('')}</div>`;
 panels.set(section,`<section id="${section}" data-horizontal-panel class="chapter ${section}" aria-labelledby="${section}-title">${chapterHead(section,nav.find(([id])=>id===section)[1])}<h2 class="sr-only" id="${section}-title">${esc(nav.find(([id])=>id===section)[1])}</h2>${index}${items.map(p=>dialog(section,p,detailBody(section,p))+fallbackDetail(section,p,detailBody(section,p))).join('')}</section>`);
}
const skillDetail=dialog('selected-work',{slug:'skills',name:'Skills'},`<div class="skill-grid">${skills.map(s=>`<section><h3>${esc(s[0])}</h3><p>${esc(s.slice(1).join(' · '))}</p></section>`).join('')}</div>`);
panels.set('selected-work',panels.get('selected-work').replace(/<\/section>$/,skillDetail+fallbackDetail('selected-work',{slug:'skills',name:'Skills'},`<div class="skill-grid">${skills.map(s=>`<section><h3>${esc(s[0])}</h3><p>${esc(s.slice(1).join(' · '))}</p></section>`).join('')}</div>`)+'</section>'));

mkdirSync('dist',{recursive:true});
// One authoritative order for the generated DOM, rail, and runtime traversal.
const home = `<div data-horizontal-story><div data-horizontal-pin><div data-horizontal-track>${nav.map(([id],i)=>panels.get(id).replace('<section ',`<section data-chapter-number="${i+1}" `)).join('\n')}</div></div></div>`
  .replace(/(<section\b[^>]*data-horizontal-panel[^>]*>)/g, '\n$1\n');
writePublic('dist/index.html',shell(home).replace('<noscript><a href="/#chapters">Chapters</a></noscript>', ''));
writePublic('dist/style.css',['src/tokens.css','src/style.css','src/hero-motion.css','src/chapter-core.css','src/interaction-motion.css','src/mobile-first.css'].map(file=>readFileSync(file,'utf8')).join('\n'));
writeFileSync('dist/.nojekyll','');
writeFileSync('dist/site-config.json',JSON.stringify({basePath:prefix,version:'2.0.0'})+'\n');
writePublic('dist/404.html',`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Page not found | Karan Patel</title><style>body{margin:0;padding:10vh 24px;background:#FAF9F6;color:#25302E;font:18px/1.6 system-ui}main{max-width:40rem;margin:auto}a{color:#1F635C;display:inline-block;padding:12px 0}</style></head><body><main><h1>Page not found</h1><p>This page may have moved.</p><a href="/">Return to Karan Patel’s portfolio →</a></main></body></html>`);
copyFileSync('src/main.js','dist/main.js');
copyFileSync('src/projects.js','dist/projects.js');
copyFileSync('src/hero.js','dist/hero.js');
copyFileSync('src/chapter-motion.js','dist/chapter-motion.js');
copyFileSync('src/motion.js','dist/motion.js');
copyFileSync('src/navigation.js','dist/navigation.js');
copyFileSync('src/metrics.js','dist/metrics.js');
copyFileSync('src/horizontal-layout.js','dist/horizontal-layout.js');
cpSync('src/assets','dist/assets',{recursive:true});
cpSync('src/fonts','dist/fonts',{recursive:true});
console.log('Built static portfolio.');
