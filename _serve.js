const http=require('http'),fs=require('fs'),path=require('path');
http.createServer((q,s)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p==='/')p='/bloq.html';
 fs.readFile(path.join(process.cwd(),p),(e,d)=>{if(e){s.writeHead(404);s.end('nf');return;}
 const ct={'.html':'text/html; charset=utf-8','.js':'text/javascript','.json':'application/json'}[path.extname(p)]||'text/plain';
 s.writeHead(200,{'Content-Type':ct});s.end(d);});}).listen(8801,()=>console.log('up 8801'));
