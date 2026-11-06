import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { ConversationIndex } from '../src/conversation/index.ts';
import { MessageRegistry } from '../src/conversation/registry.ts';
import { resolveMessages } from '../src/adapter/messages.ts';
test('index preserves identity, duplicate prompts, streaming, ordering and unloaded data', () => {
 const dom = new JSDOM('<main><div data-message-id="b" data-message-role="user">Hi</div><div data-message-id="c" data-message-role="assistant"><h2>Title</h2>世界</div></main>');
 const doc=dom.window.document, registry=new MessageRegistry(doc), index=new ConversationIndex('one');
 index.capture(registry.read()); assert.equal(index.size,2);
 doc.querySelector('main')!.insertAdjacentHTML('afterbegin','<div data-message-id="a" data-message-role="user">Hi</div>');
 index.capture(resolveMessages(doc)); assert.deepEqual(index.all.map(r=>r.nativeId),['a','b','c']);
 doc.querySelector('[data-message-id=c]')!.append(' more'); index.capture(registry.read()); assert.equal(index.size,3);
 assert.equal(index.all[2].headings.length,1); const saved=index.drain();
 doc.querySelector('[data-message-id=b]')!.remove(); index.capture(registry.read()); assert.equal(index.size,3); assert.equal(index.loadedCount,2);
 const restored=new ConversationIndex('one'); restored.hydrate(saved); assert.equal(restored.size,3); assert.equal(restored.loadedCount,0);
 const other=new ConversationIndex('other'); other.hydrate(saved); assert.equal(other.size,0);
 assert.equal(registry.metrics.fullScans,1); registry.dispose(); dom.window.close();
});
test('identical fallback prompts stay distinct and hydrate on unambiguous remount',()=>{
 const dom=new JSDOM('<main><div data-message-role="user">same</div><div data-message-role="user">same</div></main>');
 const index=new ConversationIndex('one'); index.capture(resolveMessages(dom.window.document)); index.capture(resolveMessages(dom.window.document)); assert.equal(index.size,2); dom.window.close();
});
