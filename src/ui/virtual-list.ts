/** Fixed-height rows with a bounded overscan window and keyboard traversal. */
export class VirtualList<T> {
 readonly host=document.createElement('div');
 private content=document.createElement('div');
 private items:T[]=[];
 private first=-1;private last=-1;
 constructor(private render:(item:T,index:number)=>HTMLElement,readonly rowHeight=72){
  this.host.style.cssText='height:360px;max-height:48vh;overflow:auto;position:relative;overscroll-behavior:contain';
  this.host.setAttribute('role','list');this.content.style.position='relative';this.host.append(this.content);
  this.host.addEventListener('scroll',()=>this.draw(),{passive:true});
 }
 set(items:T[]){this.items=items;this.content.style.height=`${items.length*this.rowHeight}px`;this.host.scrollTop=Math.min(this.host.scrollTop,Math.max(0,items.length*this.rowHeight-(this.host.clientHeight||360)));this.first=-1;this.draw();}
 private draw(){
  const first=Math.max(0,Math.floor(this.host.scrollTop/this.rowHeight)-3),last=Math.min(this.items.length,first+Math.ceil((this.host.clientHeight||360)/this.rowHeight)+6);
  if(first===this.first&&last===this.last)return;this.first=first;this.last=last;
  const focused=this.host.ownerDocument.activeElement as HTMLElement|null,key=focused?.closest<HTMLElement>('[data-virtual-index]')?.dataset.virtualIndex;
  this.content.replaceChildren();
  for(let i=first;i<last;i++){
   const row=this.render(this.items[i],i);row.dataset.virtualIndex=String(i);
   if(!row.matches('button,a,input,select,textarea'))row.tabIndex=0;
   row.setAttribute('aria-posinset',String(i+1));row.setAttribute('aria-setsize',String(this.items.length));
   row.style.cssText+=`;position:absolute;top:${i*this.rowHeight}px;height:${this.rowHeight-4}px;left:0;right:0;overflow:auto;text-align:left`;
   row.addEventListener('keydown',e=>{if(e.target instanceof row.ownerDocument.defaultView!.HTMLInputElement||e.target instanceof row.ownerDocument.defaultView!.HTMLTextAreaElement)return;
    const target=e.key==='ArrowDown'?i+1:e.key==='ArrowUp'?i-1:e.key==='Home'?0:e.key==='End'?this.items.length-1:undefined;
    if(target!==undefined){e.preventDefault();this.focus(target);}
   });this.content.append(row);
  }
  if(key&&focused?.isConnected===false)(this.content.querySelector(`[data-virtual-index="${key}"]`) as HTMLElement|null)?.focus({preventScroll:true});
 }
 focus(index:number){if(!this.items.length)return;index=Math.max(0,Math.min(this.items.length-1,index));this.host.scrollTop=Math.max(0,(index-2)*this.rowHeight);this.draw();(this.content.querySelector(`[data-virtual-index="${index}"]`) as HTMLElement|null)?.focus({preventScroll:true});}
}
