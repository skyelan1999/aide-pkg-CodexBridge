# Codex Bridge · Codex 模型桥接

独立 Aide 插件与本机桥接程序，支持 Windows、macOS、Linux。当前补丁候选 **0.3.1**；实际发布状态以[Release](https://github.com/skyelan1999/aide-pkg-CodexBridge/releases)为准。

## Windows：解压后直接打开

下载对应系统/架构的宿主安装包，**完整解压**，双击 **CodexBridgeManager.exe**。不要在 ZIP 内直接运行。

安装包已包含宿主管理器、内嵌桥接程序，以及同版 `codex-bridge-0.3.1.zip` 插件包；无需克隆仓库或另找源码。需要插件工作台时，将这个插件 ZIP 导入 Aide 即可。宿主安装不下载仓库、不使用 PowerShell。

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
