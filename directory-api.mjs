/** Shared profiles. All public text stays as the author wrote it. */
export function createDirectoryHandler(db) {
  db.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;');
  db.exec(`CREATE TABLE IF NOT EXISTS profiles (id TEXT PRIMARY KEY, body TEXT NOT NULL, owner_hash TEXT NOT NULL, created TEXT NOT NULL, updated TEXT NOT NULL, deleted INTEGER NOT NULL DEFAULT 0); CREATE TABLE IF NOT EXISTS create_limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires INTEGER NOT NULL);`);
  const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
  const hash=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),b=>b.toString(16).padStart(2,'0')).join('');
  const publicRow=row=>({id:row.id,...JSON.parse(row.body),created:row.created,updated:row.updated});
  const limits={name:100,about:700,project:120,description:1200,team:120,members:500,url:500,offer:600,ask:600};
  const validate=input=>{
    if(!input||typeof input!=='object'||Array.isArray(input))return null;
    const data={};
    for(const [key,max] of Object.entries(limits)){
      const raw=input[key]??'';
      if(typeof raw!=='string'||raw.length>max||/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(raw))return null;
      data[key]=raw.trim();
    }
    if(!data.name)return null;
    if(data.url){try{const u=new URL(data.url);if(!['https:','http:'].includes(u.protocol)||u.username||u.password)return null;data.url=u.href;}catch{return null;}}
    const size=input.size;
    if(size!==''&&size!==null&&size!==undefined&&(!Number.isInteger(Number(size))||Number(size)<1||Number(size)>500))return null;
    data.size=size===''||size==null?null:Number(size);
    return data;
  };
  return async function handle(request,clientIP='unknown'){
    try{
      const url=new URL(request.url),path=url.pathname;
      const match=path.match(/^\/api\/profiles\/([0-9a-f-]{36})$/i);
      if(path!=='/api/profiles'&&!match)return json({error:'NOT_FOUND'},404);
      if(request.method==='GET'&&path==='/api/profiles'){
        const offset=Math.max(0,Math.min(100000,Number(url.searchParams.get('offset'))||0));
        const rows=db.query('SELECT id,body,created,updated FROM profiles WHERE deleted=0 ORDER BY created DESC,id DESC LIMIT 51 OFFSET ?').all(offset);
        return json({items:rows.slice(0,50).map(publicRow),hasMore:rows.length>50});
      }
      if(!['POST','PUT','DELETE'].includes(request.method))return json({error:'METHOD_NOT_ALLOWED'},405);
      const scheme=request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim()||url.protocol.slice(0,-1);
      if(request.headers.get('origin')!==scheme+'://'+url.host)return json({error:'FORBIDDEN'},403);
      const token=request.headers.get('authorization')?.replace(/^Bearer /,'')||'';
      if(!/^[0-9a-f]{64}$/i.test(token))return json({error:'FORBIDDEN'},403);
      const ownerHash=await hash(token);
      const id=match?.[1];
      if(id){
        const row=db.query('SELECT * FROM profiles WHERE id=?').get(id);
        if(!row||row.owner_hash!==ownerHash)return json({error:'FORBIDDEN'},403);
        if(request.method==='DELETE'){
          db.query('UPDATE profiles SET deleted=1,updated=? WHERE id=?').run(new Date().toISOString(),id);
          return json({ok:true});
        }
        if(request.method!=='PUT'||row.deleted)return json({error:'NOT_FOUND'},404);
      }else if(request.method!=='POST')return json({error:'METHOD_NOT_ALLOWED'},405);
      if(!request.headers.get('content-type')?.startsWith('application/json'))return json({error:'INVALID_FIELDS'},415);
      const raw=await request.arrayBuffer();if(raw.byteLength>16384)return json({error:'TOO_LARGE'},413);
      let body;try{body=JSON.parse(new TextDecoder().decode(raw));}catch{return json({error:'INVALID_FIELDS'},400);}
      if(body.fax)return json({error:'INVALID_FIELDS'},400);
      const data=validate(body);if(!data)return json({error:'INVALID_FIELDS'},400);
      const now=new Date().toISOString();
      if(id){
        db.query('UPDATE profiles SET body=?,updated=? WHERE id=?').run(JSON.stringify(data),now,id);
        return json({item:publicRow(db.query('SELECT * FROM profiles WHERE id=?').get(id))});
      }
      if(typeof body.id!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.id))return json({error:'INVALID_FIELDS'},400);
      const existing=db.query('SELECT * FROM profiles WHERE id=?').get(body.id);
      if(existing)return existing.owner_hash===ownerHash&&!existing.deleted?json({item:publicRow(existing)}):json({error:'FORBIDDEN'},403);
      const hour=Math.floor(Date.now()/3600000);
      const key=await hash(clientIP+':'+hour);
      const create=db.transaction(()=>{
        db.query('DELETE FROM create_limits WHERE expires<?').run(Date.now());
        const quota=db.query('SELECT count FROM create_limits WHERE key=?').get(key);
        if(quota?.count>=60)return false;
        db.query('INSERT INTO create_limits(key,count,expires) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1').run(key,(hour+1)*3600000);
        db.query('INSERT INTO profiles(id,body,owner_hash,created,updated) VALUES(?,?,?,?,?)').run(body.id,JSON.stringify(data),ownerHash,now,now);
        return true;
      });
      if(!create())return json({error:'RATE_LIMITED'},429);
      return json({item:{id:body.id,...data,created:now,updated:now}},201);
    }catch(error){console.error('Directory request failed:',error?.name||'Error');return json({error:'SERVER_ERROR'},500);}
  };
}
