import { initDeckPagination, paginateDetail } from './deck-pagination.js';
import { initCourseworkTickers } from './coursework.js';
import { initHorizontal } from './motion.js';
import { initMetricCounters } from './metrics.js';
import { initMobileNavigation } from './navigation.js';

let panels=[...document.querySelectorAll('[data-horizontal-panel]')];
const pagination=initDeckPagination();
document.addEventListener('deck-layout',()=>{panels=[...document.querySelectorAll('[data-horizontal-panel]')]});
const rail=[...document.querySelectorAll('[data-rail-label]')];
let opened=null,origin=null,ownedEntry=false,bodyOverflow='',activePanel=null,focusReturn=null,focusFrame=0;
function currentChapter(panel,progress){
 if(!panel)return;
 if(activePanel!==panel){
  rail.forEach(a=>{if(a.hash===`#${panel.dataset.chapter||panel.id}`)a.setAttribute('aria-current','location');else a.removeAttribute('aria-current')});
  rail.forEach(a=>a.classList.toggle('is-settling',a.hash===`#${panel.dataset.chapter||panel.id}`));
  const paper=id=>['about','education','experience','selected-work'].includes(id);
  document.querySelector('.rail').toggleAttribute('data-palette-transition',Boolean(activePanel)&&(document.documentElement.dataset.theme==='light'||paper(activePanel.id)===paper(panel.id)));
  activePanel=panel;
  document.documentElement.dataset.activeChapter=panel.id;
  syncProjectChapter(panel);
 }
 if(!window.portfolioMotion?.native)window.portfolioAtmosphere?.travel();
 if(innerWidth>=768){const i=panels.indexOf(panel);document.querySelector('[data-header-scroll-progress]').style.transform=`scaleX(${progress??i/(panels.length-1)})`}
}
function position(panel,smooth=false){
 panel.scrollTop=0;panel.scrollLeft=0;
 if(window.portfolioMotion)window.portfolioMotion.go(panel,smooth);
 else {scrollTo({top:panel.offsetTop,behavior:'instant'});currentChapter(panel)}
}
function hideDetail(){
 if(!opened)return;
 const dialog=opened;opened=null;dialog.close();document.body.style.overflow=bodyOverflow;
 window.portfolioMotion?.unlock();
 const card=origin;origin=null;ownedEntry=false;
 if(card){
  const panel=card.closest('[data-horizontal-panel]');position(panel);card.focus({preventScroll:true});
  // History traversal can restore BODY or a native scroll container from the
  // URL's earlier chapter. Reapply unless the user focused another control.
  focusReturn=card;cancelAnimationFrame(focusFrame);
  focusFrame=requestAnimationFrame(()=>{focusFrame=requestAnimationFrame(()=>{
   focusFrame=0;
   if(!opened&&focusReturn===card&&card.isConnected&&activePanel===panel&&[document.body,document.documentElement,...panels,card].includes(document.activeElement)){window.portfolioMotion?.reveal(card);card.focus({preventScroll:true})}
   focusReturn=null;
  })});
 }
}
function openDetail(dialog,card,push){
 if(opened===dialog)return;
 cancelAnimationFrame(focusFrame);focusFrame=0;focusReturn=null;
 if(opened)hideDetail();
 const panel=dialog.closest('[data-horizontal-panel]');position(panel);
 origin=card||document.querySelector(`a[href="#${dialog.dataset.detail}"]`);
 if(push){
  // Wheel travel can leave an earlier chapter hash in the URL. Save the actual
  // background chapter so Back/Escape restores the card's view as well as focus.
  history.replaceState({...history.state,portfolioReturnChapter:panel.id},'',location.href);
  history.pushState({portfolioDetail:true},'',`#${dialog.dataset.detail}`);ownedEntry=true
 }
 opened=dialog;bodyOverflow=document.body.style.overflow;
 window.portfolioMotion?.lock();document.body.style.overflow='hidden';
 dialog.showModal();paginateDetail(dialog);dialog.scrollTop=0;dialog.querySelector('h2').focus({preventScroll:true});
 position(panel);
}
function route(){
 let hash=location.hash.slice(1);
 try{hash=decodeURIComponent(hash)}catch{/* A malformed bookmark must not break the app. */}
 const aliases={hero:'intro',skills:'selected-work/skills','featured-skills':'selected-work/skills'};
 if(aliases[hash]){hash=aliases[hash];history.replaceState(history.state,'',`#${hash}`)}
 // Keep existing project bookmarks usable after the chapter rename/removal.
 const legacy=hash.match(/^(projects|projects-a|projects-b|archive)(?:\/(.*))?$/);
 if(legacy){
  const slug=legacy[2];
  const target=slug&&document.querySelector(`[data-detail="selected-work/${CSS.escape(slug)}"]`);
  hash=target?`selected-work/${slug}`:'selected-work';
  history.replaceState(history.state,'',`#${hash}`);
 }
 const dialog=[...document.querySelectorAll('[data-detail]')].find(d=>d.dataset.detail===hash);
 if(dialog){openDetail(dialog,null,false);return}
 hideDetail();const panel=document.getElementById(history.state?.portfolioReturnChapter||hash)?.closest('[data-horizontal-panel]');if(panel)position(panel);
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
 const panel=document.getElementById(url.hash.slice(1));if(panel?.matches('[data-horizontal-panel]')){event.preventDefault();history.replaceState({...history.state,portfolioReturnChapter:activePanel?.id||'intro'},'',location.href);history.pushState(null,'',url.hash);position(panel,true)}
});
for(const dialog of document.querySelectorAll('[data-detail]')){
 dialog.addEventListener('cancel',e=>{e.preventDefault();closeDetail()});
 dialog.addEventListener('keydown',e=>{
  if(e.key!=='Tab')return;
  const items=[...dialog.querySelectorAll('a[href],button,[tabindex="0"]')].filter(el=>el.getClientRects().length&&!el.disabled);
  const first=items[0],last=items.at(-1);
  if(e.shiftKey&&(document.activeElement===first||document.activeElement===dialog.querySelector('h2'))){e.preventDefault();last.focus()}
  else if(!e.shiftKey&&(document.activeElement===last||document.activeElement===dialog.querySelector('h2'))){e.preventDefault();first.focus()}
 });
}
document.addEventListener('focusin',event=>{if(opened)return;const panel=event.target.closest('[data-horizontal-panel]');if(panel){if(window.portfolioMotion)window.portfolioMotion.reveal(event.target);else event.target.scrollIntoView({block:'nearest'})}});
window.addEventListener('popstate',route);window.addEventListener('hashchange',route);
let railQueued=false;
function updateVerticalRail(){
 railQueued=false;
 if(window.portfolioMotion)return;
 const readingLine=innerHeight*.3;
 const panel=panels.find(p=>{const r=p.getBoundingClientRect();return r.top<=readingLine&&r.bottom>readingLine})||panels.at(-1);
 const total=document.documentElement.scrollHeight-innerHeight;
 currentChapter(panel,total>0?scrollY/total:0);
}
function scheduleVerticalRail(){if(!railQueued){railQueued=true;requestAnimationFrame(updateVerticalRail)}}
addEventListener('scroll',scheduleVerticalRail,{passive:true});addEventListener('resize',scheduleVerticalRail,{passive:true});scheduleVerticalRail();
window.portfolioReady=(async()=>{let fontDeadline;await Promise.race([document.fonts.ready,new Promise(resolve=>{fontDeadline=setTimeout(resolve,1500)})]);clearTimeout(fontDeadline);initHorizontal({currentChapter,pagination});route();initMetricCounters();initMobileNavigation();initCourseworkTickers();document.documentElement.dataset.ready='true';clearTimeout(window.deckFallback);document.documentElement.removeAttribute('data-deck-pending')})();
const themes=[...document.querySelectorAll('[data-theme-toggle]')];
function applyTheme(value,persist=false){
 document.querySelector('.rail')?.removeAttribute('data-palette-transition');
 document.documentElement.dataset.theme=value;
 themes.forEach(theme=>{theme.setAttribute('aria-pressed',String(value==='light'));theme.setAttribute('aria-label',`Switch to ${value==='light'?'dark':'light'} theme`)});
 document.querySelector('meta[name="theme-color"]')?.setAttribute('content',value==='light'?'#FAF9F6':'#3A3632');
 if(persist){try{localStorage.setItem('portfolio-theme',value)}catch{}}
}
applyTheme(document.documentElement.dataset.theme==='dark'?'dark':'light');
themes.forEach(theme=>theme.addEventListener('click',()=>applyTheme(document.documentElement.dataset.theme==='light'?'dark':'light',true)));

// Interaction-only ownership: chapter-motion owns the same rows' entrances.
const workList=document.querySelector('.work-rows');
const workRows=[...document.querySelectorAll('.work-row')];
let pointerRow=null,focusRow=null,projectInput='pointer';
function activateProject(){
 const active=projectInput==='focus'?focusRow||pointerRow:pointerRow||focusRow;
 workList?.classList.toggle('is-emphasizing',Boolean(active));
 workRows.forEach(row=>row.classList.toggle('is-active',row===active));
}
function syncProjectChapter(panel){
 if(panel.id==='selected-work')return;
 pointerRow=focusRow=null;activateProject();
}
const projectPointer=event=>{const next=event.target.closest('.work-row');if(next!==pointerRow)projectInput='pointer';pointerRow=next;activateProject()};
const projectLeave=()=>{pointerRow=null;activateProject()};
const projectFocus=event=>{focusRow=event.target.closest('.work-row');projectInput='focus';activateProject()};
const projectBlur=event=>{focusRow=event.relatedTarget?.closest?.('.work-row')||null;activateProject()};
const underlines=[...document.querySelectorAll('.contact-email,.skills-link,.project-links a,.explore')];
underlines.forEach(link=>link.classList.add('motion-underline'));
function updateUnderline(link){
 const active=link.matches(':hover,:focus-visible');
 link.classList.toggle('is-emphasized',active);
}
const underlineEnter=event=>updateUnderline(event.currentTarget);
const underlineLeave=event=>updateUnderline(event.currentTarget);
function bindInteractions(){
 workList?.addEventListener('pointerover',projectPointer);
 workList?.addEventListener('pointerleave',projectLeave);
 workList?.addEventListener('focusin',projectFocus);
 workList?.addEventListener('focusout',projectBlur);
 underlines.forEach(link=>{
  link.addEventListener('pointerenter',underlineEnter);link.addEventListener('pointerleave',underlineLeave);
  link.addEventListener('focus',underlineEnter);link.addEventListener('blur',underlineLeave);
 });
}
function disposeInteractions(){
 cancelAnimationFrame(focusFrame);focusFrame=0;focusReturn=null;
 workList?.removeEventListener('pointerover',projectPointer);
 workList?.removeEventListener('pointerleave',projectLeave);
 workList?.removeEventListener('focusin',projectFocus);
 workList?.removeEventListener('focusout',projectBlur);
 pointerRow=focusRow=null;activateProject();
 underlines.forEach(link=>{
  link.removeEventListener('pointerenter',underlineEnter);link.removeEventListener('pointerleave',underlineLeave);
  link.removeEventListener('focus',underlineEnter);link.removeEventListener('blur',underlineLeave);
  link.classList.remove('is-emphasized');
 });
}
bindInteractions();
addEventListener('pagehide',disposeInteractions);
addEventListener('pageshow',event=>{if(event.persisted){bindInteractions();scheduleVerticalRail()}});

addEventListener('resize',()=>{if(opened)requestAnimationFrame(()=>paginateDetail(opened))},{passive:true});
