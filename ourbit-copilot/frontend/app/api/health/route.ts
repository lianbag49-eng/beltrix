export const dynamic='force-dynamic';
export async function GET(){
 try{
  const result=await fetch((process.env.API_BASE_URL||'http://127.0.0.1:8000')+'/readyz',{cache:'no-store',signal:AbortSignal.timeout(4000)});
  return Response.json({status:result.ok?'ready':'unavailable'},{status:result.ok?200:503,headers:{'cache-control':'no-store'}});
 }catch{return Response.json({status:'unavailable'},{status:503});}
}
