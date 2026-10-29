# Codex Bridge · Codex 模型桥接

独立 Aide 插件与本机桥接程序，支持 Windows、macOS、Linux。当前公开预览版 **0.3.4**；实际发布状态以[Release](https://github.com/skyelan1999/aide-pkg-CodexBridge/releases)为准。

## Windows：解压后直接打开

下载对应系统/架构的宿主安装包，**完整解压**，双击 **CodexBridgeManager.exe**。不要在 ZIP 内直接运行。

安装包已包含宿主管理器、内嵌桥接程序，以及同版 `codex-bridge-0.3.4.zip` 插件包；无需克隆仓库或另找源码。需要插件工作台时，将这个插件 ZIP 导入 Aide 即可。宿主安装不下载仓库、不使用 PowerShell。

macOS 打开包内的 **Codex Bridge Manager.app**；Linux 打开 **CodexBridgeManager**。运行桥接需要本机已有 **Node.js 18+** 和已登录的 **Codex CLI**；这两个第三方依赖及账号凭据不包含在发行包中，也不会被静默安装或修改。

## 就五个操作

| 按钮 | 行为 |
| --- | --- |
| 安装 | 从内嵌程序包安装或更新桥接，保留配置和已有密钥 |
| 启动 | 启动本机桥接 |
| 停止 | 停止管理器启动的桥接 |
| 卸载 | 移除桥接程序，保留配置、密钥和独立管理器，便于重新安装 |
| 生成密钥 | 已有密钥时直接复制并复用；不会轮换或让现有模型配置失效 |

第一次使用：**安装 → 启动 → 生成密钥**。将显示的 API 地址和密钥填入 Aide 的模型提供商加密设置，获取模型后发送一条测试消息。Docker Desktop 使用 `host.docker.internal`；原生 Aide 使用 `127.0.0.1`。页面会显示安装配置里的实际端口。

本机五个操作不需要先配对。只有需要从 Aide 插件远程控制宿主、读模型目录或查看额度时，才打开管理器 **更多设置**，生成两分钟有效的一次性连接码，填入插件工作台。连接码与模型 API 密钥各有用途，长期管理凭据不需要手工填写。诊断、启动器修复和撤销连接也收在更多设置中。

更新时先退出旧管理器，再使用新版。其他方式启动的桥接需由你先关闭一次；管理器不会擅自停止外部进程。关闭网页不会停止服务；在更多设置中退出管理器会停止其拥有的桥接。

## English quick guide

Extract the complete host archive and open `CodexBridgeManager.exe` on Windows, `Codex Bridge Manager.app` on macOS or `CodexBridgeManager` on Linux. The archive includes the matching plugin ZIP and the executable embeds the bridge payload. Installation does not fetch repository source. Node.js 18+ and a signed-in Codex CLI are prerequisites, not bundled dependencies.

The main window has five actions only: **Install, Start, Stop, Uninstall, Generate key**. Existing configuration and keys survive updates/uninstall; key generation reuses an existing key. Add the displayed API URL/key to Aide's encrypted provider settings. A model catalog does not prove inference entitlement.

Local management needs no pairing. Optional plugin controls and quota access use a one-time connection code under **More settings**. Diagnostic and client-administration controls are secondary. Update the plugin and manager together; older terminal-launched bridges must be stopped by their owner first.

## Capability and acceptance boundaries

Text Chat Completions, SSE, dynamic tool handoff and bounded concurrency are supported. The bridge does not import desktop chats, execute Aide tools itself, support image/audio input or fabricate token usage. Codex sends selected text to its configured provider under the signed-in OS account; this is not offline inference or a credential sandbox.

The plugin quota panel reads `account/rateLimits/read` only. Separate account buckets/windows show remaining percentage and reset time; missing or failed reads stay unavailable. This is shared account quota, not currency balance. The development host's real quota fetch was unavailable in the preceding acceptance; no real-account quota success is implied by synthetic screenshots or CI. No reset credits are consumed.

Keys are not model-tool results. Native model-key access requires the owner setup window. Plugin pairing stores permission-restricted private client state outside ordinary settings; it is not claimed to be encrypted against same-account programs. No automatic provider overwrite, account login, firewall change, startup task or dependency install.

## Development and records

```sh
node scripts/build.cjs
python3 scripts/package-codex-bridge.py --out dist
npm test
```

Native archives and embedded payload identity are checked by `scripts/verify-host-bundle.py`. See [architecture](docs/ARCHITECTURE.md), [version policy](docs/VERSIONING.md), [source provenance](docs/PROVENANCE.md), [advanced CLI fallback](docs/ADVANCED-CLI.md) and the version-specific acceptance record. Native managers are unsigned previews; normal OS approval may be required. Checksums verify bytes, not publisher identity. Codex binaries, login tokens and user chats are not redistributed. Wrapper/runtime license: MIT.

Public-plugin bugs, requests and acceptance summaries belong in [Aide Issues](https://github.com/skyelan1999/aide/issues), identified as Codex Bridge and linked to this implementation repository. Do not upload keys or real account/chat data.

## 图形启动时的 CLI 查找 / GUI CLI discovery

启动时会检查并验证 Codex CLI，支持常用 Homebrew、npm、NVM、Volta 及 macOS 应用位置，成功后仅保存已核验的 CLI 路径。找不到时可在更多设置检查环境；失败不会覆盖原配置或账号。Windows npm 安装通过 Node 运行官方 JS 入口，不执行 shell。

### 安装按钮反馈 / Install feedback

0.3.3 会说明按钮为什么暂时不能执行；连接失败、失效的管理器页面和请求超时均显示错误，不再只保持“尚未安装”。请求超时不表示后台操作已取消，请等待状态检查后再决定是否重试。若页面刷新后失去连接，请重新双击管理器。Windows 请使用新版 Edge/Chrome/Firefox，不使用 Internet Explorer。

Blocked actions now explain the unmet prerequisite without issuing a mutation. Lost authorization, unavailable managers and stalled requests produce visible recovery messages. Timeouts do not cancel a server-side installation or automatically retry it. Reopen the native application after a page reload loses authorization. On Windows use a current Edge, Chrome or Firefox, not Internet Explorer.

### Aide 上传兼容 / Aide upload compatibility

0.3.4 将插件入口编译为自包含文件，修复上传 ZIP 时 `Cannot find module './connection.cjs'`。在 Aide 上传本包的 `codex-bridge-0.3.4.zip`，不是 GitHub 自动生成的 Source code ZIP，也不是宿主管理器外层安装包。现有 Aide 无需为此升级。

The generated plugin entry is self-contained for Aide's entry-only upload validator. Import `codex-bridge-0.3.4.zip`, not the GitHub source archive or the outer native-manager archive. This patch needs no Aide core update.
