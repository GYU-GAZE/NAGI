import type {Settings} from '../shared/model';
/** Chunked rendering suppression. React nodes and handlers always remain mounted. */
export class TurnOptimizer {
 private marked=new Set<HTMLElement>();private heights=new Map<HTMLElement,string>();
 private chunks=new Map<HTMLElement,HTMLElement[]>();private inView=new Set<HTMLElement>();private observed=new Set<HTMLElement>();private revealed=new Map<HTMLElement,number>();
 private style=document.createElement('style');private observer?:IntersectionObserver;private mode='off';
 metrics={supported:CSS.supports('content-visibility','auto'),eligible:0,total:0,updateMs:0,hidden:0,mode:'off',chunks:0};
 private reveal=(event:Event)=>{const target=event.target as HTMLElement;for(const node of this.marked)if(node===target||node.contains(target)){for(const member of this.chunks.get(node)||[node]){member.removeAttribute('data-nagi-suspended');this.revealed.set(member,Date.now()+2000);}break;}};
 constructor(){
  this.style.dataset.nagiOwned='performance';this.style.textContent='[data-nagi-contain]{content-visibility:auto;contain-intrinsic-size:auto 600px}[data-nagi-suspended]{content-visibility:hidden!important;contain-intrinsic-size:var(--nagi-measured-height,600px)!important}';document.head.append(this.style);
  document.addEventListener('nagi:reveal',this.reveal);document.addEventListener('focusin',this.reveal,true);
  if(typeof IntersectionObserver!=='undefined')this.observer=new IntersectionObserver(entries=>{
   if(this.mode!=='aggressive')return;
   const chunks=new Set<HTMLElement[]>();
   for(const entry of entries){const node=entry.target as HTMLElement;this.observed.add(node);if(entry.isIntersecting)this.inView.add(node);else this.inView.delete(node);const chunk=this.chunks.get(node);if(chunk)chunks.add(chunk);}
   for(const chunk of chunks){const hide=chunk.every(n=>this.observed.has(n)&&!this.inView.has(n)&&!n.contains(document.activeElement)&&(this.revealed.get(n)||0)<Date.now());for(const node of chunk)node.toggleAttribute('data-nagi-suspended',hide);}
   this.metrics.hidden=[...this.marked].filter(n=>n.hasAttribute('data-nagi-suspended')).length;
  },{rootMargin:'1200px 0px'});
 }
 private restore(node:HTMLElement){
  node.removeAttribute('data-nagi-contain');node.removeAttribute('data-nagi-suspended');
  const previous=this.heights.get(node);if(previous)node.style.setProperty('--nagi-measured-height',previous);else node.style.removeProperty('--nagi-measured-height');
  this.heights.delete(node);this.revealed.delete(node);this.inView.delete(node);this.observed.delete(node);this.observer?.unobserve(node);
 }
 apply(s:Settings,turns:HTMLElement[]){
  const start=performance.now(),mode=s.enabled&&s.performance&&this.metrics.supported?(s.performanceMode==='aggressive'&&this.observer?'aggressive':'safe'):'off';
  if(this.mode!==mode){for(const n of this.marked)this.restore(n);this.marked.clear();}this.mode=mode;
  const selection=document.getSelection(),selected=selection&&!selection.isCollapsed?selection:null;
  const eligible=mode==='off'?[]:turns.slice(0,Math.max(0,turns.length-s.keepTurns));
  const next=new Set(eligible.filter(n=>!n.contains(document.activeElement)&&!selected?.containsNode(n,true)&&!n.querySelector('iframe,video,audio,canvas,[contenteditable="true"],[aria-live=polite],[aria-live=assertive]')));
  for(const n of this.marked)if(!next.has(n))this.restore(n);
  // Read every required measurement before the first layout-affecting write.
  const measurements=new Map<HTMLElement,number>();
  if(mode==='aggressive')for(const n of next)if(!this.marked.has(n))measurements.set(n,n.getBoundingClientRect().height);
  this.chunks.clear();const measurable=[...next].filter(n=>this.heights.has(n)||(measurements.get(n)||0)>0);
  for(let i=0;i<measurable.length;i+=32){const chunk=measurable.slice(i,i+32);for(const node of chunk)this.chunks.set(node,chunk);}
  for(const n of next)if(!this.marked.has(n)){
   n.setAttribute('data-nagi-contain','');const height=measurements.get(n);
   if(mode==='aggressive'&&height&&Number.isFinite(height)){
    this.heights.set(n,n.style.getPropertyValue('--nagi-measured-height'));n.style.setProperty('--nagi-measured-height',`${height}px`);this.observer?.observe(n);
   }
  }
  this.marked=next;this.metrics={...this.metrics,eligible:next.size,total:turns.length,updateMs:performance.now()-start,mode,hidden:[...next].filter(n=>n.hasAttribute('data-nagi-suspended')).length,chunks:new Set(this.chunks.values()).size};
 }
 dispose(){for(const node of this.marked)this.restore(node);this.marked.clear();this.chunks.clear();this.observer?.disconnect();this.style.remove();document.removeEventListener('nagi:reveal',this.reveal);document.removeEventListener('focusin',this.reveal,true);}
}
