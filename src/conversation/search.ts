import type {ConversationIndex,MessageRecord} from './index';
export type SearchFilter='all'|'user'|'assistant'|'bookmarked'|'attachments';
export const normalize=(text:string)=>text.normalize('NFKD').replace(/\p{M}/gu,'').toLocaleLowerCase();
export interface SearchResult { message:MessageRecord; snippet:string; }
/** Substrings intentionally support CJK and languages without word boundaries. */
export class ConversationSearch {
 private cache=new Map<string,{stamp:number;source:string;normalized:string}>();
 private conversation='';
 async query(index:ConversationIndex,query:string,filter:SearchFilter='all',signal?:AbortSignal):Promise<SearchResult[]> {
  if(this.conversation!==index.conversationId){this.cache.clear();this.conversation=index.conversationId;}
  const needle=normalize(query.trim()),result:SearchResult[]=[];
  let scanned=0;
  for(const row of index.all) {
   if(signal?.aborted)return [];
   const a=index.annotations.get(row.id);
   if(filter==='user'&&row.role!=='user'||filter==='assistant'&&row.role!=='assistant'||filter==='bookmarked'&&!a?.bookmarked||filter==='attachments'&&!row.attachments.length)continue;
   const source=[row.text,...row.headings.map(h=>h.text),...row.attachments,a?.note||'',...(a?.labels||[])].join('\n');
   let cached=this.cache.get(row.id);if(!cached||cached.stamp!==row.updatedAt||cached.source!==source){cached={stamp:row.updatedAt,source,normalized:normalize(source)};this.cache.set(row.id,cached);}
   const position=needle?cached.normalized.indexOf(needle):0;
   if(position>=0)result.push({message:row,snippet:source.slice(Math.max(0,position-50),position+190)});
   if(++scanned%200===0)await new Promise(r=>setTimeout(r,0));
  }
  return result;
 }
}
export function observedTree(index:ConversationIndex) {
 const native=new Map(index.all.filter(r=>r.nativeId).map(r=>[r.nativeId!,r.id]));
 return index.all.flatMap(r=>r.parentId&&native.has(r.parentId)?[{from:native.get(r.parentId)!,to:r.id}]:[]);
}
