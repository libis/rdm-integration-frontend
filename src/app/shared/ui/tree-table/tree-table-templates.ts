// Author: Eryk Kulikowski @ KU Leuven (2026). Apache 2.0 License

import { Directive, TemplateRef } from '@angular/core';
import { TreeNode } from '../../../models/tree-node';

interface TreeRowContext<T> {
  $implicit: TreeNode<T>;
  level: number;
  /** aria-rowindex of the row among all rows, the header row is 1. */
  rowIndex: number;
}

@Directive({ selector: 'ng-template[appTreeTableHeader]' })
export class TreeTableHeaderDirective {
  constructor(readonly template: TemplateRef<unknown>) {}
}

@Directive({ selector: 'ng-template[appTreeTableRow]' })
export class TreeTableRowDirective<T = unknown> {
  constructor(readonly template: TemplateRef<TreeRowContext<T>>) {}
}
