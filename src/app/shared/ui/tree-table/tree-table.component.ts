// Author: Eryk Kulikowski @ KU Leuven (2026). Apache 2.0 License

import {
  CdkVirtualScrollViewport,
  ScrollingModule,
} from '@angular/cdk/scrolling';
import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChild,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { TreeNode } from '../../../models/tree-node';
import { flattenVisibleRows, TreeRow } from './tree-rows';
import {
  TreeTableHeaderDirective,
  TreeTableRowDirective,
} from './tree-table-templates';

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
