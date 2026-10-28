# Codex Bridge 0.2.0 · Native host manager

插件工作台新增实际执行的安装／更新、启动、停止、重启、诊断、权限修复和卸载按钮，不再只是显示 Shell 命令。首次下载并打开独立原生管理器，在图形页面安装并配对一次。后续从插件按钮操作即可。

Native manager assets: Windows, macOS and Linux × amd64/arm64. The manager embeds the allowlisted host payload and opens a loopback setup page. It requires Node.js 18+ and an existing signed-in Codex CLI to run inference, but not to open the manager. Initial setup does not require typing shell commands. Older external bridge instances must be closed once; only manager-owned processes are stopped. OS approval may be required for this unsigned preview; no protections are disabled.

Manager lifecycle authentication uses a separate pairing credential. Fixed JSON actions only; no raw command, arbitrary path, shell interpolation, firewall change, login-token copy or provider overwrite. Uninstall preserves config/model key and the manager for reinstall. Known macOS application Codex executables and common Node locations are detected to avoid GUI PATH failures (Issue #5). Manual launchers remain a fallback.

Validation includes real Node child-process startup/model listing/stop with synthetic Codex, persistent install/repair/uninstall, key/config preservation, authentication, Host/Origin checks, unknown action/field rejection, symlink refusal and native asset smoke tests. Final OS matrix and payload hashes are recorded in the release proof. No production Aide/9999 or MIXSoul deployment is included.
