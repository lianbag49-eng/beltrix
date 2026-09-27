import {ProtocolMarketRegistry,BOOTSTRAP_MARKETS} from './market-registry.js';
import {SettlementRegistry} from './settlement.js';
import {hyperliquidSettlement} from './hyperliquid-settlement.js';
import {beltrixNativeSettlement} from './native-settlement.js';

export function createBootstrapProtocol(){
 const markets=new ProtocolMarketRegistry();
 for(const market of BOOTSTRAP_MARKETS)markets.register(market);
 const settlements=new SettlementRegistry();
 settlements.register(hyperliquidSettlement);
 settlements.register(beltrixNativeSettlement);
 return Object.freeze({markets,settlements});
}
