export const BD_STAGES=Object.freeze([
 'research','lead','contact-ready','contacted','qualified','proposal','negotiation','contract','integration','active','revenue'
]);

export const PARTNER_TYPES=Object.freeze([
 'dex','cex','wallet','l1-l2','defi','market-maker','fund','kol','agency','community','infrastructure'
]);

export function normalizeBdLead(input={}){
 const stage=BD_STAGES.includes(input.stage)?input.stage:'research';
 const type=PARTNER_TYPES.includes(input.type)?input.type:'infrastructure';
 const list=v=>Array.isArray(v)?v.map(x=>String(x).trim()).filter(Boolean).slice(0,50):[];
 return Object.freeze({
  id:String(input.id||'').trim(),
  name:String(input.name||'').trim(),
  venueId:String(input.venueId||'').trim()||null,
  type,
  stage,
  owner:String(input.owner||'').trim()||null,
  region:String(input.region||'').trim()||null,
  contacts:list(input.contacts),
  objectives:list(input.objectives),
  nextAction:String(input.nextAction||'').trim()||null,
  nextActionAt:input.nextActionAt||null,
  notes:String(input.notes||'').trim().slice(0,4000),
  updatedAt:input.updatedAt||new Date().toISOString()
 });
}

export function bdStageProgress(stage){
 const i=BD_STAGES.indexOf(stage);
 return i<0?0:i/(BD_STAGES.length-1);
}

export function nextActionState(lead,now=new Date()){
 if(!lead?.nextActionAt)return 'unscheduled';
 const due=new Date(lead.nextActionAt);
 if(Number.isNaN(due.getTime()))return 'invalid';
 const today=new Date(now);
 const delta=due.getTime()-today.getTime();
 if(delta<0)return 'overdue';
 if(delta<=72*60*60*1000)return 'due-soon';
 return 'scheduled';
}

export const INITIAL_BD_PIPELINE=Object.freeze([
 normalizeBdLead({
  id:'venue-orderly',
  name:'Orderly',
  venueId:'orderly',
  type:'infrastructure',
  stage:'contact-ready',
  objectives:['white-label','shared liquidity','builder economics','broker fee controls'],
  nextAction:'Request current builder economics, production limits and migration terms',
  nextActionAt:'2026-09-30T09:00:00+09:00',
  notes:'Desk research complete enough for first commercial conversation; no outreach is recorded here.'
 }),
 normalizeBdLead({
  id:'venue-gmx',
  name:'GMX',
  venueId:'gmx',
  type:'dex',
  stage:'research',
  objectives:['custom frontend','UI fee economics','referral ownership','pool execution model'],
  nextAction:'Normalize trading-capacity and pool-impact data before BD outreach',
  nextActionAt:'2026-10-02T09:00:00+09:00'
 }),
 normalizeBdLead({
  id:'venue-paradex',
  name:'Paradex',
  venueId:'paradex',
  type:'dex',
  stage:'research',
  objectives:['API attribution','CLOB benchmark','institutional onboarding'],
  nextAction:'Document auth, rate limits and testnet order lifecycle',
  nextActionAt:'2026-10-03T09:00:00+09:00'
 }),
 normalizeBdLead({
  id:'venue-dydx',
  name:'dYdX',
  venueId:'dydx',
  type:'dex',
  stage:'research',
  objectives:['indexer benchmark','CLOB execution','institutional API'],
  nextAction:'Document signing, order lifecycle and failure recovery',
  nextActionAt:'2026-10-03T09:00:00+09:00'
 }),
 normalizeBdLead({
  id:'venue-hyperliquid',
  name:'Hyperliquid',
  venueId:'hyperliquid',
  type:'dex',
  stage:'active',
  objectives:['baseline execution','builder codes','HIP-3 research'],
  nextAction:'Keep BELTRIX public execution baseline isolated from competitor research',
  nextActionAt:null,
  notes:'Active means product integration, not a claimed commercial partnership.'
 })
]);
