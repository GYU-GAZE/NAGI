import { scanMessages, type MessageRegion, messageSelector, registerMessageSource } from '../adapter/messages';
/** One DOM source shared by all readers. Mutations invalidate only affected subtrees. */
export class MessageRegistry {
  private regions: MessageRegion[];
  private observer: MutationObserver;
  private release: () => void;
  private pending: MutationRecord[] = [];
  private changed = new Set<HTMLElement>();
  metrics = {fullScans:1,subtreeScans:0,mutationEvents:0,scanMs:0,messages:0};
  constructor(private doc: Document = document) {
    this.regions = scanMessages(doc);
    this.regions.forEach(r=>this.changed.add(r.node));
    this.observer = new doc.defaultView!.MutationObserver(records => this.pending.push(...records));
    this.observer.observe(doc.body,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['data-message-id','data-message-author-role','data-message-role','data-testid']});
    this.release = registerMessageSource(doc,() => this.read());
  }
  read() {
    const start = performance.now();
    const records = [...this.pending,...this.observer.takeRecords()]; this.pending = [];
    const roots = new Set<Element>();
    for (const r of records) {
      const element = r.target.nodeType === 1 ? r.target as Element : r.target.parentElement;
      if (element?.closest('[data-nagi-owned]')) continue;
      this.metrics.mutationEvents++;
      const message=element?.closest<HTMLElement>(messageSelector); if(message) this.changed.add(message);
      if (r.type === 'childList') for (const n of r.addedNodes) if (n.nodeType === 1 && !(n as Element).closest('[data-nagi-owned]')) roots.add(n as Element);
      if (r.type === 'attributes' && element) roots.add(element);
    }
    this.regions = this.regions.filter(r => r.node.isConnected && r.node.matches(messageSelector));
    const known = new Set(this.regions.map(r=>r.node));
    for (const root of roots) {
      if (!root.isConnected || [...roots].some(other => other !== root && other.contains(root))) continue;
      this.metrics.subtreeScans++;
      for (const region of scanMessages(this.doc,root)) if (!known.has(region.node)) { this.regions.push(region); known.add(region.node); this.changed.add(region.node); }
    }
    if (roots.size) this.regions.sort((a,b) => a.node.compareDocumentPosition(b.node) & 2 ? 1 : -1);
    this.metrics.messages = this.regions.length; this.metrics.scanMs = performance.now()-start;
    return this.regions;
  }
  takeChanged() { this.read(); const result=this.changed; this.changed=new Set(); return result; }
  dispose() { this.observer.disconnect(); this.release(); this.regions=[]; }
}
