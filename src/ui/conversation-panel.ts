import type {ConversationService} from '../conversation/service';
import {ConversationSearch,observedTree,type SearchFilter,type SearchResult} from '../conversation/search';
import type {PromptNavigator} from '../features/prompt-navigator';
import {ConversationFocus} from '../features/focus';
import {VirtualList} from './virtual-list';
import {el,button,input,select,field} from './dom';
export class ConversationPanel {
 private search=new ConversationSearch();private abort?:AbortController;private unsubscribe?:()=>void;private timer?:ReturnType<typeof setTimeout>;
 readonly focus=new ConversationFocus();
 constructor(private service:ConversationService,private navigator:PromptNavigator){}
 render(container:HTMLElement,kind:string){
  this.close();const index=this.service.index;
  if(kind==='outline'){
   const groups=index.all.filter(r=>r.role==='assistant'&&r.headings.length);
   const list=new VirtualList<(typeof groups)[number]>(row=>{const details=el('details');details.style.overflow='auto';details.append(el('summary',row.preview.slice(0,100)));for(const h of row.headings)details.append(button(`${'·'.repeat(h.level)} ${h.text}`,()=>void this.navigator.jump(row.id,h.key)));return details;},150);list.set(groups);container.append(el('p',`${groups.length} respostas com títulos`),list.host);return;
  }
  if(kind==='tree'){
   const edges=observedTree(index);container.append(el('p',edges.length?'Relações explicitamente observadas no ChatGPT':'Nenhuma relação pai/filho observável nesta conversa'));const list=new VirtualList<(typeof edges)[number]>(edge=>button(`${index.get(edge.from)?.preview.slice(0,60)} → ${index.get(edge.to)?.preview.slice(0,60)}`,()=>void this.navigator.jump(edge.to)));list.set(edges);container.append(list.host);return;
  }
  const query=input(''),filter=select([['all','Todas'],['user','Você'],['assistant','Respostas'],['bookmarked','Favoritos'],['attachments','Anexos']],kind==='bookmarks'?'bookmarked':'all');query.placeholder='Buscar texto, título, etiqueta ou nota';query.setAttribute('aria-label','Busca local');
  const status=el('p',undefined,'note'),editor=el('section');
  const list=new VirtualList<SearchResult>(result=>{const row=el('div');row.append(button(`${result.message.role==='user'?'Você':'Resposta'} · ${result.snippet}`,()=>void this.navigator.jump(result.message.id)),button('Anotar / foco',()=>edit(result.message.id)));return row;},90);
  const edit=(id:string)=>{
   const a=index.annotations.get(id),labels=input(a?.labels.join(', ')||''),note=el('textarea');note.value=a?.note||'';note.maxLength=20000;labels.maxLength=4000;
   const saved=el('p',undefined,'status');
   const save=(patch:Parameters<ConversationService['annotate']>[1])=>void this.service.annotate(id,patch).then(()=>{saved.textContent='Salvo';refresh();}).catch(e=>{saved.textContent=String(e);});
   editor.replaceChildren(el('h3','Anotações locais'),button(a?.bookmarked?'Remover favorito':'Marcar favorito',()=>{save({bookmarked:!index.annotations.get(id)?.bookmarked});}),field('Etiquetas separadas por vírgula',labels),field('Nota',note),button('Salvar nota e etiquetas',()=>save({note:note.value,labels:[...new Set(labels.value.split(',').map(t=>t.trim()).filter(Boolean))]})),button('Limpar anotação',()=>{save({bookmarked:false,note:'',labels:[]});editor.replaceChildren();}),button('Recolher mensagem',()=>this.focus.collapse(index,id)),button('Focar esta mensagem',()=>this.focus.only(index,id)),button('Expandir tudo',()=>this.focus.expandAll()),saved);
  };
  const refresh=()=>{this.abort?.abort();const abort=this.abort=new AbortController();status.textContent='Buscando…';void this.search.query(index,query.value,filter.value as SearchFilter,abort.signal).then(rows=>{if(abort.signal.aborted)return;status.textContent=`${rows.length} resultados · ${index.size} indexadas · ${index.loadedCount} carregadas`;list.set(rows);});};
  query.oninput=()=>{clearTimeout(this.timer);this.timer=setTimeout(refresh,120);};filter.onchange=refresh;this.unsubscribe=this.service.subscribe(()=>{if(index===this.service.index)refresh();else this.close();});
  container.append(query,filter,status,list.host,editor);refresh();query.focus();
 }
 close(){this.abort?.abort();clearTimeout(this.timer);this.unsubscribe?.();this.unsubscribe=undefined;}
 dispose(){this.close();this.focus.dispose();}
}
