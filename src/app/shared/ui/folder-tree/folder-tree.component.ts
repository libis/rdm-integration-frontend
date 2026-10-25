// Author: Eryk Kulikowski @ KU Leuven (2026). Apache 2.0 License

import { CdkTree, CdkTreeModule } from '@angular/cdk/tree';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  input,
  model,
  output,
  viewChild,
} from '@angular/core';
import { TreeNode } from '../../../models/tree-node';

function nodeKey(node: TreeNode<string>): string {
  return node.key ?? `path:${node.data ?? ''}`;
}

@Component({
  selector: 'app-folder-tree',
  templateUrl: './folder-tree.component.html',
  styleUrl: './folder-tree.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CdkTreeModule],
  host: {
    '(focusin)': 'onFocusIn($event)',
    '(focusout)': 'onFocusOut($event)',
  },
})
export class FolderTreeComponent {
  readonly nodes = input.required<TreeNode<string>[]>();
  readonly loading = input(false);
  // The id of the element that names the tree, such as its visible label. A
  // label's for attribute does not name a tree, which is no form control.
  readonly ariaLabelledby = input<string>();
  readonly selected = model<TreeNode<string> | undefined>(undefined);
  readonly nodeExpand = output<TreeNode<string>>();

  readonly tree = viewChild.required<CdkTree<TreeNode<string>, string>>('tree');
  readonly nodeKey = nodeKey;
  readonly trackNode = (_index: number, node: TreeNode<string>): string =>
    nodeKey(node);
  readonly children = (node: TreeNode<string>): TreeNode<string>[] =>
    node.children ?? [];
  readonly selectedKey = computed(() => {
    const s = this.selected();
    return s === undefined ? undefined : nodeKey(s);
  });

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  // The element in the tree that has the focus, kept after a listing removes
  // it (the first one replaces the placeholder) and forgotten when the focus
  // leaves the tree.
  private lastFocused: HTMLElement | null = null;

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
      queueMicrotask(() => {
        visit(nodes);
        this.restoreFocus();
      });
    });
  }

  onFocusIn(event: FocusEvent): void {
    this.lastFocused = event.target as HTMLElement;
  }

  onFocusOut(event: FocusEvent): void {
    const target = event.target as HTMLElement;
    const next = event.relatedTarget as Node | null;
    if (next !== null) {
      if (!this.host.nativeElement.contains(next)) this.lastFocused = null;
      return;
    }
    // The focus went to the body. Chromium also sends this, with the target
    // still connected, when the focused node is being removed, so only a
    // target still there afterwards (a click on a blank area) is forgotten.
    queueMicrotask(() => {
      if (target.isConnected && this.lastFocused === target) {
        this.lastFocused = null;
      }
    });
  }

  // A listing that removed the focused node leaves the focus on the body:
  // put it on the selected node, else on the one the CDK tree made focusable.
  private restoreFocus(): void {
    const last = this.lastFocused;
    if (!last || last.isConnected || document.activeElement !== document.body) {
      return;
    }
    const host = this.host.nativeElement;
    (
      host.querySelector<HTMLElement>('cdk-tree-node.selected') ??
      host.querySelector<HTMLElement>('cdk-tree-node[tabindex="0"]')
    )?.focus();
  }

  isSelected(node: TreeNode<string>): boolean {
    return (
      this.selectedKey() !== undefined && this.selectedKey() === nodeKey(node)
    );
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

  onKeydown(
    event: KeyboardEvent,
    node: TreeNode<string>,
    element: HTMLElement,
  ): void {
    const expanded = this.tree().isExpanded(node);
    if (
      (event.key === 'ArrowRight' && !expanded) ||
      (event.key === 'ArrowLeft' && expanded)
    ) {
      this.toggle(node);
    } else if (event.key === 'ArrowRight') {
      this.focusFirstChild(element);
    } else if (event.key === 'Enter' || event.key === ' ') {
      this.select(node);
    } else if (event.key !== '*') {
      // The CDK tree moves the focus: ArrowLeft to the parent, ArrowUp,
      // ArrowDown, Home, End and typeahead.
      return;
    }
    // Handled here, so the key must not reach the CDK tree as well: its key
    // manager would act on the changed state and move the focus in the same
    // press. "*" would expand every sibling without nodeExpand, so without
    // their listings, and is ignored.
    event.preventDefault();
    event.stopPropagation();
  }

  // The CDK tree would look the children up in the node object it first
  // rendered, which a listing replaces, so it reads them from the rendered
  // rows: the first child is the next row, one level deeper.
  private focusFirstChild(element: HTMLElement): void {
    const next = element.nextElementSibling;
    const level = Number(element.getAttribute('aria-level'));
    if (
      next instanceof HTMLElement &&
      next.matches('cdk-tree-node') &&
      Number(next.getAttribute('aria-level')) === level + 1
    ) {
      next.focus();
    }
  }
}
