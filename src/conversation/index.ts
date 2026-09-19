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
    let lastOrder = this.all.at(-1)?.order ?? -1;
    const following: (MessageRecord | undefined)[] = [];
    let nextKnown: MessageRecord | undefined;
    for (let j=regions.length-1;j>=0;j--) {
      following[j]=nextKnown;
      const n=regions[j].node, native=n.getAttribute('data-message-id');
      nextKnown=this.records.get(native ? `native:${native}` : this.identities.get(n)||'') || nextKnown;
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
      let id = nativeId ? `native:${nativeId}` : this.identities.get(node);
      if (!id) {
        const matches = this.all.filter(r => !r.nativeId && r.role === role && r.text === text && !this.node(r.id) && (!previous || r.order > previous.order));
        // Reconcile only unambiguous fallback identities; never collapse repeated prompts.
        id = matches.length === 1 ? matches[0].id : `local:${crypto.randomUUID()}`;
      }
      this.identities.set(node,id); this.nodes.set(id,new WeakRef(node));
      const old = this.records.get(id);
      let order = old?.order;
      if (order === undefined) {
        const next = following[i];
        order = previous ? next && next.order > previous.order ? (previous.order + next.order)/2 : previous.order + 1 : next ? next.order - 1 : lastOrder + 1;
      }
      lastOrder = Math.max(lastOrder,order);
      const headings = [...clone.querySelectorAll('h1,h2,h3,h4,h5,h6')].map((h,i) => ({key: h.id || `heading:${i}`, level: Number(h.tagName[1]), text: (h.textContent || '').trim()}));
      const attachments = [...node.querySelectorAll('[data-testid*=attachment],[download]')].map(n => (n.getAttribute('download') || n.getAttribute('aria-label') || n.textContent || 'Anexo').trim().slice(0,200));
      const parentId = node.getAttribute('data-parent-message-id') || undefined;
      const row: MessageRecord = {conversationId:this.conversationId,id,nativeId,parentId,role,order,text,preview:text.replace(/\s+/g,' ').slice(0,240),headings,attachments,updatedAt:Date.now()};
      if (!old || JSON.stringify({...old,updatedAt:0}) !== JSON.stringify({...row,updatedAt:0})) { this.records.set(id,row); this.sorted=undefined; this.dirty.add(id); this.revision++; }
      previous = this.records.get(id);
    }
    // WeakRefs alone do not keep detached trees alive; discard stale lookup entries too.
    for (const [id,ref] of this.nodes) if (!ref.deref()?.isConnected) this.nodes.delete(id);
  }
  drain() { const rows = [...this.dirty].map(id => this.records.get(id)!); this.dirty.clear(); return rows; }
  retry(rows: MessageRecord[]) { for(const r of rows) this.dirty.add(r.id); }
  annotate(id: string, patch: Partial<Pick<Annotation,'bookmarked'|'labels'|'note'>>) {
    if (!this.records.has(id)) throw new Error('Mensagem não indexada');
    const a = {...(this.annotations.get(id) || {conversationId:this.conversationId,messageId:id,bookmarked:false,labels:[],note:''}),...patch,updatedAt:Date.now()};
    this.annotations.set(id,a); this.revision++; return a;
  }
}
