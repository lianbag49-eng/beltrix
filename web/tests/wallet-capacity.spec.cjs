const {test,expect}=require('@playwright/test');

// Synthetic encrypted vault records only; no real wallet or network is used.
async function open(page){
 await page.route('**/*',r=>['127.0.0.1','localhost'].includes(new URL(r.request().url()).hostname)?r.continue():r.abort());
 await page.goto('/web/#wallet');
 await expect(page.locator('#wBeltrixVault')).toBeVisible();
}
async function seed(page,count){
 await page.evaluate(async count=>{
  const vault=await import('/web/beltrix-wallet-vault.js');
  const encrypted=await vault.encryptWalletSecret('0x'+'11'.repeat(32),'test-only-wallet-password');
  window.capacityRecord=i=>({id:'test-'+i,name:'Test wallet '+i,address:'0x'+i.toString(16).padStart(40,'0'),encrypted});
  for(let i=1;i<=count;i++)await vault.putVault(window.capacityRecord(i));
 },count);
}

test('simultaneous last-slot writes commit only one wallet and preserve existing vault access',async({page,context})=>{
 await open(page);await seed(page,9);
 const other=await context.newPage();await open(other);
 const results=await Promise.all([page,other].map((p,i)=>p.evaluate(async i=>{
  const vault=await import('/web/beltrix-wallet-vault.js');
  const source=await vault.getVault('test-1');
  try{await vault.putVault({...source,id:'new-'+i,address:'0x'+(20+i).toString(16).padStart(40,'0')});return 'saved'}
  catch(e){return e.message}
 },i)));
 expect(results.filter(r=>r==='saved')).toHaveLength(1);
 expect(results.join(' ')).toContain('already has 10');
 const result=await page.evaluate(async()=>{
  const v=await import('/web/beltrix-wallet-vault.js');
  const before=await v.getVault('test-1');await v.putVault({...before,name:'Still available'});
  const after=await v.getVault('test-1');
  return {count:(await v.listVaults()).length,name:after.name,same:JSON.stringify(before.encrypted)===JSON.stringify(after.encrypted)};
 });
 expect(result).toEqual({count:10,name:'Still available',same:true});
 await page.locator('#wBeltrixVault').click();
 await expect(page.locator('#wLocalWalletCount')).toHaveText('10 / 10');
 await expect(page.locator('#wLocalCreate')).toBeDisabled();
 await expect(page.locator('#wLocalImport')).toBeDisabled();
 await expect(page.locator('[data-unlock]')).toHaveCount(10);
 const blocked=await page.evaluate(async()=>{
  try{await window.beltrixWallet.manager.beginCreate();return false}catch(e){return /already has 10/.test(e.message)}
 });
 expect(blocked).toBe(true);
});

test('duplicate addresses cannot consume a slot and removing one makes room',async({page})=>{
 await open(page);await seed(page,10);
 const result=await page.evaluate(async()=>{
  const v=await import('/web/beltrix-wallet-vault.js');let duplicate;
  try{await v.putVault({...window.capacityRecord(1),id:'duplicate'})}catch(e){duplicate=e.message}
  await v.deleteVault('test-10');await v.putVault(window.capacityRecord(11));
  return {duplicate,count:(await v.listVaults()).length,added:!!await v.getVault('test-11')};
 });
 expect(result).toEqual({duplicate:'This wallet already exists in BELTRIX.',count:10,added:true});
});
