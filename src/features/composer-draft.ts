export function readDraft(node:HTMLElement){return node instanceof node.ownerDocument.defaultView!.HTMLTextAreaElement?node.value:node.textContent||'';}
/** Explicit draft insertion only. Never clicks Send and never silently overwrites text. */
export function writeDraft(node:HTMLElement,text:string,replace=false){
 if(!replace&&readDraft(node).trim())throw new Error('O composer já contém um rascunho. Copie a continuação manualmente.');
 const win=node.ownerDocument.defaultView!;node.focus();
 if(node instanceof win.HTMLTextAreaElement){Object.getOwnPropertyDescriptor(win.HTMLTextAreaElement.prototype,'value')!.set!.call(node,text);node.dispatchEvent(new win.Event('input',{bubbles:true}));}
 else if(node.isContentEditable||node.getAttribute('contenteditable')==='true'){
  const selection=win.getSelection(),range=node.ownerDocument.createRange();range.selectNodeContents(node);selection?.removeAllRanges();selection?.addRange(range);
  if(!node.ownerDocument.execCommand?.('insertText',false,text))throw new Error('Inserção nativa indisponível. Copie o texto para o composer.');
 }else throw new Error('Editor não reconhecido');
}
