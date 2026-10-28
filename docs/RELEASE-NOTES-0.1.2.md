# Codex Bridge 0.1.2 · Launcher permission recovery

macOS/Linux: added `node manage.cjs repair-permissions [package-directory]` for extracted or installed launchers whose executable bits were lost. Only the eight owned `.sh` and `.command` files become 0755, after validating the complete allowlist. Symlinks are rejected. Configuration, key, unknown files, system quarantine and networking are untouched. Installation output uses explicit shell commands; bilingual workbench and README show the recovery steps.

中文：修复解压/插件导入后 `.command` 执行位丢失时缺少恢复入口的问题（Issue #3）。可以在解压目录直接 `sh install.command` 安装，也可以先用 Node 修复脚本权限；无需 sudo 或 PowerShell。不是所有“没有权限”错误都由执行位引起，系统隔离、写入权限和账号授权问题仍需按实际报错诊断。

Validation reproduces EACCES with 0644 launchers, repairs and directly runs the real installer in a synthetic path with spaces, then verifies existing config/key preservation and symlink refusal. Cross-platform CI results are recorded in the release proof. No live-account inference, Aide core change or 9999 deployment is part of this patch.
