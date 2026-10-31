Version 0.4.1 requires Aide provider-account-quota-v1 support (a capable source build, or a compatible future release; marketplace release floor RC2). Older hosts must keep 0.4.0. The local bridge host must support /v1/usage (0.3.0+).

# Codex Bridge 0.4.0 — Aide 内管理 / In-plugin management

新版 Aide 启动器支持 `host.component.codex-bridge` 时，打开插件即可操作 **安装、启动、停止、卸载、生成密钥**。不用另下 EXE，不用打开独立管理器网页，不用填写管理连接码。宿主组件随 Aide 镜像提供，启动器校验后自动运行；安装桥接仍由你点击“安装”执行。

需要宿主已有 Node.js 18+、已安装并登录的 Codex CLI。点击“生成密钥”后复制到 Aide 模型提供商的加密设置；不会覆盖已有提供商或切换模型。卸载保留配置、密钥和 Codex 登录。账户额度仅查询，不消耗重置次数。

**兼容说明**：该流程需要包含 Aide #615 集成的新启动器和镜像，单独升级插件或旧发行包仅替换镜像不够。旧 Aide 保留下面的独立管理器兼容入口；不要把该兼容入口当作新版安装步骤。本版本实现与验证状态见 [集成记录](docs/MANAGER-INTEGRATION-615.md)，版本号不代表已经发布。

On Aide builds advertising `host.component.codex-bridge`, use the five controls in this workbench. The full Aide distribution includes the verified host component and starts it automatically. No separate manager download, manager page or pairing code is required. Existing Node.js 18+ and a signed-in Codex CLI are prerequisites. Keys appear only after an explicit action, masked; copy them into encrypted model-provider settings. The older standalone flow below is compatibility documentation for older Aide launchers.

---

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

## Account pool quota (0.4.1)

The plugin declares a data-only provider-support catalog for the local bridge on port8787. A compatible Aide host displays remaining percentages per returned quota window and reset times in the account pool. Credentials stay in Aide and are sent only to the selected bridge origin. This is shared account quota, not USD balance. No inference or earned reset is consumed by reads. The bridge host must support GET /v1/usage (0.3.0+); older hosts remain unavailable until upgraded. Aide requires provider-account-quota-v1 source capability or a future compatible released version. Pricing is not supplied for the bridge.
