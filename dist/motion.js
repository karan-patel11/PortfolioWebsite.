import { measureTrack } from './horizontal-layout.js';
export function initHorizontal({ gsap, ScrollTrigger, Lenis, currentChapter, onReady }) {
  gsap.registerPlugin(ScrollTrigger);
  const root=document.documentElement;
  const story=document.querySelector('[data-horizontal-story]');
  const pin=story.querySelector('[data-horizontal-pin]');
  const track=story.querySelector('[data-horizontal-track]');
  const panels=[...track.children];
  gsap.matchMedia().add('(min-width: 1024px) and (min-height: 500px) and (prefers-reduced-motion: no-preference)',()=>{
    root.setAttribute('data-horizontal-active','');
    let measurement=measureTrack(track,panels);
    const lenis=new Lenis({lerp:.1,prevent:node=>Boolean(node.closest?.('dialog, [data-inline-detail]'))});
    const tick=time=>lenis.raf(time*1000);
    lenis.on('scroll',ScrollTrigger.update);gsap.ticker.add(tick);
    const tween=gsap.to(track,{x:()=>-measurement.travel,ease:'none',scrollTrigger:{trigger:pin,pin:true,start:'top top',end:()=>`+=${measurement.travel}`,scrub:true,invalidateOnRefresh:true,onUpdate:self=>currentChapter(panels[Math.round(self.progress*(panels.length-1))])}});
    const trigger=tween.scrollTrigger;
    const measure=()=>{measurement=measureTrack(track,panels);lenis.resize()};
    ScrollTrigger.addEventListener('refreshInit',measure);
    let locked=null;
    const engine={lenis,trigger,get measurement(){return measurement},
      go(panel){const index=panels.indexOf(panel);if(index<0)return;story.scrollLeft=pin.scrollLeft=track.scrollLeft=0;lenis.scrollTo(trigger.start+index*innerWidth,{immediate:true,force:true});ScrollTrigger.update();},
      lock(){if(locked)return;locked={stopped:lenis.isStopped,enabled:trigger.enabled,scroll:scrollY};lenis.stop();trigger.disable(false,false);},
      unlock(){if(!locked)return;const prior=locked;locked=null;if(prior.enabled)trigger.enable(false,false);lenis.scrollTo(prior.scroll,{immediate:true,force:true});if(!prior.stopped)lenis.start();ScrollTrigger.update();}
    };
    window.portfolioMotion=engine;
    ScrollTrigger.refresh();onReady();
    return()=>{engine.unlock();window.portfolioMotion=null;ScrollTrigger.removeEventListener('refreshInit',measure);gsap.ticker.remove(tick);trigger.kill();tween.revert();lenis.destroy();root.removeAttribute('data-horizontal-active');onReady();};
  });
}
