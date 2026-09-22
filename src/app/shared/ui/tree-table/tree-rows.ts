// Author: Eryk Kulikowski @ KU Leuven (2026). Apache 2.0 License

import { TreeNode } from '../../../models/tree-node';

export interface TreeRow<T> {
  node: TreeNode<T>;
  level: number;
}

export function flattenVisibleRows<T>(
  nodes: TreeNode<T>[],
  level = 0,
  out: TreeRow<T>[] = [],
): TreeRow<T>[] {
  for (const node of nodes) {
    out.push({ node, level });
    if (node.expanded && node.children?.length) {
      flattenVisibleRows(node.children, level + 1, out);
    }
  }
  return out;
}
