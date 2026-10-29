# 0.3.2 public-asset and native-browser acceptance

Tracks central Aide #610 and #602. Tested the **downloaded public Linux amd64 executable** from source `65e1ddd04fd641745d9e599036a0c9ac0f3947bf`, rather than a local development build. No product changes were needed.

All six public native archives and the plugin ZIP matched their published SHA-256 sidecars. Each archive includes the same plugin ZIP, that ZIP is embedded in the executable, and a first-open guide is included. Exact hashes and results are in [the record](ACCEPTANCE-0.3.2-POSTPUBLICATION.json).

Actual Chromium acceptance used one owned temporary Linux XDG profile, a synthetic Codex CLI, and an isolated bridge port. Four fresh page contexts covered Chinese/English, 1280/390 widths and light/dark themes. Install, Start, Stop, Uninstall and Generate key all passed. More settings starts collapsed; keys are masked, reused and retained across uninstall/reinstall; clipboard failure selects the field. Escape and Cancel send no uninstall action; inline Confirm uninstalls and retains settings. Synthetic `/v1/models` returns 200 after verified CLI-path persistence. A bad CLI returns 409, retains configuration and keeps the error after periodic status refresh. No native confirmation dialogs or page errors occurred. All pages and the owned native process were closed; temporary state was removed.

The first fixture run incorrectly expected the key in config.json. Reading the product showed that it belongs in data/bridge.key. The assertion was corrected and the full fixture rerun passed; this was not a product failure.

Reproduce on Linux with Playwright/Chromium installed:

```sh
AIDE_CODEX_MANAGER_TEST_BINARY=/path/to/downloaded/CodexBridgeManager AIDE_PLAYWRIGHT_MODULE=/path/to/playwright AIDE_COMPONENT_EVIDENCE_DIR=/tmp/owned-evidence node scripts/five-actions-browser.cjs
```

The script refuses an occupied manager/default bridge port. It uses synthetic credentials and never reads an existing Codex account or changes Aide provider settings. The clipboard is replaced within the test page only. Real Windows/macOS GUI, real account quota and live inference remain NOT_RUN. The release remains an unsigned prerelease. This Linux result fills the previously reported final-browser acceptance gap; it does not claim every supported desktop/account was tested.
