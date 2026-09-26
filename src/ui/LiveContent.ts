/** Patch a readout without replacing the native control a player is using.
 * Handlers belong on the containing panel (event delegation). Details retain
 * their user-chosen expansion; focused fields retain their in-progress value.
 */
export function updateLiveContent(root:Element,html:string):void {
  const template=document.createElement('template');template.innerHTML=html;
  reconcile(root,template.content);
}

function key(node:Node):string {
  if(!(node instanceof Element))return node.nodeName;
  if(node.id)return node.tagName+'#'+node.id;
  const identity=[...node.attributes].filter(a=>a.name.startsWith('data-')).map(a=>a.name+'='+a.value).join('|');
  return node.tagName+':'+identity;
}

function reconcile(current:Node,desired:Node):void {
  let index=0;
  for(const next of [...desired.childNodes]){
    let old=current.childNodes[index];
    if(!old||key(old)!==key(next)){
      const match=[...current.childNodes].slice(index+1).find(n=>key(n)===key(next));
      if(match){current.insertBefore(match,old??null);old=match;}
      else{current.insertBefore(next.cloneNode(true),old??null);index++;continue;}
    }
    if(old instanceof Element&&next instanceof Element){
      const focused=old===document.activeElement;
      // Changing option children can close a native popup even if the select
      // itself survives. Options catch up after focus leaves it.
      if(old instanceof HTMLSelectElement&&focused){index++;continue;}
      for(const attribute of [...old.attributes]){
        if(attribute.name==='open'&&old instanceof HTMLDetailsElement)continue;
        if(focused&&['value','checked'].includes(attribute.name))continue;
        if(!next.hasAttribute(attribute.name))old.removeAttribute(attribute.name);
      }
      for(const attribute of [...next.attributes]){
        if(attribute.name==='open'&&old instanceof HTMLDetailsElement)continue;
        if(focused&&['value','checked'].includes(attribute.name))continue;
        if(old.getAttribute(attribute.name)!==attribute.value)old.setAttribute(attribute.name,attribute.value);
      }
      reconcile(old,next);
      if(old instanceof HTMLSelectElement&&!focused)old.value=(next as HTMLSelectElement).value;
      if(old instanceof HTMLInputElement&&!focused){old.value=(next as HTMLInputElement).value;old.checked=(next as HTMLInputElement).checked;}
    }else if(old.nodeValue!==next.nodeValue)old.nodeValue=next.nodeValue;
    index++;
  }
  while(current.childNodes.length>index)current.removeChild(current.lastChild!);
}
