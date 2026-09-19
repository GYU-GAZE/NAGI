/** Durable data only. No DOM, HTML, credentials or account instruction state. */
export interface Heading { key: string; level: number; text: string }
export interface MessageRecord {
  conversationId: string; id: string; nativeId?: string; parentId?: string;
  role: 'user' | 'assistant'; order: number; text: string; preview: string;
  headings: Heading[]; attachments: string[]; updatedAt: number;
}
export interface Annotation {
  conversationId: string; messageId: string; bookmarked: boolean;
  labels: string[]; note: string; updatedAt: number;
}
export class ConversationIndex {
  private records = new Map<string, MessageRecord>();
  private nodes = new Map<string, WeakRef<HTMLElement>>();
  private identities = new WeakMap<HTMLElement, string>();
  private dirty = new Set<string>();
  private sorted?: MessageRecord[];
  annotations = new Map<string, Annotation>();
  revision = 0;
  private pending: {text:string;at:number}[]=[];
  get pendingCount(){this.pending=this.pending.filter(p=>Date.now()-p.at<60000);return this.pending.length;}
  expectPrompt(text:string){text=text.trim().slice(0,500000);if(!text)return;if(this.pending.at(-1)?.text===text&&Date.now()-this.pending.at(-1)!.at<1000)return;this.pending.push({text,at:Date.now()});this.pending=this.pending.slice(-4);}

  constructor(readonly conversationId: string) {}
  get all() { return this.sorted ??= [...this.records.values()].sort((a,b) => a.order - b.order || a.id.localeCompare(b.id)); }
  get size() { return this.records.size; }
  get loadedCount() { return [...this.nodes.keys()].filter(id => this.node(id)).length; }
  get(id: string) { return this.records.get(id); }
  node(id: string) { const n = this.nodes.get(id)?.deref(); return n?.isConnected ? n : undefined; }
  idFor(node: HTMLElement) { return this.identities.get(node); }
  hydrate(rows: MessageRecord[], annotations: Annotation[] = []) {
    for (const r of rows) if (r.conversationId === this.conversationId && !this.dirty.has(r.id)) this.records.set(r.id,r);
    for (const a of annotations) if (a.conversationId === this.conversationId) this.annotations.set(a.messageId,a);
    this.sorted = undefined; this.revision++;
  }
  capture(regions: {node: HTMLElement; role: 'user' | 'assistant'}[], changed?: Set<HTMLElement>) {
    let previous: MessageRecord | undefined;
    const nativeRecords=new Map(this.all.filter(r=>r.nativeId).map(r=>[r.nativeId!,r]));
    const fallback=new Map<string,MessageRecord[]>();
    for(const row of this.all)if(!row.nativeId&&!this.node(row.id)){const key=`${row.role}:${row.text}`;const bucket=fallback.get(key)||[];bucket.push(row);fallback.set(key,bucket);}

    let lastOrder = this.all.at(-1)?.order ?? -1;
    const following: (MessageRecord | undefined)[] = [];
    let nextKnown: MessageRecord | undefined;
    for (let j=regions.length-1;j>=0;j--) {
      following[j]=nextKnown;
      const n=regions[j].node, native=n.getAttribute('data-message-id')||n.closest('[data-message-id]')?.getAttribute('data-message-id');
      nextKnown=(native?nativeRecords.get(native):undefined)||this.records.get(this.identities.get(n)||'')||nextKnown;
    }
    for (let i = 0; i < regions.length; i++) {
      const {node,role} = regions[i];
      const existing=this.identities.get(node);
      if(changed && !changed.has(node) && existing && this.records.has(existing)) {previous=this.records.get(existing);continue;}
      const nativeId = node.getAttribute('data-message-id') || node.closest('[data-message-id]')?.getAttribute('data-message-id') || undefined;
      // Exclude extension identities and native action labels from searchable text.
      const clone = node.cloneNode(true) as HTMLElement;
      clone.querySelectorAll('[data-nagi-owned],button,script,style').forEach(n => n.remove());
      const text = (clone.textContent || '').trim().slice(0, 500_000);
      let id = this.identities.get(node) || (nativeId ? `native:${nativeId}` : undefined);
      if(nativeId&&!this.records.has(id!)){const known=nativeRecords.get(nativeId);if(known)id=known.id;}
      if (!id) {
        const matches = (fallback.get(`${role}:${text}`)||[]).filter(r=>!this.node(r.id)&&(!previous||r.order>previous.order));
        // Reconcile only unambiguous fallback identities; never collapse repeated prompts.
        id = matches.length === 1 ? matches[0].id : `local:${crypto.randomUUID()}`;
      }
      this.identities.set(node,id); this.nodes.set(id,new WeakRef(node));
      const old = this.records.get(id);
      let order = old?.order;
      if (order === undefined) {
        const next = following[i];
        let remaining=1;if(next)for(let j=i+1;j<regions.length&&following[j]===next;j++)remaining++;

        order = previous ? next && next.order > previous.order ? previous.order+(next.order-previous.order)/(remaining+1) : previous.order + 1 : next ? next.order - 1 : lastOrder + 1;
      }
      lastOrder = Math.max(lastOrder,order);
      const headings = [...clone.querySelectorAll('h1,h2,h3,h4,h5,h6')].map((h,i) => ({key: h.id || `heading:${i}`, level: Number(h.tagName[1]), text: (h.textContent || '').trim()}));
      const attachments = [...node.querySelectorAll('[data-testid*=attachment],[download]')].map(n => (n.getAttribute('download') || n.getAttribute('aria-label') || n.textContent || 'Anexo').trim().slice(0,200));
      const parentId = node.getAttribute('data-parent-message-id') || undefined;
      const row: MessageRecord = {conversationId:this.conversationId,id,nativeId,parentId,role,order,text,preview:text.replace(/\s+/g,' ').slice(0,240),headings,attachments,updatedAt:Date.now()};
      if (!old || JSON.stringify({...old,updatedAt:0}) !== JSON.stringify({...row,updatedAt:0})) { this.records.set(id,row); this.sorted=undefined; this.dirty.add(id); this.revision++; }
      if(role==='user'&&!old){const at=this.pending.findIndex(p=>p.text===text);if(at>=0)this.pending.splice(at,1);}
      previous = this.records.get(id);
    }
    const ordered=this.all;
    if(ordered.some((r,i)=>i>0&&r.order-ordered[i-1].order<1e-7)){
      ordered.forEach((row,i)=>{if(row.order!==i){row.order=i;this.dirty.add(row.id);}});this.sorted=undefined;this.revision++;
    }
    // WeakRefs alone do not keep detached trees alive; discard stale lookup entries too.
    for (const [id,ref] of this.nodes) if (!ref.deref()?.isConnected) this.nodes.delete(id);
  }
  drain() { const rows = [...this.dirty].map(id => this.records.get(id)!); this.dirty.clear(); return rows; }
  retry(rows: MessageRecord[]) { for(const r of rows) this.dirty.add(r.id); }
  annotate(id: string, patch: Partial<Pick<Annotation,'bookmarked'|'labels'|'note'>>) {
    if (!this.records.has(id)) throw new Error('Mensagem não indexada');
    if(patch.note!==undefined&&(typeof patch.note!=='string'||patch.note.length>20000)||patch.bookmarked!==undefined&&typeof patch.bookmarked!=='boolean'||patch.labels!==undefined&&(!Array.isArray(patch.labels)||patch.labels.length>50||patch.labels.some(l=>typeof l!=='string'||l.length>80)))throw new Error('Anotação inválida');
    const a = {...(this.annotations.get(id) || {conversationId:this.conversationId,messageId:id,bookmarked:false,labels:[],note:''}),...patch,updatedAt:Date.now()};
    this.annotations.set(id,a); this.revision++; return a;
  }
}
