'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const os=require('node:os');const path=require('node:path');
const {resolveLaunch}=require('../runtime/launch.cjs');const {createServer}=require('../runtime/bridge.cjs');const {defaultTarget}=require('../manage.cjs');
test('platform-specific install locations are correct',()=>{
 assert.equal(defaultTarget('win32',{LOCALAPPDATA:'C:\\Users\\Test\\AppData\\Local'},'C:\\Users\\Test'),'C:\\Users\\Test\\AppData\\Local\\aide-codex-bridge');
 assert.equal(defaultTarget('darwin',{},'/Users/test'),'/Users/test/Library/Application Support/aide-codex-bridge');
 assert.equal(defaultTarget('linux',{XDG_DATA_HOME:'/var/tmp/data'},'/home/test'),'/var/tmp/data/aide-codex-bridge');
});
test('Windows npm shim resolves through Node, never through a shell',t=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'codex shim 空格 '));t.after(()=>fs.rmSync(temp,{recursive:true,force:true}));
 const shim=path.join(temp,'codex.cmd');fs.writeFileSync(shim,'@echo off\r\n');
 assert.throws(()=>resolveLaunch(shim,{platform:'win32'}),/JS entry/);
 const entry=path.join(temp,'node_modules','@openai','codex','bin','codex.js');fs.mkdirSync(path.dirname(entry),{recursive:true});fs.writeFileSync(entry,'console.log("fixture")');
 assert.deepEqual(resolveLaunch(shim,{platform:'win32'}),{command:process.execPath,prefix:[entry]});
 assert.throws(()=>resolveLaunch('codex\ncalc.exe'),/Invalid/);
});
test('real stdio child completes JSON, SSE and dynamic tool handoff on this platform',async t=>{
 const cwd=fs.mkdtempSync(path.join(os.tmpdir(),'bridge 子进程 '));
 const fake=path.join(cwd,'fake-codex.cjs');
 fs.writeFileSync(fake,`const r=require('node:readline').createInterface({input:process.stdin});const send=v=>console.log(JSON.stringify(v));r.on('line',line=>{const m=JSON.parse(line);if(!m.id)return;let result={};if(m.method==='model/list')result={data:[{id:'fixture-model'}]};if(m.method==='config/read')result={config:{mcp_servers:{secret:{}}}};if(m.method==='thread/start'){if(m.params.sandbox!=='read-only'||m.params.config['mcp_servers.secret.enabled']!==false)process.exit(4);result={thread:{id:'fixture-thread'}}}send({id:m.id,result});if(m.method==='turn/start'){if(m.params.input[0].text.includes('CALL_LOOKUP'))send({id:999,method:'item/tool/call',params:{tool:'lookup',callId:'lookup-1',arguments:{q:'fixture'}}});else {send({method:'item/agentMessage/delta',params:{threadId:'fixture-thread',delta:'STDIO_OK'}});send({method:'turn/completed',params:{threadId:'fixture-thread',turn:{status:'completed'}}})}}});`);
 const server=createServer({key:'synthetic-only',codex:fake,cwd,timeout:8000,maxBody:8192,maxConcurrent:2});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(async()=>{server.shutdown();await new Promise(r=>setTimeout(r,200));fs.rmSync(cwd,{recursive:true,force:true,maxRetries:10,retryDelay:100});});
 const url='http://127.0.0.1:'+server.address().port;
 assert.equal((await(await fetch(url+'/health')).json()).service,'aide-codex-bridge');
 const post=body=>fetch(url+'/v1/chat/completions',{method:'POST',headers:{Authorization:'Bearer synthetic-only'},body:JSON.stringify({model:'fixture-model',messages:[{role:'user',content:'hello'}],...body})});
 assert.equal((await(await post({})).json()).choices[0].message.content,'STDIO_OK');
 assert.match(await(await post({stream:true})).text(),/data: \[DONE\]/);
 const tool=await(await post({messages:[{role:'user',content:'CALL_LOOKUP'}],tools:[{type:'function',function:{name:'lookup'}}]})).json();
 assert.equal(tool.choices[0].finish_reason,'tool_calls');assert.equal(tool.choices[0].message.tool_calls[0].function.name,'lookup');
});
