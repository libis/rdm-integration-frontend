// Author: Eryk Kulikowski @ KU Leuven (2024). Apache 2.0 License

import { Component, Input, OnInit } from '@angular/core';
import { TreeNode } from 'primeng/api';
import { Datafile, Fileaction } from '../models/datafile';

@Component({
  selector: 'tr[app-downloadablefile]',
  standalone: false,
  templateUrl: './downladablefile.component.html',
  styleUrls: ['./downladablefile.component.scss']
})
export class DownladablefileComponent implements OnInit {

  @Input("datafile") datafile: Datafile = {};
  @Input("rowNodeMap") rowNodeMap: Map<string, TreeNode<Datafile>> = new Map<string, TreeNode<Datafile>>();
  @Input("rowNode") rowNode: TreeNode<Datafile> = {};

  node: TreeNode<Datafile> = {};

  static icon_ignore = "pi pi-stop";
  static icon_download = "pi pi-check-square";
  static icon_custom = "pi pi-exclamation-triangle";

  constructor() { }

  ngOnInit(): void {
    this.node = this.rowNodeMap.get(this.datafile.id! + (this.datafile.attributes?.isFile ? ":file" : ""))!; // avoid collisions between folders and files having the same path and name
  }

  action(): string {
    return DownladablefileComponent.actionIcon(this.node);
  }

  public static actionIcon(node: TreeNode<Datafile>): string {
    switch (node.data?.action) {
      case Fileaction.Ignore:
        return this.icon_ignore;
      case Fileaction.Download:
        return this.icon_download;
      case Fileaction.Custom:
        return this.icon_custom;
      default:
        return this.icon_ignore;
    }
  }

  sourceFile(): string {
    return `${this.datafile.name}`;
  }

  toggleAction(): void {
    DownladablefileComponent.toggleNodeAction(this.node);
    this.updateFolderActions(this.rowNodeMap.get("")!);
  }

  updateFolderActions(node: TreeNode<Datafile>): Fileaction {
    if (node.children && node.children.length > 0) {
      let res: Fileaction | undefined = undefined;
      for (const child of node.children) {
        const childAction = this.updateFolderActions(child)
        if (res !== undefined && res !== childAction) {
          res = Fileaction.Custom;
        } else if (res === undefined) {
          res = childAction;
        }
      }
      if (node.data) {
        node.data.action = res;
      }
      return res ? res : Fileaction.Ignore;
    } else {
      return node.data?.action ? node.data.action : Fileaction.Ignore;
    }
  }

  public static toggleNodeAction(node: TreeNode<Datafile>): void {
    switch (node.data?.action) {
      case Fileaction.Ignore:
        DownladablefileComponent.setNodeAction(node, Fileaction.Download);
        break;
      case Fileaction.Download:
        DownladablefileComponent.setNodeAction(node, Fileaction.Ignore);
        break;
      default:
        DownladablefileComponent.setNodeAction(node, Fileaction.Ignore);
        break;
    }
  }

  private static setNodeAction(node: TreeNode<Datafile>, action: Fileaction): void {
    node.data!.action = action;
    node.children?.forEach(v => this.setNodeAction(v, action));
  }
}
