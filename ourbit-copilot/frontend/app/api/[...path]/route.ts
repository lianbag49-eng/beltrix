import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';
const routes = /^(auth\/(login|logout|me|bootstrap)|users(\/[1-3])?|integrations|discovery|discoveries|kols(\/\d+(\/(proposals|analyze))?)?|proposals(\/\d+\/(review|copy))?|audit|telegram\/webhook)$/;

async function proxy(request: NextRequest, context: {params: Promise<{path:string[]}>}) {
  const path = (await context.params).path.join('/');
  if (!routes.test(path)) return Response.json({detail:'없는 경로입니다.'}, {status:404});
  const base = process.env.API_BASE_URL || 'http://127.0.0.1:8000';
  const headers = new Headers({'content-type':'application/json'});
  const cookie = request.headers.get('cookie');
  const origin = request.headers.get('origin');
  if (cookie) headers.set('cookie', cookie);
  if (origin) headers.set('origin', origin);
  if(path==='telegram/webhook') {
    const secret=request.headers.get('x-telegram-bot-api-secret-token');
    if(secret) headers.set('x-telegram-bot-api-secret-token',secret);
  }
  const raw = ['GET','HEAD'].includes(request.method) ? undefined : await request.text();
  if (raw && raw.length > 32000) return Response.json({detail:'요청이 너무 큽니다.'}, {status:413});
  try {
    const upstream = await fetch(`${base}/${path}${request.nextUrl.search}`, {
      method:request.method, headers, body:raw, cache:'no-store', redirect:'error', signal:AbortSignal.timeout(110000)
    });
    const responseHeaders = new Headers({'content-type':upstream.headers.get('content-type') || 'application/json', 'cache-control':'no-store'});
    for (const value of upstream.headers.getSetCookie()) responseHeaders.append('set-cookie', value);
    return new Response(await upstream.arrayBuffer(), {status:upstream.status, headers:responseHeaders});
  } catch {
    return Response.json({detail:'서버 연결을 확인하세요. 잠시 후 다시 시도해 주세요.'}, {status:502});
  }
}
export {proxy as GET, proxy as POST, proxy as PATCH, proxy as PUT};
