export interface BackfillProgress { running:boolean; steps:number; indexed:number; reason:string }
export interface BackfillHost { count():number; positionToken?():string; loadOlder():Promise<void>; capture():void; savePosition():()=>void; }
/** Explicit, bounded, cancellable native loading. No undocumented network endpoints. */
export class Backfill {
 progress:BackfillProgress={running:false,steps:0,indexed:0,reason:''};
 private controller?:AbortController;
 constructor(private host:BackfillHost, private changed:()=>void=()=>{}) {}
 cancel() {this.controller?.abort();}
 async run(until?:()=>boolean) {
  if(this.progress.running)return;
  const abort=this.controller=new AbortController(), restore=this.host.savePosition();
  this.progress={running:true,steps:0,indexed:this.host.count(),reason:''};this.changed();
  let quiet=0;
  try {
   while(!abort.signal.aborted && this.progress.steps<100) {
    const before=this.host.count(),position=this.host.positionToken?.();await this.host.loadOlder();
    if(abort.signal.aborted)break;
    this.host.capture();this.progress.steps++;this.progress.indexed=this.host.count();this.changed();
    if(until?.()){this.progress.reason='Mensagem encontrada';break;}
    quiet=this.host.count()===before&&position===this.host.positionToken?.()?quiet+1:0;
    if(quiet>=4){this.progress.reason='Início ou nenhum novo conteúdo carregado';break;}
   }
   if(abort.signal.aborted)this.progress.reason='Cancelado';
   else if(!this.progress.reason)this.progress.reason='Limite desta rodada alcançado';
  } catch(e) {this.progress.reason=String(e);} finally {restore();this.progress.running=false;this.controller=undefined;this.changed();}
 }
}
export function scrollingHost(node:HTMLElement|undefined, doc:Document=document):HTMLElement {
 for(let parent=node?.parentElement;parent;parent=parent.parentElement) {
  const style=doc.defaultView!.getComputedStyle(parent);
  if(/auto|scroll/.test(style.overflowY) && parent.scrollHeight>parent.clientHeight)return parent;
 }
 return (doc.scrollingElement||doc.documentElement) as HTMLElement;
}
