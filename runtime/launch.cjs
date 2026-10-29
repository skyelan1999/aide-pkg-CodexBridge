'use strict';
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
// Resolve npm Windows shims without cmd.exe, PowerShell, or user-controlled shell text.
function resolveLaunch(command, { platform = process.platform, env = process.env, home = os.homedir() } = {}) {
  if (typeof command !== 'string' || !command.trim() || /[\r\n\0]/.test(command)) throw Error('Invalid Codex executable');
  const dirs = (env.PATH || env.Path || '').split(platform === 'win32' ? ';' : path.delimiter).filter(Boolean);
  const explicit = /[/\\]/.test(command);
  if (!explicit && command === 'codex') {
    // GUI sessions do not inherit interactive shell rc files. Only inspect known CLI locations.
    dirs.push(...['.local/bin', '.npm-global/bin', '.volta/bin', '.nvm/current/bin'].map(dir => path.join(home, dir)));
    try {
      const root = path.join(home, '.nvm', 'versions', 'node');
      const versions = fs.readdirSync(root, {withFileTypes:true}).filter(entry => entry.isDirectory() && /^v\d+\.\d+\.\d+$/.test(entry.name)).sort((a,b) => b.name.localeCompare(a.name, 'en', {numeric:true}));
      dirs.push(...versions.slice(0,32).map(entry => path.join(root, entry.name, 'bin')));
    } catch {}
    if (platform === 'win32') {
      if (env.APPDATA) dirs.push(path.join(env.APPDATA, 'npm'));
      if (env.LOCALAPPDATA) dirs.push(path.join(env.LOCALAPPDATA, 'Programs', 'nodejs'));
    } else {
      dirs.push('/opt/homebrew/bin', '/usr/local/bin', '/usr/bin');
      if (platform === 'darwin') for (const root of ['/Applications', path.join(home, 'Applications')]) {
        dirs.push(path.join(root, 'ChatGPT.app/Contents/Resources/codex-cli/CodexCLI.app/Contents/MacOS'), path.join(root, 'Codex.app/Contents/Resources'));
      }
    }
  }
  const candidates = explicit ? [path.resolve(command)] : [...new Set(dirs)].flatMap(dir => platform === 'win32' ? ['', '.exe', '.cmd', '.bat'].map(ext => path.resolve(dir, command + ext)) : [path.resolve(dir, command)]);
  for (const file of candidates) {
    try { if (!fs.statSync(file).isFile()) continue; } catch { continue; }
    if (/\.(cmd|bat)$/i.test(file)) {
      // Only use the official npm package's JS entry next to the shim. Never execute the shim.
      const js = path.join(path.dirname(file), 'node_modules', '@openai', 'codex', 'bin', 'codex.js');
      if (!fs.existsSync(js)) { if (!explicit) continue; throw Error('Codex shim has no @openai/codex JS entry; configure the native executable'); }
      return { command: process.execPath, prefix: [js] };
    }
    if (/\.[cm]?js$/i.test(file)) return { command: process.execPath, prefix: [file] };
    // npm on Windows also supplies an extensionless POSIX wrapper.
    if (platform === 'win32' && !path.extname(file)) continue;
    if (platform !== 'win32') { try { fs.accessSync(file, fs.constants.X_OK); } catch { continue; } }
    return { command: file, prefix: [] };
  }
  throw Error('Codex executable not found; install Codex CLI and configure its path');
}
function terminate(child) {
  if (!child?.pid) return;
  if (process.platform === 'win32') {
    const { spawn } = require('node:child_process');
    const systemRoot = process.env.SystemRoot || 'C:\\Windows';
    const killer = spawn(path.join(systemRoot, 'System32', 'taskkill.exe'), ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
    killer.on('error', () => child.kill());
  } else {
    try { process.kill(-child.pid, 'SIGTERM'); } catch { child.kill(); }
    const timer = setTimeout(() => { try { process.kill(-child.pid, 'SIGKILL'); } catch {} }, 1500);
    timer.unref();
    child.once('exit', () => clearTimeout(timer));
  }
}
module.exports = { resolveLaunch, terminate };
