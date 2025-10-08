# Work Plan — Globus Transfer UI Enhancements

## Objectives

- Add Globus transfer status/polling to the submit workflow, reusing the new backend status endpoint.
- Align the download page layout with the submit page and surface the unified status UI.
- Extract a reusable progress/status component that supports both Globus-aware and generic transfers.

## Steps

1. **Audit existing implementations**
   - Review current submit component progress logic, identifying what API responses it gets today.
   - Re-read download component status implementation to catalogue shared behaviors (status text, icons, polling, buttons).
   - Inspect templates/scss for submit & download to map layout changes needed.

2. **Design shared status component**
   - Define inputs/outputs for a `TransferStatusCardComponent` that handles:
     - Base fields: icon tone/status text, progress %, files processed, optional bytes.
     - Globus extras: started/completed timestamps, task id link, refresh + open buttons.
     - Events for refresh-click when polling is disabled.
   - Decide on data model (interface) reused by submit/download services.

3. **Backend integration for submit Globus transfers**
   - Extend `SubmitService` with `getUploadStatus(taskId)` or reuse existing endpoint signature if same.
   - Update submit component logic:
     - Capture task id/monitor URL on submit response (mirroring download).
     - Start polling using shared helper, update progress data.
     - Wire refresh button and handle terminal/error states.
   - ✅ Implemented polling helpers, response handling, and status wiring in `submit.component.ts`.
   - ✅ Backend `store` endpoint now seeds Globus upload job state and surfaces `/api/common/store/status` for polling.

4. **Refactor download component to use shared component**
   - Replace inline status markup with shared component usage.
   - Ensure dataset selection layout adjustments per requirements (button relocation, centered select section).
   - Maintain existing notification flows and state transitions.

5. **Template/Style updates**
   - Submit component template: swap old progress markup for shared component, keeping existing progress bar visuals.
   - Download template: rearrange sticky header, dataset selection, and insert shared component below selection.
   - Share SCSS for the new component; adjust submit/download SCSS to remove duplicated styles.
   - ✅ Submit template now renders `TransferStatusCardComponent`; cleaned up legacy progress bar SCSS.

6. **State management + icon logic**
   - Centralize success/error/in-progress icon resolution so both submit/download show spinner/check consistently for all transport types.
   - Ensure non-Globus flows still render basic progress card without optional details/buttons.

7. **Testing**
   - Update or create unit tests covering:
     - Shared component rendering for both Globus and generic modes.
     - Submit component polling logic & event wiring.
     - Download component layout changes and prop wiring.
   - Adjust existing tests (esp. large download spec) to match new component structure.

8. **Regression pass**
   - Run `npm test` (or project test command) to ensure suites still pass.
   - Manual smoke (if feasible) for submit/download pages verifying layout + button placements.

9. **Documentation & cleanup**
   - Update any inline comments or `STYLING_FIX_SUMMARY.md` if styling rationale changes.
   - Note follow-up items if additional backend tweaks are needed.
