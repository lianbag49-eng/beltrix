import test from 'node:test';import assert from 'node:assert/strict';
import {roleVariants,normalizeRoleGrant,expandSubDeployerPermissions} from '../roles.js';

test('BELTRIX operating roles map to narrowly scoped HIP-3 variants',()=>{
 assert.deepEqual(roleVariants('oracle-updater'),['setOracle']);
 assert.ok(roleVariants('risk-manager').includes('setOpenInterestCaps'));
 assert.deepEqual(roleVariants('emergency-guardian'),['haltTrading']);
});

test('role grants normalize and deduplicate sub-deployer permissions',()=>{
 const rows=expandSubDeployerPermissions([
  {role:'oracle-updater',account:'Alice'},
  {role:'oracle-updater',account:'alice'},
  {role:'emergency-guardian',account:'Bob'}
 ]);
 assert.equal(rows.length,2);
 assert.equal(rows[0].user,'alice');
 assert.equal(rows[1].variant,'haltTrading');
});

test('unknown roles are rejected',()=>{
 assert.throws(()=>normalizeRoleGrant({role:'root',account:'x'}),/Unknown BELTRIX protocol role/);
});
