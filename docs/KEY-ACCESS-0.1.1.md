# Key access follow-up · 0.1.1 candidate

Addresses #1. The host component remains separate from the Aide plugin. Added dedicated get-key launchers for Windows CMD, macOS Terminal and Linux shell. Installer output now prints the matching installed launcher path. README and workbench display all three OS commands and explain why importing the plugin alone does not install the host service.

`manage.cjs key` reads the key of an actual marked installation (current installed directory, then default install location); it no longer creates a new token in an uninstalled extracted bundle. Custom locations can be passed explicitly. No model tool or browser endpoint returns the key.

Local macOS ARM64: 31 Node tests passed, including actual key launcher execution with outputs captured only for equality checks. Installed the component in the default per-user directory and verified key readability without logging its value. No provider settings were changed; no service or login was automatically started. Cross-platform CI and native workbench results are reported by the PR checks.

These files prepare 0.1.1; the existing public Release/market version remains 0.1.0 until a separate publication step.

## Lifecycle scope added by user

The workbench now includes a Codex-host OS selector and separate install, key, start, stop and uninstall panels in both languages. It presents commands for execution on the host; it never misrepresents a Docker-side/browser action as native host installation. Aide-plugin removal and host-service removal are explained separately.

Added allowlisted host uninstallers for all three systems. Uninstall retains config/key/marker and unrelated files; reinstall restores program files with the same key. New start launchers record a PID; install/uninstall refuse a known running manager. Users must also manually stop legacy/directly launched instances. Local test count is now 32, including actual macOS uninstall/reinstall and state-preservation checks.

User subsequently authorized publishing 0.1.1 and updating the public market after verification. No Aide core or 9999 changes are needed.
