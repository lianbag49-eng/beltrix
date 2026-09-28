export const VENUE_CURRENT_PROFILES=Object.freeze({
 hyperliquid:Object.freeze({
  venue:'hyperliquid',
  checkedAt:'2026-09-28',
  integrationModel:'native HyperCore API / WebSocket with builder-code monetization; HIP-3 supports builder-deployed perpetual markets',
  liquidityModel:'native CLOB',
  frontendEconomics:'builder codes and referral economics',
  whiteLabelModel:'custom frontend / builder integration rather than turnkey white-label',
  custodySettlement:'Hyperliquid stack',
  portability:'BELTRIX adapter boundary required to avoid protocol lock-in',
  executionSurface:'unified HyperCore actions',
  sources:Object.freeze([
   'https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api',
   'https://hyperliquid.gitbook.io/hyperliquid-docs/trading/builder-codes',
   'https://hyperliquid.gitbook.io/hyperliquid-docs/hyperliquid-improvement-proposals-hips/hip-3-builder-deployed-perpetuals'
  ])
 }),
 orderly:Object.freeze({
  venue:'orderly',
  checkedAt:'2026-09-28',
  integrationModel:'Orderly One low-code/white-label or custom SDK/API integration',
  liquidityModel:'shared omnichain orderbook',
  frontendEconomics:'builder/broker fee controls; graduated DEX economics',
  whiteLabelModel:'turnkey branded DEX plus custom frontend/domain tooling',
  custodySettlement:'Orderly infrastructure with self-custodial user flow',
  portability:'commercial migration/export/termination terms still require direct diligence',
  executionSurface:'REST/WebSocket/SDK with broker identity',
  sources:Object.freeze([
   'https://dex-api.orderly.network/',
   'https://dex.orderly.network/',
   'https://orderly.network/faq'
  ])
 }),
 gmx:Object.freeze({
  venue:'gmx',
  checkedAt:'2026-09-28',
  integrationModel:'custom frontend, SDK/API, or direct contracts',
  liquidityModel:'oracle/pool with market-specific capacity and price impact',
  frontendEconomics:'UI fees and referral rewards',
  whiteLabelModel:'custom frontend is supported; not a shared-CLOB white-label model',
  custodySettlement:'on-chain contracts on supported GMX networks',
  portability:'contract-level integration is portable at BELTRIX adapter layer but execution semantics are model-specific',
  executionSurface:'order prepare/API/SDK or direct ExchangeRouter flow',
  sources:Object.freeze([
   'https://docs.gmx.io/docs/api/frontend-integration/',
   'https://docs.gmx.io/docs/api/integration-guide/',
   'https://docs.gmx.io/docs/api/contracts/fees/',
   'https://docs.gmx.io/docs/referrals/'
  ])
 }),
 paradex:Object.freeze({
  venue:'paradex',
  checkedAt:'2026-09-28',
  integrationModel:'REST plus authenticated/private and SBE WebSocket surfaces',
  liquidityModel:'CLOB',
  frontendEconomics:'referral/attribution surfaces; venue fee policy remains venue-controlled',
  whiteLabelModel:'custom integration, not treated as turnkey white-label by BELTRIX',
  custodySettlement:'Paradex Starknet appchain stack',
  portability:'requires signing/auth and account lifecycle adapter',
  executionSurface:'JWT-authenticated private API and signed order lifecycle',
  sources:Object.freeze([
   'https://docs.paradex.trade/api/general-information/authentication',
   'https://docs.paradex.trade/api/general-information/rate-limits/api',
   'https://docs.paradex.trade/ws/general-information/introduction'
  ])
 }),
 dydx:Object.freeze({
  venue:'dydx',
  checkedAt:'2026-09-28',
  integrationModel:'Indexer reads plus dYdX Chain/client transaction submission',
  liquidityModel:'CLOB',
  frontendEconomics:'affiliate/referral surfaces exposed by the indexer',
  whiteLabelModel:'custom protocol integration, not treated as turnkey white-label',
  custodySettlement:'dYdX Chain',
  portability:'requires chain client, signing, sequence and reconciliation adapter',
  executionSurface:'chain client for orders/cancels; Indexer for read/realtime data',
  sources:Object.freeze([
   'https://indexer.dydx.trade/docs/',
   'https://docs.dydx.xyz/'
  ])
 }),
 drift:Object.freeze({
  venue:'drift',
  checkedAt:'2026-09-28',
  integrationModel:'Solana SDK integration',
  liquidityModel:'hybrid DLOB/AMM',
  frontendEconomics:'not normalized in BELTRIX yet',
  whiteLabelModel:'not normalized',
  custodySettlement:'Solana / Drift protocol',
  portability:'watchlist only',
  executionSurface:'research-only in BELTRIX',
  sources:Object.freeze(['https://docs.drift.trade/'])
 })
});

export function currentVenueProfile(id){
 return VENUE_CURRENT_PROFILES[String(id||'')]||null;
}
