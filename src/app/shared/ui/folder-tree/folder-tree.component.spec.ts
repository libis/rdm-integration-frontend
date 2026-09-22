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

describe('FolderTreeComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HostComponent],
    }).compileComponents();
  });

  const labels = (el: HTMLElement) =>
    Array.from(el.querySelectorAll('.folder-label')).map((n) =>
      n.textContent!.trim(),
    );
  const keyCodes = { ArrowRight: 39, ArrowLeft: 37 };
  const key = (el: Element, k: keyof typeof keyCodes) =>
    el.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: k,
        keyCode: keyCodes[k],
        bubbles: true,
        cancelable: true,
      }),
    );

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
});
