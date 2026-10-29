'use strict';
// Linux-only native UI acceptance. All paths, config and CLI output are synthetic and temporary.
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),net=require('node:net'),assert=require('node:assert/strict'),{spawn}=require('node:child_process');
const {chromium}=require(process.env.AIDE_PLAYWRIGHT_MODULE||'playwright');
async function main(){
 assert.equal(process.platform,'linux','This fixture redirects Linux XDG data only; do not run against another platform user profile');
 const binary=path.resolve(process.env.AIDE_CODEX_MANAGER_TEST_BINARY||'dist/managers/linux-amd64-CodexBridgeManager'),out=path.resolve(process.env.AIDE_COMPONENT_EVIDENCE_DIR||'.agent-state/gui-cli-discovery');assert(fs.statSync(binary).isFile());fs.mkdirSync(out,{recursive:true});
 const probe=net.createServer();await new Promise((resolve,reject)=>probe.once('error',reject).listen(8788,'127.0.0.1',resolve));await new Promise(resolve=>probe.close(resolve));
 const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'codex-manager-gui602-')),bin=path.join(temporary,'GUI bin'),cli=path.join(bin,'codex'),root=path.join(temporary,'aide-codex-bridge');fs.mkdirSync(bin);fs.writeFileSync(cli,'#!'+process.execPath+"\nconsole.log('codex-cli 0.0.0-fixture')",{mode:0o755});
 const child=spawn(binary,[],{env:{...process.env,XDG_DATA_HOME:temporary,PATH:bin+path.delimiter+path.dirname(process.execPath)},stdio:'ignore'});let browser;
 try{
  const keyFile=path.join(temporary,'aide-codex-bridge-manager/control.key');let key='';for(let i=0;i<100;i++){if(fs.existsSync(keyFile)){key=fs.readFileSync(keyFile,'utf8').trim();try{const response=await fetch('http://127.0.0.1:8788/api/status',{headers:{Authorization:'Bearer '+key}});if(response.ok)break;}catch{}}await new Promise(resolve=>setTimeout(resolve,50));}assert(key,'owned manager initialized');
  browser=await chromium.launch({executablePath:process.env.AIDE_CHROMIUM||'/usr/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage']});const context=await browser.newContext(),page=await context.newPage(),errors=[],rows=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:8788/#'+key);const install=page.waitForResponse(r=>r.url().endsWith('/api/action')&&r.request().method()==='POST');await page.getByRole('button',{name:'安装／更新 Install/update',exact:true}).click();assert.equal((await install).status(),200);
  const config=path.join(root,'config.json'),settings=JSON.parse(fs.readFileSync(config,'utf8'));settings.codex='codex';settings.proxy='synthetic-proxy';settings.preserve='synthetic-settings';fs.writeFileSync(config,JSON.stringify(settings));
  for(const width of [1280,390]){
   await page.setViewportSize({width,height:900});const diagnostic=page.waitForResponse(r=>r.url().endsWith('/api/action')&&r.request().postDataJSON()?.action==='doctor');await page.getByRole('button',{name:'诊断 Diagnose',exact:true}).click();const response=await diagnostic;assert.equal(response.status(),200);assert.equal((await response.json()).codexFound,true);
   const saved=JSON.parse(fs.readFileSync(config,'utf8'));assert.equal(saved.codex,cli);assert.equal(saved.proxy,settings.proxy);assert.equal(saved.preserve,settings.preserve);for(const name of Object.keys(settings).filter(k=>k!=='codex'))assert.deepEqual(saved[name],settings[name]);
   await page.locator('summary').filter({hasText:'诊断详情'}).click();await page.screenshot({path:path.join(out,'manager-'+width+'.png')});await page.locator('summary').filter({hasText:'诊断详情'}).click();rows.push({width,status:'PASS',diagnosticStatus:200,verifiedPathPersisted:true,otherSettingsRetained:true});
  }
  const before=fs.readFileSync(config,'utf8');fs.writeFileSync(cli,'#!'+process.execPath+"\nconsole.log('not-codex')",{mode:0o755});const failed=page.waitForResponse(r=>r.url().endsWith('/api/action')&&r.request().postDataJSON()?.action==='doctor');await page.getByRole('button',{name:'诊断 Diagnose',exact:true}).click();assert.equal((await failed).status(),409);assert.equal(fs.readFileSync(config,'utf8'),before);rows.push({status:'PASS',invalidCliRejected:true,failedProbePreservesConfig:true});assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(rows,null,2)+'\n');console.log(JSON.stringify(rows));await context.close();
 }finally{
  if(browser)await browser.close();child.kill('SIGTERM');await new Promise(resolve=>{if(child.exitCode!==null)return resolve();const timer=setTimeout(()=>{child.kill('SIGKILL');resolve();},3000);child.once('exit',()=>{clearTimeout(timer);resolve();});});fs.rmSync(temporary,{recursive:true,force:true});
 }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
