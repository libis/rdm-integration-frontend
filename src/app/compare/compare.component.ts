// Author: Eryk Kulikowski @ KU Leuven (2023). Apache 2.0 License

import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';

// Services
import { CredentialsService } from '../credentials.service';
import { DataStateService } from '../data.state.service';
import { DataUpdatesService } from '../data.updates.service';
import { FolderActionUpdateService } from '../folder.action.update.service';
import { PluginService } from '../plugin.service';
import { FolderStatusService } from '../shared/folder-status.service';
import { SnapshotStorageService } from '../shared/snapshot-storage.service';
import { UtilsService } from '../utils.service';

// Models
import { CompareResult, ResultStatus } from '../models/compare-result';
import { Datafile, Fileaction, Filestatus } from '../models/datafile';

// PrimeNG
import { PrimeTemplate, TreeNode } from 'primeng/api';
import { ButtonDirective } from 'primeng/button';
import { PopoverModule } from 'primeng/popover';
import { TableModule } from 'primeng/table';
import { TreeTableModule } from 'primeng/treetable';

// Components
import { DatafileComponent } from '../datafile/datafile.component';

// Constants and types
import { Credentials } from '../models/credentials';
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
  private readonly snapshotStorage = inject(SnapshotStorageService);
  private readonly folderStatusService = inject(FolderStatusService);

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
    // Only initialize (which triggers a fresh compare fetch) if we have no existing state.
    // This preserves prior file action selections when navigating back from
    // metadata-selector or submit components.
    if (this.dataStateService.getCurrentValue() == null) {
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
    const sub = this.dataStateService.getObservableState().subscribe((data) => {
      if (data !== null) {
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
    this.subscriptions.add(sub);
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
    // Use setTimeout to ensure the selection model has updated before we filter
    setTimeout(() => {
      if (this.selectedFilterItems.length < 4) {
        this.filterOn(this.selectedFilterItems);
      } else {
        this.filterOff();
      }
    }, 0);
  }

  showAll(): void {
    this.selectedFilterItems = [...this.filterItems];
    this.filterOff();
  }

  private filterOn(filters: FilterItem[]): void {
    const visible: TreeNode<Datafile>[] = [];
    this.rowNodeMap.forEach((n) => {
      const f = n.data!;
      f.hidden =
        !f.attributes?.isFile ||
        !filters.some((i) => f.status === i.fileStatus);
      if (!f.hidden) visible.push(n);
    });
    this.rootNodeChildren = visible;
    this.isInFilterMode = true;
  }

  private filterOff(): void {
    this.rowNodeMap.forEach((n) => (n.data!.hidden = false));
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

  canProceed(): boolean {
    const newDs = this.isNewDataset();
    const creds: Credentials = this.credentialsService.credentials;
    // If metadata_available is undefined we assume metadata creation is possible
    const hasMetadata = creds.metadata_available !== false;
    if (!newDs) {
      return this.hasSelection();
    }
    // New dataset: allow if metadata present OR there is a file selection
    return hasMetadata || this.hasSelection();
  }

  proceedTitle(): string {
    const newDs = this.isNewDataset();
    const creds: Credentials = this.credentialsService.credentials;
    const hasMetadata = creds.metadata_available !== false;
    const can = this.canProceed();
    if (newDs && !this.hasSelection()) {
      // Metadata-only state messages
      if (hasMetadata) return 'Proceed with metadata-only submission';
      if (!can)
        return 'Select at least one file to proceed (no metadata available).';
    }
    if (!can) return 'Action not available yet';
    return 'Go to next step';
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

  /**
   * Derives a short folder / collection indicator depending on the current plugin.
   * This is used purely for UI context next to the plugin name.
   *
   * Conventions per plugin (based on backend implementations):
   * - github / gitlab : repoName can be owner/repo[/sub/path]; show last segment only when depth > 2
   * - onedrive        : repoName holds drive id; folder path comes from option (driveId/path/to/folder). We show the final folder segment from option if present.
   * - globus          : repoName is endpoint id; option is folder path; show last segment of option (fallback '/' => undefined)
   * - irods           : repoName is zone; option is collection path; show last collection segment (if not root '/').
   * - sftp            : repoName unused for path; option is absolute/relative path; show last non-empty segment.
   * - local           : repoName not used for path (local root from url); option is starting folder; show last segment.
   * - osf / redcap / dataverse : no hierarchical folder context worth displaying (single dataset/container) => undefined.
   */
  folderName(): string | undefined {
    const pluginId = this.credentialsService.credentials.pluginId;
    const repoName = this.repoName();
    const option = this.credentialsService.credentials.option || '';
    if (!pluginId) return undefined;

    const lastSegment = (path: string): string | undefined => {
      if (!path) return undefined;
      const cleaned = path.replace(/\\/g, '/').replace(/\/+$/, '');
      if (cleaned === '' || cleaned === '/') return undefined;
      const parts = cleaned.split('/').filter((p) => p.length > 0);
      if (parts.length === 0) return undefined;
      return parts[parts.length - 1];
    };

    switch (pluginId) {
      case 'github':
      case 'gitlab': {
        if (!repoName) return undefined;
        const parts = repoName.split('/');
        return parts.length > 2 ? parts[parts.length - 1] : undefined;
      }
      case 'onedrive': {
        // option: driveId/path/inside/drive ; first segment is driveId
        if (!option) return undefined;
        const segs = option.split('/');
        return segs.length > 1 ? segs[segs.length - 1] : undefined;
      }
      case 'globus': {
        // option: /path/in/endpoint
        return lastSegment(option);
      }
      case 'irods': {
        // option is the collection absolute path, e.g. /zone/home/user/collection
        return lastSegment(option);
      }
      case 'sftp': {
        return lastSegment(option);
      }
      case 'local': {
        return lastSegment(option);
      }
      case 'osf':
      case 'redcap':
      case 'dataverse':
      default:
        return undefined;
    }
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
      // Delegate folder aggregation logic to service
      this.folderStatusService.updateTreeRoot(rootNode);
      this.rootNodeChildren = rootNode.children;
    }
  }

  back(): void {
    // Persist any updated dataset/collection identifiers before navigating back.
    const datasetId =
      this.credentialsService.credentials.dataset_id || this.data?.id;
    const credsExtra = this.credentialsService.credentials as unknown as {
      collectionId?: string;
    };
    const collectionId = credsExtra.collectionId;
    this.snapshotStorage.mergeConnect({
      dataset_id: datasetId,
      collectionId,
    });
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
