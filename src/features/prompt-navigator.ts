import { ConversationSearch, type SearchFilter } from "../conversation/search";
import { SearchHighlight } from "./search-highlight";
import { resolveMessages, messageSelector } from '../adapter/messages';
import { ConversationIndex, type MessageRecord } from '../conversation/index';
import type { ConversationService } from '../conversation/service';
import { Backfill, scrollingHost } from '../conversation/backfill';
import { VirtualList } from '../ui/virtual-list';
import { el,button,select,input } from '../ui/dom';
export class PromptNavigator {
 readonly host=el('div',undefined,'prompt-nav');
 private previous=button('Prompt anterior',()=>this.step(-1),'↑');
 private next=button('Próximo prompt',()=>this.step(1),'↓');
 private counter=button('Escolher prompt',()=>this.openList());
 private local=new ConversationIndex('draft');
 private route='';private active=-1;private reduced=false;private enabled=false;
 private observer?:IntersectionObserver;private resized?:ResizeObserver;
 private resizeTarget?:HTMLElement;
 private observed=new Map<HTMLElement,string>();private visible=new Map<string,number>();
 private refreshList?:()=>void;private unsubscribe?:()=>void;
 private style=el('style','[data-nagi-prompt-target]{scroll-margin-top:calc(var(--nagi-shell-height,110px) + 20px)!important}[data-nagi-jump]{outline:2px solid var(--nagi-accent,#32d9f5)!important}');
 private highlight=new SearchHighlight();
 private targetOrder?:number;
 private listRoot?:HTMLElement;private search=new ConversationSearch();private searchAbort?:AbortController;
 get currentId(){return this.prompts[this.active]?.id;}

 readonly backfill:Backfill;
 constructor(private openList:()=>void,private service?:ConversationService) {
  this.style.dataset.nagiOwned='prompt-navigation';document.head.append(this.style);this.host.setAttribute('role','navigation');this.host.setAttribute('aria-label','Prompts enviados');this.host.append(this.previous,this.counter,this.next);
  this.backfill=new Backfill({count:()=>this.index.size,positionToken:()=>this.index.all.filter(r=>this.index.node(r.id)).map(r=>r.id).join('|'),capture:()=>this.service?.capture(),loadOlder:async()=>{
   const loaded=this.index.all.filter(r=>this.index.node(r.id)),first=this.index.node(loaded[0]?.id||''),scroll=scrollingHost(first);
   const newer=this.targetOrder!==undefined&&loaded.length>0&&this.targetOrder>loaded[loaded.length-1].order;
   scroll.scrollTop=newer?scroll.scrollHeight:0;scroll.dispatchEvent(new window.Event('scroll'));
   if(!newer){const controls=[...document.querySelectorAll<HTMLButtonElement>('main button')].filter(b=>!b.disabled&&!b.closest(`${messageSelector},[data-nagi-owned]`)&&b.getClientRects().length>0&&/^(load older|load previous|carregar anteriores|carregar mais mensagens)$/i.test(b.textContent?.trim()||''));if(controls.length===1)controls[0].click();}
   await new Promise(r=>setTimeout(r,800));
  },savePosition:()=>{const route=location.pathname,anchor=this.index.node(this.prompts[this.active]?.id||''),anchorTop=anchor?.getBoundingClientRect().top,scroll=scrollingHost(anchor||this.index.all.map(r=>this.index.node(r.id)).find(Boolean)),top=scroll.scrollTop,height=scroll.scrollHeight;return ()=>{if(location.pathname!==route)return;if(anchor?.isConnected&&anchorTop!==undefined)scroll.scrollTop+=anchor.getBoundingClientRect().top-anchorTop;else scroll.scrollTop=top+scroll.scrollHeight-height;};}},()=>this.refreshList?.());
  this.unsubscribe=service?.subscribe(()=>{this.sync();this.refreshList?.();});
  this.createObserver();
  if(typeof ResizeObserver!=='undefined'){this.resized=new ResizeObserver(()=>this.createObserver());const shell=document.getElementById('nagi-root');if(shell){this.resized.observe(shell);this.resizeTarget=shell;}}
 }
 get index(){return this.service?.index||this.local;}
 private get prompts(){return this.index.all.filter(r=>r.role==='user');}
 private createObserver(){
  this.observer?.disconnect();this.observed.clear();this.visible.clear();
  if(typeof IntersectionObserver==='undefined')return;
  const offset=parseFloat(document.documentElement.style.getPropertyValue('--nagi-shell-height'))||110;
  this.observer=new IntersectionObserver(entries=>{
   for(const entry of entries){const id=this.observed.get(entry.target as HTMLElement);if(!id)continue;if(entry.isIntersecting)this.visible.set(id,entry.boundingClientRect.top);else this.visible.delete(id);}
   const id=[...this.visible].sort((a,b)=>a[1]-b[1])[0]?.[0];const index=this.prompts.findIndex(r=>r.id===id);if(index>=0)this.active=index;this.labels();
  },{rootMargin:`-${offset}px 0px -40% 0px`,threshold:[0,0.1]});this.sync();
 }
 update(enabled:boolean,reduced:boolean){if(!this.resizeTarget){const shell=document.getElementById("nagi-root");if(shell&&this.resized){this.resized.observe(shell);this.resizeTarget=shell;}}this.host.hidden=!enabled;this.enabled=enabled;this.reduced=reduced;
  if(!enabled)this.backfill.cancel();
  if(location.pathname!==this.route){this.backfill.cancel();this.route=location.pathname;this.active=-1;this.visible.clear();if(!this.service)this.local=new ConversationIndex(this.route);}
  if(!this.service)this.local.capture(resolveMessages());this.sync();
 }
 private sync(){const nodes=new Map<HTMLElement,string>();if(this.enabled)for(const row of this.prompts){const n=this.index.node(row.id);if(n){nodes.set(n,row.id);n.setAttribute('data-nagi-prompt-target','');if(!this.observed.has(n))this.observer?.observe(n);}}
  for(const n of this.observed.keys())if(!nodes.has(n)){this.observer?.unobserve(n);this.visible.delete(this.observed.get(n)!);n.removeAttribute('data-nagi-prompt-target');}this.observed=nodes;
  if(this.active<0&&this.prompts.length)this.active=0;this.active=Math.min(this.active,this.prompts.length-1);this.labels();
 }
 private labels(){const count=this.prompts.length;this.listRoot?.querySelectorAll<HTMLElement>('[data-indexed-id]').forEach(n=>n.setAttribute('aria-current',String(n.dataset.indexedId===this.currentId)));this.counter.textContent=count?`Prompt ${this.active+1} / ${count}`:'Sem prompts detectados';this.counter.disabled=!count;this.previous.disabled=this.active<=0;this.next.disabled=!count||this.active>=count-1;}
 private step(delta:number){void this.go(Math.max(0,Math.min(this.prompts.length-1,this.active+delta)));}
 async go(index:number){const row=this.prompts[index];if(!row)return;this.active=index;this.labels();await this.jump(row.id);}
 async jump(id:string,heading?:string,query?:string){
  const index=this.index;let node=index.node(id);
  if(!node){this.targetOrder=index.get(id)?.order;try{await this.backfill.run(()=>!!index.node(id));}finally{this.targetOrder=undefined;}if(index!==this.index)return;node=index.node(id);}
  if(!node){this.refreshList?.();return false;}
  const revealRequired=!!node.closest('[data-nagi-suspended],[data-nagi-collapsed]');
  node.closest('[data-nagi-contain]')?.removeAttribute('data-nagi-contain');node.dispatchEvent(new window.CustomEvent('nagi:reveal',{bubbles:true}));
  if(heading){const row=index.get(id),ordinal=row?.headings.findIndex(h=>h.key===heading)??-1;node=node.querySelectorAll<HTMLElement>('h1,h2,h3,h4,h5,h6')[ordinal]||node;}
  if(revealRequired)await new Promise<void>(resolve=>window.requestAnimationFrame?window.requestAnimationFrame(()=>resolve()):setTimeout(resolve,0));
  if(index!==this.index||!node.isConnected)return false;
  node.scrollIntoView({behavior:this.reduced?'auto':'smooth',block:'start'});node.setAttribute('data-nagi-jump','');if(query)this.highlight.show(node,query);setTimeout(()=>node?.removeAttribute('data-nagi-jump'),1800);return true;
 }
 renderList(container:HTMLElement,close:()=>void){
  void this.service?.preference('navigator.open',true).catch(()=>{});
  this.listRoot=container;
  const query=input('');query.placeholder='Buscar na conversa…';query.setAttribute('aria-label','Buscar no Navigator');
  const status=el('p',undefined,'note'),filter=select([['user','Prompts'],['all',`Todas (${this.index.size})`],['assistant','Respostas'],['bookmarked',`★ Favoritos (${[...this.index.annotations.values()].filter(a=>a.bookmarked).length})`],['attachments','Anexos']],'user');
  const list=new VirtualList<MessageRecord>((row)=>{const b=button(`${row.role==='user'?'Você':'Resposta'} · ${row.preview||'Anexo'}${this.index.node(row.id)?'':' · não carregada'}`,()=>{void this.jump(row.id,undefined,query.value);});b.dataset.indexedId=row.id;b.setAttribute('aria-current',String(this.prompts[this.active]?.id===row.id));return b;});
  const load=button('Indexar mensagens anteriores',()=>void this.backfill.run()),cancel=button('Cancelar carregamento',()=>this.backfill.cancel());
  const width=el('input');width.type='range';width.min='280';width.max='900';width.value='600';width.setAttribute('aria-label','Largura do Navigator');
  width.oninput=()=>{const frame=container.ownerDocument.defaultView?.frameElement as HTMLElement|null;if(frame){frame.dataset.nagiWidth=width.value;frame.style.width=`${Math.min(window.innerWidth-24,Number(width.value))}px`;}void this.service?.preference('navigator.width',Number(width.value)).catch(()=>{});};
  void this.service?.preference<number>('navigator.width').then(value=>{if(value&&container.isConnected){width.value=String(value);width.oninput?.(new Event('input'));}}).catch(()=>{});
  this.refreshList=()=>{if(!container.isConnected)return;status.textContent=`${this.index.size} indexadas · ${this.index.loadedCount} carregadas${this.index.pendingCount?` · ${this.index.pendingCount} aguardando confirmação`:""}${this.backfill.progress.running?` · carregando (${this.backfill.progress.steps})`:this.backfill.progress.reason?` · ${this.backfill.progress.reason}`:''}${this.service?.error?` · Falha ao salvar: ${this.service.error}`:''}`;load.disabled=this.backfill.progress.running;cancel.hidden=!this.backfill.progress.running;this.searchAbort?.abort();const abort=this.searchAbort=new AbortController(),index=this.index;void this.search.query(index,query.value,filter.value as SearchFilter,abort.signal).then(rows=>{if(!abort.signal.aborted&&index===this.index&&container.isConnected)list.set(rows.map(r=>r.message));});};
  query.oninput=()=>this.refreshList?.();filter.onchange=()=>this.refreshList?.();list.set(this.prompts);container.append(status,query,filter,width,button('Topo',()=>{const first=this.index.all[0];if(first)void this.jump(first.id);}),button('Fim',()=>{const last=this.index.all.at(-1);if(last)void this.jump(last.id);}),load,cancel,list.host);this.refreshList();
  if(!container.isConnected){list.set(this.prompts);status.textContent=`${this.index.size} indexadas`;}
 }
 panelClosed(){this.searchAbort?.abort();this.listRoot=undefined;this.refreshList=undefined;void this.service?.preference('navigator.open',false).catch(()=>{});}
 dispose(){this.searchAbort?.abort();this.highlight.dispose();this.backfill.cancel();this.unsubscribe?.();this.observer?.disconnect();this.resized?.disconnect();for(const n of this.observed.keys())n.removeAttribute('data-nagi-prompt-target');this.style.remove();this.host.remove();}
}
