import {defineOracleOperatorSet} from './oracle-operators.js';

export function planOracleOperatorRotation({
 currentSet,
 nextOperators=[],
 nextQuorum,
 minOverlap=1
}={}){
 if(!currentSet?.operators?.length)throw Error('Current oracle operator set is required');
 const next=defineOracleOperatorSet({operators:nextOperators,quorum:nextQuorum});
 const currentEnabled=new Set(currentSet.operators.filter(x=>x.enabled).map(x=>x.address.toLowerCase()));
 const nextEnabled=next.operators.filter(x=>x.enabled).map(x=>x.address.toLowerCase());
 const overlap=nextEnabled.filter(x=>currentEnabled.has(x));
 const required=Number(minOverlap);
 if(!Number.isInteger(required)||required<0)throw Error('minOverlap must be a non-negative integer');

 const safe=overlap.length>=required;
 return Object.freeze({
  protocol:'beltrix',
  mode:'oracle-operator-rotation',
  dryRun:true,
  currentQuorum:currentSet.quorum,
  nextQuorum:next.quorum,
  overlap:Object.freeze(overlap),
  safeToStage:safe,
  phases:Object.freeze([
   Object.freeze({id:'publish-next-set',broadcast:false,requiresHumanReview:true}),
   Object.freeze({id:'verify-new-operator-signatures',broadcast:false,requiresHumanReview:true}),
   Object.freeze({id:'run-dual-set-overlap-window',broadcast:false,requiresHumanReview:true}),
   Object.freeze({id:'activate-next-quorum',broadcast:false,requiresHumanReview:true}),
   Object.freeze({id:'retire-old-operators',broadcast:false,requiresHumanReview:true})
  ]),
  reasons:Object.freeze(safe?[]:['insufficient-operator-overlap']),
  next
 });
}
