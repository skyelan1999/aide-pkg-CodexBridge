# Codex Bridge 0.1.0 · Preview

独立 Aide 插件和宿主机 Codex 协议桥接，支持 Windows、macOS、Linux。包含三端安装/启动脚本和中英文工作台引导；无需 PowerShell，不修改 Aide 主包。

- OpenAI-compatible Chat Completions JSON/SSE, JSON output/schema and dynamic function handoff.
- Ten active request slots with bounded FIFO queue, cancellation, deadlines and capacity backoff. Slots share account quota, not a speed guarantee.
- Official Windows npm shim resolution without shell evaluation; per-user install/update preserves configuration and local bridge key.
- Host-local Codex login stays on the host. No Codex/Node binaries, login data or local config in the ZIP.

## Install

Download `codex-bridge-0.1.0.zip`, extract it, and follow README. Run the host installer/start entry and separately upload the same ZIP to Aide. Node.js 18+ and a signed-in Codex CLI are prerequisites. Configure Aide's OpenAI-compatible model provider separately; importing the plugin does not start the bridge or change providers. See the included bilingual workbench guide.

## Validation and limits

All six CI jobs passed on Windows Server 2022 / macOS 15 / Ubuntu 22.04 × Node 18 / 24. Thirty tests cover native stdio children, packaging/install/update, protocol, queue and cleanup. On macOS ARM64, real Codex JSON/SSE inference and synthetic tool round-trip passed. An isolated Aide installed the ZIP and exercised both workbench tools; browser checks covered English/Chinese guidance. Screenshot uses an isolated test port and synthetic service, not user credentials.

Windows/Linux real-account inference, Windows-version hardware matrix and full production Aide workflow acceptance are not claimed. Text-only; images/audio and desktop chat inheritance are unsupported. Each request reconstructs text history in a new ephemeral thread; hidden reasoning is not preserved. Experimental Codex protocol changes require revalidation.

MIT. Integrity SHA-256 is provided; this is not a signed native executable. No Aide main-program Release or production deployment is included.
