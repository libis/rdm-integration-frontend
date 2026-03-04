// Author: Eryk Kulikowski @ KU Leuven (2024). Apache 2.0 License

import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { TreeNode } from 'primeng/api';
import { ButtonDirective } from 'primeng/button';
import { TreeTableModule } from 'primeng/treetable';
import { Datafile, Fileaction } from '../models/datafile';
import {
  FileActionStyle,
  buildInlineStyle,
  getFileActionStyle,
} from '../shared/constants';

@Component({
  selector: 'tr[app-downloadablefile]',
  templateUrl: './downladablefile.component.html',
  styleUrls: ['./downladablefile.component.scss'],
  imports: [TreeTableModule, ButtonDirective],
  exportAs: 'appDownloadablefile',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DownladablefileComponent {
  readonly datafile = input<Datafile>({});
  readonly rowNodeMap = input<Map<string, TreeNode<Datafile>>>(
    new Map<string, TreeNode<Datafile>>(),
  );
  readonly rowNode = input<TreeNode<Datafile>>({});
  // Trigger to force update when underlying data (action) mutates
  readonly trigger = input(0);

  /** Emitted after action state changes to notify parent to refresh view */
  readonly changed = output<void>();

  readonly node = computed<TreeNode<Datafile>>(() => {
    const map = this.rowNodeMap();
    const df = this.datafile();
    const key = df.id! + (df.attributes?.isFile ? ':file' : '');
    return map.get(key) ?? {};
  });

  static readonly icon_ignore = 'pi pi-stop';
  static readonly icon_download = 'pi pi-check-square';
  static readonly icon_custom = 'pi pi-exclamation-triangle';

  readonly actionIcon = computed(() => {
    // Track trigger to update when action changes via mutation
    this.trigger();
    return DownladablefileComponent.actionIconFromNode(this.node());
  });

  public static actionIconFromNode(node: TreeNode<Datafile>): string {
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

  readonly fileName = computed(() => `${this.datafile().name}`);

  readonly hostStyle = computed(() => {
    // Track trigger to update when action changes via mutation
    this.trigger();
    const action = this.datafile().action ?? Fileaction.Ignore;
    let style: FileActionStyle;
    switch (action) {
      case Fileaction.Download:
        style = getFileActionStyle('DOWNLOAD');
        break;
      case Fileaction.Custom:
        style = getFileActionStyle('CUSTOM');
        break;
      default:
        style = getFileActionStyle('IGNORE');
    }
    return buildInlineStyle(style);
  });

  toggleAction(): void {
    const node = this.node();
    DownladablefileComponent.toggleNodeAction(node);
    this.updateSubtreeAndAncestors(node);
    this.changed.emit();
  }

  private updateSubtreeAndAncestors(node: TreeNode<Datafile>): void {
    this.updateFolderActions(node);
    if (!node.parent) {
      const root = this.rowNodeMap().get('');
      if (root) {
        this.updateFolderActions(root);
      }
      return;
    }
    let parent: TreeNode<Datafile> | undefined = node.parent;
    while (parent) {
      this.updateFolderActionFromChildren(parent);
      parent = parent.parent;
    }
  }

  updateFolderActions(node: TreeNode<Datafile>): Fileaction {
    if (node.children && node.children.length > 0) {
      for (const child of node.children) {
        this.updateFolderActions(child);
      }
      return this.updateFolderActionFromChildren(node);
    } else {
      return node.data?.action ? node.data.action : Fileaction.Ignore;
    }
  }

  private updateFolderActionFromChildren(node: TreeNode<Datafile>): Fileaction {
    if (!node.children || node.children.length === 0) {
      return node.data?.action ?? Fileaction.Ignore;
    }
    let res: Fileaction | undefined = undefined;
    for (const child of node.children) {
      const childAction = child.data?.action ?? Fileaction.Ignore;
      if (res !== undefined && res !== childAction) {
        res = Fileaction.Custom;
      } else if (res === undefined) {
        res = childAction;
      }
    }
    const result = res ?? Fileaction.Ignore;
    if (node.data) {
      node.data.action = result;
    }
    return result;
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

  private static setNodeAction(
    node: TreeNode<Datafile>,
    action: Fileaction,
  ): void {
    node.data!.action = action;
    node.children?.forEach((v) => this.setNodeAction(v, action));
  }
}
