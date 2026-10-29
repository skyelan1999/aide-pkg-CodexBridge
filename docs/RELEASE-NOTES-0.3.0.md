# Codex Bridge 0.3.0 candidate

Issue: [#600](https://github.com/skyelan1999/aide/issues/600).

Replaces the four-field technical setup with a guided native installation, one-time connection code and model-catalog check. Normal plugin settings contain only connection mode. Lifecycle controls remain disabled until connected, and a disconnected operation refreshes the state rather than retaining misleading enabled buttons. Uninstall now distinguishes retained settings from installed program files.

The two-minute code works once, has a bounded failed-attempt budget, and grants a revocable fixed-operation client token. Owner-only key/pairing/revocation/shutdown routes reject client tokens. Model catalog requests use the manager's installed bridge key internally; tool results carry IDs only. No long-lived manager or diagnostic key is saved in ordinary plugin settings. The plugin's private grant file uses local permissions, not an encryption claim. Existing legacy settings are not silently erased; remove obsolete secret fields manually when upgrading.

All component versions derive from the independent plugin manifest version. Both plugin and native manager must be updated for this connection flow. Existing provider settings, host configuration, model API key, Codex login and Aide/9999 are not overwritten. Node.js and an authenticated Codex installation remain prerequisites.

Local tests, browser fixtures, cross-builds, CI, remote publication and real Windows/Linux devices are separate acceptance states. This document alone does not announce publication.

## Account quota / 账户额度

The connection-settings panel now shows remaining quota percentages per Codex bucket/window, reset time and observation time, with manual refresh and one read on ready page entry. Unknown data stays unavailable. This is account quota rather than currency balance. Requires the matching host manager/bridge update. See Aide #604 and QUOTA-ACCEPTANCE-0.3.0.md for the actual test and live-read limitations.
