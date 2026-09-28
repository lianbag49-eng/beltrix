export async function createQueryClient({databaseUrl}={}){
 if(!databaseUrl)throw new Error('MI_DATABASE_URL is required');
 let pg;
 try{pg=await import('pg')}catch{
  throw new Error('PostgreSQL driver "pg" is not installed in this runtime');
 }
 const Pool=pg.Pool||pg.default?.Pool;
 if(typeof Pool!=='function')throw new Error('PostgreSQL Pool constructor unavailable');
 const pool=new Pool({
  connectionString:databaseUrl,
  max:4,
  idleTimeoutMillis:30000,
  connectionTimeoutMillis:10000,
  allowExitOnIdle:false,
  ssl:databaseUrl.includes('sslmode=disable')?false:undefined
 });
 await pool.query('select 1 as ok');
 return pool;
}
