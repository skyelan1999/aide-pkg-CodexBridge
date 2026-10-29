# Advanced and legacy CLI setup

Optional terminal fallback only. For normal use, open the native manager and follow the [five-button guide](../README.md). No CLI commands are needed for daily host management.

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

