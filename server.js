// 打工人世界 · 联机服务器：静态托管 index.html + WebSocket 同步位置与聊天
const http=require('http'),fs=require('fs'),path=require('path');
const {WebSocketServer}=require('ws');
const PORT=process.env.PORT||3000, MAX=200;

const server=http.createServer((req,res)=>{
  if(req.url==='/healthz'){res.end('ok');return}
  if(req.url==='/'||req.url.startsWith('/?')||req.url==='/index.html'){
    const html=fs.readFileSync(path.join(__dirname,'index.html'),'utf8').replace('const SELF_HOSTED=false;','const SELF_HOSTED=true;');
    res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end(html);return}
  res.writeHead(404);res.end('not found');
});
const wss=new WebSocketServer({server,maxPayload:1024});
let nid=1;
const send=(ws,o)=>{if(ws.readyState===1)ws.send(JSON.stringify(o))};
const others=(me,o)=>{const s=JSON.stringify(o);for(const c of wss.clients)if(c!==me&&c.readyState===1)c.send(s)};
const num=(v,lo,hi)=>Math.max(lo,Math.min(hi,Number.isFinite(+v)?+v:lo));

wss.on('connection',ws=>{
  if(wss.clients.size>MAX){ws.close();return}
  ws.id='p'+(nid++);ws.pres=null;ws.alive=true;ws.cnt=0;
  send(ws,{t:'hello',id:ws.id,list:[...wss.clients].filter(c=>c!==ws&&c.pres).map(c=>({id:c.id,d:c.pres}))});
  ws.on('pong',()=>{ws.alive=true});
  ws.on('message',raw=>{
    if(++ws.cnt>40)return;                       // 限速：每秒最多 40 条
    let m;try{m=JSON.parse(raw)}catch(e){return}
    const d=m&&m.d;if(!d||typeof d!=='object')return;
    if(m.t==='p'){
      ws.pres={x:num(d.x,0,2400),y:num(d.y,0,1500),n:String(d.n||'同事').slice(0,8),
        c:/^hsl\(\d{1,3},70%,58%\)$/.test(d.c)?d.c:'hsl(200,70%,58%)',a:String(d.a||'').slice(0,4),d:d.d<0?-1:1};
      others(ws,{t:'p',id:ws.id,d:ws.pres});
    }else if(m.t==='chat'){
      others(ws,{t:'chat',id:ws.id,d:{n:String(d.n||'同事').slice(0,8),t:String(d.t||'').slice(0,60)}});
    }
  });
  ws.on('close',()=>others(ws,{t:'left',id:ws.id}));
});
setInterval(()=>{for(const c of wss.clients)c.cnt=0},1000);
setInterval(()=>{for(const c of wss.clients){if(!c.alive){c.terminate();continue}c.alive=false;c.ping()}},30000);
server.listen(PORT,()=>console.log('Office World on :'+PORT));
