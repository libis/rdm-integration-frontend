# CDK migration report

Branch `cdk-migration`, based on `main` at 6465045. Executed on 2026-09-22 from
`docs/superpowers/plans/2026-09-22-cdk-migration.md` (revision 3). All sixteen
tasks, Task 0 to Task 15, are committed. Nothing was pushed.

## Commits

The branch was squashed into a single commit before merge so it can be
reverted as one unit. The per-task history below is kept locally under the tag
`cdk-migration-tasks`. In order, oldest first:

- `941ca3a` Add CDK migration plan
- `f96393f` Own TreeNode and SelectItem models, direct CDK dependency
- `1dd6333` Bootstrap colour mode and app colour tokens
- `57e1c79` Replace PrimeNG toast with a Bootstrap toast component
- `1d23ee8` Bootstrap buttons, checkboxes, spinners and progress bar
- `55527de` Add CDK based select component
- `0f54ba7` Replace p-select with app-select on all pages
- `4d5376b` Replace p-dialog with a Bootstrap modal component
- `9086eed` Bootstrap accordion on CDK and Bootstrap nav tabs
- `0468700` Add virtual scrolling tree table component
- `e923c09` Compare page and datafile row on the CDK tree table
- `43a0d74` Download page and row on the CDK tree table
- `b3c11d9` Compute page and row on the tree table without virtualisation
- `29f3fcb` DDI-CDI page on the CDK tree table
- `34e7b6b` Metadata selector and row on the CDK tree table
- `5c17815` Globus folder picker on the CDK tree
- `ab6bab4` Remove PrimeNG
- (this commit) Add CDK migration report

## Final verification outputs

Taken after the last code commit (`Remove PrimeNG`).

### make lint

```
> datasync@0.0.0 lint
> eslint "src/**/*.{js,ts}" && npm run lint:unused-exports


> datasync@0.0.0 lint:unused-exports
> node scripts/check-unused-exports.mjs

No unused exports found.
```

Zero warnings, zero errors. The `no-deprecated` rule is still enabled.

### npm run pretty

Produced no changes.

### npx ng build

```
Initial chunk files   | Names                       |  Raw size | Estimated transfer size
chunk-N7NZCXLV.js     | -                           | 288.30 kB |                78.78 kB
styles-A3SS2BFQ.css   | styles                      | 250.71 kB |                26.28 kB
chunk-IBZICJM2.js     | -                           |  21.78 kB |                 5.09 kB
main-ZOQPSAZI.js      | main                        |   6.80 kB |                 2.24 kB
chunk-Y7TIF2TP.js     | -                           |   4.15 kB |                 1.32 kB
chunk-M6EELFIM.js     | -                           |   3.69 kB |                 1.09 kB
chunk-MOLE3HOY.js     | -                           | 647 bytes |               647 bytes
polyfills-PZSJNBYU.js | polyfills                   | 494 bytes |               494 bytes

                      | Initial total               | 576.57 kB |               115.95 kB
Lazy chunk files      | Names                       |  Raw size | Estimated transfer size
...and 12 more lazy chunks files. Use "--verbose" to show all the files.
Application bundle generation complete. [2.269 seconds] - 2026-09-22T14:01:54.815Z
▲ [WARNING] src/app/ddi-cdi/ddi-cdi.component.scss exceeded maximum budget. Budget 2.00 kB was not met by 19 bytes with a total of 2.02 kB.
▲ [WARNING] src/app/shared/transfer-progress-card/transfer-progress-card.component.scss exceeded maximum budget. Budget 2.00 kB was not met by 1.02 kB with a total of 3.02 kB.
Output location: /home/eryk/workspaces/redcap/rdm-integration-frontend/dist/datasync
```

The two component style budget warnings existed before the migration
(`ddi-cdi.component.scss` was 2.46 kB and `transfer-progress-card.component.scss`
3.35 kB on `main`). The initial bundle went from 1.55 MB (297.23 kB transfer) to
576.57 kB (115.95 kB transfer).

### npm run test:ci

```
Chrome Headless 153.0.0.0 (Linux 0.0.0): Executed 746 of 746 SUCCESS (8.119 secs / 7.918 secs)
TOTAL: 746 SUCCESS
Statements   : 91.8% ( 3640/3965 )
Branches     : 83.05% ( 1377/1658 )
Functions    : 92.89% ( 732/788 )
Lines        : 92.2% ( 3468/3761 )
```

746 executed, 0 failed. `main` had 699 tests; the suite gained the specs of
the five shared components, the page layout and row state specs, and the
extra Globus picker cases, and lost the row counting specs and the PrimeNG
ripple test.

### npm ls 2>/dev/null | grep -i prime

```
├── primeicons@7.0.0
```

Only `primeicons` remains. `package.json` lists `@angular/cdk` `^21.2.14`
(resolved 21.2.14) and no longer lists `primeng` or `@primeuix/themes`.

## Deviations from the plan

Also recorded under "Deviations" at the end of the plan file.

- Task 2: `ToastMessage` and `ActiveToast` in `toast.service.ts` are not exported. `make lint` runs `scripts/check-unused-exports.mjs`, which rejects exports that no other file imports. The `show(message: ToastMessage)` signature and the `messages` signal type are unchanged.
- Task 2: `NotificationService.showWarning` uses severity `warning` instead of PrimeNG's `warn`, because the plan's `ToastSeverity` union defines `warning`. The notification spec asserts the new value and the `alert` fallback suite is gone with the fallback.
- Task 4: `SelectComponent.toggle()` uses `if (this.open()) this.close(); else this.show();` instead of the plan's ternary statement, because ESLint `no-unused-expressions` rejects a bare ternary.
- Task 4: `select.component.spec.ts` has an extra suite that renders an `appSelectOption` template. Without an importer of `SelectOptionDirective` the unused-exports check failed, and the suite covers the custom option template that Task 5 uses on connect.
- Task 8: `TreeRowContext` in `tree-table-templates.ts` is not exported, for the same unused-exports reason as Task 2. `TreeTableRowDirective` still types its template with it.
- Task 9: the compare host height is `calc(100vh - 3.125rem)`. The plan's 3rem placeholder was to be measured in the browser; without a browser the value comes from `.dataverse-header-block { height: 3.125rem }` in `styles.scss`. `datafile.component.spec.ts` no longer replaces the template with a placeholder, since the row has no PrimeNG dependency any more, and asserts the four `.tt-cell` cells.
- Task 10: `.download-split` keeps the page's existing `14rem` offset as a definite `height: calc(100vh - 14rem)` instead of the plan's 3rem, because the split sits below the page header rows, which the old `max-height` already accounted for, and the browser measurement was not possible. The table sits in a `.download-table` wrapper (`flex: 1 1 auto; min-height: 0`). The download layout spec lives in a separate suite because the main suite replaces the template with a placeholder. The row spec renders the real template now.
- Task 11: the compute table uses `[rowHeight]="56"` because the executable row keeps its 3rem "Run on" button, which does not fit the default 41px row. The row's second cell wraps the spinner, select and button in an inner flex container inside the existing `[hidden]` div, since Bootstrap's `.d-flex` would override `[hidden]`. `.compute-split` keeps the page's 14rem offset as its definite height, as on the download page. The compute layout and row-state specs live in a separate suite because the main suite replaces the template with a placeholder.
- Task 12: the ddi-cdi template's inline `var(--p-*)` styles (preview column) are mapped to the app tokens as well, since Task 15 removes the PrimeNG theme that defines them. The float layout around the tabs became `.ddi-split` with a `.ddi-tabs-column` flex column of height `calc(100vh - 14rem)` and a `.tab-pane-console` pane, so the files pane has a definite height. Variables the plan's table does not list are mapped as follows: `--p-form-field-hover-border-color` and `--p-form-field-placeholder-color` to `--bs-border-color` and `--bs-secondary-color`, `--p-surface-100` to `--bs-secondary-bg`, `--p-text-muted-color` to `--app-muted`. The new specs live inside the existing suite because its stubs are suite-local.
- Task 13: the Bootstrap `<table>` that wrapped the metadata tree table became a `.file-list-header` div plus the `.treetable-cell` div, and the host is a flex column of height `calc(100vh - 3.125rem)` like the compare page, because a `td` cannot be a flex item with a definite height. The `treeTableColumnCount` signal stays but is no longer read by the template. The unused `TreeTableModule`, `TableModule` and `PopoverModule` were dropped from `main.ts` here rather than in Task 15, since the plan's leftover grep for Task 13 must print nothing.
- Task 14: `nodeKey` in `folder-tree.component.ts` is not exported (unused-exports check); the component exposes it as a property. The label button wraps `{{ node.label }}` in a `<span>` so that prettier's line wrapping does not add whitespace to the button's text content, which the Globus picker assertions compare exactly. `globus-picker.integration.spec.ts` keeps every original assertion and adds rendered cases for the endpoint matrix: public root without a home, object storage paths kept verbatim through selection, browsing and an empty listing, another Windows drive after a resolved home, and an empty or failed listing (loading stops, nothing selected, one request per expansion). No live personal or server endpoint was available in this session, so the endpoint matrix is covered by simulated responses only.
- Task 15: the global form-control rule in `styles.scss` maps PrimeNG's field variables that have no Bootstrap variable to Bootstrap's own defaults: padding `0.375rem 0.75rem`, transition `0.15s`, focus ring `0 0 0 0.25rem rgba(var(--bs-primary-rgb), 0.25)`. The transfer card maps `--p-surface-ground` to `--app-bg`, `--p-surface-50` to `--app-surface` and `--p-surface-100` to `--bs-secondary-bg`, and its `p-progressbar` rule now targets `.progress`. `table-theme-adaptive` class names stay in the templates without a rule. The `should set ripple to true on init` app spec went with the PrimeNG configuration it tested. Stale `// PrimeNG` section comments in the page components were renamed. `ai-context.md` still describes the old PrimeNG theming and was left untouched because the plan names only `README.md`.

## Skipped browser checks

These steps could not run in this session and are not claimed as passed.
They are the six steps left unticked in the plan file.

- Task 1 step 3: `ng serve`, switch the OS colour scheme and confirm the page
  background and text follow.
- Task 3 step 6: click through connect, compare, download and submit and
  confirm buttons keep their sizes and colours.
- Task 5 step 4: on connect, open the repository type select, filter the
  dataset select by typing, pick "Create new dataset", type a free DOI into
  the editable dataset field and open its panel, with nothing thrown in the
  console.
- Task 9 step 3 and step 5: measure the real application header height (the
  stylesheet value 3.125rem was used instead), load a dataset with folders,
  expand and collapse folders, use the status filter, toggle actions on a
  folder and confirm children follow, scroll a large listing.
- Task 14 step 6: against the pilot backend with a Globus endpoint, confirm
  the home folder is preselected, expand and select root, unselect, navigate
  with the arrow keys, check the transfer path text, and watch for one
  options request per expansion in the network tab.
- Task 15 step 6 (and the submit table check in step 3): a browser pass over
  connect, compare, download, compute, DDI-CDI, metadata selector, submit and
  REDCap export in light and dark mode.

## Not verified

- Visual appearance of any page. Only the DOM, styles as measured by Karma
  (row heights, viewport sizes, computed row colours) and behaviour are
  covered by tests.
- The executable row's "Run on" label is now visible text next to the play
  icon. The old global `.p-button-label { display: none }` rule hid every
  `pButton` label, including this one; the plan's mapping turns labels into
  text content, so the button changed appearance.
- The `calc(100vh - 14rem)` heights on the download, compute and DDI-CDI
  pages reuse the offset the pages already used for `max-height`; the plan
  wanted the header measured in the browser.
- Live Globus endpoint variants (personal Linux, macOS and Windows, server
  templates, iRODS and other mapped collections, guest collections). The
  endpoint matrix of Task 14 is covered by simulated `api/plugin/options`
  responses in `globus-picker.integration.spec.ts` only.
- `ai-context.md` still documents the PrimeNG theme system. The plan names
  only `README.md`, which had no PrimeNG mention.
- The two pre-existing component style budget warnings remain.

## Review fixes after the migration (2026-10-24 and 2026-10-25)

The review of 2026-10-24 (`/home/eryk/workspaces/redcap/rdm-integration-frontend-review-2026-10-24.md`)
found 1 critical, 12 important and 15 minor problems, nearly all where nobody had looked at a
page in a browser. Eryk asked for every finding to be fixed, on `main` directly. Plan:
`docs/superpowers/plans/2026-10-24-review-fixes.md`. 152 commits from `091d5e5` to `bb3b397`,
nothing pushed. Each task had an Opus implementer and an Opus reviewer with fix rounds; the
controller verified the gates at the checkpoints. As Eryk decided on 2026-10-25, the ARIA task
R6 was merged into R3 to R5, R7 was split into fixes (R7a) and the refactoring (R7b), and this
section replaces a written report: a changelog from the commit messages and a screenshot diff.

### Results

- Tests: 756 to 957 specs (Karma on ChromeHeadless), statements 91.86% to 93.89%, branches
  82.92% to 85.3%, functions 92.91% to 96.55%, lines 92.26% to 94.41%; the suite runs in 2.7 s
  instead of 8.5 s; real time waits in specs 193 to 81 (the rest wait for mocks that answer on
  `setTimeout(0)`).
- `npm run lint` and `npm run pretty:check` clean; production build initial total 604.18 kB
  (120.24 kB transfer) with only the two component style budget warnings that predate the
  review (ddi-cdi 2.44 kB, transfer card 3.08 kB).
- Visual checks (`tests/visual`, README there): 16 page variants at 1366x768 and 1920x1080 in
  light and dark, 32 captures per mode; the strict run exits 0 in both modes on `bb3b397`: no
  page taller than the window, no table body under 12rem, no shrunken table header, no table
  under the footer or cut by its container, no inline page host, no console error, no missing
  mock route.

### Screenshot diff, final sets against the baseline taken before any fix

Baseline: `tests/visual/out/baseline-light` and `baseline-dark` (the app at `091d5e5`); final:
`tests/visual/out/final-light` and `final-dark` (`bb3b397`). Both viewports and both modes
behave the same unless a line says otherwise.

- Identical: connect, globus-picker (its baseline was shot again once, with the backend's
  expanded home in the fixture), submit.
- compare-r0 and compare-filter: header cells centred against the header buttons (R1); in dark
  mode the status icons use theme tokens (R5); compare-filter shows the focus ring on the first
  filter checkbox, which now gets the focus when the filter opens (R4).
- compare-r12: the rejected files list stops at 30% of the page, scrolls inside and says how
  many files it holds; the file table is visible under it (R1; table body 0 to 301 px at
  1366x768).
- compute-40, compute-long-label, compute-dialog: the page fits the window (797 or 845 to 768 px
  at 1366x768), the table header is whole again (11 to 21 px), rows are 48 px (Eryk), the run
  button reads "Run" and the queue select is wider (R7a), a long dataset label ends in an
  ellipsis (R1).
- ddi-cdi: the page fits the window (934 to 768 px at 1366x768); the tab list sits 4 px lower
  so its focus ring is not cut (R5).
- download: the page fits the window (864 to 768 px at 1366x768); header cells centred.
- metadata-selector: header cells centred.
- redcap2-export: "Load variables" is joined to its input as Bootstrap 5.3 draws an input group
  (R7a).
- New captures: compare-rsize (rejected files by size), ddi-cdi-toasts (a warning and an info
  toast, with the close button visible), download-card (a running transfer, the page host
  scrolls).

### Changes beyond the findings, decided along the way

- A reload or bookmark of `/download?datasetPid=...&downloadId=...` or `/download?apiToken=...`
  lost its parameters (pre-existing since December 2025): fixed; entries with a `callback`
  (Dataverse appends `/download?dvLocale=...&callback=...` to `:GlobusAppUrl`, documented as
  `https://host/connect`) keep their redirect whatever their path (R7a).
- The token field's change handler never ran (M8); now that it runs, a token edit also clears
  everything the dataset produced, cancels listings, drops stale lookup answers by a reset
  generation, and Start transfer, Run and Regenerate need a dataset (R7a).
- The colour mode is set by an inline script in `src/index.html` before the first paint, and
  the production build keeps the stylesheet render blocking (`inlineCritical: false`), so dark
  mode paints dark from the first frame (R5).
- The select trigger is a `combobox` with an `ariaLabel` input; the queue and REDCap variable
  selects are named (R2). The tree tables are treegrids with row count and row index (R4).
- The download right column and the DDI-CDI preview scroll inside their columns now that the
  splits fit the window (R1).

### Left open

- No arrow key cell navigation inside the treegrids (every control is still reachable by Tab).
- A toast held by the pointer stays held when another toast's removal moves it away from a
  still pointer, the same as Bootstrap's own toasts; it recovers on the next pointer move.
- A computation that is polling keeps running after a token edit (the job runs on the server).
- Download asks for the dataset list a second time when the select is opened while the first
  list is still loading (pre-existing; both answers are handled).
- Still duplicated in connect and download: the endpoint search, `getOptions` and the picker part
  of `onRepoChange`; `getDoiOptions` stays per page on purpose; metadata-selector keeps its own
  tree builder (another node type).
- `context/globus_options_problem.md` in the rdm-integration repository still places
  `handleOptionsResponse` and `isRootListing` in the two components; they now live in
  `src/app/shared/folder-picker.ts`.
- Not verified here: live Globus endpoints (personal Windows, macOS and Linux, server and
  mapped collections, iRODS), browsers other than Chromium and Firefox (Firefox only for the
  select focus ring), screen reader output.

### Commits by task

### Plan and process (6)
- `7ce4bfe` Add the review fixes plan
- `6d7c54e` Ignore the local ledger folder in prettier
- `4c935c8` Merge the ARIA task into R3 to R5 and hand the cleanup to Ozgur
- `9b5a0fd` Keep the cleanup as Task R7
- `c54efe4` Mark the stale notes as deleted in the R7 list
- `7a33c26` Split R7 into fixes and refactoring and add M4, M8 and M9

### R0: visual check harness (mock API, strict layout checks, light and dark) (20)
- `4648a3a` Add harness fixtures
- `ab2e5c6` Add the visual check harness
- `031d9f0` Fail strict when a table ends under the footer or the page host overflows
- `1748b86` Expect a visible tree table on fixed height pages
- `c999a79` Allow 1 px in the document and host height checks
- `c27ba7d` Expand the preselected Globus home in the fixture
- `4f73117` Click with the real pointer in the visual flows
- `969f65b` Serve error statuses from mock routes and name failed resources
- `8fc1230` Hold toast timers on pages that capture toasts
- `336e364` Pin the browser time zone and locale and record the browser version
- `62ce194` Correct the visual harness README
- `b234d7c` Fail the capture when the mock has no route or a handler throws
- `229d75e` Match expected failures by path and status
- `fc05351` Fail strict when a clipping ancestor cuts off the table body
- `cdf263a` Fail strict on an inline page host
- `afc5e62` Check where the click event of a flow lands
- `da468f7` Stop the run when the browser ignores the pinned locale or time zone
- `63594db` Add a compare variant with files rejected by size and check the list headings
- `f9e721a` Note which spinners freezeAnimations can stop
- `2c221c2` Rewrap two harness comments

### R1: layout (C1, I4, I5, M2, M3, M5 trigger, M4 height, M14 layout specs) (20)
- `67ba2c9` Keep the tree table header at its height
- `b705181` Hide the dead scrollbar in the tree table header
- `e0feb66` Centre the tree table header cells
- `1873b5a` Let the rejected files block shrink on the compare page
- `4489b5f` Fit the download page to the window
- `23467dc` Fit the DDI-CDI page to the window
- `6d9c98b` Fit the compute page to the window
- `d655367` Keep long labels on one line in the select trigger
- `6c66b8a` Drop the fixed height of the compute run button
- `21060f8` Keep the page layout interface local to the spec helper
- `29e0dd6` Share the page layout rules in a Sass partial
- `59df765` Let the page hosts scroll when the table does not fit
- `3670686` Keep the transfer card spacing on the download page
- `4bb37ab` Add a download page with a running transfer to the visual harness
- `302e60d` Leave room for the focus rings in the compute action cell
- `f190c52` Name the modelled page height and check the page host in layout specs
- `c69969f` Compare the header midpoints within half a pixel
- `179a21d` Count the rejected files in the compare list headings
- `318c65f` Fill the DDI-CDI console pane with its output
- `c84a1ad` Check the transfer card spacing in the download layout spec

### R2: select (I1, I7, I12, M1, compute rows 48 px, overlays follow a scrolling host) (18)
- `9fcc6e5` Close the select when the selected option is activated again
- `b3d7f1d` Render the select id only when inputId is set
- `defb7f0` Keep focus on the select list when its options are replaced
- `4e34d6d` Wire the select trigger to its list and name the list and the filter
- `ad47c4a` Move from the select filter into the list on ArrowDown
- `b59456e` Close the select panel when focus leaves it
- `69d49fb` Draw the compute rows 48 px high
- `b294e2e` Let open overlays follow a scrolling page host
- `1cbe172` Ring the active select option in Firefox too and keep the background for the selected one
- `56e31c9` Keep focus in the select panel after a click on its padding
- `4e75672` Show the select's No results message outside the list
- `9705e19` Open the select from its trigger with the arrow keys
- `34f0e7f` Make the select trigger a combobox and add an ariaLabel input
- `9037900` Name the queue selects and the REDCap variable selects
- `bfd7cf4` Note that the select uses a CDK internal API to set the active option
- `721716c` Pin the Firefox outline of the active select option in a spec
- `6a32d3c` Announce the select's No results message in a status region
- `50d2baa` Name the select list after ariaLabel first, as the trigger

### R3: folder tree (I2, I11, tree ARIA) (6)
- `8da4000` Handle each folder tree key once, ignore * and drop the dead tabindex
- `315f6fa` Announce the selected folder and the tree name, and focus the node on a click
- `0e09d31` Keep the focus in the folder tree when a listing replaces the focused node
- `64d62f5` Move into the children an expanded folder tree node has now on ArrowRight
- `bfbf6ed` Hide the folder tree toggle from assistive technology
- `45aa86e` Never expand a folder tree leaf or emit nodeExpand for it

### R4: compare togglers and status filter, treegrid, button names (I3, I8, I9, I10) (8)
- `cb32119` Show the same folder state in both togglers of a compare row
- `6730b0c` Focus the compare status filter on open and close its state on Escape
- `327ec94` Expose the tree tables as treegrids with levels, expansion and cell roles
- `a80e09c` Name the icon only action, toggle all and filter buttons
- `45b401d` Return focus to the filter button on close even when a click did not focus it
- `6a07121` Give the treegrids a name, a row count and the index of every row
- `efde724` Name the compare status and action headers and the status icons
- `e149dc6` Name each folder toggle after its row

### R5: toasts, dialog scroll lock, dark mode leftovers, tabs and accordions (I6, M10, M6, M7, M11) (12)
- `df5371b` Show the toast close button at 3:1 or more on every severity in both modes
- `40762ba` Announce only error toasts assertively and hold a toast under the pointer or the focus
- `c7cb63f` Stop the page and its scrolling host behind an open dialog and raise overlays above it
- `31641d7` Colour the status icons from theme tokens and key the dark rules on data-bs-theme
- `873d007` Wire the DDI-CDI tabs to their panels with arrow keys and the accordion buttons to their regions
- `e378dd5` Keep room inside the DDI-CDI split for the focus ring of the tabs
- `d1ba0ae` Capture a warning and an info toast in the visual checks
- `e11b750` Name the DDI-CDI tab list and make the console panel a tab stop while its output is disabled
- `ec9a5db` Put back the overflow longhands a dialog hides, so an inline overflow-x set alone survives
- `4229838` Set the colour mode in index.html before the first paint and keep the stylesheet render blocking
- `6f4fbd3` State the contrast of the status icons on the action rows as measured
- `3a09e9b` Check that a toast expires on time while another is held

### R7: stale PrimeNG notes deleted (1)
- `8ecb8a6` Delete the two stale PrimeNG notes

### R7a: token, spinner and label fixes, leftovers, test patterns, docs (M4, M8, M9, M12, M14, M15), and the download reload fix (31)
- `b263c28` Render the real template in the main compute and download suites
- `4d5787f` Reset the dataset lists and store the token on a token field change
- `13d77d4` Stop the compute and DDI-CDI spinners after a failed file listing
- `f7a9d91` Label the compute run button Run and name the file it runs
- `5967594` Remove the migration leftovers and join the input group borders
- `0d08c94` Delete the styling spec, serve Karma icon fonts, drop timed waits
- `7cac8e3` Add a split-pane mixin and name the page host in a compare comment
- `676a4d8` Describe the Bootstrap colour mode and the tokens in ai-context.md
- `7e4593c` Cancel the download file listing when the token changes
- `6c0a2c5` Clear the download rows on a token change, transfer only with a dataset
- `b7833fc` Clear the compute rows on a token change and run only with a dataset
- `3a221f2` Clear what DDI-CDI produced on a token change, regenerate with a dataset
- `58e85a7` Reset nothing when the token field commits the token it already had
- `cf947be` Drive the dataset select of each page through the DOM in a spec
- `34f2968` Stop loading and show the error text when a compute request fails
- `622dd75` Check the connect search failures a millisecond before the debounce
- `0e219df` Name the current tokens in the styling and SHACL form fix summaries
- `f6eebbc` Remove the unused icon constants and the inner-table-cell class
- `99b8f40` Check what the dataset select panel shows after each answer
- `988606e` End lookups with take(1) so a synchronous answer cannot throw
- `69c8f3e` Drop compute lookups answered for a token that is no longer current
- `9e59264` Drop download lookups answered for a token that is no longer current
- `577a955` Drop DDI-CDI lookups answered for a token that is no longer current
- `8725eaf` Drop connect lookups answered for a token that is no longer current
- `49e2382` Clear the DDI-CDI console when the token changes
- `78689d4` Drop compute lookups only after a reset, not on keystrokes
- `dc59387` Drop download lookups only after a reset, not on keystrokes
- `363fd6e` Drop DDI-CDI lookups only after a reset, not on keystrokes
- `6234608` Drop connect lookups only after a reset, not on keystrokes
- `83e1994` Keep the query parameters of a direct load of the download page
- `b808445` Redirect a download entry with a callback whatever its path

### R7b: shared Globus folder picker, token edit and dataset search helpers, file tree builder (M13) (30)
- `1814f80` Add a shared Globus folder picker helper
- `fb0a64d` Use the shared folder picker on connect
- `9d386ab` Use the shared folder picker on download
- `051977a` Add shared token edit and dataset search helpers
- `c3d7e37` Use the shared token and search helpers on connect
- `e488ba8` Use the shared token and search helpers on download
- `b8a1829` Use the shared token and search helpers on compute
- `fd4ef92` Use the shared token and search helpers on DDI-CDI
- `0a71524` Add a file tree builder to UtilsService
- `80c4b5f` Build the compare file tree with the shared builder
- `f5db555` Build the compute file tree with the shared builder
- `179c8b0` Build the download file tree with the shared builder
- `c179d44` Build the DDI-CDI file tree with the shared builder
- `19baa3b` Drop the Datafile hidden field, which is never true
- `580b415` Say when the folder picker keeps the tree array
- `63a0d8a` Check what the connect collection and dataset searches post
- `8ec4d3e` Build compute rows from a listing through the real builder in a spec
- `80aad5f` Drive the connect search specs through the page, drop the aliases
- `4cfd079` Drive the download search spec through the page, drop the delegate
- `a7c46e4` Drive the DDI-CDI search specs through the page, drop the aliases
- `c9e029f` Make the Create new dataset option with one factory
- `2846504` Drop the download copy of the expanded node children spec
- `d9d2643` Add a reset to the folder picker
- `142fc87` Reset the connect folder picker through the helper
- `64c07f1` Reset the download folder picker through the helper
- `0bc1555` Add restore and store of the kept token to TokenEdit
- `5ad633f` Keep the connect token through TokenEdit
- `721ecc2` Keep the download token through TokenEdit
- `28437d9` Keep the compute token through TokenEdit
- `bb3b397` Keep the DDI-CDI token through TokenEdit
