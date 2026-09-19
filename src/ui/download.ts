/** Download locally generated text without using remote services. */
export function downloadText(name:string,text:string,type='application/json') {
 const url=URL.createObjectURL(new Blob([text],{type})),a=document.createElement('a');
 a.href=url;a.download=name;a.dataset.nagiOwned='download';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
}
