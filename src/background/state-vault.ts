import type { KV } from './coordinator';
import type { State } from '../shared/model';
import { migrate } from '../shared/validation';
import { ConversationStore } from '../conversation/storage';
/** IDB is authoritative. chrome.storage only holds startup colors and a revision notification. */
export class StateVault implements KV {
 constructor(private store:ConversationStore,private local:KV){}
 async get(key:string) {
  if(key!=='nagi')return this.local.get(key);
  const saved=await this.store.readState();if(saved)return saved;
  const legacy=await this.local.get('nagi');
  if((legacy as any)?.storageVersion===2)throw new Error('Banco local ausente. Restaure seu backup; dados não foram substituídos.');
  const state=migrate(legacy);await this.store.writeState(state);await this.notify(state);return state;
 }
 async set(key:string,value:unknown){if(key!=='nagi')return this.local.set(key,value);const state=migrate(value);await this.store.writeState(state);await this.notify(state);}
 async notify(state:State){
  const settings=structuredClone(state.settings);settings.layout.userAvatar='';
  await this.local.set('nagi',{schema:1,storageVersion:2,revision:state.revision,indexGeneration:state.indexGeneration,settings,personas:[],chains:[]});
 }
}
