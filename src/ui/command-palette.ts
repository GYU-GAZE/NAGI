import {el,button,input} from './dom';
import {normalize} from '../conversation/search';
export interface PaletteCommand {id:string;label:string;run():void;}
export function fuzzyScore(label:string,query:string){const text=normalize(label),needle=normalize(query.trim());if(!needle)return 0;let cursor=0,score=0;for(const char of needle){const at=text.indexOf(char,cursor);if(at<0)return Infinity;score+=at-cursor;cursor=at+1;}return score;}
export function renderPalette(container:HTMLElement,commands:PaletteCommand[]){const query=input(''),list=el('div',undefined,'list');query.placeholder='Buscar comando…';query.setAttribute('aria-label','Comando nAGI');let active=0,buttons:HTMLButtonElement[]=[];
 const render=()=>{list.replaceChildren();buttons=commands.map(c=>({c,score:fuzzyScore(c.label,query.value)})).filter(r=>Number.isFinite(r.score)).sort((a,b)=>a.score-b.score).slice(0,30).map(({c})=>button(c.label,c.run));list.append(...buttons);active=0;};
 query.oninput=render;query.onkeydown=e=>{if(e.key==='ArrowDown'){e.preventDefault();buttons[0]?.focus();}if(e.key==='Enter'){e.preventDefault();buttons[active]?.click();}};
 list.onkeydown=e=>{if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();active=Math.max(0,Math.min(buttons.length-1,buttons.indexOf(container.ownerDocument.activeElement as HTMLButtonElement)+(e.key==='ArrowDown'?1:-1)));buttons[active]?.focus();}};
 container.append(query,list);render();query.focus();
}
