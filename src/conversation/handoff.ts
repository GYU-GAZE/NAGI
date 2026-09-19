import type {ConversationIndex} from './index';
import type {Chain,Persona,Selection} from '../shared/model';
export interface Continuation {chainId:string;sourceId:string;selection:Selection;draft:string;createdAt:number;}
export function handoff(index:ConversationIndex,chain:Chain,persona?:Persona){
 const selected=index.all.filter(r=>{const a=index.annotations.get(r.id);return a?.bookmarked||a?.note||a?.labels.some(l=>/decis|decision/i.test(l));});
 const lines=[`Continuação da Chain: ${chain.name}`,`Sessão anterior: ${chain.sessions.find(s=>s.id===index.conversationId)?.url||index.conversationId}`,`Persona: ${persona?.name||'ChatGPT'} (identidade local; instruções da conta não alteradas)`,chain.continuationMessage,'','Contexto selecionado pelo usuário:'];
 if(!selected.length)lines.push('Nenhum favorito, decisão ou nota marcado. Acrescente o contexto necessário antes de enviar.');
 for(const row of selected){const a=index.annotations.get(row.id)!;lines.push(`\n[${row.role}] ${row.text.slice(0,2500)}`,a.labels.length?`Etiquetas: ${a.labels.join(', ')}`:'',a.note?`Nota: ${a.note}`:'');}
 return lines.filter(Boolean).join('\n').slice(0,30000);
}
export function validateContinuation(value:unknown):asserts value is Continuation {
 const p=value as Continuation;
 if(!p||typeof p.chainId!=='string'||p.chainId.length>100||typeof p.sourceId!=='string'||p.sourceId.length>200||typeof p.draft!=='string'||p.draft.length>40000||!Number.isFinite(p.createdAt)||!p.selection||p.selection.chainId!==p.chainId||!(p.selection.personaId===null||typeof p.selection.personaId==='string')||typeof p.selection.visualOnly!=='boolean')throw new Error('Continuação inválida');
}
