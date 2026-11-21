// 打工人世界 · 服务器：静态托管 + 账号/存档 API（Postgres）+ WebSocket 联机
const http=require('http'),fs=require('fs'),path=require('path'),crypto=require('crypto');
const {WebSocketServer}=require('ws');
const PORT=process.env.PORT||3000, MAX=200;
const SECRET=process.env.AUTH_SECRET||crypto.randomBytes(32).toString('hex'); // 未设置时每次重启登录令牌都会失效
let pool=null;
if(process.env.DATABASE_URL){
  const {Pool}=require('pg'),u=process.env.DATABASE_URL;
  pool=new Pool({connectionString:u,ssl:/localhost|127\.0\.0\.1/.test(u)?false:{rejectUnauthorized:false},max:5});
}
async function initDb(){
  if(!pool)return;
  try{await pool.query(`CREATE TABLE IF NOT EXISTS users(
    id SERIAL PRIMARY KEY,name TEXT NOT NULL,name_lc TEXT UNIQUE NOT NULL,salt TEXT NOT NULL,hash TEXT NOT NULL,
    save TEXT NOT NULL DEFAULT '{}',created_at TIMESTAMPTZ DEFAULT now(),updated_at TIMESTAMPTZ DEFAULT now())`);
  }catch(e){console.error('数据库初始化失败，账号功能关闭：',e.message);pool=null}
}

// ---- 工具 ----
const CORS={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Content-Type, Authorization','Access-Control-Allow-Methods':'GET,POST,PUT,OPTIONS'};
const json=(res,code,o)=>{res.writeHead(code,{'Content-Type':'application/json; charset=utf-8',...CORS});res.end(JSON.stringify(o))};
const scrypt=(p,s)=>new Promise((ok,no)=>crypto.scrypt(p,s,64,(e,k)=>e?no(e):ok(k)));
const hmac=p=>crypto.createHmac('sha256',SECRET).update(p).digest('base64url');
function sign(u){const p=Buffer.from(JSON.stringify({id:u.id,n:u.name,exp:Date.now()+30*864e5})).toString('base64url');return p+'.'+hmac(p)}
function verify(t){
  if(typeof t!=='string')return null;const [p,s]=t.split('.');if(!p||!s)return null;
  const a=Buffer.from(s),b=Buffer.from(hmac(p));if(a.length!==b.length||!crypto.timingSafeEqual(a,b))return null;
  try{const d=JSON.parse(Buffer.from(p,'base64url'));return d.exp>Date.now()?d:null}catch(e){return null}
}
const bearer=req=>verify((req.headers.authorization||'').replace(/^Bearer /,''));
const hits=new Map();
function limited(req){const ip=(req.headers['x-forwarded-for']||req.socket.remoteAddress||'').split(',')[0].trim(),now=Date.now();
  let h=hits.get(ip);if(!h||now-h.t>6e5)h={n:0,t:now};h.n++;hits.set(ip,h);return h.n>20}
setInterval(()=>{const n=Date.now();for(const[k,v]of hits)if(n-v.t>6e5)hits.delete(k)},6e5);
function readBody(req){return new Promise((ok,no)=>{let d='';req.on('data',c=>{d+=c;if(d.length>4096){no(new Error('请求过大'));req.destroy()}});
  req.on('end',()=>{try{ok(JSON.parse(d||'{}'))}catch(e){no(new Error('格式错误'))}});req.on('error',no)})}
function cleanSave(s,old){ // 校验并限制增长幅度，防止直接伪造存档
  s=s||{};old=old||{};const od=old.day||1,om=old.money||0,odn=old.done||0;
  const n=(v,lo,hi,d)=>Number.isFinite(+v)?Math.max(lo,Math.min(hi,Math.round(+v))):d;
  const day=n(s.day,od,od+1,od),dd=day-od;
  return{day,money:n(s.money,-1e6,om+3000*(1+dd),om),done:n(s.done,odn,odn+10*(1+dd),odn),
    en:n(s.en,0,100,100),st:n(s.st,0,100,10),col:/^hsl\(\d{1,3},70%,58%\)$/.test(s.col)?s.col:old.col};
}
const parse=t=>{try{return JSON.parse(t)}catch(e){return {}}};

// ---- HTTP ----
const server=http.createServer(async(req,res)=>{
  const url=req.url.split('?')[0];
  try{
    if(req.method==='OPTIONS'){res.writeHead(204,CORS);return res.end()}
    if(url==='/healthz')return res.end('ok');
    if(url==='/api/status')return json(res,200,{accounts:!!pool});
    if(url.startsWith('/api/')){
      if(!pool)return json(res,503,{error:'服务器未配置数据库'});
      if((url==='/api/register'||url==='/api/login')&&req.method==='POST'){
        if(limited(req))return json(res,429,{error:'尝试次数过多，请稍后再试'});
        const b=await readBody(req),name=String(b.name||'').trim(),pw=String(b.password||'');
        if(!/^[\p{L}\p{N}_]{2,8}$/u.test(name))return json(res,400,{error:'名字需为 2-8 个字（文字、数字、下划线）'});
        if(pw.length<6||pw.length>64)return json(res,400,{error:'密码需为 6-64 位'});
        const lc=name.toLowerCase();
        if(url==='/api/register'){
          if(lc.startsWith('游客'))return json(res,400,{error:'名字不能以“游客”开头'});
          const ex=await pool.query('SELECT id FROM users WHERE name_lc=$1',[lc]);
          if(ex.rows.length)return json(res,409,{error:'这个名字已被注册'});
          const salt=crypto.randomBytes(16).toString('hex'),hash=(await scrypt(pw,salt)).toString('hex');
          let r;try{r=await pool.query('INSERT INTO users(name,name_lc,salt,hash) VALUES($1,$2,$3,$4) RETURNING id',[name,lc,salt,hash])}
          catch(e){return json(res,409,{error:'这个名字已被注册'})}
          return json(res,200,{token:sign({id:r.rows[0].id,name}),name,save:{}});
        }
        const r=await pool.query('SELECT id,name,salt,hash,save FROM users WHERE name_lc=$1',[lc]),u=r.rows[0];
        const ok=u&&crypto.timingSafeEqual(await scrypt(pw,u.salt),Buffer.from(u.hash,'hex'));
        if(!ok)return json(res,401,{error:'名字或密码错误'});
        return json(res,200,{token:sign(u),name:u.name,save:parse(u.save)});
      }
      if(url==='/api/save'){
        const t=bearer(req);if(!t)return json(res,401,{error:'未登录或登录已过期'});
        const r=await pool.query('SELECT name,save FROM users WHERE id=$1',[t.id]);if(!r.rows.length)return json(res,401,{error:'账号不存在'});
        if(req.method==='GET')return json(res,200,{name:r.rows[0].name,save:parse(r.rows[0].save)});
        if(req.method==='PUT'){
          const sv=cleanSave(await readBody(req),parse(r.rows[0].save));
          await pool.query('UPDATE users SET save=$1,updated_at=now() WHERE id=$2',[JSON.stringify(sv),t.id]);
          return json(res,200,{ok:true,save:sv});
        }
      }
      return json(res,404,{error:'not found'});
    }
    if(url==='/'||url==='/index.html'){
      const html=fs.readFileSync(path.join(__dirname,'index.html'),'utf8').replace('const SELF_HOSTED=false;','const SELF_HOSTED=true;');
      res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});return res.end(html);
    }
    res.writeHead(404);res.end('not found');
  }catch(e){json(res,400,{error:e.message||'请求失败'})}
});

// ---- WebSocket ----
const wss=new WebSocketServer({server,maxPayload:1024});
let nid=1;
const send=(ws,o)=>{if(ws.readyState===1)ws.send(JSON.stringify(o))};
const others=(me,o)=>{const s=JSON.stringify(o);for(const c of wss.clients)if(c!==me&&c.readyState===1)c.send(s)};
const num=(v,lo,hi)=>Math.max(lo,Math.min(hi,Number.isFinite(+v)?+v:lo));
// 已登录用令牌里的名字；游客一律加“游客”前缀，防止冒充注册用户
const dispName=(ws,n)=>ws.user?ws.user:('游客'+String(n||'').replace(/^游客/,'')).slice(0,8);

wss.on('connection',(ws,req)=>{
  if(wss.clients.size>MAX){ws.close();return}
  let tk=null;try{tk=new URL(req.url,'http://x').searchParams.get('token')}catch(e){}
  const v=tk&&verify(tk);ws.user=v?v.n:null;
  ws.id='p'+(nid++);ws.pres=null;ws.alive=true;ws.cnt=0;
  send(ws,{t:'hello',id:ws.id,list:[...wss.clients].filter(c=>c!==ws&&c.pres).map(c=>({id:c.id,d:c.pres}))});
  ws.on('pong',()=>{ws.alive=true});
  ws.on('message',raw=>{
    if(++ws.cnt>40)return;
    let m;try{m=JSON.parse(raw)}catch(e){return}
    const d=m&&m.d;if(!d||typeof d!=='object')return;
    if(m.t==='p'){
      ws.pres={x:num(d.x,0,2400),y:num(d.y,0,1500),n:dispName(ws,d.n),
        c:/^hsl\(\d{1,3},70%,58%\)$/.test(d.c)?d.c:'hsl(200,70%,58%)',a:String(d.a||'').slice(0,4),d:d.d<0?-1:1};
      others(ws,{t:'p',id:ws.id,d:ws.pres});
    }else if(m.t==='chat'){
      others(ws,{t:'chat',id:ws.id,d:{n:dispName(ws,d.n),t:String(d.t||'').slice(0,60)}});
    }
  });
  ws.on('close',()=>others(ws,{t:'left',id:ws.id}));
});
setInterval(()=>{for(const c of wss.clients)c.cnt=0},1000);
setInterval(()=>{for(const c of wss.clients){if(!c.alive){c.terminate();continue}c.alive=false;c.ping()}},30000);
initDb().then(()=>server.listen(PORT,()=>console.log('Office World on :'+PORT+(pool?'（账号功能已启用）':'（无数据库，仅游客模式）'))));
