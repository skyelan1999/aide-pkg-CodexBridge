'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../cmd/host-manager/ui.html'),'utf8');
function fixture({clipboard=true,owner=true,statusFailure=0,hangAction=false}={}){
 const nodes={};for(const m of html.matchAll(/\bid="([^"]+)"/g))nodes[m[1]]={id:m[1],textContent:'',value:'',hidden:/^(provider|confirmation)$/.test(m[1]),disabled:false,attrs:{},setAttribute(k,v){this.attrs[k]=v},classList:{toggle(){}},focus(){this.focused=true},select(){this.selected=true}};
 const primary=[...html.match(/<div id="mainOperations"[\s\S]*?<\/div>/)[0].matchAll(/<button id="([^"]+)"/g)].map(m=>m[1]);nodes.mainOperations.children=primary.map(id=>nodes[id]);for(const id of primary){const span={};nodes[id].querySelector=()=>span}
 const actions=['install','start','stop','uninstall','doctor','repair'];for(const id of actions)nodes[id].dataset={action:id};nodes.deployment.value='docker';
 const events={},calls=[],copied=[];let state={installed:false,running:false,nodeFound:true,codexFound:true,port:18787},failAction=false,tick;
 const context={window:{addEventListener(){}},document:{getElementById:id=>{if(!nodes[id])throw Error('Missing DOM id '+id);return nodes[id]},documentElement:{},querySelectorAll:()=>actions.map(id=>nodes[id]),addEventListener:(k,fn)=>events[k]=fn},location:{hash:owner?'#'+'a'.repeat(64):''},history:{replaceState(){}},navigator:{language:'zh-CN',clipboard:{async writeText(s){if(!clipboard)throw Error('Denied');copied.push(s)}}},setInterval:fn=>tick=fn,AbortController,TypeError,setTimeout:(fn,ms)=>setTimeout(fn,hangAction?5:ms),clearTimeout,Date,JSON,console,
 async fetch(route,request){calls.push([route,request]);if(route==='/api/status'&&statusFailure)return {status:statusFailure,ok:false,async json(){return {error:'AUTH FAILED'}}};if(route==='/api/action'&&hangAction)return new Promise((resolve,reject)=>request.signal.addEventListener('abort',()=>reject(Object.assign(Error('timeout'),{name:'AbortError'}))));let data={...state},status=200;if(route==='/api/action'){if(failAction)return {ok:false,async json(){return {error:'SYNTHETIC ACTION FAILED'}}};const a=JSON.parse(request.body).action;if(a==='install')state.installed=true;if(a==='start')state.running=true;if(a==='stop')state.running=false;if(a==='uninstall')state.installed=false;data={...state}}else if(route==='/api/key')data={bridgeKey:'c'.repeat(64),created:false};return {ok:status===200,async json(){return data}}}};
 vm.runInNewContext([...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]).join('\n'),context);
 const settle=async()=>{for(let i=0;i<12;i++)await new Promise(r=>setImmediate(r))};
 return {nodes,calls,copied,events,state,settle,async click(id){if(!nodes[id].disabled)nodes[id].onclick();await settle()},async tick(){tick();await settle()},fail(){failAction=true}};
}
test('five primary actions; local install/start/stop/key need no pairing, custom port and key stay correct',async()=>{
 const f=fixture();await f.settle();assert.deepEqual(f.nodes.mainOperations.children.map(n=>n.id),['install','start','stop','uninstall','key']);assert.equal(f.nodes.advanced.hidden,false);assert.equal(f.nodes.start.attrs['aria-disabled'],'true');
 await f.click('install');assert.equal(f.nodes.start.disabled,false);await f.click('start');assert.equal(f.nodes.stop.disabled,false);assert.equal(f.nodes.uninstall.attrs['aria-disabled'],'true');
 await f.click('key');assert.equal(f.nodes.bridgeKey.value,'c'.repeat(64));assert.equal(f.copied[0],'c'.repeat(64));assert.equal(f.nodes.baseURL.value,'http://host.docker.internal:18787/v1');assert.match(f.nodes.result.textContent,/已有密钥已复制/);
 await f.click('stop');assert.equal(f.nodes.uninstall.disabled,false);assert.equal(f.nodes.stop.attrs['aria-disabled'],'true');assert.equal(f.calls.some(([r])=>r.includes('pair')),false);
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

test('GUI PATH hint does not prevent the verified backend discovery at Start',async()=>{
 const f=fixture();await f.settle();await f.click('install');f.state.codexFound=false;await f.tick();assert.equal(f.nodes.start.disabled,false);await f.click('start');assert.equal(f.state.running,true);
});

test('blocked install stays explanatory and never dispatches to an external or running bridge',async()=>{
 const f=fixture();await f.settle();f.state.externalBridge=true;await f.tick();
 assert.equal(f.nodes.install.disabled,false);assert.equal(f.nodes.install.attrs['aria-disabled'],'true');
 await f.click('install');assert.match(f.nodes.result.textContent,/其他方式启动/);assert.equal(f.calls.some(([r])=>r==='/api/action'),false);
 f.state.externalBridge=false;await f.tick();await f.click('install');await f.click('start');const before=f.calls.filter(([r])=>r==='/api/action').length;
 await f.click('install');assert.match(f.nodes.result.textContent,/先点击.*停止/);assert.equal(f.calls.filter(([r])=>r==='/api/action').length,before);
});
test('missing owner after refresh and invalid owner produce visible recovery and no install request',async()=>{
 for(const options of [{owner:false},{statusFailure:401}]){
  const f=fixture(options);await f.settle();await f.click('install');assert.match(f.nodes.result.textContent,/重新|无法连接/);
  assert.equal(f.calls.some(([r])=>r==='/api/action'),false);assert.notEqual(f.nodes.state.textContent,'尚未安装');
 }
});
test('stalled install ends with a visible timeout, unlocks controls and does not retry the action',async()=>{
 const f=fixture({hangAction:true});await f.settle();await f.click('install');await new Promise(r=>setTimeout(r,30));await f.settle();
 assert.match(f.nodes.result.textContent,/超时/);assert.equal(f.nodes.install.disabled,false);assert.equal(f.calls.filter(([r])=>r==='/api/action').length,1);
});
