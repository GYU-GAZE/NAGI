import {test} from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {ConversationService} from '../src/conversation/service.ts';
const tick=()=>new Promise(r=>setTimeout(r,0));
test('route isolation blocks the previous native DOM while a different conversation loads',async()=>{
 const dom=new JSDOM('<main><div data-message-id="a1" data-message-role="user">A</div></main>');Object.defineProperty(globalThis,'document',{value:dom.window.document,configurable:true});
 const writes:any[]=[];const client={request:async(type:string,p:any)=>{if(type==='index.load')return {messages:[],annotations:[]};if(type==='index.write')writes.push(p);return undefined;}} as any;
 const service=new ConversationService(client);service.update('a');await tick();assert.equal(service.index.size,1);
 service.update('b');await tick();assert.equal(service.index.size,0);
 const node=document.querySelector('div')!;node.setAttribute('data-message-id','b1');node.textContent='B';service.capture();assert.equal(service.index.size,1);assert.equal(service.index.all[0].text,'B');
 await service.flush();assert.equal(writes.at(-1).messages[0].conversationId,'b');assert.equal(writes.at(-1).messages[0].text,'B');service.dispose();dom.window.close();
});
test('late hydration cannot switch back to a previous conversation and failed writes remain retryable',async()=>{
 const dom=new JSDOM('<main><div data-message-id="b1" data-message-role="user">B</div></main>');Object.defineProperty(globalThis,'document',{value:dom.window.document,configurable:true});
 let loadA:(value:any)=>void=()=>{},fail=true,writes=0;
 const client={request:async(type:string,p:any)=>{if(type==='index.load')return p.conversationId==='a'?new Promise(r=>loadA=r):{messages:[],annotations:[]};if(type==='index.write'){writes++;if(fail)throw new Error('quota');}return undefined;}} as any;
 const service=new ConversationService(client);service.update('a');service.update('b');await tick();loadA({messages:[],annotations:[]});await tick();assert.equal(service.index.conversationId,'b');assert.equal(service.index.size,1);
 await assert.rejects(()=>service.flush(true),/quota/);fail=false;await service.flush(true);assert.equal(writes,2);assert.equal(service.error,'');service.dispose();dom.window.close();
});
