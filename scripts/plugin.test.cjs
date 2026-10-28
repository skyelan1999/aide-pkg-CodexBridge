'use strict';const {test}=require('node:test');const assert=require('node:assert/strict');const {bridgeURL}=require('../index.js');
test('plugin restricts diagnostic destinations and rejects embedded secrets',()=>{
 for(const u of ['http://example.com/v1','http://127.0.0.1:8787/v1?token=x','http://u:p@localhost/v1','file:///v1','http://localhost/v1#secret','http://localhost/else'])assert.throws(()=>bridgeURL(u));
 for(const u of ['http://localhost:8787/v1','http://host.docker.internal:8787/v1','http://127.0.0.1:8787/v1'])assert.equal(bridgeURL(u),u);
});
test('connection check and authenticated catalog never echo keys',async t=>{
 const http=require('node:http');let auth;const server=http.createServer((q,r)=>{auth=q.headers.authorization;r.setHeader('content-type','application/json');r.end(JSON.stringify(q.url==='/health'?{service:'aide-codex-bridge',version:'0.1.0'}:{data:[{id:'fake-model',secret:'not-returned'}]}));});await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>{server.closeAllConnections();server.close();});
 const tools={};require('../index.js').apply({settings:{baseURL:'http://127.0.0.1:'+server.address().port+'/v1',bridgeKey:'not-a-real-key'},tool:x=>tools[x.name]=x});
 const status=JSON.parse(await tools.codex_bridge_connection_info.handler());assert.equal(status.verifiedBridge,true);assert.equal(auth,undefined);
 const result=await tools.codex_bridge_models.handler();assert.equal(auth,'Bearer not-a-real-key');assert.equal(result.includes('not-a-real-key'),false);assert.deepEqual(JSON.parse(result).models,[{id:'fake-model'}]);
});

test('manager tools accept only paired fixed actions and never forward key/provider data',async t=>{
 const {managerURL}=require('../index.js');
 for(const u of ['http://example.com:8788','http://user:pass@localhost:8788','http://localhost:8788/path','http://localhost:8788?key=x'])assert.throws(()=>managerURL(u));
 const http=require('node:http'),secret='a'.repeat(64);let calls=0;
 const server=http.createServer((q,r)=>{assert.equal(q.headers.authorization,'Bearer '+secret);calls++;let body='';q.on('data',x=>body+=x);q.on('end',()=>{if(q.method==='POST')assert.deepEqual(JSON.parse(body),{action:'doctor'});r.end(JSON.stringify({service:'aide-codex-bridge-manager',version:'0.2.0',installed:true,controlKey:secret,bridgeKey:'must-not-return',lastError:secret,codexFound:{key:secret}}));});});await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>{server.closeAllConnections();server.close()});const tools={};require('../index.js').apply({settings:{managerURL:'http://127.0.0.1:'+server.address().port,managerKey:secret},tool:x=>tools[x.name]=x});
 const result=await tools.codex_bridge_host_action.handler({action:'doctor'});assert.equal(result.includes(secret),false);assert.equal(result.includes('must-not-return'),false);
 assert.throws(()=>tools.codex_bridge_host_action.handler({action:'shell',command:'id'}));assert.throws(()=>tools.codex_bridge_host_action.handler({action:'start',path:'/etc'}));
 await tools.codex_bridge_manager_status.handler();assert.equal(calls,2);
});
