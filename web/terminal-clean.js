/** Presentation only. One bottom navigation; original order nodes/signatures stay intact. */
const $=id=>document.getElementById(id);
function mount(){
 if(document.documentElement.dataset.cleanTerminal)return true;
 const bottom=document.querySelector('.bottom-nav'),top=document.querySelector('.top'),root=$('markets'),toolbar=root?.querySelector('.simple-trade-toolbar'),bar=$('fastOrderBar');
 if(!bottom||!top||!toolbar||!bar)return false;
 document.documentElement.dataset.cleanTerminal='v1';
 const old=document.querySelector('.nav');if(old){old.hidden=true;old.setAttribute('aria-hidden','true');}
 bottom.setAttribute('aria-label','Main navigation');
 const trade=bottom.querySelector('[data-page="markets"]');
 if(trade){for(const n of [...trade.childNodes])if(n.nodeType===Node.TEXT_NODE)n.textContent='Trade';}
 const more=document.createElement('button');more.type='button';more.id='cleanMore';more.className='clean-icon-button';more.textContent='⋯';more.setAttribute('aria-label','More app options');top.append(more);
 const menu=document.createElement('dialog');menu.id='cleanMoreDialog';menu.className='clean-more-dialog';
 menu.innerHTML='<div class="clean-menu-head"><strong>More</strong><button type="button" data-clean-close aria-label="Close app options">×</button></div><button type="button" data-clean-route="swap">Practice · no real funds</button><button type="button" data-clean-route="settings">Settings</button><p>Trading and transfers always require a separate review and wallet approval.</p>';
 document.body.append(menu);more.onclick=()=>menu.showModal();menu.querySelector('[data-clean-close]').onclick=()=>menu.close();
 menu.addEventListener('click',e=>{const b=e.target.closest('[data-clean-route]');if(!b)return;menu.close();window.openPage?.(b.dataset.cleanRoute);});
 const chart=document.createElement('button');chart.type='button';chart.id='cleanOpenChart';chart.className='clean-icon-button';chart.setAttribute('aria-label','Open expanded chart');chart.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 3v18M3 7h4v9H3zM12 2v20M10 5h4v8h-4zM19 4v16M17 11h4v6h-4z"/></svg>';
 toolbar.insertBefore(chart,$('tradeLayoutMode'));chart.onclick=()=>window.dispatchEvent(new CustomEvent('beltrix:chart-open',{detail:{expanded:true}}));
 const side=bar.querySelector('[aria-label="Order direction"]'),marker=document.createComment('clean-side-home');side.before(marker);
 const hint=$('futuresModeHint'),hintHome=document.createComment('clean-hint-home');hint.before(hintHome);
 function sync(){
  const simple=root.dataset.tradeLayout==='simple';
  if(simple){const fields=$('simpleOrderOptions')?.querySelector('.simple-option-fields');if(fields&&!fields.contains(side))fields.prepend(side);if(!$('futuresExtra').contains(hint))$('futuresExtra').append(hint);}
  else {if(side.previousSibling!==marker)marker.after(side);if(hint.previousSibling!==hintHome)hintHome.after(hint);}
 }
 new MutationObserver(sync).observe(root,{attributes:true,attributeFilter:['data-trade-layout']});sync();
 return true;
}
if(!mount()){
 const observer=new MutationObserver(()=>{if(mount())observer.disconnect();});observer.observe(document.body,{childList:true,subtree:true});
}
