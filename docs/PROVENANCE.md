# Source provenance

The user supplied an MIT-licensed Windows-oriented reference bundle on 2026-10-28. Both outer SHA256 files and the source bundle's internal SOURCE-CONTENTS.sha256 were verified before adaptation.

| Input | SHA-256 |
| --- | --- |
| aide-codex-bridge-0.1.17.5-RC11.zip | a45be6a18e830f2a4ba2639460205a961356c95e48ed0616668e65047843753b |
| aide-codex-bridge-0.1.17.5-RC11-source.zip | d2b6412e5648c7a51ca47a381c5159552abd46f4f720f22d53bdc304da9816f3 |

The reference runtime, installer and 25 tests were adapted. Original copyright is preserved in LICENSE. Historical developer-machine acceptance and proxy/network details are not carried forward as new acceptance. The Aide workbench MessagePort client is reused from the public MIT File Preview plugin. No Codex binaries or third-party dependencies are vendored.

Changes include independent plugin versioning, bilingual workbench, constrained diagnostics/catalog, safe Windows npm-shim resolution, platform-correct install paths, process-tree cleanup, temporary Codex working directory, output bounds, metadata-only health, explicit plugin feature restrictions, reproducible packaging, and native cross-platform CI fixtures. The reference's role/history and one-tool-per-handoff limitations are intentionally documented rather than disguised.
