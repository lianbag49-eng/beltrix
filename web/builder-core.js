import {hyperliquidBuilderParam,HYPERLIQUID_BUILDER_LIMITS} from './hyperliquid-venue.js';

export function formatBuilderRate(feeTenthsBp){
 const f=Number(feeTenthsBp);
 if(!Number.isInteger(f)||f<0)throw Error('Builder fee must be a non-negative integer');
 const value=(f/1000).toFixed(3).replace(/0+$/,'').replace(/\.$/,'');
 return `${value||'0'}%`;
}

export function validateBuilderConfig(config){
 const c=config&&typeof config==='object'?config:{};
 if(!c.enabled)return Object.freeze({enabled:false,address:null,perpFeeTenthsBp:0,spotFeeTenthsBp:0});
 const address=String(c.address||'').trim();
 if(!/^0x[0-9a-fA-F]{40}$/.test(address))throw Error('Enabled builder config requires a valid EVM address');
 const perpFeeTenthsBp=Number(c.perpFeeTenthsBp),spotFeeTenthsBp=Number(c.spotFeeTenthsBp);
 if(!Number.isInteger(perpFeeTenthsBp)||perpFeeTenthsBp<0||perpFeeTenthsBp>HYPERLIQUID_BUILDER_LIMITS.perp)throw Error('Invalid perp builder fee');
 if(!Number.isInteger(spotFeeTenthsBp)||spotFeeTenthsBp<0||spotFeeTenthsBp>HYPERLIQUID_BUILDER_LIMITS.spot)throw Error('Invalid spot builder fee');
 return Object.freeze({enabled:true,address,perpFeeTenthsBp,spotFeeTenthsBp});
}

export function requiredApprovalTenthsBp(config){
 const c=validateBuilderConfig(config);
 return c.enabled?Math.max(c.perpFeeTenthsBp,c.spotFeeTenthsBp):0;
}

export function builderForOrder(config,{spot=false,approvedTenthsBp=0}={}){
 const c=validateBuilderConfig(config);
 if(!c.enabled)return null;
 const fee=spot?c.spotFeeTenthsBp:c.perpFeeTenthsBp;
 if(fee<=0||Number(approvedTenthsBp)<fee)return null;
 return hyperliquidBuilderParam(c.address,fee,spot?'spot':'perp');
}
