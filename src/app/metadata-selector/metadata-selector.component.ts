// Author: Eryk Kulikowski @ KU Leuven (2023). Apache 2.0 License

import { Location } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

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
import { APP_CONSTANTS, getFileActionClass } from '../shared/constants';
import { SnapshotStorageService } from '../shared/snapshot-storage.service';

@Component({
  selector: 'app-metadata-selector',
  templateUrl: './metadata-selector.component.html',
  styleUrls: ['./metadata-selector.component.scss'],
  imports: [
    ButtonDirective,
    PrimeTemplate,
    TreeTableModule,
    MetadatafieldComponent,
  ],
})
export class MetadataSelectorComponent implements OnInit {
  private readonly dataStateService = inject(DataStateService);
  private readonly location = inject(Location);
  private readonly router = inject(Router);
  private readonly credentialsService = inject(CredentialsService);
  private readonly datasetService = inject(DatasetService);
  private readonly snapshotStorage = inject(SnapshotStorageService);

  // Icon constants
  readonly icon_copy = APP_CONSTANTS.ICONS.UPDATE;

  metadata?: Metadata;

  root?: TreeNode<Field>;
  rootNodeChildren: TreeNode<Field>[] = [];
  rowNodeMap: Map<string, TreeNode<Field>> = new Map<string, TreeNode<Field>>();

  treeTableColumnCount = 4;

  id = 0;

  constructor() {}

  ngOnInit(): void {
    // Load metadata immediately for rendering in the tree table
    this.loadData();
  }

  async loadData() {
    const credentials = this.credentialsService.credentials;
    const req: MetadataRequest = {
      pluginId: credentials.pluginId,
      plugin: credentials.plugin,
      repoName: credentials.repo_name,
      url: credentials.url,
      option: credentials.option,
      user: credentials.user,
      token: credentials.token,
      dvToken: credentials.dataverse_token,
      compareResult: this.dataStateService.getCurrentValue(),
    };
    this.metadata = await firstValueFrom(this.datasetService.getMetadata(req));
    const rowDataMap = this.mapFields(this.metadata);
    rowDataMap.forEach((v) => this.addChild(v, rowDataMap));
    this.root = rowDataMap.get('');
    this.rowNodeMap = rowDataMap;
    if (this.root?.children) {
      this.rootNodeChildren = this.root.children;
    }
  }

  submit() {
    const metadata = this.filteredMetadata();
    this.router.navigate(['/submit'], { state: { metadata } });
  }

  back(): void {
    const value = this.dataStateService.getCurrentValue();
    const datasetId = value?.id;
    if (datasetId) {
      this.snapshotStorage.mergeConnect({ dataset_id: datasetId });
    }
    this.router.navigate(['/compare', datasetId], {
      state: { preserveCompare: true },
    });
  }

  action(): string {
    if (this.root) {
      return MetadatafieldComponent.actionIcon(this.root);
    }
    return MetadatafieldComponent.icon_ignore;
  }

  toggleAction(): void {
    if (this.root) {
      MetadatafieldComponent.toggleNodeAction(this.root);
    }
  }

  rowClass(field: Field): string {
    switch (field.action) {
      case Fieldaction.Copy:
        return getFileActionClass('COPY');
      case Fieldaction.Custom:
        return getFileActionClass('CUSTOM');
      case Fieldaction.Ignore:
      default:
        return getFileActionClass('IGNORE');
    }
  }

  addChild(v: TreeNode<Field>, rowDataMap: Map<string, TreeNode<Field>>): void {
    if (v.data?.id === '') {
      return;
    }
    const parent = rowDataMap.get(v.data!.parent!)!;
    const children = parent.children ? parent.children : [];
    parent.children = children.concat(v);
  }

  mapFields(metadata: Metadata): Map<string, TreeNode<Field>> {
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

    metadata.datasetVersion.metadataBlocks.citation.fields.forEach((d) => {
      this.addToDataMap(d, '', rowDataMap);
    });
    return rowDataMap;
  }

  private addToDataMap(
    d: MetadataField,
    parent: string,
    rowDataMap: Map<string, TreeNode<Field>>,
  ) {
    // Helper to register a node
    const register = (
      fieldRef: MetadataField | FieldDictonary,
      leafValue?: unknown,
      assignOriginal = false,
    ) => {
      const nodeId = `${this.id++}`;
      if (assignOriginal) {
        // only assign the id on the original MetadataField (primitive / string[] / single value case)
        (d as MetadataField).id = nodeId;
      }
      const data: Field = {
        id: nodeId,
        parent,
        name: d.typeName,
        action: Fieldaction.Copy,
        leafValue: typeof leafValue === 'string' ? leafValue : undefined,
        field: fieldRef,
      };
      rowDataMap.set(nodeId, { data });
      return nodeId;
    };

    if (d.value && Array.isArray(d.value) && d.value.length > 0) {
      if (typeof d.value[0] === 'string') {
        // Flat string array
        register(d, (d.value as string[]).join(', '), true);
      } else {
        // Array of dictionaries -> each becomes a node and is recursed
        (d.value as FieldDictonary[]).forEach((v) => {
          const nid = register(v);
          this.mapChildField(nid, v, rowDataMap);
        });
      }
      return;
    }
    // Primitive or single value
    register(d, d.value, true);
  }

  mapChildField(
    parent: string,
    fieldDictonary: FieldDictonary,
    rowDataMap: Map<string, TreeNode<Field>>,
  ) {
    Object.values(fieldDictonary).forEach((d) => {
      this.addToDataMap(d, parent, rowDataMap);
    });
  }

  filteredMetadata(): Metadata | undefined {
    if (
      !this.metadata ||
      !this.rootNodeChildren ||
      this.rootNodeChildren.length === 0
    ) {
      return undefined;
    }
    let res: MetadataField[] = [];
    this.metadata.datasetVersion.metadataBlocks.citation.fields.forEach((f) => {
      if (this.rowNodeMap.get(f.id!)?.data?.action === Fieldaction.Copy) {
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
            displayName:
              this.metadata.datasetVersion.metadataBlocks.citation.displayName,
            fields: res,
            name: this.metadata.datasetVersion.metadataBlocks.citation.name,
          },
        },
      },
    };
  }

  customValue(metadataFields: FieldDictonary[]): FieldDictonary[] {
    let res: FieldDictonary[] = [];
    metadataFields.forEach((d) => {
      const dict: FieldDictonary = {};
      Object.keys(d).forEach((k) => {
        const f = d[k];
        if (this.rowNodeMap.get(f.id!)?.data?.action === Fieldaction.Copy) {
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
