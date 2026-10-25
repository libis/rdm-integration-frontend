import { Component, signal, ChangeDetectionStrategy } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TreeNode } from '../../../models/tree-node';
import { FolderTreeComponent } from './folder-tree.component';

@Component({
  imports: [FolderTreeComponent],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `<app-folder-tree
    [nodes]="nodes()"
    [loading]="loading()"
    [(selected)]="selected"
    (nodeExpand)="expanded.push($event.data)"
  ></app-folder-tree>`,
})
class HostComponent {
  readonly nodes = signal<TreeNode<string>[]>([
    {
      key: 'path:/',
      label: '/',
      data: '/',
      expanded: true,
      children: [
        {
          key: 'path:/home/',
          label: 'home',
          data: '/home/',
          expanded: true,
          children: [
            {
              key: 'path:/home/alice/',
              label: 'alice',
              data: '/home/alice/',
              children: [],
            },
          ],
        },
        {
          key: 'path:/shared/',
          label: 'shared',
          data: '/shared/',
          leaf: false,
        },
      ],
    },
  ]);
  readonly loading = signal(false);
  readonly selected = signal<TreeNode<string> | undefined>(undefined);
  expanded: (string | undefined)[] = [];
}

@Component({
  imports: [FolderTreeComponent],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `<app-folder-tree
    [nodes]="nodes()"
    [(selected)]="selected"
    (nodeExpand)="expanded.push($event.data)"
  ></app-folder-tree>`,
})
class CollapsedHostComponent {
  readonly nodes = signal<TreeNode<string>[]>([
    {
      key: 'path:/',
      label: '/',
      data: '/',
      expanded: false,
      children: [
        {
          key: 'path:/home/',
          label: 'home',
          data: '/home/',
          expanded: false,
          children: [
            {
              key: 'path:/home/alice/',
              label: 'alice',
              data: '/home/alice/',
              children: [],
            },
          ],
        },
        { key: 'path:/shared/', label: 'shared', data: '/shared/' },
      ],
    },
    { key: 'path:/data/', label: 'data', data: '/data/' },
  ]);
  readonly selected = signal<TreeNode<string> | undefined>(undefined);
  expanded: (string | undefined)[] = [];
}

describe('FolderTreeComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HostComponent, CollapsedHostComponent],
    }).compileComponents();
  });

  const labels = (el: HTMLElement) =>
    Array.from(el.querySelectorAll('.folder-label')).map((n) =>
      n.textContent!.trim(),
    );
  const keyCodes = {
    ArrowRight: 39,
    ArrowLeft: 37,
    '*': 56,
  };
  const key = (el: Element, k: keyof typeof keyCodes) =>
    el.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: k,
        keyCode: keyCodes[k],
        bubbles: true,
        cancelable: true,
      }),
    );
  const treeNodes = (el: HTMLElement) =>
    Array.from(el.querySelectorAll('cdk-tree-node')) as HTMLElement[];
  const nodeLabel = (node: Element | null | undefined) =>
    node?.querySelector('.folder-label')?.textContent?.trim();
  const nodeNamed = (el: HTMLElement, name: string) =>
    treeNodes(el).find((n) => nodeLabel(n) === name)!;
  // The label of the node that has the focus itself, or the tag of whatever else has it.
  const focused = () => {
    const active = document.activeElement;
    return active?.matches('cdk-tree-node')
      ? nodeLabel(active)
      : active?.tagName;
  };

  it('renders pre-expanded branches including nested ones', async () => {
    const fixture = TestBed.createComponent(HostComponent);
    await fixture.whenStable();
    expect(labels(fixture.nativeElement)).toEqual([
      '/',
      'home',
      'alice',
      'shared',
    ]);
  });

  it('selects on click, highlights, and clears on a second click', async () => {
    const fixture = TestBed.createComponent(HostComponent);
    await fixture.whenStable();
    const alice = fixture.nativeElement.querySelectorAll(
      '.folder-label',
    )[2] as HTMLButtonElement;
    alice.click();
    await fixture.whenStable();
    expect(fixture.componentInstance.selected()?.data).toBe('/home/alice/');
    expect(
      fixture.nativeElement.querySelector(
        '.folder-node.selected .folder-label',
      )!.textContent,
    ).toContain('alice');
    alice.click();
    await fixture.whenStable();
    expect(fixture.componentInstance.selected()).toBeUndefined();
  });

  it('emits nodeExpand exactly once when a collapsed node is toggled open', async () => {
    const fixture = TestBed.createComponent(HostComponent);
    await fixture.whenStable();
    const toggles = fixture.nativeElement.querySelectorAll(
      '.folder-toggle',
    ) as NodeListOf<HTMLButtonElement>;
    toggles[toggles.length - 1].click();
    await fixture.whenStable();
    expect(fixture.componentInstance.expanded).toEqual(['/shared/']);
    expect(
      fixture.componentInstance.nodes()[0].children![1].expanded,
    ).toBeTrue();
  });

  it('does not emit nodeExpand when collapsing', async () => {
    const fixture = TestBed.createComponent(HostComponent);
    await fixture.whenStable();
    (
      fixture.nativeElement.querySelector('.folder-toggle') as HTMLButtonElement
    ).click();
    await fixture.whenStable();
    expect(fixture.componentInstance.expanded).toEqual([]);
    expect(labels(fixture.nativeElement)).toEqual(['/']);
  });

  it('keeps expansion and selection when the node objects are replaced but keys match', async () => {
    const fixture = TestBed.createComponent(HostComponent);
    await fixture.whenStable();
    (
      fixture.nativeElement.querySelectorAll(
        '.folder-label',
      )[2] as HTMLButtonElement
    ).click();
    await fixture.whenStable();
    const copy = JSON.parse(
      JSON.stringify(fixture.componentInstance.nodes()),
    ) as TreeNode<string>[];
    fixture.componentInstance.nodes.set(copy);
    await fixture.whenStable();
    expect(labels(fixture.nativeElement)).toEqual([
      '/',
      'home',
      'alice',
      'shared',
    ]);
    expect(
      fixture.nativeElement.querySelector(
        '.folder-node.selected .folder-label',
      )!.textContent,
    ).toContain('alice');
  });

  it('expands and collapses with the keyboard on a focused node', async () => {
    const fixture = TestBed.createComponent(HostComponent);
    await fixture.whenStable();
    const nodes = fixture.nativeElement.querySelectorAll(
      'cdk-tree-node',
    ) as NodeListOf<HTMLElement>;
    const shared = nodes[nodes.length - 1];
    shared.focus();
    key(shared, 'ArrowRight');
    await fixture.whenStable();
    expect(fixture.componentInstance.expanded).toEqual(['/shared/']);
    key(shared, 'ArrowLeft');
    await fixture.whenStable();
    expect(
      fixture.componentInstance.nodes()[0].children![1].expanded,
    ).toBeFalse();
  });

  it('expands a collapsed node with loaded children on one ArrowRight and keeps focus on it', async () => {
    const fixture = TestBed.createComponent(CollapsedHostComponent);
    await fixture.whenStable();
    const root = nodeNamed(fixture.nativeElement, '/');
    root.focus();
    key(root, 'ArrowRight');
    await fixture.whenStable();
    expect(root.getAttribute('aria-expanded')).toBe('true');
    expect(focused()).toBe('/');
    expect(fixture.componentInstance.expanded).toEqual(['/']);
    // On an expanded node ArrowRight moves into it, without another expansion.
    key(root, 'ArrowRight');
    await fixture.whenStable();
    expect(focused()).toBe('home');
    expect(fixture.componentInstance.expanded).toEqual(['/']);
  });

  it('collapses an expanded node on one ArrowLeft and keeps focus on it', async () => {
    const fixture = TestBed.createComponent(HostComponent);
    await fixture.whenStable();
    const home = nodeNamed(fixture.nativeElement, 'home');
    home.focus();
    key(home, 'ArrowLeft');
    await fixture.whenStable();
    expect(home.getAttribute('aria-expanded')).toBe('false');
    expect(fixture.componentInstance.nodes()[0].children![0].expanded).toBe(
      false,
    );
    expect(focused()).toBe('home');
    // On a collapsed node ArrowLeft moves to the parent and leaves it expanded.
    key(home, 'ArrowLeft');
    await fixture.whenStable();
    expect(focused()).toBe('/');
    expect(
      nodeNamed(fixture.nativeElement, '/').getAttribute('aria-expanded'),
    ).toBe('true');
  });

  it('ignores the * key, so no sibling opens without nodeExpand', async () => {
    const fixture = TestBed.createComponent(CollapsedHostComponent);
    await fixture.whenStable();
    const root = nodeNamed(fixture.nativeElement, '/');
    root.focus();
    key(root, '*');
    await fixture.whenStable();
    const data = nodeNamed(fixture.nativeElement, 'data');
    expect(root.getAttribute('aria-expanded')).toBe('false');
    expect(data.getAttribute('aria-expanded')).toBe('false');
    expect(fixture.componentInstance.expanded).toEqual([]);
    expect(focused()).toBe('/');
    // The sibling still opens through the component, with its listing.
    data.focus();
    key(data, 'ArrowRight');
    await fixture.whenStable();
    expect(data.getAttribute('aria-expanded')).toBe('true');
    expect(fixture.componentInstance.expanded).toEqual(['/data/']);
  });

  it('gives the nodes only the roving tabindex of the CDK tree', async () => {
    const fixture = TestBed.createComponent(HostComponent);
    // The tabindex values each node had before every change of it.
    const changes: (string | null)[] = [];
    const record = (records: MutationRecord[]) => {
      for (const r of records) {
        if ((r.target as Element).matches('cdk-tree-node')) {
          changes.push(r.oldValue);
        }
      }
    };
    const observer = new MutationObserver(record);
    observer.observe(fixture.nativeElement, {
      subtree: true,
      attributeFilter: ['tabindex'],
      attributeOldValue: true,
    });
    await fixture.whenStable();
    record(observer.takeRecords());
    observer.disconnect();
    const tabs = () =>
      treeNodes(fixture.nativeElement).map((n) => n.getAttribute('tabindex'));
    expect(tabs()).toEqual(['0', '-1', '-1', '-1']);
    // No node is created with a tabindex of its own that the CDK then replaces.
    expect(changes.length).toBeGreaterThan(0);
    expect(changes.filter((old) => old === '0')).toEqual([]);
    const alice = nodeNamed(fixture.nativeElement, 'alice');
    alice.focus();
    await fixture.whenStable();
    expect(tabs()).toEqual(['-1', '-1', '0', '-1']);
  });
});
