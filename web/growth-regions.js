export const GROWTH_REGIONS=Object.freeze({
 cis:Object.freeze({
  languages:['ru','en'],
  primaryChannels:['telegram','vk','youtube','short-video','seo'],
  secondaryChannels:['x'],
  kpi:['activated_trader','retained_7d','volume_30d','fee_revenue','net_contribution']
 }),
 chineseSpeaking:Object.freeze({
  languages:['zh-Hant','zh-Hans','en'],
  primaryChannels:['youtube','x','telegram','discord','instagram','threads'],
  secondaryChannels:['seo'],
  kpi:['activated_trader','retained_7d','volume_30d','fee_revenue','net_contribution']
 })
});

export function campaignDimensions(input={}){
 const text=(v,max=96)=>typeof v==='string'&&v.trim()?v.trim().slice(0,max):null;
 return Object.freeze({
  region:text(input.region,32),
  language:text(input.language,16),
  source:text(input.source,32),
  medium:text(input.medium,32),
  campaign:text(input.campaign),
  creatorId:text(input.creatorId),
  referralId:text(input.referralId)
 });
}

export function creatorEconomics({spend=0,activatedTraders=0,feeRevenue=0,payout=0}={}){
 const s=Number(spend)||0,a=Number(activatedTraders)||0,f=Number(feeRevenue)||0,p=Number(payout)||0;
 return Object.freeze({
  costPerActivatedTrader:a>0?s/a:null,
  grossContribution:f,
  netContribution:f-s-p
 });
}
