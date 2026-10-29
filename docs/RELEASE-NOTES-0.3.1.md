# Codex Bridge 0.3.1 candidate

Fixes the implementation of [Aide #602](https://github.com/skyelan1999/aide/issues/602): a GUI-launched host manager can locate Codex installed outside its minimal PATH, validate the actual CLI, and persist that exact launch path. Known Homebrew, user-bin, npm, Volta, NVM and macOS app locations are supported; custom absolute paths retain priority. Windows npm launches the official JS entry through Node without a shell.

The manager saves the path only after a bounded successful `codex-cli --version` probe. Failures preserve configuration, unknown numeric values remain intact, and an external edit during diagnosis is retained and requires retry. Node discovery also covers NVM/Volta. Other provider settings, bridge/login keys and networking retain their existing contracts.

Install/update both the plugin and the matching host manager, then Diagnose and Start. No login or account migration is required. This is a source/build candidate until normal main review and Release publication complete. See [acceptance](ACCEPTANCE-0.3.1.md) for actual evidence and remaining platform/device limits.
