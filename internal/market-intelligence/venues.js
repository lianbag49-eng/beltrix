export const MARKET_INTELLIGENCE_AS_OF='2026-09-27';

export const VENUES=Object.freeze([
 {
  id:'hyperliquid',name:'Hyperliquid',category:'L1 CLOB / Perps + Spot',chains:['Hyperliquid L1'],
  metrics:{perpVolume30d:240168000000,openInterest:7135000000,source:'DefiLlama',retrieved:'2026-09-27'},
  fees:{makerBasePct:0.015,takerBasePct:0.045,notes:'Rolling 14d tiers; maker rebates can reach -0.003%. Spot has a separate schedule.'},
  economics:{
   referral:'10% of referred user fees less user discount; referral reward eligibility applies to first $1B referred-user volume.',
   frontendRevenue:'Builder codes: per-order builder fee after explicit user approval; documented cap 0.1% perps / 1% spot.',
   whiteLabel:'Custom frontend is practical. HIP-3 adds builder-deployed perp markets, but it is not a turnkey hosted white-label product.'
  },
  integration:{publicApi:true,websocket:true,customFrontend:true,turnkeyDexCreator:false,orderRouting:true},
  bd:{path:'Hyperliquid API trader / builder ecosystem; technical integration via official docs and API-traders community.',status:'active-core'},
  useCases:['BELTRIX primary execution','Builder-code monetization','Referral acquisition','HIP-3 research'],
  cautions:['Builder fee requires explicit main-wallet approval.','Jurisdiction and product restrictions must be handled by BELTRIX policy.'],
  sources:[
   {label:'Fees',url:'https://hyperliquid.gitbook.io/hyperliquid-docs/trading/fees'},
   {label:'Builder codes',url:'https://hyperliquid.gitbook.io/hyperliquid-docs/trading/builder-codes'},
   {label:'Referrals',url:'https://hyperliquid.gitbook.io/hyperliquid-docs/referrals'},
   {label:'Market metrics',url:'https://defillama.com/protocol/hyperliquid'}
  ]
 },
 {
  id:'orderly',name:'Orderly',category:'Omnichain CLOB Infrastructure',chains:['Orderly Network','Multi-chain builder distribution'],
  metrics:{perpVolume30d:1257000000,openInterest:42300000,source:'DefiLlama',retrieved:'2026-09-27'},
  fees:{makerBasePct:null,takerBasePct:null,notes:'Builders set user-facing rates; base fees are tier-based. Builder onboarding gives a default example of 0.03% maker / 0.06% taker.'},
  economics:{
   referral:'Builder stack supports referral systems and growth programs.',
   frontendRevenue:'Builder earns the difference between configured user-facing fees and Orderly base fees, subject to current builder terms.',
   whiteLabel:'Strong direct white-label candidate: DEX Creator API, broker creation, hosted/custom frontend and fee configuration.'
  },
  integration:{publicApi:true,websocket:true,customFrontend:true,turnkeyDexCreator:true,orderRouting:true},
  bd:{path:'Builder registration / affiliate onboarding / Orderly One DEX Creator.',status:'review'},
  useCases:['White-label fallback','Multi-chain distribution','Fast new DEX launch','Campaign/referral infrastructure'],
  cautions:['Shared-liquidity dependency.','Builder economics must be re-verified against current base fee tiers before a deal.'],
  sources:[
   {label:'Orderly One API',url:'https://dex-api.orderly.network/'},
   {label:'Builder onboarding',url:'https://orderly.network/docs/build-on-omnichain/affiliate-onboarding'},
   {label:'FAQ',url:'https://orderly.network/faq'},
   {label:'Market metrics',url:'https://defillama.com/protocol/orderly-perps'}
  ]
 },
 {
  id:'gmx',name:'GMX',category:'Onchain Perps / Liquidity Pools',chains:['Arbitrum','Avalanche','MegaETH'],
  metrics:{perpVolume30d:2607000000,openInterest:21530000,source:'DefiLlama GMX V2',retrieved:'2026-09-27'},
  fees:{makerBasePct:null,takerBasePct:null,notes:'Protocol fees are action/market dependent; integrations may configure an additional UI fee within protocol caps.'},
  economics:{
   referral:'Public affiliate tiers document 5%-15% affiliate rewards and 5%-10% trader discounts on position fees.',
   frontendRevenue:'Custom frontends can pass uiFeeReceiver and claim UI fees; position orders can also carry referral attribution.',
   whiteLabel:'Open-source/custom frontend is supported, but this is integration infrastructure rather than a turnkey DEX Creator product.'
  },
  integration:{publicApi:true,websocket:false,customFrontend:true,turnkeyDexCreator:false,orderRouting:true},
  bd:{path:'GMX Partners / onchain referral registration / custom frontend integration.',status:'review'},
  useCases:['Alternative onchain execution','UI-fee revenue','Referral partnership','Liquidity-model benchmark'],
  cautions:['Execution model differs materially from CLOB venues.','Gas/execution fee and market-specific pricing need normalization.'],
  sources:[
   {label:'Frontend integration',url:'https://docs.gmx.io/docs/api/frontend-integration/'},
   {label:'Fees',url:'https://docs.gmx.io/docs/api/contracts/fees/'},
   {label:'Referrals',url:'https://docs.gmx.io/docs/referrals/'},
   {label:'Market metrics',url:'https://defillama.com/protocol/gmx-v2-perps'}
  ]
 },
 {
  id:'dydx',name:'dYdX v4',category:'Appchain CLOB Perps',chains:['dYdX Chain'],
  metrics:{perpVolume30d:1158000000,openInterest:35820000,source:'DefiLlama',retrieved:'2026-09-27'},
  fees:{makerBasePct:null,takerBasePct:null,notes:'Maker/taker fee tiers are governance-controlled and volume-tiered; verify the current fee tier at integration time.'},
  economics:{
   referral:'2026 affiliate program documents lifetime commissions, real-time onchain USDC payouts and volume-based tiers up to 50% of taker fees.',
   frontendRevenue:'Affiliate economics are clear; custom frontend monetization requires separate technical/commercial validation.',
   whiteLabel:'Open-source chain/front-end ecosystem is integrable, but no turnkey DEX-creator product was identified in this review.'
  },
  integration:{publicApi:true,websocket:true,customFrontend:true,turnkeyDexCreator:false,orderRouting:true},
  bd:{path:'Affiliate program + open-source/indexer/node integration ecosystem.',status:'review'},
  useCases:['Affiliate comparison','Independent appchain execution benchmark','CLOB API benchmark'],
  cautions:['Governance can change fees and limits.','Affiliate program excludes listed restricted jurisdictions.'],
  sources:[
   {label:'Affiliate FAQ',url:'https://help.dydx.trade/en/articles/240149-affiliate-program-faq'},
   {label:'Trading fees',url:'https://help.dydx.trade/en/articles/166995-trading-fees-on-dydx'},
   {label:'Market metrics',url:'https://defillama.com/protocol/dydx-v4'}
  ]
 },
 {
  id:'paradex',name:'Paradex',category:'Starknet Appchain Derivatives',chains:['Paradex','Ethereum bridge'],
  metrics:{perpVolume30d:301590000,openInterest:8650000,source:'DefiLlama protocol page',retrieved:'2026-09-27',warning:'Public aggregator pages have shown materially different OI snapshots; verify directly before a commercial decision.'},
  fees:{makerBasePct:0,takerBasePct:0,notes:'Current docs state retail maker/taker fees are 0% for perps/spot; Pro API maker fee is documented separately (0.003%).'},
  economics:{
   referral:'Onboarding API accepts referral_code, marketing_code and UTM fields. Standard referral program is XP-based.',
   frontendRevenue:'Strong attribution surfaces; direct frontend fee-share is not established by the current public docs reviewed.',
   whiteLabel:'API-friendly but no turnkey white-label creator product identified in this review.'
  },
  integration:{publicApi:true,websocket:true,customFrontend:true,turnkeyDexCreator:false,orderRouting:true},
  bd:{path:'Paradex affiliate/referral + API onboarding/marketing attribution.',status:'watch'},
  useCases:['Marketing attribution benchmark','Portfolio-margin benchmark','Starknet execution research'],
  cautions:['Historical TAP affiliate campaign ended in 2026; do not model it as a current recurring payout.','Verify OI/liquidity directly because aggregator snapshots disagree.'],
  sources:[
   {label:'Onboarding',url:'https://docs.paradex.trade/api/prod/authentication/onboarding'},
   {label:'Trading fees',url:'https://docs.paradex.trade/trading/trading-fees'},
   {label:'Affiliate/referrals',url:'https://docs.paradex.trade/docs/xp-referrals/affiliate-referrals'},
   {label:'Market metrics',url:'https://defillama.com/protocol/paradex-perps'}
  ]
 },
 {
  id:'drift',name:'Drift',category:'Solana Perps / Cross-margin',chains:['Solana'],
  metrics:{perpVolume30d:null,openInterest:null,source:'Public tracker review',retrieved:'2026-09-27',warning:'Current DefiLlama Drift perp-volume/OI surfaces are inconsistent or report zero/blank. Treat current market-size fields as unavailable pending direct protocol telemetry.'},
  fees:{makerBasePct:null,takerBasePct:null,notes:'Current protocol docs expose fee/keeper mechanics; exact live user fee schedule should be read from protocol state/current docs before comparison.'},
  economics:{
   referral:'Not confirmed in this review; keep as a BD due-diligence item.',
   frontendRevenue:'Keeper incentives exist for order matching; no public turnkey frontend-revenue mechanism confirmed in this pass.',
   whiteLabel:'SDK/protocol integration candidate, not a turnkey white-label candidate based on reviewed public material.'
  },
  integration:{publicApi:true,websocket:true,customFrontend:true,turnkeyDexCreator:false,orderRouting:true},
  bd:{path:'Protocol/SDK ecosystem; direct partnership terms require outreach.',status:'data-review'},
  useCases:['Solana execution benchmark','Keeper architecture benchmark','Risk engine comparison'],
  cautions:['Do not use current DefiLlama zero volume as evidence of zero protocol activity.','Direct protocol-state telemetry required before liquidity ranking.'],
  sources:[
   {label:'Keeper incentives',url:'https://docs.drift.trade/protocol/about-v3/keepers/keeper-incentives'},
   {label:'Current protocol tracker',url:'https://defillama.com/protocol/drift'}
  ]
 },
 {
  id:'aevo',name:'Aevo',category:'OP Stack Derivatives / Options + Perps',chains:['Aevo L2','Ethereum settlement ecosystem'],
  metrics:{perpVolume30d:116750000,openInterest:13240000,source:'DefiLlama',retrieved:'2026-09-27'},
  fees:{makerBasePct:null,takerBasePct:null,notes:'Product-specific fee schedules. Options docs show 0.03% maker / 0.05% taker; perps must be checked separately.'},
  economics:{
   referral:'Current docs advertise Exchange Referrals; exact payout terms should be verified before BD modeling.',
   frontendRevenue:'No public builder/UI-fee mechanism confirmed in this review.',
   whiteLabel:'API/MCP integration is technically interesting; no turnkey white-label DEX creator identified.'
  },
  integration:{publicApi:true,websocket:true,customFrontend:true,turnkeyDexCreator:false,orderRouting:true},
  bd:{path:'Exchange support / referral program / API and MCP integration channels.',status:'watch'},
  useCases:['Options differentiation','Structured-product research','AI/MCP integration benchmark'],
  cautions:['Perps liquidity is much smaller than Hyperliquid in current public snapshots.','Do not reuse options fee schedule as perp fees.'],
  sources:[
   {label:'Current product docs',url:'https://docs.aevo.xyz/'},
   {label:'Market metrics',url:'https://defillama.com/protocol/aevo'},
   {label:'Options fees',url:'https://docs.aevo.xyz/aevo-exchange/fees/options-fees'}
  ]
 }
]);

export function byId(id){return VENUES.find(v=>v.id===id)||null}
export function money(value){if(value==null)return 'N/A';return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',notation:'compact',maximumFractionDigits:2}).format(value)}
