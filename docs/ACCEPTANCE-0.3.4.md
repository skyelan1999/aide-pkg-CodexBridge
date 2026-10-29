# 0.3.4 upload compatibility acceptance

## Confirmed cause
Aide `validatePluginCode` writes only the entry to an empty `aide-validate-*` directory. The 0.3.3 ZIP contains connection.cjs and quota.cjs, but index.js requires them at module load, along with manifest.json. Using Aide's actual validator reproduces the screenshot error.

## Implementation
`scripts/build.cjs` generates standalone index.js from src/plugin.cjs and the existing helper sources, with the current version inlined. Node builtin imports remain normal. Helpers retain the entry's installed __dirname, preserving the private pairing-state location. No runtime eval, new dependency, permission expansion or Aide change.

## Verified
- 52 Node tests: standalone staged entry loads with no siblings; seven executable tools register; bundled pairing, quota normalization, disconnect and private store checks pass.
- Real isolated Aide HTTP service: old ZIP HTTP 400 with missing connection.cjs; new ZIP HTTP 201 enabled; registry has no load error; workbench page and seven tools available; status tool call succeeds.
- Reproduce with `python3 scripts/aide-upload-acceptance.py --image <local-aide-image> --previous dist/codex-bridge-0.3.3.zip --candidate dist/codex-bridge-0.3.4.zip --receipt .agent-state/upload-034.json`. The script owns/removes a disposable loopback container without production mounts.

## Limits
HTTP integration is Linux in Docker on macOS, not the user's Windows desktop. Real Codex login, inference and quota are not exercised. Windows host installation symptom remains #612; upload defect is #613. Release CI/asset state must be checked independently. No 9999 deployment.
