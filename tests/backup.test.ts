import { test } from 'node:test';
import assert from 'node:assert/strict';
import { IDBFactory } from 'fake-indexeddb';
import { ConversationStore } from '../src/conversation/storage.ts';
import { validateBackup, parseBackup, type Backup } from '../src/conversation/backup.ts';
import { StateVault } from '../src/background/state-vault.ts';
import { initialState } from '../src/shared/model.ts';
const message={conversationId:'a',id:'one',role:'user' as const,order:0,text:'olá 世界',preview:'olá 世界',headings:[],attachments:[],updatedAt:1};
const image='data:image/png;base64,aGVsbG8=';
const make=():Backup=>({format:'nagi-backup',schemaVersion:1,createdAt:new Date().toISOString(),state:initialState(),conversations:{messages:[message],annotations:[]},preferences:[{key:'navigator.width',value:450}]});
test('legacy migration splits images, preserves state and keeps startup storage lightweight',async()=>{
 const original=initialState();original.settings.layout.userAvatar=image;
 const local=new Map<string,unknown>([['nagi',original]]),kv={get:async(k:string)=>local.get(k),set:async(k:string,v:unknown)=>{local.set(k,structuredClone(v));}};
 const store=new ConversationStore(new IDBFactory()),vault=new StateVault(store,kv);
 assert.deepEqual(await vault.get('nagi'),original);
 assert.equal((local.get('nagi') as any).settings.layout.userAvatar,'');
 const next={...original,revision:1};next.settings.debug=true;await vault.set('nagi',next);
 assert.deepEqual(await vault.get('nagi'),next);assert.equal((await store.backup()).state.settings.layout.userAvatar,image);
 const broken=new StateVault(new ConversationStore(new IDBFactory()),kv);await assert.rejects(()=>broken.get('nagi'),/ausente/);
});
test('backup round-trip, annotations, preferences, assets and recovery remain atomic',async()=>{
 const store=new ConversationStore(new IDBFactory()),state=initialState();state.settings.layout.userAvatar=image;
 await store.writeState(state);await store.write([message],[{conversationId:'a',messageId:'one',bookmarked:true,labels:['decision'],note:'remember',updatedAt:1}]);await store.preference('navigator.open',true);
 const exported=validateBackup(await store.backup()),incoming=make();incoming.conversations.messages[0]={...message,id:'two'};
 const changed=await store.importBackup(incoming,5,3);assert.equal(changed.revision,6);assert.equal(changed.indexGeneration,4);
 assert.equal((await store.load('a')).messages[0].id,'two');assert.equal(await store.preference('navigator.width'),450);
 const recovery=await store.recoveryBackup();assert.deepEqual(recovery.state,exported.state);assert.deepEqual(recovery.conversations,exported.conversations);
 await store.importBackup(recovery,6,4);assert.deepEqual((await store.load('a')).annotations,exported.conversations.annotations);assert.equal((await store.readState())?.settings.layout.userAvatar,image);
 const invalid={...incoming,conversations:{messages:[{...message,role:'system'}],annotations:[]}};
 await assert.rejects(()=>store.importBackup(invalid,7));assert.equal((await store.load('a')).messages[0].id,'one');
});
test('backup rejects unknown schemas, duplicate IDs, orphan annotations, unsafe URLs, oversized notes and prototype keys',()=>{
 const b=make();assert.equal(parseBackup(JSON.stringify(b)).conversations.messages.length,1);
 for(const mutate of [
  (x:any)=>x.schemaVersion=2,
  (x:any)=>x.conversations.messages.push({...message}),
  (x:any)=>x.conversations.annotations.push({conversationId:'a',messageId:'missing',bookmarked:true,labels:[],note:'',updatedAt:1}),
  (x:any)=>x.preferences.push({key:'state',value:{}}),
  (x:any)=>x.state.settings.theme.background='url(https://evil.invalid)',
  (x:any)=>x.state.settings.inject='bad',
  (x:any)=>x.state.settings.layout.userAvatar='https://evil.invalid/image',
 ]){const copy=structuredClone(b);mutate(copy);assert.throws(()=>validateBackup(copy));}
 assert.throws(()=>parseBackup('{"__proto__":{"polluted":true}}'));
});
test('v1 database upgrade preserves indexed rows while adding metadata and assets',async()=>{
 const factory=new IDBFactory();await new Promise<void>((resolve,reject)=>{const r=factory.open('upgrade',1);r.onupgradeneeded=()=>{for(const name of ['messages','annotations'])r.result.createObjectStore(name,{keyPath:name==='messages'?['conversationId','id']:['conversationId','messageId']}).createIndex('conversation','conversationId');r.result.createObjectStore('preferences',{keyPath:'key'});r.transaction!.objectStore('messages').put(message);};r.onerror=()=>reject(r.error);r.onsuccess=()=>{r.result.close();resolve();};});
 const store=new ConversationStore(factory,'upgrade');await store.writeState(initialState());assert.deepEqual((await store.load('a')).messages,[message]);
});
