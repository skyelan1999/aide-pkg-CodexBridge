# Codex Bridge 0.1.1 · Guided lifecycle preview

Windows、macOS、Linux 的安装、取密钥和卸载流程现在都显示在插件工作台中。

- 宿主系统选择器与安装、获取密钥、启动、停止、卸载五项引导；区分宿主组件和 Aide 插件的安装/卸载。
- 新增 `get-key.cmd` / `get-key.command` / `get-key.sh`，安装器输出当前系统的完整入口。未安装时给出明确提示，不再在解压目录悄悄生成第二个密钥。
- 新增三端 `uninstall` 入口：仅移除程序文件，保留配置、密钥、标记和用户其他文件；重装沿用原密钥。新版运行入口有 PID 检查，运行时拒绝升级/卸载。旧版或直接启动的服务仍须先 Ctrl+C 停止。
- 不需要 PowerShell，不自动修改提供商、网络或 Codex 登录，不会把密钥发送到模型或聊天。Docker 内插件无法直接安装宿主程序；界面明确展示需要在宿主执行的命令及后续检查。

32 项测试覆盖安装升级、实际平台脚本、未安装取密钥、运行状态保护、卸载保留和重装。实际系统矩阵结果见本 Release 的 CI/proof；Mac 本地安装和原生 Aide 工作台检查单独记录。

Text-only model adapter and protocol behavior are unchanged. Windows/Linux live-account inference remains outside this release's acceptance. No Aide main-program Release or 9999 deployment is included.
