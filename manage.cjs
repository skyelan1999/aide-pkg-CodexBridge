#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const root = __dirname;
const { resolveLaunch } = require('./runtime/launch.cjs');
const payload = ['manifest.json', 'index.js', 'config.example.json', 'manage.cjs', 'README.md', 'runtime/bridge.cjs', 'runtime/launch.cjs', 'viewer.html', 'LICENSE', 'install.cmd', 'start.cmd', 'install.sh', 'start.sh', 'install.command', 'start.command'];
function defaultTarget(platform = process.platform, env = process.env, home = os.homedir()) {
  if (platform === 'win32') return path.win32.join(env.LOCALAPPDATA || path.win32.join(home, 'AppData', 'Local'), 'aide-codex-bridge');
  if (platform === 'darwin') return path.join(home, 'Library', 'Application Support', 'aide-codex-bridge');
  return path.join(env.XDG_DATA_HOME || path.join(home, '.local', 'share'), 'aide-codex-bridge');
}
function install(target) {
  target = path.resolve(target);
  if (fs.existsSync(target) && fs.readdirSync(target).length && !fs.existsSync(path.join(target, '.aide-codex-bridge'))) throw new Error('目标目录非空且不是本组件安装目录 / Target is not a bridge installation');
  fs.mkdirSync(target, { recursive: true, mode: 0o700 });
  if (fs.lstatSync(target).isSymbolicLink()) throw Error('Install target must not be a symbolic link');
  for (const name of payload) {
    const dest = path.join(target, name);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    if (fs.lstatSync(path.dirname(dest)).isSymbolicLink() || (fs.existsSync(dest) && fs.lstatSync(dest).isSymbolicLink())) throw Error('Refuse installation through symbolic links');
    if (path.resolve(root, name) !== dest) fs.copyFileSync(path.join(root, name), dest);
    if (/\.(sh|command)$/.test(name)) fs.chmodSync(dest, 0o755);
  }
  fs.writeFileSync(path.join(target, '.aide-codex-bridge'), 'aide-codex-bridge\n');
  if (!fs.existsSync(path.join(target, 'config.json'))) fs.copyFileSync(path.join(target, 'config.example.json'), path.join(target, 'config.json'));
  ensureKey(target);
  console.log('Installed: ' + target + '\nConfigure config.json, then run start.cmd (Windows) or start.command/start.sh (macOS/Linux).');
}
function ensureKey(directory) {
  const data = path.join(directory, 'data');
  if (fs.existsSync(data) && fs.lstatSync(data).isSymbolicLink()) throw Error('Refuse symbolic link data directory');
  fs.mkdirSync(data, { recursive: true, mode: 0o700 });
  const key = path.join(data, 'bridge.key');
  if (fs.existsSync(key) && fs.lstatSync(key).isSymbolicLink()) throw Error('Refuse symbolic link key');
  if (!fs.existsSync(key)) fs.writeFileSync(key, randomBytes(32).toString('hex'), { flag: 'wx', mode: 0o600 });
  return key;
}
function start() {
  const c = JSON.parse(fs.readFileSync(path.join(root, 'config.json'), 'utf8'));
  const args = [path.join(root, 'runtime', 'bridge.cjs'), '--host', c.host, '--port', String(c.port), '--concurrency', String(c.concurrency), '--max-queue', String(c.maxQueue), '--queue-timeout-ms', String(c.queueTimeoutMs), '--key-file', ensureKey(root), '--codex', c.codex];
  if (c.proxy) args.push('--proxy', c.proxy);
  const child = spawn(process.execPath, args, { cwd: root, stdio: 'inherit', windowsHide: true });
  child.on('error', error => { console.error(error.message); process.exitCode = 1; });
  child.on('exit', code => { process.exitCode = code ?? 1; });
  process.on('SIGINT', () => child.kill('SIGINT'));
  process.on('SIGTERM', () => child.kill('SIGTERM'));
}
function doctor() {
  console.log('Platform:', process.platform, process.arch, 'Node:', process.version);
  const file = path.join(root, 'config.json');
  const c = JSON.parse(fs.readFileSync(fs.existsSync(file) ? file : path.join(root, 'config.example.json'), 'utf8'));
  const launch = resolveLaunch(c.codex);
  const result = spawnSync(launch.command, [...launch.prefix, '--version'], { encoding: 'utf8', timeout: 10000, windowsHide: true });
  if (result.status !== 0) throw new Error('Cannot run Codex executable; install Codex CLI or set config.json codex to its executable path.');
  console.log(result.stdout.trim(), '\nRun codex login on this host before starting.');
}
if (require.main === module) {
  try {
    switch (process.argv[2]) {
      case 'install': install(process.argv[3] || defaultTarget()); break;
      case 'start': start(); break;
      case 'doctor': doctor(); break;
      case 'key': console.log(fs.readFileSync(ensureKey(root), 'utf8').trim()); break;
      default: console.log('node manage.cjs install [target-directory] | start | doctor | key');
    }
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { install, defaultTarget, payload };
