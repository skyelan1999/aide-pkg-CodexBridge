# Checked draft publication

The manual `Publish checked draft release` workflow is restricted to main. Supply a version, source commit on main, successful cross-platform CI run ID and its tested head. Source and tested Git trees must match. No release is created implicitly and published assets are never overwritten: the target must be an existing unpublished draft at that exact source.

The runner rebuilds the allowlisted plugin ZIP and six native archives, reruns synthetic Node/native checks, uploads all required assets without clobber, downloads and verifies every byte, then publishes in the existing prerelease channel. Required sidecars plus SHA256SUMS describe the actual rebuilt assets. An existing draft asset is reused only when its bytes match; mismatched or extra assets stop publication.

Use this workflow when client-side attachment uploads are unavailable; GitHub's repository-scoped workflow token handles uploads inside GitHub Actions. The token is not exported, printed, copied to another service, or stored in a package. Publication needs ordinary main integration and a deliberate workflow dispatch, not a branch-protection exception. Local candidate archive hashes remain historical when different build/compression environments produce different bytes.

For 0.3.1, draft427514038 targets948b345d32e4a833f8248641eeb1fc2f6e6cc0ca; CI40824171637 tested07c3f09119c483cd51061e81b95ba3618641e2bb with an identical source tree. All nine CI jobs passed. Client upload returned401 while ordinary API reads/writes worked; the draft remains unpublished until this workflow verifies complete assets.

Verification: four local publisher unit tests pass. GitHub Actions publication remains pending normal main integration and explicit dispatch. Draft lookup uses the release ID because the unpublished tag REST endpoint returns404; direct ID427514038 was verified as an unpublished0.3.1 draft with zero assets.

The publisher checks builder sidecars before normalizing Linux gzip headers (mtime0, empty gzip filename), then regenerates their sidecars. Tar payload bytes remain unchanged; retries of the same source do not differ only because of gzip timestamps. It rejects unexpected draft asset names before downloading them.

0.3.2 was independently published at source65e1ddd with all six complete native archives. Public assets and actual Linux native-page flows were independently verified in [post-publication acceptance](ACCEPTANCE-0.3.2-POSTPUBLICATION.md). The older0.3.1 draft is retained as historical work; do not dispatch it merely to duplicate the now published0.3.2 fixes. New source versions containing verify-host-bundle.py also run its complete-bundle check in the publisher.
