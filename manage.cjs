#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const root = __dirname;
const { resolveLaunch } = require('./runtime/launch.cjs');
const payload = ['manifest.json', 'index.js','connection.cjs', 'config.example.json', 'manage.cjs', 'README.md', 'runtime/bridge.cjs', 'runtime/launch.cjs', 'viewer.html', 'LICENSE', 'uninstall.cmd', 'uninstall.command', 'uninstall.sh', 'get-key.cmd', 'get-key.command', 'get-key.sh', 'install.cmd', 'start.cmd', 'install.sh', 'start.sh', 'install.command', 'start.command'];
function defaultTarget(platform = process.platform, env = process.env, home = os.homedir()) {
  if (platform === 'win32') return path.win32.join(env.LOCALAPPDATA || path.win32.join(home, 'AppData', 'Local'), 'aide-codex-bridge');
  if (platform === 'darwin') return path.posix.join(home, 'Library', 'Application Support', 'aide-codex-bridge');
  return path.posix.join(env.XDG_DATA_HOME || path.posix.join(home, '.local', 'share'), 'aide-codex-bridge');
}
function install(target) {
  target = path.resolve(target);
  if (fs.existsSync(path.join(target, ".aide-codex-bridge"))) assertStopped(target);
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
  console.log('Installed: ' + target + '\nConfigure config.json, then run start.cmd (Windows), sh start.command (macOS), or sh start.sh (Linux).\nGet your local bridge key / 获取本地桥接密钥:\n' + keyHelp(target));
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

function keyHelp(target, platform = process.platform) {
  const launcher = platform === 'win32' ? 'get-key.cmd' : platform === 'darwin' ? 'get-key.command' : 'get-key.sh';
  const file = (platform === 'win32' ? path.win32 : path.posix).join(target, launcher);
  return (platform === 'win32' ? '' : 'sh ') + '"' + file + '"';
}
function readInstalledKey(target) {
  const candidates = target ? [path.resolve(target)] : [root, defaultTarget()];
  const installed = candidates.find(p => fs.existsSync(path.join(p, '.aide-codex-bridge')) && fs.existsSync(path.join(p, 'manage.cjs')));
  if (!installed) throw Error('Host bridge is not installed / 宿主桥接尚未安装。Extract the ZIP and run install.cmd (Windows), sh install.command (macOS), or sh install.sh (Linux). Importing only the Aide plugin is not host installation.');
  const file = path.join(installed, 'data', 'bridge.key');
  if (!fs.existsSync(file)) throw Error('Installed bridge key is missing; rerun the installer / 桥接密钥缺失，请重新运行安装器。');
  if (fs.lstatSync(installed).isSymbolicLink() || fs.lstatSync(path.dirname(file)).isSymbolicLink() || fs.lstatSync(file).isSymbolicLink()) throw Error('Refuse symbolic link key');
  const value = fs.readFileSync(file, 'utf8').trim();
  if (value.length < 32) throw Error('Bridge key is invalid; check the host installation / 桥接密钥无效，请检查宿主安装。');
  return value;
}

function assertStopped(directory) {
  if (fs.existsSync(directory) && fs.lstatSync(directory).isSymbolicLink()) throw Error('Refuse symbolic link installation');
  const data = path.join(directory, 'data');
  if (fs.existsSync(data) && fs.lstatSync(data).isSymbolicLink()) throw Error('Refuse symbolic link data directory');
  const file = path.join(directory, 'data', 'manager.pid');
  if (!fs.existsSync(file)) return;
  if (fs.lstatSync(file).isSymbolicLink()) throw Error('Refuse symbolic link PID record');
  const pid = Number(fs.readFileSync(file, 'utf8').trim());
  if (!Number.isInteger(pid) || pid < 1) throw Error('Invalid runtime PID record; verify the host service is stopped first');
  try { process.kill(pid, 0); } catch (e) {
    if (e.code === 'ESRCH') { fs.unlinkSync(file); return; }
    throw Error('Cannot verify host service state; stop it in its terminal before continuing');
  }
  throw Error('Host bridge is running. Press Ctrl+C in its terminal before install/uninstall / 请先在运行终端按 Ctrl+C 停止桥接。');
}
function uninstall(target, options = {}) {
  const directory = path.resolve(target || (fs.existsSync(path.join(root, '.aide-codex-bridge')) ? root : defaultTarget()));
  if (!fs.existsSync(path.join(directory, '.aide-codex-bridge')) || fs.lstatSync(directory).isSymbolicLink()) throw Error('Not a marked bridge installation / 此目录不是本组件安装目录');
  assertStopped(directory);
  // Validate the full allowlist before touching anything. Never recursively delete a user directory.
  for (const name of payload) {
    const file = path.join(directory, name);
    if (fs.existsSync(path.dirname(file)) && fs.lstatSync(path.dirname(file)).isSymbolicLink()) throw Error('Refuse symbolic link installation path');
    if (fs.existsSync(file) && !fs.lstatSync(file).isFile()) throw Error('Refuse non-file installation entry');
    if (fs.existsSync(file) && fs.lstatSync(file).isSymbolicLink()) throw Error('Refuse symbolic link installation entry');
  }
  for (const name of payload) {
    if (options.keepLauncher && process.platform === 'win32' && name === 'uninstall.cmd') continue;
    const file = path.join(directory, name);
    if (fs.existsSync(file)) fs.unlinkSync(file);
  }
  const runtime = path.join(directory, 'runtime');
  if (fs.existsSync(runtime) && fs.readdirSync(runtime).length === 0) fs.rmdirSync(runtime);
  fs.writeFileSync(path.join(directory, '.aide-codex-bridge'), 'settings-retained\n');
  console.log('Host bridge program files removed / 宿主桥接程序已卸载。\nConfiguration, bridge key and any active Windows uninstall launcher retained / 配置、密钥及当前 Windows 卸载入口保留于: '+directory+'\nCodex CLI, account login and Aide plugin are unchanged. Remove the Aide plugin separately in Plugins → Installed.');
}
function start() {
  if (!fs.existsSync(path.join(root, '.aide-codex-bridge'))) throw Error('Install the host component first / 请先安装宿主组件');
  assertStopped(root);
  const pidFile = path.join(root, 'data', 'manager.pid');
  fs.writeFileSync(pidFile, String(process.pid), {flag:'wx',mode:0o600});
  process.on('exit', () => { try { if (fs.readFileSync(pidFile,'utf8').trim() === String(process.pid)) fs.unlinkSync(pidFile); } catch {} });
  const c = JSON.parse(fs.readFileSync(path.join(root, 'config.json'), 'utf8'));
  const args = [path.join(root, 'runtime', 'bridge.cjs'), '--host', c.host, '--port', String(c.port), '--concurrency', String(c.concurrency), '--max-queue', String(c.maxQueue), '--queue-timeout-ms', String(c.queueTimeoutMs), '--key-file', ensureKey(root), '--codex', c.codex];
  if (c.proxy) args.push('--proxy', c.proxy);
  const child = spawn(process.execPath, args, { cwd: root, stdio: 'inherit', windowsHide: true });
  child.on('error', error => { console.error(error.message); process.exitCode = 1; });
  child.on('exit', code => { process.exitCode = code ?? 1; });
  process.on('SIGINT', () => child.kill('SIGINT'));
  process.on('SIGTERM', () => child.kill('SIGTERM'));
}
function repairPermissions(target = root) {
  const directory = path.resolve(target);
  if (process.platform === 'win32') throw Error('Executable-bit repair is only needed on macOS/Linux / Windows 无需修复执行位');
  const info = fs.lstatSync(directory);
  if (!info.isDirectory() || info.isSymbolicLink()) throw Error('Refuse symbolic link or non-directory target');
  const manifestPath = path.join(directory, 'manifest.json');
  if (fs.lstatSync(manifestPath).isSymbolicLink() || JSON.parse(fs.readFileSync(manifestPath, 'utf8')).id !== 'codex-bridge') throw Error('Not a Codex Bridge package');
  const files = payload.filter(name => /\.(sh|command)$/.test(name)).map(name => path.join(directory, name));
  // Validate the entire allowlist before modifying any file. Never traverse links.
  for (const file of files) { const stat = fs.lstatSync(file); if (!stat.isFile() || stat.isSymbolicLink()) throw Error('Refuse missing, non-file or symbolic link launcher'); }
  for (const file of files) fs.chmodSync(file, 0o755);
  console.log('Launcher permissions repaired (0755) / 启动脚本权限已修复: ' + files.length + '\nConfiguration, credentials and system quarantine settings were not changed.');
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
      case 'repair-permissions': repairPermissions(process.argv[3]); break;
      case 'uninstall': uninstall(process.argv[3]?.startsWith('--') ? undefined : process.argv[3], {keepLauncher:process.argv.includes('--keep-launcher')}); break;
      case 'key': console.log(readInstalledKey(process.argv[3])); break;
      default: console.log('node manage.cjs install [target-directory] | start | doctor | key [target-directory] | uninstall [target-directory] | repair-permissions [package-directory]');
    }
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { install, defaultTarget, payload, readInstalledKey, keyHelp, uninstall, assertStopped, repairPermissions };
