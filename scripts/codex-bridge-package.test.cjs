'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const bundle = process.env.BRIDGE_BUNDLE_DIR || path.resolve(__dirname, '..', 'dist', 'stage');
if (!bundle) throw new Error('Set BRIDGE_BUNDLE_DIR to the generated package staging directory');
const manager = path.join(bundle, 'manage.cjs');
const state = path.resolve('.agent-state');
fs.mkdirSync(state, { recursive: true });
const target = fs.mkdtempSync(path.join(state, 'bridge install with spaces-'));
const execute = (...args) => spawnSync(process.execPath, [manager, ...args], { encoding: 'utf8' });

test('install to path with spaces; generate key; preserve config and key on update', () => {
  let result = execute('install', target);
  assert.equal(result.status, 0, result.stderr);
  const key = fs.readFileSync(path.join(target, 'data', 'bridge.key'), 'utf8');
  assert.match(key, /^[a-f0-9]{64}$/);
  const config = path.join(target, 'config.json');
  const value = JSON.parse(fs.readFileSync(config)); value.port = 18787;
  fs.writeFileSync(config, JSON.stringify(value));
  result = execute('install', target);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(fs.readFileSync(config)).port, 18787);
  assert.equal(fs.readFileSync(path.join(target, 'data', 'bridge.key'), 'utf8'), key);
  assert.deepEqual(fs.readFileSync(path.join(target, 'runtime', 'bridge.cjs')), fs.readFileSync(path.join(bundle, 'runtime', 'bridge.cjs')));
  if (process.platform !== 'win32') assert.equal(fs.statSync(path.join(target, 'data', 'bridge.key')).mode & 0o777, 0o600);
});
test('refuse to overwrite unrelated nonempty directory', () => {
  const other = fs.mkdtempSync(path.join(state, 'bridge-unrelated-'));
  fs.writeFileSync(path.join(other, 'keep'), 'original');
  assert.notEqual(execute('install', other).status, 0);
  assert.equal(fs.readFileSync(path.join(other, 'keep'), 'utf8'), 'original');
});
test('aide plugin declares executable diagnostic; has password-only diagnostic key and bounded local URL', async () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(bundle, 'manifest.json')));
  assert.equal(manifest.id, 'codex-bridge');
  assert.deepEqual(Object.keys(manifest.settingsSchema.properties), ['baseURL', 'bridgeKey']);
  assert.equal(manifest.settingsSchema.properties.bridgeKey.format, 'password');
  let tool;
  require(path.join(bundle, 'index.js')).apply({ settings: { baseURL: 'file:///invalid' }, tool(def) { if(def.name==='codex_bridge_connection_info') tool = def; } });
  assert.equal(tool.name, 'codex_bridge_connection_info');
  await assert.rejects(tool.handler(), /Invalid bridge URL/);
});
test('package syntax and launchers', () => {
  for (const file of ['index.js', 'manage.cjs', 'runtime/bridge.cjs']) assert.equal(spawnSync(process.execPath, ['--check', path.join(bundle, file)]).status, 0);
  for (const file of ['install.sh', 'start.sh', 'install.command', 'start.command', 'get-key.sh', 'get-key.command', 'uninstall.sh', 'uninstall.command']) {
    assert.equal(fs.readFileSync(path.join(bundle, file), 'utf8').startsWith('#!/bin/sh\n'), true);
    if (process.platform !== 'win32') assert.equal(spawnSync('sh', ['-n', path.join(bundle, file)]).status, 0);
  }
});

test('key access reads the installed service key without creating a second token', () => {
  const key = fs.readFileSync(path.join(target, 'data', 'bridge.key'), 'utf8').trim();
  const result = spawnSync(process.execPath, [path.join(target, 'manage.cjs'), 'key'], {encoding:'utf8'});
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), key);
  assert.equal(execute('key', target).stdout.trim(), key);
  const { readInstalledKey, keyHelp } = require(path.join(bundle, 'manage.cjs'));
  const absent = fs.mkdtempSync(path.join(state, 'uninstalled-key-'));
  assert.throws(() => readInstalledKey(absent), /not installed/);
  assert.equal(fs.existsSync(path.join(absent, 'data')), false);
  assert.match(keyHelp('C:\\Bridge','win32'), /get-key[.]cmd/);
  assert.match(keyHelp('/tmp/Bridge','darwin'), /get-key[.]command/);
  assert.match(keyHelp('/tmp/Bridge','linux'), /get-key[.]sh/);
  if(process.platform !== 'win32') {
    for (const name of ['get-key.sh','get-key.command']) {
      const r=spawnSync('sh',[path.join(target,name)],{encoding:'utf8'});
      assert.equal(r.status,0,r.stderr);assert.equal(r.stdout.trim(),key);
    }
  } else {
    const r=spawnSync(process.env.ComSpec||'cmd.exe',['/d','/c','get-key.cmd'],{cwd:target,encoding:'utf8',input:'\n'});
    assert.equal(r.status,0,r.stderr);assert.ok(r.stdout.includes(key));
  }
});

test('uninstall refuses active runtime and preserves key/config/unknown files across reinstall', () => {
  const directory=fs.mkdtempSync(path.join(state,'bridge uninstall 空格-'));
  let r=execute('install',directory);assert.equal(r.status,0,r.stderr);
  const keyFile=path.join(directory,'data','bridge.key'),configFile=path.join(directory,'config.json');
  const key=fs.readFileSync(keyFile,'utf8'),config=fs.readFileSync(configFile,'utf8');
  fs.writeFileSync(path.join(directory,'keep-note.txt'),'unrelated user file');
  const pid=path.join(directory,'data','manager.pid');fs.writeFileSync(pid,String(process.pid));
  r=execute('uninstall',directory);assert.notEqual(r.status,0);assert.match(r.stderr,/running/);
  assert.equal(fs.existsSync(path.join(directory,'manage.cjs')),true);
  assert.notEqual(execute('install',directory).status,0);fs.unlinkSync(pid);
  if(process.platform==='win32')r=spawnSync(process.env.ComSpec||'cmd.exe',['/d','/c','uninstall.cmd'],{cwd:directory,encoding:'utf8',input:'\n'});
  else r=spawnSync('sh',[path.join(directory,process.platform==='darwin'?'uninstall.command':'uninstall.sh')],{encoding:'utf8'});
  assert.equal(r.status,0,r.stderr);assert.equal(fs.existsSync(path.join(directory,'manage.cjs')),false);assert.equal(fs.existsSync(path.join(directory,'uninstall.cmd')),process.platform==='win32');
  assert.equal(fs.readFileSync(keyFile,'utf8'),key);assert.equal(fs.readFileSync(configFile,'utf8'),config);
  assert.equal(fs.readFileSync(path.join(directory,'keep-note.txt'),'utf8'),'unrelated user file');
  r=execute('install',directory);assert.equal(r.status,0,r.stderr);assert.equal(execute('key',directory).stdout.trim(),key.trim());
});

test('permission-loss recovery validates all launchers and preserves config, key and other files', {skip:process.platform==='win32'}, () => {
  const folder=fs.mkdtempSync(path.join(state,'permission lost package 空格-'));
  fs.cpSync(bundle,folder,{recursive:true});
  const {payload}=require(path.join(folder,'manage.cjs'));
  const launchers=payload.filter(n=>/\.(command|sh)$/.test(n));
  for(const n of launchers)fs.chmodSync(path.join(folder,n),0o644);
  const denied=spawnSync(path.join(folder,'install.command'),[path.join(folder,'installed')],{encoding:'utf8'});
  assert.equal(denied.error?.code,'EACCES');
  const keep=path.join(folder,'user-note');fs.writeFileSync(keep,'keep',{mode:0o600});
  const repair=spawnSync(process.execPath,[path.join(folder,'manage.cjs'),'repair-permissions'],{encoding:'utf8'});
  assert.equal(repair.status,0,repair.stderr);
  for(const n of launchers)assert.equal(fs.statSync(path.join(folder,n)).mode&0o777,0o755);
  assert.equal(fs.statSync(keep).mode&0o777,0o600);
  assert.equal(fs.readFileSync(keep,'utf8'),'keep');
  const installed=path.join(folder,'installed');
  const install=spawnSync(path.join(folder,'install.command'),[installed],{encoding:'utf8'});
  assert.equal(install.status,0,install.stderr);
  const key=fs.readFileSync(path.join(installed,'data/bridge.key'));
  const config=fs.readFileSync(path.join(installed,'config.json'));
  for(const n of launchers)fs.chmodSync(path.join(installed,n),0o644);
  const again=spawnSync(process.execPath,[path.join(installed,'manage.cjs'),'repair-permissions'],{encoding:'utf8'});
  assert.equal(again.status,0,again.stderr);
  assert.deepEqual(fs.readFileSync(path.join(installed,'data/bridge.key')),key);
  assert.deepEqual(fs.readFileSync(path.join(installed,'config.json')),config);
  const link=path.join(folder,launchers[launchers.length-1]);fs.unlinkSync(link);fs.symlinkSync(keep,link);
  fs.chmodSync(path.join(folder,launchers[0]),0o644);
  const refused=spawnSync(process.execPath,[path.join(folder,'manage.cjs'),'repair-permissions'],{encoding:'utf8'});
  assert.notEqual(refused.status,0);
  assert.equal(fs.statSync(path.join(folder,launchers[0])).mode&0o777,0o644);
  assert.equal(fs.statSync(keep).mode&0o777,0o600);
});
