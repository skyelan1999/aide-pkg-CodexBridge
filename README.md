# Codex Bridge · Codex 模型桥接

An independent Aide plugin and optional local host service. Connect an installed, signed-in Codex CLI to Aide's **OpenAI-compatible Chat Completions** provider. No Aide core changes, Codex binaries, account tokens or user chat histories are bundled.

独立插件 + 宿主机服务，把本机 Codex 接入 Aide 模型提供商。支持 Windows、macOS、Linux 的安装与启动入口；无需 PowerShell。插件采用独立三段式版本号，当前候选为 **0.3.0**，不复用 Aide RC 号。公开 Release 状态以仓库发行页为准。

## Guided setup / 引导式连接

1. Open the Codex Bridge workbench. Download the native manager matching the plugin version, host OS and CPU. Extract and open the application (Windows `.exe`, macOS `.app`, Linux executable). Keep Node.js 18+ and an already signed-in Codex CLI installed on that computer. No PowerShell is used; dependencies, login, firewall and system protections are not changed automatically.
2. In the native manager choose **Generate connection code**. Enter that one-use code in the plugin workbench within two minutes. The plugin detects native/Docker Desktop local addresses. Do not copy persistent manager keys or fill secret fields in ordinary plugin settings.
3. Use **Install/update**, **Start**, **Diagnose** and **Repair launchers** in the plugin workbench. Unconnected controls stay disabled. An externally launched bridge must be closed once before takeover; the manager never kills an unrelated process.
4. Choose **Read model catalog** after startup. The manager performs authenticated catalog access internally; no duplicate diagnostic key is needed. For first model-provider setup, explicitly copy the **model API key** in the native manager into Aide's existing encrypted provider settings. Aide providers and current model selection are never overwritten automatically. Catalog success is not inference acceptance: send a separate small test message.

中文：打开插件工作台 → 安装并双击同版本宿主管理器 → 生成一次性连接码，在工作台连接 → 安装并启动桥接 → 读取模型目录。普通设置只保留连接方式，不填写管理密钥或诊断密钥。模型 API Key 仍单独放在 Aide 的加密模型提供商设置里。卸载宿主保留配置、模型密钥及独立管理器；断开插件连接不停止桥接。管理器“撤销全部管理连接”会让已配对 Aide 后端重新配对，不影响模型 API Key。

The manager stores SHA-256 hashes of scoped client tokens (at most eight clients). The plugin stores its token outside the package in a sibling `.codex-bridge-private/connection.json`, never in model output or normal plugin settings. POSIX uses 0700/0600 with link checks; Windows inherits the existing user-profile/plugin-storage ACL. This is permission-restricted local storage, **not a claim of encryption** and not isolation from other programs running under the same OS account. The grant permits fixed lifecycle actions and model-ID listing only; owner-only routes for model keys, new connection codes, client revocation and manager shutdown reject it. Disconnect removes the backend copy; revocation in the native manager invalidates it server-side.

### Upgrade from 0.2.x / 旧版迁移

Quit the older native manager before opening the updated application. Update both the plugin and the native manager. Existing `bridgeKey` and `managerKey` settings are neither read/forwarded nor silently erased. If previously filled, remove these legacy fields through the text view of plugin settings, then pair using a new connection code. Existing host `config.json`, inference key and Codex account state are preserved. No Aide core or 9999 change is required. A lost/corrupt private connection state requires re-pairing. Linux Docker still needs explicitly configured, controlled host access; a host-gateway name alone does not expose a loopback service.

See [version policy](docs/VERSIONING.md), [0.3.0 changes](docs/RELEASE-NOTES-0.3.0.md) and the acceptance record for exactly what has been tested. Command-line installation below is an advanced fallback, not the normal plugin workflow.

## Architecture / 编排

```mermaid
flowchart LR
  UI[Aide chat / workflow] --> P[Aide model provider]
  P -->|Bearer + Chat Completions JSON/SSE| B[Local bridge: bounded FIFO queue]
  W[Plugin workbench] -->|Health / model catalog| B
  B -->|One isolated child per request| C[Codex app-server stdio]
  C --> M[User's configured Codex model account]
  C -->|Dynamic function request| B
  B -->|tool_calls| P
  P --> A[Aide tools and approval]
  A -->|Tool result in next request history| P
```

Aide owns tools, approval and conversation history. The adapter reconstructs the supplied text history into a fresh ephemeral Codex thread for each request; this is **not** native multi-role replay or a continuation of a desktop Codex chat. The first dynamic-tool call is handed back to Aide, then that child is closed. The next HTTP request carries Aide's updated history. Hidden Codex reasoning and pending tool state are not preserved.

## Quick start / 安装配置

1. Install **Node.js 18+** and the official Codex CLI on the host where Codex runs. Run `codex login` there. Keep the login under that OS user. The plugin does not read or copy login-token files.
2. Extract the plugin ZIP. Install the host component:

| Platform | Install | Default location | Start from installed location |
| --- | --- | --- | --- |
| Windows | `install.cmd` | `%LOCALAPPDATA%\aide-codex-bridge` | `start.cmd` |
| macOS | `sh install.command` | `~/Library/Application Support/aide-codex-bridge` | `sh start.command` |
| Linux | `sh install.sh` | `$XDG_DATA_HOME/aide-codex-bridge` or `~/.local/share/aide-codex-bridge` | `sh start.sh` |

Command-line alternative on all three: `node manage.cjs install "target directory"`. No administrator install, scheduled task or automatic startup service is added. Node and Codex are prerequisites, not silently downloaded. On Windows, native `.exe` and the official npm `codex.cmd` installation are supported: the resolver launches its adjacent `@openai/codex/bin/codex.js` through Node, never by evaluating a `.cmd` file in a shell.

3. In the installed directory run `node manage.cjs doctor`. Edit `config.json` as needed. Then start the bridge and keep its terminal open. Ctrl+C stops the bridge. Reinstalling updates component files while preserving `config.json` and `data/bridge.key`; unrelated nonempty directories are refused.
4. Import the **same ZIP** into Aide → Plugins → Upload, and enable **Codex Bridge**. Open the plugin workbench for bilingual guidance and connection checks. Import alone does not install/start the host service or change any provider.
5. Run `node manage.cjs key` **locally** and copy the generated bridge key into Aide's model-provider API Key field. It is a local bridge key, not an OpenAI Platform API key. Never paste it into chat or Git. The plugin workbench uses its paired manager for catalog checks; no diagnostic key belongs in plugin settings.

| Aide provider field | Value |
| --- | --- |
| Type | OpenAI compatible / Chat Completions |
| Base URL (native Aide on same host) | `http://127.0.0.1:8787/v1` |
| Base URL (Docker Desktop Aide) | `http://host.docker.internal:8787/v1` |
| API Key | Locally generated bridge key |
| Model | An ID from the authenticated catalog; test actual access with a short request |

中文：解压安装包 → 宿主机登录 Codex → 安装并启动桥接 → 在 Aide 导入同一 ZIP → 打开工作台检查连接 → 单独配置 Aide 模型提供商的地址、密钥与模型。不会继承 Codex 桌面正在进行的聊天。

### macOS/Linux launcher permissions / 启动权限修复

If double-clicking a `.command` file says you do not have permission, open Terminal in the **extracted plugin directory** and run:

```sh
node manage.cjs repair-permissions
sh install.command
```

Linux uses `sh install.sh` for the second command. Shell invocation does not require the script's executable bit. After host installation, repair an existing default macOS installation with:

```sh
node "$HOME/Library/Application Support/aide-codex-bridge/manage.cjs" repair-permissions
```

中文：ZIP 自带执行位，但插件导入、同步或部分解压工具可能把 `.command` 写成普通只读脚本。先进入解压目录运行修复命令，或直接 `sh install.command`。该命令仅将本组件八个 `.sh`/`.command` 入口恢复为 `0755`；先检查完整白名单，拒绝符号链接，不修改配置、密钥、其他文件或系统隔离标记，也不启动服务。自选安装目录可运行 `node manage.cjs repair-permissions "实际安装目录"`。如果是系统阻止打开、目录写入失败或 Codex 登录权限错误，请保留完整报错另行排查，不能把它们都当作执行位丢失。

The repair command validates the complete launcher allowlist before changing modes. It does not run the bridge, change credentials/firewall settings or remove OS quarantine. It is not a remedy for every permissions or account error. Importing the plugin alone still does not install the host service.

### Docker and network access

Default binding is **127.0.0.1**, for native same-host Aide. Docker reachability depends on the host and Docker network. If necessary, deliberately change `host` to `0.0.0.0` in the bridge `config.json`, then use `host.docker.internal`. This exposes the listener on IPv4 interfaces: restrict host firewall access to the required local/Docker network; do not forward it to the Internet. No firewall or Docker-network configuration is changed by this plugin. Linux Docker additionally needs an explicit `host.docker.internal:host-gateway` mapping. A remote Aide backend can use an administrator-configured SSH tunnel; remote host management is outside this plugin.

Default proxy is empty (inherits process environment). Set `proxy` in `config.json` only if Codex needs a host-specific HTTP(S)/SOCKS proxy. This affects the Codex child, not OS settings. Do not assume a particular proxy port. It is not a general HTTP proxy server.

### Host commands

```sh
node manage.cjs doctor
node manage.cjs start
node manage.cjs key
```

`key` intentionally displays the local key in your terminal. Do not capture that command in shared logs. Generated files live outside Git and ZIP allowlists. On POSIX, generated key mode is 0600; Windows access relies on your user-profile ACLs. Stop the host service before upgrading/removing it. Removing the plugin from Aide does not stop a separately running host process.

## 获取 token / Get the local bridge key

**先安装宿主组件。** 在 Aide 上传 ZIP 只会安装插件，不会创建下面的宿主目录。若目录不存在，先解压 ZIP，在解压目录运行对应安装器：

| 系统 / OS | 安装 / Install | 安装后取密钥入口 / Key launcher |
| --- | --- | --- |
| Windows CMD | `install.cmd` | 安装目录双击 `get-key.cmd` |
| macOS Terminal | `sh install.command` | 安装目录运行 `sh get-key.command`，或双击该文件 |
| Linux Terminal | `sh install.sh` | 安装目录运行 `sh get-key.sh` |

默认目录安装完成后，也可以从任意目录复制执行对应系统的命令：

Windows **CMD**（不要在 macOS/Linux 终端使用 `%LOCALAPPDATA%`）：

```cmd
node "%LOCALAPPDATA%\aide-codex-bridge\manage.cjs" key
```

macOS：

```sh
node "$HOME/Library/Application Support/aide-codex-bridge/manage.cjs" key
```

Linux：

```sh
node "${XDG_DATA_HOME:-$HOME/.local/share}/aide-codex-bridge/manage.cjs" key
```

自选安装目录：运行该目录的 `get-key` 入口，或 `node manage.cjs key "实际安装目录"`。取密钥不会在未安装的解压目录偷偷创建另一个密钥；未安装时会明确提示先安装。安装器会打印适合当前系统的完整取密钥命令。输出只填写到 Aide 模型提供商 API Key，不发到聊天里。The bridge key is generated locally; it is not your Codex login token.

## 插件内安装与卸载 / Lifecycle workbench

打开插件工作台 → **如何使用**，选择运行 Codex 的宿主系统，再选择 **安装宿主组件 / 获取密钥 / 启动 / 停止 / 卸载宿主组件**。每一步展示该系统可直接执行的命令、前提条件和验证方式。默认系统仅按浏览器设备提示；远程/Docker场景请自己选择真正的 Codex 宿主系统。页面不具备跨 Docker 操作宿主机的权限，不会假装自动安装或自动卸载。需要在宿主终端执行所示命令。

| 系统 | 卸载宿主组件（先停止） |
| --- | --- |
| Windows | 安装目录运行 `uninstall.cmd` |
| macOS | 安装目录运行 `sh uninstall.command` |
| Linux | 安装目录运行 `sh uninstall.sh` |

也可从解压包执行 `node manage.cjs uninstall "实际安装目录"`。卸载只删除明确清单中的本组件程序文件，**保留配置、桥接密钥和目录标记**（Windows 还保留当前卸载入口，以便卸载窗口正常结束）；不会递归删除用户目录、未知文件、Node、Codex CLI 或 Codex 登录数据。重新运行安装器会恢复程序并沿用原密钥。新版本由 start 入口启动时记录 PID；运行中的实例拒绝升级/卸载。旧版本或手工启动的实例也必须先在原终端 Ctrl+C 停止。若要彻底清除保留数据，先确认路径及备份，再自行删除保留目录。

**卸载 Aide 插件本身**：Aide → 插件 → 已安装 → Codex Bridge → 卸载。它和宿主服务是两部分，移除其中之一不会自动停止/删除另一部分。可用工作台“检查连接”核验服务是否停止；连接可达不等于插件已安装或模型已验收。

## Capabilities and limits

- `GET /health`: minimal unauthenticated service identity/version; not a login or inference check.
- `GET /v1/models`: Bearer-authenticated Codex catalog; catalog presence is **not an entitlement check**.
- `POST /v1/chat/completions`: Bearer-authenticated JSON/SSE, function tools, `response_format=text/json_object/json_schema`, `reasoning_effort`.
- Defaults: 10 active requests, 40 queued, FIFO, 45-second queue deadline, 180-second active deadline, 8 MiB HTTP body, 4 MiB answer cap. Client disconnects stop corresponding children; capacity errors before text output retry at most twice, with 3/6-second delay. No retries after partial output or tool handoff. Ten slots share the same account quota, not a tenfold-speed promise.
- `off` reasoning maps to the minimum effort advertised by the selected model; `auto` uses its default. Sampling/output-token parameters are accepted for compatibility but not mapped; no fabricated token usage is returned.
- Only text content, `n=1`, and tool choice `auto/none` are accepted. Images/audio, legacy `functions`, forced tool choice and multiple simultaneous tool handoffs are unsupported and fail explicitly.
- Children use a temporary working directory, read-only sandbox, disabled shell/web search/plugin suggestions and disabled configured MCP servers. Unsupported interaction requests fail rather than being auto-approved. These are Codex configuration restrictions, **not a separate credential sandbox**: the Codex child necessarily runs under the logged-in OS account and may use its local Codex configuration. This plugin neither imports that account's credentials into Aide nor promises isolation from a compromised host.
- No persistent bridge document/chat cache or desktop-thread takeover. Normal Aide and Codex diagnostic/retention rules still apply. Selected prompts are sent by Codex to its configured provider; a local HTTP bridge is not offline inference.

## Development and acceptance

No npm dependencies are required. Build and test:

```sh
node scripts/build.cjs
python scripts/package-codex-bridge.py --out dist
node --test scripts/*.test.cjs
```

The deterministic 21-file plugin ZIP uses an explicit allowlist. It contains host launchers/runtime but no binaries, local config, auth, keys or test evidence. Run the generated ZIP through Aide's normal plugin validation before distributing.

```sh
# Real host catalog only, no inference
node scripts/live-acceptance.cjs
# Explicit synthetic JSON + SSE inference; uses the logged-in Codex account quota
node scripts/live-acceptance.cjs --infer --tools
```

See [architecture](docs/ARCHITECTURE.md), [acceptance record](docs/ACCEPTANCE.md) and [source provenance](docs/PROVENANCE.md). Cross-platform CI exercises native Node child processes, install/update, Unicode/space paths, queue/cancellation and npm-shim resolution. It does not prove live Codex inference on every OS/CPU or Windows version.

Official protocol reference: [Codex app-server](https://learn.chatgpt.com/docs/app-server). This integration uses an evolving protocol; changing Codex versions requires revalidation. Wrapper/runtime are MIT, based on the supplied MIT reference bundle. Codex itself and model/account access are not redistributed by this repository.

## Issues / 问题与需求

All public Aide plugins are part of Aide's functionality. Track bugs, feature requests and acceptance summaries centrally in [Aide Issues](https://github.com/skyelan1999/aide/issues), with the `Codex Bridge` component, plugin/host/Aide versions, reproduction and evidence. Implementation, design and delivery artifacts remain in this repository. Current setup work is [Aide #600](https://github.com/skyelan1999/aide/issues/600); native executable discovery is [Aide #602](https://github.com/skyelan1999/aide/issues/602). Public reports must not contain credentials, real prompts or private implementation details.

## Account quota percentages / 账户剩余额度

Open the plugin workbench → **Account quota · Connection settings**, after pairing and starting the host. The panel reads once when entering a ready connection; **Refresh quota** reads again. It displays each returned account bucket and its primary/secondary window separately, with remaining percentage, reset time and observation time. It does not poll in the background.

打开插件工作台 → **账户额度 · 连接设置**。完成连接并启动宿主后，进入页面时读取一次，也可点击“刷新额度”。逐项显示账户额度窗口的剩余百分比、重置时间和查询时间；没有后台轮询。

The authenticated local route is `GET /v1/usage`, using the existing model bridge key; the paired manager exposes the sanitized result through `/api/usage` and `codex_bridge_usage`. It calls only Codex `account/rateLimits/read`, starts no inference turn, reads no auth files, changes no account/provider settings, and never consumes reset credits. Multi-bucket responses take priority over the legacy single bucket. Remaining percentage is `clamp(100 - usedPercent, 0, 100)`. Null/missing/unsupported data stays unavailable; a failed refresh clears the old percentages. Window values describe shared account quota, not monetary balance, a conversation's token usage, model entitlement or guaranteed inference access.

该功能当前在插件工作台的连接设置中展示，不会修改 Aide 公共模型设置弹窗或把额度伪装成金额余额。API-key-only 登录、旧版 CLI、上游失败或未返回窗口时明确显示不可用。它不自动复制、刷新或替换登录令牌。

Protocol reference: [official OpenAI App Server documentation](https://learn.chatgpt.com/docs/app-server#6-rate-limits-chatgpt). Central request and current acceptance: [Aide #604](https://github.com/skyelan1999/aide/issues/604), [quota acceptance](docs/QUOTA-ACCEPTANCE-0.3.0.md). The 0.3.0 package is a candidate until a corresponding Release is published.
