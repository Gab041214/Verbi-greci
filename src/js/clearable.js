/* Pulsante "gomma" dentro ogni campo di testo: compare solo quando il campo è compilato. */
const ICON='<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8.6 20H20"/><path d="M5.3 14.7 13 7a2 2 0 0 1 2.8 0l2.7 2.7a2 2 0 0 1 0 2.8L11.4 19.6a2 2 0 0 1-1.4.6H8.6a2 2 0 0 1-1.4-.6l-1.9-1.9a2 2 0 0 1 0-2.8Z"/><path d="m9 11 5.5 5.5"/></svg>';
const SKIP=new Set(['hidden','file','checkbox','radio','button','submit','reset','range','color','image','password']);
const eligible=el=>(el.tagName==='TEXTAREA'||(el.tagName==='INPUT'&&!SKIP.has((el.type||'text').toLowerCase())))&&!el.readOnly&&!el.disabled;

export function sync(el){
  const w=el&&el.closest&&el.closest('.fw');
  if(w)w.classList.toggle('has',el.value!=='');
}
function enhance(el){
  if(!eligible(el)||el.closest('.fw'))return;
  const w=document.createElement('span');w.className='fw';
  el.parentNode.insertBefore(w,el);w.appendChild(el);
  const b=document.createElement('button');
  b.type='button';b.className='clr';b.tabIndex=-1;
  b.setAttribute('aria-label','Svuota il campo');b.title='Svuota';b.innerHTML=ICON;
  b.addEventListener('mousedown',e=>e.preventDefault());   // non perde il focus
  b.addEventListener('click',()=>{
    el.value='';
    el.dispatchEvent(new Event('input',{bubbles:true}));
    sync(el);el.focus();
  });
  w.appendChild(b);sync(el);
}
function scan(root){
  if(root.nodeType!==1)return;
  if(root.matches&&root.matches('input,textarea'))enhance(root);
  root.querySelectorAll&&root.querySelectorAll('input,textarea').forEach(enhance);
}
export function initClearable(){
  /* aggiorna anche quando il valore cambia da codice (es. campo precompilato) */
  for(const C of [HTMLInputElement,HTMLTextAreaElement]){
    const d=Object.getOwnPropertyDescriptor(C.prototype,'value');
    Object.defineProperty(C.prototype,'value',{configurable:true,get(){return d.get.call(this);},set(v){d.set.call(this,v);sync(this);}});
  }
  document.addEventListener('input',e=>sync(e.target));
  document.addEventListener('reset',e=>setTimeout(()=>e.target.querySelectorAll('input,textarea').forEach(sync),0));
  scan(document.body);
  new MutationObserver(ms=>ms.forEach(m=>m.addedNodes.forEach(scan))).observe(document.body,{childList:true,subtree:true});
}
