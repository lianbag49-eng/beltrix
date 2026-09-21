const { Pool } = require("pg");
const { registry } = require("../connectors");

const DATABASE_URL=process.env.DATABASE_URL||"";
if(!DATABASE_URL){console.error("DATABASE_URL required");process.exit(1)}
const pool=new Pool({connectionString:DATABASE_URL,ssl:{rejectUnauthorized:false},max:2});

async function main(){
  const started=new Date().toISOString();
  const results=[];
  for(const [exchangeId,connector] of registry){
    if(typeof connector.status==="function"){
      const s=connector.status();
      results.push(s);
      continue;
    }
    results.push({exchangeId,configured:false});
  }
  await pool.query(
    `INSERT INTO feeloop.system_settings(key,value,updated_at)
     VALUES('last_connector_sync',$1::jsonb,NOW())
     ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value,updated_at=NOW()`,
    [JSON.stringify({started,finished:new Date().toISOString(),results})]
  );
  console.log(JSON.stringify({ok:true,results}));
}

main().catch(err=>{console.error(err);process.exitCode=1}).finally(()=>pool.end());
