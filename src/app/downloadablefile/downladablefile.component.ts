 
// Author: Eryk Kulikowski @ KU Leuven (2024). Apache 2.0 License

import { Component, Input, OnInit } from '@angular/core';
import { TreeNode } from 'primeng/api';
import { FolderActionUpdateService } from '../folder.action.update.service';
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

  icon_ignore = "pi pi-stop";
  icon_download = "pi pi-cloud-download";

  constructor(private folderActionUpdateService: FolderActionUpdateService) { }

  ngOnInit(): void {
    this.node = this.rowNodeMap.get(this.datafile.id! + (this.datafile.attributes?.isFile ? ":file" : ""))!; // avoid collisions between folders and files having the same path and name
  }

  action(): string {
    switch (Number(this.datafile.action)) {
      case Fileaction.Download:
        return this.icon_download;
    }
    return this.icon_ignore;
  }

  sourceFile(): string {
    return `${this.datafile.name}`;
  }

  toggleAction(): void {
    switch (this.datafile.action) {
      case Fileaction.Ignore:
        this.setNodeAction(this.node, Fileaction.Download);
        break;
      case Fileaction.Download:
        this.setNodeAction(this.node, Fileaction.Ignore);
        break;
      default:
        this.setNodeAction(this.node, Fileaction.Ignore);
        break;
    }
    this.folderActionUpdateService.updateFoldersAction(this.rowNodeMap);
  }

  setNodeAction(node: TreeNode<Datafile>, action: Fileaction): void {
    node.data!.action = action;
    node.children?.forEach(v => this.setNodeAction(v, action));
  }
}
