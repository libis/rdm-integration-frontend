# PrimeNG to Angular CDK plus Bootstrap Migration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove PrimeNG from the frontend and replace every PrimeNG component with Angular CDK behaviour plus Bootstrap 5 styling, page by page, with the existing test suite green after every task.

**Architecture:** Behaviour comes from `@angular/cdk` (virtual scroll, tree, listbox, overlay, accordion, focus trap). Looks come from the Bootstrap 5.3 CSS already loaded globally. Five small shared UI components live under `src/app/shared/ui/` and are the only places that touch CDK directives: toast, select, dialog, tree table (with toggler) and folder tree. Pages only use those components and plain Bootstrap markup. Nothing styles a library's internal class names.

**Tech Stack:** Angular 21.2, `@angular/cdk` 21.2.14 (already installed as a PrimeNG peer, becomes a direct dependency), Bootstrap 5.3.8 CSS, primeicons 7 (MIT, kept for the `pi pi-*` icons), Karma and Jasmine 7.

**Spec:** There is no separate spec file. The design decisions were agreed in conversation on 2026-09-22 and are recorded in the section "Design decisions" below. This plan is the design record. Revision 3 incorporates the compile-and-run reviews of revisions 1 and 2 (see "Review findings applied").

## Global Constraints

- Branch `cdk-migration`, based on `main` at 6465045. Never commit to `main` from this plan.
- No commercial or key-gated dependency may be added. Every new package must be MIT or Apache licensed. Check with `npm view <pkg> license` before adding.
- `@angular/cdk` must stay at exactly the installed Angular minor: `^21.2.14`.
- After every task: `make lint` passes with zero warnings, `npm run pretty` produces no changes, `npx ng build` passes, `npm run test:ci` passes with 0 failures. Every task boundary must leave the application compiling and usable.
- Commit messages are one short line, no body, no em dashes anywhere (commits, code, docs).
- Keep the `no-deprecated` ESLint rule enabled. It is the early warning for the next library removal.
- Do not style CDK or Bootstrap internals through `::ng-deep`. Style only the classes this plan defines.
- The application must remain usable in light and dark mode. Dark mode comes from Bootstrap's `data-bs-theme` attribute (Task 1), never from PrimeNG theme variables.
- The Globus picker rules from `rdm-integration/context/globus_options_problem.md` stay in force: the root `/` node is never auto-selected, unselecting clears the transfer path, and the selected path is shown as text under the tree. The assertions in `src/app/shared/globus-picker.integration.spec.ts` for Windows, macOS and Linux homes are mandatory acceptance tests and must pass unchanged in meaning. Preserve server and mapped-collection behaviour too; Task 14 defines the endpoint acceptance matrix. UI replacements must keep backend path values intact and must not infer a home directory or change transfer path construction.
- Every component that receives keyboard focus gets at least one keyboard interaction spec (select, dialog, folder tree).
- Every page that hosts a tree table gets a spec asserting its scroll body has a non-zero height with the page's real template and styles. Virtual tables also assert `CdkVirtualScrollViewport.getViewportSize() > 0`; the compute table uses the static scroll body. Do not stub the page template in these layout tests.

---

## Design decisions

1. **CDK, not Angular Material.** Material has no tree table, so the largest component would be built from CDK parts either way. The CDK has no visual design, so it does not go through redesigns like Material's MDC rewrite. Material remains possible later because it is built on the same primitives.
2. **Bootstrap owns the look.** Forms, buttons, tables, modals, toasts, accordions and tabs use Bootstrap 5.3 markup. There is exactly one styling system.
3. **Own data models.** `TreeNode<T>` and `SelectItem<T>` become interfaces in `src/app/models/`, with only the fields the app uses. This decouples 23 files from `primeng/api` before any component changes.
4. **Tree table without `cdk-tree`.** The file tables need virtual scrolling for tens of thousands of rows. `cdk-virtual-scroll-viewport` needs a flat array with fixed row height, so the tree table flattens the visible nodes itself and renders CSS grid rows. `cdk-tree` is used only for the small folder picker, where keyboard navigation and ARIA matter more than row count.
5. **Virtualisation is optional per table.** Virtual scrolling destroys off-screen rows. The compute page's executable rows keep `queue`, `spinning` and `computeEnabled` locally, so that table renders all rows (`[virtual]="false"`). The other four tables virtualise.
6. **Rows are grid rows, not table rows.** Virtual scrolling wraps rows in a `div`, so `<tr>` and `<td>` cannot be used. Row components render `div.tt-cell` cells inside a `div.tt-row` host. Header and rows share one `grid-template-columns` value per page, so columns stay aligned.
7. **Each row component migrates together with its page.** A row component has exactly one consuming page, so converting them in the same task keeps every commit compiling.
8. **Dialogs render in place.** A Bootstrap modal rendered inside the page with `cdkTrapFocus` replaces `p-dialog`. No portal, so content projection stays simple.
9. **Selects use overlay plus listbox.** One `app-select` component with a Bootstrap `form-select` trigger, a `cdkConnectedOverlay` panel, an optional filter input, and a `cdkListbox` for keyboard handling. It is a `ControlValueAccessor`, so the 18 `[ngModel]` bindings stay as they are. The listbox only ever receives values that exist in its options; the form value is kept separately so editable free text never reaches the listbox.
10. **Folder tree expansion is driven by the app, not by the node input.** The component walks the nodes and calls `tree.expand()` for every node with `expanded === true`, and the toggle button is our own click handler. This avoids the double and triple expansion events that the `isExpanded` input plus `expandedChange` combination produced in review.
11. **Toast is a signal queue.** A `ToastService` with a signal array and a `ToastComponent` rendering Bootstrap toasts replaces `MessageService` and `p-toast`. `NotificationService` keeps its public API.
12. **Order.** Foundation first (models, theme, toast), then the primitives every page uses (buttons, checkboxes, spinners), then select, dialog, accordion and tabs, then the tree table and the five pages that use it (each with its row component), then the folder tree, then removal of PrimeNG and its CSS variables.

## Review findings applied (revision 3)

| Finding from the compile-and-run review | Where it is fixed |
|---|---|
| Folder tree `trackBy` had the wrong signature; nested pre-expanded nodes did not render; one click emitted three expansion events | Task 14: `nodeKey(node)` for `expansionKey`, `trackNode(index, node)` for `trackBy`, expansion driven by an effect, own toggle handler, spec asserts one `nodeExpand` per click and that `alice` renders |
| Listbox output is `cdkListboxValueChange`, not `valueChange` | API table and Task 4 template |
| `(opened)="showRepoName()"` recursed because `showRepoName()` calls `show()` | Task 5: the `onFocus` binding, `showRepoName()` and the `repoNameSelect` view child are deleted |
| Compare filter overlay referenced `filterOrigin` outside the header template's scope | Task 9: the overlay `ng-template` lives inside the header template |
| Zero-height viewport without an explicit container height; `refresh()` did not remeasure | Task 8: `refresh()` calls `checkViewportSize()`; every page task sizes its container and asserts a non-zero viewport height |
| Editable free text not in the options made the listbox throw | Task 4: `listValue` only contains values present in `options` |
| Always-on virtualisation destroys the executable row's local state | Design decision 5 and Task 11: `[virtual]="false"` on the compute page |
| Changing all four row components in one task broke three pages | Tasks 9 to 13: each row component migrates with its page |
| Microtasks ran before Angular rendered the select panel or revealed the files pane | Tasks 4 and 12: `afterNextRender` with an explicit injector; tests assert filter focus and the CDK viewport's measured size after hiding and showing |
| DDI-CDI lost its dataset link and select-all control, and the checkbox called the existing handler with the wrong arguments | Task 12: preserve the link, `toggleSelectAll()` and `selectAllIcon()`; call `toggleFileSelection(filename)` with one string |
| Tests queried a directive input as a DOM attribute, omitted CDK key codes, expected the wrong initial keyboard position, and pushed optional node data into `string[]` | Tasks 4 and 14: query owned classes, send both `key` and `keyCode`, move once from the initially focused Alpha option to Beta, and type emitted data as optional |

## Verified CDK API surface (from `node_modules/@angular/cdk/types`, version 21.2.14)

Template names below are the aliases used in templates. Where the alias differs from the class property it is noted.

| Directive | Selector | Inputs used | Outputs used |
|---|---|---|---|
| CdkVirtualScrollViewport | `cdk-virtual-scroll-viewport` | `itemSize` (via CdkFixedSizeVirtualScroll), `minBufferPx`, `maxBufferPx` | none; method `checkViewportSize()` |
| CdkVirtualForOf | `*cdkVirtualFor` | `cdkVirtualForOf`, `cdkVirtualForTrackBy`, `cdkVirtualForTemplateCacheSize` | none |
| CdkConnectedOverlay | `[cdkConnectedOverlay]` on `ng-template`, exportAs `cdkConnectedOverlay` | `cdkConnectedOverlayOrigin`, `cdkConnectedOverlayOpen`, `cdkConnectedOverlayHasBackdrop`, `cdkConnectedOverlayBackdropClass`, `cdkConnectedOverlayMatchWidth` | `backdropClick`, `detach`, `overlayKeydown` |
| CdkOverlayOrigin | `[cdkOverlayOrigin]`, exportAs `cdkOverlayOrigin` | none | none |
| CdkListbox | `[cdkListbox]` | `cdkListboxValue` (readonly T[]), `cdkListboxUseActiveDescendant` | `cdkListboxValueChange` (property `valueChange`, event `ListboxValueChangeEvent` with `.value: readonly T[]`) |
| CdkOption | `[cdkOption]` | `cdkOption` (value), `cdkOptionDisabled`, `cdkOptionTypeaheadLabel` | none |
| CdkTree | `cdk-tree`, exportAs `cdkTree` | `dataSource` (`T[]` accepted), `childrenAccessor: (node: T) => T[]`, `expansionKey: (node: T) => K`, `trackBy: (index: number, node: T) => K` | none; methods `isExpanded(node)`, `expand(node)`, `collapse(node)`, `toggle(node)` |
| CdkTreeNode | `cdk-tree-node` | `isExpandable` | none used (see decision 10) |
| CdkTreeNodePadding | `[cdkTreeNodePadding]` | `cdkTreeNodePadding` (level), `cdkTreeNodePaddingIndent` | none |
| CdkAccordion | `cdk-accordion` | `multi` | none |
| CdkAccordionItem | `cdk-accordion-item`, exportAs `cdkAccordionItem` | `expanded`, `disabled` | `expandedChange`, `opened`, `closed`; method `toggle()` |
| CdkTrapFocus | `[cdkTrapFocus]` | `cdkTrapFocus`, `cdkTrapFocusAutoCapture` | none |

Bootstrap 5.3.8 classes relied on, all confirmed present in `bootstrap.min.css`: `modal-content`, `modal-header`, `modal-body`, `modal-footer`, `btn-close`, `spinner-border`, `placeholder`, `progress`, `progress-bar`, `form-check-input`, `form-select`, `accordion-item`, `accordion-button`, `accordion-collapse`, `nav-tabs`, `nav-link`, `toast`, `toast-container`, `dropdown-menu`, `dropdown-item`, `list-group-item`, and the `[data-bs-theme=dark]` colour mode.

## File structure

Created:

- `src/app/models/tree-node.ts` - `TreeNode<T>` interface.
- `src/app/models/select-item.ts` - `SelectItem<T>` interface.
- `src/app/shared/ui/toast/toast.service.ts`, `toast.component.ts`, `toast.component.spec.ts`.
- `src/app/shared/ui/select/select.component.ts`, `select.component.html`, `select.component.scss`, `select.component.spec.ts`.
- `src/app/shared/ui/dialog/dialog.component.ts`, `dialog.component.html`, `dialog.component.spec.ts`.
- `src/app/shared/ui/tree-table/tree-rows.ts` (flatten util), `tree-rows.spec.ts`, `tree-table.component.ts`, `tree-table.component.html`, `tree-table.component.scss`, `tree-table.component.spec.ts`, `tree-table-templates.ts` (header and row template directives), `tree-toggler.component.ts`.
- `src/app/shared/ui/folder-tree/folder-tree.component.ts`, `folder-tree.component.html`, `folder-tree.component.scss`, `folder-tree.component.spec.ts`.

Modified, by task: `package.json`, `src/main.ts`, `src/styles.scss`, `src/app/app.component.html`, `src/app/shared/notification.service.ts`, every page template and component listed in the inventory below, the four row components, `src/app/shared/tree-utils.ts`, `src/app/models/hierarchical-select-item.ts`, and the specs that reference PrimeNG.

Deleted in the last task: PrimeNG imports in `src/main.ts`, `primeng` and `@primeuix/themes` in `package.json`, all `--p-*` variables and `.p-*` rules in stylesheets.

## Inventory of PrimeNG usage (measured on 6465045)

| Template | PrimeNG usage |
|---|---|
| `app.component.html` | p-toast |
| `compare/compare.component.html` | p-treeTable (rows: `datafile`), p-popover with p-table + p-tableCheckbox + p-tableHeaderCheckbox, 7 pButton |
| `compute/compute.component.html` | p-treeTable (rows: `executablefile`), p-dialog, p-select, p-checkbox, p-floatlabel, p-button, pButton |
| `connect/connect.component.html` | p-accordion (2 panels), 7 p-select, p-tree, p-skeleton, 5 pButton |
| `datafile/datafile.component.html` | 2 p-treeTableToggler, pButton |
| `ddi-cdi/ddi-cdi.component.html` | p-treeTable (rows: inline `tr[ttRow]` with a p-checkbox), p-tabs, p-dialog, p-select, 2 p-checkbox, 2 p-button, 5 pButton |
| `downloadablefile/downladablefile.component.html` | p-treeTableToggler, pButton |
| `download/download.component.html` | p-treeTable (rows: `downloadablefile`), p-tree, p-dialog, 2 p-select, p-progressSpinner, pInputText, 4 p-button, 3 pButton |
| `executablefile/executablefile.component.html` | p-treeTableToggler, p-select, p-progressSpinner, pButton |
| `metadatafield/metadatafield.component.html` | p-treeTableToggler, pButton |
| `metadata-selector/metadata-selector.component.html` | p-treeTable (rows: `metadatafield`), 3 pButton |
| `redcap2-export/redcap2-export.component.html` | p-accordion (3 panels), 6 p-select, 2 p-checkbox, 6 pButton |
| `shared/transfer-progress-card/...html` | p-progressbar, 2 pButton |
| `submit/submit.component.html` | p-dialog, p-checkbox, p-button, 4 pButton |

Code: `TreeNode` from `primeng/api` in 23 files, `SelectItem` in 15, `MessageService` in 4, `PrimeTemplate` in 7 component `imports` arrays, `viewChild<Select>('repoSelect')` in `connect.component.ts:125`. Stylesheets: 51 `--p-*` or `.p-*` uses in `styles.scss`, 44 in `ddi-cdi.component.scss`, 23 in `transfer-progress-card.component.scss`, a handful in `compare`, `download`, `metadata-selector`, `redcap2-export` and `connect` component stylesheets.

Page containers around the tree tables today: compare `div.treetable-container` (scss: `overflow: hidden`, no height), download `div.download-split-left` (flex 1 1 50%, overflow hidden), compute `div.compute-split-left` (flex column), ddi-cdi none (inside a tab pane), metadata-selector `div.treetable-cell`. None of them gives a definite height today; PrimeNG's `scrollHeight="flex"` hid this. Each page task fixes it.

---

### Task 0: Own data models and a direct CDK dependency

**Files:**
- Create: `src/app/models/tree-node.ts`
- Create: `src/app/models/select-item.ts`
- Modify: `src/app/models/hierarchical-select-item.ts`
- Modify: every `.ts` file under `src/app` that imports `TreeNode` or `SelectItem` from `primeng/api` (23 plus 15 files, find them with the grep in step 3)
- Modify: `package.json`

**Interfaces:**
- Produces: `TreeNode<T>` with fields `key?`, `label?`, `data?`, `children?`, `parent?`, `expanded?`, `leaf?`, `selectable?`, `type?`. `SelectItem<T>` with `label?`, `value`, `disabled?`, `title?`. These are the only fields the app reads today (measured: `.data` 305 uses, `.children` 103, `.label` 55, `.parent` 12, `.expanded` 8, `.key` 5, `.type` 3, `.selectable` 2, `.leaf` 2; `.value` 123, `.disabled` 6, `.title` 1).

- [x] **Step 1: Write the model files**

`src/app/models/tree-node.ts`:

```ts
// Author: Eryk Kulikowski @ KU Leuven (2026). Apache 2.0 License

export interface TreeNode<T = unknown> {
  key?: string;
  label?: string;
  data?: T;
  children?: TreeNode<T>[];
  parent?: TreeNode<T>;
  expanded?: boolean;
  leaf?: boolean;
  selectable?: boolean;
  type?: string;
}
```

`src/app/models/select-item.ts`:

```ts
// Author: Eryk Kulikowski @ KU Leuven (2026). Apache 2.0 License

export interface SelectItem<T = unknown> {
  label?: string;
  value: T;
  disabled?: boolean;
  title?: string;
}
```

- [x] **Step 2: Point HierarchicalSelectItem at the own model**

In `src/app/models/hierarchical-select-item.ts` replace `import { SelectItem } from 'primeng/api';` with `import { SelectItem } from './select-item';`.

- [x] **Step 3: Rewrite the imports everywhere**

Run from the repo root:

```bash
grep -rl "from 'primeng/api'" src/app --include=*.ts
```

For each file, rewrite the import. Files that import only types keep one import per model, for example `import { TreeNode } from '../models/tree-node';` with the correct relative path. Files that also import `MessageService` or `PrimeTemplate` keep those on a separate `primeng/api` import for now (they go away in Tasks 2 and 15). Do this with a script so nothing is missed:

```bash
python3 - <<'EOF'
import re, glob, os
for p in glob.glob('src/app/**/*.ts', recursive=True):
    s = open(p).read()
    m = re.search(r"import \{([^}]*)\} from 'primeng/api';\n", s)
    if not m:
        continue
    names = [n.strip() for n in m.group(1).split(',') if n.strip()]
    keep = [n for n in names if n not in ('TreeNode', 'SelectItem')]
    rel = os.path.relpath('src/app/models', os.path.dirname(p)).replace(os.sep, '/')
    if not rel.startswith('.'):
        rel = './' + rel
    new = ''
    if 'TreeNode' in names:
        new += f"import {{ TreeNode }} from '{rel}/tree-node';\n"
    if 'SelectItem' in names:
        new += f"import {{ SelectItem }} from '{rel}/select-item';\n"
    if keep:
        new += f"import {{ {', '.join(keep)} }} from 'primeng/api';\n"
    s = s.replace(m.group(0), new, 1)
    open(p, 'w').write(s)
    print('rewrote', p)
EOF
npm run pretty
```

- [x] **Step 4: Make the CDK a direct dependency**

```bash
npm install @angular/cdk@21.2.14 --save-exact=false --no-audit
```

Confirm `package.json` now lists `"@angular/cdk": "^21.2.14"` under `dependencies` and that `package-lock.json` still resolves `node_modules/@angular/cdk` to 21.2.14.

- [x] **Step 5: Verify**

```bash
grep -rn "TreeNode\|SelectItem" src/app --include=*.ts | grep "primeng/api" ; echo "(must print nothing)"
make lint && npx ng build && npm run test:ci
```

Expected: no `primeng/api` type imports remain, build passes, 699 tests pass.

- [x] **Step 6: Commit**

```bash
git add -A && git commit -m "Own TreeNode and SelectItem models, direct CDK dependency"
```

---

### Task 1: Bootstrap colour mode and application colour tokens

**Files:**
- Modify: `src/main.ts` (before `bootstrapApplication`)
- Modify: `src/styles.scss` (top of file)

**Interfaces:**
- Produces: CSS custom properties `--app-bg`, `--app-text`, `--app-muted`, `--app-border`, `--app-primary`, `--app-surface` defined on `:root` from Bootstrap variables. Later tasks use only these six tokens in component stylesheets.

- [x] **Step 1: Switch Bootstrap colour mode with the OS preference**

Add to `src/main.ts` right above the `bootstrapApplication(` call:

```ts
const darkScheme = window.matchMedia('(prefers-color-scheme: dark)');
const applyColorMode = () =>
  document.documentElement.setAttribute(
    'data-bs-theme',
    darkScheme.matches ? 'dark' : 'light',
  );
applyColorMode();
darkScheme.addEventListener('change', applyColorMode);
```

- [x] **Step 2: Define the tokens**

Add to `src/styles.scss` directly after the `primeicons` import:

```scss
@import "@angular/cdk/overlay-prebuilt.css";

:root {
  --app-bg: var(--bs-body-bg);
  --app-text: var(--bs-body-color);
  --app-muted: var(--bs-secondary-color);
  --app-border: var(--bs-border-color);
  --app-primary: var(--bs-primary);
  --app-surface: var(--bs-tertiary-bg);
}
```

Confirm each Bootstrap variable exists before relying on it:

```bash
for v in bs-body-bg bs-body-color bs-secondary-color bs-border-color bs-primary bs-tertiary-bg; do printf "%s %s\n" $v "$(grep -c -- "--$v:" node_modules/bootstrap/dist/css/bootstrap.min.css)"; done
```

Expected: every count is at least 1.

- [ ] **Step 3: Verify in the browser**

Run `npx ng serve`, open the app, switch the OS colour scheme. Page background and text must follow. PrimeNG components still use their own theme at this point, which is expected.

- [x] **Step 4: Verify and commit**

```bash
make lint && npx ng build && npm run test:ci
git add -A && git commit -m "Bootstrap colour mode and app colour tokens"
```

---

### Task 2: Toast

**Files:**
- Create: `src/app/shared/ui/toast/toast.service.ts`
- Create: `src/app/shared/ui/toast/toast.component.ts`
- Create: `src/app/shared/ui/toast/toast.component.spec.ts`
- Modify: `src/app/shared/notification.service.ts`
- Modify: `src/app/shared/notification.service.spec.ts`
- Modify: `src/app/app.component.html:2`, `src/app/app.component.ts` (imports array), `src/app/app.component.spec.ts` (drop `MessageService` providers)
- Modify: `src/main.ts` (drop `MessageService` provider and `ToastModule` import)

**Interfaces:**
- Produces: `ToastService.show(message: ToastMessage): void` where `ToastMessage = { severity: 'error' | 'success' | 'warning' | 'info'; summary: string; detail: string; life?: number }`, `ToastService.messages: Signal<ActiveToast[]>`, `ToastService.dismiss(id: number): void`.
- Consumes: nothing.

- [x] **Step 1: Write the failing service test**

`src/app/shared/ui/toast/toast.component.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { ToastComponent } from './toast.component';
import { ToastService } from './toast.service';

describe('ToastService and ToastComponent', () => {
  beforeEach(async () => {
    jasmine.clock().install();
    await TestBed.configureTestingModule({ imports: [ToastComponent] }).compileComponents();
  });
  afterEach(() => jasmine.clock().uninstall());

  it('queues a message, renders it with the severity class and removes it after its life', () => {
    const fixture = TestBed.createComponent(ToastComponent);
    const service = TestBed.inject(ToastService);
    service.show({ severity: 'error', summary: 'Error', detail: 'boom', life: 1000 });
    fixture.detectChanges();
    const toast = fixture.nativeElement.querySelector('.toast') as HTMLElement;
    expect(toast.classList).toContain('text-bg-danger');
    expect(toast.textContent).toContain('boom');
    jasmine.clock().tick(1001);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.toast')).toBeNull();
  });

  it('dismisses a message when its close button is clicked', () => {
    const fixture = TestBed.createComponent(ToastComponent);
    TestBed.inject(ToastService).show({ severity: 'info', summary: 'Info', detail: 'stay', life: 0 });
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.btn-close') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.toast')).toBeNull();
  });
});
```

- [x] **Step 2: Run it to verify it fails**

```bash
npm run test:ci -- --include src/app/shared/ui/toast/toast.component.spec.ts
```

Expected: compile error, `./toast.component` not found.

- [x] **Step 3: Implement the service and component**

`src/app/shared/ui/toast/toast.service.ts`:

```ts
// Author: Eryk Kulikowski @ KU Leuven (2026). Apache 2.0 License

import { Injectable, signal } from '@angular/core';

export type ToastSeverity = 'error' | 'success' | 'warning' | 'info';

export interface ToastMessage {
  severity: ToastSeverity;
  summary: string;
  detail: string;
  /** Milliseconds before auto dismiss. 0 keeps the toast until closed. */
  life?: number;
}

export interface ActiveToast extends ToastMessage {
  id: number;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private nextId = 1;
  private readonly _messages = signal<ActiveToast[]>([]);
  readonly messages = this._messages.asReadonly();

  show(message: ToastMessage): void {
    const toast: ActiveToast = { ...message, id: this.nextId++ };
    this._messages.update((list) => [...list, toast]);
    const life = message.life ?? 5000;
    if (life > 0) {
      setTimeout(() => this.dismiss(toast.id), life);
    }
  }

  dismiss(id: number): void {
    this._messages.update((list) => list.filter((t) => t.id !== id));
  }
}
```

`src/app/shared/ui/toast/toast.component.ts`:

```ts
// Author: Eryk Kulikowski @ KU Leuven (2026). Apache 2.0 License

import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ToastService, ToastSeverity } from './toast.service';

const SEVERITY_CLASS: Record<ToastSeverity, string> = {
  error: 'text-bg-danger',
  success: 'text-bg-success',
  warning: 'text-bg-warning',
  info: 'text-bg-info',
};

@Component({
  selector: 'app-toast',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="toast-container position-fixed top-0 end-0 p-3" aria-live="polite" aria-atomic="true">
      @for (toast of toasts.messages(); track toast.id) {
        <div [class]="'toast show ' + severityClass(toast.severity)" role="alert">
          <div class="d-flex">
            <div class="toast-body">
              <strong>{{ toast.summary }}</strong>
              <div>{{ toast.detail }}</div>
            </div>
            <button type="button" class="btn-close btn-close-white me-2 m-auto" aria-label="Close" (click)="toasts.dismiss(toast.id)"></button>
          </div>
        </div>
      }
    </div>
  `,
})
export class ToastComponent {
  readonly toasts = inject(ToastService);

  severityClass(severity: ToastSeverity): string {
    return SEVERITY_CLASS[severity];
  }
}
```

- [x] **Step 4: Run the toast spec**

```bash
npm run test:ci -- --include src/app/shared/ui/toast/toast.component.spec.ts
```

Expected: 2 SUCCESS.

- [x] **Step 5: Switch NotificationService and the app shell**

In `src/app/shared/notification.service.ts` replace the `MessageService` injection with `private readonly toasts = inject(ToastService);` and each `this.messageService.add({...})` with `this.toasts.show({...})`, keeping the same severity, summary, detail and life values. Remove the `alert` fallback and the `optional: true` injection, since `ToastService` is `providedIn: 'root'` and always present. Update `notification.service.spec.ts` to assert on `ToastService.messages()` instead of a `MessageService` spy.

In `src/app/app.component.html` replace `<p-toast position="top-right"></p-toast>` with `<app-toast></app-toast>`. In `src/app/app.component.ts` replace `ToastModule` in `imports` with `ToastComponent`. In `src/main.ts` remove `MessageService` from providers and the `primeng/toast` import. In `src/app/app.component.spec.ts` remove the `MessageService` providers.

- [x] **Step 6: Verify and commit**

```bash
grep -rn "MessageService\|p-toast\|ToastModule" src ; echo "(must print nothing)"
make lint && npx ng build && npm run test:ci
git add -A && git commit -m "Replace PrimeNG toast with a Bootstrap toast component"
```

---

### Task 3: Bootstrap primitives in every template

**Files:**
- Modify: all 14 templates in the inventory that use `pButton`, `p-button`, `p-checkbox`, `p-progressSpinner`, `p-progressbar`, `p-skeleton`, `p-floatlabel`, `pInputText`
- Modify: the matching component `imports` arrays (drop `ButtonModule`, `ButtonDirective`, `Button`, `CheckboxModule`, `ProgressSpinnerModule`, `ProgressBarModule`, `SkeletonModule`, `FloatLabelModule`, `InputTextModule` once their last use is gone; keep DDI-CDI's `CheckboxModule` until its inline row migrates in Task 12)
- Modify: `src/main.ts` (drop those modules from `importProvidersFrom`)

**Interfaces:** none. Pure markup.

- [x] **Step 1: Buttons**

Replace each `pButton` button. The class mapping is exact:

| Old classes on `pButton` | New classes |
|---|---|
| `p-button-sm p-button-raised p-button-primary` or `p-button-sm p-button-raised` | `btn btn-sm btn-primary` |
| `p-button-sm p-button-raised p-button-secondary` | `btn btn-sm btn-secondary` |
| `p-button-sm p-button-outlined p-button-secondary` | `btn btn-sm btn-outline-secondary` |
| `p-button p-button-text p-button-sm` | `btn btn-sm btn-link` |
| `p-button p-button-raised` | `btn btn-primary` |

Rules: remove the `pButton` attribute; a `label="X"` attribute becomes text content `X` after the icon; an `icon="pi pi-filter"` attribute becomes `<i class="pi pi-filter"></i>` inside; `[ngClass]` expressions that switch `p-button-primary` and `p-button-secondary` switch `btn-primary` and `btn-secondary` instead; keep `type="button"`, `(click)`, `[disabled]`, `[attr.disabled]`, `style` and `title` as they are. `<p-button (click)="x" size="small" [raised]="true" severity="secondary">Text</p-button>` becomes `<button type="button" class="btn btn-sm btn-secondary" (click)="x">Text</button>`, and without `severity` it becomes `btn-primary`.

Example, `src/app/datafile/datafile.component.html`:

```html
<button type="button" class="btn btn-sm btn-outline-secondary" (click)="toggleAction()">
  <i [class]="actionIcon()"></i>
</button>
```

- [x] **Step 2: Checkboxes**

Each `<p-checkbox [ngModel]="v()" (ngModelChange)="v.set($event)" [binary]="true" inputId="id">` with its sibling `<label for="id">` becomes:

```html
<div class="form-check">
  <input type="checkbox" class="form-check-input" id="id" [ngModel]="v()" (ngModelChange)="v.set($event)" />
  <label class="form-check-label" for="id">Label text</label>
</div>
```

Six occurrences outside tree tables: compute, ddi-cdi (2), redcap2-export (2), submit. The checkbox inside the ddi-cdi tree table rows is handled in Task 12 together with that table.

- [x] **Step 3: Spinners, progress bar, skeleton, float label, input**

- `<p-progressSpinner [hidden]="!spinning()" styleClass="spinner-1rem" ariaLabel="loading"></p-progressSpinner>` becomes `<span class="spinner-border spinner-border-sm" role="status" aria-label="loading" [hidden]="!spinning()"></span>`. Remove the `.spinner-1rem` rule from `src/styles.scss`. The download page spinner follows the same pattern.
- `<p-progressbar [value]="filesProgressPercent()" [showValue]="false">` becomes `<div class="progress" role="progressbar" [attr.aria-valuenow]="filesProgressPercent()" aria-valuemin="0" aria-valuemax="100"><div class="progress-bar" [style.width.%]="filesProgressPercent()"></div></div>`.
- `<p-skeleton [width]="options.even ? '60%' : '50%'" height="1rem">` in the connect loader template becomes `<span class="placeholder" [style.width]="options.even ? '60%' : '50%'" style="height: 1rem"></span>`.
- `<p-floatlabel class="w-100" variant="on">` around the compute dataset select becomes a plain `<div class="w-100">` with the existing `<label class="form-label">` kept above the select.
- `pInputText` on the download preview URL input becomes `class="form-control"`.

- [x] **Step 4: Drop the modules**

Remove the now unused PrimeNG button, checkbox, spinner, progress bar, skeleton, float label and input text imports from component `imports` arrays and from `src/main.ts`. Keep DDI-CDI's component-level `CheckboxModule` while its inline row still uses `p-checkbox`; remove that import in Task 12. Lint reports unused imports.

- [x] **Step 5: Verify**

```bash
grep -rn "pButton\|<p-button\|<p-progressSpinner\|<p-progressbar\|<p-skeleton\|<p-floatlabel\|pInputText" src/app --include=*.html ; echo "(must print nothing)"
grep -rn "<p-checkbox" src/app --include=*.html ; echo "(only the ddi-cdi tree table row may remain)"
make lint && npx ng build && npm run test:ci
```

Specs that query `button[pButton]` or `.p-button` must be updated to query `button.btn`. Run `grep -rn "pButton\|p-button" src/app --include=*.spec.ts` and fix each.

- [ ] **Step 6: Browser check and commit**

Click through connect, compare, download and submit. Buttons must keep their sizes and colours.

```bash
git add -A && git commit -m "Bootstrap buttons, checkboxes, spinners and progress bar"
```

---

### Task 4: SelectComponent

**Files:**
- Create: `src/app/shared/ui/select/select.component.ts`
- Create: `src/app/shared/ui/select/select.component.html`
- Create: `src/app/shared/ui/select/select.component.scss`
- Create: `src/app/shared/ui/select/select.component.spec.ts`

**Interfaces:**
- Produces: `<app-select>` with inputs `options: SelectItem<string>[]` (required), `placeholder: string`, `filter: boolean`, `editable: boolean`, `disabled: boolean`, `inputId: string`; outputs `opened: void` (fires when the panel opens, replaces PrimeNG `onClick`), `filterChange: string` (replaces `onFilter`, emits the typed filter text), `valueChange: string | undefined` (replaces `onChange`, fires only on user selection, after the model update). Implements `ControlValueAccessor` so `[ngModel]` and `(ngModelChange)` keep working. Accepts one content template `<ng-template appSelectOption let-option>` for custom option rendering. Public method `show(): void` opens the panel; it emits `opened` exactly once per opening and must never be called from an `opened` handler.
- Consumes: `SelectItem` from Task 0.

- [x] **Step 1: Write the failing spec**

`src/app/shared/ui/select/select.component.spec.ts`:

```ts
import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { SelectComponent } from './select.component';

@Component({
  imports: [SelectComponent, FormsModule],
  template: `
    <app-select
      inputId="ds"
      [options]="options()"
      [filter]="filter()"
      [editable]="editable()"
      placeholder="Select dataset"
      [ngModel]="value()"
      (ngModelChange)="value.set($event)"
      (opened)="opens = opens + 1"
      (filterChange)="lastFilter = $event"
      (valueChange)="changes.push($event)"
    ></app-select>
  `,
})
class HostComponent {
  readonly options = signal([
    { label: 'Alpha', value: 'a' },
    { label: 'Beta', value: 'b' },
  ]);
  readonly value = signal<string | undefined>(undefined);
  readonly filter = signal(true);
  readonly editable = signal(false);
  opens = 0;
  lastFilter = '';
  changes: (string | undefined)[] = [];
}

describe('SelectComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    await fixture.whenStable();
  });

  const trigger = () => fixture.nativeElement.querySelector('.form-select') as HTMLButtonElement;
  const panel = () => document.querySelector('.cdk-overlay-container .app-select-panel') as HTMLElement | null;
  const panelOptions = () => Array.from(document.querySelectorAll('.cdk-overlay-container .app-select-option')) as HTMLElement[];
  const keyCodes = { ArrowDown: 40, Enter: 13, Escape: 27 };
  const key = (el: Element, k: keyof typeof keyCodes) =>
    el.dispatchEvent(new KeyboardEvent('keydown', { key: k, keyCode: keyCodes[k], bubbles: true, cancelable: true }));

  it('shows the placeholder, opens on click and emits opened once', async () => {
    expect(trigger().textContent).toContain('Select dataset');
    trigger().click();
    await fixture.whenStable();
    expect(host.opens).toBe(1);
    expect(panelOptions().map((o) => o.textContent!.trim())).toEqual(['Alpha', 'Beta']);
  });

  it('selects an option by click, updates ngModel, emits valueChange and closes', async () => {
    trigger().click();
    await fixture.whenStable();
    panelOptions()[1].click();
    await fixture.whenStable();
    expect(host.value()).toBe('b');
    expect(host.changes).toEqual(['b']);
    expect(trigger().textContent).toContain('Beta');
    expect(panel()).toBeNull();
  });

  it('focuses the filter after the panel has rendered', async () => {
    trigger().click();
    await fixture.whenStable();
    expect(document.activeElement).toBe(panel()!.querySelector('input.form-control'));
  });

  it('focuses the first option when the panel has no filter', async () => {
    host.filter.set(false);
    await fixture.whenStable();
    trigger().click();
    await fixture.whenStable();
    expect(document.activeElement).toBe(panelOptions()[0]);
  });

  it('selects Beta with ArrowDown then Enter after focusing Alpha', async () => {
    trigger().click();
    await fixture.whenStable();
    const listbox = document.querySelector('.cdk-overlay-container .app-select-list') as HTMLElement;
    listbox.focus();
    expect(document.activeElement).toBe(panelOptions()[0]);
    key(document.activeElement!, 'ArrowDown');
    key(document.activeElement!, 'Enter');
    await fixture.whenStable();
    expect(host.value()).toBe('b');
    expect(panel()).toBeNull();
  });

  it('closes on Escape without changing the value', async () => {
    trigger().click();
    await fixture.whenStable();
    key(document.activeElement!, 'Escape');
    await fixture.whenStable();
    expect(panel()).toBeNull();
    expect(host.value()).toBeUndefined();
  });

  it('filters locally and emits filterChange', async () => {
    trigger().click();
    await fixture.whenStable();
    const input = document.querySelector('.cdk-overlay-container input.form-control') as HTMLInputElement;
    input.value = 'bet';
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(host.lastFilter).toBe('bet');
    expect(panelOptions().map((o) => o.textContent!.trim())).toEqual(['Beta']);
  });

  it('shows the label of a value that is set from outside', async () => {
    host.value.set('a');
    await fixture.whenStable();
    expect(trigger().textContent).toContain('Alpha');
  });

  it('editable mode accepts free text as the value and can still open the panel', async () => {
    host.editable.set(true);
    await fixture.whenStable();
    const input = fixture.nativeElement.querySelector('input.form-control') as HTMLInputElement;
    input.value = 'doi:10.1/custom';
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(host.value()).toBe('doi:10.1/custom');
    (fixture.nativeElement.querySelector('.app-select .btn') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(panelOptions().length).toBe(2);
    expect(host.value()).toBe('doi:10.1/custom');
  });
});
```

- [x] **Step 2: Run it to verify it fails**

```bash
npm run test:ci -- --include src/app/shared/ui/select/select.component.spec.ts
```

Expected: compile error, `./select.component` not found.

- [x] **Step 3: Implement the component**

`src/app/shared/ui/select/select.component.ts`:

```ts
// Author: Eryk Kulikowski @ KU Leuven (2026). Apache 2.0 License

import { CdkListbox, CdkOption, ListboxValueChangeEvent } from '@angular/cdk/listbox';
import { CdkConnectedOverlay, CdkOverlayOrigin } from '@angular/cdk/overlay';
import { NgTemplateOutlet } from '@angular/common';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChild,
  Directive,
  ElementRef,
  forwardRef,
  inject,
  Injector,
  input,
  output,
  signal,
  TemplateRef,
  viewChild,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { SelectItem } from '../../../models/select-item';

@Directive({ selector: 'ng-template[appSelectOption]' })
export class SelectOptionDirective {
  constructor(readonly template: TemplateRef<{ $implicit: SelectItem<string> }>) {}
}

@Component({
  selector: 'app-select',
  templateUrl: './select.component.html',
  styleUrl: './select.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CdkConnectedOverlay, CdkOverlayOrigin, CdkListbox, CdkOption, NgTemplateOutlet],
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => SelectComponent), multi: true },
  ],
})
export class SelectComponent implements ControlValueAccessor {
  readonly options = input.required<SelectItem<string>[]>();
  readonly placeholder = input('');
  readonly filter = input(false);
  readonly editable = input(false);
  readonly disabled = input(false);
  readonly inputId = input<string | undefined>(undefined);

  readonly opened = output<void>();
  readonly filterChange = output<string>();
  readonly valueChange = output<string | undefined>();

  readonly optionTemplate = contentChild(SelectOptionDirective);
  readonly filterInput = viewChild<ElementRef<HTMLInputElement>>('filterInput');
  readonly listbox = viewChild(CdkListbox);
  private readonly renderInjector = inject(Injector);

  /** The form value. May be free text in editable mode. */
  readonly value = signal<string | undefined>(undefined);
  readonly open = signal(false);
  readonly filterText = signal('');
  readonly cvaDisabled = signal(false);

  readonly isDisabled = computed(() => this.disabled() || this.cvaDisabled());
  /** Only values that exist in options reach the listbox; anything else would make it throw. */
  readonly listValue = computed<readonly string[]>(() => {
    const v = this.value();
    return v !== undefined && this.options().some((o) => o.value === v) ? [v] : [];
  });
  readonly selectedLabel = computed(() => {
    const v = this.value();
    if (v === undefined || v === null || v === '') return undefined;
    return this.options().find((o) => o.value === v)?.label ?? String(v);
  });
  readonly visibleOptions = computed(() => {
    const text = this.filterText().trim().toLowerCase();
    if (!text) return this.options();
    return this.options().filter((o) => (o.label ?? String(o.value)).toLowerCase().includes(text));
  });

  private onChange: (v: string | undefined) => void = () => {};
  private onTouched: () => void = () => {};

  writeValue(value: string | undefined | null): void {
    this.value.set(value ?? undefined);
  }
  registerOnChange(fn: (v: string | undefined) => void): void {
    this.onChange = fn;
  }
  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }
  setDisabledState(disabled: boolean): void {
    this.cvaDisabled.set(disabled);
  }

  toggle(): void {
    if (this.isDisabled()) return;
    this.open() ? this.close() : this.show();
  }

  show(): void {
    if (this.open()) return;
    this.open.set(true);
    this.opened.emit();
    afterNextRender(() => {
      if (!this.open()) return;
      const filterInput = this.filterInput();
      if (filterInput) filterInput.nativeElement.focus();
      else this.listbox()?.focus();
    }, { injector: this.renderInjector });
  }

  close(): void {
    if (!this.open()) return;
    this.open.set(false);
    this.filterText.set('');
    this.onTouched();
  }

  onPanelKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') this.close();
  }

  onFilterInput(text: string): void {
    this.filterText.set(text);
    this.filterChange.emit(text);
  }

  onEditableInput(text: string): void {
    this.value.set(text);
    this.onChange(text);
    this.valueChange.emit(text);
  }

  onListChange(event: ListboxValueChangeEvent<string>): void {
    const selected = event.value[0];
    if (selected === undefined) return;
    this.pick(selected);
  }

  pick(selected: string): void {
    this.value.set(selected);
    this.onChange(selected);
    this.valueChange.emit(selected);
    this.close();
  }

  optionLabel(option: SelectItem<string>): string {
    return option.label ?? String(option.value);
  }
}
```

`src/app/shared/ui/select/select.component.html`:

```html
<div class="app-select" cdkOverlayOrigin #origin="cdkOverlayOrigin">
  @if (editable()) {
    <div class="input-group">
      <input
        type="text"
        class="form-control"
        [id]="inputId()"
        [placeholder]="placeholder()"
        [disabled]="isDisabled()"
        [value]="value() ?? ''"
        (input)="onEditableInput($any($event.target).value)"
      />
      <button type="button" class="btn btn-outline-secondary" aria-label="Show options" [disabled]="isDisabled()" (click)="toggle()">
        <i class="pi pi-chevron-down"></i>
      </button>
    </div>
  } @else {
    <button
      type="button"
      class="form-select text-start"
      [id]="inputId()"
      [disabled]="isDisabled()"
      [attr.aria-expanded]="open()"
      (click)="toggle()"
    >
      @if (selectedLabel(); as label) {
        {{ label }}
      } @else {
        <span class="text-body-secondary">{{ placeholder() }}</span>
      }
    </button>
  }
</div>

<ng-template
  cdkConnectedOverlay
  [cdkConnectedOverlayOrigin]="origin"
  [cdkConnectedOverlayOpen]="open()"
  [cdkConnectedOverlayHasBackdrop]="true"
  cdkConnectedOverlayBackdropClass="cdk-overlay-transparent-backdrop"
  [cdkConnectedOverlayMatchWidth]="true"
  (backdropClick)="close()"
  (detach)="close()"
>
  <div class="app-select-panel dropdown-menu show position-static shadow" (keydown)="onPanelKeydown($event)">
    @if (filter()) {
      <div class="px-2 pb-2">
        <input
          #filterInput
          type="text"
          class="form-control form-control-sm"
          placeholder="Filter"
          [value]="filterText()"
          (input)="onFilterInput($any($event.target).value)"
        />
      </div>
    }
    <ul
      class="list-unstyled mb-0 app-select-list"
      cdkListbox
      [cdkListboxValue]="listValue()"
      (cdkListboxValueChange)="onListChange($event)"
    >
      @for (option of visibleOptions(); track option.value) {
        <li
          class="dropdown-item app-select-option"
          [cdkOption]="option.value"
          [cdkOptionDisabled]="option.disabled ?? false"
          [cdkOptionTypeaheadLabel]="optionLabel(option)"
          [title]="option.title ?? ''"
        >
          @if (optionTemplate(); as tpl) {
            <ng-container *ngTemplateOutlet="tpl.template; context: { $implicit: option }"></ng-container>
          } @else {
            {{ optionLabel(option) }}
          }
        </li>
      } @empty {
        <li class="dropdown-item disabled">No results</li>
      }
    </ul>
  </div>
</ng-template>
```

`src/app/shared/ui/select/select.component.scss`:

```scss
.app-select-panel {
  max-height: 20rem;
  overflow: auto;
  width: 100%;
}

.app-select-option {
  cursor: pointer;
}

.app-select-option[aria-selected="true"],
.app-select-option:focus,
.app-select-option.cdk-option-active {
  background-color: var(--app-surface);
}
```

- [x] **Step 4: Run the spec**

```bash
npm run test:ci -- --include src/app/shared/ui/select/select.component.spec.ts
```

Expected: 9 SUCCESS. Focus is scheduled with `afterNextRender`, because setting `open` does not synchronously attach the overlay. `cdkListbox` handles click, Enter, Space and arrow keys and emits `cdkListboxValueChange` for selection changes. Its keyboard manager reads `keyCode`, so synthetic keyboard events must set it as well as `key`. Query `.app-select-option`, since a property-bound `[cdkOption]` does not produce a DOM attribute.

- [x] **Step 5: Lint, format, commit**

```bash
make lint && npm run pretty && npm run test:ci -- --include src/app/shared/ui/select/select.component.spec.ts
git add -A && git commit -m "Add CDK based select component"
```

---

### Task 5: Replace the 18 p-select usages

**Files:**
- Modify: `src/app/connect/connect.component.html` (7), `src/app/redcap2-export/redcap2-export.component.html` (6), `src/app/download/download.component.html` (2), `src/app/compute/compute.component.html` (1), `src/app/ddi-cdi/ddi-cdi.component.html` (1), `src/app/executablefile/executablefile.component.html` (1)
- Modify: the six matching `.component.ts` files (`imports`: add `SelectComponent` and, for connect, `SelectOptionDirective`; drop `SelectModule`)
- Modify: `src/app/connect/connect.component.ts:125` (delete `repoNameSelect` view child), `:1247` (delete `showRepoName()`), `:1626` `onDatasetSelectionChange(event: { value: string })` becomes `onDatasetSelectionChange(value: string | undefined)`
- Modify: `src/main.ts` (drop `SelectModule`)
- Modify: specs that dispatch PrimeNG select events or spy on `showRepoName` (search `onChange\|onFilter\|onClick\|showRepoName\|repoNameSelect` in `*.spec.ts` for these pages)

**Interfaces:**
- Consumes: `SelectComponent` from Task 4.

- [x] **Step 1: Attribute mapping**

For every `<p-select ...>` apply this mapping and nothing else:

| PrimeNG | app-select |
|---|---|
| `appendTo="body"` | remove (the overlay always renders in the CDK container) |
| `autoWidth="false"`, `[style]="{ width: '100%' }"` | remove, add class `w-100` |
| `id="x"` | `inputId="x"` |
| `[options]`, `[ngModel]`, `(ngModelChange)`, `placeholder`, `[placeholder]`, `[editable]`, `[filter]` | unchanged |
| `filterBy="label"`, `[resetFilterOnHide]="true"` | remove (built in) |
| `(onClick)="f()"` | `(opened)="f()"` |
| `(onFilter)="f($event.filter)"` | `(filterChange)="f($event)"` |
| `(onChange)="f()"` | `(valueChange)="f()"` |
| `(onChange)="onDatasetSelectionChange($event)"` | `(valueChange)="onDatasetSelectionChange($event)"` with the signature change above |
| `(onFocus)="showRepoName()"` and `#repoSelect` | delete both. The trigger button opens the panel on click and on Enter, which is what the focus hook did. Delete `showRepoName()` and the `repoNameSelect` view child in `connect.component.ts`, they have no other callers |
| `<ng-template pTemplate="option" let-option>` | `<ng-template appSelectOption let-option>` |
| `<ng-template pTemplate="selectedItem" let-option>` | remove (the trigger shows the label) |
| `<ng-template pTemplate="loader" let-options="options">` | remove; the loading state is an option whose label is `Loading...`, which already exists in `branchItems` via `loadingItem` |

Never bind `(opened)` to a handler that calls `show()` on the same select. `show()` emits `opened`, so that would recurse.

Ordering: PrimeNG fired `onChange` before `ngModelChange` had settled in some flows. `app-select` updates the model first and then emits `valueChange`, so handlers that read the signal, like `onRepoChange()`, see the new value. Verify each handler that reads state does not rely on the old value.

- [x] **Step 2: Do the connect page first, run its specs**

```bash
grep -n "showRepoName\|repoNameSelect\|repoSelect" src/app/connect/*.ts src/app/connect/*.html ; echo "(must print nothing)"
npm run test:ci -- --include "src/app/connect/*.spec.ts"
```

Expected: SUCCESS. Specs that emitted `{ value }` objects to `onDatasetSelectionChange` must pass the string now.

- [x] **Step 3: Remaining five pages, one at a time, running each page's specs after it**

```bash
npm run test:ci -- --include "src/app/redcap2-export/*.spec.ts"
npm run test:ci -- --include "src/app/download/*.spec.ts"
npm run test:ci -- --include "src/app/compute/*.spec.ts"
npm run test:ci -- --include "src/app/ddi-cdi/*.spec.ts"
npm run test:ci -- --include "src/app/executablefile/*.spec.ts"
```

- [ ] **Step 4: Verify, browser check, commit**

```bash
grep -rn "<p-select\|SelectModule\|primeng/select" src ; echo "(must print nothing)"
make lint && npx ng build && npm run test:ci
```

In the browser: on connect, open the repository type select, filter the dataset select by typing, pick "Create new dataset", type a free DOI into the editable dataset field and then open its panel. All must behave as before and nothing may throw in the console.

```bash
git add -A && git commit -m "Replace p-select with app-select on all pages"
```

---

### Task 6: DialogComponent and the four dialogs

**Files:**
- Create: `src/app/shared/ui/dialog/dialog.component.ts`, `dialog.component.html`, `dialog.component.spec.ts`
- Modify: `src/app/download/download.component.html:40` region, `src/app/submit/submit.component.html`, `src/app/compute/compute.component.html`, `src/app/ddi-cdi/ddi-cdi.component.html` and their `.ts` `imports`
- Modify: `src/main.ts` (drop `DialogModule`)

**Interfaces:**
- Produces: `<app-dialog [visible] (visibleChange) header="..." [closable]="true" position="center" | "topright">`, body via default content projection, footer via `<div appDialogFooter>` projection. `visible` is a `model<boolean>()`. Escape and the close button set it to false when `closable` is true. `(hidden)` output fires after the dialog closes, replacing `(onHide)`.
- Consumes: `CdkTrapFocus`.

- [x] **Step 1: Write the failing spec**

`src/app/shared/ui/dialog/dialog.component.spec.ts`:

```ts
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { DialogComponent } from './dialog.component';

@Component({
  imports: [DialogComponent],
  template: `
    <app-dialog header="Submit" [(visible)]="visible" [closable]="closable()" (hidden)="hidden = hidden + 1">
      <p>Body text</p>
      <div appDialogFooter><button type="button" class="btn btn-primary" (click)="visible.set(false)">OK</button></div>
    </app-dialog>
  `,
})
class HostComponent {
  readonly visible = signal(false);
  readonly closable = signal(true);
  hidden = 0;
}

describe('DialogComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
  });

  it('renders nothing while hidden and a modal with header, body and footer when visible', async () => {
    const fixture = TestBed.createComponent(HostComponent);
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.modal')).toBeNull();
    fixture.componentInstance.visible.set(true);
    await fixture.whenStable();
    const modal = fixture.nativeElement.querySelector('.modal') as HTMLElement;
    expect(modal.querySelector('.modal-title')!.textContent).toContain('Submit');
    expect(modal.querySelector('.modal-body')!.textContent).toContain('Body text');
    expect(modal.querySelector('.modal-footer button')!.textContent).toContain('OK');
  });

  it('moves focus into the dialog when it opens', async () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.visible.set(true);
    await fixture.whenStable();
    await new Promise<void>((r) => setTimeout(r));
    expect((fixture.nativeElement as HTMLElement).contains(document.activeElement)).toBeTrue();
  });

  it('closes on the close button and on Escape, and emits hidden', async () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.visible.set(true);
    await fixture.whenStable();
    (fixture.nativeElement.querySelector('.btn-close') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(fixture.componentInstance.visible()).toBeFalse();
    expect(fixture.componentInstance.hidden).toBe(1);
    fixture.componentInstance.visible.set(true);
    await fixture.whenStable();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await fixture.whenStable();
    expect(fixture.componentInstance.visible()).toBeFalse();
  });

  it('has no close button and ignores Escape when not closable', async () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.closable.set(false);
    fixture.componentInstance.visible.set(true);
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.btn-close')).toBeNull();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await fixture.whenStable();
    expect(fixture.componentInstance.visible()).toBeTrue();
  });
});
```

- [x] **Step 2: Run it to verify it fails**

```bash
npm run test:ci -- --include src/app/shared/ui/dialog/dialog.component.spec.ts
```

- [x] **Step 3: Implement**

`src/app/shared/ui/dialog/dialog.component.ts`:

```ts
// Author: Eryk Kulikowski @ KU Leuven (2026). Apache 2.0 License

import { CdkTrapFocus } from '@angular/cdk/a11y';
import { ChangeDetectionStrategy, Component, effect, input, model, output } from '@angular/core';

@Component({
  selector: 'app-dialog',
  templateUrl: './dialog.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CdkTrapFocus],
  host: { '(document:keydown.escape)': 'onEscape()' },
})
export class DialogComponent {
  readonly visible = model(false);
  readonly header = input('');
  readonly closable = input(true);
  readonly position = input<'center' | 'topright'>('center');
  readonly hidden = output<void>();

  constructor() {
    let wasVisible = false;
    effect(() => {
      const now = this.visible();
      if (wasVisible && !now) this.hidden.emit();
      wasVisible = now;
    });
  }

  close(): void {
    if (!this.closable()) return;
    this.visible.set(false);
  }

  onEscape(): void {
    if (this.visible()) this.close();
  }
}
```

`src/app/shared/ui/dialog/dialog.component.html`:

```html
@if (visible()) {
  <div class="modal-backdrop show"></div>
  <div class="modal d-block" tabindex="-1" role="dialog" aria-modal="true" [attr.aria-label]="header()">
    <div class="modal-dialog" [class.app-dialog-topright]="position() === 'topright'" cdkTrapFocus cdkTrapFocusAutoCapture>
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">{{ header() }}</h5>
          @if (closable()) {
            <button type="button" class="btn-close" aria-label="Close" (click)="close()"></button>
          }
        </div>
        <div class="modal-body"><ng-content></ng-content></div>
        <div class="modal-footer"><ng-content select="[appDialogFooter]"></ng-content></div>
      </div>
    </div>
  </div>
}
```

Add to `src/styles.scss`:

```scss
.app-dialog-topright {
  margin: 1rem 1rem 0 auto;
}
```

- [x] **Step 4: Run the spec, then replace the four dialogs**

Each `<p-dialog header="H" [modal]="true" [visible]="v()" (visibleChange)="v.set($event)" [closable]="false" position="topright" (onHide)="x()">` becomes `<app-dialog header="H" [visible]="v()" (visibleChange)="v.set($event)" [closable]="false" position="topright" (hidden)="x()">`. The footer `<ng-template pTemplate="footer">...</ng-template>` becomes `<div appDialogFooter>...</div>`. Body content stays.

Run the page specs after each: download, submit, compute, ddi-cdi.

- [x] **Step 5: Verify and commit**

```bash
grep -rn "<p-dialog\|DialogModule\|primeng/dialog" src ; echo "(must print nothing)"
make lint && npx ng build && npm run test:ci
git add -A && git commit -m "Replace p-dialog with a Bootstrap modal component"
```

---

### Task 7: Accordion and tabs

**Files:**
- Modify: `src/app/connect/connect.component.html` (accordion, 2 panels), `src/app/connect/connect.component.ts` (imports, `expandedPanels` helpers)
- Modify: `src/app/redcap2-export/redcap2-export.component.html` (accordion, 3 panels) and its `.ts`
- Modify: `src/app/ddi-cdi/ddi-cdi.component.html` (tabs) and its `.ts`
- Modify: `src/main.ts` (drop `AccordionModule`, `TabsModule`)

**Interfaces:**
- Consumes: `CdkAccordionModule` (`cdk-accordion`, `cdk-accordion-item`).

- [x] **Step 1: Accordion markup**

The connect accordion, with `expandedPanels: signal<string[]>` already present:

```html
<cdk-accordion class="accordion" [multi]="true">
  <cdk-accordion-item class="accordion-item" #source="cdkAccordionItem" [expanded]="isPanelExpanded('0')" (expandedChange)="setPanelExpanded('0', $event)">
    <h2 class="accordion-header">
      <button type="button" class="accordion-button" [class.collapsed]="!source.expanded" [attr.aria-expanded]="source.expanded" (click)="source.toggle()">
        Data/code source
      </button>
    </h2>
    <div class="accordion-collapse collapse" [class.show]="source.expanded">
      <div class="accordion-body">
        ... existing panel content ...
      </div>
    </div>
  </cdk-accordion-item>
  ... second panel with value '1' ...
</cdk-accordion>
```

Add to `connect.component.ts`:

```ts
isPanelExpanded(id: string): boolean {
  return this.expandedPanels().includes(id);
}

setPanelExpanded(id: string, expanded: boolean): void {
  this.expandedPanels.update((ids) =>
    expanded ? Array.from(new Set([...ids, id])) : ids.filter((x) => x !== id),
  );
}
```

Add `CdkAccordionModule` from `@angular/cdk/accordion` to the component `imports`. Repeat for the three panels of redcap2-export with the panel ids that page already uses.

- [x] **Step 2: Tabs**

The ddi-cdi tabs become Bootstrap nav tabs with the `activeTab` signal. Use `[hidden]` for the panes, not `@if`, so the tree table keeps its state when switching:

```html
<ul class="nav nav-tabs" role="tablist">
  <li class="nav-item" role="presentation">
    <button type="button" class="nav-link" role="tab" [class.active]="activeTab() === 'files'" [attr.aria-selected]="activeTab() === 'files'" (click)="selectTab('files')">Select files</button>
  </li>
  <li class="nav-item" role="presentation">
    <button type="button" class="nav-link" role="tab" [class.active]="activeTab() === 'console'" [attr.aria-selected]="activeTab() === 'console'" (click)="selectTab('console')">Console output</button>
  </li>
</ul>
<div role="tabpanel" class="tab-pane-files" [hidden]="activeTab() !== 'files'"> ... files pane ... </div>
<div role="tabpanel" [hidden]="activeTab() !== 'console'"> ... console pane ... </div>
```

`selectTab(tab)` sets `activeTab` now; Task 12 extends it to remeasure the tree table when the files pane becomes visible.

- [x] **Step 3: Specs**

The connect specs that assert on `expandedPanels()` keep passing. Add one spec to `connect.component.behavior.spec.ts`:

```ts
it('setPanelExpanded adds and removes panel ids without duplicates', () => {
  const fixture = TestBed.createComponent(ConnectComponent);
  const comp = fixture.componentInstance;
  comp.expandedPanels.set(['0']);
  comp.setPanelExpanded('1', true);
  comp.setPanelExpanded('1', true);
  expect(comp.expandedPanels()).toEqual(['0', '1']);
  comp.setPanelExpanded('0', false);
  expect(comp.expandedPanels()).toEqual(['1']);
  expect(comp.isPanelExpanded('1')).toBeTrue();
});
```

- [x] **Step 4: Verify and commit**

```bash
grep -rn "<p-accordion\|<p-tab\|AccordionModule\|TabsModule" src ; echo "(must print nothing)"
make lint && npx ng build && npm run test:ci
git add -A && git commit -m "Bootstrap accordion on CDK and Bootstrap nav tabs"
```

---

### Task 8: TreeTableComponent, toggler and row flattening

**Files:**
- Create: `src/app/shared/ui/tree-table/tree-rows.ts`, `tree-rows.spec.ts`
- Create: `src/app/shared/ui/tree-table/tree-table-templates.ts`
- Create: `src/app/shared/ui/tree-table/tree-toggler.component.ts`
- Create: `src/app/shared/ui/tree-table/tree-table.component.ts`, `.html`, `.scss`, `.spec.ts`

**Interfaces:**
- Produces:
  - `flattenVisibleRows<T>(nodes: TreeNode<T>[]): TreeRow<T>[]` where `TreeRow<T> = { node: TreeNode<T>; level: number }`. Depth first, includes a node's children only when `node.expanded` is true.
  - `<app-tree-table [nodes] [loading] [virtual]="true" [rowHeight]="41" [columns]="'1fr 4rem 4rem 1fr'" (expandedChange)>` with template ref `#tt="appTreeTable"`, method `toggle(node: TreeNode<T>): void` that flips `node.expanded`, re-flattens and emits `expandedChange` with the node, and method `refresh(): void` that re-flattens and remeasures the viewport (`checkViewportSize()`), for use after the table becomes visible or after the page mutates nodes in place.
  - `virtual` false renders every row inside a plain scrolling `div.tt-body` with `@for`. Rows then keep their component state.
  - Content templates: `<ng-template appTreeTableHeader>` (one header row of `div.tt-cell` elements) and `<ng-template appTreeTableRow let-node let-level="level">` (one row; the page puts its row component on a `div.tt-row` here).
  - `<app-tree-toggler [node] [level] (toggle)>` renders the chevron button and indentation; leaf nodes render a same-width spacer.
  - Sizing contract: `app-tree-table` fills the height of its parent (`height: 100%`). The parent must have a definite height. Each page task sets one.
- Consumes: `TreeNode` from Task 0, `ScrollingModule`.

- [x] **Step 1: Write the failing flatten spec**

`src/app/shared/ui/tree-table/tree-rows.spec.ts`:

```ts
import { TreeNode } from '../../../models/tree-node';
import { flattenVisibleRows } from './tree-rows';

describe('flattenVisibleRows', () => {
  const tree: TreeNode<string>[] = [
    { data: 'a', expanded: true, children: [{ data: 'a1' }, { data: 'a2', expanded: false, children: [{ data: 'a2x' }] }] },
    { data: 'b', children: [{ data: 'b1' }] },
    { data: 'c' },
  ];

  it('lists roots and the children of expanded nodes only, with levels', () => {
    expect(flattenVisibleRows(tree).map((r) => [r.node.data, r.level])).toEqual([
      ['a', 0], ['a1', 1], ['a2', 1], ['b', 0], ['c', 0],
    ]);
  });

  it('follows a toggled node', () => {
    tree[1].expanded = true;
    expect(flattenVisibleRows(tree).map((r) => r.node.data)).toEqual(['a', 'a1', 'a2', 'b', 'b1', 'c']);
    tree[1].expanded = false;
  });

  it('returns an empty list for no nodes', () => {
    expect(flattenVisibleRows([])).toEqual([]);
  });
});
```

- [x] **Step 2: Run it to verify it fails, then implement**

`src/app/shared/ui/tree-table/tree-rows.ts`:

```ts
// Author: Eryk Kulikowski @ KU Leuven (2026). Apache 2.0 License

import { TreeNode } from '../../../models/tree-node';

export interface TreeRow<T> {
  node: TreeNode<T>;
  level: number;
}

export function flattenVisibleRows<T>(nodes: TreeNode<T>[], level = 0, out: TreeRow<T>[] = []): TreeRow<T>[] {
  for (const node of nodes) {
    out.push({ node, level });
    if (node.expanded && node.children?.length) {
      flattenVisibleRows(node.children, level + 1, out);
    }
  }
  return out;
}
```

Run: `npm run test:ci -- --include src/app/shared/ui/tree-table/tree-rows.spec.ts`. Expected: 3 SUCCESS.

- [x] **Step 3: Template directives and toggler**

`src/app/shared/ui/tree-table/tree-table-templates.ts`:

```ts
// Author: Eryk Kulikowski @ KU Leuven (2026). Apache 2.0 License

import { Directive, TemplateRef } from '@angular/core';
import { TreeNode } from '../../../models/tree-node';

export interface TreeRowContext<T> {
  $implicit: TreeNode<T>;
  level: number;
}

@Directive({ selector: 'ng-template[appTreeTableHeader]' })
export class TreeTableHeaderDirective {
  constructor(readonly template: TemplateRef<unknown>) {}
}

@Directive({ selector: 'ng-template[appTreeTableRow]' })
export class TreeTableRowDirective<T = unknown> {
  constructor(readonly template: TemplateRef<TreeRowContext<T>>) {}
}
```

`src/app/shared/ui/tree-table/tree-toggler.component.ts`:

```ts
// Author: Eryk Kulikowski @ KU Leuven (2026). Apache 2.0 License

import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TreeNode } from '../../../models/tree-node';

@Component({
  selector: 'app-tree-toggler',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="tt-indent" [style.width.rem]="level() * 1.25"></span>
    @if (expandable()) {
      <button type="button" class="btn btn-link btn-sm p-0 tt-toggle" [attr.aria-expanded]="node().expanded ?? false" aria-label="Toggle folder" (click)="toggle.emit()">
        <i class="pi" [class.pi-chevron-down]="node().expanded" [class.pi-chevron-right]="!node().expanded"></i>
      </button>
    } @else {
      <span class="tt-toggle"></span>
    }
  `,
  styles: `
    :host { display: inline-flex; align-items: center; }
    .tt-indent { display: inline-block; flex: none; }
    .tt-toggle { display: inline-block; width: 1.5rem; text-align: center; }
  `,
})
export class TreeTogglerComponent<T = unknown> {
  readonly node = input.required<TreeNode<T>>();
  readonly level = input(0);
  readonly toggle = output<void>();
  readonly expandable = computed(() => (this.node().children?.length ?? 0) > 0);
}
```

- [x] **Step 4: Write the failing tree table spec**

`src/app/shared/ui/tree-table/tree-table.component.spec.ts`:

```ts
import { afterNextRender, Component, inject, Injector, signal, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TreeNode } from '../../../models/tree-node';
import { TreeTableComponent } from './tree-table.component';
import { TreeTableHeaderDirective, TreeTableRowDirective } from './tree-table-templates';
import { TreeTogglerComponent } from './tree-toggler.component';

@Component({
  imports: [TreeTableComponent, TreeTableHeaderDirective, TreeTableRowDirective, TreeTogglerComponent],
  template: `
    <button type="button" class="switch-tab" (click)="toggleVisible()">Switch tab</button>
    <div [hidden]="!visible()" style="height: 300px">
      <app-tree-table #tt [nodes]="nodes()" [loading]="loading()" [virtual]="virtual()" columns="1fr 4rem" (expandedChange)="expanded.push($event.data)">
        <ng-template appTreeTableHeader>
          <div class="tt-cell">Name</div>
          <div class="tt-cell">Size</div>
        </ng-template>
        <ng-template appTreeTableRow let-node let-level="level">
          <div class="tt-row" role="row">
            <div class="tt-cell"><app-tree-toggler [node]="node" [level]="level" (toggle)="tt.toggle(node)"></app-tree-toggler>{{ node.data }}</div>
            <div class="tt-cell">{{ level }}</div>
          </div>
        </ng-template>
      </app-tree-table>
    </div>
  `,
})
class HostComponent {
  readonly nodes = signal<TreeNode<string>[]>([
    { data: 'docs', children: [{ data: 'a.txt' }, { data: 'b.txt' }] },
    { data: 'readme.md' },
  ]);
  readonly loading = signal(false);
  readonly virtual = signal(true);
  readonly visible = signal(true);
  readonly table = viewChild<TreeTableComponent<string>>('tt');
  private readonly renderInjector = inject(Injector);
  expanded: unknown[] = [];

  toggleVisible(): void {
    this.visible.update((visible) => !visible);
    if (this.visible()) {
      afterNextRender(() => {
        if (this.visible()) this.table()?.refresh();
      }, { injector: this.renderInjector });
    }
  }
}

describe('TreeTableComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
  });

  const rowsOf = (el: HTMLElement) =>
    Array.from(el.querySelectorAll('.tt-row')).map((r) => r.querySelector('.tt-cell')!.textContent!.trim());

  it('renders the header and the collapsed roots', async () => {
    const fixture = TestBed.createComponent(HostComponent);
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.tt-header')!.textContent).toContain('Name');
    expect(rowsOf(fixture.nativeElement)).toEqual(['docs', 'readme.md']);
  });

  it('gives the viewport the height of its container', async () => {
    const fixture = TestBed.createComponent(HostComponent);
    await fixture.whenStable();
    const body = fixture.nativeElement.querySelector('.tt-body') as HTMLElement;
    expect(body.offsetHeight).toBeGreaterThan(200);
    expect(fixture.componentInstance.table()!.viewport()!.getViewportSize()).toBeGreaterThan(200);
  });

  it('remeasures after a hidden pane becomes visible', async () => {
    const fixture = TestBed.createComponent(HostComponent);
    await fixture.whenStable();
    const viewport = fixture.componentInstance.table()!.viewport()!;
    const switchTab = fixture.nativeElement.querySelector('.switch-tab') as HTMLButtonElement;
    expect(viewport.getViewportSize()).toBeGreaterThan(200);
    switchTab.click();
    await fixture.whenStable();
    expect(viewport.elementRef.nativeElement.offsetHeight).toBe(0);
    switchTab.click();
    await fixture.whenStable();
    expect(viewport.elementRef.nativeElement.offsetHeight).toBeGreaterThan(200);
    expect(viewport.getViewportSize()).toBeGreaterThan(200);
  });

  it('expands a folder through the toggler and emits expandedChange', async () => {
    const fixture = TestBed.createComponent(HostComponent);
    await fixture.whenStable();
    (fixture.nativeElement.querySelector('.tt-toggle') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(rowsOf(fixture.nativeElement)).toEqual(['docs', 'a.txt', 'b.txt', 'readme.md']);
    expect(fixture.componentInstance.expanded).toEqual(['docs']);
    expect(fixture.componentInstance.nodes()[0].expanded).toBeTrue();
  });

  it('shows a spinner while loading', async () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.loading.set(true);
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.tt-loading .spinner-border')).not.toBeNull();
  });

  it('virtualises long lists: renders far fewer rows than nodes', async () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.nodes.set(Array.from({ length: 5000 }, (_, i) => ({ data: `f${i}` })));
    await fixture.whenStable();
    const rendered = fixture.nativeElement.querySelectorAll('.tt-row').length;
    expect(rendered).toBeGreaterThan(5);
    expect(rendered).toBeLessThan(200);
  });

  it('renders every row when virtual is false', async () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.virtual.set(false);
    fixture.componentInstance.nodes.set(Array.from({ length: 300 }, (_, i) => ({ data: `f${i}` })));
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelectorAll('.tt-row').length).toBe(300);
  });
});
```

- [x] **Step 5: Implement the tree table**

`src/app/shared/ui/tree-table/tree-table.component.ts`:

```ts
// Author: Eryk Kulikowski @ KU Leuven (2026). Apache 2.0 License

import { CdkVirtualScrollViewport, ScrollingModule } from '@angular/cdk/scrolling';
import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, contentChild, input, output, signal, viewChild } from '@angular/core';
import { TreeNode } from '../../../models/tree-node';
import { flattenVisibleRows, TreeRow } from './tree-rows';
import { TreeTableHeaderDirective, TreeTableRowDirective } from './tree-table-templates';

@Component({
  selector: 'app-tree-table',
  exportAs: 'appTreeTable',
  templateUrl: './tree-table.component.html',
  styleUrl: './tree-table.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ScrollingModule, NgTemplateOutlet],
})
export class TreeTableComponent<T = unknown> {
  readonly nodes = input.required<TreeNode<T>[]>();
  readonly loading = input(false);
  readonly virtual = input(true);
  readonly rowHeight = input(41);
  readonly columns = input('1fr');
  readonly expandedChange = output<TreeNode<T>>();

  readonly headerTemplate = contentChild.required(TreeTableHeaderDirective);
  readonly rowTemplate = contentChild.required(TreeTableRowDirective<T>);
  readonly viewport = viewChild(CdkVirtualScrollViewport);

  private readonly version = signal(0);
  readonly rows = computed<TreeRow<T>[]>(() => {
    this.version();
    return flattenVisibleRows(this.nodes());
  });

  toggle(node: TreeNode<T>): void {
    node.expanded = !node.expanded;
    this.version.update((v) => v + 1);
    this.expandedChange.emit(node);
  }

  refresh(): void {
    this.version.update((v) => v + 1);
    this.viewport()?.checkViewportSize();
  }

  trackRow = (_: number, row: TreeRow<T>): unknown => row.node.key ?? row.node;
}
```

`src/app/shared/ui/tree-table/tree-table.component.html`:

```html
<div class="tt" [style.--tt-columns]="columns()" [style.--tt-row-height.px]="rowHeight()">
  <div class="tt-header" role="row">
    <ng-container *ngTemplateOutlet="headerTemplate().template"></ng-container>
  </div>
  @if (loading()) {
    <div class="tt-loading"><span class="spinner-border spinner-border-sm" role="status" aria-label="Loading"></span></div>
  }
  @if (virtual()) {
    <cdk-virtual-scroll-viewport class="tt-body" [itemSize]="rowHeight()" [minBufferPx]="rowHeight() * 10" [maxBufferPx]="rowHeight() * 20">
      <ng-container *cdkVirtualFor="let row of rows(); trackBy: trackRow; templateCacheSize: 0">
        <ng-container *ngTemplateOutlet="rowTemplate().template; context: { $implicit: row.node, level: row.level }"></ng-container>
      </ng-container>
    </cdk-virtual-scroll-viewport>
  } @else {
    <div class="tt-body tt-body-static">
      @for (row of rows(); track trackRow($index, row)) {
        <ng-container *ngTemplateOutlet="rowTemplate().template; context: { $implicit: row.node, level: row.level }"></ng-container>
      }
    </div>
  }
</div>
```

`src/app/shared/ui/tree-table/tree-table.component.scss`:

```scss
.tt {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  color: var(--app-text);
  background: var(--app-bg);
}

.tt-header {
  display: grid;
  grid-template-columns: var(--tt-columns);
  font-weight: 600;
  border-bottom: 1px solid var(--app-border);
  overflow-y: scroll;
  scrollbar-gutter: stable;
}

.tt-body {
  flex: 1 1 auto;
  min-height: 0;
  scrollbar-gutter: stable;
}

.tt-body-static {
  overflow: auto;
}

.tt-loading {
  padding: 0.25rem 0.5rem;
}
```

Add to `src/styles.scss` (global on purpose: the rows are projected from page templates, and these two classes are defined by this plan, not by a library):

```scss
.tt-row {
  display: grid;
  grid-template-columns: var(--tt-columns);
  height: var(--tt-row-height);
  align-items: center;
  border-bottom: 1px solid var(--app-border);
}

.tt-cell {
  padding: 0 0.5rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
```

- [x] **Step 6: Run the spec**

```bash
npm run test:ci -- --include "src/app/shared/ui/tree-table/*.spec.ts"
```

Expected: 10 SUCCESS. The viewport height test needs the host's 300px wrapper; that is the sizing contract every page must honour. The hidden-pane test uses the same `afterNextRender` timing as Task 12 and checks the CDK's cached measurement, since a positive DOM height alone does not prove virtual scrolling works.

- [x] **Step 7: Lint, format, commit**

```bash
make lint && npm run pretty
git add -A && git commit -m "Add virtual scrolling tree table component"
```

---

### Task 9: Compare page with the datafile row

**Files:**
- Modify: `src/app/datafile/datafile.component.html`, `.ts`, `.spec.ts`, `datafile-styling.spec.ts`
- Modify: `src/app/compare/compare.component.html`, `compare.component.ts`, `compare.component.scss`, `compare.component.spec.ts`

**Interfaces:**
- Produces: `div[app-datafile]` with `node = input.required<TreeNode<Datafile>>()`, `level = input(0)`, `toggle = output<void>()`, rendering `div.tt-cell` cells. The `datafile` input and all action logic stay.
- Consumes: `TreeTableComponent`, the template directives, `TreeTogglerComponent`, `CdkConnectedOverlay`, `CdkOverlayOrigin`.

- [x] **Step 1: Convert the datafile row**

`src/app/datafile/datafile.component.html`:

```html
<div class="tt-cell">
  <app-tree-toggler [node]="node()" [level]="level()" (toggle)="toggle.emit()"></app-tree-toggler>{{ sourceFile() }}
</div>
<div class="tt-cell text-center">
  <i [class]="comparisonIcon()" [style]="'color:' + comparisonColor()" [title]="comparisonTitle()"></i>
</div>
<div class="tt-cell text-center">
  <button type="button" class="btn btn-sm btn-outline-secondary" (click)="toggleAction()">
    <i [class]="actionIcon()"></i>
  </button>
</div>
<div [class]="'tt-cell ' + targetFileClass()">
  <app-tree-toggler [node]="node()" [level]="level()" (toggle)="toggle.emit()"></app-tree-toggler>{{ targetFile() }}
</div>
```

In `datafile.component.ts`: change the selector to `div[app-datafile]`; replace `readonly rowNode = input<TreeNode<Datafile>>({})` with `readonly node = input.required<TreeNode<Datafile>>()`, `readonly level = input(0)` and `readonly toggle = output<void>()`; remove the `node` computed that looked the node up in `rowNodeMap` (the input now provides it); add `TreeTogglerComponent` to `imports`. Update `datafile.component.spec.ts` to set `node` and `level` and to query `.tt-cell` instead of `td`. Rewrite `datafile-styling.spec.ts` to an `app-tree-table` host like the one in Task 8 step 4, with an `app-datafile` row, keeping its assertions about row styling.

- [x] **Step 2: Replace the compare tree table**

```html
<div class="treetable-container">
  <app-tree-table #tt [nodes]="rootNodeChildrenView()" [loading]="loading()" columns="1fr 4rem 4rem 1fr">
    <ng-template appTreeTableHeader>
      <div class="tt-cell">
        {{ repo() }}
        <span [hidden]="!folderName()" [title]="repoName()">({{ folderName() }})</span>
      </div>
      <div class="tt-cell text-center">
        <span title="Comparison status">
          <button type="button" class="btn btn-sm btn-primary" cdkOverlayOrigin #filterOrigin="cdkOverlayOrigin" [disabled]="loading()" (click)="filterOpen.set(!filterOpen())">
            <i class="pi pi-filter"></i>
          </button>
        </span>
        <ng-template cdkConnectedOverlay [cdkConnectedOverlayOrigin]="filterOrigin" [cdkConnectedOverlayOpen]="filterOpen()" [cdkConnectedOverlayHasBackdrop]="true" cdkConnectedOverlayBackdropClass="cdk-overlay-transparent-backdrop" (backdropClick)="filterOpen.set(false)">
          <div class="dropdown-menu show position-static shadow p-2">
            <div class="form-check">
              <input type="checkbox" class="form-check-input" id="filter-all" [checked]="selectedFilterItems().length === filterItems.length" (change)="toggleAllFilters($any($event.target).checked)" />
              <label class="form-check-label" for="filter-all" title="Show all files">All</label>
            </div>
            @for (item of filterItems; track item.label) {
              <div class="form-check">
                <input type="checkbox" class="form-check-input" [id]="'filter-' + item.label" [checked]="isFilterSelected(item)" (change)="toggleFilter(item, $any($event.target).checked)" />
                <label class="form-check-label" [for]="'filter-' + item.label" [title]="item.title">
                  <i [style]="item.iconStyle" [class]="item.icon"></i>&nbsp;{{ item.label }}
                </label>
              </div>
            }
          </div>
        </ng-template>
      </div>
      <div class="tt-cell text-center"><span title="Action"><i [class]="icon_action"></i></span></div>
      <div class="tt-cell text-end">
        {{ isNewDataset() ? dataverseHeaderNoColon() : dataverseHeader() }}
        (
        @if (!isNewDataset()) {
          <a [href]="data().url" target="_blank">{{ data().id }}</a>
        } @else {
          {{ displayDatasetId() }}
        }
        )
      </div>
    </ng-template>
    <ng-template appTreeTableRow let-node let-level="level">
      <div
        app-datafile
        #datafileRow="appDatafile"
        class="tt-row"
        role="row"
        [hidden]="node.data.hidden"
        [datafile]="node.data"
        [node]="node"
        [level]="level"
        [loading]="loading()"
        [rowNodeMap]="rowNodeMap()"
        [isInFilter]="isInFilterMode()"
        [trigger]="refreshTrigger()"
        (toggle)="tt.toggle(node)"
        (changed)="onRowActionChanged()"
        [style]="datafileRow.hostStyle()"
      ></div>
    </ng-template>
  </app-tree-table>
</div>
```

The overlay `ng-template` sits inside the header template because `#filterOrigin` is scoped to that embedded view. Referencing it from outside does not compile.

Add to `compare.component.ts`:

```ts
readonly filterOpen = signal(false);

isFilterSelected(item: FilterItem): boolean {
  return this.selectedFilterItems().includes(item);
}

toggleFilter(item: FilterItem, checked: boolean): void {
  this.selectedFilterItems.update((items) =>
    checked ? [...items, item] : items.filter((i) => i !== item),
  );
}

toggleAllFilters(checked: boolean): void {
  this.selectedFilterItems.set(checked ? [...this.filterItems] : []);
}
```

Remove `visibleRowCount`, `useVirtualScroll`, `countVisibleRows`, `recountVisibleRows` and the effect that calls them. Replace `PopoverModule`, `TableModule`, `TreeTableModule` in `imports` with `TreeTableComponent`, `TreeTableHeaderDirective`, `TreeTableRowDirective`, `CdkConnectedOverlay`, `CdkOverlayOrigin`.

- [x] **Step 3: Size the container**

Delete the `.table` and `.p-*` rules from `compare.component.scss`. Make the page a column flex layout so the table takes the remaining height:

```scss
:host {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 3rem);
}

.treetable-container {
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
}
```

Adjust the `3rem` to the real height of the app header, measured in the browser. Everything above the table on the page (title row, buttons) is part of the column and keeps its natural height.

- [x] **Step 4: Specs**

In `compare.component.spec.ts` remove tests of `recountVisibleRows` and `useVirtualScroll`, and add:

```ts
it('toggleFilter and toggleAllFilters update the selected filters', () => {
  const fixture = TestBed.createComponent(CompareComponent);
  const comp = fixture.componentInstance;
  comp.toggleAllFilters(false);
  expect(comp.selectedFilterItems()).toEqual([]);
  comp.toggleFilter(comp.filterItems[0], true);
  expect(comp.isFilterSelected(comp.filterItems[0])).toBeTrue();
  comp.toggleAllFilters(true);
  expect(comp.selectedFilterItems().length).toBe(comp.filterItems.length);
});

it('gives the tree table viewport a height with the page styles', async () => {
  const fixture = TestBed.createComponent(CompareComponent);
  // seed rowNodeMap with one folder and one file the way the existing data tests do
  await fixture.whenStable();
  const body = fixture.nativeElement.querySelector('.tt-body') as HTMLElement;
  expect(body.offsetHeight).toBeGreaterThan(0);
});
```

Use the real page template and styles for the layout spec, with its normal data/service fixtures. If the existing suite overrides the template with a placeholder, put this spec in a separate suite without that override. Karma renders component styles, so the second spec fails if the page forgets the sizing rules. For virtual tables also query `CdkVirtualScrollViewport` with `By.directive(CdkVirtualScrollViewport)` and assert `getViewportSize() > 0`; the compute page instead checks its static `.tt-body`.

```bash
npm run test:ci -- --include "src/app/{datafile,compare}/*.spec.ts"
```

- [ ] **Step 5: Browser check, verify, commit**

Load a dataset with folders. Expand and collapse folders, use the status filter, toggle actions on a folder and confirm children follow, scroll a large listing.

```bash
make lint && npx ng build && npm run test:ci
git add -A && git commit -m "Compare page and datafile row on the CDK tree table"
```

---

### Task 10: Download page with the downloadable file row

**Files:**
- Modify: `src/app/downloadablefile/downladablefile.component.html`, `.ts`, `.spec.ts`
- Modify: `src/app/download/download.component.html`, `.ts`, `.scss`, `download.component.spec.ts`

- [x] **Step 1: Convert the row**

Same treatment as the datafile row: selector `div[app-downloadablefile]`, inputs `node` and `level`, output `toggle`, two `div.tt-cell` cells (name with toggler, action button with `text-end`).

- [x] **Step 2: Replace the tree table**

`columns="1fr 6rem"`, header cells for the file name and the action column, and the row:

```html
<ng-template appTreeTableRow let-node let-level="level">
  <div app-downloadablefile class="tt-row" role="row" [datafile]="node.data" [node]="node" [level]="level" [rowNodeMap]="rowNodeMap()" [trigger]="refreshTrigger()" (toggle)="tt.toggle(node)" (changed)="onRowActionChanged()"></div>
</ng-template>
```

Keep the inputs the download row already has. Remove `visibleRowCount`, `useVirtualScroll`, `countVisibleRows`, `recountVisibleRows` from `download.component.ts` and their specs, including the "recountVisibleRows counts only rows under expanded nodes" spec added in September 2026.

Leave the folder picker `p-tree` in place for now. It is replaced in Task 14.

- [x] **Step 3: Size the container and clean the stylesheet**

`.download-split-left` already is `flex: 1 1 50%; overflow: hidden`. Give the split a definite height and make the left pane a column:

```scss
.download-split {
  height: calc(100vh - 3rem);
}

.download-split-left {
  display: flex;
  flex-direction: column;
  min-height: 0;
}
```

with the table wrapper inside it as `flex: 1 1 auto; min-height: 0`. Delete the `.p-select` and `.p-select-overlay` rules and replace `var(--p-text-muted-color)` with `var(--app-muted)`.

- [x] **Step 4: Specs, verify, commit**

Add the viewport height spec from Task 9 step 4 to `download.component.spec.ts`.

```bash
npm run test:ci -- --include "src/app/{downloadablefile,download}/*.spec.ts"
make lint && npx ng build && npm run test:ci
git add -A && git commit -m "Download page and row on the CDK tree table"
```

---

### Task 11: Compute page with the executable file row, not virtualised

**Files:**
- Modify: `src/app/executablefile/executablefile.component.html`, `.ts`, `.spec.ts`
- Modify: `src/app/compute/compute.component.html`, `.ts`, `.scss`, `compute.component.spec.ts`

- [x] **Step 1: Convert the row**

Selector `div[app-executablefile]`, inputs `node` and `level`, output `toggle`. Two cells: the name with the toggler, and the second cell holding the spinner, the queue `app-select` and the run button exactly as today. The row keeps its `queue`, `spinning` and `computeEnabled` signals.

- [x] **Step 2: Replace the tree table without virtualisation**

```html
<app-tree-table #tt [nodes]="rootNodeChildren()" [loading]="loading()" [virtual]="false" columns="1fr 24rem">
```

`[virtual]="false"` is required here: virtual scrolling destroys off-screen rows and would drop a chosen queue and the access check result. Compute lists only the executable files of a dataset, so rendering all rows is fine. Remove the visible-row counting code and its specs as in Task 10.

- [x] **Step 3: Size the container**

`.compute-split-left` is already a flex column. Give `.compute-split` a definite height as in Task 10 and the table wrapper `flex: 1 1 auto; min-height: 0`.

- [x] **Step 4: Specs, verify, commit**

Add a spec that renders two executable rows, selects a queue in the first row through the `app-select`, scrolls, and asserts the row still shows that queue. Add the viewport height spec.

```bash
npm run test:ci -- --include "src/app/{executablefile,compute}/*.spec.ts"
make lint && npx ng build && npm run test:ci
git add -A && git commit -m "Compute page and row on the tree table without virtualisation"
```

---

### Task 12: DDI-CDI page with inline rows

**Files:**
- Modify: `src/app/ddi-cdi/ddi-cdi.component.html`, `.ts`, `.scss`, `ddi-cdi.component.spec.ts`

- [x] **Step 1: Replace the tree table inside the files tab**

This table has no row component. Its body was an inline `tr[ttRow]` with the file name and a `p-checkbox`. The new row:

```html
<app-tree-table #tt [nodes]="rootNodeChildren()" [loading]="loading()" columns="1fr 4rem">
  <ng-template appTreeTableHeader>
    <div class="tt-cell"><a [href]="data().url" target="_blank">{{ data().id }}</a></div>
    <div class="tt-cell text-center">
      <button type="button" class="btn btn-sm btn-outline-secondary" title="Toggle select all" aria-label="Toggle select all" (click)="toggleSelectAll()">
        <i [class]="selectAllIcon()"></i>
      </button>
    </div>
  </ng-template>
  <ng-template appTreeTableRow let-node let-level="level">
    <div class="tt-row" role="row" [style]="selectedFiles().has(node.data.name || '') ? selectedFileStyle : ignoredFileStyle">
      <div class="tt-cell"><app-tree-toggler [node]="node" [level]="level" (toggle)="tt.toggle(node)"></app-tree-toggler>{{ node.data.name }}</div>
      <div class="tt-cell text-center">
        <input type="checkbox" class="form-check-input" [checked]="selectedFiles().has(node.data.name || '')" [attr.aria-label]="'Select ' + (node.data.name || 'file')" (change)="toggleFileSelection(node.data.name || '')" />
      </div>
    </div>
  </ng-template>
</app-tree-table>
```

Keep the existing `toggleFileSelection(filename: string)`, `toggleSelectAll()` and `selectAllIcon()` unchanged. Selection is keyed by filename, so pass `node.data.name || ''` as the single argument. Preserve the dataset link in the header. Remove the visible-row counting code and its specs, and now remove DDI-CDI's remaining `CheckboxModule` import.

- [x] **Step 2: Remeasure when the files tab becomes visible**

The pane is `[hidden]` from Task 7. Add `afterNextRender`, `inject`, `Injector` and `viewChild` to the Angular core imports and import `TreeTableComponent`. Extend `selectTab`:

```ts
readonly filesTable = viewChild<TreeTableComponent<Datafile>>('tt');
private readonly renderInjector = inject(Injector);

selectTab(tab: 'files' | 'console'): void {
  this.activeTab.set(tab);
  if (tab === 'files') {
    afterNextRender(() => {
      if (this.activeTab() === 'files') this.filesTable()?.refresh();
    }, { injector: this.renderInjector });
  }
}
```

`refresh()` calls `checkViewportSize()` after Angular has removed `[hidden]`. A microtask can run before that render and cache a zero viewport size, even though the DOM later has a positive height. Route programmatic tab changes through `selectTab()` too, including the reset to files when loading a dataset, so every route back to the files pane remeasures.

- [x] **Step 3: Size the container and map the stylesheet**

Give the files pane a definite height (column flex from the tab list down, as in Task 9). `ddi-cdi.component.scss` has 44 PrimeNG variable uses. Map them: `--p-content-background` to `--app-bg`, `--p-text-color` to `--app-text`, `--p-surface-border` to `--app-border`, `--p-primary-color` to `--app-primary`, `--p-border-radius` to `--bs-border-radius`, `--p-form-field-*` background, colour and border to `--bs-body-bg`, `--bs-body-color`, `--bs-border-color`, `--p-form-field-focus-border-color` to `--bs-primary`, `--p-form-field-disabled-*` to `--bs-secondary-bg` and `--bs-secondary-color`, `--p-input-*` to `--bs-body-bg` and `--bs-body-color`. Delete the `.p-treetable` rule block entirely.

- [x] **Step 4: Specs, verify, commit**

Use the real page template and styles. Add the viewport height spec, then switch to the console tab and back using the tab buttons. After `fixture.whenStable()`, assert both the viewport element's `offsetHeight > 0` and `CdkVirtualScrollViewport.getViewportSize() > 0`, and verify rows still render. Also cover the programmatic return to files when a new dataset loads. Assert that a row checkbox toggles exactly its filename in `selectedFiles()`, that the header button selects all and then clears all, and that the dataset link retains its URL and label.

```bash
grep -n "\-\-p-\|\.p-" src/app/ddi-cdi/ddi-cdi.component.scss ; echo "(must print nothing)"
npm run test:ci -- --include "src/app/ddi-cdi/*.spec.ts"
make lint && npx ng build && npm run test:ci
git add -A && git commit -m "DDI-CDI page on the CDK tree table"
```

---

### Task 13: Metadata selector page with the metadata field row

**Files:**
- Modify: `src/app/metadatafield/metadatafield.component.html`, `.ts`, `.spec.ts`
- Modify: `src/app/metadata-selector/metadata-selector.component.html`, `.ts`, `.scss`, `metadata-selector.component.spec.ts`, `metadata-selector-styling.spec.ts`

- [x] **Step 1: Convert the row**

Selector `div[app-metadatafield]`, inputs `node` and `level`, output `toggle`, four cells: field name with toggler, value, source, action button with `text-end`.

- [x] **Step 2: Replace the tree table**

`columns="2fr 2fr 1fr 4rem"` with the four header cells the page has (field, value, source, action) and the `div[app-metadatafield]` row. Rewrite `metadata-selector-styling.spec.ts` to an `app-tree-table` host as in Task 8. Replace the PrimeNG variables in the stylesheet with the app tokens. Give `.treetable-cell` a definite height through the same column flex pattern.

- [x] **Step 3: Specs, verify, commit**

Add the viewport height spec.

```bash
grep -rn "<p-treeTable\|TreeTableModule\|primeng/treetable\|p-treeTableToggler\|ttRow" src ; echo "(must print nothing)"
npm run test:ci -- --include "src/app/{metadatafield,metadata-selector}/*.spec.ts"
make lint && npx ng build && npm run test:ci
git add -A && git commit -m "Metadata selector and row on the CDK tree table"
```

---

### Task 14: FolderTreeComponent and the Globus picker

**Files:**
- Create: `src/app/shared/ui/folder-tree/folder-tree.component.ts`, `.html`, `.scss`, `.spec.ts`
- Modify: `src/app/connect/connect.component.html:254` region, `connect.component.ts`
- Modify: `src/app/download/download.component.html` (the `p-tree`), `download.component.ts`
- Modify: `src/app/shared/globus-picker.integration.spec.ts`, `connect.component.advanced.spec.ts`, `download.component.spec.ts`
- Modify: `src/main.ts` (drop `TreeModule`)

**Interfaces:**
- Produces: `<app-folder-tree [nodes]="TreeNode<string>[]" [loading] [selected]="TreeNode<string> | undefined" (selectedChange) (nodeExpand)>`. `selected` is a `model`. Clicking a selected node again clears the selection (emits `undefined`), which is what the pickers' `optionSelected` needs to clear the transfer path. `nodeExpand` fires exactly once when the user expands a node, with that node, so the page can lazy load its children. Expansion state lives in the CDK tree, keyed by `nodeKey`, and is restored from `node.expanded` whenever `nodes` changes.
- Consumes: `CdkTreeModule` from `@angular/cdk/tree`.

- [x] **Step 1: Write the failing spec**

`src/app/shared/ui/folder-tree/folder-tree.component.spec.ts`:

```ts
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TreeNode } from '../../../models/tree-node';
import { FolderTreeComponent } from './folder-tree.component';

@Component({
  imports: [FolderTreeComponent],
  template: `<app-folder-tree [nodes]="nodes()" [loading]="loading()" [(selected)]="selected" (nodeExpand)="expanded.push($event.data)"></app-folder-tree>`,
})
class HostComponent {
  readonly nodes = signal<TreeNode<string>[]>([
    { key: 'path:/', label: '/', data: '/', expanded: true, children: [
      { key: 'path:/home/', label: 'home', data: '/home/', expanded: true, children: [
        { key: 'path:/home/alice/', label: 'alice', data: '/home/alice/', children: [] },
      ] },
      { key: 'path:/shared/', label: 'shared', data: '/shared/', leaf: false },
    ] },
  ]);
  readonly loading = signal(false);
  readonly selected = signal<TreeNode<string> | undefined>(undefined);
  expanded: (string | undefined)[] = [];
}

describe('FolderTreeComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
  });

  const labels = (el: HTMLElement) =>
    Array.from(el.querySelectorAll('.folder-label')).map((n) => n.textContent!.trim());
  const keyCodes = { ArrowRight: 39, ArrowLeft: 37 };
  const key = (el: Element, k: keyof typeof keyCodes) =>
    el.dispatchEvent(new KeyboardEvent('keydown', { key: k, keyCode: keyCodes[k], bubbles: true, cancelable: true }));

  it('renders pre-expanded branches including nested ones', async () => {
    const fixture = TestBed.createComponent(HostComponent);
    await fixture.whenStable();
    expect(labels(fixture.nativeElement)).toEqual(['/', 'home', 'alice', 'shared']);
  });

  it('selects on click, highlights, and clears on a second click', async () => {
    const fixture = TestBed.createComponent(HostComponent);
    await fixture.whenStable();
    const alice = fixture.nativeElement.querySelectorAll('.folder-label')[2] as HTMLButtonElement;
    alice.click();
    await fixture.whenStable();
    expect(fixture.componentInstance.selected()?.data).toBe('/home/alice/');
    expect(fixture.nativeElement.querySelector('.folder-node.selected .folder-label')!.textContent).toContain('alice');
    alice.click();
    await fixture.whenStable();
    expect(fixture.componentInstance.selected()).toBeUndefined();
  });

  it('emits nodeExpand exactly once when a collapsed node is toggled open', async () => {
    const fixture = TestBed.createComponent(HostComponent);
    await fixture.whenStable();
    const toggles = fixture.nativeElement.querySelectorAll('.folder-toggle') as NodeListOf<HTMLButtonElement>;
    toggles[toggles.length - 1].click();
    await fixture.whenStable();
    expect(fixture.componentInstance.expanded).toEqual(['/shared/']);
    expect(fixture.componentInstance.nodes()[0].children![1].expanded).toBeTrue();
  });

  it('does not emit nodeExpand when collapsing', async () => {
    const fixture = TestBed.createComponent(HostComponent);
    await fixture.whenStable();
    (fixture.nativeElement.querySelector('.folder-toggle') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(fixture.componentInstance.expanded).toEqual([]);
    expect(labels(fixture.nativeElement)).toEqual(['/']);
  });

  it('keeps expansion and selection when the node objects are replaced but keys match', async () => {
    const fixture = TestBed.createComponent(HostComponent);
    await fixture.whenStable();
    (fixture.nativeElement.querySelectorAll('.folder-label')[2] as HTMLButtonElement).click();
    await fixture.whenStable();
    const copy = JSON.parse(JSON.stringify(fixture.componentInstance.nodes())) as TreeNode<string>[];
    fixture.componentInstance.nodes.set(copy);
    await fixture.whenStable();
    expect(labels(fixture.nativeElement)).toEqual(['/', 'home', 'alice', 'shared']);
    expect(fixture.nativeElement.querySelector('.folder-node.selected .folder-label')!.textContent).toContain('alice');
  });

  it('expands and collapses with the keyboard on a focused node', async () => {
    const fixture = TestBed.createComponent(HostComponent);
    await fixture.whenStable();
    const nodes = fixture.nativeElement.querySelectorAll('cdk-tree-node') as NodeListOf<HTMLElement>;
    const shared = nodes[nodes.length - 1];
    shared.focus();
    key(shared, 'ArrowRight');
    await fixture.whenStable();
    expect(fixture.componentInstance.expanded).toEqual(['/shared/']);
    key(shared, 'ArrowLeft');
    await fixture.whenStable();
    expect(fixture.componentInstance.nodes()[0].children![1].expanded).toBeFalse();
  });
});
```

- [x] **Step 2: Run it to verify it fails, then implement**

`src/app/shared/ui/folder-tree/folder-tree.component.ts`:

```ts
// Author: Eryk Kulikowski @ KU Leuven (2026). Apache 2.0 License

import { CdkTree, CdkTreeModule } from '@angular/cdk/tree';
import { ChangeDetectionStrategy, Component, computed, effect, input, model, output, viewChild } from '@angular/core';
import { TreeNode } from '../../../models/tree-node';

export function nodeKey(node: TreeNode<string>): string {
  return node.key ?? `path:${node.data ?? ''}`;
}

@Component({
  selector: 'app-folder-tree',
  templateUrl: './folder-tree.component.html',
  styleUrl: './folder-tree.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CdkTreeModule],
})
export class FolderTreeComponent {
  readonly nodes = input.required<TreeNode<string>[]>();
  readonly loading = input(false);
  readonly selected = model<TreeNode<string> | undefined>(undefined);
  readonly nodeExpand = output<TreeNode<string>>();

  readonly tree = viewChild.required<CdkTree<TreeNode<string>, string>>('tree');
  readonly nodeKey = nodeKey;
  readonly trackNode = (_index: number, node: TreeNode<string>): string => nodeKey(node);
  readonly children = (node: TreeNode<string>): TreeNode<string>[] => node.children ?? [];
  readonly selectedKey = computed(() => {
    const s = this.selected();
    return s === undefined ? undefined : nodeKey(s);
  });

  constructor() {
    // Restore expansion from the data whenever the node objects change.
    effect(() => {
      const nodes = this.nodes();
      const tree = this.tree();
      const visit = (list: TreeNode<string>[]) => {
        for (const n of list) {
          if (n.expanded) tree.expand(n);
          else tree.collapse(n);
          if (n.children?.length) visit(n.children);
        }
      };
      queueMicrotask(() => visit(nodes));
    });
  }

  isSelected(node: TreeNode<string>): boolean {
    return this.selectedKey() !== undefined && this.selectedKey() === nodeKey(node);
  }

  isExpandable(node: TreeNode<string>): boolean {
    return node.leaf !== true;
  }

  select(node: TreeNode<string>): void {
    this.selected.set(this.isSelected(node) ? undefined : node);
  }

  toggle(node: TreeNode<string>): void {
    const tree = this.tree();
    const expanding = !tree.isExpanded(node);
    node.expanded = expanding;
    tree.toggle(node);
    if (expanding) this.nodeExpand.emit(node);
  }

  onKeydown(event: KeyboardEvent, node: TreeNode<string>): void {
    if (event.key === 'ArrowRight' && !this.tree().isExpanded(node)) {
      event.preventDefault();
      this.toggle(node);
    } else if (event.key === 'ArrowLeft' && this.tree().isExpanded(node)) {
      event.preventDefault();
      this.toggle(node);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.select(node);
    }
  }
}
```

`src/app/shared/ui/folder-tree/folder-tree.component.html`:

```html
@if (loading()) {
  <span class="spinner-border spinner-border-sm" role="status" aria-label="Loading"></span>
}
<cdk-tree #tree class="folder-tree" [dataSource]="nodes()" [childrenAccessor]="children" [expansionKey]="nodeKey" [trackBy]="trackNode">
  <cdk-tree-node
    *cdkTreeNodeDef="let node"
    class="folder-node"
    [class.selected]="isSelected(node)"
    [isExpandable]="isExpandable(node)"
    cdkTreeNodePadding
    [cdkTreeNodePaddingIndent]="16"
    tabindex="0"
    (keydown)="onKeydown($event, node)"
  >
    @if (isExpandable(node)) {
      <button type="button" class="btn btn-link btn-sm p-0 folder-toggle" tabindex="-1" aria-label="Toggle" [attr.aria-expanded]="tree.isExpanded(node)" (click)="toggle(node)">
        <i class="pi" [class.pi-chevron-down]="tree.isExpanded(node)" [class.pi-chevron-right]="!tree.isExpanded(node)"></i>
      </button>
    } @else {
      <span class="folder-toggle"></span>
    }
    <button type="button" class="btn btn-link btn-sm folder-label" tabindex="-1" (click)="select(node)">{{ node.label }}</button>
  </cdk-tree-node>
</cdk-tree>
```

No `[isExpanded]` input and no `cdkTreeNodeToggle` directive are used. The node handler calls `toggle()` before the event bubbles to the CDK tree keyboard manager; the tests send both `key` and `keyCode` so both handlers participate. With CDK 21.2.14 the click and keyboard expansion tests assert exactly one `nodeExpand`, while collapse emits none. Keep these tests when upgrading CDK. `expansionKey` receives a node; `trackBy` receives an index and then a node, so it must use the separate `trackNode` wrapper.

`src/app/shared/ui/folder-tree/folder-tree.component.scss`:

```scss
.folder-tree {
  display: block;
}

.folder-node {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  outline-offset: -2px;
}

.folder-node.selected {
  background-color: var(--app-surface);
  border-radius: var(--bs-border-radius);
}

.folder-label {
  color: var(--app-text);
  text-decoration: none;
}
```

- [x] **Step 3: Run the spec until all six pass**

```bash
npm run test:ci -- --include src/app/shared/ui/folder-tree/folder-tree.component.spec.ts
```

The nested pre-expanded case (`alice` visible) is the one the review found broken in revision 1; it now depends on the restoring effect, which expands parents before children because `visit` walks depth first.

- [x] **Step 4: Replace the two pickers**

In `connect.component.html` and `download.component.html`, `<p-tree selectionMode="single" [selection]="selectedOption()" [value]="rootOptions()" (onNodeExpand)="getOptions($event.node)" [loading]="optionsLoading()" (selectionChange)="optionSelected($event)">` becomes:

```html
<app-folder-tree [nodes]="rootOptions()" [loading]="optionsLoading()" [selected]="selectedOption()" (selectedChange)="optionSelected($event)" (nodeExpand)="getOptions($event)"></app-folder-tree>
```

`optionSelected(selection)` already accepts `TreeNode | undefined` since September 2026 and clears `option` on `undefined`. `getOptions(node)` already takes the node. Keep the "Selected: {{ option() }}" text under the tree. The pages replace `rootOptions` with copied node objects after a lazy load (`updateExpandedNodeChildren`); the keys added in September 2026 (`path:<value>`) are what `nodeKey` reads, so expansion and selection survive.

- [x] **Step 5: Preserve picker integration assertions and cover endpoint variants**

`globus-picker.integration.spec.ts` queries `p-tree .p-tree-node-toggle-button`, `.p-tree-node-label` and `.p-tree-node-selected`. Replace with `.folder-toggle`, `.folder-label` and `.folder-node.selected .folder-label`. Keep every assertion unchanged in meaning: home preselected for Linux, macOS and Windows homes, root selectable, selection kept across a lazy reload, unselecting clears the path, unresolved home stays unselected beside a collapsed root. These are the acceptance tests for this task.

Exercise both connect and download with the response shapes below. Reuse the fixtures and expectations from `rdm-integration/context/globus_options_problem.md` and the backend Globus `paths_test.go` and `query_test.go`; add rendered picker cases where only page-method coverage exists. Do not change the backend resolver as part of this UI migration.

| Endpoint setup | Required picker behaviour |
|---|---|
| Personal Linux, macOS and Windows, including another Windows drive or mapped drive | Render the resolved home hierarchy, retain the exact returned path, and allow browsing and explicitly selecting `/` and another drive |
| Server default-directory template, explicit POSIX directory, resolved iRODS home | Select only the concrete home supplied by the backend; preserve that selection through expansion and lazy reload |
| iRODS or another mapped collection that returns unresolved `/~/` | Keep the separate `~` branch beside a collapsed `/`; require explicit selection and preserve `/~/` verbatim |
| Public collection without a home, or a home lookup that resolves to `/` | Render root contents without automatically selecting `/` |
| Guest collection or object-storage-shaped paths | Treat returned paths as collection-relative values; do not prepend a host filesystem path or rewrite separators |
| Empty directory, missing path metadata, restricted access or a failed listing | Preserve the backend's fallback or error result, stop the loading indicator, and never manufacture a selected home; expanding a branch issues one request |

Keep the existing backend path and transfer-manifest regression tests as release checks. Record which live endpoint variants were available for manual testing; simulated responses cannot certify every server connector or access-policy configuration.

- [ ] **Step 6: Verify and commit**

```bash
grep -rn "<p-tree\b\|TreeModule\|primeng/tree'" src ; echo "(must print nothing)"
make lint && npx ng build && npm run test:ci
git add -A && git commit -m "Globus folder picker on the CDK tree"
```

In the browser, against the pilot backend: open the connect page with a Globus endpoint, confirm the home folder is preselected, expand root, select root, unselect, navigate with the arrow keys, and check the transfer path text each time. Watch the network tab: one options request per expansion.

---

### Task 15: Remove PrimeNG

**Files:**
- Modify: `src/main.ts` (remove `providePrimeNG`, `definePreset`, `Lara`, every `primeng/*` import and module)
- Modify: `package.json` (remove `primeng`, `@primeuix/themes`; keep `primeicons`)
- Modify: `src/styles.scss` (every `--p-*` variable and `.p-*` rule)
- Modify: `src/app/shared/transfer-progress-card/transfer-progress-card.component.scss`, `src/app/redcap2-export/redcap2-export.component.scss`, `src/app/connect/connect.component.scss`, `src/app/compare/compare.component.scss`
- Modify: `src/app/app.component.spec.ts` (drop the `PrimeNG` provider mock)
- Modify: `README.md` if it mentions PrimeNG

- [x] **Step 1: Confirm nothing imports PrimeNG any more**

```bash
grep -rn "primeng\|primeuix\|PrimeTemplate\|providePrimeNG" src --include=*.ts --include=*.html | grep -v "src/main.ts" ; echo "(must print nothing)"
```

Fix any leftover before continuing.

- [x] **Step 2: main.ts and package.json**

Remove the PrimeNG providers and imports from `src/main.ts`, then:

```bash
npm uninstall primeng @primeuix/themes --no-audit
npm ls @angular/cdk primeicons
```

Expected: `@angular/cdk@21.2.14` under the root project, `primeicons@7.0.0` present.

- [x] **Step 3: Stylesheets**

In `src/styles.scss` and the component stylesheets apply the mapping from Task 12 to every remaining `--p-*` variable, and delete the `.p-button`, `.p-select-list`, `.p-select-overlay`, `.p-datatable` rules and the `::ng-deep .p-*` blocks. The Bootstrap table variable overrides at the bottom of `styles.scss` are no longer needed once Bootstrap's own colour mode drives the tables; delete them and check the submit page table in both colour modes. For the colour names in `transfer-progress-card.component.scss` use `--bs-success`, `--bs-danger`, `--bs-info` and `--bs-orange`.

```bash
grep -rn "\-\-p-\|\.p-" src --include=*.scss ; echo "(must print nothing)"
```

- [x] **Step 4: Specs**

Remove the `PrimeNG` mock and its provider from `app.component.spec.ts`. Run the whole suite.

- [x] **Step 5: Final verification**

```bash
make lint && npm run pretty && npx ng build && npm run test:ci
npm ls 2>/dev/null | grep -i prime
```

Expected: only `primeicons` remains. Note the bundle size from the build output in the PR description, not in the commit message.

- [ ] **Step 6: Browser pass in light and dark mode**

Connect, compare, download, compute, DDI-CDI, metadata selector, submit, REDCap export. Every page in both colour modes. Fix visual regressions in the app tokens, not in component internals.

- [x] **Step 7: Commit and open the PR**

```bash
git add -A && git commit -m "Remove PrimeNG"
git log --oneline main..cdk-migration
```

The branch then goes through review before merging to `main` and tagging a release.

---

## Self-review

1. **Coverage against the design decisions and the inventory.** Every inventory row maps to a task: toast (2), buttons, checkboxes, spinners, progress, skeleton, float label and input (3), select (4, 5), dialog (6), accordion and tabs (7), tree table and toggler (8), each file table with its row (9 to 13, the DDI-CDI inline row and its checkbox in 12), tree (14), popover and filter table (9), removal and CSS (15). The Globus picker rules are carried by Task 14 steps 4 and 5.
2. **Review findings.** The table "Review findings applied" maps both reviews to concrete changes. Regression checks cover expansion emissions, pre-expanded paths, focus after rendering, viewport measurements after tab changes, and preservation of DDI-CDI selection controls.
3. **Placeholder scan.** Tasks 10, 11 and 13 describe their row conversion and table markup with page-specific columns and hosts, and refer to the full example in Task 9 for the header shape. Task 12 now calls the exact existing filename-based selection API and preserves its dataset link and select-all button.
4. **Type consistency.** `TreeNode<T>` and `SelectItem<T>` from Task 0 are used throughout. `toggle(node)` and `refresh()` on `TreeTableComponent` match their page calls. `optionSelected(TreeNode | undefined)` and `getOptions(node)` match the existing page signatures. `expansionKey` takes `(node: T)`, while `trackBy` takes `(index: number, node: T)`; both derive the same stable key. Tests allow optional `TreeNode.data` and send the key codes read by the CDK.
5. **Validation scope.** Shared-component snippets must compile with strict Angular template checking and pass their browser specs against the installed Angular/CDK 21.2 versions. Full-page migration, light/dark browser checks, and live personal/server endpoint acceptance remain implementation gates; snippet tests alone do not establish those results.
6. **Revision 3 verification.** The 25 labelled code blocks were extracted into a temporary Angular harness and passed strict template compilation and all 31 included browser tests on Linux Chromium. Two additional browser checks passed using the Task 12 markup and `selectTab` snippet with the existing DDI-CDI selection methods: dataset link and filename/select-all behaviour, and viewport remeasurement after button-driven and programmatic tab changes. No application migration was performed for this plan review.

## Deviations

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
