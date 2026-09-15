// Educational isolated-margin model; no wallet calls or venue execution.
export const SEED=100000, FEE=0.0005;
export const initialPaper=()=>({cash:SEED,position:null,history:[]});
const positive=n=>Number.isFinite(n)&&n>0;
export function openPaper(state,{coin,side,margin,leverage,price}){
 if(state.position)throw Error('Close the current practice position first');
 if(!['BTC','ETH'].includes(coin)||!['long','short'].includes(side))throw Error('Invalid market or side');
 if(!positive(margin)||!positive(price)||!Number.isInteger(leverage)||leverage<1||leverage>20)throw Error('Enter positive margin and leverage from 1 to 20');
 const notional=margin*leverage,fee=notional*FEE;
 if(!Number.isFinite(notional)||margin+fee>state.cash)throw Error('Insufficient practice balance, including fee');
 return {...state,cash:state.cash-margin-fee,position:{coin,side,margin,leverage,entry:price,size:notional/price,entryFee:fee}};
}
export function paperPnl(position,price){
 if(!position||!positive(price))throw Error('Fresh price required');
 return (price-position.entry)*position.size*(position.side==='long'?1:-1);
}
export function closePaper(state,price){
 const p=state.position;if(!p)throw Error('No practice position');
 const gross=paperPnl(p,price),fee=p.size*price*FEE;
 const returned=Math.max(0,p.margin+gross-fee);
 if(!Number.isFinite(returned))throw Error('Invalid settlement');
 const record={...p,exit:price,pnl:returned-p.margin-p.entryFee,exitFee:fee,time:new Date().toISOString()};
 return {cash:state.cash+returned,position:null,history:[record,...state.history].slice(0,100)};
}
export function validPaper(s){
 if(!s||!Number.isFinite(s.cash)||s.cash<0||!Array.isArray(s.history))return false;
 if(s.position){const p=s.position;if(!['BTC','ETH'].includes(p.coin)||!['long','short'].includes(p.side)||!['margin','entry','size','entryFee'].every(k=>positive(p[k]))||!Number.isInteger(p.leverage)||p.leverage<1||p.leverage>20)return false;}
 return s.history.every(r=>Number.isFinite(r.pnl)&&typeof r.time==='string');
}
