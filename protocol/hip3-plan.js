import {expandSubDeployerPermissions} from './roles.js';

const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));

function requiredText(value,name){
 const s=String(value||'').trim();
 if(!s)throw Error(name+' is required');
 return s;
}

function requiredAddress(value,name){
 const s=requiredText(value,name).toLowerCase();
 if(!/^0x[0-9a-f]{40}$/.test(s))throw Error(name+' must be a 20-byte EVM address');
 return s;
}

function operation(variant,purpose,config){
 return Object.freeze({
  hyperliquidActionType:'perpDeploy',
  variant,
  purpose,
  config:Object.freeze({...config}),
  unsigned:true,
  requiresDeployerSignature:true,
  requiresHumanReview:true
 });
}

export function buildBeltrixHip3Plan({
 market,
 dexName,
 feeRecipient,
 oracleUpdater,
 marginTableId,
 openInterestCapUsd,
 fundingMultiplier=null,
 growthMode=null,
 annotation=null,
 roleGrants=[],
 szDecimals=null
}={}){
 if(!market?.id||!market?.riskPolicy||!market?.oraclePolicy)throw Error('BELTRIX protocol market is required');
 const dex=requiredText(dexName,'HIP-3 dexName');
 const fee=requiredAddress(feeRecipient,'HIP-3 feeRecipient');
 const oracle=requiredAddress(oracleUpdater,'HIP-3 oracleUpdater');
 const marginId=Number(marginTableId);
 if(!Number.isInteger(marginId)||marginId<=0)throw Error('HIP-3 marginTableId must be a positive integer');
 const oiCap=Number(openInterestCapUsd);
 if(!finite(oiCap)||oiCap<=0)throw Error('HIP-3 openInterestCapUsd must be positive');
 const maxLeverage=Number(market.riskPolicy.maxLeverage);
 if(!Number.isInteger(maxLeverage)||maxLeverage<1||maxLeverage>50)throw Error('HIP-3 max leverage must be 1-50');
 if(fundingMultiplier!==null&&(!finite(fundingMultiplier)||Number(fundingMultiplier)<0))throw Error('Invalid fundingMultiplier');
 const decimals=szDecimals===null?null:Number(szDecimals);
 if(decimals!==null&&(!Number.isInteger(decimals)||decimals<0||decimals>8))throw Error('Invalid szDecimals');

 const subDeployers=expandSubDeployerPermissions(roleGrants);
 const operations=[
  operation('registerAsset','Register the BELTRIX market inside the builder-deployed perp DEX',{
   dex,beltrixMarketId:market.id,base:market.base,quote:market.quote,
   collateral:market.collateral,maxLeverage,szDecimals:decimals
  }),
  operation('setOracle','Bind the BELTRIX oracle operating policy and updater role',{
   dex,beltrixMarketId:market.id,oracleUpdater:oracle,
   minSources:market.oraclePolicy.minSources,
   maxAgeMs:market.oraclePolicy.maxAgeMs,
   maxDeviationBps:market.oraclePolicy.maxDeviationBps
  }),
  operation('setMarginTableIds','Attach the approved BELTRIX margin configuration',{
   dex,beltrixMarketId:market.id,marginTableId:marginId,maxLeverage
  }),
  operation('setOpenInterestCaps','Apply BELTRIX market open-interest risk limits',{
   dex,beltrixMarketId:market.id,notionalCapUsd:oiCap
  }),
  operation('setFeeRecipient','Route deployer fee accounting to the approved BELTRIX recipient',{
   dex,feeRecipient:fee
  })
 ];

 if(subDeployers.length){
  operations.push(operation('setSubDeployers','Delegate narrowly scoped market-operation permissions',{
   dex,permissions:subDeployers
  }));
 }
 if(fundingMultiplier!==null){
  operations.push(operation('setFundingMultipliers','Apply the reviewed BELTRIX funding multiplier',{
   dex,beltrixMarketId:market.id,multiplier:Number(fundingMultiplier)
  }));
 }
 if(growthMode!==null){
  operations.push(operation('setGrowthModes','Apply the reviewed HIP-3 growth mode',{
   dex,beltrixMarketId:market.id,mode:growthMode
  }));
 }
 if(annotation!==null){
  operations.push(operation('setPerpAnnotation','Attach BELTRIX market metadata',{
   dex,beltrixMarketId:market.id,annotation:String(annotation)
  }));
 }

 return Object.freeze({
  protocol:'beltrix',
  mode:'hip3-hybrid',
  researchOnly:true,
  executionEnabled:false,
  dex,
  marketId:market.id,
  externalSubstrate:'hyperliquid-hypercore',
  beltrixOwnedLayers:Object.freeze([
   'market-definition','oracle-policy','risk-policy','role-policy',
   'fee-recipient-policy','market-intelligence','user-intent'
  ]),
  inheritedLayers:Object.freeze(['matching','margining','settlement-consensus']),
  operations:Object.freeze(operations),
  warnings:Object.freeze([
   'This is an unsigned deployment plan, not a valid broadcast payload.',
   'Mainnet deployment requires separate stake/capital and deployer-signature review.',
   'Oracle operation, incident recovery and testnet E2E must be validated before user funds.'
  ])
 });
}
