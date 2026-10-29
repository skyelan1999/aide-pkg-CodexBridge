'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawnSync}=require('node:child_process');
const {resolveLaunch}=require(process.env.AIDE_CODEX_LAUNCH_BASELINE||'../runtime/launch.cjs');
const makeHome=t=>{const home=fs.mkdtempSync(path.join(os.tmpdir(),'codex gui fixture '));t.after(()=>fs.rmSync(home,{recursive:true,force:true}));return home;};
function cli(file,body="console.log('codex-cli 0.0.0-fixture')"){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,'#!'+process.execPath+'\n'+body,{mode:0o755});}
test('GUI PATH discovers latest known NVM CLI without shell initialization',t=>{
 const home=makeHome(t),old=path.join(home,'.nvm/versions/node/v20.9.0/bin/codex'),latest=path.join(home,'.nvm/versions/node/v24.10.0/bin/codex');cli(old);cli(latest);
 const launch=resolveLaunch('codex',{platform:'darwin',home,env:{PATH:''}});assert.equal(launch.command,latest);
 if(process.platform!=='win32'){const result=spawnSync(launch.command,[...launch.prefix,'--version'],{encoding:'utf8',env:{PATH:''}});assert.equal(result.status,0,result.stderr);assert.match(result.stdout,/codex-cli/);}
});
test('Windows GUI npm fallback executes only the official JS entry',t=>{
 const home=makeHome(t),app=path.join(home,'Roaming'),dir=path.join(app,'npm'),entry=path.join(dir,'node_modules/@openai/codex/bin/codex.js');cli(path.join(dir,'codex.cmd'),'this file is never executed');cli(entry);
 assert.deepEqual(resolveLaunch('codex',{platform:'win32',home,env:{PATH:'',APPDATA:app}}),{command:process.execPath,prefix:[entry]});
});
test('explicit paths never fall back and PATH takes precedence over discovery',t=>{
 const home=makeHome(t),fallback=path.join(home,'.local/bin/codex'),preferred=path.join(home,'preferred/codex');cli(fallback);cli(preferred);
 assert.equal(resolveLaunch('codex',{platform:'linux',home,env:{PATH:path.dirname(preferred)}}).command,preferred);
 assert.throws(()=>resolveLaunch(path.join(home,'missing/codex'),{platform:'linux',home,env:{PATH:path.dirname(preferred)}}),/not found/);
});
test('doctor JSON verifies only a synthetic CLI and preserves configuration on failure',t=>{
 const home=makeHome(t),manage=path.join(home,'manage.cjs'),config=path.join(home,'config.json'),fake=path.join(home,'synthetic codex.cjs');fs.copyFileSync(path.resolve('manage.cjs'),manage);fs.mkdirSync(path.join(home,'runtime'));fs.copyFileSync(path.resolve('runtime/launch.cjs'),path.join(home,'runtime/launch.cjs'));cli(fake);
 const original=JSON.stringify({codex:fake,host:'127.0.0.1',port:8787,proxy:'synthetic-proxy',concurrency:10,marker:'preserve'});fs.writeFileSync(config,original);
 let result=spawnSync(process.execPath,[manage,'doctor','--json'],{encoding:'utf8',env:{PATH:''}});assert.equal(result.status,0,result.stderr);assert.deepEqual(JSON.parse(result.stdout),{executablePath:fake,version:'codex-cli 0.0.0-fixture'});assert.equal(fs.readFileSync(config,'utf8'),original);
 cli(fake,"console.log('unexpected tool 1.0')");result=spawnSync(process.execPath,[manage,'doctor','--json'],{encoding:'utf8'});assert.equal(result.status,1);assert.equal(fs.readFileSync(config,'utf8'),original);
});
