// Author: Architectural extraction (2025). Apache 2.0 License
// Computes aggregate folder (non-file node) statuses based on child statuses.

import { Injectable } from '@angular/core';
import { TreeNode } from 'primeng/api';
import { Datafile, Filestatus } from '../models/datafile';

@Injectable({ providedIn: 'root' })
export class FolderStatusService {
  updateTreeRoot(root: TreeNode<Datafile>): void {
    this.visit(root);
  }

  private visit(node: TreeNode<Datafile>): Filestatus | undefined {
    // Leaf (file) nodes already have status
    if (!node.children || node.children.length === 0) {
      return node.data?.status;
    }
    // Folder statuses are derived from compare results, which are stable while
    // users toggle actions. Re-use the computed value.
    if (node.data?.status !== undefined) {
      return node.data.status;
    }

    let anyUnknown = false;
    let allEqual = true;
    let allDeleted = true;
    let allNew = true;

    for (const child of node.children) {
      const status = this.visit(child);
      anyUnknown = anyUnknown || status === Filestatus.Unknown;
      allEqual = allEqual && status === Filestatus.Equal;
      allDeleted = allDeleted && status === Filestatus.Deleted;
      allNew = allNew && status === Filestatus.New;
    }

    // Aggregate status rules (mirror original logic)
    if (anyUnknown) return (node.data!.status = Filestatus.Unknown);
    if (allEqual) return (node.data!.status = Filestatus.Equal);
    if (allDeleted) return (node.data!.status = Filestatus.Deleted);
    if (allNew) return (node.data!.status = Filestatus.New);
    return (node.data!.status = Filestatus.Updated);
  }
}
