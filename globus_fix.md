# Globus / Zoneless Investigation Log (2026-02-16)

## Scope
Stabilization work for endpoint and folder selection, plus Angular zoneless refresh behavior, across:
- backend: `rdm-integration`
- frontend: `rdm-integration-frontend`

## Target outcomes
- Endpoint and folder selection are reliable for Globus flows.
- Default folder preselection works when backend marks a folder as `selected: true`.
- Endpoint variants behave consistently:
  - personal endpoints (Linux/Windows)
  - institutional/server endpoints using `/{server_default}/`
- Zoneless UI refresh does not require extra user clicks to show updated folder trees.
- Tests reproduce regressions first and block reintroduction.

## Evidence collected so far
- Backend search requests return endpoint data (confirmed in logs).
- Backend options requests can return nested folder trees (example `ghum` response with nested children).
- Placeholder endpoint bug was previously observed:
  - frontend sent `repoName="start"`
  - backend called `/endpoint/start` and `/operation/endpoint/start/ls`
  - Globus returned `EndpointNotFound`
- Permission-denied error path is valid and should stay:
  - example toast: `PermissionDenied: No effective ACL rules ...`
- Manual verification from 2026-02-16:
  - download flow works with institutional endpoint (`ghum`) including default folder preselection
  - download flow works with Linux personal endpoint
  - anonymous endpoint browsing (example CERN) works
  - start transfer button in download flow activates correctly after selections
- Remaining UI issue was observed on connect page (OneDrive and Globus):
  - folder tree response arrived, but UI refresh required extra interaction

## Status summary

### Backend (`rdm-integration`)
- Added contextual Globus request/response logging (temporary, for stabilization).
- Added handling for `/{server_default}/` default directories.
- Added fallback handling for not-found folder listing path.
- Added coverage for placeholder endpoint (`start`) path.
- Current intent: keep logging until frontend/manual verification is complete, then reduce/remove.

### Frontend download flow (`DownloadComponent`)
- Detached-node zoneless issue was reproduced with a failing test, then fixed.
- Fix updates canonical tree state even when expanded event node is a detached instance.
- Tree and transfer-button refresh behavior validated in automated and manual tests.

### Frontend connect flow (`ConnectComponent`)
- New failing repro test added first for detached expanded-node behavior:
  - `getOptions should update stored tree when expanded node is detached instance (zoneless repro)`
  - observed failure before fix: `Expected undefined to be 'ghum'.`
- Fix applied to mirror download strategy:
  - keep event-node mutation for compatibility
  - update canonical `_rootOptionsData` tree by matching node identity/data+label
  - force new reference fallback if target node is not found
- Additional guard test added for repo switch reset:
  - `onRepoChange clears tree selection state and restores placeholder root`
- `onRepoChange` now clears stale tree/selection state to avoid stale folder UI between endpoints.

## Tests and runs (2026-02-16)
- Connect repro failed before fix:
  - `npm run test:ci -- --include src/app/connect/connect.component.advanced.spec.ts`
  - failure: detached-node test expected `ghum`, got `undefined`
- After fix:
  - `src/app/connect/connect.component.advanced.spec.ts`: `28 SUCCESS`
  - `src/app/connect/connect.component.behavior.spec.ts`: `19 SUCCESS`
  - `src/app/connect/connect.component.config.spec.ts`: `15 SUCCESS`

## Known-good behavior to preserve
- Keep clear permission-denied toasts/messages for inaccessible endpoints/paths.
- Do not hide real authorization failures while handling placeholder/not-found cases.
- Keep default-folder preselection behavior in both download and connect flows.

## Open items
1. Manual smoke test connect-page folder refresh for:
   - Globus plugin
   - OneDrive plugin
2. Manual smoke test that connect actions/buttons still refresh correctly after folder selection.
3. Windows personal Globus endpoint verification (user planned after re-login).
4. After stabilization, remove or reduce temporary backend logging.
5. Final cleanup and commit grouping by concern.

## Next validation sequence
1. Re-test connect page with OneDrive and Globus folder expand flows.
2. Confirm no extra click is needed for tree rendering in zoneless mode.
3. Re-check permission-denied and no-access paths still show clear toasts.
4. Run full frontend suite before final cleanup.

## Done criteria for this round
- Connect and download folder trees both render immediately after options responses.
- Default-folder preselection still works where backend marks selection.
- Permission and no-access error reporting remains clear and unchanged.
- Repro tests fail before fix and pass after fix for both download and connect regressions.
