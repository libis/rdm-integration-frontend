// Author: Eryk Kulikowski @ KU Leuven (2024). Apache 2.0 License

import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnDestroy,
  OnInit,
  signal,
} from '@angular/core';
import { Subscription } from 'rxjs';

// Services
import { ActivatedRoute } from '@angular/router';
import { DataService } from '../data.service';
import { DvObjectLookupService } from '../dvobject.lookup.service';
import { PluginService } from '../plugin.service';
import { NavigationService } from '../shared/navigation.service';
import { NotificationService } from '../shared/notification.service';
import { UtilsService } from '../utils.service';

// Models
import {
  CachedComputeResponse,
  CompareResult,
  DdiCdiRequest,
  Key,
} from '../models/compare-result';
import { Datafile } from '../models/datafile';

// PrimeNG
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { PrimeTemplate, SelectItem, TreeNode } from 'primeng/api';
import { Button, ButtonDirective } from 'primeng/button';
import { Checkbox } from 'primeng/checkbox';
import { Dialog } from 'primeng/dialog';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { Select } from 'primeng/select';
import { TreeTableModule } from 'primeng/treetable';
import { TabsModule } from 'primeng/tabs';

// Third-party
import { AutosizeModule } from 'ngx-autosize';

// RxJS
import { debounceTime, firstValueFrom, map, Observable, Subject } from 'rxjs';

// Constants and types
import {
  APP_CONSTANTS,
  buildInlineStyle,
  getFileActionStyle,
} from '../shared/constants';
import { SubscriptionManager } from '../shared/types';

@Component({
  selector: 'app-ddi-cdi',
  templateUrl: './ddi-cdi.component.html',
  styleUrl: './ddi-cdi.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ButtonDirective,
    FormsModule,
    Select,
    Dialog,
    Checkbox,
    PrimeTemplate,
    Button,
    TreeTableModule,
    ProgressSpinnerModule,
    AutosizeModule,
    TabsModule,
  ],
})
export class DdiCdiComponent implements OnInit, OnDestroy, SubscriptionManager {
  private readonly dvObjectLookupService = inject(DvObjectLookupService);
  private readonly pluginService = inject(PluginService);
  private readonly dataService = inject(DataService);
  private readonly utils = inject(UtilsService);
  private readonly route = inject(ActivatedRoute);
  private readonly notificationService = inject(NotificationService);
  private readonly navigation = inject(NavigationService);

  // Subscriptions for cleanup
  private readonly subscriptions = new Set<Subscription>();

  // CONSTANTS
  readonly DEBOUNCE_TIME = APP_CONSTANTS.DEBOUNCE_TIME;

  // NG MODEL FIELDS (signals)
  readonly dataverseToken = signal<string | undefined>(undefined);
  readonly datasetId = signal<string | undefined>(undefined);
  readonly output = signal('');
  readonly data = signal<CompareResult>({});
  readonly rootNodeChildren = signal<TreeNode<Datafile>[]>([]);
  readonly rowNodeMap = signal<Map<string, TreeNode<Datafile>>>(
    new Map<string, TreeNode<Datafile>>(),
  );
  readonly loading = signal(false);
  readonly submitPopup = signal(false);
  readonly outputDisabled = signal(true);
  readonly selectedFiles = signal<Set<string>>(new Set<string>());
  readonly generatedDdiCdi = signal<string | undefined>(undefined);
  readonly cachedOutputLoaded = signal(false);
  readonly sendEmailOnSuccess = signal(false);
  originalDdiCdi?: string;
  readonly activeTab = signal<string>('files');
  private readonly totalSelectableFiles = signal(0);

  // Computed signals for template bindings
  readonly allFilesSelected = computed(
    () =>
      this.totalSelectableFiles() > 0 &&
      this.selectedFiles().size >= this.totalSelectableFiles(),
  );
  readonly selectAllIcon = computed(() =>
    this.allFilesSelected() ? 'pi pi-check-square' : 'pi pi-square',
  );
  readonly generateDisabled = computed(
    () =>
      this.loading() || this.selectedFiles().size === 0 || !this.datasetId(),
  );

  // Computed signals for pluginService data
  readonly showDVToken = computed(() => this.pluginService.showDVToken$());
  readonly datasetFieldEditable = computed(() =>
    this.pluginService.datasetFieldEditable$(),
  );
  readonly dataverseHeader = computed(() =>
    this.pluginService.dataverseHeader$(),
  );
  readonly sendMails = computed(() => this.pluginService.sendMails$());
  readonly externalURL = computed(() => this.pluginService.externalURL$());

  // ITEMS IN SELECTS
  loadingItem: SelectItem<string> = { label: `Loading...`, value: 'loading' };
  loadingItems: SelectItem<string>[] = [this.loadingItem];
  readonly doiItems = signal<SelectItem<string>[]>([]);

  // INTERNAL STATE VARIABLES
  datasetSearchSubject: Subject<string> = new Subject();
  datasetSearchResultsObservable: Observable<Promise<SelectItem<string>[]>>;
  datasetSearchResultsSubscription?: Subscription;
  req?: DdiCdiRequest;

  constructor() {
    this.datasetSearchResultsObservable = this.datasetSearchSubject.pipe(
      debounceTime(this.DEBOUNCE_TIME),
      map((searchText) => this.datasetSearch(searchText)),
    );
  }

  async ngOnInit() {
    await this.pluginService.setConfig();

    // Load dataverseToken from localStorage if storeDvToken is enabled
    if (this.pluginService.isStoreDvToken()) {
      const dvToken = localStorage.getItem('dataverseToken');
      if (dvToken !== null) {
        this.dataverseToken.set(dvToken);
      }
    }

    this.subscriptions.add(
      this.route.queryParams.subscribe((params) => {
        const apiToken = params['apiToken'];
        if (apiToken) {
          this.dataverseToken.set(apiToken);
        }
        const pid = params['datasetPid'] ?? params['pid'];
        if (pid) {
          void this.populateDatasetOption(pid);
          this.datasetId.set(pid);
          this.onDatasetChange();
        }
      }),
    );
    this.datasetSearchResultsSubscription =
      this.datasetSearchResultsObservable.subscribe({
        next: (x) =>
          x
            .then((v) => {
              this.doiItems.set(v);
              const currentDatasetId = this.datasetId();
              if (currentDatasetId) {
                const match = v.find((item) => item.value === currentDatasetId);
                this.ensureSelectedDatasetOption(
                  currentDatasetId,
                  match?.label,
                );
              }
            })
            .catch((err) =>
              this.doiItems.set([
                {
                  label: `search failed: ${err.message}`,
                  value: err.message,
                },
              ]),
            ),
        error: (err) =>
          this.doiItems.set([
            { label: `search failed: ${err.message}`, value: err.message },
          ]),
      });
  }

  ngOnDestroy(): void {
    // Clean up all subscriptions
    this.subscriptions.forEach((sub) => sub.unsubscribe());
    this.subscriptions.clear();

    // Clean up existing observable subscriptions
    this.datasetSearchResultsSubscription?.unsubscribe();
  }

  onUserChange() {
    this.doiItems.set([]);
    this.datasetId.set(undefined);
    // Save dataverseToken to localStorage if storeDvToken is enabled
    const token = this.dataverseToken();
    if (token !== undefined && this.pluginService.isStoreDvToken()) {
      localStorage.setItem('dataverseToken', token);
    }
  }

  // DV OBJECTS: COMMON

  getDoiOptions(): void {
    const currentItems = this.doiItems();
    if (
      currentItems.length !== 0 &&
      currentItems.find((x) => x === this.loadingItem) === undefined
    ) {
      const currentDatasetId = this.datasetId();
      if (currentDatasetId) {
        this.ensureSelectedDatasetOption(currentDatasetId);
      }
      return;
    }
    const previouslySelected = this.datasetId();
    this.doiItems.set(this.loadingItems);
    if (!previouslySelected) {
      this.datasetId.set(undefined);
    }

    let httpSubscription: Subscription;
    // eslint-disable-next-line prefer-const -- split declaration needed to avoid TDZ with synchronous subscribe
    httpSubscription = this.dvObjectLookupService
      .getItems('', 'Dataset', undefined, this.dataverseToken())
      .subscribe({
        next: (items: SelectItem<string>[]) => {
          if (items && items.length > 0) {
            this.doiItems.set(items);
            if (previouslySelected) {
              const match = items.find(
                (item) => item.value === previouslySelected,
              );
              this.ensureSelectedDatasetOption(
                previouslySelected,
                match?.label,
              );
              this.datasetId.set(previouslySelected);
            } else {
              this.datasetId.set(undefined);
            }
          } else {
            this.doiItems.set([]);
            if (!previouslySelected) {
              this.datasetId.set(undefined);
            }
          }
          this.subscriptions.delete(httpSubscription);
          httpSubscription?.unsubscribe();
        },
        error: (err) => {
          this.notificationService.showError(`DOI lookup failed: ${err.error}`);
          this.doiItems.set([]);
          if (!previouslySelected) {
            this.datasetId.set(undefined);
          }
          this.subscriptions.delete(httpSubscription);
          httpSubscription?.unsubscribe();
        },
      });
    this.subscriptions.add(httpSubscription!);
  }

  onDatasetSearch(searchTerm: string | null) {
    if (searchTerm === null || searchTerm.length < 3) {
      this.doiItems.set([
        {
          label: 'start typing to search (at least three letters)',
          value: 'start',
        },
      ]);
      return;
    }
    this.doiItems.set([
      { label: `searching "${searchTerm}"...`, value: searchTerm },
    ]);
    this.datasetSearchSubject.next(searchTerm);
  }

  async datasetSearch(searchTerm: string): Promise<SelectItem<string>[]> {
    return await firstValueFrom(
      this.dvObjectLookupService.getItems(
        '',
        'Dataset',
        searchTerm,
        this.dataverseToken(),
      ),
    );
  }

  private ensureSelectedDatasetOption(pid: string, label?: string): void {
    if (!pid) {
      return;
    }
    const currentItems = this.doiItems();
    const existingIndex = currentItems.findIndex((item) => item.value === pid);
    const resolvedLabel =
      label ?? (existingIndex >= 0 ? currentItems[existingIndex].label : pid);
    const option: SelectItem<string> = {
      label: resolvedLabel ?? pid,
      value: pid,
    };

    if (existingIndex === -1) {
      this.doiItems.set([option, ...currentItems]);
      return;
    }

    if (resolvedLabel && currentItems[existingIndex].label !== resolvedLabel) {
      const updated = [...currentItems];
      updated[existingIndex] = {
        ...updated[existingIndex],
        label: resolvedLabel,
      };
      this.doiItems.set(updated);
    }
  }

  private async populateDatasetOption(pid: string): Promise<void> {
    if (!pid) {
      return;
    }

    this.ensureSelectedDatasetOption(pid);

    try {
      const items = await firstValueFrom(
        this.dvObjectLookupService.getItems(
          '',
          'Dataset',
          pid,
          this.dataverseToken(),
        ),
      );
      const match = items.find(
        (item: SelectItem<string>) => item.value === pid,
      );
      if (match) {
        this.ensureSelectedDatasetOption(pid, match.label);
      }
    } catch {
      // Ignore lookup failure; selected ID is already prefilled.
    }
  }

  onDatasetChange() {
    this.loading.set(true);
    this.output.set('');
    this.outputDisabled.set(true);
    this.resetOutputState();
    this.selectedFiles.set(new Set<string>());
    this.totalSelectableFiles.set(0);
    this.activeTab.set('files');

    // First, try to load cached output
    this.loadCachedOutput();

    const currentDatasetId = this.datasetId();
    let subscription: Subscription;
    // eslint-disable-next-line prefer-const -- split declaration needed to avoid TDZ with synchronous subscribe
    subscription = this.dataService
      .getDdiCdiCompatibleFiles(currentDatasetId!, this.dataverseToken())
      .subscribe({
        next: (data) => {
          this.subscriptions.delete(subscription);
          subscription?.unsubscribe();
          this.setData(data);
        },
        error: (err) => {
          this.subscriptions.delete(subscription);
          subscription?.unsubscribe();
          this.notificationService.showError(
            `Getting files failed: ${err.error}`,
          );
        },
      });
    this.subscriptions.add(subscription);
  }

  setData(data: CompareResult): void {
    this.data.set(data);
    if (!data.data || data.data.length === 0) {
      this.loading.set(false);
      // Show message if no compatible files found
      this.notificationService.showInfo(
        'No compatible files found in this dataset. Only files with supported extensions (csv, tsv, tab, sps, sas, dct) can be processed for DDI-CDI generation.',
      );
      return;
    }
    const rowDataMap = this.utils.mapDatafiles(data.data);
    rowDataMap.forEach((v) => this.utils.addChild(v, rowDataMap));
    const rootNode = rowDataMap.get('');
    this.rowNodeMap.set(rowDataMap);
    if (rootNode?.children) {
      this.rootNodeChildren.set(rootNode.children);
    }
    this.totalSelectableFiles.set(
      this.countSelectableFiles(this.rootNodeChildren()),
    );

    // Auto-select all files (backend has already filtered to supported types)
    this.rootNodeChildren().forEach((node) => {
      this.autoSelectAllFiles(node);
    });

    this.loading.set(false);
  }

  autoSelectAllFiles(node: TreeNode<Datafile>): void {
    const filename = node.data?.name;
    if (filename) {
      this.selectedFiles.update((files) => {
        const newFiles = new Set(files);
        newFiles.add(filename);
        return newFiles;
      });
    }
    if (node.children) {
      node.children.forEach((child) => this.autoSelectAllFiles(child));
    }
  }

  private countSelectableFiles(nodes: TreeNode<Datafile>[]): number {
    return nodes.reduce((acc, node) => {
      const own = node.data?.name ? 1 : 0;
      const children = node.children
        ? this.countSelectableFiles(node.children)
        : 0;
      return acc + own + children;
    }, 0);
  }

  toggleSelectAll(): void {
    if (this.allFilesSelected()) {
      this.selectedFiles.set(new Set<string>());
      return;
    }
    this.selectedFiles.set(new Set<string>());
    this.rootNodeChildren().forEach((node) => this.autoSelectAllFiles(node));
  }

  isFileSelected(filename: string): boolean {
    return this.selectedFiles().has(filename);
  }

  toggleFileSelection(filename: string): void {
    this.selectedFiles.update((files) => {
      const newFiles = new Set(files);
      if (newFiles.has(filename)) {
        newFiles.delete(filename);
      } else {
        newFiles.add(filename);
      }
      return newFiles;
    });
  }

  getFileStyle(filename: string): string {
    const isSelected = this.isFileSelected(filename);
    const style = isSelected
      ? getFileActionStyle('SELECTED')
      : getFileActionStyle('IGNORE');
    return buildInlineStyle(style);
  }

  submitGenerate(): void {
    if (this.selectedFiles().size === 0) {
      this.notificationService.showError('Please select at least one file');
      return;
    }
    // Show async popup
    this.submitPopup.set(true);
  }

  continueSubmitGenerate(): void {
    this.submitPopup.set(false);
    this.activeTab.set('console');
    const currentSendEmail = this.sendEmailOnSuccess();
    this.req = {
      persistentId: this.datasetId()!,
      dataverseKey: this.dataverseToken(),
      queue: '',
      fileNames: Array.from(this.selectedFiles()),
      sendEmailOnSuccess: currentSendEmail,
    };
    this.loading.set(true);
    this.resetOutputState();
    const emailMsg = currentSendEmail
      ? 'You will receive an email when it completes.'
      : 'You will receive an email if it fails.';
    this.output.set(
      `DDI-CDI generation started...\n${emailMsg}\nYou can close this window.`,
    );
    let generateSubscription: Subscription;
    // eslint-disable-next-line prefer-const -- split declaration needed to avoid TDZ with synchronous subscribe
    generateSubscription = this.dataService
      .generateDdiCdi(this.req!)
      .subscribe({
        next: (key: Key) => {
          this.subscriptions.delete(generateSubscription);
          generateSubscription?.unsubscribe();
          const successMsg = currentSendEmail
            ? 'DDI-CDI generation job submitted. You will be notified by email when complete.'
            : 'DDI-CDI generation job submitted.';
          this.notificationService.showSuccess(successMsg);
          this.getDdiCdiData(key);
        },
        error: (err) => {
          this.subscriptions.delete(generateSubscription);
          generateSubscription?.unsubscribe();
          this.notificationService.showError(`Generation failed: ${err.error}`);
          this.loading.set(false);
        },
      });
    this.subscriptions.add(generateSubscription);
  }

  private getDdiCdiData(key: Key): void {
    let subscription: Subscription;
    // eslint-disable-next-line prefer-const -- split declaration needed to avoid TDZ with synchronous subscribe
    subscription = this.dataService.getCachedDdiCdiData(key).subscribe({
      next: async (res: CachedComputeResponse) => {
        this.subscriptions.delete(subscription);
        subscription?.unsubscribe();
        if (res.ready === true) {
          this.loading.set(false);
          if (res.res) {
            this.output.set(res.res);
          }
          if (res.ddiCdi) {
            this.setGeneratedOutput(res.ddiCdi);
          }
          if (res.err && res.err !== '') {
            this.notificationService.showError(res.err);
          } else {
            this.outputDisabled.set(false);
            if (this.generatedDdiCdi()) {
              this.notificationService.showSuccess(
                'DDI-CDI generated successfully!',
              );
            }
          }
        } else {
          if (res.res) {
            this.output.set(res.res);
          }
          await this.utils.sleep(1000);
          this.getDdiCdiData(key);
        }
      },
      error: (err) => {
        this.subscriptions.delete(subscription);
        subscription?.unsubscribe();
        this.loading.set(false);
        this.notificationService.showError(
          `Getting DDI-CDI results failed: ${err.error}`,
        );
      },
    });
    this.subscriptions.add(subscription!);
  }

  private resetOutputState(): void {
    this.generatedDdiCdi.set(undefined);
    this.originalDdiCdi = undefined;
  }

  private setGeneratedOutput(jsonld: string): void {
    this.resetOutputState();
    this.originalDdiCdi = jsonld;
    this.generatedDdiCdi.set(jsonld);
  }

  /**
   * Download the generated DDI-CDI as a file
   */
  downloadDdiCdi(): void {
    const currentDdiCdi = this.generatedDdiCdi();
    if (!currentDdiCdi) {
      return;
    }

    const blob = new Blob([currentDdiCdi], {
      type: 'application/ld+json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ddi-cdi-${Date.now()}.jsonld`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * Open the CDI Viewer in a new window with the generated data.
   * First adds the file to the dataset via backend, then opens the viewer
   * with standard Dataverse file parameters.
   */
  openInViewer(): void {
    const currentDdiCdi = this.generatedDdiCdi();
    const currentDatasetId = this.datasetId();
    if (!currentDdiCdi || !currentDatasetId) {
      return;
    }

    const fileName = 'ddi-cdi-metadata.jsonld';
    const baseUrl = this.externalURL();

    if (!baseUrl) {
      this.notificationService.showError('Dataverse URL not configured');
      return;
    }

    // Add the file to the dataset via backend (handles auth and MIME type)
    let viewerSubscription: Subscription;
    // eslint-disable-next-line prefer-const -- split declaration needed to avoid TDZ with synchronous subscribe
    viewerSubscription = this.dataService
      .addFileToDataset({
        persistentId: currentDatasetId,
        dataverseKey: this.dataverseToken(),
        fileName: fileName,
        content: currentDdiCdi,
      })
      .subscribe({
        next: (response) => {
          this.subscriptions.delete(viewerSubscription);
          viewerSubscription?.unsubscribe();
          if (response.fileId) {
            // Build the Dataverse file page URL
            // Version is always DRAFT because we just added a file to the dataset
            const filePageUrl = `${baseUrl}/file.xhtml?fileId=${response.fileId}&version=DRAFT`;

            // Open in new window
            window.open(filePageUrl, '_blank');

            this.notificationService.showSuccess(
              `File "${fileName}" added to dataset. Opening file page...`,
            );
          } else {
            this.notificationService.showError(
              'Failed to get file ID after upload',
            );
          }
        },
        error: (_err) => {
          this.subscriptions.delete(viewerSubscription);
          viewerSubscription?.unsubscribe();
          this.notificationService.showError('Failed to add file to dataset');
        },
      });
    this.subscriptions.add(viewerSubscription);
  }

  loadCachedOutput(): void {
    const currentDatasetId = this.datasetId();
    if (!currentDatasetId) {
      return;
    }

    let cacheSubscription: Subscription;
    // eslint-disable-next-line prefer-const -- split declaration needed to avoid TDZ with synchronous subscribe
    cacheSubscription = this.dataService
      .getCachedDdiCdiOutput(currentDatasetId)
      .subscribe({
        next: (cache) => {
          this.subscriptions.delete(cacheSubscription);
          cacheSubscription?.unsubscribe();
          if (cache.errorMessage) {
            this.output.set(
              `Previous generation failed:\n${cache.errorMessage}`,
            );
            this.outputDisabled.set(false);
          } else if (cache.ddiCdi) {
            this.setGeneratedOutput(cache.ddiCdi);
            if (cache.consoleOut) {
              this.output.set(cache.consoleOut);
            }
            this.cachedOutputLoaded.set(true);
            this.notificationService.showSuccess(
              `Loaded previously generated DDI-CDI metadata (${new Date(cache.timestamp).toLocaleString()})`,
            );
          }
        },
        error: () => {
          this.subscriptions.delete(cacheSubscription);
          cacheSubscription?.unsubscribe();
          // No cached output found, which is fine
          this.cachedOutputLoaded.set(false);
        },
      });
    this.subscriptions.add(cacheSubscription!);
  }

  refreshOutput(): void {
    this.loading.set(true);
    this.resetOutputState();
    this.output.set('');
    this.cachedOutputLoaded.set(false);
    this.loadCachedOutput();
    this.loading.set(false);
  }
}
