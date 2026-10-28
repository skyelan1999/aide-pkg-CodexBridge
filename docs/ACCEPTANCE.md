# Acceptance · 2026-10-28

## Local deterministic tests

30 Node tests passed on macOS ARM64 / Node 24.19.0:
- 21 adapter tests: auth, routing, JSON/SSE, tool history and handoff, validation/body limits, crashes/deadlines/disconnect, JSON output and schema, reasoning mapping, ten active requests, queue FIFO/overflow/cancel/timeout, bounded capacity retry and no replay after partial output.
- 4 package tests: install/update in a space path, preserved config/key, unrelated-directory protection, plugin settings and executable launcher syntax.
- 3 platform tests: install-location rules; Windows official npm shim resolved through Node without executing shell text; real stdio child JSON/SSE/tool handoff in Unicode/space temporary paths.
- 2 plugin tests: local URL/credential restrictions and authenticated catalog with no secret returned.

## Real Codex host

Results are recorded by `scripts/live-acceptance.cjs` in ignored `.agent-state/live-acceptance.json`. No login material, real user prompt or chat history is used. Catalog and inference are separately reported. macOS ARM64, Codex CLI 0.164.0-alpha.11.1: authenticated model catalog returned 8 IDs. Synthetic gpt-6.1-sol JSON and SSE inference both completed with BRIDGE_OK. SSE is verified by reassembling deltas and requiring [DONE], not matching an unassembled chunk string. No real user content or provider configuration was used.

## Pending / not claimed

Cross-platform CI pending initial repository push. No live Codex inference on Windows/Linux, Windows 10/11/Server-version matrix, x64 Mac, Linux ARM64, full Aide browser provider configuration, remote SSH tunnel or user-device install is claimed. Neither shell syntax nor simulated protocol tests establish those outcomes. No market registration, Release, Aide core change or deployment to 9999 is included in this task.
