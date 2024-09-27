 
// Author: Eryk Kulikowski @ KU Leuven (2023). Apache 2.0 License

import { Injectable } from '@angular/core';
import { TreeNode } from 'primeng/api';
import { Datafile, Fileaction, Filestatus } from './models/datafile';

@Injectable({
  providedIn: 'root'
})
export class FolderActionUpdateService {

  constructor() {
    // empty
  }

  updateFoldersAction(rowNodeMap: Map<string, TreeNode<Datafile>>): void {
    rowNodeMap.forEach(v => {
      if (!v.data?.attributes?.isFile) {
        v.data!.action = undefined;
      }
    });
    this.doUpdateFoldersAction(rowNodeMap.get("")!)
  }

  doUpdateFoldersAction(node: TreeNode<Datafile>): void {
    if (node.data?.action !== undefined) {
      return;
    }
    node.children?.forEach(v => this.doUpdateFoldersAction(v));

    let allDeleted = true;
    let allNew = true;
    let allEqual = true;
    let allUpdated = true;
    node.children?.forEach(v => {
      allDeleted = allDeleted && v.data?.action === Fileaction.Delete;
      allNew = allNew && v.data?.action === Fileaction.Copy;
      allEqual = allEqual && v.data?.action === Fileaction.Ignore;
      allUpdated = allUpdated && (
        (v.data?.status == Filestatus.Equal && v.data?.action === Fileaction.Ignore) ||
        (v.data?.status == Filestatus.New && v.data?.action === Fileaction.Copy) ||
        (v.data?.status == Filestatus.Updated && v.data?.action === Fileaction.Update) ||
        (v.data?.status == Filestatus.Deleted && v.data?.action === Fileaction.Delete)
      );
    });

    let action;
    if (allEqual) action = Fileaction.Ignore;
    else if (allDeleted) action = Fileaction.Delete;
    else if (allNew) action = Fileaction.Copy;
    else if (allUpdated) action = Fileaction.Update;
    else action = Fileaction.Custom;
    node.data!.action = action;
  }
}
