import {test} from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {ConversationIndex} from '../src/conversation/index.ts';
import {MessageRegistry} from '../src/conversation/registry.ts';
import {resolveMessages,resolveTurns} from '../src/adapter/messages.ts';
import {ConversationSearch} from '../src/conversation/search.ts';
import {VirtualList} from '../src/ui/virtual-list.ts';
import {matchRange} from '../src/features/search-highlight.ts';
const setup=(count:number)=>new JSDOM('<main>'+Array.from({length:count},(_,i)=>`<article data-testid="conversation-turn-${i}"><div data-message-id="m${i}" data-message-role="${i%2?'assistant':'user'}">configuração 東京 ${i}</div></article>`).join('')+'</main>');
for(const count of [20,200,1000])test(`${count} turns: shared discovery, streaming, detach and restored ordering`,async()=>{
 const dom=setup(count),doc=dom.window.document,registry=new MessageRegistry(doc),index=new ConversationIndex('scale');
 const start=performance.now();index.capture(registry.read());registry.takeChanged();
 const refs=registry.read();for(let i=0;i<20;i++){assert.equal(resolveMessages(doc),refs);assert.equal(resolveTurns(doc).length,count);}assert.equal(registry.metrics.fullScans,1);
 const last=doc.querySelectorAll<HTMLElement>('[data-message-id]')[count-1];last.firstChild!.textContent+=' streaming';const regions=registry.read(),changed=registry.takeChanged();assert.equal(changed.size,1);index.capture(regions,changed);assert.match(index.all.at(-1)!.text,/streaming/);
 doc.querySelector('article')!.remove();index.capture(registry.read(),registry.takeChanged());assert.equal(index.size,count);assert.equal(index.loadedCount,count-1);
 const restored=new ConversationIndex('scale');restored.hydrate(index.drain());assert.equal(restored.size,count);assert.equal(restored.loadedCount,0);
 const rows=await new ConversationSearch().query(restored,'CONFIGURACAO');assert.equal(rows.length,count);
 console.log(JSON.stringify({turns:count,indexed:index.size,loaded:index.loadedCount,elapsedMs:Math.round(performance.now()-start),fullScans:registry.metrics.fullScans}));registry.dispose();dom.window.close();
});
test('5,000 indexed records: bounded DOM, end-to-start filtering and keyboard focus',async()=>{
 const dom=setup(0);Object.defineProperty(globalThis,'document',{value:dom.window.document,configurable:true});
 const index=new ConversationIndex('many');index.hydrate(Array.from({length:5000},(_,i)=>({conversationId:'many',id:`m${i}`,role:'user',order:i,text:`configuração 日本語 ${i}`,preview:`prompt ${i}`,headings:[],attachments:[],updatedAt:1})));
 const list=new VirtualList<(typeof index.all)[number]>(row=>{const button=document.createElement('button');button.textContent=row.preview;return button;});document.body.append(list.host);list.set(index.all);assert.ok(list.host.querySelectorAll('button').length<20);
 list.focus(4999);assert.equal((document.activeElement as HTMLElement).dataset.virtualIndex,'4999');list.set(index.all.slice(0,1));assert.equal(list.host.querySelectorAll('button').length,1);assert.equal(list.host.scrollTop,0);
 list.set([]);assert.equal(list.host.querySelectorAll('button').length,0);list.focus(0);
 const start=performance.now(),results=await new ConversationSearch().query(index,'日本語');assert.equal(results.length,5000);console.log(JSON.stringify({indexed:5000,searchMs:Math.round(performance.now()-start),renderedLimit:20}));dom.window.close();
});
test('pending capture reconciles only observed messages and native IDs can arrive after a local ID',()=>{
 const dom=setup(0),doc=dom.window.document,index=new ConversationIndex('a');index.expectPrompt('hello');assert.equal(index.size,0);assert.equal(index.pendingCount,1);
 doc.querySelector('main')!.innerHTML='<div data-message-role="user">hello</div>';index.capture(resolveMessages(doc));assert.equal(index.pendingCount,0);const id=index.all[0].id;
 doc.querySelector('[data-message-role]')!.setAttribute('data-message-id','native');index.capture(resolveMessages(doc));assert.equal(index.size,1);assert.equal(index.all[0].id,id);assert.equal(index.all[0].nativeId,'native');dom.window.close();
});
test('1000 inserted messages between native anchors preserve order without fraction collisions',()=>{
 const dom=setup(2),doc=dom.window.document,index=new ConversationIndex('a');index.capture(resolveMessages(doc));
 doc.querySelector('article')!.insertAdjacentHTML('afterend',Array.from({length:1000},(_,i)=>`<div data-message-id="insert-${i}" data-message-role="user">${i}</div>`).join(''));index.capture(resolveMessages(doc));
 assert.deepEqual(index.all.slice(1,1001).map(r=>r.text),Array.from({length:1000},(_,i)=>String(i)));assert.equal(new Set(index.all.map(r=>r.order)).size,1002);dom.window.close();
});
test('accent-insensitive highlighting keeps original accented text and CJK offsets',()=>{
 const dom=new JSDOM('<p>Configuração <em>日本語</em></p>'),node=dom.window.document.querySelector('p')!;
 assert.equal(matchRange(node,'configuracao')?.toString(),'Configuração');assert.equal(matchRange(node,'日本語')?.toString(),'日本語');assert.equal(node.querySelectorAll('mark').length,0);dom.window.close();
});
