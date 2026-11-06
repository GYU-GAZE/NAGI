import type {ConversationIndex} from '../conversation/index';
/** CSS-only collapse preserves React ownership and all native event handlers. */
export class ConversationFocus {
 private collapsed=new Map<HTMLElement,HTMLElement>();
 private style=document.createElement('style');
 private reveal=(event:Event)=>{const target=event.target as HTMLElement;for(const node of this.collapsed.keys())if(node===target||node.contains(target))this.expand(node);};
 constructor(){this.style.dataset.nagiOwned='focus';this.style.textContent='[data-nagi-collapsed]{display:none!important}.nagi-collapse-placeholder{display:block;margin:12px auto;padding:12px;max-width:var(--nagi-width,900px);color:var(--nagi-text);background:var(--nagi-composer);border:1px solid var(--nagi-accent,#32d9f5);font:inherit}';document.head.append(this.style);document.addEventListener('nagi:reveal',this.reveal);}
 collapse(index:ConversationIndex,id:string){const node=index.node(id);if(!node||this.collapsed.has(node)||node.contains(document.activeElement)||node.querySelector('[contenteditable=true],iframe,video,audio'))return;const placeholder=document.createElement('button');placeholder.dataset.nagiOwned='collapse';placeholder.className='nagi-collapse-placeholder';placeholder.textContent=`Expandir · ${index.get(id)?.preview.slice(0,100)}`;placeholder.onclick=()=>this.expand(node);node.before(placeholder);node.setAttribute('data-nagi-collapsed','');this.collapsed.set(node,placeholder);}
 only(index:ConversationIndex,id:string){this.expandAll();for(const row of index.all)if(row.id!==id)this.collapse(index,row.id);}
 private expand(node:HTMLElement){const placeholder=this.collapsed.get(node);const top=placeholder?.getBoundingClientRect().top;node.removeAttribute('data-nagi-collapsed');placeholder?.remove();this.collapsed.delete(node);if(top!==undefined&&node.isConnected){const delta=node.getBoundingClientRect().top-top;if(delta)window.scrollBy?.(0,delta);}}
 expandAll(){for(const node of [...this.collapsed.keys()])this.expand(node);}
 dispose(){this.expandAll();document.removeEventListener('nagi:reveal',this.reveal);this.style.remove();}
}
