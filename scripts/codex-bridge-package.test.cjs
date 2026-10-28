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
  for (const file of ['install.sh', 'start.sh', 'install.command', 'start.command']) {
    assert.equal(fs.readFileSync(path.join(bundle, file), 'utf8').startsWith('#!/bin/sh\n'), true);
    if (process.platform !== 'win32') assert.equal(spawnSync('sh', ['-n', path.join(bundle, file)]).status, 0);
  }
});
