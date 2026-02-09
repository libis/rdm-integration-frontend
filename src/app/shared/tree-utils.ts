// Author: Eryk Kulikowski @ KU Leuven (2024). Apache 2.0 License

import { WritableSignal } from '@angular/core';
import { SelectItem, TreeNode } from 'primeng/api';
import { Observable, Subscription } from 'rxjs';
import { HierarchicalSelectItem } from '../models/hierarchical-select-item';

/**
 * Result of converting HierarchicalSelectItem array to TreeNode array.
 */
export interface TreeConversionResult<T = string> {
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

/**
 * Replace a node in a tree (at any depth) with a new node object.
 * Creates new object references for the target and all its ancestors,
 * so PrimeNG's change detection re-renders the affected subtree.
 */
export function replaceNodeInTree<T>(
  nodes: TreeNode<T>[],
  target: TreeNode<T>,
  replacement: TreeNode<T>,
): TreeNode<T>[] {
  return nodes.map((n) => {
    if (n === target) return replacement;
    if (n.children) {
      const updatedChildren = replaceNodeInTree(n.children, target, replacement);
      // Only create a new reference if something changed in subtree
      if (updatedChildren !== n.children) {
        return { ...n, children: updatedChildren };
      }
    }
    return n;
  });
}

/**
 * Generate a random nonce string of the given length.
 * Used for OAuth state parameters.
 */
export function newNonce(length: number): string {
  let result = '';
  const characters =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const charactersLength = characters.length;
  let counter = 0;
  while (counter < length) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
    counter += 1;
  }
  return result;
}

/**
 * Handle response from options lookup API.
 * Builds tree from items and auto-selects if backend marked a node.
 */
export function handleOptionsResponse(
  items: HierarchicalSelectItem<string>[],
  node: TreeNode<string> | undefined,
  rootOptionsData: WritableSignal<TreeNode<string>[]>,
  branchItems: WritableSignal<HierarchicalSelectItem<string>[]>,
  optionsLoading: WritableSignal<boolean>,
  option: WritableSignal<string | undefined>,
  selectedOption: WritableSignal<TreeNode<string> | undefined>,
): void {
  if (items && node) {
    // Expanding an existing node - add children
    const nodes = convertToTreeNodes(items);
    node.children = nodes.treeNodes;
    // Replace with a new object reference so PrimeNG OnPush re-renders children
    rootOptionsData.update((prev) => replaceNodeInTree(prev, node, { ...node }));
    optionsLoading.set(false);
    autoSelectNode(nodes.selectedNode, option, selectedOption);
  } else if (items && items.length > 0) {
    // Initial load - convert items directly (backend returns from appropriate starting point)
    const nodes = convertToTreeNodes(items);
    rootOptionsData.set(nodes.treeNodes);
    branchItems.set(items);
    autoSelectNode(nodes.selectedNode, option, selectedOption);
  } else {
    branchItems.set([]);
  }
}

/**
 * Auto-select node if backend marked it as selected.
 */
export function autoSelectNode(
  selectedNode: TreeNode<string> | undefined,
  option: WritableSignal<string | undefined>,
  selectedOption: WritableSignal<TreeNode<string> | undefined>,
): void {
  if (selectedNode) {
    option.set(selectedNode.data);
    selectedOption.set(selectedNode);
  }
}

/**
 * Handle user selection of a tree node.
 */
export function onOptionSelected(
  node: TreeNode<string>,
  option: WritableSignal<string | undefined>,
  selectedOption: WritableSignal<TreeNode<string> | undefined>,
): void {
  const v = node.data;
  if (v === undefined || v === null) {
    selectedOption.set(undefined);
    option.set(undefined);
  } else {
    // Allow selecting root "/" or any other folder
    option.set(v);
    selectedOption.set(node);
  }
}

/**
 * Handle search input for a debounced search field (repo, dataset, collection).
 * Sets placeholder/searching messages and dispatches to the search subject.
 */
export function onSearchInput(
  searchTerm: string | null,
  items: WritableSignal<SelectItem<string>[]>,
  searchSubject: { next(value: string): void },
  minLength = 3,
): void {
  if (searchTerm === null || searchTerm.length < minLength) {
    items.set([
      {
        label: `start typing to search (at least ${minLength} letters)`,
        value: 'start',
      },
    ]);
    return;
  }
  items.set([
    { label: `searching "${searchTerm}"...`, value: searchTerm },
  ]);
  searchSubject.next(searchTerm);
}

/**
 * Initialize opening of a repo name search dropdown.
 */
export function startRepoSearch(
  foundRepoName: () => string | undefined,
  repoNameSearchInitEnabled: () => boolean | undefined,
  repoNames: WritableSignal<SelectItem<string>[]>,
  repoSearchSubject: { next(value: string): void },
): void {
  if (foundRepoName() !== undefined) {
    return;
  }
  if (repoNameSearchInitEnabled()) {
    repoNames.set([{ label: 'loading...', value: 'start' }]);
    repoSearchSubject.next('');
  } else {
    repoNames.set([
      {
        label: 'start typing to search (at least three letters)',
        value: 'start',
      },
    ]);
  }
}

/**
 * Subscribe to a debounced search observable, updating a signal with results.
 */
export function subscribeDebouncedSearch(
  observable: Observable<Promise<SelectItem<string>[]>>,
  items: WritableSignal<SelectItem<string>[]>,
): Subscription {
  return observable.subscribe({
    next: (x: Promise<SelectItem<string>[]>) =>
      x
        .then((v: SelectItem<string>[]) => items.set(v))
        .catch((err: { message: string }) =>
          items.set([
            { label: `search failed: ${err.message}`, value: err.message },
          ]),
        ),
    error: (err: { message: string }) =>
      items.set([
        { label: `search failed: ${err.message}`, value: err.message },
      ]),
  });
}
