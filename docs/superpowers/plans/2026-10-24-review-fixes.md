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
I2, I11, and the `*` key. `stopPropagation()` in the handled branches, no dead `tabindex`,
`aria-selected`, a name for the tree, the label as a non-focusable span with focus on the
node itself after a click. Regression specs from `review-shared-ui.spec.ts`. The Globus picker
integration spec passes unchanged in meaning; the picker rules hold. Pilot check with a live
endpoint stays with Eryk.

### Task R4: Compare togglers and status filter
I3 and I8. Chevron state driven by a signal shared by both togglers of a row; the filter
overlay closes its state on detach, focuses its first control on open and returns focus on
close. Regression spec from `review-compare-toggler.spec.ts` plus a keyboard spec for the
filter.

### Task R5: Toasts, dialog, dark mode leftovers
I6, M10, M6, M7. Close button visible on every severity in both modes; `aria-live`
assertive only for errors; timers pause on hover and focus; body scroll locked while a dialog
is open and the CDK overlay container above Bootstrap's modal; status colours from Bootstrap
emphasis tokens and dark rules keyed on `[data-bs-theme=dark]`. Regression spec for the close
button styles from the reviewer's demo. Screenshots: only the intended pixels change, listed
in the task report.

### Task R6: Table semantics and names
I9, I10, M11. `treegrid` structure with levels and expansion state, `columnheader` and
`gridcell`, `aria-label` on every icon only button (action toggles, toggle all, filter), tab
and accordion wiring with arrow keys on the tab list. Specs for the roles and names.

### Task R7: Cleanup
M4 (label), M8, M9, M12, M13 where it is cheap (the dataset search quartet and the file tree
builder; leave the rest with a note), M15, the `ai-context.md` theming section rewritten
around `data-bs-theme` and the `--app-*` tokens, `progress.md` and
`TRANSFER_CARD_VISUAL_ENHANCEMENTS.md` corrected or removed if obsolete (ask through the
report, do not delete history). Delete `submit-styling.spec.ts`, serve the primeicons fonts
in Karma, `jasmine.clock()` for the debounce tests where the change is mechanical.

### Task R8: Report and final screenshots
`docs/superpowers/plans/2026-10-24-review-fixes-report.md`: commits per task, which
finding each commit closes, verification outputs, the regression specs added, intended
visual changes with before and after images, what stays open (pilot Globus check, anything
deferred), deviations. Final strict harness run, light and dark, both viewports.

## Deviations

Recorded by the controller while executing, one line per deviation with the task id.
