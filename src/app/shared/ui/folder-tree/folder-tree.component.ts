// Author: Eryk Kulikowski @ KU Leuven (2026). Apache 2.0 License

import { CdkTree, CdkTreeModule } from '@angular/cdk/tree';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
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
})
export class FolderTreeComponent {
  readonly nodes = input.required<TreeNode<string>[]>();
  readonly loading = input(false);
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
