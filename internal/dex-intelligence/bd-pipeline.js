export const BD_STAGES=Object.freeze([
 'lead','contacted','qualified','proposal','negotiation','contract','integration','active','revenue'
]);

export const PARTNER_TYPES=Object.freeze([
 'dex','cex','wallet','l1-l2','defi','market-maker','fund','kol','agency','community','infrastructure'
]);

export function normalizeBdLead(input={}){
 const stage=BD_STAGES.includes(input.stage)?input.stage:'lead';
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
