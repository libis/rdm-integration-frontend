// Author: Eryk Kulikowski @ KU Leuven (2023). Apache 2.0 License

import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Location } from '@angular/common';
import { firstValueFrom } from 'rxjs';

// Services
import { DataStateService } from '../data.state.service';
import { CredentialsService } from '../credentials.service';
import { DatasetService } from '../dataset.service';

// Models
import { MetadataRequest } from '../models/metadata-request';
import {
  Field,
  Fieldaction,
  FieldDictonary,
  Metadata,
  MetadataField,
} from '../models/field';

// PrimeNG
import { TreeNode, PrimeTemplate } from 'primeng/api';
import { ButtonDirective } from 'primeng/button';
import { Ripple } from 'primeng/ripple';
import { TreeTableModule } from 'primeng/treetable';

// Components
import { MetadatafieldComponent } from '../metadatafield/metadatafield.component';

// Constants and types
import { APP_CONSTANTS } from '../shared/constants';

@Component({
  selector: 'app-metadata-selector',
  templateUrl: './metadata-selector.component.html',
  styleUrls: ['./metadata-selector.component.scss'],
  imports: [
    ButtonDirective,
    Ripple,
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

  // Icon constants
  readonly icon_copy = APP_CONSTANTS.ICONS.UPDATE;

  metadata?: Metadata;

  root?: TreeNode<Field>;
  rootNodeChildren: TreeNode<Field>[] = [];
  rowNodeMap: Map<string, TreeNode<Field>> = new Map<string, TreeNode<Field>>();

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
    this.location.back();
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
      case Fieldaction.Ignore:
        return '';
      case Fieldaction.Copy:
        return 'background-color: #c3e6cb; color: black';
      case Fieldaction.Custom:
        return 'background-color: #FFFAA0; color: black';
    }
    return '';
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
    if (
      d.value &&
      Array.isArray(d.value) &&
      d.value.length > 0 &&
      typeof d.value[0] === 'string'
    ) {
      let content = d.value[0];
      for (let i = 1; i < d.value.length; i++) {
        content = `${content}, ${d.value[i]}`;
      }
      const id = `${this.id++}`;
      d.id = id;
      const data: Field = {
        id: id,
        parent: parent,
        name: d.typeName,
        action: Fieldaction.Copy,
        leafValue: content,
        field: d,
      };
      rowDataMap.set(id, {
        data: data,
      });
    } else if (d.value && typeof d.value !== 'string') {
      (d.value as FieldDictonary[]).forEach((v) => {
        const id = `${this.id++}`;
        const data: Field = {
          id: id,
          parent: parent,
          name: d.typeName,
          action: Fieldaction.Copy,
          field: v,
        };
        rowDataMap.set(id, {
          data: data,
        });
        this.mapChildField(id, v, rowDataMap);
      });
    } else {
      const id = `${this.id++}`;
      d.id = id;
      const data: Field = {
        id: id,
        parent: parent,
        name: d.typeName,
        action: Fieldaction.Copy,
        leafValue: d.value,
        field: d,
      };
      rowDataMap.set(id, {
        data: data,
      });
    }
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
      if (this.rowNodeMap.get(f.id!)?.data?.action == Fieldaction.Copy) {
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
        if (this.rowNodeMap.get(f.id!)?.data?.action == Fieldaction.Copy) {
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
