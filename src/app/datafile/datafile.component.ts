// Author: Eryk Kulikowski @ KU Leuven (2023). Apache 2.0 License

import { Component, OnInit, inject, input } from '@angular/core';
import { TreeNode } from 'primeng/api';
import { ButtonDirective } from 'primeng/button';
import { TreeTableModule } from 'primeng/treetable';
import { FolderActionUpdateService } from '../folder.action.update.service';
import { Datafile, Fileaction, Filestatus } from '../models/datafile';
import { FileActionStyle, getFileActionStyle } from '../shared/constants';

@Component({
  selector: 'tr[app-datafile]',
  templateUrl: './datafile.component.html',
  styleUrls: ['./datafile.component.scss'],
  imports: [TreeTableModule, ButtonDirective],
  exportAs: 'appDatafile',
})
export class DatafileComponent implements OnInit {
  private folderActionUpdateService = inject(FolderActionUpdateService);

  readonly datafile = input<Datafile>({});
  readonly loading = input(true);
  readonly rowNodeMap = input<Map<string, TreeNode<Datafile>>>(
    new Map<string, TreeNode<Datafile>>(),
  );
  readonly rowNode = input<TreeNode<Datafile>>({});
  readonly isInFilter = input(false);

  icon_unknown = 'pi pi-question-circle';

  icon_new = 'pi pi-plus-circle';
  icon_deleted = 'pi pi-minus-circle';
  icon_equal = 'pi pi-check-circle';
  icon_not_equal = 'pi pi-exclamation-circle';
  icon_spinner = 'pi pi-spin pi-spinner';
  icon_refresh = 'pi pi-refresh';

  icon_ignore = 'pi pi-stop';
  icon_copy = 'pi pi-copy';
  icon_update = 'pi pi-clone';
  icon_delete = 'pi pi-trash';
  // Use block for warning indicator
  icon_custom = 'pi pi-stop';

  node: TreeNode<Datafile> = {};

  constructor() {}

  ngOnInit(): void {
    this.node = this.rowNodeMap().get(
      this.datafile().id! + (this.datafile().attributes?.isFile ? ':file' : ''),
    )!; // avoid collisions between folders and files having the same path and name
  }

  sourceFile(): string {
    const datafile = this.datafile();
    if (datafile.status == Filestatus.Deleted) {
      return '';
    }
    if (this.isInFilter()) {
      return `${datafile.path ? `${datafile.path}/` : ''}${datafile.name}`;
    }
    return `${datafile.name}`;
  }

  comparison(color: boolean): string {
    switch (Number(this.datafile().status)) {
      case Filestatus.New:
        return color ? 'green' : this.icon_new;
      case Filestatus.Equal:
        return color ? 'foreground' : this.icon_equal;
      case Filestatus.Updated:
        return color ? 'blue' : this.icon_not_equal;
      case Filestatus.Deleted:
        return color ? 'red' : this.icon_deleted;
    }
    if (this.loading()) {
      return color ? 'foreground' : this.icon_spinner;
    }
    return color ? 'foreground' : this.icon_refresh;
  }

  comparisonTitle(): string {
    switch (Number(this.datafile().status)) {
      case Filestatus.New:
        return 'New file in repository (not in dataset yet)';
      case Filestatus.Equal:
        return 'Unchanged file';
      case Filestatus.Updated:
        return 'Changed file between repository and dataset';
      case Filestatus.Deleted:
        return 'File only in dataset (deleted in repository)';
    }
    return this.loading()
      ? 'Loading status...'
      : 'Click refresh to re-check status';
  }

  action(): string {
    switch (Number(this.datafile().action)) {
      case Fileaction.Ignore:
        return this.icon_ignore;
      case Fileaction.Copy:
        return this.icon_copy;
      case Fileaction.Delete:
        return this.icon_delete;
      case Fileaction.Update:
        return this.icon_update;
      case Fileaction.Custom:
        return this.icon_custom;
    }
    return this.icon_unknown;
  }

  targetFile(): string {
    const datafile = this.datafile();
    if (
      datafile.status === Filestatus.New &&
      datafile.action !== Fileaction.Copy
    ) {
      return '';
    }
    return `${datafile.path ? `${datafile.path}/` : ''}${datafile.name}`;
  }

  toggleAction(): void {
    const datafile = this.datafile();
    switch (datafile.action) {
      case Fileaction.Ignore:
        switch (datafile.status) {
          case Filestatus.New:
            this.setNodeAction(this.node, Fileaction.Copy);
            break;
          case Filestatus.Updated:
            this.setNodeAction(this.node, Fileaction.Update);
            break;
          default:
            this.setNodeAction(this.node, Fileaction.Delete);
            break;
        }
        break;
      case Fileaction.Update:
        if (datafile.attributes?.isFile) {
          this.setNodeAction(this.node, Fileaction.Delete);
        } else {
          this.setNodeAction(this.node, Fileaction.Ignore);
        }
        break;
      default:
        this.setNodeAction(this.node, Fileaction.Ignore);
        break;
    }
    this.folderActionUpdateService.updateFoldersAction(this.rowNodeMap());
  }

  setNodeAction(node: TreeNode<Datafile>, action: Fileaction): void {
    const isFileFileInFolder =
      node.data?.attributes?.isFile && !this.datafile().attributes?.isFile;
    node.data!.action = isFileFileInFolder
      ? this.getFileInFolderAction(node, action)
      : action;
    node.children?.forEach((v) => this.setNodeAction(v, action));
  }

  getFileInFolderAction(
    node: TreeNode<Datafile>,
    action: Fileaction,
  ): Fileaction {
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

  private resolveHostStyle(): FileActionStyle {
    const action = this.datafile().action ?? Fileaction.Ignore;
    switch (action) {
      case Fileaction.Copy:
        return getFileActionStyle('COPY');
      case Fileaction.Update:
        return getFileActionStyle('UPDATE');
      case Fileaction.Delete:
        return getFileActionStyle('DELETE');
      case Fileaction.Custom:
        return getFileActionStyle('CUSTOM');
      default:
        return getFileActionStyle('IGNORE');
    }
  }

  getStyle(): string {
    const style = this.resolveHostStyle();
    const declarations: string[] = [];
    if (style.backgroundColor) {
      declarations.push(`background-color: ${style.backgroundColor}`);
    }
    if (style.color) {
      declarations.push(`color: ${style.color}`);
    }
    return declarations.length ? `${declarations.join('; ')};` : '';
  }

  targetFileClass(): string {
    switch (this.datafile().action) {
      case Fileaction.Delete:
        return 'text-decoration-line-through';
      case Fileaction.Copy:
        return 'fst-italic fw-bold';
      case Fileaction.Update:
        return 'fw-bold';
      case Fileaction.Ignore:
        return '';
    }
    return '';
  }
}
