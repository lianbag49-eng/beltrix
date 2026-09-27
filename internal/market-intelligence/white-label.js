export const WHITE_LABEL_MATRIX=Object.freeze([
 {venue:'hyperliquid',model:'Custom BELTRIX frontend',turnkey:false,sharedLiquidity:true,customFees:'Builder Codes after explicit user approval',multiChain:false,role:'Primary BELTRIX product'},
 {venue:'orderly',model:'Orderly One / DEX Creator + SDK/API',turnkey:true,sharedLiquidity:true,customFees:'Builder-controlled user fees over current base economics',multiChain:true,role:'Primary second-brand / regional white-label candidate'},
 {venue:'gmx',model:'Open-source/custom frontend',turnkey:false,sharedLiquidity:true,customFees:'UI fee receiver + referral',multiChain:true,role:'Pool-based alternative integration'},
 {venue:'dydx',model:'Custom app / open protocol integration',turnkey:false,sharedLiquidity:true,customFees:'Affiliate economics; custom frontend fee model requires validation',multiChain:false,role:'Affiliate/appchain benchmark'},
 {venue:'paradex',model:'Custom API integration',turnkey:false,sharedLiquidity:true,customFees:'Attribution strong; frontend fee share not confirmed',multiChain:false,role:'Attribution/portfolio-margin benchmark'},
 {venue:'aster',model:'Custom Builder / Agent API integration',turnkey:false,sharedLiquidity:true,customFees:'Builder + feeRate with user approval model',multiChain:false,role:'Builder-system candidate'},
 {venue:'drift',model:'Solana SDK integration',turnkey:false,sharedLiquidity:true,customFees:'Current partner economics require validation',multiChain:false,role:'Solana execution research'},
 {venue:'aevo',model:'API integration',turnkey:false,sharedLiquidity:true,customFees:'Builder/UI fee model not confirmed',multiChain:false,role:'Options/structured-product research'}
]);
export function whiteLabelFor(id){return WHITE_LABEL_MATRIX.find(x=>x.venue===id)||null}
