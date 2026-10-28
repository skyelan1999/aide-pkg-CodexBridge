# Codex Bridge 0.1.0 architecture

## Components

- `index.js`: two Aide read-only diagnostic tools. Settings URL is limited to local HTTP(S) `/v1` endpoints, without URL credentials, query or fragment. Model arguments cannot supply a destination or token. Requests reject redirects. `codex_bridge_connection_info` checks the minimal health identity; `codex_bridge_models` uses the optional password setting and returns catalog IDs only.
- `viewer.html`: packaged bilingual workbench using the public Aide MessagePort protocol. It calls only the two declared tools; it cannot launch host commands, inspect Codex auth or write model-provider settings.
- `manage.cjs`: user-initiated per-user host installation, dependency diagnosis and foreground launch. Configuration/key survive reinstall. No background autostart. `install.*` and `start.*` are thin platform entry points without PowerShell.
- `runtime/launch.cjs`: resolves direct binaries/JS and official Windows npm shims to argument-array process calls. No arbitrary shell strings. POSIX uses a child process group; Windows cleanup uses the system `taskkill.exe /T` command, not PowerShell.
- `runtime/bridge.cjs`: authenticated HTTP adapter, bounded request gate, per-request Codex app-server, JSON-RPC initialization, model listing, fresh ephemeral threads, output-format mapping, text deltas, tool handoff and cleanup.

## Request lifecycle

1. Validate auth, route, JSON body and supported parameters before spawning.
2. Acquire a concurrency slot or enqueue with cancellation and deadline. Overflow returns 429 + Retry-After.
3. Spawn and initialize an independent app-server in a temporary directory, using the host account's Codex login.
4. Read configured MCP names and disable them for the thread. Supply only Aide's declared dynamic functions, system/developer instructions and serialized conversation history.
5. Convert text events to JSON or SSE; first function request becomes Aide tool_calls. Aide retains execution/approval ownership.
6. Return only a completed-turn success. Failed/interrupted turns and unsupported interactions are errors. Capacity retry is bounded to requests with no emitted text.
7. Close the child on success, failure, timeout or client disconnection and release the slot. The CLI removes its temporary working directory on normal termination.

## Boundaries

This is a model-provider adapter, not a plugin that controls Codex desktop UI, an arbitrary Codex RPC proxy, or a native Codex session orchestration replacement. Per-request ephemeral threads avoid accidental reuse across Aide chats; Aide explicitly supplies the intended text history. Hidden reasoning is not replayed. Model catalog is not inference permission. Auth remains on the host. Sandbox/tool settings are defense in depth under the logged-in account, not a separate OS sandbox.

No Aide core or MIXSoul changes are required. No provider, network, current user chat or production instance is automatically modified.
