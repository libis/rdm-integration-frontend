// Author: Eryk Kulikowski @ KU Leuven (2024). Apache 2.0 License

import {
  CUSTOM_ELEMENTS_SCHEMA,
  Component,
  ElementRef,
  inject,
  OnDestroy,
  OnInit,
  ViewChild,
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
  AddFileRequest,
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
import { FloatLabel } from 'primeng/floatlabel';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { Select } from 'primeng/select';
import { TreeTableModule } from 'primeng/treetable';

// Third-party
import { AutosizeModule } from 'ngx-autosize';
import '@ulb-darmstadt/shacl-form';

// RxJS
import { debounceTime, firstValueFrom, map, Observable, Subject } from 'rxjs';

// Constants and types
import { APP_CONSTANTS } from '../shared/constants';
import { SubscriptionManager } from '../shared/types';

@Component({
  selector: 'app-ddi-cdi',
  templateUrl: './ddi-cdi.component.html',
  styleUrl: './ddi-cdi.component.scss',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  imports: [
    CommonModule,
    ButtonDirective,
    FormsModule,
    FloatLabel,
    Select,
    Dialog,
    Checkbox,
    PrimeTemplate,
    Button,
    TreeTableModule,
    ProgressSpinnerModule,
    AutosizeModule,
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

  // ViewChild for SHACL form element
  @ViewChild('shaclForm', { static: false }) shaclForm?: ElementRef;

  // Icon constants
  readonly icon_generate = 'pi pi-file-export';

  // CONSTANTS
  readonly DEBOUNCE_TIME = APP_CONSTANTS.DEBOUNCE_TIME;
  readonly SUPPORTED_EXTENSIONS = ['csv', 'tsv', 'tab'];

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
  addFilePopup = false;
  outputDisabled = true;
  selectedFiles: Set<string> = new Set<string>();
  generatedDdiCdi?: string;
  shaclFormValid = false;

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
    const dvToken = localStorage.getItem('dataverseToken');
    if (dvToken !== null) {
      this.dataverseToken = dvToken;
    }
    this.route.queryParams.subscribe((params) => {
      const pid = params['datasetPid'];
      if (pid) {
        this.doiItems = [{ label: pid, value: pid }];
        this.datasetId = pid;
      }
      const apiToken = params['apiToken'];
      if (apiToken) {
        this.dataverseToken = apiToken;
      }
    });
    this.datasetSearchResultsSubscription =
      this.datasetSearchResultsObservable.subscribe({
        next: (x) =>
          x
            .then((v) => (this.doiItems = v))
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

  back(): void {
    this.navigation.assign('connect');
  }

  showDVToken(): boolean {
    return this.pluginService.showDVToken();
  }

  onUserChange() {
    this.doiItems = [];
    this.datasetId = undefined;
    if (
      this.dataverseToken !== undefined &&
      this.pluginService.isStoreDvToken()
    ) {
      localStorage.setItem('dataverseToken', this.dataverseToken!);
    }
  }

  // DV OBJECTS: COMMON

  getDoiOptions(): void {
    if (
      this.doiItems.length !== 0 &&
      this.doiItems.find((x) => x === this.loadingItem) === undefined
    ) {
      return;
    }
    this.doiItems = this.loadingItems;
    this.datasetId = undefined;

    this.dvObjectLookupService
      .getItems('', 'Dataset', undefined, this.dataverseToken)
      .subscribe({
        next: (items: SelectItem<string>[]) => {
          if (items && items.length > 0) {
            this.doiItems = items;
            this.datasetId = undefined;
          } else {
            this.doiItems = [];
            this.datasetId = undefined;
          }
        },
        error: (err) => {
          this.notificationService.showError(`DOI lookup failed: ${err.error}`);
          this.doiItems = [];
          this.datasetId = undefined;
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

  dataverseHeader(): string {
    return this.pluginService.dataverseHeader();
  }

  onDatasetChange() {
    this.loading = true;
    this.output = '';
    this.outputDisabled = true;
    this.generatedDdiCdi = undefined;
    this.selectedFiles.clear();
    this.dataService
      .getDownloadableFiles(this.datasetId!, this.dataverseToken)
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
      return;
    }
    const rowDataMap = this.utils.mapDatafiles(data.data);
    rowDataMap.forEach((v) => this.utils.addChild(v, rowDataMap));
    const rootNode = rowDataMap.get('');
    this.rowNodeMap = rowDataMap;
    if (rootNode?.children) {
      this.rootNodeChildren = rootNode.children;
    }

    // Auto-select supported files
    this.rootNodeChildren.forEach((node) => {
      this.autoSelectSupportedFiles(node);
    });

    this.loading = false;
  }

  autoSelectSupportedFiles(node: TreeNode<Datafile>): void {
    if (node.data?.name) {
      const extension = this.getFileExtension(node.data.name);
      if (this.SUPPORTED_EXTENSIONS.includes(extension)) {
        this.selectedFiles.add(node.data.name);
      }
    }
    if (node.children) {
      node.children.forEach((child) => this.autoSelectSupportedFiles(child));
    }
  }

  getFileExtension(filename: string): string {
    const parts = filename.split('.');
    return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
  }

  isFileSupported(filename: string): boolean {
    const extension = this.getFileExtension(filename);
    return this.SUPPORTED_EXTENSIONS.includes(extension);
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

  submitGenerate(): void {
    if (this.selectedFiles.size === 0) {
      this.notificationService.showError('Please select at least one file');
      return;
    }
    this.req = {
      persistentId: this.datasetId!,
      dataverseKey: this.dataverseToken,
      queue: 'default',
      fileNames: Array.from(this.selectedFiles),
      sendEmailOnSuccess: false,
    };
    this.loading = true;
    this.generatedDdiCdi = undefined;
    this.dataService.generateDdiCdi(this.req!).subscribe({
      next: (key: Key) => {
        this.getDdiCdiData(key);
      },
      error: (err) => {
        this.notificationService.showError(err);
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
            this.generatedDdiCdi = res.ddiCdi;
            this.setupShaclForm();
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

  private setupShaclForm(): void {
    // Wait for the form to be rendered in the DOM
    setTimeout(() => {
      if (this.shaclForm?.nativeElement) {
        const formElement = this.shaclForm.nativeElement;

        // Listen to form change events
        formElement.addEventListener('change', (event: CustomEvent) => {
          if (event.detail?.valid) {
            this.shaclFormValid = true;
            // Get updated data from form
            const triples = formElement.serialize();
            this.generatedDdiCdi = triples;
          } else {
            this.shaclFormValid = false;
          }
        });
      }
    }, 100);
  }

  showAddFileButton(): boolean {
    return this.generatedDdiCdi !== undefined && this.generatedDdiCdi !== '';
  }

  openAddFileDialog(): void {
    this.addFilePopup = true;
  }

  addFileToDataset(): void {
    this.addFilePopup = false;
    this.loading = true;

    // Get current data from SHACL form if available
    let content = this.generatedDdiCdi!;
    if (this.shaclForm?.nativeElement) {
      try {
        const formData = this.shaclForm.nativeElement.serialize();
        if (formData) {
          content = formData;
        }
      } catch (error) {
        console.warn(
          'Could not serialize form data, using original content',
          error,
        );
      }
    }

    const fileName = `ddi-cdi-${Date.now()}.ttl`;
    const addFileRequest: AddFileRequest = {
      persistentId: this.datasetId!,
      dataverseKey: this.dataverseToken,
      fileName: fileName,
      content: content,
    };

    this.dataService.addFileToDataset(addFileRequest).subscribe({
      next: () => {
        this.loading = false;
        this.notificationService.showSuccess(
          `File "${fileName}" added to dataset successfully!`,
        );
      },
      error: (err) => {
        this.loading = false;
        this.notificationService.showError(
          `Failed to add file to dataset: ${err.error}`,
        );
      },
    });
  }

  getSupportedExtensionsText(): string {
    return this.SUPPORTED_EXTENSIONS.join(', ');
  }
}
