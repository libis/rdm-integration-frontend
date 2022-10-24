import { Component, Input, OnInit } from '@angular/core';
import { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { faSquare } from '@fortawesome/free-regular-svg-icons';
import { faCopy, faClone, faTrash, faQuestion } from '@fortawesome/free-solid-svg-icons';
import { TreeNode } from 'primeng/api';
import { Datafile, Fileaction, Filestatus } from '../models/datafile';
import { NodeService } from '../node.service';

@Component({
  selector: 'tr[app-datafile]',
  templateUrl: './datafile.component.html',
  styleUrls: ['./datafile.component.scss']
})
export class DatafileComponent implements OnInit {

  @Input("datafile") datafile: Datafile = {};
  @Input("loading") loading: boolean = true;
  @Input("rowNodeMap") rowNodeMap: Map<string, TreeNode<Datafile>> = new Map<string, TreeNode<Datafile>>();
  @Input("rowNode") rowNode: TreeNode<Datafile> = {};

  icon_unknown = faQuestion;

  icon_new = "pi pi-plus-circle";
  icon_deleted = "pi pi-minus-circle";
  icon_equal = "pi pi-check-circle";
  icon_not_equal = "pi pi-exclamation-circle";
  icon_spinner = "pi pi-spin pi-spinner"
  icon_refresh = "pi pi-refresh"

  icon_ignore = faSquare;
  icon_copy = faCopy;
  icon_update = faClone;
  icon_delete = faTrash;

  node: TreeNode<Datafile> = {};

  constructor(
    public nodeService: NodeService,
  ) { }

  ngOnInit(): void {
    this.node = this.rowNodeMap.get(this.datafile.id!)!;
  }

  sourceFile(): string {
    if (this.datafile.status == Filestatus.Deleted) {
      return '';
    }
    return `${this.datafile.name}`
  }

  comparison(color: boolean): string {
    switch (Number(this.datafile.status)) {
      case Filestatus.New:
        return color ? "green" : this.icon_new;
      case Filestatus.Equal:
        return color ? "black" : this.icon_equal;
      case Filestatus.Updated:
        return color ? "blue" : this.icon_not_equal;
      case Filestatus.Deleted:
        return color ? "red" : this.icon_deleted;
    }
    if (this.loading) {
      return color ? "black" : this.icon_spinner;
    }
    return color ? "black" : this.icon_refresh;
  }

  action(): IconDefinition {
    let isFolder = !this.datafile.attributes?.isFile;
    if (isFolder && this.datafile.action !== Fileaction.Ignore && !this.nodeService.hasNotIgnoredChild(this.node)) {
      this.datafile.action = Fileaction.Ignore;
    }
    switch (Number(this.datafile.action)) {
      case Fileaction.Ignore:
        return this.icon_ignore;
      case Fileaction.Copy:
        return this.icon_copy;
      case Fileaction.Delete:
        return this.icon_delete;
      case Fileaction.Update:
        return this.icon_update;
    }
    return this.icon_unknown;
  }

  targetFile(): string {
    if (this.datafile.status === Filestatus.New && this.datafile.action !== Fileaction.Copy && !this.nodeService.hasNotIgnoredChild(this.node)) {
      return '';
    }
    return `${this.datafile.path ? this.datafile.path + '/' : ''}${this.datafile.name}`
  }

  toggleAction(): void {
    switch (this.datafile.status) {
      case Filestatus.New:
        switch (this.datafile.action) {
          case Fileaction.Ignore:
            this.setNodeAction(this.node, Fileaction.Copy);
            break;
          case Fileaction.Copy:
            this.setNodeAction(this.node, Fileaction.Ignore);
            break;
        }
        break;
      case Filestatus.Equal:
        switch (this.datafile.action) {
          case Fileaction.Ignore:
            this.setNodeAction(this.node, Fileaction.Delete);
            break;
          case Fileaction.Delete:
            this.setNodeAction(this.node, Fileaction.Ignore);
            break;
        }
        break;
      case Filestatus.Updated:
        switch (this.datafile.action) {
          case Fileaction.Ignore:
            this.setNodeAction(this.node, Fileaction.Update);
            break;
          case Fileaction.Update:
            this.setNodeAction(this.node, Fileaction.Delete);
            break;
          case Fileaction.Delete:
            this.setNodeAction(this.node, Fileaction.Ignore);
            break;
        }
        break;
      case Filestatus.Deleted:
        switch (this.datafile.action) {
          case Fileaction.Ignore:
            this.setNodeAction(this.node, Fileaction.Delete);
            break;
          case Fileaction.Delete:
            this.setNodeAction(this.node, Fileaction.Ignore);
            break;
        }
        break;
    }
  }

  setNodeAction(node: TreeNode<Datafile>, action: Fileaction): void {
    let isFolderUpdate = this.datafile.attributes?.isFile && this.datafile.status == Filestatus.Updated;
    node.data!.action = isFolderUpdate ? this.getFolderUpdteFileaction(node, action) : action;
    node.children?.forEach(v => this.setNodeAction(v, action));
  }

  getFolderUpdteFileaction(node: TreeNode<Datafile>, action: Fileaction): Fileaction {
    if (action === Fileaction.Delete && node.data!.status === Filestatus.New) {
      return Fileaction.Ignore;
    }
    if (action === Fileaction.Update) {
      switch (node.data!.status) {
        case Filestatus.Deleted:
          return Fileaction.Delete;
        case Filestatus.Equal:
          return Fileaction.Ignore;
        case Filestatus.New:
          return Fileaction.Copy;
        default:
          return action;
      }
    }
    return action;
  }

  targetFileClass(): string {
    if (!this.datafile.attributes?.isFile) {
      if (this.nodeService.hasNotIgnoredChild(this.node)) {
        return "fw-bold";
      } else {
        return "text-muted";
      }
    }
    switch (this.datafile.action) {
      case Fileaction.Delete:
        return "text-decoration-line-through";
      case Fileaction.Copy:
        return "fst-italic fw-bold";
      case Fileaction.Update:
        return "fw-bold";
      case Fileaction.Ignore:
        return "text-muted";
    }
    return '';
  }

}
