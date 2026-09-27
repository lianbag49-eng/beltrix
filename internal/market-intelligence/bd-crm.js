export const BD_STAGES=Object.freeze([
 'research','contact-target','intro-sent','technical-call','commercial-terms','security-compliance','poc','approved','hold'
]);

export const BD_PIPELINE=Object.freeze([
 {venue:'hyperliquid',stage:'approved',workstream:'Core execution / builder relationship',nextAction:'Keep API, Builder Code, referral and HIP-3 semantics under change watch.',contactRoute:'API traders / builder ecosystem',commercial:['Builder Code economics','Referral attribution','HIP-3 expansion']},
 {venue:'orderly',stage:'commercial-terms',workstream:'White-label / multi-chain',nextAction:'Request current broker base-fee tiers, builder spread economics and distributor terms.',contactRoute:'Orderly One builder + distributor onboarding',commercial:['Base fee tiers','Broker revenue settlement','Distributor payout','Custom domain / frontend ownership']},
 {venue:'gmx',stage:'technical-call',workstream:'UI fee / referral',nextAction:'Confirm current MAX_UI_FEE_FACTOR and partner-tier process; build read-only cost comparison.',contactRoute:'GMX Partners + frontend integration',commercial:['UI fee cap','Referral tier','Claim settlement','Express / one-click architecture']},
 {venue:'dydx',stage:'research',workstream:'Affiliate / appchain benchmark',nextAction:'Verify current affiliate jurisdiction exclusions and live fee tiers before outreach.',contactRoute:'dYdX affiliate / integration ecosystem',commercial:['Affiliate tier','Lifetime attribution','Indexer/node SLA','Fee governance']},
 {venue:'paradex',stage:'research',workstream:'Attribution / portfolio-margin benchmark',nextAction:'Validate direct OI/volume and current affiliate economics after TAP.',contactRoute:'Paradex API / affiliate channels',commercial:['Referral program','Marketing code / UTM','Retail vs Pro classification']},
 {venue:'aster',stage:'technical-call',workstream:'Builder / agent-wallet candidate',nextAction:'Confirm Builder onboarding, fee settlement, max approved fee policy and commercial support.',contactRoute:'Aster Builder / API ecosystem',commercial:['Builder approval','feeRate settlement','Agent Wallet permissions','V3 account requirements']},
 {venue:'drift',stage:'research',workstream:'Solana execution benchmark',nextAction:'Replace aggregator figures with direct protocol telemetry before sizing BD value.',contactRoute:'Drift protocol / SDK ecosystem',commercial:['Current fees','Referral/partner program','Keeper incentives']},
 {venue:'aevo',stage:'hold',workstream:'Options / structured-product differentiation',nextAction:'Revisit if BELTRIX adds options or structured products.',contactRoute:'Aevo exchange / API channels',commercial:['Options embed','Referral terms','API/MCP commercial use']}
]);

export function validStage(stage){return BD_STAGES.includes(stage)}
export function bdForVenue(id){return BD_PIPELINE.find(x=>x.venue===id)||null}
export function pipelineCounts(rows=BD_PIPELINE){
 return Object.freeze(Object.fromEntries(BD_STAGES.map(stage=>[stage,rows.filter(x=>x.stage===stage).length])));
}
