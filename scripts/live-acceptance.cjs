'use strict';
// Explicit --infer uses Codex quota; synthetic prompts only. No auth/config is exported.
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {createServer}=require('../runtime/bridge.cjs');
(async()=>{
 const cwd=fs.mkdtempSync(path.join(os.tmpdir(),'codex-bridge-live-'));const key=crypto.randomBytes(32).toString('hex');
 const server=createServer({key,codex:'codex',cwd,maxBody:8192,timeout:180000,maxConcurrent:2});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{
 const base='http://127.0.0.1:'+server.address().port+'/v1';const headers={Authorization:'Bearer '+key,'Content-Type':'application/json'};
 const r=await fetch(base+'/models',{headers,signal:AbortSignal.timeout(30000)});const c=await r.json();if(!r.ok||!c.data?.length)throw Error('Catalog failed HTTP '+r.status);
 const receipt={platform:process.platform,arch:process.arch,node:process.version,catalogCount:c.data.length,inference:false};console.log('Live model catalog PASS:',c.data.length);
 if(process.argv.includes('--infer')){
 const model=c.data[0].id;
 const call=async extra=>{const r=await fetch(base+'/chat/completions',{method:'POST',headers,body:JSON.stringify({model,reasoning_effort:'low',response_format:{type:'text'},messages:[{role:'user',content:'Reply exactly BRIDGE_OK. Do not use tools.'}],...extra}),signal:AbortSignal.timeout(185000)});const raw=await r.text();if(!r.ok)throw Error('Inference HTTP '+r.status+': '+raw.slice(0,300));return raw;};
 const v=JSON.parse(await call({}));if(v.choices[0].message.content.trim()!=='BRIDGE_OK')throw Error('Unexpected test response');
 const stream=await call({stream:true});let text='',done=false; for(const line of stream.split('\n')) { if(line==='data: [DONE]'){done=true;continue;} if(!line.startsWith('data: '))continue; const event=JSON.parse(line.slice(6));if(event.error)throw Error('SSE: '+event.error.message);text+=event.choices?.[0]?.delta?.content||''; } if(!done||text.trim()!=='BRIDGE_OK')throw Error('SSE test failed: incomplete or unexpected text');
 receipt.inference=true;receipt.model=model;receipt.json=true;receipt.sse=true;console.log('Live JSON and SSE PASS:',model);
 if(process.argv.includes('--tools')){
 const messages=[{role:'user',content:'Call lookup with q="bridge". After receiving its result reply exactly TOOL_OK.'}];
 const tools=[{type:'function',function:{name:'lookup',description:'Synthetic lookup; Aide test client supplies the result.',parameters:{type:'object',properties:{q:{type:'string'}},required:['q'],additionalProperties:false}}}];
 const first=JSON.parse(await call({messages,tools})).choices[0];const tool=first.message.tool_calls?.[0];
 if(first.finish_reason!=='tool_calls'||tool?.function.name!=='lookup'||JSON.parse(tool.function.arguments).q!=='bridge')throw Error('Live tool handoff failed');
 messages.push(first.message,{role:'tool',tool_call_id:tool.id,content:'lookup succeeded'});
 const second=JSON.parse(await call({messages,tools,tool_choice:'none'})).choices[0];if(second.message.content?.trim()!=='TOOL_OK')throw Error('Live tool history replay failed');
 receipt.toolRoundTrip=true;console.log('Live dynamic tool handoff and history replay PASS');
 }

 }
 fs.mkdirSync('.agent-state',{recursive:true});fs.writeFileSync('.agent-state/live-acceptance.json',JSON.stringify(receipt,null,2)+'\n');
 }finally{server.shutdown();fs.rmSync(cwd,{recursive:true,force:true});}
})().catch(e=>{console.error(e.message);process.exitCode=1});
