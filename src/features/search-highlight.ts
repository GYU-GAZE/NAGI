import { normalize } from '../conversation/search';
/** CSS Highlight API leaves React's text nodes and the user's selection intact. */
export function matchRange(root:HTMLElement,query:string):Range|undefined {
 const needle=normalize(query.trim());if(!needle)return;
 const walker=root.ownerDocument.createTreeWalker(root,4),positions:{node:Text;start:number;end:number}[]=[];let source='',node:Node|null;
 while((node=walker.nextNode())){
  if(node.parentElement?.closest('[data-nagi-owned],button,script,style'))continue;
  const text=node as Text;
  for(let at=0;at<text.length;){const point=text.data.codePointAt(at)!,width=point>0xffff?2:1,folded=normalize(String.fromCodePoint(point));source+=folded;for(let j=0;j<folded.length;j++)positions.push({node:text,start:at,end:at+width});at+=width;}
 }
 const at=source.indexOf(needle);if(at<0||!positions[at]||!positions[at+needle.length-1])return;
 const first=positions[at],last=positions[at+needle.length-1],range=root.ownerDocument.createRange();range.setStart(first.node,first.start);range.setEnd(last.node,last.end);return range;
}
export class SearchHighlight {
 private timer?:ReturnType<typeof setTimeout>;
 private style=document.createElement('style');
 constructor(){this.style.dataset.nagiOwned='search-highlight';this.style.textContent='::highlight(nagi-search){background:var(--nagi-accent,#32d9f5);color:var(--nagi-accent-foreground,#000)}';document.head.append(this.style);}
 show(node:HTMLElement,query:string){this.clear();const range=matchRange(node,query),win=node.ownerDocument.defaultView as any;if(range&&win.CSS?.highlights&&win.Highlight){win.CSS.highlights.set('nagi-search',new win.Highlight(range));this.timer=setTimeout(()=>this.clear(),2500);}}
 clear(){clearTimeout(this.timer);(window.CSS as any)?.highlights?.delete('nagi-search');}
 dispose(){this.clear();this.style.remove();}
}
