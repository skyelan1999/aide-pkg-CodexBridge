'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../cmd/host-manager/ui.html'),'utf8');
function fixture({clipboard=true}={}){
 const nodes={};for(const m of html.matchAll(/\bid="([^"]+)"/g))nodes[m[1]]={id:m[1],textContent:'',value:'',hidden:/^(provider|confirmation)$/.test(m[1]),disabled:false,classList:{toggle(){}},focus(){this.focused=true},select(){this.selected=true}};
 const primary=[...html.match(/<div id="mainOperations"[\s\S]*?<\/div>/)[0].matchAll(/<button id="([^"]+)"/g)].map(m=>m[1]);nodes.mainOperations.children=primary.map(id=>nodes[id]);for(const id of primary){const span={};nodes[id].querySelector=()=>span}
 const actions=['install','start','stop','uninstall','doctor','repair'];for(const id of actions)nodes[id].dataset={action:id};nodes.deployment.value='docker';
 const events={},calls=[],copied=[];let state={installed:false,running:false,nodeFound:true,codexFound:true,port:18787},failAction=false,tick;
 const context={document:{getElementById:id=>{if(!nodes[id])throw Error('Missing DOM id '+id);return nodes[id]},documentElement:{},querySelectorAll:()=>actions.map(id=>nodes[id]),addEventListener:(k,fn)=>events[k]=fn},location:{hash:'#'+'a'.repeat(64)},history:{replaceState(){}},navigator:{language:'zh-CN',clipboard:{async writeText(s){if(!clipboard)throw Error('Denied');copied.push(s)}}},setInterval:fn=>tick=fn,Date,JSON,console,
 async fetch(route,request){calls.push([route,request]);let data={...state},status=200;if(route==='/api/action'){if(failAction)return {ok:false,async json(){return {error:'SYNTHETIC ACTION FAILED'}}};const a=JSON.parse(request.body).action;if(a==='install')state.installed=true;if(a==='start')state.running=true;if(a==='stop')state.running=false;if(a==='uninstall')state.installed=false;data={...state}}else if(route==='/api/key')data={bridgeKey:'c'.repeat(64),created:false};return {ok:status===200,async json(){return data}}}};
 vm.runInNewContext(html.match(/<script>([\s\S]*?)<\/script>/)[1],context);
 const settle=async()=>{for(let i=0;i<12;i++)await new Promise(r=>setImmediate(r))};
 return {nodes,calls,copied,events,state,settle,async click(id){nodes[id].onclick();await settle()},async tick(){tick();await settle()},fail(){failAction=true}};
}
test('five primary actions; local install/start/stop/key need no pairing, custom port and key stay correct',async()=>{
 const f=fixture();await f.settle();assert.deepEqual(f.nodes.mainOperations.children.map(n=>n.id),['install','start','stop','uninstall','key']);assert.equal(f.nodes.advanced.hidden,false);assert.equal(f.nodes.start.disabled,true);
 await f.click('install');assert.equal(f.nodes.start.disabled,false);await f.click('start');assert.equal(f.nodes.stop.disabled,false);assert.equal(f.nodes.uninstall.disabled,true);
 await f.click('key');assert.equal(f.nodes.bridgeKey.value,'c'.repeat(64));assert.equal(f.copied[0],'c'.repeat(64));assert.equal(f.nodes.baseURL.value,'http://host.docker.internal:18787/v1');assert.match(f.nodes.result.textContent,/已有密钥已复制/);
 await f.click('stop');assert.equal(f.nodes.uninstall.disabled,false);assert.equal(f.nodes.stop.disabled,true);assert.equal(f.calls.some(([r])=>r.includes('pair')),false);
 for(const [route,r]of f.calls){assert.match(route,/^\/api\//);assert.equal(r.headers.Authorization,'Bearer '+'a'.repeat(64));assert.equal(r.headers['X-Manager-Owner-UI'],'1')}
});
test('uninstall is an inline confirmation; cancel/Escape never dispatch and confirm clears displayed key',async()=>{
 const f=fixture();await f.settle();await f.click('install');await f.click('key');const actions=()=>f.calls.filter(([r,q])=>r==='/api/action'&&JSON.parse(q.body).action==='uninstall').length;
 await f.click('uninstall');assert.equal(f.nodes.confirmation.hidden,false);assert.equal(actions(),0);await f.click('cancelAction');assert.equal(f.nodes.confirmation.hidden,true);assert.equal(actions(),0);
 await f.click('uninstall');f.events.keydown({key:'Escape'});assert.equal(f.nodes.confirmation.hidden,true);assert.equal(actions(),0);
 await f.click('uninstall');await f.click('confirmAction');assert.equal(actions(),1);assert.equal(f.state.installed,false);assert.equal(f.nodes.bridgeKey.value,'');assert.equal(f.nodes.provider.hidden,true);
});
test('failed action survives subsequent status refresh; clipboard denial gives a real fallback',async()=>{
 const f=fixture({clipboard:false});await f.settle();await f.click('install');await f.click('key');assert.equal(f.nodes.bridgeKey.selected,true);assert.match(f.nodes.result.textContent,/请复制/);
 f.fail();await f.click('start');assert.equal(f.nodes.result.textContent,'SYNTHETIC ACTION FAILED');await f.tick();assert.equal(f.nodes.result.textContent,'SYNTHETIC ACTION FAILED');assert.equal(f.nodes.state.textContent,'已安装，已停止');
});
