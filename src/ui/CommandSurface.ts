import {updateLiveContent} from './LiveContent';

/** Shared command hierarchy: header/tabs and primary controls never join the
 * detail scroll. Markup remains declarative; existing delegated actions survive. */
export function updateCommandSurface(panel:HTMLElement,html:string):void{
  const body=panel.querySelector<HTMLElement>('.position-content')!;
  let primary=panel.querySelector<HTMLElement>(':scope > .command-primary');
  if(!primary){primary=document.createElement('div');primary.className='command-primary';body.before(primary);}
  const template=document.createElement('template');template.innerHTML=html;
  const controls=[...template.content.querySelectorAll<HTMLElement>('[data-command-primary]')].filter(e=>!e.parentElement?.closest('[data-command-primary]'));
  const status=template.content.querySelector<HTMLElement>('.position-status');
  if(status&&!status.closest('[data-command-primary]'))controls.unshift(status);
  const commands=controls.map(e=>{e.remove();return e.outerHTML;}).join('');
  updateLiveContent(primary,commands);primary.hidden=!commands;
  updateLiveContent(body,template.innerHTML);
}
