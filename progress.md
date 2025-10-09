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
- **Submit component integration**
  - Replaced legacy progress bar with `TransferProgressCardComponent`.
  - Removed old polling logic (`pollingHandle`, `getDataSubscription`, `recomputeProgress`).
  - Pruned legacy SCSS for progress bar, themed styles, and animations.
  - Added plugin-neutral properties: `transferTaskId`, `transferMonitorUrl`, `transferInProgress`.
  - Implemented conditional task ID assignment: Globus uses task ID, others use dataset ID.
- **Plugin detection refactor**
  - Changed `TransferProgressCardComponent` from implicit plugin detection to explicit `isGlobus` input.
  - Submit component passes `[isGlobus]="isGlobus()"` (dynamic based on selected plugin).
  - Download component passes `[isGlobus]="true"` (always Globus, even when accessed directly).
  - Removed dependency on global `credentialsService.credentials.plugin` state.
  - Updated all component tests to set `isGlobus` explicitly.
- **Documentation**
  - Created comprehensive `TRANSFER_CARD_ARCHITECTURE.md` explaining the dual-mode design.
  - Documented plugin detection rationale and explicit input contract.
  - Added inline comments clarifying Globus vs non-Globus flows.
  - Updated architecture doc with explicit mode selection benefits.

## TODO

- Polish the download layout (button alignment, centering) for visual consistency.
- Revisit shared component/submit/download SCSS to drop any remaining obsolete selectors.
- Perform a manual smoke test of submit/download screens with both Globus and non-Globus plugins.
- Refresh documentation (`STYLING_FIX_SUMMARY.md`) if additional styling changes are made.
- Consider backend follow-ups for additional status details or error handling improvements.
