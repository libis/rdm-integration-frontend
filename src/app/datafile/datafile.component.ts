// Author: Eryk Kulikowski @ KU Leuven (2023). Apache 2.0 License

import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
} from '@angular/core';
import { TreeNode } from 'primeng/api';
import { ButtonDirective } from 'primeng/button';
import { TreeTableModule } from 'primeng/treetable';
import { FolderActionUpdateService } from '../folder.action.update.service';
import { Datafile, Fileaction, Filestatus } from '../models/datafile';
import {
  FileActionStyle,
  buildInlineStyle,
  getFileActionStyle,
} from '../shared/constants';

@Component({
  selector: 'tr[app-datafile]',
  templateUrl: './datafile.component.html',
  styleUrls: ['./datafile.component.scss'],
  imports: [TreeTableModule, ButtonDirective],
  exportAs: 'appDatafile',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DatafileComponent {
  private folderActionUpdateService = inject(FolderActionUpdateService);

  readonly datafile = input<Datafile>({});
  readonly loading = input(true);
  readonly rowNodeMap = input<Map<string, TreeNode<Datafile>>>(
    new Map<string, TreeNode<Datafile>>(),
  );
  readonly rowNode = input<TreeNode<Datafile>>({});
  readonly isInFilter = input(false);
  // Trigger to force update when underlying data (action) mutates
  readonly trigger = input(0);
  readonly changed = output<void>();

  // Icon constants - static readonly for efficiency
  static readonly icon_unknown = 'pi pi-question-circle';
  static readonly icon_new = 'pi pi-plus-circle';
  static readonly icon_deleted = 'pi pi-minus-circle';
  static readonly icon_equal = 'pi pi-check-circle';
  static readonly icon_not_equal = 'pi pi-exclamation-circle';
  static readonly icon_spinner = 'pi pi-spin pi-spinner';
  static readonly icon_refresh = 'pi pi-refresh';
  static readonly icon_ignore = 'pi pi-stop';
  static readonly icon_copy = 'pi pi-copy';
  static readonly icon_update = 'pi pi-clone';
  static readonly icon_delete = 'pi pi-trash';
  static readonly icon_custom = 'pi pi-stop';

  readonly node = computed<TreeNode<Datafile>>(() => {
    const id = this.datafile().id;
    const isFile = this.datafile().attributes?.isFile;
    if (id !== undefined) {
      return this.rowNodeMap().get(id + (isFile ? ':file' : '')) ?? {};
    }
    return {};
  });

  readonly sourceFile = computed(() => {
    const datafile = this.datafile();
    if (datafile.status == Filestatus.Deleted) {
      return '';
    }
    if (this.isInFilter()) {
      return `${datafile.path ? `${datafile.path}/` : ''}${datafile.name}`;
    }
    return `${datafile.name}`;
  });

  readonly comparisonIcon = computed(() => {
    switch (Number(this.datafile().status)) {
      case Filestatus.New:
        return DatafileComponent.icon_new;
      case Filestatus.Equal:
        return DatafileComponent.icon_equal;
      case Filestatus.Updated:
        return DatafileComponent.icon_not_equal;
      case Filestatus.Deleted:
        return DatafileComponent.icon_deleted;
    }
    return this.loading()
      ? DatafileComponent.icon_spinner
      : DatafileComponent.icon_refresh;
  });

  readonly comparisonColor = computed(() => {
    switch (Number(this.datafile().status)) {
      case Filestatus.New:
        return 'green';
      case Filestatus.Equal:
        return 'foreground';
      case Filestatus.Updated:
        return 'blue';
      case Filestatus.Deleted:
        return 'red';
    }
    return 'foreground';
  });

  readonly comparisonTitle = computed(() => {
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
  });

  readonly actionIcon = computed(() => {
    // Track trigger to update when action changes via mutation
    this.trigger();
    switch (Number(this.datafile().action)) {
      case Fileaction.Ignore:
        return DatafileComponent.icon_ignore;
      case Fileaction.Copy:
        return DatafileComponent.icon_copy;
      case Fileaction.Delete:
        return DatafileComponent.icon_delete;
      case Fileaction.Update:
        return DatafileComponent.icon_update;
      case Fileaction.Custom:
        return DatafileComponent.icon_custom;
    }
    return DatafileComponent.icon_unknown;
  });

  readonly targetFile = computed(() => {
    const datafile = this.datafile();
    if (
      datafile.status === Filestatus.New &&
      datafile.action !== Fileaction.Copy
    ) {
      return '';
    }
    return `${datafile.path ? `${datafile.path}/` : ''}${datafile.name}`;
  });

  readonly hostStyle = computed(() => {
    // Track trigger to update when action changes via mutation
    this.trigger();
    const action = this.datafile().action ?? Fileaction.Ignore;
    let style: FileActionStyle;
    switch (action) {
      case Fileaction.Copy:
        style = getFileActionStyle('COPY');
        break;
      case Fileaction.Update:
        style = getFileActionStyle('UPDATE');
        break;
      case Fileaction.Delete:
        style = getFileActionStyle('DELETE');
        break;
      case Fileaction.Custom:
        style = getFileActionStyle('CUSTOM');
        break;
      default:
        style = getFileActionStyle('IGNORE');
    }
    return buildInlineStyle(style);
  });

  readonly targetFileClass = computed(() => {
    // Track trigger to update when action changes via mutation
    this.trigger();
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
  });

  toggleAction(): void {
    const datafile = this.datafile();
    const node = this.node();
    switch (datafile.action) {
      case Fileaction.Ignore:
        switch (datafile.status) {
          case Filestatus.New:
            this.setNodeAction(node, Fileaction.Copy);
            break;
          case Filestatus.Updated:
            this.setNodeAction(node, Fileaction.Update);
            break;
          default:
            this.setNodeAction(node, Fileaction.Delete);
            break;
        }
        break;
      case Fileaction.Update:
        if (datafile.attributes?.isFile) {
          this.setNodeAction(node, Fileaction.Delete);
        } else {
          this.setNodeAction(node, Fileaction.Ignore);
        }
        break;
      default:
        this.setNodeAction(node, Fileaction.Ignore);
        break;
    }
    this.folderActionUpdateService.updateFoldersAction(this.rowNodeMap());
    this.changed.emit();
  }

  setNodeAction(node: TreeNode<Datafile>, action: Fileaction): void {
    if (!node || !node.data) return;
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
}
