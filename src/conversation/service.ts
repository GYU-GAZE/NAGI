import type { Client } from '../shared/platform';
import { ConversationIndex, type Annotation } from './index';
import { MessageRegistry } from './registry';
import type { ConversationData } from './storage';
export class ConversationService {
 readonly registry = new MessageRegistry();
 index = new ConversationIndex('draft');
 error = '';
 private listeners = new Set<()=>void>();
 private epoch=0;
 private timer?: ReturnType<typeof setTimeout>;
 private stopped=false;
 private ready=false;
 constructor(private client:Client) {}
 subscribe(fn:()=>void) {this.listeners.add(fn);return ()=>this.listeners.delete(fn);}
 private emit() {for(const f of this.listeners) f();}
 update(id:string|null) {
  const key=id||'draft';
  if(this.index.conversationId!==key) {
   void this.flush(); this.index=new ConversationIndex(key);const epoch=++this.epoch;this.ready=!id;
   if(id) void this.client.request<ConversationData>('index.load',{conversationId:id}).then(data=>{
    if(epoch!==this.epoch||this.stopped)return;
    if(!data || !Array.isArray(data.messages)) throw new Error('Persistência indisponível');
    this.index.hydrate(data.messages,data.annotations);this.ready=true;this.capture(true);this.emit();
   }).catch(e=>{if(epoch===this.epoch){this.error=String(e);this.ready=true;this.capture(true);this.emit();}});
   this.emit();
  }
  this.capture();
 }
 capture(force=false) {
  const regions=this.registry.read(), changed=this.registry.takeChanged();
  if(!this.ready && this.index.conversationId!=='draft')return;
  const before=this.index.revision;
  this.index.capture(regions,force?undefined:changed);
  if(before!==this.index.revision) {this.emit();clearTimeout(this.timer);this.timer=setTimeout(()=>void this.flush(),700);}
 }
 async flush() {
  clearTimeout(this.timer);const index=this.index;
  if(index.conversationId==='draft')return;
  const messages=index.drain();if(!messages.length)return;
  try {await this.client.request('index.write',{messages});this.error='';} catch(e) {index.retry(messages);this.error=String(e);this.emit();}
 }
 async annotate(id:string,patch:Partial<Pick<Annotation,'bookmarked'|'labels'|'note'>>) {
  const annotation=this.index.annotate(id,patch);this.emit();
  try {await this.client.request('index.write',{messages:[],annotations:[annotation]});this.error='';}catch(e){this.error=String(e);this.emit();throw e;}
 }
 preference<T>(key:string,value?:T) {return this.client.request<T|undefined>('index.preference',{key,value});}
 dispose() {this.stopped=true;this.epoch++;void this.flush();clearTimeout(this.timer);this.registry.dispose();this.listeners.clear();}
}
