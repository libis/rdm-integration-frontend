// Author: Eryk Kulikowski @ KU Leuven (2026). Apache 2.0 License

import { WritableSignal } from '@angular/core';
import { HierarchicalSelectItem } from '../models/hierarchical-select-item';
import { TreeNode } from '../models/tree-node';
import { convertToTreeNodes } from './tree-utils';

/** The signals of a page that its folder picker writes and its template reads. */
interface FolderPickerState {
  /** The folder tree: the placeholder, then the first listing. */
  readonly rootOptions: WritableSignal<TreeNode<string>[]>;
  /** The first listing as select items, empty when it listed nothing. */
  readonly branchItems: WritableSignal<HierarchicalSelectItem<string>[]>;
  /** The path of the selected folder. */
  readonly option: WritableSignal<string | undefined>;
  /** The node of the selected folder. */
  readonly selectedOption: WritableSignal<TreeNode<string> | undefined>;
  /** True while the children of an expanded folder are listed. */
  readonly optionsLoading: WritableSignal<boolean>;
}

/**
 * The folder picker of the connect and download pages (the Globus folder
 * tree): it builds the tree from the options listings and keeps the selected
 * folder, in the page's own signals. The rules are in
 * context/globus_options_problem.md of rdm-integration: only a node the
 * backend marks as selected is selected by itself, never the root "/";
 * unselecting clears the path; every listing gives the tree a new array.
 */
export class FolderPicker {
  constructor(private readonly state: FolderPickerState) {}

  /**
   * Handle response from options lookup API.
   * Builds tree from items and auto-selects if backend marked a node.
   */
  handleOptionsResponse(
    items: HierarchicalSelectItem<string>[],
    node?: TreeNode<string>,
  ): void {
    const { rootOptions, branchItems, optionsLoading } = this.state;
    if (items && node && !this.isRootListing(node, items)) {
      // Expanding an existing node - add children
      const nodes = convertToTreeNodes(items);
      // Keep event-node mutation for compatibility with callers relying on
      // immediate node object changes, then synchronize canonical tree state
      // in case the expanded node instance is detached.
      node.children = nodes.treeNodes;
      const updated = updateExpandedNodeChildren(
        rootOptions(),
        node,
        nodes.treeNodes,
      );
      if (updated.found) {
        rootOptions.set(updated.tree);
      } else {
        // Fallback when the matching node is not in the stored tree: still a
        // new reference for the zoneless refresh.
        rootOptions.set([...rootOptions()]);
      }
      optionsLoading.set(false);
      this.autoSelectNode(nodes.selectedNode);
    } else if (items && items.length > 0) {
      // Initial load - convert items directly (backend returns from appropriate starting point)
      const nodes = convertToTreeNodes(items);
      rootOptions.set(nodes.treeNodes);
      branchItems.set(items);
      optionsLoading.set(false);
      this.autoSelectNode(nodes.selectedNode);
    } else {
      branchItems.set([]);
      optionsLoading.set(false);
    }
  }

  optionSelected(
    selection: TreeNode<string> | TreeNode<string>[] | null | undefined,
  ): void {
    const node = Array.isArray(selection) ? undefined : selection;
    const v = node?.data;
    if (v === undefined || v === null) {
      this.state.selectedOption.set(undefined);
      this.state.option.set(undefined);
    } else {
      // Allow selecting root "/" or any other folder
      this.state.option.set(v);
      this.state.selectedOption.set(node ?? undefined);
    }
  }

  // The placeholder was expanded and the backend answered with the
  // collection root: show that root instead of nesting it under the placeholder.
  private isRootListing(
    node: TreeNode<string>,
    items: HierarchicalSelectItem<string>[],
  ): boolean {
    return node.data === '' && items.length > 0 && items[0].value === '/';
  }

  /**
   * Auto-select node if backend marked it as selected.
   */
  private autoSelectNode(selectedNode?: TreeNode<string>): void {
    if (selectedNode) {
      this.state.option.set(selectedNode.data);
      this.state.selectedOption.set(selectedNode);
    }
  }
}

/**
 * The tree with the children of the expanded node replaced, in new objects on
 * the path to it; found is false when no node is that node or has its data and
 * label.
 */
export function updateExpandedNodeChildren(
  currentTree: TreeNode<string>[],
  target: TreeNode<string>,
  children: TreeNode<string>[],
): { tree: TreeNode<string>[]; found: boolean } {
  let found = false;
  const updatedTree = currentTree.map((node) => {
    const isTarget =
      node === target ||
      (node.data === target.data && node.label === target.label);
    if (isTarget) {
      found = true;
      return { ...node, children };
    }
    if (node.children && node.children.length > 0) {
      const nested = updateExpandedNodeChildren(
        node.children,
        target,
        children,
      );
      if (nested.found) {
        found = true;
        return { ...node, children: nested.tree };
      }
    }
    return node;
  });
  return { tree: updatedTree, found };
}
