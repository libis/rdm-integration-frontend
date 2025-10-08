# Work Plan — Globus Transfer UI Enhancements

## Objectives

- Add Globus transfer status/polling to the submit workflow, reusing the new backend status endpoint.
- Align the download page layout with the submit page and surface the unified status UI.
- Extract a reusable progress/status component that supports both Globus-aware and generic transfers.

## Done

- **Audit existing implementations** covering submit progress logic, download status behaviors, and template/SCSS layouts.
- **Design shared status component** with unified inputs/outputs and data models for Globus and generic transfers.
- **Backend submit integration**
  - Implemented polling helpers, response handling, and status wiring in `submit.component.ts`.
  - Backend `store` endpoint now surfaces `/api/common/store/status` for polling (mirrors download flow).
- **Download component refactor**
  - Swapped inline status markup for `TransferProgressCardComponent` while retaining notifications.
  - Download template now renders the shared card and removes duplicate styles.
- **Testing & regression**
  - Added dedicated specs for `TransferProgressCardComponent` (Globus + generic modes).
  - Updated `download.component.spec.ts` to exercise the new wiring.
  - Verified suite with `npm run test -- --watch=false --browsers=ChromeHeadless`.
- **Status presentation**
  - `TransferProgressCardComponent` now drives icon/tone/message selection through `statusIcon`, `statusTone`, and `mapCompareResultStatus`, so any consumer (download already, submit once integrated) shares consistent success/error/spinner behavior.

## TODO

- Polish the download layout (button alignment, centering) once submit refactor is complete.
- Replace the submit progress bar with `TransferProgressCardComponent` and prune legacy SCSS.
- Revisit shared component/submit/download SCSS to drop obsolete selectors after both views adopt the card.
- Confirm non-Globus transfers still render meaningful status when provided to the shared card.
- Update submit component unit tests after the template swap removes legacy polling.
- Perform a manual smoke test of submit/download screens following the shared card rollout.
- Refresh documentation (`STYLING_FIX_SUMMARY.md`, inline comments) and capture any further backend follow-ups.
