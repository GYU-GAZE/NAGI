import { test } from 'node:test';
import assert from 'node:assert/strict';
import { IDBFactory } from 'fake-indexeddb';
import { ConversationStore } from '../src/conversation/storage.ts';
const row={conversationId:'a',id:'1',role:'user' as const,order:0,text:'Olá 世界',preview:'Olá 世界',headings:[],attachments:[],updatedAt:1};
test('IndexedDB survives reopen, isolates conversations and atomically rejects invalid imports',async()=>{
 const factory=new IDBFactory(),store=new ConversationStore(factory);
 await store.write([row,{...row,conversationId:'b'}]);
 await store.write([],[{conversationId:'a',messageId:'1',bookmarked:true,labels:['decisão'],note:'Remember',updatedAt:2}]);
 const reopened=new ConversationStore(factory); assert.equal((await reopened.load('a')).messages.length,1);assert.equal((await reopened.load('a')).annotations[0].note,'Remember');
 await assert.rejects(()=>store.replace({messages:[{...row,role:'invalid'} as any],annotations:[]}));assert.equal((await store.dump()).messages.length,2);
 await store.preference('navigator.width',400);assert.equal(await reopened.preference('navigator.width'),400);
 await store.replace({messages:[row],annotations:[]});assert.equal((await store.load('b')).messages.length,0);
});
