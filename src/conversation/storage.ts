import type { Annotation, MessageRecord } from './index';
export const DATABASE_VERSION = 1;
export interface ConversationData { messages: MessageRecord[]; annotations: Annotation[] }
const request = <T>(r: IDBRequest<T>) => new Promise<T>((resolve,reject) => { r.onsuccess=()=>resolve(r.result); r.onerror=()=>reject(r.error); });
const complete = (t: IDBTransaction) => new Promise<void>((resolve,reject)=>{t.oncomplete=()=>resolve();t.onabort=()=>reject(t.error || new Error('Transação cancelada'));t.onerror=()=>reject(t.error);});
/** Runs only in the extension background origin, never chatgpt.com's IndexedDB. */
export class ConversationStore {
 private opened?: Promise<IDBDatabase>;
 constructor(private factory: IDBFactory = indexedDB, private name='nagi-conversations') {}
 private db() {
  return this.opened ??= new Promise((resolve,reject)=>{
   const r=this.factory.open(this.name,DATABASE_VERSION);
   r.onupgradeneeded=()=>{
    const db=r.result;
    if(!db.objectStoreNames.contains('messages')) db.createObjectStore('messages',{keyPath:['conversationId','id']}).createIndex('conversation','conversationId');
    if(!db.objectStoreNames.contains('annotations')) db.createObjectStore('annotations',{keyPath:['conversationId','messageId']}).createIndex('conversation','conversationId');
    if(!db.objectStoreNames.contains('preferences')) db.createObjectStore('preferences',{keyPath:'key'});
   };
   r.onsuccess=()=>{r.result.onversionchange=()=>{r.result.close();this.opened=undefined;};resolve(r.result);};
   r.onerror=()=>{this.opened=undefined;reject(r.error);};
   r.onblocked=()=>reject(new Error('Feche outras abas da extensão para atualizar o banco local.'));
  });
 }
 async load(conversationId: string): Promise<ConversationData> {
  const db=await this.db(), tx=db.transaction(['messages','annotations'],'readonly'), done=complete(tx);
  const [messages,annotations]=await Promise.all([request(tx.objectStore('messages').index('conversation').getAll(conversationId)),request(tx.objectStore('annotations').index('conversation').getAll(conversationId))]); await done; return {messages,annotations};
 }
 async write(messages: MessageRecord[], annotations: Annotation[] = []) {
  validateRows(messages,annotations);
  const db=await this.db(), tx=db.transaction(['messages','annotations'],'readwrite'), done=complete(tx);
  for(const row of messages) tx.objectStore('messages').put(row);
  for(const row of annotations) tx.objectStore('annotations').put(row);
  await done;
 }
 async preference(key:string,value?:unknown) {
  if(!/^[\w:.-]{1,200}$/.test(key)) throw new Error('Preferência inválida');
  const db=await this.db(), tx=db.transaction('preferences',value===undefined?'readonly':'readwrite'), done=complete(tx), store=tx.objectStore('preferences');
  const result=value===undefined? await request(store.get(key)): (store.put({key,value}),{value}); await done; return result?.value;
 }
 async dump():Promise<ConversationData> {
  const db=await this.db(), tx=db.transaction(['messages','annotations'],'readonly'),done=complete(tx);
  const [messages,annotations]=await Promise.all([request(tx.objectStore('messages').getAll()),request(tx.objectStore('annotations').getAll())]);await done;return {messages,annotations};
 }
 async replace(data:ConversationData) {
  validateRows(data.messages,data.annotations);
  const db=await this.db(),tx=db.transaction(['messages','annotations'],'readwrite'),done=complete(tx);
  for(const key of ['messages','annotations']) tx.objectStore(key).clear();
  data.messages.forEach(r=>tx.objectStore('messages').put(r));data.annotations.forEach(r=>tx.objectStore('annotations').put(r));await done;
 }
}
export function validateRows(messages: MessageRecord[], annotations: Annotation[]) {
 const str=(x:unknown,max=500_000)=>typeof x==='string'&&x.length<=max;
 if(!Array.isArray(messages)||!Array.isArray(annotations)||messages.length>100_000||annotations.length>100_000) throw new Error('Índice inválido');
 for(const r of messages) if(!r || !str(r.conversationId,200)||!r.conversationId||!str(r.id,240)||!r.id|| !['user','assistant'].includes(r.role)||!Number.isFinite(r.order)||!Number.isFinite(r.updatedAt)||!str(r.text)||!str(r.preview,240)||!Array.isArray(r.headings)||r.headings.length>5000||r.headings.some(h=>!h||!str(h.key,240)||!str(h.text)||![1,2,3,4,5,6].includes(h.level))||!Array.isArray(r.attachments)||r.attachments.some(a=>!str(a,200))||(r.nativeId!==undefined&&!str(r.nativeId,200))||(r.parentId!==undefined&&!str(r.parentId,200))) throw new Error('Mensagem inválida');
 for(const a of annotations) if(!a||!str(a.conversationId,200)||!str(a.messageId,240)||typeof a.bookmarked!=='boolean'||!Array.isArray(a.labels)||a.labels.length>50||a.labels.some(l=>!str(l,80))||!str(a.note,20_000)||!Number.isFinite(a.updatedAt)) throw new Error('Anotação inválida');
}
