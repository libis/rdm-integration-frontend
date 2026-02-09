// Author: Eryk Kulikowski @ KU Leuven (2023). Apache 2.0 License

import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
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
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { TableModule } from 'primeng/table';
import { TreeTableModule } from 'primeng/treetable';

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
    ProgressSpinnerModule,
    DatafileComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
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
  readonly icon_status = APP_CONSTANTS.ICONS.FILTER;

  // Signals for state
  readonly data = signal<CompareResult>({});
  readonly loading = signal(true);
  readonly disabled = signal(true);
  readonly refreshHidden = signal(true);
  readonly refreshTrigger = signal(0); // Used to trigger updates in children when actions mirror/copy occur

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

  readonly selectedFilterItems = signal<FilterItem[]>([...this.filterItems]);

  // DERIVED STATE

  // Main Tree Structure
  readonly rowNodeMap = computed(() => {
    const d = this.data();
    if (!d.data || d.data.length === 0) {
      return new Map<string, TreeNode<Datafile>>();
    }
    const rowDataMap = this.utils.mapDatafiles(d.data);
    rowDataMap.forEach((v) => this.utils.addChild(v, rowDataMap));
    return rowDataMap;
  });

  // Filtered/Visible Nodes
  readonly rootNodeChildrenView = computed(() => {
    this.refreshTrigger(); // Add dependency to trigger re-evaluation on refresh
    const map = this.rowNodeMap();
    const root = map.get('');
    if (!root) return [];

    const filters = this.selectedFilterItems();
    const isFiltering = filters.length < 4;

    // Apply Filtering
    const visible: TreeNode<Datafile>[] = [];
    map.forEach((n) => {
      const f = n.data!;
      f.hidden =
        !f.attributes?.isFile ||
        !filters.some((i) => f.status === i.fileStatus);
      if (!f.hidden) visible.push(n);
    });

    if (isFiltering) {
      return visible;
    } else {
      // Ensure all unhidden
      map.forEach((n) => (n.data!.hidden = false));
      return root.children || [];
    }
  });

  readonly isInFilterMode = computed(
    () => this.selectedFilterItems().length < 4,
  );

  readonly maxFileSize = computed(() => this.data().maxFileSize);
  readonly rejectedSize = computed(() => this.data().rejectedSize);
  readonly rejectedName = computed(() => this.data().rejectedName);
  readonly allowedFileNamePattern = computed(
    () => this.data().allowedFileNamePattern,
  );
  readonly allowedFolderPathPattern = computed(
    () => this.data().allowedFolderPathPattern,
  );

  // UI Computeds
  readonly repoName = computed(() => this.credentialsService.repoName$());
  readonly newlyCreated = computed(
    () => this.credentialsService.newlyCreated$() === true,
  );

  readonly folderName = computed(() => {
    // Logic from original method
    const pluginId = this.credentialsService.pluginId$();
    const repoName = this.repoName();
    const option = this.credentialsService.option$() || '';
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
        if (!option) return undefined;
        const segs = option.split('/');
        return segs.length > 1 ? segs[segs.length - 1] : undefined;
      }
      case 'globus':
        return lastSegment(option);
      case 'irods':
        return lastSegment(option);
      case 'sftp':
        return lastSegment(option);
      case 'local':
        return lastSegment(option);
      default:
        return undefined;
    }
  });

  readonly isNewDataset = computed(() => {
    if (this.newlyCreated()) return true;
    const id = this.data().id?.toLowerCase() || '';
    return id.includes('new dataset') || id === '';
  });

  readonly displayDatasetId = computed(() => {
    if (!this.data().id || this.data().id!.trim() === '') {
      return 'New Dataset';
    }
    const id = this.data().id!.trim();
    return id.startsWith(':') ? id.substring(1).trim() : id;
  });

  readonly canProceed = computed(() => {
    const newDs = this.isNewDataset();
    const hasMetadata = this.credentialsService.metadataAvailable$() !== false;

    // We need to re-evaluate this when refreshTrigger changes (actions mutated)
    this.refreshTrigger();

    if (!newDs) {
      return this.hasSelection();
    }
    return hasMetadata || this.hasSelection();
  });

  readonly proceedTitle = computed(() => {
    const newDs = this.isNewDataset();
    const hasMetadata = this.credentialsService.metadataAvailable$() !== false;
    const can = this.canProceed();
    if (newDs && !this.hasSelection()) {
      if (hasMetadata) return 'Proceed with metadata-only submission';
      if (!can)
        return 'Select at least one file to proceed (no metadata available).';
    }
    if (!can) return 'Action not available yet';
    return 'Go to next step';
  });

  constructor() {
    // Effect to update folder statuses when tree data changes.
    // This must be an effect (not inside a computed) because it mutates tree nodes.
    effect(() => {
      this.refreshTrigger(); // Track refresh trigger
      const map = this.rowNodeMap();
      const root = map.get('');
      if (root?.children) {
        this.folderStatusService.updateTreeRoot(root);
        this.folderActionUpdateService.updateFoldersAction(map);
      }
    });

    // Effect to react to state changes
    effect(() => {
      const data = this.dataStateService.state$();
      if (data !== null) {
        this.data.set(data);
        if (data.data && data.id) {
          if (data.status !== ResultStatus.Updating) {
            this.disabled.set(false);
            this.loading.set(false);
          } else {
            this.getUpdatedData(0);
          }
        }
      }
    });
  }

  ngOnInit(): void {
    if (this.dataStateService.state$() == null) {
      this.dataStateService.initializeState();
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach((sub) => sub.unsubscribe());
    this.subscriptions.clear();
    const shouldReset = this.loading();
    this.dataStateService.cancelInitialization(shouldReset);
  }

  private getUpdatedData(cnt: number): void {
    const id = this.data().id!;
    const dataItems = this.data().data!;

    let subscription: Subscription;
    subscription = this.dataUpdatesService
      .updateData(dataItems, id)
      .subscribe(async (data: CompareResult) => {
        cnt++;
        this.subscriptions.delete(subscription);
        subscription?.unsubscribe();
        if (data.data && data.id) {
          this.data.set(data);
        }
        if (this.data().status !== ResultStatus.Updating) {
          this.disabled.set(false);
          this.loading.set(false);
        } else if (cnt > APP_CONSTANTS.MAX_UPDATE_RETRIES) {
          this.loading.set(false);
          this.refreshHidden.set(false);
        } else {
          await this.utils.sleep(APP_CONSTANTS.RETRY_SLEEP_DURATION);
          this.getUpdatedData(cnt);
        }
      });
    this.subscriptions.add(subscription);
  }

  refresh(): void {
    // Reset state as if just arrived on the page
    this.refreshHidden.set(true);
    this.loading.set(true);
    this.disabled.set(true);
    // Restart the polling loop from count 0
    this.getUpdatedData(0);
  }

  noActionSelection(): void {
    this.rowNodeMap().forEach((rowNode) => {
      const datafile = rowNode.data!;
      if (datafile.hidden) return;
      datafile.action = Fileaction.Ignore;
    });
    this.refreshTrigger.update((n) => n + 1);
  }

  updateSelection(): void {
    this.rowNodeMap().forEach((rowNode) => {
      const datafile = rowNode.data!;
      if (datafile.hidden) return;
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
    this.refreshTrigger.update((n) => n + 1);
  }

  mirrorSelection(): void {
    this.rowNodeMap().forEach((rowNode) => {
      const datafile = rowNode.data!;
      if (datafile.hidden) return;
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
    this.refreshTrigger.update((n) => n + 1);
  }

  submit(): void {
    this.dataStateService.updateState(this.data());
    if (this.isNewDataset()) {
      this.router.navigate(['/metadata-selector']);
    } else {
      this.router.navigate(['/submit']);
    }
  }

  hasSelection(): boolean {
    for (const [, node] of this.rowNodeMap()) {
      const d = node.data;
      if (d?.attributes?.isFile && d.action !== undefined) {
        if (d.action !== Fileaction.Ignore) {
          return true;
        }
      }
    }
    return false;
  }

  // Computed signals for service-derived values
  readonly repo = computed(() => {
    const id = this.credentialsService.pluginId$();
    return id ? this.pluginService.getPlugin(id).name : '';
  });

  readonly dataverseHeader = computed(() =>
    this.pluginService.dataverseHeader$(),
  );

  readonly dataverseHeaderNoColon = computed(() => {
    const h = this.dataverseHeader();
    return h.endsWith(':') ? h.substring(0, h.length - 1) : h;
  });

  back(): void {
    const datasetId = this.credentialsService.datasetId$() || this.data().id;
    const credsExtra = this.credentialsService.credentials$() as unknown as {
      collectionId?: string;
    };
    const collectionId = credsExtra.collectionId;
    this.snapshotStorage.mergeConnect({
      dataset_id: datasetId,
      collectionId,
    });
    this.router.navigate(['/connect']);
  }
}
