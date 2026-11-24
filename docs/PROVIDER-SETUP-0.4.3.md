# Codex Bridge 0.4.3: endpoint guidance and key copying

The workbench now shows a dedicated provider setup card with OpenAI-compatible provider guidance, selectable/copyable Base URL, Native/Docker Desktop selection and the configured bridge port. Older/unconnected managers fall back to the documented default port 8787. The legacy paired status projection now retains only a validated integer port in addition to its existing safe fields.

Both the workbench and standalone manager reuse one generated helper. Explicit Copy first tries synchronous browser copy in the click gesture, then Clipboard API with a 1.5-second timeout. Failure reports manual copy instructions and selects plaintext. Generating/retrieving a key displays it for 60 seconds; Show and Hide allow explicit control. Blur/visibility changes mask it, and page exit, uninstall and workbench scope revocation clear it. Existing keys are reused. No credential is added to settings, browser storage, URLs, logs or tool results.

QA inventory and results (synthetic keys only):
- 61 Node tests pass, including copy success without Clipboard API, denial/missing API fallback, stalled API timeout, revocation while copying, auto-mask/explicit hide, custom/default ports and packaged helper identity.
- Existing native manager Go race tests pass in isolated Linux Go 1.26 container.
- Playwright Chromium: managed workbench and standalone manager; Chinese/light and English/dark coverage; custom port 18787; Native/Docker switch; rejected clipboard fallback; explicit hide/show; accelerated 60-second auto-mask; 390px and 1100px viewports. No script errors or horizontal overflow in the checked workbench states. Screenshots reviewed for clipping, overlap, readable labels and visible feedback.
- Browser fixtures use synthetic MessageChannel/status responses. They do not prove live inference, real-account quota, Windows desktop paste behavior or a destination model-settings paste. Manual plaintext copying remains available when browser/iframe clipboard permissions deny automatic copy.

Delivery state is separate: this source record and local ZIP are candidates until integration/publication. Installation and release receipts, when completed, belong in local evidence; do not infer publication from package creation.

Local installation: the existing Aide plugin upgrade endpoint returned HTTP 200 with version 0.4.3 enabled. Native WKWebView then showed CODEX BRIDGE 0.4.3 and the new setup card; selecting Docker Desktop displayed `http://host.docker.internal:8787/v1`. No real key was generated or shown for this acceptance. Public release remains unpublished.
