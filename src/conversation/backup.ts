import { migrate } from '../shared/validation';
import { initialState, type State } from '../shared/model';
import type { ConversationData } from './storage';
import { validateRows } from './storage';
import type { ConversationIndex } from './index';
export const BACKUP_VERSION = 1;
export const MAX_BACKUP_BYTES = 100_000_000;
export interface Backup {
  format: 'nagi-backup'; schemaVersion: 1; createdAt: string;
  state: State; conversations: ConversationData;
  preferences: { key: string; value: unknown }[];
}
const keys = (value: any, allowed: string[]) => {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(k => !allowed.includes(k))) throw new Error('Campos desconhecidos no backup');
};
export function validateBackup(value: unknown): Backup {
  const b = value as Backup;
  keys(b, ['format','schemaVersion','createdAt','state','conversations','preferences']);
  if (b.format !== 'nagi-backup' || b.schemaVersion !== BACKUP_VERSION || typeof b.createdAt !== 'string' || !Number.isFinite(Date.parse(b.createdAt))) throw new Error('Versão ou formato de backup incompatível');
  keys(b.state,['schema','revision','indexGeneration','settings','personas','chains']);
  const defaults=initialState();
  keys(b.state.settings,Object.keys(defaults.settings));
  keys(b.state.settings.theme,Object.keys(defaults.settings.theme));
  if(b.state.settings.layout)keys(b.state.settings.layout,Object.keys(defaults.settings.layout));
  const state=migrate(b.state);
  for(const p of state.personas){keys(p,['id','name','instructions','avatars','version','history']);p.history.forEach(h=>keys(h,['version','instructions','createdAt']));}
  for(const c of state.chains){keys(c,['id','name','projectId','sessions','currentSession','defaultPersonaId','rememberLastPersona','lastPersonaId','continuationMessage','version']);c.sessions.forEach(s=>keys(s,['id','title','url','personaId','personaVersion']));}
  if (state.personas.some(p => p.history.length > 1000)) throw new Error('Histórico de Persona acima do limite');
  keys(b.conversations,['messages','annotations']);
  validateRows(b.conversations.messages,b.conversations.annotations);
  const ids=new Set<string>();
  for(const r of b.conversations.messages) {
    keys(r,['conversationId','id','nativeId','parentId','role','order','text','preview','headings','attachments','updatedAt']);
    r.headings.forEach(h=>keys(h,['key','level','text']));
    const key=JSON.stringify([r.conversationId,r.id]);if(ids.has(key))throw new Error('Mensagem duplicada no backup');ids.add(key);
  }
  const annotations=new Set<string>();
  for(const a of b.conversations.annotations) {
    keys(a,['conversationId','messageId','bookmarked','labels','note','updatedAt']);
    const key=JSON.stringify([a.conversationId,a.messageId]);if(!ids.has(key)||annotations.has(key))throw new Error('Anotação duplicada ou sem mensagem');annotations.add(key);
  }
  if(!Array.isArray(b.preferences)||b.preferences.length>20)throw new Error('Preferências inválidas');
  const prefs=new Set<string>();
  for(const p of b.preferences){keys(p,['key','value']);if(prefs.has(p.key))throw new Error('Preferência duplicada');prefs.add(p.key);validatePreference(p.key,p.value);}
  if(new TextEncoder().encode(JSON.stringify(b)).length>MAX_BACKUP_BYTES)throw new Error('Backup excede 100 MB');
  return {...b,state};
}
export function validatePreference(key:string,value:unknown) {
 if(key==='navigator.open'&&typeof value==='boolean')return;
 if(key==='navigator.width'&&typeof value==='number'&&Number.isFinite(value)&&value>=280&&value<=900)return;
 throw new Error('Preferência desconhecida ou inválida');
}
export function parseBackup(text:string) {
 if(text.length>MAX_BACKUP_BYTES)throw new Error('Backup excede 100 MB');
 return validateBackup(JSON.parse(text,(key,value)=>{if(['__proto__','prototype','constructor'].includes(key))throw new Error('Chave não permitida');return value;}));
}
export function readableConversation(index:ConversationIndex) {
 return `# Conversa ${index.conversationId}\n\n${index.size} mensagens indexadas localmente\n\n` + index.all.map(row=>{
  const a=index.annotations.get(row.id);
  return `## ${row.role==='user'?'Você':'Assistant'}\n\n${row.text}\n`+(a?.bookmarked?'\n★ Favorito\n':'')+(a?.labels.length?`\nEtiquetas: ${a.labels.join(', ')}\n`:'')+(a?.note?`\nNota: ${a.note}\n`:'');
 }).join('\n---\n\n');
}
