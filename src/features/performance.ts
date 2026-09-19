import type {Settings} from '../shared/model';
/** Never detaches React nodes. Aggressive suppresses rendering with measured spacers. */
export class TurnOptimizer {
 private marked=new Set<HTMLElement>();private heights=new Map<HTMLElement,string>();private revealed=new Set<HTMLElement>();
 private style=document.createElement('style');private observer?:IntersectionObserver;private mode='off';
 metrics={supported:CSS.supports('content-visibility','auto'),eligible:0,total:0,updateMs:0,hidden:0,mode:'off'};
 private reveal=(event:Event)=>{const target=event.target as HTMLElement;for(const node of this.marked)if(node===target||node.contains(target)){node.removeAttribute('data-nagi-suspended');this.revealed.add(node);}};
 constructor(){this.style.dataset.nagiOwned='performance';this.style.textContent='[data-nagi-contain]{content-visibility:auto;contain-intrinsic-size:auto 600px}[data-nagi-suspended]{content-visibility:hidden!important;contain-intrinsic-size:var(--nagi-measured-height,600px)!important}';document.head.append(this.style);document.addEventListener('nagi:reveal',this.reveal);document.addEventListener('focusin',this.reveal,true);
  if(typeof IntersectionObserver!=='undefined')this.observer=new IntersectionObserver(entries=>{for(const entry of entries){const node=entry.target as HTMLElement;if(this.mode!=='aggressive')continue;node.toggleAttribute('data-nagi-suspended',!entry.isIntersecting&&!node.contains(document.activeElement)&&!this.revealed.has(node));}this.metrics.hidden=[...this.marked].filter(n=>n.hasAttribute('data-nagi-suspended')).length;},{rootMargin:'1200px 0px'});
 }
 private restore(node:HTMLElement){node.removeAttribute('data-nagi-contain');node.removeAttribute('data-nagi-suspended');const previous=this.heights.get(node);if(previous)node.style.setProperty('--nagi-measured-height',previous);else node.style.removeProperty('--nagi-measured-height');this.heights.delete(node);this.revealed.delete(node);this.observer?.unobserve(node);}
 apply(s:Settings,turns:HTMLElement[]){const start=performance.now();const mode=s.enabled&&s.performance&&this.metrics.supported?(s.performanceMode==='aggressive'&&this.observer?'aggressive':'safe'):'off';
  if(this.mode!==mode){for(const n of this.marked)this.restore(n);this.marked.clear();}this.mode=mode;
  const eligible=mode==='off'?[]:turns.slice(0,Math.max(0,turns.length-s.keepTurns));
  const next=new Set(eligible.filter(n=>!n.contains(document.activeElement)&&!n.querySelector('iframe,video,audio,canvas,[contenteditable="true"],[aria-live=polite],[aria-live=assertive]')));
  for(const n of this.marked)if(!next.has(n))this.restore(n);
  for(const n of next)if(!this.marked.has(n)){n.setAttribute('data-nagi-contain','');if(mode==='aggressive'){this.heights.set(n,n.style.getPropertyValue('--nagi-measured-height'));n.style.setProperty('--nagi-measured-height',`${Math.max(24,n.getBoundingClientRect().height)}px`);this.observer?.observe(n);}}
  this.marked=next;this.metrics={...this.metrics,eligible:next.size,total:turns.length,updateMs:performance.now()-start,mode,hidden:[...next].filter(n=>n.hasAttribute('data-nagi-suspended')).length};
 }
 dispose(){for(const node of this.marked)this.restore(node);this.marked.clear();this.observer?.disconnect();this.style.remove();document.removeEventListener('nagi:reveal',this.reveal);document.removeEventListener('focusin',this.reveal,true);}
}
