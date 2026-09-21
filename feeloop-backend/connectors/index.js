/**
 * FEELOOP exchange connector contract.
 *
 * Partner credentials are intentionally not stored in source control.
 * A connector becomes active only after the exchange's official partner/API
 * documentation and credentials are available.
 */
class ExchangeConnector {
  constructor(config={}) { this.config=config; }
  async verifyReferralUid(uid) { throw new Error("NOT_IMPLEMENTED"); }
  async fetchFeeRecords({uid,since,cursor}={}) { throw new Error("NOT_IMPLEMENTED"); }
  async fetchEvents({since,cursor}={}) { return {events:[],cursor:null}; }
  async payout({uid,amount,asset="USDT"}={}) { throw new Error("PAYOUT_NOT_ENABLED"); }
}

class PendingConnector extends ExchangeConnector {
  constructor(exchangeId){ super({exchangeId}); this.exchangeId=exchangeId; }
  status(){ return {exchangeId:this.exchangeId,configured:false,capabilities:{uidVerification:false,feeSync:false,eventSync:false,payout:false}}; }
}

const registry = new Map([
  ["bingx", new PendingConnector("bingx")],
  ["toobit", new PendingConnector("toobit")],
  ["bitget", new PendingConnector("bitget")],
  ["coinw", new PendingConnector("coinw")]
]);

function getConnector(exchangeId){ return registry.get(exchangeId) || new PendingConnector(exchangeId); }

module.exports={ExchangeConnector,PendingConnector,getConnector,registry};
