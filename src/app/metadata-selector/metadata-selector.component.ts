// Author: Eryk Kulikowski @ KU Leuven (2023). Apache 2.0 License

import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';

// Services
import { CredentialsService } from '../credentials.service';
import { DataStateService } from '../data.state.service';
import { DatasetService } from '../dataset.service';

// Models
import {
  Field,
  Fieldaction,
  FieldDictonary,
  Metadata,
  MetadataField,
} from '../models/field';
import { MetadataRequest } from '../models/metadata-request';

// PrimeNG
import { PrimeTemplate, TreeNode } from 'primeng/api';
import { ButtonDirective } from 'primeng/button';
import { TreeTableModule } from 'primeng/treetable';

// Components
import { MetadatafieldComponent } from '../metadatafield/metadatafield.component';

// Constants and types
import { APP_CONSTANTS } from '../shared/constants';
import { SnapshotStorageService } from '../shared/snapshot-storage.service';

@Component({
  selector: 'app-metadata-selector',
  templateUrl: './metadata-selector.component.html',
  styleUrls: ['./metadata-selector.component.scss'],
  imports: [
    CommonModule,
    ButtonDirective,
    PrimeTemplate,
    TreeTableModule,
    MetadatafieldComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MetadataSelectorComponent {
  private readonly dataStateService = inject(DataStateService);
  private readonly router = inject(Router);
  private readonly credentialsService = inject(CredentialsService);
  private readonly datasetService = inject(DatasetService);
  private readonly snapshotStorage = inject(SnapshotStorageService);

  // Icon constants
  readonly icon_copy = APP_CONSTANTS.ICONS.UPDATE;

  // Signal State
  readonly metadata = signal<Metadata | undefined>(undefined);
  readonly root = signal<TreeNode<Field> | undefined>(undefined);
  readonly rowNodeMap = signal<Map<string, TreeNode<Field>>>(new Map());
  readonly treeTableColumnCount = signal(4);

  // Used to trigger view updates when row actions are mutated
  readonly refreshTrigger = signal(0);

  // Computed
  readonly rootNodeChildren = computed(() => this.root()?.children ?? []);
  readonly action = computed(() => {
    // Read refreshTrigger to re-evaluate when row actions change
    this.refreshTrigger();
    const r = this.root();
    if (r) {
      return MetadatafieldComponent.actionIconFromNode(r);
    }
    return MetadatafieldComponent.icon_ignore;
  });

  constructor() {
    this.loadData();

    // Effect to build the tree when metadata changes
    // Note: Using effect() here because root/rowNodeMap need to be mutable WritableSignals
    // for toggleAction() to work (it mutates tree nodes in place)
    effect(() => {
      const m = this.metadata();
      if (m) {
        const rowDataMap = this.mapFields(m);
        rowDataMap.forEach((v) => this.addChild(v, rowDataMap));
        this.root.set(rowDataMap.get(''));
        this.rowNodeMap.set(rowDataMap);
      }
    });
  }

  loadData() {
    const credentials = this.credentialsService.credentials$();
    const req: MetadataRequest = {
      pluginId: credentials.pluginId,
      plugin: credentials.plugin,
      repoName: credentials.repo_name,
      url: credentials.url,
      option: credentials.option,
      user: credentials.user,
      token: credentials.token,
      dvToken: credentials.dataverse_token,
      compareResult: this.dataStateService.state$(),
    };
    this.datasetService.getMetadata(req).subscribe({
      next: (metadata) => this.metadata.set(metadata),
      error: (err) => console.error('Failed to load metadata', err),
    });
  }

  submit() {
    const metadata = this.filteredMetadata();
    this.router.navigate(['/submit'], { state: { metadata } });
  }

  back(): void {
    const value = this.dataStateService.state$();
    const datasetId = value?.id;
    if (datasetId) {
      this.snapshotStorage.mergeConnect({ dataset_id: datasetId });
    }
    this.router.navigate(['/compare', datasetId], {
      state: { preserveCompare: true },
    });
  }

  toggleAction(): void {
    const r = this.root();
    if (r) {
      MetadatafieldComponent.toggleNodeAction(r);
      // Trigger update by setting a new reference (shallow copy or recreate)
      // Since TreeNode is mutable and we mutated it in place, strict signal equality might skip update if we set same ref.
      // We pass a new object wrapping the data to force signal update if needed, or rely on internal mutation handling?
      // Signals are strict equality by default.
      // Force update by setting a shallow copy of the root node or triggering a version signal.
      // Note: PrimeNG TreeTable might rely on object identity.
      // We trigger the signal to notify consumers (like `action` computed).
      this.root.update((current) => (current ? { ...current } : undefined));
    }
    this.refreshTrigger.update((n) => n + 1);
  }

  /** Called by child rows when their action changes */
  onRowActionChanged(): void {
    this.refreshTrigger.update((n) => n + 1);
  }

  private addChild(
    v: TreeNode<Field>,
    rowDataMap: Map<string, TreeNode<Field>>,
  ): void {
    if (v.data?.id === '') {
      return;
    }
    const parent = rowDataMap.get(v.data!.parent!)!;
    const children = parent.children ? parent.children : [];
    parent.children = children.concat(v);
  }

  private mapFields(metadata: Metadata): Map<string, TreeNode<Field>> {
    let nodeIdCounter = 0; // Local counter to replace class property
    const rootData: Field = {
      id: '',
      parent: '',
      name: '',
      action: Fieldaction.Copy,
    };

    const rowDataMap: Map<string, TreeNode<Field>> = new Map<
      string,
      TreeNode<Field>
    >();
    rowDataMap.set('', {
      data: rootData,
    });

    const addToDataMap = (
      d: MetadataField,
      parent: string,
      map: Map<string, TreeNode<Field>>,
    ) => {
      // Local register helper closing over parent and d.typeName
      const localRegister = (
        fieldRef: MetadataField | FieldDictonary,
        parentId: string,
        leafValue?: unknown,
        assignOriginal = false,
      ) => {
        const nodeId = `${nodeIdCounter++}`;
        if (assignOriginal) {
          (fieldRef as MetadataField).id = nodeId;
        }
        const data: Field = {
          id: nodeId,
          parent: parentId,
          name: d.typeName, // Use d.typeName like the original code
          action: Fieldaction.Copy,
          leafValue: typeof leafValue === 'string' ? leafValue : undefined,
          field: fieldRef,
        };
        map.set(nodeId, { data });
        return nodeId;
      };

      if (d.value && Array.isArray(d.value) && d.value.length > 0) {
        if (typeof d.value[0] === 'string') {
          // Flat string array
          localRegister(d, parent, (d.value as string[]).join(', '), true);
        } else {
          // Array of dictionaries -> each dictionary becomes a node and is recursed
          // (same structure as original: dictionary nodes are direct children of parent)
          (d.value as FieldDictonary[]).forEach((v) => {
            const nid = localRegister(v, parent, undefined, false);
            mapChildField(nid, v, map);
          });
        }
        return;
      }
      // Primitive or single value
      localRegister(d, parent, d.value, true);
    };

    const mapChildField = (
      parent: string,
      fieldDictonary: FieldDictonary,
      map: Map<string, TreeNode<Field>>,
    ) => {
      Object.values(fieldDictonary).forEach((d) => {
        addToDataMap(d, parent, map);
      });
    };

    // Start mapping
    metadata.datasetVersion.metadataBlocks.citation.fields.forEach((d) => {
      addToDataMap(d, '', rowDataMap);
    });

    return rowDataMap;
  }

  private filteredMetadata(): Metadata | undefined {
    const m = this.metadata();
    const children = this.rootNodeChildren();
    const map = this.rowNodeMap();

    if (!m || !children || children.length === 0) {
      return undefined;
    }
    let res: MetadataField[] = [];
    m.datasetVersion.metadataBlocks.citation.fields.forEach((f) => {
      if (map.get(f.id!)?.data?.action === Fieldaction.Copy) {
        const field: MetadataField = {
          expandedvalue: f.expandedvalue,
          multiple: f.multiple,
          typeClass: f.typeClass,
          typeName: f.typeName,
          value: f.value,
        };
        res = res.concat(field);
      } else if (
        f.value &&
        Array.isArray(f.value) &&
        f.value.length > 0 &&
        typeof f.value[0] !== 'string'
      ) {
        const dicts = this.customValue(f.value as FieldDictonary[]);
        if (dicts.length > 0) {
          const field: MetadataField = {
            expandedvalue: f.expandedvalue,
            multiple: f.multiple,
            typeClass: f.typeClass,
            typeName: f.typeName,
            value: dicts,
          };
          res = res.concat(field);
        }
      }
    });
    return {
      datasetVersion: {
        metadataBlocks: {
          citation: {
            displayName: m.datasetVersion.metadataBlocks.citation.displayName,
            fields: res,
            name: m.datasetVersion.metadataBlocks.citation.name,
          },
        },
      },
    };
  }

  private customValue(metadataFields: FieldDictonary[]): FieldDictonary[] {
    let res: FieldDictonary[] = [];
    const map = this.rowNodeMap();
    metadataFields.forEach((d) => {
      const dict: FieldDictonary = {};
      Object.keys(d).forEach((k) => {
        const f = d[k];
        if (map.get(f.id!)?.data?.action === Fieldaction.Copy) {
          const field: MetadataField = {
            expandedvalue: f.expandedvalue,
            multiple: f.multiple,
            typeClass: f.typeClass,
            typeName: f.typeName,
            value: f.value,
          };
          dict[k] = field;
        } else if (
          f.value &&
          Array.isArray(f.value) &&
          f.value.length > 0 &&
          typeof f.value[0] !== 'string'
        ) {
          const dicts = this.customValue(f.value as FieldDictonary[]);
          if (dicts.length > 0) {
            const field: MetadataField = {
              expandedvalue: f.expandedvalue,
              multiple: f.multiple,
              typeClass: f.typeClass,
              typeName: f.typeName,
              value: this.customValue(f.value as FieldDictonary[]),
            };
            dict[k] = field;
          }
        }
      });
      if (Object.keys(dict).length > 0) {
        res = res.concat(dict);
      }
    });
    return res;
  }
}
