import {getStoredAttribution,getGrowthQueue} from './attribution-client.js';
import {buildPartnerLink,summarizeGrowthEvents} from './partners-core.js';

const $=id=>document.getElementById(id);
function setText(id,value){const el=$(id);if(el)el.textContent=value??'—'}

function baseUrl(){
 const u=new URL(location.href);
 u.hash='';u.search='';
 return u.toString();
}

function render(){
 const a=getStoredAttribution()||{};
 setText('partnerCurrentReferral',a.referral||'None');
 setText('partnerCurrentSource',a.source||'Direct / none');
 setText('partnerCurrentCampaign',a.campaign||'None');
 setText('partnerCurrentRegion',a.region||'Unknown');
 const s=summarizeGrowthEvents(getGrowthQueue());
 setText('partnerPageViews',s.pageViews);
 setText('partnerWallets',s.walletConnections);
 setText('partnerOrders',s.confirmedOrders);
 setText('partnerApprovals',s.builderApprovals);
 setText('partnerEvents',s.total);
}

function generate(){
 try{
  const url=buildPartnerLink({
   baseUrl:baseUrl(),
   code:$('partnerCode').value,
   source:$('partnerSource').value,
   campaign:$('partnerCampaign').value,
   language:$('partnerLanguage').value,
   region:$('partnerRegion').value
  });
  $('partnerLink').value=url;
  setText('partnerMessage','Link ready. Server-side commission and payout accounting will be added in the backend phase.');
 }catch(e){
  $('partnerLink').value='';
  setText('partnerMessage',e.message||'Unable to build link');
 }
}

$('partnerGenerate')?.addEventListener('click',generate);
$('partnerCopy')?.addEventListener('click',async()=>{
 const value=$('partnerLink')?.value;
 if(!value)return setText('partnerMessage','Generate a link first.');
 try{await navigator.clipboard.writeText(value);setText('partnerMessage','Partner link copied.')}
 catch{setText('partnerMessage','Clipboard unavailable. Select and copy the link manually.')}
});
for(const id of ['partnerCode','partnerSource','partnerCampaign','partnerLanguage','partnerRegion']){
 $(id)?.addEventListener('input',()=>{if($('partnerLink').value)generate()});
}
window.addEventListener('beltrix:growth-event',render);
window.addEventListener('beltrix:attribution',render);
window.addEventListener('beltrix:page',e=>{if(e.detail==='partners')render()});
render();
