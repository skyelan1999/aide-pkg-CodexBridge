# Codex Bridge version policy

Codex Bridge follows the independent three-part plugin numbering used by RViz, FilePreview, Compare and ProfessionalProject: `MAJOR.MINOR.PATCH`, with tag `vMAJOR.MINOR.PATCH`. It does not inherit Aide's four-part version or RC number, nor the Codex CLI/model version. Previously published tags are immutable.

- Patch: compatible bug fix or packaging repair.
- Minor: an added workflow or capability, including the 0.3.0 guided connection flow. Before 1.0, changed setup contracts must have explicit migration instructions.
- Major: an intentionally incompatible stable contract after 1.0.

`manifest.json` is the authoritative version. `package.json` must match. `scripts/build.cjs` rejects mismatches and generates the workbench version/download names plus `cmd/host-manager/version_gen.go`. The Node adapter reads the packaged manifest for health and protocol client identity. Native payloads include that same packaged manifest; archive names, app bundle version and embedded executable version use the same release number. CI derives payload filenames from the manifest.

Plugin workbench protocol 1, manager pairing protocol 1 and the independent Codex app-server protocol are separate compatibility contracts, not release versions. Updating Aide or Codex does not itself increment this plugin's version. A source candidate or local archive is not a published Release or marketplace update; each delivery state must be recorded separately.
