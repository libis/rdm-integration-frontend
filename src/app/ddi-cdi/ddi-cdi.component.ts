// Author: Eryk Kulikowski @ KU Leuven (2024). Apache 2.0 License

import { Component, inject, OnDestroy, OnInit } from '@angular/core';
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

// CDI Viewer URL - can be configured for different environments
const CDI_VIEWER_URL = 'https://libis.github.io/cdi-viewer/';

@Component({
  selector: 'app-ddi-cdi',
  templateUrl: './ddi-cdi.component.html',
  styleUrl: './ddi-cdi.component.scss',
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
  dataService = inject(DataService);
  private readonly utils = inject(UtilsService);
  private readonly route = inject(ActivatedRoute);
  private readonly notificationService = inject(NotificationService);
  private readonly navigation = inject(NavigationService);

  // Subscriptions for cleanup
  private readonly subscriptions = new Set<Subscription>();

  // CONSTANTS
  readonly DEBOUNCE_TIME = APP_CONSTANTS.DEBOUNCE_TIME;

  // NG MODEL FIELDS
  dataverseToken?: string;
  datasetId?: string;
  output = '';
  data: CompareResult = {};
  rootNodeChildren: TreeNode<Datafile>[] = [];
  rowNodeMap: Map<string, TreeNode<Datafile>> = new Map<
    string,
    TreeNode<Datafile>
  >();
  loading = false;
  submitPopup = false;
  outputDisabled = true;
  selectedFiles: Set<string> = new Set<string>();
  generatedDdiCdi?: string;
  cachedOutputLoaded = false;
  sendEmailOnSuccess = false;
  originalDdiCdi?: string;
  activeTab: string = 'files';
  private totalSelectableFiles = 0;

  // ITEMS IN SELECTS
  loadingItem: SelectItem<string> = { label: `Loading...`, value: 'loading' };
  loadingItems: SelectItem<string>[] = [this.loadingItem];
  doiItems: SelectItem<string>[] = [];

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
        this.dataverseToken = dvToken;
      }
    }

    this.route.queryParams.subscribe((params) => {
      const apiToken = params['apiToken'];
      if (apiToken) {
        this.dataverseToken = apiToken;
      }
      const pid = params['datasetPid'] ?? params['pid'];
      if (pid) {
        void this.populateDatasetOption(pid);
        this.datasetId = pid;
        this.onDatasetChange();
      }
    });
    this.datasetSearchResultsSubscription =
      this.datasetSearchResultsObservable.subscribe({
        next: (x) =>
          x
            .then((v) => {
              this.doiItems = v;
              if (this.datasetId) {
                const match = v.find((item) => item.value === this.datasetId);
                this.ensureSelectedDatasetOption(this.datasetId, match?.label);
              }
            })
            .catch(
              (err) =>
                (this.doiItems = [
                  {
                    label: `search failed: ${err.message}`,
                    value: err.message,
                  },
                ]),
            ),
        error: (err) =>
          (this.doiItems = [
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

  showDVToken(): boolean {
    return this.pluginService.showDVToken();
  }

  onUserChange() {
    this.doiItems = [];
    this.datasetId = undefined;
    // Save dataverseToken to localStorage if storeDvToken is enabled
    if (
      this.dataverseToken !== undefined &&
      this.pluginService.isStoreDvToken()
    ) {
      localStorage.setItem('dataverseToken', this.dataverseToken);
    }
  }

  // DV OBJECTS: COMMON

  getDoiOptions(): void {
    if (
      this.doiItems.length !== 0 &&
      this.doiItems.find((x) => x === this.loadingItem) === undefined
    ) {
      if (this.datasetId) {
        this.ensureSelectedDatasetOption(this.datasetId);
      }
      return;
    }
    const previouslySelected = this.datasetId;
    this.doiItems = this.loadingItems;
    if (!previouslySelected) {
      this.datasetId = undefined;
    }

    this.dvObjectLookupService
      .getItems('', 'Dataset', undefined, this.dataverseToken)
      .subscribe({
        next: (items: SelectItem<string>[]) => {
          if (items && items.length > 0) {
            this.doiItems = items;
            if (previouslySelected) {
              const match = items.find(
                (item) => item.value === previouslySelected,
              );
              this.ensureSelectedDatasetOption(
                previouslySelected,
                match?.label,
              );
              this.datasetId = previouslySelected;
            } else {
              this.datasetId = undefined;
            }
          } else {
            this.doiItems = [];
            if (!previouslySelected) {
              this.datasetId = undefined;
            }
          }
        },
        error: (err) => {
          this.notificationService.showError(`DOI lookup failed: ${err.error}`);
          this.doiItems = [];
          if (!previouslySelected) {
            this.datasetId = undefined;
          }
        },
      });
  }

  // DATASETS
  datasetFieldEditable(): boolean {
    return this.pluginService.datasetFieldEditable();
  }

  onDatasetSearch(searchTerm: string | null) {
    if (searchTerm === null || searchTerm.length < 3) {
      this.doiItems = [
        {
          label: 'start typing to search (at least three letters)',
          value: 'start',
        },
      ];
      return;
    }
    this.doiItems = [
      { label: `searching "${searchTerm}"...`, value: searchTerm },
    ];
    this.datasetSearchSubject.next(searchTerm);
  }

  async datasetSearch(searchTerm: string): Promise<SelectItem<string>[]> {
    return await firstValueFrom(
      this.dvObjectLookupService.getItems(
        '',
        'Dataset',
        searchTerm,
        this.dataverseToken,
      ),
    );
  }

  private ensureSelectedDatasetOption(pid: string, label?: string): void {
    if (!pid) {
      return;
    }
    const existingIndex = this.doiItems.findIndex((item) => item.value === pid);
    const resolvedLabel =
      label ?? (existingIndex >= 0 ? this.doiItems[existingIndex].label : pid);
    const option: SelectItem<string> = {
      label: resolvedLabel ?? pid,
      value: pid,
    };

    if (existingIndex === -1) {
      this.doiItems = [option, ...this.doiItems];
      return;
    }

    if (resolvedLabel && this.doiItems[existingIndex].label !== resolvedLabel) {
      const updated = [...this.doiItems];
      updated[existingIndex] = {
        ...updated[existingIndex],
        label: resolvedLabel,
      };
      this.doiItems = updated;
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
          this.dataverseToken,
        ),
      );
      const match = items.find(
        (item: SelectItem<string>) => item.value === pid,
      );
      if (match) {
        this.ensureSelectedDatasetOption(pid, match.label);
      }
    } catch (error) {
      console.warn('Failed to preload dataset option', error);
    }
  }

  dataverseHeader(): string {
    return this.pluginService.dataverseHeader();
  }

  onDatasetChange() {
    this.loading = true;
    this.output = '';
    this.outputDisabled = true;
    this.resetOutputState();
    this.selectedFiles.clear();
    this.totalSelectableFiles = 0;
    this.activeTab = 'files';

    // First, try to load cached output
    this.loadCachedOutput();

    this.dataService
      .getDdiCdiCompatibleFiles(this.datasetId!, this.dataverseToken)
      .subscribe({
        next: (data) => {
          this.setData(data);
        },
        error: (err) => {
          this.notificationService.showError(
            `Getting files failed: ${err.error}`,
          );
        },
      });
  }

  setData(data: CompareResult): void {
    this.data = data;
    if (!data.data || data.data.length === 0) {
      this.loading = false;
      // Show message if no compatible files found
      this.notificationService.showInfo(
        'No compatible files found in this dataset. Only files with supported extensions (csv, tsv, tab, sps, sas, dct) can be processed for DDI-CDI generation.',
      );
      return;
    }
    const rowDataMap = this.utils.mapDatafiles(data.data);
    rowDataMap.forEach((v) => this.utils.addChild(v, rowDataMap));
    const rootNode = rowDataMap.get('');
    this.rowNodeMap = rowDataMap;
    if (rootNode?.children) {
      this.rootNodeChildren = rootNode.children;
    }
    this.totalSelectableFiles = this.countSelectableFiles(
      this.rootNodeChildren,
    );

    // Auto-select all files (backend has already filtered to supported types)
    this.rootNodeChildren.forEach((node) => {
      this.autoSelectAllFiles(node);
    });

    this.loading = false;
  }

  autoSelectAllFiles(node: TreeNode<Datafile>): void {
    if (node.data?.name) {
      this.selectedFiles.add(node.data.name);
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
      this.selectedFiles.clear();
      return;
    }
    this.selectedFiles.clear();
    this.rootNodeChildren.forEach((node) => this.autoSelectAllFiles(node));
  }

  selectAllIcon(): string {
    return this.allFilesSelected() ? 'pi pi-check-square' : 'pi pi-square';
  }

  allFilesSelected(): boolean {
    return (
      this.totalSelectableFiles > 0 &&
      this.selectedFiles.size >= this.totalSelectableFiles
    );
  }

  isFileSelected(filename: string): boolean {
    return this.selectedFiles.has(filename);
  }

  toggleFileSelection(filename: string): void {
    if (this.selectedFiles.has(filename)) {
      this.selectedFiles.delete(filename);
    } else {
      this.selectedFiles.add(filename);
    }
  }

  getFileStyle(filename: string): string {
    const isSelected = this.isFileSelected(filename);
    const style = isSelected
      ? getFileActionStyle('SELECTED')
      : getFileActionStyle('IGNORE');
    return buildInlineStyle(style);
  }

  submitGenerate(): void {
    if (this.selectedFiles.size === 0) {
      this.notificationService.showError('Please select at least one file');
      return;
    }
    // Show async popup
    this.submitPopup = true;
  }

  generateDisabled(): boolean {
    return this.loading || this.selectedFiles.size === 0 || !this.datasetId;
  }

  continueSubmitGenerate(): void {
    this.submitPopup = false;
    this.activeTab = 'console';
    this.req = {
      persistentId: this.datasetId!,
      dataverseKey: this.dataverseToken,
      queue: '',
      fileNames: Array.from(this.selectedFiles),
      sendEmailOnSuccess: this.sendEmailOnSuccess,
    };
    this.loading = true;
    this.resetOutputState();
    const emailMsg = this.sendEmailOnSuccess
      ? 'You will receive an email when it completes.'
      : 'You will receive an email if it fails.';
    this.output = `DDI-CDI generation started...\n${emailMsg}\nYou can close this window.`;
    this.dataService.generateDdiCdi(this.req!).subscribe({
      next: (key: Key) => {
        const successMsg = this.sendEmailOnSuccess
          ? 'DDI-CDI generation job submitted. You will be notified by email when complete.'
          : 'DDI-CDI generation job submitted.';
        this.notificationService.showSuccess(successMsg);
        this.getDdiCdiData(key);
      },
      error: (err) => {
        this.notificationService.showError(`Generation failed: ${err.error}`);
        this.loading = false;
      },
    });
  }

  private getDdiCdiData(key: Key): void {
    this.dataService.getCachedDdiCdiData(key).subscribe({
      next: async (res: CachedComputeResponse) => {
        if (res.ready === true) {
          this.loading = false;
          if (res.res) {
            this.output = res.res;
          }
          if (res.ddiCdi) {
            this.setGeneratedOutput(res.ddiCdi);
          }
          if (res.err && res.err !== '') {
            this.notificationService.showError(res.err);
          } else {
            this.outputDisabled = false;
            if (this.generatedDdiCdi) {
              this.notificationService.showSuccess(
                'DDI-CDI generated successfully!',
              );
            }
          }
        } else {
          if (res.res) {
            this.output = res.res;
          }
          await this.utils.sleep(1000);
          this.getDdiCdiData(key);
        }
      },
      error: (err) => {
        this.loading = false;
        this.notificationService.showError(
          `Getting DDI-CDI results failed: ${err.error}`,
        );
      },
    });
  }

  private resetOutputState(): void {
    this.generatedDdiCdi = undefined;
    this.originalDdiCdi = undefined;
  }

  private setGeneratedOutput(jsonld: string): void {
    this.resetOutputState();
    this.originalDdiCdi = jsonld;
    this.generatedDdiCdi = jsonld;
  }

  /**
   * Download the generated DDI-CDI as a file
   */
  downloadDdiCdi(): void {
    if (!this.generatedDdiCdi) {
      return;
    }

    const blob = new Blob([this.generatedDdiCdi], {
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
    if (!this.generatedDdiCdi || !this.datasetId) {
      return;
    }

    const fileName = 'ddi-cdi-metadata.jsonld';
    const baseUrl = this.pluginService.getExternalURL();

    if (!baseUrl) {
      this.notificationService.showError('Dataverse URL not configured');
      return;
    }

    // Add the file to the dataset via backend (handles auth and MIME type)
    this.dataService.addFileToDataset({
      persistentId: this.datasetId,
      dataverseKey: this.dataverseToken,
      fileName: fileName,
      content: this.generatedDdiCdi
    }).subscribe({
      next: (response) => {
        if (response.fileId) {
          // Build the viewer URL with standard Dataverse parameters
          const viewerUrl = new URL(CDI_VIEWER_URL);
          viewerUrl.searchParams.set('fileid', String(response.fileId));
          viewerUrl.searchParams.set('siteUrl', baseUrl);

          // Open in new window
          window.open(viewerUrl.toString(), '_blank');

          this.notificationService.showSuccess(
            `File "${fileName}" added to dataset. Opening viewer...`
          );
        } else {
          this.notificationService.showError('Failed to get file ID after upload');
        }
      },
      error: (err) => {
        console.error('Failed to add file to dataset:', err);
        this.notificationService.showError('Failed to add file to dataset');
      }
    });
  }

  sendMails(): boolean {
    return this.pluginService.sendMails();
  }

  loadCachedOutput(): void {
    if (!this.datasetId) {
      return;
    }

    this.dataService.getCachedDdiCdiOutput(this.datasetId).subscribe({
      next: (cache) => {
        if (cache.errorMessage) {
          this.output = `Previous generation failed:\n${cache.errorMessage}`;
          this.outputDisabled = false;
        } else if (cache.ddiCdi) {
          this.setGeneratedOutput(cache.ddiCdi);
          if (cache.consoleOut) {
            this.output = cache.consoleOut;
          }
          this.cachedOutputLoaded = true;
          this.notificationService.showSuccess(
            `Loaded previously generated DDI-CDI metadata (${new Date(cache.timestamp).toLocaleString()})`,
          );
        }
      },
      error: () => {
        // No cached output found, which is fine
        this.cachedOutputLoaded = false;
      },
    });
  }

  refreshOutput(): void {
    this.loading = true;
    this.resetOutputState();
    this.output = '';
    this.cachedOutputLoaded = false;
    this.loadCachedOutput();
    this.loading = false;
  }
}
