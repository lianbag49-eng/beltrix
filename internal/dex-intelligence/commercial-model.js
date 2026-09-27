export const COMMERCIAL_MODELS=Object.freeze([
 {
  venue:'hyperliquid',
  checkedAt:'2026-09-27',
  frontendRevenue:['builder fees','referral rewards'],
  affiliate:true,
  whiteLabel:false,
  feeControl:'Builder fee is user-approved and attached per order.',
  notes:'BELTRIX baseline. Keep current public execution here until another venue passes qualification.',
  sources:[
   'https://hyperliquid.gitbook.io/hyperliquid-docs/trading/builder-codes',
   'https://hyperliquid.gitbook.io/hyperliquid-docs/referrals'
  ]
 },
 {
  venue:'orderly',
  checkedAt:'2026-09-27',
  frontendRevenue:['builder/broker fees','affiliate/referral programs'],
  affiliate:true,
  whiteLabel:true,
  feeControl:'Builder controls branded DEX economics through the Orderly stack.',
  notes:'Strongest current turnkey/shared-liquidity white-label candidate in this comparison.',
  sources:[
   'https://orderly.network/',
   'https://dex-api.orderly.network/',
   'https://orderly.network/blog/create-a-perp-dex'
  ]
 },
 {
  venue:'gmx',
  checkedAt:'2026-09-27',
  frontendRevenue:['UI fees','affiliate rewards'],
  affiliate:true,
  whiteLabel:true,
  feeControl:'UI fee factor is configured for the receiver and applied on supported actions, subject to protocol maximum.',
  notes:'Referral rewards apply to position fees. Public referral tiers currently document 5%-15% affiliate rewards.',
  sources:[
   'https://docs.gmx.io/docs/api/frontend-integration/',
   'https://docs.gmx.io/docs/api/contracts/fees/',
   'https://docs.gmx.io/docs/referrals/'
  ]
 },
 {
  venue:'paradex',
  checkedAt:'2026-09-27',
  frontendRevenue:['referral attribution'],
  affiliate:true,
  whiteLabel:false,
  feeControl:'Market fee configuration is venue-controlled; onboarding supports attribution fields.',
  notes:'Useful benchmark for API attribution. Public WebSocket market data now requires SBE.',
  sources:[
   'https://docs.paradex.trade/api/prod/markets/get-markets',
   'https://docs.paradex.trade/ws/general-information'
  ]
 },
 {
  venue:'dydx',
  checkedAt:'2026-09-27',
  frontendRevenue:['affiliate/referral'],
  affiliate:true,
  whiteLabel:false,
  feeControl:'Protocol/indexer integration; not treated as turnkey white-label here.',
  notes:'Strong CLOB/indexer benchmark for independent execution infrastructure.',
  sources:[
   'https://indexer.dydx.trade/docs/'
  ]
 },
 {
  venue:'drift',
  checkedAt:'2026-09-27',
  frontendRevenue:[],
  affiliate:false,
  whiteLabel:false,
  feeControl:'Not yet normalized in BELTRIX intelligence.',
  notes:'Watchlist until public data, commercial model and execution path are normalized.',
  sources:[
   'https://docs.drift.trade/'
  ]
 }
]);

export function commercialByVenue(id){
 return COMMERCIAL_MODELS.find(x=>x.venue===id)||null;
}
