import { resolveMessages } from '../adapter/messages';
import { ConversationIndex, type MessageRecord } from '../conversation/index';
import type { ConversationService } from '../conversation/service';
import { Backfill, scrollingHost } from '../conversation/backfill';
import { VirtualList } from '../ui/virtual-list';
import { el,button,select } from '../ui/dom';
export class PromptNavigator {
 readonly host=el('div',undefined,'prompt-nav');
 private previous=button('Prompt anterior',()=>this.step(-1),'↑');
 private next=button('Próximo prompt',()=>this.step(1),'↓');
 private counter=button('Escolher prompt',()=>this.openList());
 private local=new ConversationIndex('draft');
 private route='';private active=-1;private reduced=false;private enabled=false;
 private observer?:IntersectionObserver;private resized?:ResizeObserver;
 private observed=new Map<HTMLElement,string>();private visible=new Map<string,number>();
 private refreshList?:()=>void;private unsubscribe?:()=>void;
 private style=el('style','[data-nagi-prompt-target]{scroll-margin-top:calc(var(--nagi-shell-height,110px) + 20px)!important}[data-nagi-jump]{outline:2px solid var(--nagi-accent,#32d9f5)!important}');
 readonly backfill:Backfill;
 constructor(private openList:()=>void,private service?:ConversationService) {
  this.style.dataset.nagiOwned='prompt-navigation';document.head.append(this.style);this.host.setAttribute('role','navigation');this.host.setAttribute('aria-label','Prompts enviados');this.host.append(this.previous,this.counter,this.next);
  this.backfill=new Backfill({count:()=>this.index.size,capture:()=>this.service?.capture(),loadOlder:async()=>{
   const first=this.index.all.map(r=>this.index.node(r.id)).find(Boolean),scroll=scrollingHost(first);scroll.scrollTop=0;scroll.dispatchEvent(new window.Event('scroll'));
   const older=[...document.querySelectorAll<HTMLButtonElement>('main button')].find(b=>/^(load older|load previous|carregar anteriores|carregar mais mensagens)$/i.test(b.textContent?.trim()||''));older?.click();
   await new Promise(r=>setTimeout(r,800));
  },savePosition:()=>{const route=location.pathname,scroll=scrollingHost(this.index.all.map(r=>this.index.node(r.id)).find(Boolean)),top=scroll.scrollTop,height=scroll.scrollHeight;return ()=>{if(location.pathname===route)scroll.scrollTop=top+scroll.scrollHeight-height;};}},()=>this.refreshList?.());
  this.unsubscribe=service?.subscribe(()=>{this.sync();this.refreshList?.();});
  this.createObserver();
  if(typeof ResizeObserver!=='undefined'){this.resized=new ResizeObserver(()=>this.createObserver());const shell=document.getElementById('nagi-root');if(shell)this.resized.observe(shell);}
 }
 get index(){return this.service?.index||this.local;}
 private get prompts(){return this.index.all.filter(r=>r.role==='user');}
 private createObserver(){
  this.observer?.disconnect();this.observed.clear();
  if(typeof IntersectionObserver==='undefined')return;
  const offset=parseFloat(document.documentElement.style.getPropertyValue('--nagi-shell-height'))||110;
  this.observer=new IntersectionObserver(entries=>{
   for(const entry of entries){const id=this.observed.get(entry.target as HTMLElement);if(!id)continue;if(entry.isIntersecting)this.visible.set(id,entry.boundingClientRect.top);else this.visible.delete(id);}
   const id=[...this.visible].sort((a,b)=>a[1]-b[1])[0]?.[0];const index=this.prompts.findIndex(r=>r.id===id);if(index>=0)this.active=index;this.labels();
  },{rootMargin:`-${offset}px 0px -40% 0px`,threshold:[0,0.1]});this.sync();
 }
 update(enabled:boolean,reduced:boolean){this.host.hidden=!enabled;this.enabled=enabled;this.reduced=reduced;
  if(location.pathname!==this.route){this.backfill.cancel();this.route=location.pathname;this.active=-1;this.visible.clear();if(!this.service)this.local=new ConversationIndex(this.route);}
  if(!this.service)this.local.capture(resolveMessages());this.sync();
 }
 private sync(){const nodes=new Map<HTMLElement,string>();if(this.enabled)for(const row of this.prompts){const n=this.index.node(row.id);if(n){nodes.set(n,row.id);n.setAttribute('data-nagi-prompt-target','');if(!this.observed.has(n))this.observer?.observe(n);}}
  for(const n of this.observed.keys())if(!nodes.has(n)){this.observer?.unobserve(n);n.removeAttribute('data-nagi-prompt-target');}this.observed=nodes;
  if(this.active<0&&this.prompts.length)this.active=0;this.active=Math.min(this.active,this.prompts.length-1);this.labels();
 }
 private labels(){const count=this.prompts.length;this.counter.textContent=count?`Prompt ${this.active+1} / ${count}`:'Sem prompts detectados';this.counter.disabled=!count;this.previous.disabled=this.active<=0;this.next.disabled=!count||this.active>=count-1;}
 private step(delta:number){void this.go(Math.max(0,Math.min(this.prompts.length-1,this.active+delta)));}
 async go(index:number){const row=this.prompts[index];if(!row)return;this.active=index;this.labels();await this.jump(row.id);}
 async jump(id:string,heading?:string){
  const index=this.index;let node=index.node(id);
  if(!node){await this.backfill.run(()=>!!index.node(id));if(index!==this.index)return;node=index.node(id);}
  if(!node){this.refreshList?.();return false;}
  node.closest('[data-nagi-contain]')?.removeAttribute('data-nagi-contain');node.dispatchEvent(new window.CustomEvent('nagi:reveal',{bubbles:true}));
  if(heading){const row=index.get(id),ordinal=row?.headings.findIndex(h=>h.key===heading)??-1;node=node.querySelectorAll<HTMLElement>('h1,h2,h3,h4,h5,h6')[ordinal]||node;}
  node.scrollIntoView({behavior:this.reduced?'auto':'smooth',block:'start'});node.setAttribute('data-nagi-jump','');setTimeout(()=>node?.removeAttribute('data-nagi-jump'),1800);return true;
 }
 renderList(container:HTMLElement,close:()=>void){
  const status=el('p',undefined,'note'),filter=select([['user','Prompts'],['all','Todas as mensagens'],['assistant','Respostas']],'user');
  const list=new VirtualList<MessageRecord>((row)=>{const b=button(`${row.role==='user'?'Você':'Resposta'} · ${row.preview||'Anexo'}${this.index.node(row.id)?'':' · não carregada'}`,()=>{void this.jump(row.id);});b.setAttribute('aria-current',String(this.prompts[this.active]?.id===row.id));return b;});
  const load=button('Indexar mensagens anteriores',()=>void this.backfill.run()),cancel=button('Cancelar carregamento',()=>this.backfill.cancel());
  const width=el('input');width.type='range';width.min='280';width.max='900';width.value='600';width.setAttribute('aria-label','Largura do Navigator');
  width.oninput=()=>{const frame=container.ownerDocument.defaultView?.frameElement as HTMLElement|null;if(frame)frame.style.width=`${Math.min(window.innerWidth-24,Number(width.value))}px`;void this.service?.preference('navigator.width',Number(width.value));};
  void this.service?.preference<number>('navigator.width').then(value=>{if(value){width.value=String(value);width.oninput?.(new Event('input'));}}).catch(()=>{});
  this.refreshList=()=>{if(!container.isConnected)return;status.textContent=`${this.index.size} indexadas · ${this.index.loadedCount} carregadas${this.backfill.progress.running?` · carregando (${this.backfill.progress.steps})`:this.backfill.progress.reason?` · ${this.backfill.progress.reason}`:''}${this.service?.error?` · Falha ao salvar: ${this.service.error}`:''}`;load.disabled=this.backfill.progress.running;cancel.hidden=!this.backfill.progress.running;list.set(this.index.all.filter(r=>filter.value==='all'||r.role===filter.value));};
  filter.onchange=()=>this.refreshList?.();container.append(status,filter,width,button('Topo',()=>{const first=this.index.all[0];if(first)void this.jump(first.id);}),button('Fim',()=>{const last=this.index.all.at(-1);if(last)void this.jump(last.id);}),load,cancel,list.host);this.refreshList();
  if(!container.isConnected){list.set(this.prompts);status.textContent=`${this.index.size} indexadas`;}
 }
 panelClosed(){this.refreshList=undefined;void this.service?.preference('navigator.open',false).catch(()=>{});}
 dispose(){this.backfill.cancel();this.unsubscribe?.();this.observer?.disconnect();this.resized?.disconnect();for(const n of this.observed.keys())n.removeAttribute('data-nagi-prompt-target');this.style.remove();this.host.remove();}
}
