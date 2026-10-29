# Codex Bridge 0.3.4

修复 Aide 上传插件 ZIP 时的 `Cannot find module './connection.cjs'`。Aide 会单独校验入口文件；现在发布入口已内嵌本地辅助模块和版本信息，不需要修改 Aide。

Import the included `codex-bridge-0.3.4.zip` into Aide. The plugin entry now includes its local helper modules and version, so entry-only upload validation works. Private pairing storage, permissions, host lifecycle and account settings are unchanged. Native archives include the corrected plugin.

Validation: 0.3.3 reproduces HTTP 400; 0.3.4 returns HTTP 201, enabled, workbench opens and its status tool executes against a disposable Aide instance. 52 Node tests include entry-only validation and bundled pairing/quota tests. Cross-platform CI and release asset checks are required before publication.

Tracks skyelan1999/aide#613. The separate Windows native-manager Install/no-response report (#612) remains unconfirmed; this upload fix is not proof of resolving that report. No real account inference/quota or user Windows desktop acceptance is claimed.
