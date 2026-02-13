// Author: Eryk Kulikowski @ KU Leuven (2024). Apache 2.0 License

import { TreeNode } from 'primeng/api';
import { HierarchicalSelectItem } from '../models/hierarchical-select-item';

/**
 * Result of converting HierarchicalSelectItem array to TreeNode array.
 */
interface TreeConversionResult<T = string> {
  treeNodes: TreeNode<T>[];
  selectedNode?: TreeNode<T>;
}

/**
 * Default root options for a folder tree.
 */
export function createDefaultRootOptions(): TreeNode<string>[] {
  return [
    { label: '/', data: '/', leaf: false, selectable: true, expanded: false },
  ];
}

/**
 * Default root options with a placeholder label (for cases where user needs to expand).
 */
export function createPlaceholderRootOptions(): TreeNode<string>[] {
  return [
    { label: 'Expand and select', data: '', leaf: false, selectable: true },
  ];
}

/**
 * Convert HierarchicalSelectItem array to TreeNode array.
 * Handles pre-expanded nodes and children recursively.
 */
export function convertToTreeNodes<T = string>(
  items: HierarchicalSelectItem<T>[],
): TreeConversionResult<T> {
  const treeNodes: TreeNode<T>[] = [];
  let selectedNode: TreeNode<T> | undefined;

  for (const item of items) {
    const treeNode: TreeNode<T> = {
      label: item.label,
      data: item.value,
      leaf: false,
      selectable: true,
      expanded: item.expanded ?? false,
    };

    // Recursively convert children if present
    if (item.children && item.children.length > 0) {
      const childResult = convertToTreeNodes<T>(item.children);
      treeNode.children = childResult.treeNodes;
      // Propagate selected node from children
      if (childResult.selectedNode) {
        selectedNode = childResult.selectedNode;
      }
    }

    // Check if this item is marked as selected
    if (item.selected) {
      selectedNode = treeNode;
    }

    treeNodes.push(treeNode);
  }

  return { treeNodes, selectedNode };
}
