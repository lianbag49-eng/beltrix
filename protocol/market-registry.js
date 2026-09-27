import {defineRiskPolicy} from './risk.js';

function id(value,name){
 const s=String(value||'').trim().toUpperCase();
 if(!/^[A-Z0-9][A-Z0-9:_-]{1,63}$/.test(s))throw Error(name+' is invalid');
 return s;
}

export function defineProtocolMarket(input={}){
 const marketId=id(input.id,'Market id');
 const base=id(input.base,'Base asset');
 const quote=id(input.quote||'USDC','Quote asset');
 const collateral=id(input.collateral||quote,'Collateral asset');
 const status=['active','paused','research'].includes(input.status)?input.status:'research';
 const settlementIds=Object.freeze([...new Set((input.settlements||[]).map(x=>String(x).trim().toLowerCase()).filter(Boolean))]);
 if(!settlementIds.length)throw Error('Market requires at least one settlement option');
 const oraclePolicy=Object.freeze({
  minSources:Number(input.oraclePolicy?.minSources??2),
  maxAgeMs:Number(input.oraclePolicy?.maxAgeMs??15000),
  maxDeviationBps:Number(input.oraclePolicy?.maxDeviationBps??100)
 });
 const riskPolicy=defineRiskPolicy(input.riskPolicy||{});
 return Object.freeze({
  id:marketId,
  base,
  quote,
  collateral,
  status,
  settlementIds,
  oraclePolicy,
  riskPolicy,
  metadata:Object.freeze({...input.metadata})
 });
}

export class ProtocolMarketRegistry{
 #markets=new Map();
 register(market){
  if(!market?.id)throw Error('Protocol market is required');
  if(this.#markets.has(market.id))throw Error('Market already registered: '+market.id);
  this.#markets.set(market.id,market);return market;
 }
 get(marketId){const m=this.#markets.get(String(marketId).toUpperCase());if(!m)throw Error('Unknown BELTRIX market: '+marketId);return m}
 list(){return [...this.#markets.values()]}
 active(){return this.list().filter(x=>x.status==='active')}
}

export const BOOTSTRAP_MARKETS=Object.freeze([
 defineProtocolMarket({
  id:'BTC-PERP',base:'BTC',quote:'USDC',collateral:'USDC',status:'active',
  settlements:['hyperliquid','beltrix-native'],
  oraclePolicy:{minSources:2,maxAgeMs:15000,maxDeviationBps:100},
  riskPolicy:{maxLeverage:50,maxOrderNotionalUsd:1000000,maxOpenInterestUsd:25000000,minOracleSources:2,maxOracleAgeMs:15000,maxOracleDeviationBps:100},
  metadata:{phase:'bootstrap',nativeSettlementEnabled:false}
 }),
 defineProtocolMarket({
  id:'ETH-PERP',base:'ETH',quote:'USDC',collateral:'USDC',status:'active',
  settlements:['hyperliquid','beltrix-native'],
  oraclePolicy:{minSources:2,maxAgeMs:15000,maxDeviationBps:100},
  riskPolicy:{maxLeverage:50,maxOrderNotionalUsd:1000000,maxOpenInterestUsd:25000000,minOracleSources:2,maxOracleAgeMs:15000,maxOracleDeviationBps:100},
  metadata:{phase:'bootstrap',nativeSettlementEnabled:false}
 }),
 defineProtocolMarket({
  id:'SOL-PERP',base:'SOL',quote:'USDC',collateral:'USDC',status:'active',
  settlements:['hyperliquid','beltrix-native'],
  oraclePolicy:{minSources:2,maxAgeMs:15000,maxDeviationBps:125},
  riskPolicy:{maxLeverage:30,maxOrderNotionalUsd:500000,maxOpenInterestUsd:10000000,minOracleSources:2,maxOracleAgeMs:15000,maxOracleDeviationBps:125},
  metadata:{phase:'bootstrap',nativeSettlementEnabled:false}
 })
]);
