// Author: Eryk Kulikowski @ KU Leuven (2023). Apache 2.0 License

import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';

// Services
import { DataStateService } from '../data.state.service';
import { DataUpdatesService } from '../data.updates.service';
import { CredentialsService } from '../credentials.service';
import { FolderActionUpdateService } from '../folder.action.update.service';
import { PluginService } from '../plugin.service';
import { UtilsService } from '../utils.service';

// Models
import { CompareResult, ResultStatus } from '../models/compare-result';
import { Datafile, Fileaction, Filestatus } from '../models/datafile';

// PrimeNG
import { TreeNode, PrimeTemplate } from 'primeng/api';
import { ButtonDirective } from 'primeng/button';
import { TreeTableModule } from 'primeng/treetable';
import { PopoverModule } from 'primeng/popover';
import { TableModule } from 'primeng/table';

// Components
import { DatafileComponent } from '../datafile/datafile.component';

// Constants and types
import { APP_CONSTANTS } from '../shared/constants';
import { FilterItem, SubscriptionManager } from '../shared/types';

@Component({
  selector: 'app-compare',
  templateUrl: './compare.component.html',
  styleUrls: ['./compare.component.scss'],
  imports: [
    CommonModule,
    ButtonDirective,
    TreeTableModule,
    PrimeTemplate,
    PopoverModule,
    TableModule,
    DatafileComponent,
  ],
})
export class CompareComponent
  implements OnInit, OnDestroy, SubscriptionManager
{
  private readonly dataUpdatesService = inject(DataUpdatesService);
  private readonly dataStateService = inject(DataStateService);
  private readonly credentialsService = inject(CredentialsService);
  private readonly router = inject(Router);
  private readonly folderActionUpdateService = inject(
    FolderActionUpdateService,
  );
  private readonly pluginService = inject(PluginService);
  private readonly utils = inject(UtilsService);

  // Subscriptions for cleanup
  private readonly subscriptions = new Set<Subscription>();

  // Icon constants
  readonly icon_noaction = APP_CONSTANTS.ICONS.NO_ACTION;
  readonly icon_update = APP_CONSTANTS.ICONS.UPDATE;
  readonly icon_mirror = APP_CONSTANTS.ICONS.MIRROR;
  readonly icon_submit = APP_CONSTANTS.ICONS.SUBMIT;
  readonly icon_compare = APP_CONSTANTS.ICONS.COMPARE;
  readonly icon_action = APP_CONSTANTS.ICONS.ACTION;
  readonly icon_warning = APP_CONSTANTS.ICONS.WARNING;
  // nicer action header icon in table than lightning
  readonly icon_status = APP_CONSTANTS.ICONS.FILTER;

  disabled = true;
  loading = true;
  refreshHidden = true;
  isInFilterMode = false;
  maxFileSize?: number;
  rejectedSize?: string[];
  rejectedName?: string[];
  allowedFileNamePattern?: string;
  allowedFolderPathPattern?: string;

  data: CompareResult = {};
  rootNodeChildren: TreeNode<Datafile>[] = [];
  rowNodeMap: Map<string, TreeNode<Datafile>> = new Map<
    string,
    TreeNode<Datafile>
  >();

  // Filter configuration
  readonly filterItems: FilterItem[] = [
    {
      label: '(New files)',
      icon: APP_CONSTANTS.ICONS.NEW_FILE,
      iconStyle: { color: APP_CONSTANTS.COLORS.SUCCESS },
      title: "Files that aren't in the dataset yet",
      fileStatus: Filestatus.New,
    },
    {
      label: '(Changed files)',
      icon: APP_CONSTANTS.ICONS.CHANGED_FILE,
      iconStyle: { color: APP_CONSTANTS.COLORS.INFO },
      title:
        'Files that are not the same in the dataset and the active data repository, but share the same file name and/or file path',
      fileStatus: Filestatus.Updated,
    },
    {
      label: '(Unchanged files)',
      icon: APP_CONSTANTS.ICONS.UNCHANGED_FILE,
      iconStyle: { color: APP_CONSTANTS.COLORS.NEUTRAL },
      title:
        'Files that are the same in the dataset and the active data repository',
      fileStatus: Filestatus.Equal,
    },
    {
      label: '(Files only in RDR)',
      icon: APP_CONSTANTS.ICONS.DELETED_FILE,
      iconStyle: { color: APP_CONSTANTS.COLORS.DANGER },
      title:
        'Files that are only in the dataset, but not in the active data repository',
      fileStatus: Filestatus.Deleted,
    },
  ];

  selectedFilterItems: FilterItem[] = [...this.filterItems];

  constructor() {}

  ngOnInit(): void {
    if (this.dataStateService.getCurrentValue() != null) {
      this.dataStateService.initializeState(
        this.credentialsService.credentials,
      );
    }
    this.setUpdatedDataSubscription();
  }

  ngOnDestroy(): void {
    // Clean up all subscriptions
    this.subscriptions.forEach((sub) => sub.unsubscribe());
    this.subscriptions.clear();
  }

  private setUpdatedDataSubscription(): void {
    const initialStateSubscription = this.dataStateService
      .getObservableState()
      .subscribe((data) => {
        if (data !== null) {
          this.subscriptions.delete(initialStateSubscription);
          initialStateSubscription.unsubscribe();
          this.setData(data);
          if (data.data && data.id) {
            this.maxFileSize = data.maxFileSize;
            this.rejectedSize = data.rejectedSize;
            this.rejectedName = data.rejectedName;
            this.allowedFileNamePattern = data.allowedFileNamePattern;
            this.allowedFolderPathPattern = data.allowedFolderPathPattern;
            if (this.data.status !== ResultStatus.Updating) {
              this.disabled = false;
              this.loading = false;
            } else {
              this.getUpdatedData(0);
            }
          }
        }
      });
    this.subscriptions.add(initialStateSubscription);
  }

  private getUpdatedData(cnt: number): void {
    const subscription = this.dataUpdatesService
      .updateData(this.data.data!, this.data.id!)
      .subscribe(async (data: CompareResult) => {
        cnt++;
        this.subscriptions.delete(subscription);
        subscription.unsubscribe();
        if (data.data && data.id) {
          this.setData(data);
        }
        if (this.data.status !== ResultStatus.Updating) {
          this.disabled = false;
          this.loading = false;
        } else if (cnt > APP_CONSTANTS.MAX_UPDATE_RETRIES) {
          this.loading = false;
          this.refreshHidden = false;
        } else {
          await this.utils.sleep(APP_CONSTANTS.RETRY_SLEEP_DURATION);
          this.getUpdatedData(cnt);
        }
      });
    this.subscriptions.add(subscription);
  }

  refresh(): void {
    const subscription = this.dataUpdatesService
      .updateData(this.data.data!, this.data.id!)
      .subscribe((data) => {
        this.subscriptions.delete(subscription);
        subscription.unsubscribe();
        if (data.data && data.id) {
          this.setData(data);
        }
        if (this.data.status !== ResultStatus.Updating) {
          this.disabled = false;
        } else {
          this.refreshHidden = true;
        }
      });
    this.subscriptions.add(subscription);
  }

  rowClass(datafile: Datafile): string {
    switch (datafile.action) {
      case Fileaction.Ignore:
        return APP_CONSTANTS.FILE_ACTION_STYLES.IGNORE;
      case Fileaction.Copy:
        return APP_CONSTANTS.FILE_ACTION_STYLES.COPY;
      case Fileaction.Update:
        return APP_CONSTANTS.FILE_ACTION_STYLES.UPDATE;
      case Fileaction.Delete:
        return APP_CONSTANTS.FILE_ACTION_STYLES.DELETE;
      case Fileaction.Custom:
        return APP_CONSTANTS.FILE_ACTION_STYLES.CUSTOM;
    }
    return '';
  }

  noActionSelection(): void {
    this.rowNodeMap.forEach((rowNode) => {
      const datafile = rowNode.data!;
      if (datafile.hidden) {
        return;
      }
      datafile.action = Fileaction.Ignore;
    });
  }

  updateSelection(): void {
    this.rowNodeMap.forEach((rowNode) => {
      const datafile = rowNode.data!;
      if (datafile.hidden) {
        return;
      }
      switch (datafile.status) {
        case Filestatus.New:
          datafile.action = Fileaction.Copy;
          break;
        case Filestatus.Equal:
          datafile.action = Fileaction.Ignore;
          break;
        case Filestatus.Updated:
          datafile.action = Fileaction.Update;
          break;
        case Filestatus.Deleted:
          datafile.action = Fileaction.Ignore;
          break;
      }
    });
  }

  mirrorSelection(): void {
    this.rowNodeMap.forEach((rowNode) => {
      const datafile = rowNode.data!;
      if (datafile.hidden) {
        return;
      }
      switch (datafile.status) {
        case Filestatus.New:
          datafile.action = Fileaction.Copy;
          break;
        case Filestatus.Equal:
          datafile.action = Fileaction.Ignore;
          break;
        case Filestatus.Updated:
          datafile.action = Fileaction.Update;
          break;
        case Filestatus.Deleted:
          datafile.action = Fileaction.Delete;
          break;
      }
    });
  }

  updateFilters(): void {
    if (this.selectedFilterItems.length < 4) {
      this.filterOn(this.selectedFilterItems);
    } else {
      this.filterOff();
    }
  }

  showAll(): void {
    this.selectedFilterItems = [...this.filterItems];
    this.filterOff();
  }

  private filterOn(filters: FilterItem[]): void {
    const nodes: TreeNode<Datafile>[] = [];
    this.rowNodeMap.forEach((rowNode) => {
      const datafile = rowNode.data!;
      datafile.hidden =
        !datafile.attributes?.isFile ||
        !filters.some((i) => datafile.status === i.fileStatus);
      if (!datafile.hidden) {
        nodes.push(rowNode);
      }
    });
    this.rootNodeChildren = nodes;
    this.isInFilterMode = true;
  }

  private filterOff(): void {
    this.rowNodeMap.forEach((rowNode) => {
      const datafile = rowNode.data!;
      datafile.hidden = false;
    });
    this.rootNodeChildren = this.rowNodeMap.get('')!.children!;
    this.isInFilterMode = false;
    this.folderActionUpdateService.updateFoldersAction(this.rowNodeMap);
  }

  submit(): void {
    this.dataStateService.updateState(this.data);
    if (this.isNewDataset()) {
      this.router.navigate(['/metadata-selector']);
    } else {
      this.router.navigate(['/submit']);
    }
  }

  // UI helpers
  hasSelection(): boolean {
    // At least one file with an action other than Ignore
    for (const [, node] of this.rowNodeMap) {
      const d = node.data;
      if (d?.attributes?.isFile && d.action !== undefined) {
        // If any action except Ignore
        if (d.action !== Fileaction.Ignore) {
          return true;
        }
      }
    }
    return false;
  }

  repoName(): string | undefined {
    return this.credentialsService.credentials.repo_name;
  }

  newlyCreated(): boolean {
    return this.credentialsService.credentials.newly_created === true;
  }

  dataverseHeaderNoColon(): string {
    const h = this.dataverseHeader();
    return h.endsWith(':') ? h.substring(0, h.length - 1) : h;
  }

  // Safeguard for detecting a new dataset when credentials flag is missing
  isNewDataset(): boolean {
    if (this.newlyCreated()) return true;
    const id = this.data?.id?.toLowerCase() || '';
    return id.includes('new dataset') || id === '';
  }

  displayDatasetId(): string {
    // When new, show a friendly text and avoid colon/link
    if (!this.data?.id || this.data.id.trim() === '') {
      return 'New Dataset';
    }
    // If backend sends something like ':New Dataset' keep only the label
    const id = this.data.id.trim();
    const clean = id.startsWith(':') ? id.substring(1).trim() : id;
    return clean;
  }

  private setData(data: CompareResult): void {
    this.data = data;
    if (!data.data || data.data.length === 0) {
      return;
    }
    const rowDataMap = this.utils.mapDatafiles(data.data);
    rowDataMap.forEach((v) => this.utils.addChild(v, rowDataMap));
    const rootNode = rowDataMap.get('');
    this.rowNodeMap = rowDataMap;
    if (rootNode?.children) {
      this.updateFoldersStatus(rootNode);
      this.rootNodeChildren = rootNode.children;
    }
  }

  private updateFoldersStatus(node: TreeNode<Datafile>): void {
    if (node.data?.status !== undefined) {
      return;
    }
    node.children?.forEach((v) => this.updateFoldersStatus(v));

    let allDeleted = true;
    let allNew = true;
    let allEqual = true;
    let anyUnknown = false;
    node.children?.forEach((v) => {
      allDeleted = allDeleted && v.data?.status === Filestatus.Deleted;
      allNew = allNew && v.data?.status === Filestatus.New;
      allEqual = allEqual && v.data?.status === Filestatus.Equal;
      anyUnknown = anyUnknown || v.data?.status === Filestatus.Unknown;
    });

    let status;
    if (anyUnknown) status = Filestatus.Unknown;
    else if (allEqual) status = Filestatus.Equal;
    else if (allDeleted) status = Filestatus.Deleted;
    else if (allNew) status = Filestatus.New;
    else status = Filestatus.Updated;
    node.data!.status = status;
  }

  back(): void {
    this.router.navigate(['/connect']);
  }

  repo(): string {
    return this.pluginService.getPlugin(
      this.credentialsService.credentials.pluginId,
    ).name;
  }

  dataverseHeader(): string {
    return this.pluginService.dataverseHeader();
  }
}
