// Author: Eryk Kulikowski @ KU Leuven (2023). Apache 2.0 License

import { Injectable } from '@angular/core';
import { TreeNode } from 'primeng/api';
import { Datafile, Fileaction, Filestatus } from './models/datafile';

@Injectable({
  providedIn: 'root',
})
export class FolderActionUpdateService {
  constructor() {
    // empty
  }

  updateFoldersAction(rowNodeMap: Map<string, TreeNode<Datafile>>): void {
    const root = rowNodeMap.get('');
    if (!root) {
      return;
    }
    this.doUpdateFoldersAction(root);
  }

  /**
   * Recompute folder action for a changed subtree and then walk ancestors only.
   * This avoids recomputing the entire tree on single-row interaction.
   */
  updateSubtreeAndAncestorsAction(node: TreeNode<Datafile> | undefined): void {
    if (!node) {
      return;
    }
    this.doUpdateFoldersAction(node);
    let parent = node.parent;
    while (parent) {
      this.updateFolderActionFromChildren(parent);
      parent = parent.parent;
    }
  }

  doUpdateFoldersAction(node: TreeNode<Datafile>): Fileaction {
    if (!node.data) {
      return Fileaction.Ignore;
    }
    if (node.data.attributes?.isFile || !node.children || node.children.length === 0) {
      return node.data.action ?? Fileaction.Ignore;
    }
    for (const child of node.children) {
      this.doUpdateFoldersAction(child);
    }
    return this.updateFolderActionFromChildren(node);
  }

  private updateFolderActionFromChildren(node: TreeNode<Datafile>): Fileaction {
    if (!node.children || node.children.length === 0) {
      return node.data?.action ?? Fileaction.Ignore;
    }
    let allDeleted = true;
    let allNew = true;
    let allEqual = true;
    let allUpdated = true;
    for (const child of node.children) {
      const action = child.data?.action ?? Fileaction.Ignore;
      const status = child.data?.status;
      allDeleted = allDeleted && action === Fileaction.Delete;
      allNew = allNew && action === Fileaction.Copy;
      allEqual = allEqual && action === Fileaction.Ignore;
      allUpdated =
        allUpdated &&
        ((status == Filestatus.Equal && action === Fileaction.Ignore) ||
          (status == Filestatus.New && action === Fileaction.Copy) ||
          (status == Filestatus.Updated && action === Fileaction.Update) ||
          (status == Filestatus.Deleted && action === Fileaction.Delete));
    }

    let action: Fileaction;
    if (allEqual) action = Fileaction.Ignore;
    else if (allDeleted) action = Fileaction.Delete;
    else if (allNew) action = Fileaction.Copy;
    else if (allUpdated) action = Fileaction.Update;
    else action = Fileaction.Custom;
    node.data!.action = action;
    return action;
  }
}
