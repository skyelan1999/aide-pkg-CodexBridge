Codex Bridge 0.3.3 · 安装操作反馈修补

安装、启动等操作不满足条件时会显示原因；失效页面、连接失败和请求超时会明确提示，避免只停在“尚未安装”。不会自动重试安装，也不会结束外部进程。超时不表示后台安装已取消，请先等待状态检查。页面刷新后若提示重新打开，请再次双击宿主管理器。

Windows：先在旧管理器的“更多设置”中退出，再完整解压对应架构的新宿主包，双击 CodexBridgeManager.exe。宿主程序内含桥接程序和同版插件 ZIP，无需从仓库另拉源码。安装无需配对、不使用 PowerShell。仍需已有 Node.js 18+ 和已登录的 Codex CLI 才能启动桥接。使用当前 Edge、Chrome 或 Firefox。

Blocked actions now explain the prerequisite without issuing a mutation. Native status/action requests have bounded waits, authorization-loss recovery and explicit transport/script errors. No automatic mutation retries, credential resets, external process termination or firewall changes.

Validation: 51 Node tests, native Go race/vet and macOS tests, all six distribution checks, actual isolated browser install/uninstall/confirmation/language/auth-loss flows. This is a feedback/recovery patch: the exact Windows user-machine no-response failure is not yet reproduced or certified resolved. Real account inference/quota are not claimed. Native managers are unsigned previews. Tracks https://github.com/skyelan1999/aide/issues/610.
