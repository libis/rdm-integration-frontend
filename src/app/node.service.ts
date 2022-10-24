import { Injectable } from '@angular/core';
import { TreeNode } from 'primeng/api';
import { Datafile, Fileaction } from './models/datafile';

@Injectable({
  providedIn: 'root'
})
export class NodeService {

  constructor() { }

  hasNotIgnoredChild(node: TreeNode<Datafile>): boolean {
    if (node.data!.attributes?.isFile) {
      return node.data!.action !== Fileaction.Ignore;
    }
    return node.children?.find(x => this.hasNotIgnoredChild(x)) !== undefined;
  }
}
