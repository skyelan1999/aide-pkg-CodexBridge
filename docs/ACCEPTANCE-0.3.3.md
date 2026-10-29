# Codex Bridge 0.3.3 — installation feedback

Tracks Aide #610. User reports Windows Install does nothing and stays Not installed. The exact user-machine failure is still unconfirmed: both released 0.3.2 and candidate 0.3.3 installed successfully through the real native HTTP handler and browser in an isolated macOS fixture.

## Delivered behavior

Unavailable actions explain the prerequisite when selected, without sending the action. Native and plugin controls retain authorization/running-process checks. Native requests have bounded waits (10 seconds status, 60 seconds mutation), never automatically retry a mutation, and warn that a timed-out backend action may still be running. Failed/missing owner authorization no longer masquerades as Not installed. Transport, malformed responses and page script failures have visible recovery guidance. Existing keys/settings and external processes remain untouched.

## Validation

- 51 Node tests passed, including actual-source UI tests for no-dispatch prerequisites, missing/invalid owner authorization and stalled install timeout.
- Linux ARM64 Go race/vet and macOS ARM64 native tests passed.
- All six Windows/macOS/Linux x64/ARM64 bundles validated; embedded payload and included plugin ZIP match.
- Real local browser: installed -> Installed; stopped, inline uninstall/cancel, confirmed uninstall -> Not installed, Chinese/English display, and reload with lost owner -> explicit reopen instruction. Screenshot: evidence/install-feedback-0.3.3.png.
- Actual Windows user desktop, exact user-reported failure, real account login/inference/quota remain NOT VERIFIED / NOT RUN. CI Windows tests are not that acceptance. Keep #610 open.

No Aide core, production 9999, login/provider settings or real keys were changed. Only disposable synthetic test installs were used.
