export const VENUES=Object.freeze([
 {
  id:'hyperliquid',
  name:'Hyperliquid',
  role:'baseline',
  marketModel:'clob',
  integration:['api','websocket','builder-code','hip-3'],
  chains:['Hyperliquid L1'],
  revenue:['builder-fee','referral'],
  whiteLabel:false,
  sharedLiquidity:true,
  executionCandidate:true,
  dataStatus:'live-public',
  docs:[
   'https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api',
   'https://hyperliquid.gitbook.io/hyperliquid-docs/trading/builder-codes',
   'https://hyperliquid.gitbook.io/hyperliquid-docs/hyperliquid-improvement-proposals-hips/hip-3-builder-deployed-perpetuals'
  ]
 },
 {
  id:'orderly',
  name:'Orderly',
  role:'candidate',
  marketModel:'shared-clob',
  integration:['rest','websocket','sdk','white-label'],
  chains:['multichain'],
  revenue:['builder-fee','broker-fee','affiliate'],
  whiteLabel:true,
  sharedLiquidity:true,
  executionCandidate:true,
  dataStatus:'live-public',
  docs:[
   'https://orderly.network/',
   'https://dex-api.orderly.network/',
   'https://orderly.network/blog/create-a-perp-dex'
  ]
 },
 {
  id:'gmx',
  name:'GMX',
  role:'candidate',
  marketModel:'oracle-liquidity-pool',
  integration:['contracts','sdk','custom-frontend'],
  chains:['Arbitrum','Avalanche','MegaETH'],
  revenue:['ui-fee','referral'],
  whiteLabel:true,
  sharedLiquidity:false,
  executionCandidate:true,
  dataStatus:'public-api',
  docs:[
   'https://docs.gmx.io/docs/api/frontend-integration/',
   'https://docs.gmx.io/docs/api/contracts/fees/',
   'https://docs.gmx.io/docs/referrals/'
  ]
 },
 {
  id:'paradex',
  name:'Paradex',
  role:'candidate',
  marketModel:'clob',
  integration:['rest','sbe-websocket','api-onboarding'],
  chains:['Starknet appchain'],
  revenue:['referral'],
  whiteLabel:false,
  sharedLiquidity:true,
  executionCandidate:true,
  dataStatus:'live-public',
  docs:[
   'https://docs.paradex.trade/api/prod/markets/get-markets',
   'https://docs.paradex.trade/api/prod/markets/get-orderbook',
   'https://docs.paradex.trade/ws/general-information'
  ]
 },
 {
  id:'dydx',
  name:'dYdX',
  role:'candidate',
  marketModel:'clob',
  integration:['indexer-rest','websocket','chain'],
  chains:['dYdX Chain'],
  revenue:['affiliate'],
  whiteLabel:false,
  sharedLiquidity:true,
  executionCandidate:true,
  dataStatus:'live-public',
  docs:[
   'https://indexer.dydx.trade/docs/',
   'https://docs.dydx.xyz/'
  ]
 },
 {
  id:'drift',
  name:'Drift',
  role:'watchlist',
  marketModel:'hybrid-dlob-amm',
  integration:['sdk','solana'],
  chains:['Solana'],
  revenue:[],
  whiteLabel:false,
  sharedLiquidity:true,
  executionCandidate:false,
  dataStatus:'metadata-watch',
  docs:[
   'https://docs.drift.trade/'
  ]
 }
]);

export function venueById(id){
 const venue=VENUES.find(v=>v.id===String(id));
 if(!venue)throw Error('Unknown DEX venue: '+id);
 return venue;
}

export function internalExecutionCandidates(){
 return VENUES.filter(v=>v.executionCandidate);
}

export function whiteLabelCandidates(){
 return VENUES.filter(v=>v.whiteLabel);
}
