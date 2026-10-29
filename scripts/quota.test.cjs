'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {normalizeRateLimits,safeSnapshot}=require('../quota.cjs');
const {createServer}=require('../runtime/bridge.cjs');
const fixed=new Date('2026-10-29T03:00:00Z');
const primary={usedPercent:25,windowDurationMins:300,resetsAt:1793250000};
test('quota prefers per-bucket windows and clamps remaining without inventing data',()=>{
 const d=normalizeRateLimits({rateLimits:{primary:{usedPercent:99}},rateLimitsByLimitId:{codex:{limitName:'Codex',primary,secondary:{usedPercent:100,windowDurationMins:10080,resetsAt:1793800000}},other:{primary:{usedPercent:140}},unknown:{primary:{usedPercent:null}},empty:{}}},fixed);
 assert.equal(d.available,true);assert.equal(d.checkedAt,fixed.toISOString());assert.equal(d.buckets.length,2);assert.equal(d.buckets[0].primary.remainingPercent,75);assert.equal(d.buckets[0].secondary.remainingPercent,0);assert.equal(d.buckets[1].primary.remainingPercent,0);assert.equal(d.buckets[1].primary.resetsAt,null);
});
test('legacy, zero, null, missing, malformed and API-key-only quota never fabricate percentages',()=>{
 assert.equal(normalizeRateLimits({rateLimits:{primary:{usedPercent:0}}}).buckets[0].primary.remainingPercent,100);
 for(const result of [null,{}, {rateLimits:null},{rateLimits:{}},{rateLimits:{primary:{usedPercent:null}}},{rateLimits:{primary:{usedPercent:'25'}}},{rateLimits:{primary:{usedPercent:-1}}},{rateLimits:{primary:{usedPercent:NaN}}},{rateLimits:{primary:{usedPercent:Infinity}}},{rateLimitsByLimitId:{},rateLimits:{primary}}])assert.deepEqual(normalizeRateLimits(result,fixed),{available:false,buckets:[],checkedAt:fixed.toISOString(),reason:'no_data'});
});
test('public quota schema drops account details, preserves unknown reset and bounds metadata',()=>{
 const raw={available:true,email:'PRIVATE',token:'PRIVATE',checkedAt:fixed.toISOString(),buckets:[{id:'codex',label:'X'.repeat(300),primary:{...primary,resetsAt:1e15,token:'PRIVATE',remainingPercent:99},secondary:null}]};
 const out=safeSnapshot(raw);assert.equal(JSON.stringify(out).includes('PRIVATE'),false);assert.equal(out.buckets[0].label.length,120);assert.equal(out.buckets[0].primary.remainingPercent,75);assert.equal(out.buckets[0].primary.resetsAt,null);
 assert.equal(normalizeRateLimits({rateLimitsByLimitId:Object.fromEntries(Array.from({length:40},(_,i)=>['b'+i,{primary}]))}).buckets.length,32);
});
async function fixture(t,response,fail=false){
 const calls=[];let closed=0;
 const server=createServer({key:'quota-fixture',timeout:200,maxConcurrent:1,rpcFactory:()=>({async initialize(){calls.push('initialize')},async call(method){calls.push(method);if(fail)throw Error('PRIVATE account failed');return response},close(){closed++}})});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>server.shutdown());
 const url='http://127.0.0.1:'+server.address().port;
 return {calls,get:auth=>fetch(url+'/v1/usage',{headers:auth?{Authorization:'Bearer quota-fixture'}:{}}),closed:()=>closed};
}
test('authenticated quota endpoint only reads rate limits and closes the isolated RPC',async t=>{
 const f=await fixture(t,{rateLimits:{primary},token:'PRIVATE'});assert.equal((await f.get(false)).status,401);assert.deepEqual(f.calls,[]);
 const res=await f.get(true);assert.equal(res.status,200);const d=await res.json();assert.equal(d.buckets[0].primary.remainingPercent,75);assert.equal(JSON.stringify(d).includes('PRIVATE'),false);assert.deepEqual(f.calls,['initialize','account/rateLimits/read']);assert.ok(f.closed()>0);
});
test('unsupported/read failure is explicitly unavailable and never leaks upstream errors',async t=>{
 const f=await fixture(t,null,true);const res=await f.get(true);assert.equal(res.status,200);const d=await res.json();assert.equal(d.available,false);assert.equal(d.reason,'unavailable');assert.deepEqual(d.buckets,[]);assert.equal(JSON.stringify(d).includes('PRIVATE'),false);
});
