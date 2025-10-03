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
    // Recurse first
    const childStatuses = node.children.map((c) => this.visit(c));
    if (node.data?.status !== undefined) {
      return node.data.status; // already computed
    }
    // Aggregate status rules (mirror original logic)
    const anyUnknown = childStatuses.some((s) => s === Filestatus.Unknown);
    if (anyUnknown) return (node.data!.status = Filestatus.Unknown);
    const allEqual = childStatuses.every((s) => s === Filestatus.Equal);
    if (allEqual) return (node.data!.status = Filestatus.Equal);
    const allDeleted = childStatuses.every((s) => s === Filestatus.Deleted);
    if (allDeleted) return (node.data!.status = Filestatus.Deleted);
    const allNew = childStatuses.every((s) => s === Filestatus.New);
    if (allNew) return (node.data!.status = Filestatus.New);
    return (node.data!.status = Filestatus.Updated);
  }
}
