# Globus / Zoneless Fix Log (Final) - 2026-02-16

## Current status
- Release status: ready for team validation and production rollout.
- Scope completed for backend `rdm-integration` and frontend `rdm-integration-frontend`.

## What was fixed

### Backend (`rdm-integration`)
- Globus options flow now handles default directories robustly, including `/{server_default}/`, encoded variants, and `/~/` fallback.
- Placeholder endpoint values such as `repoName="start"` no longer surface as frontend HTTP 500 in options lookup.
- Not-found behavior is handled without masking real permission-denied failures.
- Pagination logic was hardened with page-based offsets, a max-page guard, and an empty-page-with-`has_next_page=true` guard.
- Windows and Linux endpoint paths are normalized safely (`\` to `/`, duplicate slash collapse, safe `{server_default}` handling).
- Path building relies on Globus `absolute_path` results (no custom drive-letter rewriting logic).
- Temporary detailed Globus request/response logging used for investigation has been removed.

### Frontend (`rdm-integration-frontend`)
- Download flow zoneless refresh issue fixed by updating canonical tree state when expanded node instance is detached.
- Connect flow zoneless refresh issue fixed with the same detached-node-safe strategy.
- Connect repo switch behavior now resets stale tree/selection state to avoid stale UI data.
- Folder trees now refresh without requiring extra user interaction clicks after options responses.
- Start transfer / connect action enablement remains working after folder/file selection.

## Behavior validated
- Institutional endpoint (`ghum`) with default folder behavior.
- Linux personal endpoint.
- Windows personal endpoint, including navigation through `/`, `/C/`, `/C/Users/...`, and OneDrive path segments.
- Anonymous-access endpoint browsing (CERN tested).
- Permission-denied/no-access responses remain clear to users via toast path.

## Test evidence
- Regression-first approach used for zoneless detached-node refresh issues in both download and connect flows.
- Added/updated backend tests for pagination and options/default-directory behaviors in `image/app/plugin/impl/globus/common_test.go` and `image/app/plugin/impl/globus/options_test.go`.
- Frontend CI suite reported passing: `585/585 SUCCESS`.
- Backend Globus package tests pass.

## Must-preserve behavior
- Keep explicit permission-denied errors visible to users.
- Keep default-folder preselection where backend marks a selected path.
- Keep immediate zoneless tree refresh in both connect and download flows.
- Keep Linux/Windows/personal/institutional endpoint compatibility.

## Remaining rollout steps
1. Colleague smoke tests in staging with representative endpoints and permissions.
2. Production rollout.
3. Post-deploy smoke test on connect folder selection (Globus + OneDrive), download/upload selection, and one successful transfer each on Linux and Windows personal endpoints.
