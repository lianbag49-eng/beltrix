export const SETTLEMENT_CAPABILITIES=Object.freeze({
 PERPS:'perps',
 SPOT:'spot',
 NON_CUSTODIAL:'non-custodial',
 EXTERNAL_BOOTSTRAP:'external-bootstrap',
 BELTRIX_MARKETS:'beltrix-markets',
 NATIVE_SETTLEMENT:'native-settlement',
 ONCHAIN_CONFIG:'onchain-config'
});

function slug(value,name){
 const s=String(value||'').trim().toLowerCase();
 if(!/^[a-z0-9][a-z0-9-]{1,39}$/.test(s))throw Error(name+' must be a lowercase slug');
 return s;
}

export function defineSettlementAdapter(input={}){
 const id=slug(input.id,'Settlement id');
 const label=String(input.label||'').trim();
 if(!label)throw Error('Settlement label is required');
 const capabilities=Object.freeze([...new Set((input.capabilities||[]).map(String))]);
 const status=['live','test','research'].includes(input.status)?input.status:'research';
 if(typeof input.prepareIntent!=='function')throw Error('Settlement prepareIntent is required');
 return Object.freeze({...input,id,label,status,capabilities});
}

export class SettlementRegistry{
 #rows=new Map();
 register(adapter){
  if(this.#rows.has(adapter.id))throw Error('Settlement already registered: '+adapter.id);
  this.#rows.set(adapter.id,adapter);return adapter;
 }
 get(id){const x=this.#rows.get(String(id));if(!x)throw Error('Unknown settlement: '+id);return x}
 list(){return [...this.#rows.values()]}
 available({capabilities=[],status}={}){
  return this.list().filter(x=>(!status||x.status===status)&&capabilities.every(c=>x.capabilities.includes(c)));
 }
}
