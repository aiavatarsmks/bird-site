/** Shared HTTP helpers: errors with stable codes, JSON bodies, cookies, origin checks and limits. */
import {createHash,randomBytes} from 'node:crypto';

export class ApiError extends Error{
 constructor(status,code,detail){super(code);this.status=status;this.code=code;this.detail=detail;}
}
export const fail=(status,code,detail)=>{throw new ApiError(status,code,detail);};

// English fallback text. The browser translates by code (EN/HR/RU).
const MESSAGES={
 BAD_REQUEST:'The request is not valid.',INVALID_FIELDS:'Some fields are missing or invalid.',UNAUTHENTICATED:'Please sign in.',
 FORBIDDEN:'You do not have access to this.',NOT_FOUND:'Not found.',CONFLICT:'Someone changed this in the meantime.',
 RATE_LIMITED:'Too many attempts. Please wait and try again.',LOGIN_TAKEN:'This login is not available.',
 INVALID_LOGIN:'Login or password is incorrect.',WEAK_PASSWORD:'Use at least 10 characters.',TOO_LARGE:'The file or text is too large.',
 UNSUPPORTED_FILE:'This file type is not accepted.',QUOTA_EXCEEDED:'The storage limit has been reached.',INVITE_INVALID:'This invitation is not valid.',
 BAD_ORIGIN:'The request came from another site.',CSRF:'The page is out of date. Reload and try again.',SERVER_ERROR:'Something went wrong on the server.',
 VERSION_MISMATCH:'Unsupported version.',ALREADY_DONE:'This is already done.',INVALID_STATE:'This action is not available now.',
};

export const SECURITY_HEADERS={'X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin','X-Frame-Options':'SAMEORIGIN'};

export function json(body,status=200,headers={}){
 return new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...SECURITY_HEADERS,...headers}});
}
export function errorResponse(error){
 if(error instanceof ApiError)return json({error:{code:error.code,message:MESSAGES[error.code]||error.code,...(error.detail?{detail:error.detail}:{})}},error.status);
 console.error('Request failed:',error?.name||'Error',error?.message?.slice(0,200));
 return json({error:{code:'SERVER_ERROR',message:MESSAGES.SERVER_ERROR}},500);
}

export async function readJson(request,limit=64*1024){
 if(!request.headers.get('content-type')?.startsWith('application/json'))fail(415,'BAD_REQUEST');
 const declared=Number(request.headers.get('content-length')||0);if(declared>limit)fail(413,'TOO_LARGE');
 const raw=await request.arrayBuffer();if(raw.byteLength>limit)fail(413,'TOO_LARGE');
 try{const value=JSON.parse(new TextDecoder().decode(raw));if(!value||typeof value!=='object'||Array.isArray(value))fail(400,'BAD_REQUEST');return value;}
 catch(e){if(e instanceof ApiError)throw e;fail(400,'BAD_REQUEST');}
}

const CONTROL=/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;
/** Validates a plain-text field. Returns trimmed text or throws INVALID_FIELDS. */
export function text(value,{max=200,min=0,optional=false,multiline=false}={},field='field'){
 if(value===undefined||value===null){if(optional)return '';fail(400,'INVALID_FIELDS',{field});}
 if(typeof value!=='string')fail(400,'INVALID_FIELDS',{field});
 const v=value.normalize('NFC').trim();
 if(v.length<min||v.length>max||CONTROL.test(v)||(!multiline&&/[\r\n]/.test(v)))fail(400,'INVALID_FIELDS',{field});
 return v;
}
export function oneOf(value,list,field){if(!list.includes(value))fail(400,'INVALID_FIELDS',{field});return value;}
export function int(value,{min=0,max=1e9}={},field){const n=Number(value);if(!Number.isInteger(n)||n<min||n>max)fail(400,'INVALID_FIELDS',{field});return n;}
export function httpUrl(value,field='url'){
 const v=text(value,{max:500,optional:true},field);if(!v)return '';
 try{const u=new URL(v);if(!['https:','http:'].includes(u.protocol)||u.username||u.password)throw 0;return u.href;}catch{fail(400,'INVALID_FIELDS',{field});}
}

export const sha256=value=>createHash('sha256').update(value).digest('hex');
export const token=(bytes=32)=>randomBytes(bytes).toString('base64url');
export const newId=prefix=>prefix+'-'+randomBytes(12).toString('hex');

export function parseCookies(request){
 const out={};for(const part of (request.headers.get('cookie')||'').split(';')){const i=part.indexOf('=');if(i>0)out[part.slice(0,i).trim()]=decodeURIComponent(part.slice(i+1).trim());}
 return out;
}
export function cookie(name,value,{maxAge,secure}){
 return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax${secure?'; Secure':''}; Max-Age=${maxAge}`;
}

/** Exact origin of this request as seen by the browser. */
export function selfOrigin(request,config){
 if(config.publicOrigin)return config.publicOrigin;
 const url=new URL(request.url);
 const proto=config.trustProxy?request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim()||url.protocol.slice(0,-1):url.protocol.slice(0,-1);
 return proto+'://'+url.host;
}
export function checkOrigin(request,config){
 const origin=request.headers.get('origin');
 if(!origin)fail(403,'BAD_ORIGIN');
 if(origin!==selfOrigin(request,config)&&!config.origins.includes(origin))fail(403,'BAD_ORIGIN');
}

export function clientIp(request,server,config){
 if(config.trustProxy){const real=request.headers.get('x-real-ip')?.trim();if(real)return real;}
 return server?.requestIP?.(request)?.address||'unknown';
}

/** Fixed-window counter kept in SQLite, so limits survive restarts. */
export function rateLimit(db,key,limit,windowSeconds){
 const now=Date.now(),window=Math.floor(now/1000/windowSeconds),k=sha256(key+':'+window),expires=(window+1)*windowSeconds*1000;
 const row=db.query('INSERT INTO rate_limits(key,count,expires) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count').get(k,expires);
 if(Math.random()<.01)db.query('DELETE FROM rate_limits WHERE expires<?').run(now);
 if(row.count>limit)fail(429,'RATE_LIMITED');
}
export function peekLimit(db,key,windowSeconds){const window=Math.floor(Date.now()/1000/windowSeconds);return db.query('SELECT count FROM rate_limits WHERE key=?').get(sha256(key+':'+window))?.count||0;}

/** Stores the first response for (user, route, key) and replays it for repeats. */
export async function idempotent(db,userId,route,key,run){
 if(!key)return run();
 if(!/^[A-Za-z0-9_-]{8,80}$/.test(key))fail(400,'BAD_REQUEST');
 const prior=db.query('SELECT status,response FROM idempotency WHERE user_id=? AND route=? AND key=?').get(userId,route,key);
 if(prior)return {status:prior.status,body:JSON.parse(prior.response),replayed:true};
 const result=await run();
 db.query('INSERT OR IGNORE INTO idempotency(user_id,route,key,status,response,created) VALUES(?,?,?,?,?,?)').run(userId,route,key,result.status||200,JSON.stringify(result.body),new Date().toISOString());
 return result;
}

export function page(url,max=50){
 const limit=Math.max(1,Math.min(max,Number(url.searchParams.get('limit'))||max));
 const offset=Math.max(0,Math.min(1e6,Number(url.searchParams.get('offset'))||0));
 return {limit,offset};
}
