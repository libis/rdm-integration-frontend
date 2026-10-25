import { Component, signal, ChangeDetectionStrategy } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TreeNode } from '../../../models/tree-node';
import { FolderTreeComponent } from './folder-tree.component';

@Component({
  imports: [FolderTreeComponent],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `<label id="folder-tree-label">Folder</label>
    <app-folder-tree
      ariaLabelledby="folder-tree-label"
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

// The pickers start with a placeholder that their first listing replaces.
@Component({
  imports: [FolderTreeComponent],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `<app-folder-tree
      [nodes]="nodes()"
      [(selected)]="selected"
      (nodeExpand)="expanded.push($event.data)"
    ></app-folder-tree>
    <button type="button" class="outside">Outside</button>`,
})
class PlaceholderHostComponent {
  readonly nodes = signal<TreeNode<string>[]>([
    { key: 'path:', label: 'Expand and select', data: '' },
  ]);
  readonly selected = signal<TreeNode<string> | undefined>(undefined);
  expanded: (string | undefined)[] = [];

  // The first listing, with or without a selected home.
  answer(selectHome: boolean): void {
    const alice: TreeNode<string> = {
      key: 'path:/home/alice/',
      label: 'alice',
      data: '/home/alice/',
      expanded: true,
      children: [],
    };
    this.nodes.set([
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
            children: [alice],
          },
        ],
      },
    ]);
    if (selectHome) this.selected.set(alice);
  }
}

describe('FolderTreeComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        HostComponent,
        CollapsedHostComponent,
        PlaceholderHostComponent,
      ],
    }).compileComponents();
  });

  const labels = (el: HTMLElement) =>
    Array.from(el.querySelectorAll('.folder-label')).map((n) =>
      n.textContent!.trim(),
    );
  const keyCodes = {
    ArrowRight: 39,
    ArrowLeft: 37,
    ArrowDown: 40,
    ArrowUp: 38,
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

  it('marks the selected node with aria-selected', async () => {
    const fixture = TestBed.createComponent(HostComponent);
    await fixture.whenStable();
    const selected = () =>
      treeNodes(fixture.nativeElement).map((n) =>
        n.getAttribute('aria-selected'),
      );
    expect(selected()).toEqual(['false', 'false', 'false', 'false']);
    const alice = nodeNamed(fixture.nativeElement, 'alice');
    (alice.querySelector('.folder-label') as HTMLElement).click();
    await fixture.whenStable();
    expect(selected()).toEqual(['false', 'false', 'true', 'false']);
    (alice.querySelector('.folder-label') as HTMLElement).click();
    await fixture.whenStable();
    expect(selected()).toEqual(['false', 'false', 'false', 'false']);
  });

  it('names every node after its folder alone, without the toggle', async () => {
    const fixture = TestBed.createComponent(HostComponent);
    await fixture.whenStable();
    expect(
      treeNodes(fixture.nativeElement).map((n) => n.getAttribute('aria-label')),
    ).toEqual(['/', 'home', 'alice', 'shared']);
  });

  it('names the tree after the element given by ariaLabelledby', async () => {
    const fixture = TestBed.createComponent(HostComponent);
    await fixture.whenStable();
    const tree = (fixture.nativeElement as HTMLElement).querySelector(
      '[role="tree"]',
    )!;
    const id = tree.getAttribute('aria-labelledby');
    expect(id).toBe('folder-tree-label');
    expect(document.getElementById(id!)!.textContent).toBe('Folder');
  });

  it('leaves the tree unnamed without ariaLabelledby', async () => {
    const fixture = TestBed.createComponent(CollapsedHostComponent);
    await fixture.whenStable();
    const tree = (fixture.nativeElement as HTMLElement).querySelector(
      '[role="tree"]',
    )!;
    expect(tree.hasAttribute('aria-labelledby')).toBeFalse();
  });

  it('exposes the level and the expansion of every node from the CDK tree', async () => {
    const fixture = TestBed.createComponent(HostComponent);
    await fixture.whenStable();
    expect(
      treeNodes(fixture.nativeElement).map((n) => [
        n.getAttribute('role'),
        n.getAttribute('aria-level'),
        n.getAttribute('aria-expanded'),
      ]),
    ).toEqual([
      ['treeitem', '1', 'true'],
      ['treeitem', '2', 'true'],
      ['treeitem', '3', 'false'],
      ['treeitem', '2', 'false'],
    ]);
  });

  it('puts the focus on the node itself after a click on its label', async () => {
    const fixture = TestBed.createComponent(HostComponent);
    await fixture.whenStable();
    const alice = nodeNamed(fixture.nativeElement, 'alice');
    const label = alice.querySelector('.folder-label') as HTMLElement;
    // The label is plain text: the node is the only focus stop of a row.
    expect(label.tagName).toBe('SPAN');
    expect(label.hasAttribute('tabindex')).toBeFalse();
    label.click();
    await fixture.whenStable();
    expect(document.activeElement).toBe(alice);
    expect(alice.getAttribute('tabindex')).toBe('0');
  });

  it('puts the focus on the node itself after a click on its toggle', async () => {
    const fixture = TestBed.createComponent(HostComponent);
    await fixture.whenStable();
    const shared = nodeNamed(fixture.nativeElement, 'shared');
    (shared.querySelector('.folder-toggle') as HTMLElement).click();
    await fixture.whenStable();
    expect(document.activeElement).toBe(shared);
    expect(fixture.componentInstance.expanded).toEqual(['/shared/']);
  });

  it('moves with ArrowDown and ArrowUp right after a click', async () => {
    const fixture = TestBed.createComponent(HostComponent);
    await fixture.whenStable();
    const home = nodeNamed(fixture.nativeElement, 'home');
    (home.querySelector('.folder-label') as HTMLElement).click();
    await fixture.whenStable();
    key(document.activeElement!, 'ArrowDown');
    await fixture.whenStable();
    expect(focused()).toBe('alice');
    key(document.activeElement!, 'ArrowUp');
    await fixture.whenStable();
    expect(focused()).toBe('home');
    expect(fixture.componentInstance.selected()?.data).toBe('/home/');
  });

  it('moves the focus to the selected node when the focused placeholder is replaced', async () => {
    const fixture = TestBed.createComponent(PlaceholderHostComponent);
    await fixture.whenStable();
    const placeholder = treeNodes(fixture.nativeElement)[0];
    placeholder.focus();
    key(placeholder, 'ArrowRight');
    await fixture.whenStable();
    expect(fixture.componentInstance.expanded).toEqual(['']);
    fixture.componentInstance.answer(true);
    await fixture.whenStable();
    expect(placeholder.isConnected).toBeFalse();
    expect(focused()).toBe('alice');
  });

  it('moves the focus to the first node when the replacing listing selects nothing', async () => {
    const fixture = TestBed.createComponent(PlaceholderHostComponent);
    await fixture.whenStable();
    (
      fixture.nativeElement.querySelector('.folder-toggle') as HTMLElement
    ).click();
    await fixture.whenStable();
    expect(focused()).toBe('Expand and select');
    fixture.componentInstance.answer(false);
    await fixture.whenStable();
    expect(focused()).toBe('/');
  });

  it('leaves the focus on the body when it went there before the placeholder was replaced', async () => {
    const fixture = TestBed.createComponent(PlaceholderHostComponent);
    await fixture.whenStable();
    const placeholder = treeNodes(fixture.nativeElement)[0];
    placeholder.focus();
    // A click on a blank part of the page.
    placeholder.blur();
    await fixture.whenStable();
    fixture.componentInstance.answer(true);
    await fixture.whenStable();
    expect(document.activeElement).toBe(document.body);
  });

  it('leaves the focus on the body when it left the tree before the placeholder was replaced', async () => {
    const fixture = TestBed.createComponent(PlaceholderHostComponent);
    await fixture.whenStable();
    treeNodes(fixture.nativeElement)[0].focus();
    const outside = fixture.nativeElement.querySelector(
      '.outside',
    ) as HTMLElement;
    outside.focus();
    outside.blur();
    await fixture.whenStable();
    fixture.componentInstance.answer(true);
    await fixture.whenStable();
    expect(document.activeElement).toBe(document.body);
  });
});
