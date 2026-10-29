# Codex Bridge architecture

## Components

- `index.js` (0.2.x historical design; superseded by the guided connection section below): read-only diagnostic tools plus separately paired, allowlisted lifecycle tools. Settings URL is limited to local HTTP(S) `/v1` endpoints, without URL credentials, query or fragment. Model arguments cannot supply a destination or token. Requests reject redirects. `codex_bridge_connection_info` checks the minimal health identity; `codex_bridge_models` uses the optional password setting and returns catalog IDs only.
- `viewer.html`: packaged bilingual workbench using the public Aide MessagePort protocol. It calls declared diagnostics and fixed lifecycle tools. Native manager requests use the separate password setting; arbitrary commands, Codex auth files and provider-setting writes are not exposed.
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

## Native lifecycle manager

`cmd/host-manager` is a standalone Go executable with an embedded, allowlisted plugin payload. Six native assets cover Windows/macOS/Linux on amd64/arm64. It opens a loopback setup page without a shell. The inference service remains a separate Node process: stopping it does not stop the manager. Program install/update is refused while a bridge is running. Removal keeps config, model key and the independent manager. Shutdown terminates only a child process tree owned by this manager; external bridge instances are never killed.

The control origin defaults to loopback port 8788. Only fixed authenticated JSON operations are accepted; requests reject unexpected fields, malformed bodies, bad Host/Origin, redirects, symlinks and unrelated nonempty directories. Installation stages a complete verified payload and rolls back program files on write failures. The model key and manager key are independent. The owner setup page can copy them through explicit clicks; plugin tool responses rebuild a credential-free status schema. Initial pairing is a local GUI action; the plugin never copies the manager credential into a model conversation.

The 0.2.0 manager fixes the GUI PATH case by resolving known Node locations and known macOS Codex app binary locations, then persisting an absolute Codex path only when the config still contains the bare default. Explicit custom paths are preserved. Diagnostic version commands never call a language model. Model listing remains a separate acceptance step, and model access still requires an actual inference test.

Limitations: prerequisites are not silently installed; no account login automation, automatic service-at-login, OS signing/notarization or provider overwrite. Cross-compilation is not acceptance on every Windows/Linux release. The browser acceptance fixture uses synthetic storage and process inputs, never production account data.


## 0.3.0 guided connection

The workbench detects a compatible local manager using metadata-only `/health`, distinguishes disconnected/unpaired/uninstalled/stopped/running states, and disables host mutation until paired. A short-lived owner-issued code is consumed by `/api/pair`; the plugin stores the returned scoped token in permission-restricted private plugin state, outside the package and non-secret settings. The manager stores only token hashes, limits clients and bad code attempts, consumes successful codes, persists revocation and refuses owner routes to client grants even when the owner-UI header is forged. This is not encryption or a sandbox against same-account programs.

The manager's `/api/models` reads the owned installation's model key and configured local port, refuses redirects, bounds response size/count and returns model IDs only. No inference or provider write is performed. The plugin never returns credentials and ignores legacy secret settings. Tools omit local-only scheduling contracts because their effects include external host state and private storage; Aide therefore keeps conservative execution-domain exclusion. All host lifecycle requests remain fixed operations, without command/path injection or arbitrary destinations. Native setup retains explicit owner-only model-key access for the existing Aide provider UI.

`marked()` recognizes directories whose settings were retained after uninstall; `installed()` additionally requires actual program files. Safe reinstall can use the marker without falsely enabling Start. Version identities, payload and download names derive from the manifest; see [version policy](VERSIONING.md).

## 0.3.1 five-action manager

The native owner page exposes five primary operations: install, start, stop, uninstall and generate/copy key. Local operations no longer require plugin pairing. Pairing/client revocation, diagnostics and repair remain under More settings and preserve the existing scoped-client contract. The owner-only POST `/api/key` accepts an empty object, reuses existing keys, and generates a missing key only while the host is stopped. Client grants cannot call it. No secret is exposed as a model-tool result. Status refresh is separate from action feedback, so errors remain visible.

Every native archive now includes the exact matching plugin ZIP, the embedded-payload manager executable and a platform-specific first-open guide. Installation remains local extraction, with no repository or package fetch. Node/Codex prerequisites are still external and are explicitly distinguished from the bundled bridge program.
