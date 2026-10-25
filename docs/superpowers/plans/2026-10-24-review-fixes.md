# Review fixes after the CDK migration

On `main` directly (Eryk: his repo, no branch needed), from `091d5e5`, started 2026-10-24. Source: the review in
`.superpowers/sdd/2026-10-24-review-fixes/review.md` (a copy of
`/home/eryk/workspaces/redcap/rdm-integration-frontend-review-2026-10-24.md`), whose
findings are referenced below by their ids (C1, I1 to I12, M1 to M15). The reviewer's
demo specs and browser scripts are kept in `.superpowers/sdd/2026-10-24-review-fixes/
review-artifacts/` (not committed): `review-*.spec.ts` are Karma specs that demonstrate
I1, I2, I3, I6, I7, M1 and C1; `lib.cjs` and the other `.cjs` files are Playwright scripts
with API stubs for every page; `shots/` are the screenshots they took. Eryk asked for every
finding to be fixed. Same process as the dashboard follow-ups: one Opus implementer and one
Opus reviewer per task, the controller verifies the gates, small commits with one line
messages and no em dashes, nothing pushed.

Gates after every task: `npm run lint` (zero warnings and errors, unused exports check
included), `npm run pretty:check`, `npx ng build` (only the two pre-existing component style
budget warnings), `npm run test:ci` (Karma on ChromeHeadless, `CHROME_BIN=/usr/bin/chromium`,
0 failures), and from Task R1 on the screenshot harness of Task R0 in strict mode. Every
finding that the review demonstrated with a spec gets a regression spec in the repo, built
from the reviewer's demo. Light mode and dark mode are both checked. Behaviour beyond the
findings does not change; the Globus picker rules in `globus_options_problem.md` and the
assertions of `globus-picker.integration.spec.ts` stay in force.

## Tasks

### Task R0: Screenshot harness and baseline
`tests/visual/` modelled on `/home/eryk/workspaces/redcap/rdm-review-dashboard/tests/visual/`
(read its `server.mjs`, `shoot.mjs` and `README.md`): a Node only mock API serving the built
app from `dist/` and answering `/api/*` from fixtures taken from the reviewer's `lib.cjs`
stubs, and a `puppeteer-core` driver (own `package.json` under `tests/visual`, MIT) using
`/usr/bin/chromium`. Pages and variants: connect, compare with 0 and with 12 rejected files,
compare with the status filter open, download, compute with 40 rows and with a long dataset
label, compute's dialog, DDI-CDI, metadata selector, submit, REDCap export, the Globus picker
on connect with the stub endpoint; each at 1366x768 and 1920x1080, light and dark
(`prefers-color-scheme` pinned, `data-bs-theme` asserted). Each capture records the document
height against the window height, the tree table body height and the table header height;
`--strict` fails the run when a fixed height page overflows the window, a table body is
under 12rem or a header is under its no-rows height. Console errors fail every run. Baseline
run without `--strict` into `tests/visual/out/baseline` before any fix, every image looked
at. README. `tests/visual/out` gitignored.

### Task R1: Layout
C1, I4, I5, M2, M3, M5 (the trigger part), M4's inline height. Host as a flex column sized
from the header and footer tokens as the compare page does, rejected files block that can
shrink and scroll, table container with a minimum height, `.tt-header { flex: none }` with
a hidden scrollbar and a stable gutter, centred header cells, ellipsis on the select trigger
with a `title`. Strict harness run green at both viewports; layout specs tightened (M14):
realistic content, assertions against the window height.

### Task R2: Select
I1, I7, I12, M1, M5 (the `title`). Close on activating the already selected option (click,
Enter, Space); keep focus when options are replaced while open (active descendant or
refocus); `aria-haspopup`, `aria-controls`, `combobox` role and `aria-expanded` on the
editable input, names for the listbox and the filter, ArrowDown from the filter into the
list, close when focus leaves the panel; `[attr.id]` only when `inputId` is set. Regression
specs from `review-shared-ui.spec.ts` and `review-select-focus.spec.ts`. The connect page
flows that use the select (repository type, dataset search, free DOI) keep their specs green.

### Task R3: Folder tree
I2, I11, and the `*` key, plus the tree's own ARIA (R6 merged here, Eryk 2026-10-25:
"ARIA belongs with the component being touched"). `stopPropagation()` in the handled branches, no dead `tabindex`,
`aria-selected`, a name for the tree, the label as a non-focusable span with focus on the
node itself after a click. Regression specs from `review-shared-ui.spec.ts`. The Globus picker
integration spec passes unchanged in meaning; the picker rules hold. Pilot check with a live
endpoint stays with Eryk.

### Task R4: Compare togglers, status filter, table semantics and button names
I3 and I8, plus I9 (`treegrid` structure with levels and expansion state, `columnheader`
and `gridcell`) and I10 (`aria-label` on every icon only button: action toggles, toggle
all, filter), since they live in the tree table and its rows (R6 merged here). Chevron state driven by a signal shared by both togglers of a row; the filter
overlay closes its state on detach, focuses its first control on open and returns focus on
close. Regression spec from `review-compare-toggler.spec.ts` plus a keyboard spec for the
filter.

### Task R5: Toasts, dialog, dark mode leftovers, tabs and accordions
I6, M10, M6, M7, plus M11 (tab and accordion wiring with arrow keys on the tab list, and
the DDI-CDI active tab focus ring clipped by `.ddi-split`), R6 merged here. Close button visible on every severity in both modes; `aria-live`
assertive only for errors; timers pause on hover and focus; body scroll locked while a dialog
is open and the CDK overlay container above Bootstrap's modal; status colours from Bootstrap
emphasis tokens and dark rules keyed on `[data-bs-theme=dark]`. Regression spec for the close
button styles from the reviewer's demo. Screenshots: only the intended pixels change, listed
in the task report.

### Task R7a: Bug fixes, leftovers, test patterns, docs
Items 2, 3, 5, 6 and 7 of `docs/superpowers/plans/2026-10-24-review-fixes-r7.md`, plus
three findings that belong to the cleanup and were missing from that list: M8 (the token
fields bind `(onChange)`, which is not a DOM event, so `onUserChange()` never runs: a
stored token is never saved and editing the token never resets the dataset lists), M9
(compute keeps its spinner after a failed file listing) and M4's label ("Run on" after the
queue select becomes "Run", its accessible name names the file). Done before R7b so that
the bug fixes and the real template suites guard the refactoring.

### Task R7b: Refactoring of the duplicated page logic
Item 4 of the R7 list (review M13; Eryk: do the refactoring). Measured on 2026-10-25:
`handleOptionsResponse`, `updateExpandedNodeChildren` and `optionSelected` are identical in
connect and download apart from comments; `onDatasetSearch` and the debounced search wiring
are identical in connect, download, compute and ddi-cdi, while `datasetSearch` differs only
in its parameters (connect passes the collection and prepends "+ Create new dataset",
download passes an extra flag); `getDoiOptions` differs on purpose per page and stays; the
`mapDatafiles` plus `addChild` plus root children block repeats in compare, compute,
download and ddi-cdi. Shared helpers with no behaviour change: the Globus picker
acceptance spec passes unchanged in meaning, every page suite stays green, the strict
harness stays byte identical.

### Task R8: Changelog and screenshot diff
No written report (Eryk, 2026-10-25). The controller appends to
`docs/superpowers/plans/2026-09-22-cdk-migration-report.md` a short section: the commit list
since 091d5e5 from the one line messages, grouped by task; the screenshot comparison per
set in one line each; the final strict harness result and gate numbers. Final light and
dark strict runs at both viewports.

## Deviations

Recorded by the controller while executing, one line per deviation with the task id.
