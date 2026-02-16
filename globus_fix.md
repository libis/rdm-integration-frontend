# Globus Investigation Log (2026-02-16)

## Scope
This document tracks active investigation and stabilization work for Globus endpoint/folder selection and Angular zoneless UI refresh behavior across:
- backend: `rdm-integration`
- frontend: `rdm-integration-frontend`

## Desired outcomes
- Globus endpoint selection is reliable in normal usage.
- Globus folder selection is reliable in normal usage.
- Default folder is preselected when backend provides one.
- Endpoint variants are handled consistently:
  - personal endpoints (Linux/Windows)
  - server endpoints using `/{server_default}/`
- No user-visible zoneless refresh gaps in UI:
  - folder tree updates immediately after response
  - start transfer button state updates correctly
- Tests detect known refresh regressions before release.

## Confirmed observations (evidence)
- Search endpoint works and returns endpoint data (verified via logs).
- Options endpoint can now return nested folder hierarchy (example response includes `/ghum/home/u0050020/...`).
- A separate failure path was observed:
  - frontend sent `repoName="start"` (placeholder value)
  - backend called `/endpoint/start` and `/operation/endpoint/start/ls`
  - Globus returned `EndpointNotFound`
  - this produced frontend HTTP 500 in options flow
- Test-first reproduction exists for zoneless tree refresh issue:
  - test: `DownloadComponent getOptions nested request should update rootOptions reference for zoneless refresh`
  - failing evidence captured on 2026-02-16 (71 passed, 1 failed)
- Frontend regression suite rerun after candidate fix:
  - `Chrome Headless 144.0.0.0 (Linux 0.0.0): Executed 585 of 585 SUCCESS`
  - coverage:
    - statements: `90.83%` (2965/3264)
    - branches: `80.42%` (994/1236)
    - functions: `91.37%` (625/684)
    - lines: `91.14%` (2822/3096)

## Known issues under investigation
1. Placeholder endpoint value (`start`) can leak into backend options call.
2. Backend should avoid HTTP 500 for endpoint-placeholder/invalid endpoint cases.
3. Zoneless UI refresh bug remains:
   - folder tree response received, but tree not visible/updated until manual interaction.
4. Existing tests do not currently reproduce the zoneless refresh failure.

## Known-good behavior to preserve
- Permission-denied endpoints should continue surfacing a clear error path (toast/message), e.g.:
  - `PermissionDenied: No effective ACL rules ...`
- We should not mask real authorization failures while handling placeholder/not-found cases.

## Backend status (in progress)
- Added detailed Globus request/response logging with context fields.
- Fixed pagination regression path in Globus listing.
- Added handling for `/{server_default}/` style default directories.
- Added fallback behavior for `ClientError.NotFound` during folder listing.
- Added regression coverage for `repoName="start"` / `EndpointNotFound` path.

## Frontend status (candidate fix applied, pending verification)
- `DownloadComponent` uses signals and a refresh trigger for in-place mutations.
- Tree update behavior in zoneless mode is still inconsistent in real interaction.
- Regression test now exists and previously failed in the reported scenario.
- Added targeted repro test for detached expanded-node scenario:
  - `getOptions should update stored tree when expanded node is detached instance (zoneless repro)`
  - intent: reproduce “response received but folders not shown until user interaction”
- Candidate fix applied:
  - force new `rootOptions` array reference after node expansion responses
  - avoid sending placeholder repo value (`start`) to backend options lookup
  - reset tree selection state on repo change
- Pending: rerun targeted spec and manual smoke test to confirm behavior.

## Working approach (test-first)
1. Reproduce each issue with a focused failing test (or attach real log evidence if UI-only).
2. Apply minimal code change that makes the failing test pass.
3. Verify that known-good behavior (especially permission-denied handling) remains unchanged.
4. Re-run targeted tests and perform a manual smoke check with real endpoints.

## Current action sequence
1. Finalize backend hardening for placeholder endpoint (`start`) without hiding real permission errors.
2. Keep the frontend failing test for refresh as guardrail:
   - simulate async options response after node expansion
   - assert tree update signal produces a new value reference (zoneless-friendly)
3. Implement minimal frontend fix only after the failing test is in place.
4. Add/adjust tests to protect both:
   - folder tree refresh
   - start transfer button enable/disable refresh
5. Run targeted backend + frontend test suites.
6. Retest manually with a real Globus endpoint.

## Remaining verification
- Manual smoke test in UI with real Globus endpoint:
  - endpoint search/select
  - folder tree appears immediately after response (no extra click)
  - default directory preselection is correct
  - start transfer button state remains consistent after folder selection changes

## Definition of Done
- Placeholder/not-found endpoint path no longer causes unintended HTTP 500 in options flow.
- Folder tree appears immediately after options response in the reproduced scenario.
- Default directory preselection works in tested personal and `server_default` endpoint cases.
- Start transfer button state remains correct in tested refresh scenarios.
- Added/updated tests fail before fix and pass after fix for the targeted regression.
