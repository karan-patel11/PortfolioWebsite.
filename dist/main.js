const panels=[...document.querySelectorAll('[data-horizontal-panel]')];
const preference=matchMedia('(prefers-reduced-motion: reduce)');
const desktop=matchMedia('(min-width: 1024px) and (min-height: 500px)');
const rail=[...document.querySelectorAll('[data-rail-label]')];
let opened=null,origin=null,ownedEntry=false,bodyOverflow='',loading;
function currentChapter(panel){
 if(!panel)return;
 rail.forEach(a=>a.toggleAttribute('aria-current',a.hash===`#${panel.id}`));
 rail.forEach(a=>{if(a.hasAttribute('aria-current'))a.setAttribute('aria-current','location')});
 const i=panels.indexOf(panel);document.querySelector('[data-header-scroll-progress]').style.transform=`scaleX(${i/(panels.length-1)})`;
}
function position(panel){
 panel.scrollTop=0;panel.scrollLeft=0;
 if(window.portfolioMotion)window.portfolioMotion.go(panel);
 else {scrollTo({top:panel.offsetTop,behavior:'instant'});currentChapter(panel)}
}
function hideDetail(){
 if(!opened)return;
 const dialog=opened;opened=null;dialog.close();document.body.style.overflow=bodyOverflow;
 window.portfolioMotion?.unlock();
 const card=origin;origin=null;ownedEntry=false;
 if(card){position(card.closest('[data-horizontal-panel]'));card.focus({preventScroll:true})}
}
function openDetail(dialog,card,push){
 if(opened===dialog)return;
 if(opened)hideDetail();
 const panel=dialog.closest('[data-horizontal-panel]');position(panel);
 origin=card||document.querySelector(`a[href="#${dialog.dataset.detail}"]`);
 if(push){history.pushState({portfolioDetail:true},'',`#${dialog.dataset.detail}`);ownedEntry=true}
 opened=dialog;bodyOverflow=document.body.style.overflow;
 window.portfolioMotion?.lock();document.body.style.overflow='hidden';
 dialog.showModal();dialog.scrollTop=0;dialog.querySelector('h2').focus({preventScroll:true});
}
function route(){
 const hash=decodeURIComponent(location.hash.slice(1));
 const dialog=[...document.querySelectorAll('[data-detail]')].find(d=>d.dataset.detail===hash);
 if(dialog){openDetail(dialog,null,false);return}
 hideDetail();const panel=document.getElementById(hash)?.closest('[data-horizontal-panel]');if(panel)position(panel);
}
function closeDetail(){
 if(!opened)return;
 if(ownedEntry){history.back()}else{const id=opened.closest('[data-horizontal-panel]').id;history.replaceState(null,'',`#${id}`);hideDetail()}
}
document.addEventListener('click',event=>{
 if(event.target.closest('[data-detail-close]')){closeDetail();return}
 const a=event.target.closest('a[href]');if(!a||event.button!==0||event.metaKey||event.ctrlKey||event.altKey||event.shiftKey)return;
 const url=new URL(a.href);if(url.origin!==location.origin||url.pathname!==location.pathname||!url.hash)return;
 const dialog=[...document.querySelectorAll('[data-detail]')].find(d=>`#${d.dataset.detail}`===url.hash);
 if(dialog){event.preventDefault();openDetail(dialog,a,true);return}
 const panel=document.getElementById(url.hash.slice(1));if(panel?.matches('[data-horizontal-panel]')){event.preventDefault();history.pushState(null,'',url.hash);position(panel)}
});
for(const dialog of document.querySelectorAll('[data-detail]')){
 dialog.addEventListener('cancel',e=>{e.preventDefault();closeDetail()});
 dialog.addEventListener('keydown',e=>{
  if(e.key!=='Tab')return;
  const items=[...dialog.querySelectorAll('a[href],button,[tabindex="0"]')].filter(el=>el.getClientRects().length);
  const first=items[0],last=items.at(-1);
  if(e.shiftKey&&(document.activeElement===first||document.activeElement===dialog.querySelector('h2'))){e.preventDefault();last.focus()}
  else if(!e.shiftKey&&(document.activeElement===last||document.activeElement===dialog.querySelector('h2'))){e.preventDefault();first.focus()}
 });
}
document.addEventListener('focusin',event=>{if(opened)return;const panel=event.target.closest('[data-horizontal-panel]');if(panel)position(panel)});
window.addEventListener('popstate',route);window.addEventListener('hashchange',route);
const observer=new IntersectionObserver(entries=>{if(!window.portfolioMotion)for(const e of entries)if(e.isIntersecting)currentChapter(e.target)},{threshold:.6});panels.forEach(p=>observer.observe(p));
async function loadMotion(){
 if(!desktop.matches||preference.matches){route();return}
 if(loading)return;
 loading=Promise.all([import('https://cdn.jsdelivr.net/npm/gsap@3.13.0/ScrollTrigger.js'),import('https://cdn.jsdelivr.net/npm/lenis@1.1.13/dist/lenis.mjs'),import('./motion.js')]).then(([{ScrollTrigger},{default:Lenis},{initHorizontal}])=>initHorizontal({gsap:window.gsap,ScrollTrigger,Lenis,currentChapter,onReady:()=>{if(opened){position(opened.closest('[data-horizontal-panel]'));window.portfolioMotion?.lock()}else route()}})).catch(error=>{console.error('Horizontal engine failed',error);route()});
 await loading;
}
window.portfolioReady=(async()=>{await document.fonts.ready;await loadMotion();route();document.documentElement.dataset.ready='true'})();
desktop.addEventListener('change',loadMotion);preference.addEventListener('change',loadMotion);
const theme=document.querySelector('[data-theme-toggle]');theme?.addEventListener('click',()=>{const light=document.documentElement.dataset.theme!=='light';document.documentElement.dataset.theme=light?'light':'dark';theme.setAttribute('aria-pressed',String(light));theme.setAttribute('aria-label',`Switch to ${light?'dark':'light'} theme`)});
