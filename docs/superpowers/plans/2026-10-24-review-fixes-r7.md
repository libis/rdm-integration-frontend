# Task R7: cleanup after the CDK migration

From the review of 2026-10-24 (`.superpowers/sdd/2026-10-24-review-fixes/review.md`).
Done by the agents like the other tasks of `2026-10-24-review-fixes.md` (Eryk, 2026-10-25:
"just do R7"). The tests (`npm run test:ci`, Karma on ChromeHeadless with `CHROME_BIN`),
`npm run lint` (ESLint plus the unused exports check) and `npm run pretty:check` stay green;
the strict screenshot harness in `tests/visual` shows whether a page changed.

1. Done on 2026-10-25 (commit 8ecb8a6): `progress.md` and `TRANSFER_CARD_VISUAL_ENHANCEMENTS.md`
   deleted, they described PrimeNG theme variables that no longer exist.
2. `ai-context.md` lines about 448 to 622 still document the PrimeNG theme system; rewrite
   that section around Bootstrap's `data-bs-theme` and the `--app-*` tokens in
   `src/styles.scss`.
3. Leftovers the lint rules do not catch (review M12): `download.component.html:27` class
   `p-inputgroup`; `table-theme-adaptive` without any rule in `compare.component.html:78`,
   `submit.component.html:120`, `redcap2-export.component.html:405`; Bootstrap 4
   `input-group-prepend` and `input-group-append` wrappers (absent from Bootstrap 5.3, they
   break the joined borders) in `connect.component.html:124`, `download.component.html:92`,
   `compute.component.html:16`, `ddi-cdi.component.html:18`; `refreshTrigger` in
   `connect.component.ts:153-159` is never bumped; `treeTableColumnCount` at
   `metadata-selector.component.ts:82` and `icon_submit`, `icon_compare`, `icon_status` at
   `compare.component.ts:98-102` are unused; `[hidden]="node.data.hidden"` at
   `compare.component.html:236` is always false; a `table` sits directly in a `tr` at
   `compare.component.html:86-98`; PrimeNG comments in `connect.component.advanced.spec.ts:538`
   and `download.component.spec.ts:485`. Line numbers are from 091d5e5; grep for the names.
4. Duplicated page logic (review M13): `onDatasetSearch`, `getDoiOptions`, `datasetSearch`,
   `onUserChange` and the "start typing to search" items exist four times (connect,
   download, compute, ddi-cdi); the `mapDatafiles` plus `addChild` plus root children block
   four times (compare, download, compute, ddi-cdi); `handleOptionsResponse`,
   `updateExpandedNodeChildren` and `optionSelected` twice (connect, download). A small
   `DatasetPickerService` (or component) and a shared `buildFileTree()` helper. Eryk:
   do the refactoring. The token field `(onChange)` bug (M8, fixed on main by the agents if
   R5 took it, otherwise here) is the kind of bug this duplication hides.
5. Test patterns (review M15): delete `src/app/submit/submit-styling.spec.ts` (it sets
   `--p-*` variables itself and asserts them, and leaks four `:root` properties); serve the
   primeicons font files through the Karma `assets` (Karma logs 404 for
   `/base/media/primeicons.woff2` in every run); prefer `jasmine.clock()` for the debounce
   tests (143 real time waits in specs, a polling helper `waitForSignal`).
6. The rest of review M14: the main compute and download suites replace the template with
   `<div></div>` (`compute.component.spec.ts` around 189, `download.component.spec.ts`
   around 290), so most of their behaviour runs without the real template; the layout
   suites added in R1 render the real template and can serve as the model.
7. Two small ones from the R1 review: `compare.component.scss` around line 19 still says
   "a window too small for that scrolls the page" (it is the page host that scrolls); the
   right panes of compute and download repeat `flex: 1 1 50%; min-width: 0`, a `split-pane`
   mixin in `src/app/shared/_page-layout.scss` would hold it.
