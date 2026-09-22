import {
  afterNextRender,
  Component,
  inject,
  Injector,
  signal,
  viewChild,
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
          <div class="tt-cell">Name</div>
          <div class="tt-cell">Size</div>
        </ng-template>
        <ng-template appTreeTableRow let-node let-level="level">
          <div class="tt-row" role="row">
            <div class="tt-cell">
              <app-tree-toggler
                [node]="node"
                [level]="level"
                (toggle)="tt.toggle(node)"
              ></app-tree-toggler
              >{{ node.data }}
            </div>
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
      afterNextRender(
        () => {
          if (this.visible()) this.table()?.refresh();
        },
        { injector: this.renderInjector },
      );
    }
  }
}

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
