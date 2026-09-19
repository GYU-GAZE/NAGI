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
 private lastRegions?:ReturnType<MessageRegistry["read"]>;
 private previousNodes=new Map<HTMLElement,{native:string|null;text:string}>();
 private stopped=false;
 private ready=false;
 constructor(private client:Client,private generation=0) {}
 reset(generation:number) {
  if(generation===this.generation)return;
  clearTimeout(this.timer);this.generation=generation;this.epoch++;this.ready=false;
  const id=this.index.conversationId;this.index=new ConversationIndex('reset');this.update(id==='draft'?null:id);
 }
 subscribe(fn:()=>void) {this.listeners.add(fn);return ()=>this.listeners.delete(fn);}
 private emit() {for(const f of this.listeners) f();}
 update(id:string|null) {
  const key=id||'draft';
  if(this.index.conversationId!==key) {
   void this.flush();
   this.previousNodes.clear();
   if(this.index.conversationId!=='draft'&&this.index.conversationId!=='reset')for(const row of this.index.all){const node=this.index.node(row.id);if(node)this.previousNodes.set(node,{native:row.nativeId||null,text:node.textContent||''});}
   this.index=new ConversationIndex(key);this.lastRegions=undefined;const epoch=++this.epoch;this.ready=!id;
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
  if(!force&&regions===this.lastRegions&&!changed.size)return;
  this.lastRegions=regions;
  const before=this.index.revision;
  const visible=regions.filter(({node})=>{const prior=this.previousNodes.get(node);if(!prior)return true;const native=node.getAttribute('data-message-id')||node.closest('[data-message-id]')?.getAttribute('data-message-id');if(native!==prior.native||(!native&&node.textContent!==prior.text)){this.previousNodes.delete(node);return true;}return false;});
  for(const node of this.previousNodes.keys())if(!node.isConnected)this.previousNodes.delete(node);
  this.index.capture(visible,force?undefined:changed);
  this.emit();
  if(before!==this.index.revision) {clearTimeout(this.timer);this.timer=setTimeout(()=>void this.flush(),700);}
 }
 async flush(strict=false) {
  clearTimeout(this.timer);const index=this.index;
  if(index.conversationId==='draft')return;
  const messages=index.drain();if(!messages.length)return;
  try {await this.client.request('index.write',{messages,generation:this.generation});this.error='';} catch(e) {index.retry(messages);this.error=String(e);this.emit();if(strict)throw e;}
 }
 async annotate(id:string,patch:Partial<Pick<Annotation,'bookmarked'|'labels'|'note'>>) {
  const annotation=this.index.annotate(id,patch);this.emit();
  try {await this.client.request('index.write',{messages:[],annotations:[annotation],generation:this.generation});this.error='';}catch(e){this.error=String(e);this.emit();throw e;}
 }
 preference<T>(key:string,value?:T) {return this.client.request<T|undefined>('index.preference',{key,value});}
 dispose() {this.stopped=true;this.epoch++;void this.flush();clearTimeout(this.timer);this.registry.dispose();this.listeners.clear();}
}
