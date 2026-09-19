/** Fixed-height window: the DOM cost stays bounded regardless of index size. */
export class VirtualList<T> {
 readonly host=document.createElement('div');
 private content=document.createElement('div');
 private items:T[]=[];
 constructor(private render:(item:T,index:number)=>HTMLElement,readonly rowHeight=72) {
  this.host.style.cssText='height:360px;max-height:48vh;overflow:auto;position:relative;overscroll-behavior:contain';
  this.content.style.position='relative';this.host.append(this.content);
  this.host.addEventListener('scroll',()=>this.draw(),{passive:true});
 }
 set(items:T[]) {this.items=items;this.content.style.height=`${items.length*this.rowHeight}px`;this.draw();}
 private draw() {
  const first=Math.max(0,Math.floor(this.host.scrollTop/this.rowHeight)-3),last=Math.min(this.items.length,first+Math.ceil((this.host.clientHeight||360)/this.rowHeight)+6);
  const focused=this.host.ownerDocument.activeElement as HTMLElement|null,key=focused?.dataset.virtualIndex;
  this.content.replaceChildren();
  for(let i=first;i<last;i++) {const row=this.render(this.items[i],i);row.dataset.virtualIndex=String(i);row.style.cssText+=`;position:absolute;top:${i*this.rowHeight}px;height:${this.rowHeight-4}px;left:0;right:0;overflow:hidden;text-align:left`;
   row.addEventListener('keydown',e=>{if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();this.focus(i+(e.key==='ArrowDown'?1:-1));}});this.content.append(row);}
  if(key && this.content.querySelector(`[data-virtual-index="${key}"]`) && focused?.isConnected===false) (this.content.querySelector(`[data-virtual-index="${key}"]`) as HTMLElement).focus({preventScroll:true});
 }
 focus(index:number) {index=Math.max(0,Math.min(this.items.length-1,index));this.host.scrollTop=Math.max(0,(index-2)*this.rowHeight);this.draw();(this.content.querySelector(`[data-virtual-index="${index}"]`) as HTMLElement|null)?.focus({preventScroll:true});}
}
