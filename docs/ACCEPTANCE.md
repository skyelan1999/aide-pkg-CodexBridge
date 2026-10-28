# Acceptance · 2026-10-28

## Local deterministic tests

30 Node tests passed on macOS ARM64 / Node 24.19.0:
- 21 adapter tests: auth, routing, JSON/SSE, tool history and handoff, validation/body limits, crashes/deadlines/disconnect, JSON output and schema, reasoning mapping, ten active requests, queue FIFO/overflow/cancel/timeout, bounded capacity retry and no replay after partial output.
- 4 package tests: install/update in a space path, preserved config/key, unrelated-directory protection, plugin settings and executable launcher syntax.
- 3 platform tests: install-location rules; Windows official npm shim resolved through Node without executing shell text; real stdio child JSON/SSE/tool handoff in Unicode/space temporary paths.
- 2 plugin tests: local URL/credential restrictions and authenticated catalog with no secret returned.

## Real Codex host

Results are recorded by `scripts/live-acceptance.cjs` in ignored `.agent-state/live-acceptance.json`. No login material, real user prompt or chat history is used. Catalog and inference are separately reported. macOS ARM64, Codex CLI 0.164.0-alpha.11.1: authenticated model catalog returned 8 IDs. Synthetic gpt-6.1-sol JSON and SSE inference both completed with BRIDGE_OK. SSE is verified by reassembling deltas and requiring [DONE], not matching an unassembled chunk string. No real user content or provider configuration was used.

## Cross-platform CI

[Run 40679747335](https://github.com/skyelan1999/aide-pkg-CodexBridge/actions/runs/40679747335), product source `798ce6c87ae75ef4eae73052c672817913fcbaac`: all six jobs PASS, Windows Server 2022 / macOS 15 / Ubuntu 22.04 × Node 18 / 24. Each job built the package and ran all 30 tests, including real stdio processes. Windows findings (default Python encoding, platform-dependent path helpers and Git line-ending conversion) were fixed and rerun.

## Installed Aide plugin / browser

A separately labelled temporary Aide container on port 18529 installed/upgraded the final ZIP. Native workbench calls reached the local bridge health and authenticated catalog, with a synthetic catalog returned by a controlled app-server fixture. Browser checks clicked both diagnostic actions and switched English/Chinese; the guide and results rendered. This is not a full production Aide provider-settings or live Aide workflow acceptance. Test instance tokens/keys were not exposed, and 9999/MIXSoul were untouched.

## Real tool orchestration

On the same Mac/Codex CLI, a synthetic `lookup(q="bridge")` request produced a real Codex dynamic tool handoff; a new request carried the assistant tool_call and synthetic tool result, then returned `TOOL_OK`. JSON/SSE and this tool round trip all passed. No arbitrary shell, real project or user file was used.

## Pending / not claimed

 No live Codex inference on Windows/Linux, Windows 10/11/Server-version matrix, x64 Mac, Linux ARM64, full Aide browser provider configuration, remote SSH tunnel or user-device install is claimed. Neither shell syntax nor simulated protocol tests establish those outcomes. No market registration, Release, Aide core change or deployment to 9999 is included in this task.
