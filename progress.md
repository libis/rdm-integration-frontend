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

- **Download layout polish**
  - Refactored sticky menu to match submit component pattern.
  - Added centered title: "Download to Globus endpoint".
  - Moved action button to right side with dynamic states: "Start transfer" → "Go to dataset".
  - Both buttons use consistent `pi-angle-double-right` icon.
  - Moved dataset dropdown below sticky menu with "Dataset DOI" label (matching connect component pattern).
  - Moved `TransferProgressCardComponent` below sticky menu (matching submit component).
  - Added `(completed)="done = true"` event handler for button state transition.
  - Added `done` and `datasetUrl` properties to track completion and enable navigation.
  - Implemented `goToDataset()` method to open dataset in new tab.
  - Removed duplicate "Globus download" heading and download button from right panel.
  - All 393 tests passing after refactoring.

- **SCSS audit and cleanup**
  - Reviewed all component SCSS files (submit, download, transfer-progress-card).
  - Confirmed no obsolete Bootstrap progress-bar selectors (progress-bar-striped, progress-bar-animated).
  - Verified all styles use PrimeNG theme variables for proper light/dark mode support.
  - Download component SCSS: Clean - only p-select dropdown width fixes.
  - Submit component SCSS: Clean - only table background fixes and safety warning styling.
  - Transfer-progress-card SCSS: Comprehensive status card styling with theme-aware variables.
  - Global styles (styles.scss): Clean - no unused progress-related styles.
  - No unused imports or dead code detected in TypeScript files.
  - All 393 tests passing after review.

- **Documentation review**
  - Verified TRANSFER_CARD_ARCHITECTURE.md is comprehensive and current.
  - Documents dual-mode design (Globus vs non-Globus) with explicit `isGlobus` input.
  - Includes usage examples for both submit and download components.
  - Explains status mapping, data flow, and design decisions.
  - STYLING_FIX_SUMMARY.md documents separate file action row styling fix (unrelated).

## Completion Summary

### What Was Accomplished

1. **Test Coverage Achievement** ✅
   - Increased statement coverage from 89.77% to **90.13%**
   - Added 68 comprehensive tests to TransferProgressCardComponent
   - Added 27 targeted tests to SubmitComponent
   - All 393 tests passing with no errors

2. **Download Component Refactoring** ✅
   - Sticky menu now matches submit component pattern
   - Centered title: "Download to Globus endpoint"
   - Dynamic action button: "Start transfer" → "Go to dataset"
   - Dataset dropdown moved below sticky menu with proper label
   - TransferProgressCardComponent integrated below sticky menu
   - Removed duplicate UI elements (heading, button) from right panel

3. **Code Quality** ✅
   - No obsolete SCSS selectors or Bootstrap progress-bar classes
   - All styles use PrimeNG theme variables for light/dark mode
   - No unused imports or dead code
   - TypeScript compiler reports zero errors
   - Consistent component architecture across submit/download

4. **Documentation** ✅
   - TRANSFER_CARD_ARCHITECTURE.md: Comprehensive dual-mode design docs
   - Progress tracking: Clear done/todo separation with details
   - Inline comments explain Globus vs non-Globus flows

### Test Coverage Results

```
Statements   : 90.13% ( 1977/2193 )  ← TARGET EXCEEDED ✅
Branches     : 81.17% ( 685/844 )
Functions    : 90.98% ( 394/433 )
Lines        : 90.78% ( 1953/2151 )
```

### Remaining Work

**Manual Testing** (requires running application):

- Smoke test submit page with Globus plugin
- Smoke test submit page with non-Globus plugin (GitHub, GitLab, etc.)
- Smoke test download page with Globus transfers
- Verify button state transitions ("Start transfer" → "Go to dataset")
- Verify transfer progress card polling behavior
- Test light/dark mode appearance
