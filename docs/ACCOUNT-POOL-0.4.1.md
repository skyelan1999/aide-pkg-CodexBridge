# Plugin-owned account quota integration - aide issue664

0.4.1 adds provider-support.json to the allowlisted package and native-owned payload. The catalog, not Aide product code, declares the three supported local hosts, port8787, /v1 base path and /v1/usage read-only quota route. The host keeps model credentials, matches the selected provider origin/key and returns allowlisted quota windows. No prices/currency are declared for this bridge.

The existing runtime account/rateLimits/read implementation remains unchanged. Reads do not generate model turns or consume earned resets. Unknown data is unavailable. A matching Aide account-pool host capability is required; old releases reject the new catalog. Host0.3.0+ is required for quota HTTP reads; the workbench management lifecycle is unchanged.

Validation: 53 Node tests passed, including real stdio synthetic child lifecycle, authenticated quota calls with exactly initialize/account/rateLimits/read, package delivery, manifest/catalog presence and credential omission. Native manager Go race suite passed in Linux Docker on macOS with the actual0.4.1 embedded ZIP. Aide tests exercise installing this actual ZIP plus OpenAISupporter and reading plugin-selected quota through the generic API. Safari isolated account-pool UI showed two synthetic windows and a separate pricing-only official account. Actual local published host0.4.0 read returned available quota without inference; values and account data remain private.

Publication: candidate ZIP only; no0.4.1 tag, Release or market publication yet. Central tracker: https://github.com/skyelan1999/aide/issues/664
