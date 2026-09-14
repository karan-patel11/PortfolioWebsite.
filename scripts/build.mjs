import {readFileSync,writeFileSync,mkdirSync,copyFileSync,cpSync} from 'node:fs';
const content=JSON.parse(readFileSync('content/portfolio.json','utf8'));
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const lines=s=>s.trim().split('\n').filter(Boolean);
const intro=lines(content.intro);
const nav=[['intro','Intro'],['about','About'],['education','Education'],['expand','Expand'],['projects','Projects A'],['projects-b','Projects B'],['experience','Experience'],['venture','Venture'],['contact','Next Chapter']];
const shell=(body,title='Karan Patel | AI Systems Engineer')=>`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="${esc(intro[2])}"><meta name="theme-color" content="#3A3632"><title>${esc(title)}</title><link rel="stylesheet" href="/style.css"><script src="https://cdn.jsdelivr.net/npm/gsap@3.13.0/dist/gsap.min.js" defer></script><script src="/main.js" defer></script></head><body><a class="skip" href="#main">Skip to content</a><header class="rail" data-intro-header><a class="wordmark" href="/#intro" aria-label="Karan Patel, intro">KP</a><button class="menu-toggle" data-menu-toggle aria-haspopup="dialog" aria-controls="menu" aria-expanded="false" hidden><span class="desktop-menu" aria-hidden="true">☰</span><span class="mobile-menu">Menu</span></button><noscript><a href="/#chapters">Chapters</a></noscript><nav class="header-rail" aria-label="Chapters">${nav.map(([id,label])=>`<a href="#${id}" data-rail-label>${esc(label)}</a>`).join('')}</nav><button class="theme-toggle" data-theme-toggle aria-label="Switch to light theme" aria-pressed="false">◐</button><span data-header-scroll-progress aria-hidden="true"></span></header><dialog id="menu" aria-label="Chapter navigation"><button class="menu-close" autofocus>Close <span aria-hidden="true">×</span></button><nav aria-label="Chapters">${nav.map(([id,label],i)=>`<a href="/#${id}"><span class="label">${i.toString().padStart(2,'0')}</span>${esc(label)}<span aria-hidden="true">↗</span></a>`).join('')}</nav></dialog><main id="main" tabindex="-1">${body}</main></body></html>`;
const masked = value => `<span class="line-mask"><span data-line>${esc(value)}</span></span>`;
const hero=`<section class="chapter hero" id="intro" aria-labelledby="identity" data-horizontal-panel data-header-bg="transparent" data-header-text="var(--hero-text)" data-header-border="var(--hero-border)">
<div data-loading-base-overlay aria-hidden="true"></div>
<div data-hero-year aria-hidden="true"><div data-year-row><span data-year-start-text><span class="char">2</span><span class="char">0</span></span><span class="year-window"><span data-year-strip>${Array.from({length:14},(_,i)=>`<span class="year-strip-cell">${i+13}</span>`).join('')}</span></span></div></div>
<div data-hero-name><h1 id="identity" data-name-heading><span class="sr-only">Karan Patel</span><span data-name-row aria-hidden="true">${['KARAN','PATEL'].map(word=>`<span class="name-mask"><span data-name-line-text><span class="word" data-name-word>${word}</span></span></span>`).join('')}</span></h1></div>
<p class="hero-role" data-loading-tagline data-reveal-line>${masked(intro[1])}</p>
<p class="hero-intro" data-loading-journey-line data-reveal-line>${masked(intro[2])}</p>
<p class="hero-statement" data-reveal-line>${masked(intro[5])}</p>
<div class="hero-bottom"><p data-reveal-line>${masked('Washington, D.C.')}<span class="line-mask"><span data-line><time data-clock>Local time</time> · ET</span></span></p><p data-reveal-line>${masked('Open for collaborations')}</p><a class="explore to-link-underline" href="#about" data-reveal-line>${masked('SCROLL ↘')}</a></div></section>`;
const panels=new Map([['intro',hero]]);

const paras=arr=>arr.map(x=>`<p>${esc(x)}</p>`).join('');
const chapterHead=(id,label)=>`<div class="chapter-head"><p>Chapter ${['0','I','II','III','IV','V','VI','VII','VIII'][nav.findIndex(([panel])=>panel===id)]}</p><p class="label">${label}</p></div>`;
const imageDimensions={karan:[960,960],gwu:[736,1308],nmims:[959,692],twods:[960,1358]};
const photo=(name,alt,cls='')=>{
 const ratio=imageDimensions[name][0]/imageDimensions[name][1];
 const sizes=`(max-height:499px) min(160px, ${(name==='twods'?12:16)*ratio}dvh), (max-width:767px) min(160px, ${12*ratio}dvh), min(320px, ${(name==='twods'?12:30)*ratio}dvh)`;
 return `<picture class="photo ${cls}"><source media="(max-width:767px), (max-height:499px)" type="image/webp" srcset="/assets/${name}-160.webp 1x, /assets/${name}-320.webp 2x" sizes="${sizes}"><img src="/assets/${name}-320.webp" srcset="/assets/${name}-320.webp 1x, /assets/${name}-640.webp 2x" sizes="${sizes}" width="${imageDimensions[name][0]}" height="${imageDimensions[name][1]}" alt="${esc(alt)}" loading="lazy" decoding="async"></picture>`;
};
const about=lines(content.chapters[0].copy);
panels.set('about',`<section id="about" data-horizontal-panel class="chapter about" aria-labelledby="about-title">${chapterHead('about','About me')}<div class="two-col about-grid"><figure>${photo('karan','Karan Patel','portrait')}<figcaption>${esc(about.slice(4,6).join(' · '))}</figcaption></figure><div><h2 id="about-title" class="medium-title" data-reveal>${esc(about[0])}</h2><div class="lead">${paras(about.slice(1,3))}</div></div></div><p class="keywords">${esc(about.slice(6).join(' · '))}</p></section>`);
const edu=lines(content.chapters[1].copy);
panels.set('education',`<section id="education" data-horizontal-panel class="chapter education" aria-labelledby="education-title">${chapterHead('education','Education')}<h2 class="sr-only" id="education-title">Education</h2><div class="two-col"><article>${photo('gwu','George Washington University building with the GW sign','campus gwu')}<h3>${esc(edu[0])}</h3><p class="degree">${esc(edu[2])}</p><p>${esc(edu[3])}<br>${esc(edu[1])}</p><p>${esc(edu[4])}</p><p class="label">${esc(edu[5])}</p><p>${esc(edu[6])}</p></article><article id="nmims">${photo('nmims','NMIMS campus building','campus')}<h3>${esc(edu[7])}</h3><p class="degree">${esc(edu[8])}</p><p>${esc(edu[9])}</p></article></div></section>`);
const venture=lines(content.items.venture[0].copy);
const vIndex=x=>venture.indexOf(x);
const growth=venture.slice(vIndex('Growth')+1,vIndex('Flagship Initiative'));
const arch=venture.slice(vIndex('Architecture')+1,vIndex('Validation')).filter(x=>x!=='↓');
const architecture=items=>`<ol class="architecture">${items.map(x=>`<li>${esc(x.replace(/^→\s*/,''))}</li>`).join('')}</ol>`;
panels.set('venture',`<section id="venture" data-horizontal-panel class="chapter venture dark" aria-labelledby="venture-title">${chapterHead('venture','Venture')}<div class="two-col"><div><h2 id="venture-title" data-reveal>${esc(venture[0])}</h2><p class="degree">${esc(venture[1])}</p><p class="muted">${esc(venture[2])}</p><div class="venture-story lead">${paras(venture.slice(3,5))}</div>${photo('twods','Twods Capital financial research and education preview','twods')}</div><div><dl class="metrics">${growth.filter((_,i)=>i%2===0).map((x,i)=>`<div><dt>${esc(growth[i*2+1])}</dt><dd>${esc(x)}</dd></div>`).join('')}</dl><div class="initiative"><p class="label">Flagship Initiative</p><h3>QuantEra AI</h3><p class="degree">${esc(venture[vIndex('QuantEra AI')+1])}</p>${paras(venture.slice(vIndex('QuantEra AI')+2,vIndex('Investment Thesis')))}<h4 class="label">Investment Thesis</h4><p>${esc(venture[vIndex('Investment Thesis')+1])}</p><ol class="principles">${[0,1,2].map(i=>`<li><h4>${esc(venture[vIndex('Investment Thesis')+2+i*2])}</h4><p>${esc(venture[vIndex('Investment Thesis')+3+i*2])}</p></li>`).join('')}</ol></div></div></div><details class="venture-detail"><summary>Architecture & validation <span aria-hidden="true">↗</span></summary><div class="two-col"><div><h3>Architecture</h3>${architecture(arch)}</div><div><h3>Validation</h3><p>${esc(venture[vIndex('Validation')+1])}</p><h4 class="label">Technologies</h4><p>${esc(venture.at(-1))}</p></div></div></details></section>`);
const projectCopy=content.chapters[4].copy;
const skills=projectCopy.split('\nSKILLS\n')[1].trim().split('\n\n').map(lines);
const projectLinks=name=>`<div class="project-links">${Object.entries(content.projectLinks[name] || {}).filter(([,url])=>url).map(([kind,url])=>`<a href="${esc(url)}" target="_blank" rel="noopener noreferrer" aria-label="${esc(name)} ${kind==='repo'?'repository':'demo'} (opens in a new tab)">${kind==='repo'?'Repository':'Demo'} <span aria-hidden="true">↗</span></a>`).join('')}</div>`;
const contact=lines(content.chapters[5].copy);
panels.set('contact',`<section id="contact" data-horizontal-panel class="chapter contact dark" aria-labelledby="contact-title">${chapterHead('contact','')}<div class="two-col contact-grid"><h2 id="contact-title" data-reveal>NEXT CHAPTER</h2><div class="lead">${paras(contact.slice(1,4))}<a class="contact-email" href="mailto:${esc(content.contact.email)}">${esc(content.contact.email)}</a></div></div><footer><div><p class="footer-name">Karan Patel</p><p class="muted">${esc(intro[1])}</p><p class="muted">Washington, D.C. / United States</p></div><p class="footer-principle">Make the system intelligent. Make the intelligence accountable.</p></footer></section>`);
for (const p of content.items.projects) {
 mkdirSync(`dist/projects/${p.slug}`,{recursive:true});
 writeFileSync(`dist/projects/${p.slug}/index.html`, `<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=/#projects/${p.slug}"><title>${esc(p.name)}</title><a href="/#projects/${p.slug}">Open ${esc(p.name)}</a>`);
}
// Card summaries and full item content share the canonical JSON slug.
const detailBody = (section,p) => section==='experience'
 ? `<p>${esc(p.employer)} · ${esc(p.dates)}</p><h3>${esc(p.subtitle)}</h3><p>${esc(p.description)}</p><ul>${p.bullets.map(b=>`<li>${esc(b)}</li>`).join('')}</ul><h3>Technologies</h3><p>${esc(p.stack)}</p>`
 : p.groups ? `<p>${esc(p.subtitle)}</p>` + Object.entries(p.groups).map(([heading,copy])=>`<section class="detail-section"><h3>${esc(heading)}</h3>${paras(copy)}</section>`).join('')
 : `<p>${esc(p.subtitle)}</p><p>${esc(p.description)}</p><h3>Technologies</h3><p>${esc(p.stack)}</p>`;
const dialog = (section,p,body) => `<dialog data-detail="${section}/${p.slug}" id="detail-${section}-${p.slug}" role="dialog" aria-modal="true" aria-labelledby="title-${section}-${p.slug}"><div class="detail-top"><h2 tabindex="-1" id="title-${section}-${p.slug}">${esc(p.name)}</h2><button type="button" data-detail-close aria-label="Close ${esc(p.name)} details">Close ×</button></div><div class="detail-copy">${body}${projectLinks(p.name)}</div></dialog>`;
for (const section of ['experience','projects','projects-b']) {
 const items=content.items[section];
 panels.set(section, `<section id="${section}" data-horizontal-panel class="chapter ${section}" aria-labelledby="${section}-title">${chapterHead(section,nav.find(([id])=>id===section)[1])}<h2 id="${section}-title">${section==='experience'?'Engineering experience':section==='projects'?'Featured Projects':'Project archive'}</h2><div class="index-grid">${items.map(p=>`<a class="index-card" data-index-card href="#${section}/${p.slug}"><h3>${esc(p.name)}</h3>${section==='experience'?`<p>${esc(p.employer)}</p><p>${esc(p.indexDates)}</p>`:`<p>${esc(p.indexDescription||p.subtitle)}</p>`}<p class="stack">${esc(p.indexStack)}</p><p class="impact">${esc(p.indexImpact||p.impact)}</p></a>`).join('')}</div>${section==='projects-b'?'<a class="skills-link" data-index-card href="#projects-b/skills">Explore all skills →</a>':''}${items.map(p=>dialog(section,p,detailBody(section,p))).join('')}</section>`);
}
const skillDetail=dialog('projects-b',{slug:'skills',name:'Skills'},`<div class="skill-grid">${skills.map(s=>`<section><h3>${esc(s[0])}</h3><p>${esc(s.slice(1).join(' · '))}</p></section>`).join('')}</div>`);
panels.set('projects-b',panels.get('projects-b').replace(/<\/section>$/,skillDetail+'</section>'));
const ventureBody=panels.get('venture').replace(/^<section[^>]*>/,'').replace(/<\/section>$/,'').replace('<details class="venture-detail">','<div class="venture-detail">').replace('</details>','</div>').replace(/<summary>[\s\S]*?<\/summary>/,'');
panels.set('venture',`<section id="venture" data-horizontal-panel class="chapter venture dark"><article data-inline-detail="venture/twods-capital" class="inline-detail" tabindex="0" aria-labelledby="venture-title">${ventureBody}</article></section>`);

mkdirSync('dist',{recursive:true});
// One authoritative order for the generated DOM, rail, and runtime traversal.
// Expand remains an empty slot; no placeholder copy or media is invented.
panels.set('expand','<section id="expand" data-horizontal-panel data-expand-panel aria-label="Expand"></section>');
const home = `<div data-horizontal-story><div data-horizontal-pin><div data-horizontal-track>${nav.map(([id])=>panels.get(id)).join('\n')}</div></div></div>`
  .replace(/(<section\b[^>]*data-horizontal-panel[^>]*>)/g, '\n$1\n');
writeFileSync('dist/index.html',shell(home));
writeFileSync('dist/style.css',readFileSync('src/tokens.css','utf8')+'\n'+readFileSync('src/style.css','utf8'));
copyFileSync('src/main.js','dist/main.js');
copyFileSync('src/projects.js','dist/projects.js');
copyFileSync('src/hero.js','dist/hero.js');
copyFileSync('src/motion.js','dist/motion.js');
copyFileSync('src/horizontal-layout.js','dist/horizontal-layout.js');
cpSync('src/assets','dist/assets',{recursive:true});
console.log('Built static portfolio.');
