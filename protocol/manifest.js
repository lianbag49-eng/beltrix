export const BELTRIX_PROTOCOL=Object.freeze({
 name:'BELTRIX Protocol',
 namespace:'beltrix',
 version:'0.1.0',
 currentStage:'bootstrap',
 stages:Object.freeze({
  bootstrap:Object.freeze({
   settlement:'external-adapters',
   description:'BELTRIX owns the intent, policy, risk, oracle and registry layers while settlement is bootstrapped through external decentralized venues.'
  }),
  hybrid:Object.freeze({
   settlement:'beltrix-markets-on-external-consensus',
   description:'BELTRIX operates its own market definitions and protocol policy while reusing external consensus / matching infrastructure where appropriate.'
  }),
  native:Object.freeze({
   settlement:'beltrix-native',
   description:'BELTRIX-native contracts or chain components own settlement, market state and protocol governance.'
  })
 }),
 custody:'non-custodial',
 executionPolicy:'user-signed',
 configModel:'governance-ready',
 publicExecutionBaseline:'hyperliquid',
 nativeSettlementStatus:'research'
});

export function protocolStage(stage=BELTRIX_PROTOCOL.currentStage){
 const row=BELTRIX_PROTOCOL.stages[stage];
 if(!row)throw Error('Unknown BELTRIX protocol stage: '+stage);
 return row;
}
