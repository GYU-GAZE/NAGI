import { scanMessages, combineTurns, type MessageRegion, messageSelector, registerMessageSource } from '../adapter/messages';
import { selectors as S } from '../adapter/selectors';
/** Single discovery source. Cached readers do no DOM work between mutations. */
export class MessageRegistry {
 private regions:MessageRegion[];
 private legacy:HTMLElement[];
 private turns:HTMLElement[];
 private observer:MutationObserver;
 private release:()=>void;
 private pending:MutationRecord[]=[];
 private changed=new Set<HTMLElement>();
 metrics={fullScans:1,subtreeScans:0,mutationEvents:0,scanMs:0,messages:0,processed:0};
 constructor(private doc:Document=document){
  this.regions=scanMessages(doc);this.legacy=[...doc.querySelectorAll<HTMLElement>(S.turn)];this.turns=combineTurns(this.legacy,this.regions);
  this.regions.forEach(r=>this.changed.add(r.node));
  this.observer=new doc.defaultView!.MutationObserver(records=>this.pending.push(...records));
  this.observer.observe(doc.body,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['data-message-id','data-parent-message-id','data-message-author-role','data-message-role','data-testid']});
  this.release=registerMessageSource(doc,()=>this.read(),()=>{this.read();return this.turns;});
 }
 read(){
  const records=[...this.pending,...this.observer.takeRecords()];this.pending=[];
  if(!records.length)return this.regions;
  const start=performance.now(),roots=new Set<Element>();let relevant=false,structural=false;
  for(const r of records){
   const element=r.target.nodeType===1?r.target as Element:r.target.parentElement;
   if(element?.closest('[data-nagi-owned]'))continue;
   if(r.type==='childList'&&[...r.addedNodes,...r.removedNodes].every(n=>n.nodeType===1&&(n as Element).hasAttribute('data-nagi-owned')))continue;
   relevant=true;this.metrics.mutationEvents++;
   const message=element?.closest<HTMLElement>(messageSelector);if(message)this.changed.add(message);
   if(r.type==='childList'){
    structural=true;
    for(const n of r.addedNodes)if(n.nodeType===1&&!(n as Element).closest('[data-nagi-owned]'))roots.add(n as Element);
   }
   if(r.type==='attributes'&&element){structural=true;roots.add(message||element);}
  }
  if(!relevant)return this.regions;
  if(structural){
   const regions=new Map(this.regions.filter(r=>r.node.isConnected&&r.node.matches(messageSelector)).map(r=>[r.node,r]));
   const legacy=new Set(this.legacy.filter(n=>n.isConnected));
   for(const root of roots){
    if(!root.isConnected)continue;
    let ancestor=root.parentElement,covered=false;while(ancestor){if(roots.has(ancestor)){covered=true;break;}ancestor=ancestor.parentElement;}if(covered)continue;
    this.metrics.subtreeScans++;
    for(const region of scanMessages(this.doc,root)){regions.set(region.node,region);this.changed.add(region.node);}
    if(root.matches(S.turn))legacy.add(root as HTMLElement);
    root.querySelectorAll<HTMLElement>(S.turn).forEach(n=>legacy.add(n));
   }
   const next=[...regions.values()].sort((a,b)=>a.node===b.node?0:a.node.compareDocumentPosition(b.node)&2?1:-1);
   if(next.length!==this.regions.length||next.some((r,i)=>r.node!==this.regions[i].node||r.role!==this.regions[i].role||r.turn!==this.regions[i].turn))this.regions=next;
   this.legacy=[...legacy].sort((a,b)=>a===b?0:a.compareDocumentPosition(b)&2?1:-1);this.turns=combineTurns(this.legacy,this.regions);
  }
  this.metrics.messages=this.regions.length;this.metrics.scanMs=performance.now()-start;return this.regions;
 }
 takeChanged(){const changed=this.changed;this.changed=new Set();this.metrics.processed+=changed.size;return changed;}
 dispose(){this.observer.disconnect();this.release();this.pending=[];this.regions=[];this.legacy=[];this.turns=[];}
}
