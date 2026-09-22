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
