'use strict';
// Actual native manager + Chromium, Linux only; all state and CLI responses are synthetic.
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const net = require('node:net'), assert = require('node:assert/strict');
const {spawn} = require('node:child_process');
const {chromium} = require(process.env.AIDE_PLAYWRIGHT_MODULE || 'playwright');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function freePort(port = 0) {
 const server = net.createServer();
 await new Promise((resolve, reject) => server.once('error', reject).listen(port, '127.0.0.1', resolve));
 const chosen = server.address().port;
 await new Promise(resolve => server.close(resolve));
 return chosen;
}
async function main() {
 assert.equal(process.platform, 'linux', 'Only Linux XDG fixture isolation is supported');
 const binary = path.resolve(process.env.AIDE_CODEX_MANAGER_TEST_BINARY || 'dist/managers/linux-amd64-CodexBridgeManager');
 const out = path.resolve(process.env.AIDE_COMPONENT_EVIDENCE_DIR || '.agent-state/five-actions');
 assert(fs.statSync(binary).isFile()); fs.mkdirSync(out, {recursive:true});
 await freePort(8788); await freePort(8787);
 const port = await freePort(), temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-manager-five-'));
 const bin = path.join(temporary, 'GUI bin'), cli = path.join(bin, 'codex');
 const root = path.join(temporary, 'aide-codex-bridge'), config = path.join(root, 'config.json');
 fs.mkdirSync(bin);
 const cliBody = `if(process.argv.includes('--version')){console.log('codex-cli 0.0.0-fixture');process.exit(0)}
const r=require('node:readline').createInterface({input:process.stdin});r.on('line',line=>{const q=JSON.parse(line);if(q.id)console.log(JSON.stringify({id:q.id,result:q.method==='model/list'?{data:[{id:'synthetic-manager-model'}]}:{}}))});`;
 const writeCLI = body => fs.writeFileSync(cli, '#!' + process.execPath + '\n' + body, {mode:0o755});
 writeCLI(cliBody);
 const child = spawn(binary, [], {env:{...process.env, XDG_DATA_HOME:temporary, PATH:bin + path.delimiter + path.dirname(process.execPath)}, stdio:'ignore'});
 let browser;
 try {
  const keyFile = path.join(temporary, 'aide-codex-bridge-manager/control.key');
  let owner = '';
  for(let i=0;i<100;i++) {
   if(fs.existsSync(keyFile)) {
    owner = fs.readFileSync(keyFile, 'utf8').trim();
    try { if((await fetch('http://127.0.0.1:8788/api/status', {headers:{Authorization:'Bearer ' + owner}})).ok) break; } catch {}
   }
   await sleep(50);
  }
  assert(owner, 'Owned manager initialized');
  browser = await chromium.launch({executablePath:process.env.AIDE_CHROMIUM || '/usr/bin/chromium', args:['--no-sandbox', '--disable-dev-shm-usage']});
  const rows = [], errors = [];
  let savedKey;
  for(const profile of [{width:1280, colorScheme:'light', locale:'zh-CN'}, {width:390, colorScheme:'dark', locale:'zh-CN'}, {width:1280, colorScheme:'dark', locale:'en-US'}, {width:390, colorScheme:'light', locale:'en-US'}]) {
   const context = await browser.newContext({...profile, viewport:{width:profile.width, height:1000}});
   // Keep synthetic keys off the OS clipboard; exercise explicit copy failure too.
   await context.addInitScript(({reject}) => Object.defineProperty(navigator, 'clipboard', {value:{writeText:async()=>{if(reject)throw Error('fixture clipboard unavailable');}}}), {reject:profile.width===390});
   const page = await context.newPage();
   page.on('pageerror', e => errors.push(e.message));
   page.on('dialog', dialog => {errors.push('Unexpected native dialog: ' + dialog.type()); dialog.dismiss();});
   let actionRequests = 0;
   page.on('request', request => {if(request.url().endsWith('/api/action') && request.method()==='POST')actionRequests++;});
   async function action(id, expected=200) {
    await page.locator('#'+id).waitFor();
    const response = page.waitForResponse(r => r.url().endsWith('/api/action') && r.request().postDataJSON()?.action===id);
    await page.locator('#'+id).click();
    assert.equal((await response).status(), expected);
   }
   async function settled() { await page.waitForFunction(() => !document.querySelector('#install').disabled); }
   await page.goto('http://127.0.0.1:8788/#' + owner);
   await settled();
   assert.equal(await page.locator('#mainOperations > button').count(), 5);
   assert.equal(await page.locator('#advanced').evaluate(e=>e.open), false);
   assert.equal(await page.locator('#start').isDisabled(), true);
   await action('install'); await settled();
   const settings = JSON.parse(fs.readFileSync(config, 'utf8'));
   Object.assign(settings, {port, host:'127.0.0.1', codex:'codex', preserve:'synthetic-five-actions'});
   fs.writeFileSync(config, JSON.stringify(settings));
   await action('start');
   await page.waitForFunction(() => !document.querySelector('#stop').disabled);
   assert.equal(JSON.parse(fs.readFileSync(config, 'utf8')).codex, cli);
   const keyResponse = page.waitForResponse(r=>r.url().endsWith('/api/key'));
   await page.locator('#key').click(); assert.equal((await keyResponse).status(), 200);
   await page.waitForFunction(() => !document.querySelector('#key').disabled);
   const key = await page.locator('#bridgeKey').inputValue(); assert(key.length >= 32);
   if(savedKey)assert.equal(key, savedKey); savedKey = key;
   assert.equal(await page.locator('#bridgeKey').getAttribute('type'), 'password');
   const secondKey = page.waitForResponse(r=>r.url().endsWith('/api/key'));
   await page.locator('#key').click(); assert.equal((await secondKey).status(), 200);
   await page.waitForFunction(() => !document.querySelector('#key').disabled);
   assert.equal(await page.locator('#bridgeKey').inputValue(), key);
   if(profile.width===390)assert.equal(await page.locator('#bridgeKey').evaluate(e=>e.selectionEnd-e.selectionStart), key.length);
   const models = await fetch('http://127.0.0.1:'+port+'/v1/models', {headers:{Authorization:'Bearer '+key}});
   assert.equal(models.status, 200); assert.equal((await models.json()).data[0].id, 'synthetic-manager-model');
   await page.locator('#deployment').selectOption('native');
   assert.equal(await page.locator('#baseURL').inputValue(), 'http://127.0.0.1:'+port+'/v1');
   await page.screenshot({path:path.join(out, profile.width+'-'+profile.colorScheme+'.png')});
   await action('stop'); await settled();
   const beforeCancel = actionRequests;
   await page.locator('#uninstall').click(); await page.locator('#confirmation').waitFor({state:'visible'});
   await page.keyboard.press('Escape'); assert.equal(actionRequests, beforeCancel);
   assert.equal(await page.locator('#confirmation').isHidden(), true);
   await page.locator('#uninstall').click(); await page.locator('#cancelAction').click();
   assert.equal(actionRequests, beforeCancel);
   await page.locator('#uninstall').click();
   const removed = page.waitForResponse(r=>r.url().endsWith('/api/action') && r.request().postDataJSON()?.action==='uninstall');
   await page.locator('#confirmAction').click(); assert.equal((await removed).status(), 200); await settled();
   await page.waitForFunction(() => document.querySelector('#start').disabled);
   const retained = JSON.parse(fs.readFileSync(config,'utf8'));
   assert.equal(fs.readFileSync(path.join(root,'data/bridge.key'),'utf8').trim(), key);
   assert.equal(retained.preserve, 'synthetic-five-actions');
   assert.equal(await page.locator('#provider').isHidden(), true);
   rows.push({...profile, status:'PASS', fiveActions:true, syntheticModels200:true, keyReused:true, configRetained:true, inlineCancelAndConfirm:true});
   await context.close();
  }
  const context = await browser.newContext({locale:'zh-CN'}), page = await context.newPage();
  await page.goto('http://127.0.0.1:8788/#'+owner);
  await page.locator('#install').click(); await page.waitForFunction(()=>!document.querySelector('#start').disabled);
  writeCLI("console.log('not-codex')"); const before = fs.readFileSync(config,'utf8');
  const rejected = page.waitForResponse(r=>r.url().endsWith('/api/action') && r.request().postDataJSON()?.action==='start');
  await page.locator('#start').click(); assert.equal((await rejected).status(),409);
  await page.locator('#result.error').waitFor(); const message = await page.locator('#result').innerText();
  // Wait for an actual periodic status request, not an arbitrary sleep.
  await page.waitForResponse(r=>r.url().endsWith('/api/status'));
  await page.waitForResponse(r=>r.url().endsWith('/api/status'));
  assert.equal(await page.locator('#result').innerText(), message); assert.equal(fs.readFileSync(config,'utf8'), before);
  rows.push({status:'PASS', invalidCLI409:true, configUnchanged:true, errorSurvivesStatusPoll:true});
  await context.close(); assert.deepEqual(errors, []);
  fs.writeFileSync(path.join(out,'result.json'), JSON.stringify({rows, errors, realAccount:'NOT_RUN', otherOSGUI:'NOT_RUN'},null,2)+'\n');
  console.log(JSON.stringify(rows));
 } finally {
  if(browser)await browser.close();
  child.kill('SIGTERM');
  await new Promise(resolve=>{if(child.exitCode!==null)return resolve();const timer=setTimeout(()=>{child.kill('SIGKILL');resolve();},3000);child.once('exit',()=>{clearTimeout(timer);resolve();});});
  fs.rmSync(temporary, {recursive:true,force:true});
 }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
