# Combined Codex Bridge 0.3.2 acceptance

Tracks Aide #610 (five actions and complete bundle) and includes the #602 CLI-discovery source candidate. The preceding discovery-only 0.3.1 receipt is retained under `ACCEPTANCE-0.3.1.*`; its archive hashes are historical, not this release. Current exact distribution identities are in `ACCEPTANCE-0.3.2.json`.

- PASS: 48 Node synthetic tests, including the native UI script in a DOM fixture, key reuse, missing-CLI startup discovery, inline uninstall cancel/Escape/confirm, persistent action errors and clipboard fallback.
- PASS: Linux ARM64 Go race/vet, macOS ARM64 native Go tests, six native OS/CPU builds and bundled/embedded ZIP identity. CI on each OS remains a separate PR check.
- Actual isolated native UI install/start/key/stop passed before removing native JS dialogs. The five-action candidate page rendered (see screenshot, labeled 0.3.1 before the publication-number conflict was resolved as 0.3.2). A stale native confirmation from that earlier test blocked browser input; final inline-confirmation interactions are NOT RUN in a real browser, and are covered only by the actual-source DOM fixture and HTTP tests. This limitation is not counted as a browser pass.
- Real Windows desktop/account and real quota/inference are NOT RUN. Hosted CI is not Windows 10/11/Server 2016 interactive acceptance.

Fixtures use temporary synthetic CLI/config/key data only. Nothing changes Aide core, 9999 or the user's providers/login. Publication/market state is established by the current PR, Release and central issue rather than this pre-publication receipt.

A previous Windows CI run caught default cp1252 decoding in the new archive verifier. It now reads UTF-8 explicitly; latest-head hosted checks must pass before merge.
