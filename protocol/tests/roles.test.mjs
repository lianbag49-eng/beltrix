import test from 'node:test';import assert from 'node:assert/strict';
import {roleVariants,normalizeRoleGrant,expandSubDeployerPermissions} from '../roles.js';

test('BELTRIX operating roles map to narrowly scoped HIP-3 variants',()=>{
 assert.deepEqual(roleVariants('oracle-updater'),['setOracle']);
 assert.ok(roleVariants('risk-manager').includes('setOpenInterestCaps'));
 assert.deepEqual(roleVariants('emergency-guardian'),['haltTrading']);
});

test('role grants normalize and deduplicate sub-deployer permissions',()=>{
 const rows=expandSubDeployerPermissions([
  {role:'oracle-updater',account:'0x1111111111111111111111111111111111111111'},
  {role:'oracle-updater',account:'0x1111111111111111111111111111111111111111'},
  {role:'emergency-guardian',account:'0x2222222222222222222222222222222222222222'}
 ]);
 assert.equal(rows.length,2);
 assert.equal(rows[0].user,'0x1111111111111111111111111111111111111111');
 assert.equal(rows[1].variant,'haltTrading');
});

test('unknown roles are rejected',()=>{
 assert.throws(()=>normalizeRoleGrant({role:'root',account:'0x1111111111111111111111111111111111111111'}),/Unknown BELTRIX protocol role/);
});
