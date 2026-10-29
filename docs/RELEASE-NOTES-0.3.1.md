# Codex Bridge 0.3.1 · Five actions

The native manager's main window contains only Install, Start, Stop, Uninstall and Generate key. Local operation does not require plugin pairing. More settings holds optional pairing, diagnostics, repair and client administration. Confirmations happen inside the page; background status refresh no longer erases action errors. Generate key reuses an existing model key and never rotates a running service's credentials. New key creation remains restricted to the owner window; paired model tools cannot retrieve credentials.

Every platform/architecture host archive now includes its matching plugin ZIP and a bilingual first-open guide. On Windows, extract the entire archive and open CodexBridgeManager.exe. The manager installs its embedded bridge payload without fetching repository source. Node.js 18+ and an already signed-in Codex CLI remain external prerequisites, not silently installed dependencies.

Update plugin and manager together to 0.3.1. Existing configuration and model keys are retained; no Aide core, real account/provider or 9999 changes. Real account-quota availability and actual Windows 10/11/Server 2016 desktop use remain separate from hosted CI and synthetic acceptance.

Also includes Aide #602: GUI-safe Node/Codex discovery, a bounded CLI version probe and persistence of the verified path only. Failed probes or concurrent edits retain settings. Windows npm shims resolve to the official JS entry without a shell.
