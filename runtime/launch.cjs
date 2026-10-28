'use strict';
const fs = require('node:fs');
const path = require('node:path');
// Resolve npm Windows shims without cmd.exe, PowerShell, or user-controlled shell text.
function resolveLaunch(command, { platform = process.platform, env = process.env } = {}) {
  if (typeof command !== 'string' || !command.trim() || /[\r\n\0]/.test(command)) throw Error('Invalid Codex executable');
  const dirs = (env.PATH || env.Path || '').split(platform === 'win32' ? ';' : path.delimiter).filter(Boolean);
  const candidates = /[/\\]/.test(command) ? [path.resolve(command)] : dirs.flatMap(dir => platform === 'win32' ? ['', '.exe', '.cmd', '.bat'].map(ext => path.join(dir, command + ext)) : [path.join(dir, command)]);
  for (const file of candidates) {
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) continue;
    if (/\.(cmd|bat)$/i.test(file)) {
      // Only use the official npm package's JS entry next to the shim. Never execute the shim.
      const js = path.join(path.dirname(file), 'node_modules', '@openai', 'codex', 'bin', 'codex.js');
      if (!fs.existsSync(js)) throw Error('Codex shim has no @openai/codex JS entry; configure the native executable');
      return { command: process.execPath, prefix: [js] };
    }
    if (/\.[cm]?js$/i.test(file)) return { command: process.execPath, prefix: [file] };
    // npm on Windows also supplies an extensionless POSIX wrapper.
    if (platform === 'win32' && !path.extname(file)) continue;
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
