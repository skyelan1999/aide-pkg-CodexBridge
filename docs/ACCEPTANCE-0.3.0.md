# Guided connection acceptance · 0.3.0 candidate

Tracking: [Aide #600](https://github.com/skyelan1999/aide/issues/600). All public-plugin Issues are now managed in Aide; source/design/delivery records remain here. Public inventory covered 29 plugin repositories; the two open Codex Bridge entries were transferred with history, to Aide #600 and #602. They remain open pending the appropriate implementation/hosted/device acceptance; transfer is not a fix verdict.

The candidate removes persistent secret fields from ordinary plugin settings, uses a two-minute one-use code, shows explicit setup states, and derives component versions from the manifest. Read the [version policy](VERSIONING.md) and [candidate notes](RELEASE-NOTES-0.3.0.md) for migration and storage boundaries. Issue #600 also records the stale installed marker after uninstall and the asynchronous Stop response, both covered by the updated tests.

## Executed checks

- `node scripts/build.cjs`, deterministic package build, `npm test`: 35 tests passed, including temporary private grant storage, invalid local URLs, ignored legacy keys, credential-free tools and version consistency.
- Linux ARM64 isolated Go `go test -race ./...` and `go vet ./...`: passed. Native macOS ARM64 test executable: passed, including actual Node/fake-Codex child startup, authenticated catalog and stop, retained configuration/key on reinstall, symlink refusal, expired/replayed codes, attempt budget, persistent client hash store, revocation, owner-route denial and non-stale Stop response.
- Six native assets built for Windows/macOS/Linux × AMD64/ARM64. Every native executable contains the exact generated plugin ZIP. Archive SHA-256 files and payload versions checked. macOS ARM64 and Linux ARM64 `--version` smoke passed. Cross-build does not establish Windows-device runtime acceptance.
- Rendered IAB fixture: unpaired actions disabled; native owner page generated a code; workbench paired, installed real temporary files, repaired launchers, started a real Node process using synthetic Codex, read `synthetic-manager-model`, then stopped and immediately displayed stopped state. The catalog cleared/disabled. Disconnect returned to the pairing guide. Chinese/English labels and dynamic results were checked. The UI adapter uses Aide's MessagePort shape but is not full Aide-core acceptance. Temporary browser tabs were closed.

Screenshots: [connected workbench](evidence/guided-workbench-0.3.0.png), [English labels](evidence/guided-workbench-0.3.0-en.png). Machine record with source/payload/native hashes: [acceptance JSON](ACCEPTANCE-0.3.0.json).

## Limits and delivery state

No real account inference, real Windows/Linux device matrix or full Aide provider configuration was performed in this task. The updated full-host `scripts/native-acceptance.cjs` is prepared but was not run; its previous credential-field fixture is replaced with one-use pairing. No Aide core, 9999, MIXSoul, actual provider/account settings or production bridge deployment was changed by this candidate. Release and marketplace publication have not been performed. Existing 0.2.0 remains the published version until a separate delivery is completed.

Pairing tokens are permission-restricted private files, not encrypted vault entries. Legacy `bridgeKey`/`managerKey` settings are ignored and require explicit manual removal if previously populated. Updating requires quitting the old manager and updating both components. Keep these limitations in any publication summary.

The later quota feature changes the payload and native archives. Use [quota acceptance](QUOTA-ACCEPTANCE-0.3.0.md) and QUOTA-ACCEPTANCE-0.3.0.json for the final candidate; hashes in the original receipt are historical.
