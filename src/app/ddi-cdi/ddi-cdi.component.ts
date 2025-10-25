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
import { Parser, Quad, Writer } from 'n3';

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
  shaclTargetNode?: string;
  shaclShapeSubject?: string;
  private shaclTemplate?: string;
  private readonly shaclTemplatePlaceholder = '__TARGET_NODE__';
  private readonly SHACL_NODE_SHAPE = 'http://www.w3.org/ns/shacl#NodeShape';
  private readonly fallbackShaclTemplate = `@prefix sh: <http://www.w3.org/ns/shacl#>.
@prefix xsd: <http://www.w3.org/2001/XMLSchema#>.
@prefix dcterms: <http://purl.org/dc/terms/>.
@prefix cdi: <http://www.ddialliance.org/Specification/DDI-CDI/1.0/RDF/>.
@prefix prov: <http://www.w3.org/ns/prov#>.
@prefix skos: <http://www.w3.org/2004/02/skos/core#>.

<urn:ddi-cdi:DatasetShape> a sh:NodeShape;
   sh:targetNode __TARGET_NODE__;
  sh:targetClass cdi:DataSet;
   sh:class cdi:DataSet;
   sh:property [
     sh:path dcterms:identifier;
     sh:name "Dataset identifier";
     sh:datatype xsd:string;
     sh:minCount 1;
     sh:minLength 1;
     sh:maxCount 1;
   ];
   sh:property [
     sh:path dcterms:title;
     sh:name "Dataset title";
     sh:datatype xsd:string;
     sh:minCount 0;
     sh:minLength 1;
   ];
   sh:property [
     sh:path cdi:hasLogicalDataSet;
     sh:name "Logical data sets";
     sh:minCount 1;
     sh:nodeKind sh:BlankNodeOrIRI;
     sh:class cdi:LogicalDataSet;
     sh:node <urn:ddi-cdi:LogicalDataSetShape>;
   ];
   sh:property [
     sh:path cdi:hasPhysicalDataSet;
     sh:name "Physical data sets";
     sh:minCount 1;
     sh:nodeKind sh:BlankNodeOrIRI;
     sh:node <urn:ddi-cdi:PhysicalDataSetShape>;
   ];
   sh:property [
     sh:path prov:wasGeneratedBy;
     sh:name "Generation process";
     sh:minCount 1;
     sh:nodeKind sh:BlankNodeOrIRI;
     sh:node <urn:ddi-cdi:ProcessStepShape>;
   ].

<urn:ddi-cdi:PhysicalDataSetShape> a sh:NodeShape;
   sh:targetClass cdi:PhysicalDataSet;
   sh:property [
     sh:path dcterms:format;
     sh:name "File format";
     sh:datatype xsd:string;
     sh:minCount 1;
     sh:minLength 1;
     sh:maxCount 1;
   ];
   sh:property [
     sh:path dcterms:identifier;
     sh:name "File access URI";
     sh:nodeKind sh:IRI;
     sh:minCount 0;
     sh:maxCount 1;
   ];
   sh:property [
     sh:path dcterms:provenance;
     sh:name "File checksum";
     sh:datatype xsd:string;
     sh:pattern "^md5:[0-9a-f]{32}$";
     sh:minCount 0;
     sh:maxCount 1;
   ];
   sh:property [
     sh:path dcterms:source;
     sh:name "Source DDI";
     sh:nodeKind sh:Literal;
     sh:minCount 0;
   ].

<urn:ddi-cdi:LogicalDataSetShape> a sh:NodeShape;
   sh:targetClass cdi:LogicalDataSet;
   sh:property [
     sh:path cdi:containsVariable;
     sh:name "Variables";
     sh:minCount 1;
     sh:nodeKind sh:IRI;
     sh:class cdi:Variable;
     sh:node <urn:ddi-cdi:VariableShape>;
   ].

<urn:ddi-cdi:VariableShape> a sh:NodeShape;
   sh:targetClass cdi:Variable;
   sh:property [
     sh:path skos:prefLabel;
     sh:name "Primary label";
     sh:datatype xsd:string;
     sh:minCount 1;
     sh:minLength 1;
     sh:maxCount 1;
   ];
   sh:property [
     sh:path skos:altLabel;
     sh:name "Alternative label";
     sh:datatype xsd:string;
     sh:minCount 0;
     sh:minLength 1;
     sh:maxCount 1;
   ];
   sh:property [
     sh:path dcterms:identifier;
     sh:name "Variable identifier";
     sh:datatype xsd:string;
     sh:minCount 1;
     sh:minLength 1;
     sh:maxCount 1;
   ];
   sh:property [
     sh:path cdi:hasRepresentation;
     sh:name "Variable datatype";
     sh:minCount 1;
     sh:maxCount 1;
     sh:nodeKind sh:IRI;
     sh:in (
       xsd:boolean
       xsd:dateTime
       xsd:decimal
       xsd:integer
       xsd:string
     );
   ];
   sh:property [
     sh:path cdi:hasRole;
     sh:name "Variable role";
     sh:minCount 1;
     sh:maxCount 1;
     sh:nodeKind sh:IRI;
     sh:node <urn:ddi-cdi:RoleShape>;
   ];
   sh:property [
     sh:path skos:note;
     sh:name "Variable note";
     sh:datatype xsd:string;
     sh:minCount 0;
     sh:minLength 1;
   ].

<urn:ddi-cdi:RoleShape> a sh:NodeShape;
   sh:targetClass cdi:Role;
   sh:property [
     sh:path skos:prefLabel;
     sh:name "Role label";
     sh:datatype xsd:string;
     sh:minCount 1;
     sh:minLength 1;
     sh:maxCount 1;
     sh:in (
       "identifier"
       "measure"
       "dimension"
       "attribute"
     );
   ].

<urn:ddi-cdi:ProcessStepShape> a sh:NodeShape;
   sh:targetClass cdi:ProcessStep;
   sh:property [
     sh:path dcterms:description;
     sh:name "Generation description";
     sh:datatype xsd:string;
     sh:minCount 1;
     sh:minLength 1;
     sh:maxCount 1;
   ].
`;

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
    await this.loadShaclTemplate();
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

      type SubjectSelection = {
        shapesNode: string;
        attributeValue?: string;
      };

      const toSubjectSelection = (subject: {
        termType: string;
        value: string;
      }): SubjectSelection | undefined => {
        if (subject.termType === 'NamedNode') {
          return {
            shapesNode: `<${subject.value}>`,
            attributeValue: subject.value,
          };
        }
        if (subject.termType === 'BlankNode') {
          return {
            shapesNode: `_:${subject.value}`,
          };
        }
        return undefined;
      };

      const datasetSubjects: SubjectSelection[] = [];
      let fallbackSubject: SubjectSelection | undefined;

      for (const quad of quads) {
        const selection = toSubjectSelection(quad.subject);
        if (!selection) {
          continue;
        }
        if (!fallbackSubject) {
          fallbackSubject = selection;
        }
        if (
          quad.predicate.value === this.RDF_TYPE &&
          quad.object.termType === 'NamedNode' &&
          quad.object.value === this.CDI_DATASET_TYPE
        ) {
          datasetSubjects.push(selection);
        }
      }

      const targetSelection = datasetSubjects[0] ?? fallbackSubject;
      if (!targetSelection) {
        return undefined;
      }

      this.shaclTargetNode = targetSelection.attributeValue;
      const template = this.getShaclTemplateContent();
      const substituted = template
        .split(this.shaclTemplatePlaceholder)
        .join(targetSelection.shapesNode);

      try {
        const shapesParser = new Parser();
        const shapeQuads = shapesParser.parse(substituted);
        const nodeShapeQuad = shapeQuads.find(
          (quad) =>
            quad.predicate.value === this.RDF_TYPE &&
            quad.object.termType === 'NamedNode' &&
            quad.object.value === this.SHACL_NODE_SHAPE,
        );
        if (nodeShapeQuad) {
          const subjectSelection = toSubjectSelection(nodeShapeQuad.subject);
          this.shaclShapeSubject =
            subjectSelection?.attributeValue ?? undefined;
        } else {
          this.shaclShapeSubject = undefined;
        }
      } catch (shapeError) {
        console.warn('Failed to parse SHACL template', shapeError);
        this.shaclShapeSubject = undefined;
      }

      return substituted;
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

  private async loadShaclTemplate(): Promise<void> {
    try {
      this.shaclTemplate = await firstValueFrom(
        this.dataService.getShaclTemplate(),
      );
    } catch (error) {
      console.warn('Failed to load SHACL template from backend', error);
      this.shaclTemplate = undefined;
    }
  }

  private getShaclTemplateContent(): string {
    return this.shaclTemplate ?? this.fallbackShaclTemplate;
  }

  private parseTurtleGraph(turtle: string): {
    quads: Quad[];
    prefixes: Record<string, string>;
  } {
    const parser = new Parser();
    const quads = parser.parse(turtle);
    const parserWithPrefixes = parser as Parser & {
      _prefixes?: Record<string, unknown>;
    };
    const prefixes: Record<string, string> = {};

    Object.entries(parserWithPrefixes._prefixes ?? {}).forEach(
      ([key, value]) => {
        if (key === '_') {
          return;
        }
        if (typeof value === 'string') {
          prefixes[key] = value;
        } else if (value && typeof value === 'object' && 'value' in value) {
          prefixes[key] = (value as { value: string }).value;
        }
      },
    );

    return { quads, prefixes };
  }

  private getTermKey(
    term: Quad['subject'] | Quad['predicate'] | Quad['object'] | Quad['graph'],
  ): string {
    if (term.termType === 'DefaultGraph') {
      return 'DefaultGraph:';
    }
    return `${term.termType}:${term.value}`;
  }

  private getQuadKey(quad: Quad): string {
    return [
      this.getTermKey(quad.subject),
      this.getTermKey(quad.predicate),
      this.getTermKey(quad.graph),
    ].join('|');
  }

  private mergeTurtleGraphs(baseTurtle: string, formTurtle: string): string {
    const normalizedBase = baseTurtle.trim();
    const normalizedForm = formTurtle.trim();
    if (normalizedBase === normalizedForm) {
      return baseTurtle;
    }

    let merged = formTurtle;
    try {
      const base = this.parseTurtleGraph(baseTurtle);
      const updates = this.parseTurtleGraph(formTurtle);

      if (!updates.quads.length) {
        return baseTurtle;
      }

      const updateKeys = new Set(
        updates.quads.map((quad) => this.getQuadKey(quad)),
      );
      const retainedBase = base.quads.filter(
        (quad) => !updateKeys.has(this.getQuadKey(quad)),
      );
      const combined = [...retainedBase, ...updates.quads];

      const writer = new Writer({
        prefixes: { ...base.prefixes, ...updates.prefixes },
      });
      writer.addQuads(combined);
      writer.end((error, result) => {
        if (!error && result) {
          merged = result;
        }
      });
    } catch (error) {
      console.warn(
        'Failed to merge SHACL form data with original Turtle',
        error,
      );
    }

    return merged;
  }

  private buildMergedFormContent(): string {
    const baseContent = this.generatedDdiCdi ?? this.originalDdiCdi ?? '';
    const formElement = this.shaclForm?.nativeElement;

    if (!formElement || this.shaclError) {
      return baseContent;
    }

    try {
      const serialized = formElement.serialize();
      if (!serialized) {
        return baseContent;
      }
      return this.mergeTurtleGraphs(baseContent, serialized);
    } catch (error) {
      console.warn(
        'Could not serialize SHACL form data, using base content',
        error,
      );
      return baseContent;
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
      const formElement = this.shaclForm?.nativeElement as
        | HTMLElement
        | undefined;
      if (!formElement) {
        return;
      }

      this.detachShaclListener();

      // Set SHACL shapes using both attributes and properties for maximum compatibility
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

        // Also set as properties
        const formWithProps = formElement as HTMLElement & {
          dataShapes?: string;
          dataShapesFormat?: string;
          dataShapeSubject?: string;
        };
        if (formWithProps.dataShapes !== undefined) {
          formWithProps.dataShapes = this.shaclShapes;
          formWithProps.dataShapesFormat = 'text/turtle';
          if (this.shaclShapeSubject) {
            formWithProps.dataShapeSubject = this.shaclShapeSubject;
          }
        }
      } else {
        formElement.removeAttribute('data-shapes');
        formElement.removeAttribute('data-shapes-format');
        formElement.removeAttribute('data-shape-subject');
      }

      // Set data values using both attributes and properties
      formElement.setAttribute('data-values', this.generatedDdiCdi ?? '');
      formElement.setAttribute('data-values-format', 'text/turtle');
      if (this.shaclTargetNode) {
        formElement.setAttribute('data-values-subject', this.shaclTargetNode);
      } else {
        formElement.removeAttribute('data-values-subject');
      }

      // Also set as properties
      const formWithProps = formElement as HTMLElement & {
        dataValues?: string;
        dataValuesFormat?: string;
        dataValuesSubject?: string;
      };
      if (formWithProps.dataValues !== undefined) {
        formWithProps.dataValues = this.generatedDdiCdi ?? '';
        formWithProps.dataValuesFormat = 'text/turtle';
        if (this.shaclTargetNode) {
          formWithProps.dataValuesSubject = this.shaclTargetNode;
        }
      }

      // Dispatch a load event to notify the component that data has been set
      if (typeof formElement.dispatchEvent === 'function') {
        formElement.dispatchEvent(new CustomEvent('load', { bubbles: true }));
      }

      this.shaclChangeListener = (event: Event) => {
        const customEvent = event as CustomEvent;
        if (!this.shaclForm?.nativeElement) {
          return;
        }

        if (customEvent.detail?.valid) {
          try {
            const mergedContent = this.buildMergedFormContent();
            if (mergedContent) {
              this.generatedDdiCdi = mergedContent;
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
    const content = this.buildMergedFormContent();
    this.generatedDdiCdi = content;
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
