import {
  afterNextRender,
  Component,
  inject,
  Injector,
  signal,
  viewChild,
  ChangeDetectionStrategy,
} from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TreeNode } from '../../../models/tree-node';
import { TreeTableComponent } from './tree-table.component';
import {
  TreeTableHeaderDirective,
  TreeTableRowDirective,
} from './tree-table-templates';
import { TreeTogglerComponent } from './tree-toggler.component';

@Component({
  imports: [
    TreeTableComponent,
    TreeTableHeaderDirective,
    TreeTableRowDirective,
    TreeTogglerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <button type="button" class="switch-tab" (click)="toggleVisible()">
      Switch tab
    </button>
    <div [hidden]="!visible()" style="height: 300px">
      <app-tree-table
        #tt
        [nodes]="nodes()"
        [loading]="loading()"
        [virtual]="virtual()"
        columns="1fr 4rem"
        (expandedChange)="expanded.push($event.data)"
      >
        <ng-template appTreeTableHeader>
          <div class="tt-cell" role="columnheader">Name</div>
          <div class="tt-cell" role="columnheader">Size</div>
        </ng-template>
        <ng-template
          appTreeTableRow
          let-node
          let-level="level"
          let-rowIndex="rowIndex"
        >
          <div
            class="tt-row"
            role="row"
            [attr.aria-rowindex]="rowIndex"
            [attr.aria-level]="level + 1"
            [attr.aria-expanded]="tt.expandedState(node)"
          >
            <div class="tt-cell" role="gridcell">
              <app-tree-toggler
                [node]="node"
                [level]="level"
                (toggle)="tt.toggle(node)"
              ></app-tree-toggler
              >{{ node.data }}
            </div>
            <div class="tt-cell" role="gridcell">{{ level }}</div>
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
      afterNextRender(
        () => {
          if (this.visible()) this.table()?.refresh();
        },
        { injector: this.renderInjector },
      );
    }
  }
}

// A static body with more rows than fit below a header whose cells differ in
// height, the way the compute page renders it.
@Component({
  imports: [
    TreeTableComponent,
    TreeTableHeaderDirective,
    TreeTableRowDirective,
  ],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <div style="height: 300px">
      <app-tree-table
        [nodes]="nodes()"
        [virtual]="false"
        [rowHeight]="56"
        columns="1fr 8rem"
      >
        <ng-template appTreeTableHeader>
          <div class="tt-cell header-text" role="columnheader">Name</div>
          <div class="tt-cell" role="columnheader">
            <button type="button" class="btn btn-primary header-button">
              Run
            </button>
          </div>
        </ng-template>
        <ng-template
          appTreeTableRow
          let-node
          let-level="level"
          let-rowIndex="rowIndex"
        >
          <div
            class="tt-row"
            role="row"
            [attr.aria-rowindex]="rowIndex"
            [attr.aria-level]="level + 1"
          >
            <div class="tt-cell" role="gridcell">{{ node.data }}</div>
            <div class="tt-cell" role="gridcell"></div>
          </div>
        </ng-template>
      </app-tree-table>
    </div>
  `,
})
class StaticHostComponent {
  readonly nodes = signal<TreeNode<string>[]>([]);
}

describe('TreeTableComponent header', () => {
  const header = (el: HTMLElement) =>
    el.querySelector('.tt-header') as HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StaticHostComponent],
    }).compileComponents();
  });

  it('keeps its height above a static body with more rows than fit', async () => {
    const fixture = TestBed.createComponent(StaticHostComponent);
    await fixture.whenStable();
    const noRows = header(fixture.nativeElement).getBoundingClientRect().height;
    expect(noRows).toBeGreaterThan(30);
    fixture.componentInstance.nodes.set(
      Array.from({ length: 40 }, (_, i) => ({ data: `f${i}.py` })),
    );
    await fixture.whenStable();
    const body = fixture.nativeElement.querySelector('.tt-body') as HTMLElement;
    expect(body.scrollHeight).toBeGreaterThan(body.clientHeight);
    expect(header(fixture.nativeElement).getBoundingClientRect().height).toBe(
      noRows,
    );
  });

  it('reserves the body scrollbar gutter without a scrollbar of its own', async () => {
    const fixture = TestBed.createComponent(StaticHostComponent);
    fixture.componentInstance.nodes.set(
      Array.from({ length: 40 }, (_, i) => ({ data: `f${i}.py` })),
    );
    await fixture.whenStable();
    const head = header(fixture.nativeElement);
    const body = fixture.nativeElement.querySelector('.tt-body') as HTMLElement;
    expect(getComputedStyle(head).overflowY).toBe('hidden');
    expect(getComputedStyle(head).scrollbarGutter).toBe('stable');
    expect(head.clientWidth).toBe(body.clientWidth);
  });

  it('centres its cells vertically', async () => {
    const fixture = TestBed.createComponent(StaticHostComponent);
    await fixture.whenStable();
    const middle = (selector: string) => {
      const box = (
        fixture.nativeElement.querySelector(selector) as HTMLElement
      ).getBoundingClientRect();
      return box.top + box.height / 2;
    };
    const text = fixture.nativeElement.querySelector(
      '.header-text',
    ) as HTMLElement;
    expect(text.getBoundingClientRect().height).toBeLessThan(
      (
        fixture.nativeElement.querySelector('.header-button') as HTMLElement
      ).getBoundingClientRect().height,
    );
    // Both midpoints are sub-pixel values; centred means within half a pixel.
    expect(
      Math.abs(middle('.header-text') - middle('.header-button')),
    ).toBeLessThan(0.5);
  });
});

describe('TreeTableComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HostComponent],
    }).compileComponents();
  });

  const rowsOf = (el: HTMLElement) =>
    Array.from(el.querySelectorAll('.tt-row')).map((r) =>
      r.querySelector('.tt-cell')!.textContent!.trim(),
    );

  it('renders the header and the collapsed roots', async () => {
    const fixture = TestBed.createComponent(HostComponent);
    await fixture.whenStable();
    expect(
      fixture.nativeElement.querySelector('.tt-header')!.textContent,
    ).toContain('Name');
    expect(rowsOf(fixture.nativeElement)).toEqual(['docs', 'readme.md']);
  });

  it('gives the viewport the height of its container', async () => {
    const fixture = TestBed.createComponent(HostComponent);
    await fixture.whenStable();
    const body = fixture.nativeElement.querySelector('.tt-body') as HTMLElement;
    expect(body.offsetHeight).toBeGreaterThan(200);
    expect(
      fixture.componentInstance.table()!.viewport()!.getViewportSize(),
    ).toBeGreaterThan(200);
  });

  it('remeasures after a hidden pane becomes visible', async () => {
    const fixture = TestBed.createComponent(HostComponent);
    await fixture.whenStable();
    const viewport = fixture.componentInstance.table()!.viewport()!;
    const switchTab = fixture.nativeElement.querySelector(
      '.switch-tab',
    ) as HTMLButtonElement;
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
    (
      fixture.nativeElement.querySelector('.tt-toggle') as HTMLButtonElement
    ).click();
    await fixture.whenStable();
    expect(rowsOf(fixture.nativeElement)).toEqual([
      'docs',
      'a.txt',
      'b.txt',
      'readme.md',
    ]);
    expect(fixture.componentInstance.expanded).toEqual(['docs']);
    expect(fixture.componentInstance.nodes()[0].expanded).toBeTrue();
  });

  it('shows a spinner while loading', async () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.loading.set(true);
    await fixture.whenStable();
    expect(
      fixture.nativeElement.querySelector('.tt-loading .spinner-border'),
    ).not.toBeNull();
  });

  // A treegrid owns rows only: the spinner's status sits in a row and cell of
  // its own between the header and the body.
  it('renders a treegrid whose children are rows, the loading row included', async () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.loading.set(true);
    await fixture.whenStable();
    const table = fixture.nativeElement.querySelector('.tt') as HTMLElement;
    expect(table.getAttribute('role')).toBe('treegrid');
    const loading = table.querySelector('.tt-loading') as HTMLElement;
    expect(loading.getAttribute('role')).toBe('row');
    expect(
      loading.querySelector(':scope > [role="gridcell"] > [role="status"]'),
    ).not.toBeNull();
    expect(
      Array.from(table.children)
        .filter((child) => !child.matches('cdk-virtual-scroll-viewport'))
        .map((child) => child.getAttribute('role')),
    ).toEqual(['row', 'row']);
    // The loading row is the second row: the body rows follow it.
    expect(table.getAttribute('aria-rowcount')).toBe('4');
    expect(
      table.querySelector('.tt-header')!.getAttribute('aria-rowindex'),
    ).toBe('1');
    expect(loading.getAttribute('aria-rowindex')).toBe('2');
    const rowIndexes = () =>
      Array.from(table.querySelectorAll('.tt-body .tt-row'), (row) =>
        row.getAttribute('aria-rowindex'),
      );
    expect(rowIndexes()).toEqual(['3', '4']);
    fixture.componentInstance.loading.set(false);
    await fixture.whenStable();
    expect(table.getAttribute('aria-rowcount')).toBe('3');
    expect(rowIndexes()).toEqual(['2', '3']);
  });

  it('virtualises long lists: renders far fewer rows than nodes', async () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.nodes.set(
      Array.from({ length: 5000 }, (_, i) => ({ data: `f${i}` })),
    );
    await fixture.whenStable();
    const rendered = fixture.nativeElement.querySelectorAll('.tt-row').length;
    expect(rendered).toBeGreaterThan(5);
    expect(rendered).toBeLessThan(200);
  });

  it('renders every row when virtual is false', async () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.virtual.set(false);
    fixture.componentInstance.nodes.set(
      Array.from({ length: 300 }, (_, i) => ({ data: `f${i}` })),
    );
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelectorAll('.tt-row').length).toBe(300);
  });
});
