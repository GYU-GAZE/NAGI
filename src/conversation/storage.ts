import { migrate, validImage } from '../shared/validation';
import type { State } from '../shared/model';
import { validateBackup, validatePreference, type Backup } from './backup';
import type { Annotation, MessageRecord } from './index';
export const DATABASE_VERSION = 2;
export interface ConversationData { messages: MessageRecord[]; annotations: Annotation[] }
const request = <T>(r: IDBRequest<T>) => new Promise<T>((resolve,reject) => { r.onsuccess=()=>resolve(r.result); r.onerror=()=>reject(r.error); });
const complete = (t: IDBTransaction) => new Promise<void>((resolve,reject)=>{t.oncomplete=()=>resolve();t.onabort=()=>reject(t.error || new Error('Transação cancelada'));t.onerror=()=>reject(t.error);});
/** Runs only in the extension background origin, never chatgpt.com's IndexedDB. */
export class ConversationStore {
 private opened?: Promise<IDBDatabase>;
 constructor(private factory: IDBFactory = indexedDB, private name='nagi-conversations') {}
 private db() {
  return this.opened ??= new Promise((resolve,reject)=>{
   const r=this.factory.open(this.name,DATABASE_VERSION);let blocked=false;
   r.onupgradeneeded=()=>{
    const db=r.result;
    if(!db.objectStoreNames.contains('messages')) db.createObjectStore('messages',{keyPath:['conversationId','id']}).createIndex('conversation','conversationId');
    if(!db.objectStoreNames.contains('annotations')) db.createObjectStore('annotations',{keyPath:['conversationId','messageId']}).createIndex('conversation','conversationId');
    if(!db.objectStoreNames.contains('assets')) db.createObjectStore('assets',{keyPath:'id'});
    if(!db.objectStoreNames.contains('recovery')) db.createObjectStore('recovery',{keyPath:'key'});
    if(!db.objectStoreNames.contains('preferences')) db.createObjectStore('preferences',{keyPath:'key'});
   };
   r.onsuccess=()=>{if(blocked){r.result.close();return;}r.result.onversionchange=()=>{r.result.close();this.opened=undefined;};resolve(r.result);};
   r.onerror=()=>{this.opened=undefined;reject(r.error);};
   r.onblocked=()=>{blocked=true;this.opened=undefined;reject(new Error('Feche outras abas da extensão para atualizar o banco local.'));};
  });
 }
 private assetIds = new Map<string,string>();
 private async pack(state:State) {
  const metadata=structuredClone(state),assets=new Map<string,{id:string;data:string}>();
  const encode=async (data:string) => {
   if(!data)return '';
   if(!validImage(data))throw new Error('Imagem inválida');
   let id=this.assetIds.get(data);
   if(!id){id=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(data))),n=>n.toString(16).padStart(2,'0')).join('');if(this.assetIds.size>100)this.assetIds.clear();this.assetIds.set(data,id);}
   assets.set(id,{id,data});return `asset:${id}`;
  };
  metadata.settings.layout.userAvatar=await encode(metadata.settings.layout.userAvatar);
  for(const p of metadata.personas)for(const key of Object.keys(p.avatars) as (keyof typeof p.avatars)[])p.avatars[key]=await encode(p.avatars[key]!);
  return {metadata,assets:[...assets.values()]};
 }
 private unpack(metadata:State,assets:{id:string;data:string}[]):State {
  const s=structuredClone(metadata),map=new Map(assets.map(a=>[`asset:${a.id}`,a.data]));
  const decode=(value:string)=>{if(!value)return '';const data=map.get(value);if(!data)throw new Error('Asset local ausente; dados preservados');return data;};
  s.settings.layout.userAvatar=decode(s.settings.layout.userAvatar);
  for(const p of s.personas)for(const key of Object.keys(p.avatars) as (keyof typeof p.avatars)[])p.avatars[key]=decode(p.avatars[key]!);
  return migrate(s);
 }
 async generation():Promise<number> {
  const db=await this.db(),tx=db.transaction('preferences','readonly'),done=complete(tx),row=await request(tx.objectStore('preferences').get('state'));await done;return row?.value?.indexGeneration??0;
 }
 async readState():Promise<State|undefined> {
  const db=await this.db(),tx=db.transaction(['preferences','assets'],'readonly'),done=complete(tx);
  const [row,assets]=await Promise.all([request(tx.objectStore('preferences').get('state')),request(tx.objectStore('assets').getAll())]);await done;
  return row?this.unpack(row.value,assets):undefined;
 }
 async writeState(state:State) {
  const {metadata,assets}=await this.pack(migrate(state)),db=await this.db(),tx=db.transaction(['preferences','assets'],'readwrite'),done=complete(tx);
  // Bounded asset set: only current references survive. Backup recovery owns its own snapshot.
  const assetStore=tx.objectStore('assets'),known=new Set(await request(assetStore.getAllKeys())),wanted=new Set(assets.map(a=>a.id));
  for(const key of known)if(!wanted.has(String(key)))assetStore.delete(key);
  for(const asset of assets)if(!known.has(asset.id))assetStore.put(asset);
  tx.objectStore('preferences').put({key:'state',value:metadata});await done;
 }
 async backup():Promise<Backup> {
  const db=await this.db(),tx=db.transaction(['messages','annotations','preferences','assets'],'readonly'),done=complete(tx);
  const [messages,annotations,prefs,assets]=await Promise.all(['messages','annotations','preferences','assets'].map(key=>request(tx.objectStore(key).getAll())));await done;
  const state=prefs.find(p=>p.key==='state');if(!state)throw new Error('Estado local ainda não inicializado');
  return {format:'nagi-backup',schemaVersion:1,createdAt:new Date().toISOString(),state:this.unpack(state.value,assets),conversations:{messages,annotations},preferences:prefs.filter(p=>p.key.startsWith('navigator.'))};
 }
 async importBackup(value:unknown,revision:number,generation=0):Promise<State> {
  const backup=validateBackup(value),state={...backup.state,revision:revision+1,indexGeneration:generation+1};
  const {metadata,assets}=await this.pack(state),db=await this.db();
  const names=['messages','annotations','preferences','assets'];
  const tx=db.transaction([...names,'recovery'],'readwrite'),done=complete(tx);
  // Save the complete previous database and replace all stores in ONE transaction.
  const old=await Promise.all(names.map(name=>request(tx.objectStore(name).getAll())));
  tx.objectStore('recovery').put({key:'previous',stores:Object.fromEntries(names.map((name,i)=>[name,old[i]]))});
  for(const name of names)tx.objectStore(name).clear();
  for(const r of backup.conversations.messages)tx.objectStore('messages').put(r);
  for(const r of backup.conversations.annotations)tx.objectStore('annotations').put(r);
  for(const p of backup.preferences)tx.objectStore('preferences').put(p);
  tx.objectStore('preferences').put({key:'state',value:metadata});
  for(const asset of assets)tx.objectStore('assets').put(asset);
  await done;return state;
 }
 async recoveryBackup():Promise<Backup> {
  const db=await this.db(),tx=db.transaction('recovery','readonly'),done=complete(tx),row=await request(tx.objectStore('recovery').get('previous'));await done;
  if(!row)throw new Error('Nenhuma importação anterior para recuperar');
  const {messages,annotations,preferences,assets}=row.stores,metadata=preferences.find((p:{key:string})=>p.key==='state');
  return {format:'nagi-backup',schemaVersion:1,createdAt:new Date().toISOString(),state:this.unpack(metadata.value,assets),conversations:{messages,annotations},preferences:preferences.filter((p:{key:string})=>p.key.startsWith('navigator.'))};
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
  if(value!==undefined) validatePreference(key,value);
  if(!['navigator.open','navigator.width'].includes(key)) throw new Error('Preferência inválida');
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
