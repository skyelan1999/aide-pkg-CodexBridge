# Plugin-first host management — Aide #615

## Report and verified boundary

The user confirms Windows CodexBridgeManager.exe opens no page after double-click. The plugin detects the manager, which establishes service discovery only. The exact Windows/browser failure remains unverified. The previous launcher ignored process-start errors; a GUI-subsystem executable also had no reliable visible startup-error reporting.

Local repair replaces the Windows rundll32 subprocess with ShellExecuteW, interprets its failure return codes, and provides a native Retry/Cancel dialog. Startup failures become visible messages. The HTTP server loop starts before requesting the browser. Browser command output and authenticated URLs are not logged. These changes do not prove that the reported Windows machine is repaired.

## Intended experience

The plugin workbench is the only normal management surface: Install, Start, Stop, Uninstall, Generate key. Status, operation progress, error explanations and quota appear there. The user should not need to visit another management website, copy a pairing code from it or download a second executable just to use an already installed plugin.

## Host integration (explicitly authorized)

Current Aide plugin execution occurs inside its Node host, normally in Docker. Its reviewed workbench native APIs and computer bridge do not expose trusted host component installation. Running a shell in that container is not installation on Windows. Host execution must not be fabricated by moving buttons.

Aide needs a small trusted host component bootstrap in the launcher/distribution. Codex implementation remains in its plugin payload. Plugin installation should provide a verified, versioned host payload to that bootstrap through an authenticated Aide channel, followed by a narrow typed lifecycle protocol. No arbitrary command or arbitrary download URL is accepted. Windows code must use native APIs, not PowerShell. Native deployments should use the same contract with their local host adapter.

Initial permission/connection is mediated by trusted Aide UI and the launcher, without a second manager page. Grants are scoped to the installed plugin and fixed lifecycle operations. Keys must travel only through a user-invoked settings channel to Aide's encrypted provider store or a masked user display, never model tool results, logs or public health endpoints. Existing Codex login stays on its host.

Install/update must validate archive integrity and paths, preserve user config and keys, provide bounded progress and actionable failure, and retain rollback until readiness is verified. Stop/uninstall affect only owned processes/files. Upgrade/uninstall cannot silently delete Codex account data. Existing paired installations migrate without changing provider selection.

The user explicitly authorized Aide core and launcher changes and requested a fast push. This overrides the older plugin-local scope restriction. Unrelated start.command edits are preserved. Production 9999 and real provider/account state remain untouched.

## Acceptance boundaries

Test a clean Windows installation with no previously running manager, all five actions in the plugin, service restart, browser reload, host unavailable, port conflict, invalid payload, upgrade and uninstall retention. Exercise Windows 10/11 and supported Server desktop behavior without PowerShell; distinguish cross-compilation, CI execution and actual desktop acceptance. Verify macOS/Linux equivalents independently. Publish plugin/market only after the intended supported path passes; do not present a launcher-only patch as completed integrated installation.

## Local evidence, 2026-10-29

- Go 1.26 Linux race tests and go vet pass. Windows amd64 test binary and Windows arm64 executable cross-compile successfully.
- `scripts/test_manager_launch.py` exercised the actual Linux manager in an isolated Docker container with synthetic data and a fake OS browser opener: fresh launch serves authenticated status, second launch reopens the existing instance, a failed opener gives an error, and owner credentials in child output are suppressed. All pass. This verifies the process/HTTP boundary, not rendered browser or Windows desktop behavior.
- No publication, marketplace change or production deployment has occurred for this draft.

## Implemented 0.4.0 path

- `--aide-managed <connection-file> [private-interface]` runs the existing manager headlessly on port 17888. It does not open a browser, install the bridge automatically or import legacy pairing grants. Private launcher/backend metadata is written atomically; no credentials appear in arguments or public health responses.
- Aide's launcher extracts six-platform native components from its selected immutable image, verifies SHA-256, starts the host service and checks authenticated readiness. Build source is pinned to a public plugin commit and archive digest. Source fetching happens during Aide builds, not on the user's installation path.
- The active enabled Codex Bridge workbench receives a typed capability. Aide checks scope, replay, lock and package identity before dispatch and again before returning results. It permits only status, install, start, stop, uninstall, key, models and usage; no arbitrary command, path, download or endpoint.
- The workbench hides download/pairing sections in managed mode and exposes exactly the five requested lifecycle controls. A key is masked and cleared on uninstall or scope revocation. Legacy Aide retains the standalone compatibility path.
- Different installation roots cannot silently take over another root's component port. Upgrading the Aide image replaces an owned older component after authenticated shutdown. Bridge config and Codex login remain on the host. Restarting Aide does not automatically start a previously stopped bridge.

## Verification in this working revision

- 52 plugin Node tests pass; Linux Go race/vet pass; Windows amd64 test binary cross-compiles.
- Actual Linux headless service in a disposable container: authenticated metadata, same-version reuse without browser/key rotation, install, key generation, start, synthetic model catalog, stop and uninstall were exercised.
- Chromium rendered the plugin in an isolated parent MessageChannel fixture backed by that real manager. All five actions passed; an install click while running produced a stop-first explanation; masked key was 64 characters, cleared on uninstall; no download/pairing controls in managed mode; no page errors. Desktop Chinese/light and narrow English/dark layouts were inspected, narrow viewport had no horizontal overflow.
- This fixture substitutes only the parent transport, not the manager/bridge. Aide authorization/projection has separate backend tests; full production-launcher browser acceptance and Windows 10/11/Server desktop acceptance remain NOT_RUN. No real account inference or quota was tested.
- No release, market update or production deployment is claimed for this development branch.
