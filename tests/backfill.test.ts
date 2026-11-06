import {test} from 'node:test';import assert from 'node:assert/strict';import {Backfill} from '../src/conversation/backfill.ts';
test('backfill deduplicates no-progress, terminates and restores scroll',async()=>{let count=2,steps=0,restored=0;const fill=new Backfill({count:()=>count,loadOlder:async()=>{if(++steps<3)count++;},capture:()=>{},savePosition:()=>()=>{restored++;}});await fill.run();assert.equal(count,4);assert.equal(fill.progress.steps,6);assert.equal(restored,1);assert.equal(fill.progress.running,false);});
test('cancel restores position and stops additional loads',async()=>{let steps=0,restore=false;const fill=new Backfill({count:()=>0,loadOlder:async()=>{steps++;fill.cancel();},capture:()=>{},savePosition:()=>()=>{restore=true;}});await fill.run();assert.equal(steps,1);assert.ok(restore);assert.equal(fill.progress.reason,'Cancelado');});
test('hydrating already indexed pages counts as progress for unloaded navigation',async()=>{
 let page=0;const fill=new Backfill({count:()=>5000,positionToken:()=>String(page),loadOlder:async()=>{page++;},capture:()=>{},savePosition:()=>()=>{}});
 await fill.run(()=>page===8);assert.equal(fill.progress.reason,'Mensagem encontrada');assert.equal(page,8);
});
