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
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { Select } from 'primeng/select';
import { TreeTableModule } from 'primeng/treetable';

// Third-party
import { AutosizeModule } from 'ngx-autosize';
import '@ulb-darmstadt/shacl-form';

// RxJS
import { debounceTime, firstValueFrom, map, Observable, Subject } from 'rxjs';

// RDF parsing utilities
import { Parser } from 'n3';

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
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
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

  // CONSTANTS
  readonly DEBOUNCE_TIME = APP_CONSTANTS.DEBOUNCE_TIME;
  private readonly RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';
  private readonly CDI_DATASET_TYPE =
    'http://www.ddialliance.org/Specification/DDI-CDI/1.0/RDF/DataSet';

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
  submitPopup = false;
  outputDisabled = true;
  selectedFiles: Set<string> = new Set<string>();
  generatedDdiCdi?: string;
  shaclFormValid = false;
  cachedOutputLoaded = false;
  sendEmailOnSuccess = false;
  shaclShapes?: string;
  shaclError?: string;
  originalDdiCdi?: string;
  private totalSelectableFiles = 0;
  private shaclChangeListener?: EventListener;
  private shaclTargetNode?: string;
  private shaclShapeSubject?: string;

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
        this.datasetId = pid;
        this.onDatasetChange();
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

    // Detach SHACL form listeners before the component is destroyed
    this.detachShaclListener();
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
    this.resetShaclState();
    this.selectedFiles.clear();
    this.totalSelectableFiles = 0;

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
    this.req = {
      persistentId: this.datasetId!,
      dataverseKey: this.dataverseToken,
      queue: 'default',
      fileNames: Array.from(this.selectedFiles),
      sendEmailOnSuccess: this.sendEmailOnSuccess,
    };
    this.loading = true;
    this.resetShaclState();
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

  private resetShaclState(): void {
    this.detachShaclListener();
    this.generatedDdiCdi = undefined;
    this.originalDdiCdi = undefined;
    this.shaclShapes = undefined;
    this.shaclError = undefined;
    this.shaclFormValid = false;
    this.shaclTargetNode = undefined;
    this.shaclShapeSubject = undefined;
  }

  private setGeneratedOutput(turtle: string): void {
    this.resetShaclState();
    this.originalDdiCdi = turtle;
    this.generatedDdiCdi = turtle;
    this.shaclShapes = this.buildShaclShapes(turtle);
    if (!this.shaclShapes) {
      this.shaclError =
        'Unable to render the SHACL editor for this output. The raw Turtle will still be uploaded.';
    } else {
      this.shaclError = undefined;
    }
    this.setupShaclForm();
  }

  private detachShaclListener(): void {
    if (this.shaclForm?.nativeElement && this.shaclChangeListener) {
      this.shaclForm.nativeElement.removeEventListener(
        'change',
        this.shaclChangeListener,
      );
    }
    this.shaclChangeListener = undefined;
  }

  private buildShaclShapes(turtle: string): string | undefined {
    this.shaclTargetNode = undefined;
    this.shaclShapeSubject = undefined;
    try {
      const parser = new Parser();
      const quads = parser.parse(turtle);
      if (!quads.length) {
        return undefined;
      }
      const datasetSubjects: string[] = [];
      let fallbackSubject: string | undefined;
      for (const quad of quads) {
        if (quad.subject.termType === 'NamedNode') {
          if (!fallbackSubject) {
            fallbackSubject = quad.subject.value;
          }
          if (
            quad.predicate.value === this.RDF_TYPE &&
            quad.object.termType === 'NamedNode' &&
            quad.object.value === this.CDI_DATASET_TYPE
          ) {
            datasetSubjects.push(quad.subject.value);
          }
        }
      }
      const targetNode = datasetSubjects[0] ?? fallbackSubject;
      if (!targetNode) {
        return undefined;
      }
      this.shaclTargetNode = targetNode;
      const shapeSubject = 'urn:ddi-cdi:DatasetShape';
      this.shaclShapeSubject = shapeSubject;
      return (
        '@prefix sh: <http://www.w3.org/ns/shacl#>.\n' +
        '@prefix xsd: <http://www.w3.org/2001/XMLSchema#>.\n' +
        '@prefix dcterms: <http://purl.org/dc/terms/>.\n' +
        '@prefix cdi: <http://www.ddialliance.org/Specification/DDI-CDI/1.0/RDF/>.\n' +
        '@prefix prov: <http://www.w3.org/ns/prov#>.\n\n' +
        `<${shapeSubject}> a sh:NodeShape;\n` +
        `   sh:targetNode <${targetNode}>;\n` +
        '   sh:targetClass cdi:DataSet;\n' +
        '   sh:property [\n' +
        '     sh:path dcterms:title;\n' +
        '     sh:name "Dataset title";\n' +
        '     sh:datatype xsd:string;\n' +
        '     sh:minCount 0;\n' +
        '   ];\n' +
        '   sh:property [\n' +
        '     sh:path cdi:hasLogicalDataSet;\n' +
        '     sh:name "Logical Data Sets";\n' +
        '     sh:nodeKind sh:BlankNodeOrIRI;\n' +
        '     sh:minCount 0;\n' +
        '   ];\n' +
        '   sh:property [\n' +
        '     sh:path cdi:hasPhysicalDataSet;\n' +
        '     sh:name "Physical Data Sets";\n' +
        '     sh:nodeKind sh:BlankNodeOrIRI;\n' +
        '     sh:minCount 0;\n' +
        '   ];\n' +
        '   sh:property [\n' +
        '     sh:path prov:wasGeneratedBy;\n' +
        '     sh:name "Provenance";\n' +
        '     sh:nodeKind sh:BlankNodeOrIRI;\n' +
        '     sh:minCount 0;\n' +
        '   ].\n'
      );
    } catch (error) {
      console.warn(
        'Failed to build SHACL shapes for generated CDI output',
        error,
      );
      this.shaclTargetNode = undefined;
      this.shaclShapeSubject = undefined;
      return undefined;
    }
  }

  private setupShaclForm(): void {
    if (this.shaclError) {
      return;
    }

    if (!this.generatedDdiCdi || !this.shaclForm?.nativeElement) {
      return;
    }

    // Wait until the form element is present before wiring listeners and data
    setTimeout(() => {
      const formElement = this.shaclForm?.nativeElement;
      if (!formElement) {
        return;
      }

      this.detachShaclListener();

      if (this.shaclShapes) {
        formElement.setAttribute('data-shapes', this.shaclShapes);
        formElement.setAttribute('data-shapes-format', 'text/turtle');
        if (this.shaclShapeSubject) {
          formElement.setAttribute(
            'data-shape-subject',
            this.shaclShapeSubject,
          );
        } else {
          formElement.removeAttribute('data-shape-subject');
        }
      } else {
        formElement.removeAttribute('data-shapes');
        formElement.removeAttribute('data-shapes-format');
        formElement.removeAttribute('data-shape-subject');
      }

      formElement.setAttribute('data-values', this.generatedDdiCdi ?? '');
      formElement.setAttribute('data-values-format', 'text/turtle');
      if (this.shaclTargetNode) {
        formElement.setAttribute('data-values-subject', this.shaclTargetNode);
      } else {
        formElement.removeAttribute('data-values-subject');
      }

      this.shaclChangeListener = (event: Event) => {
        const customEvent = event as CustomEvent;
        if (!this.shaclForm?.nativeElement) {
          return;
        }

        if (customEvent.detail?.valid) {
          try {
            const triples = this.shaclForm.nativeElement.serialize();
            if (triples) {
              this.generatedDdiCdi = triples;
            }
            this.shaclFormValid = true;
          } catch (error) {
            console.warn('Could not serialize form data', error);
            this.shaclFormValid = false;
          }
        } else {
          this.shaclFormValid = false;
        }
      };

      formElement.addEventListener('change', this.shaclChangeListener);
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
    const shaclFormElement = this.shaclForm?.nativeElement;
    const baseContent = this.shaclError
      ? (this.originalDdiCdi ?? this.generatedDdiCdi ?? '')
      : (this.generatedDdiCdi ?? this.originalDdiCdi ?? '');
    let content = baseContent;
    if (shaclFormElement && !this.shaclError) {
      try {
        const formData = shaclFormElement.serialize();
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
    this.resetShaclState();
    this.output = '';
    this.cachedOutputLoaded = false;
    this.loadCachedOutput();
    this.loading = false;
  }
}
