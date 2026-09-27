import {VENUES} from './venue-registry.js';

export const BD_FIELDS=Object.freeze([
 'integration',
 'revenue',
 'whiteLabel',
 'sharedLiquidity',
 'executionCandidate',
 'marketModel',
 'dataStatus'
]);

export function bdMatrix(){
 return VENUES.map(v=>Object.freeze({
  id:v.id,
  name:v.name,
  role:v.role,
  integration:v.integration.join(', '),
  revenue:v.revenue.join(', ')||'none documented here',
  whiteLabel:v.whiteLabel,
  sharedLiquidity:v.sharedLiquidity,
  executionCandidate:v.executionCandidate,
  marketModel:v.marketModel,
  dataStatus:v.dataStatus,
  docs:[...v.docs]
 }));
}

export function compareByRequirement(requirement){
 const key=String(requirement||'');
 if(!BD_FIELDS.includes(key))throw Error('Unsupported BD comparison field: '+key);
 return bdMatrix().map(row=>({venue:row.name,value:row[key]}));
}
