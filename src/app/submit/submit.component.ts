// Author: Eryk Kulikowski @ KU Leuven (2023). Apache 2.0 License

import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Location } from '@angular/common';
import { Subscription, firstValueFrom } from 'rxjs';

// Services
import { DataUpdatesService } from '../data.updates.service';
import { DataStateService } from '../data.state.service';
import { SubmitService } from '../submit.service';
import { PluginService } from '../plugin.service';
import { UtilsService } from '../utils.service';
import { CredentialsService } from '../credentials.service';
import { DataService } from '../data.service';
import { DatasetService } from '../dataset.service';
import { NotificationService } from '../shared/notification.service';

// Models
import { Datafile, Fileaction, Filestatus } from '../models/datafile';
import { StoreResult } from '../models/store-result';
import { CompareResult } from '../models/compare-result';
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
import { ButtonDirective, Button } from 'primeng/button';
import { Ripple } from 'primeng/ripple';
import { Dialog } from 'primeng/dialog';
import { Checkbox } from 'primeng/checkbox';
import { FormsModule } from '@angular/forms';
import { TreeTableModule } from 'primeng/treetable';

// Components
import { MetadatafieldComponent } from '../metadatafield/metadatafield.component';
import { SubmittedFileComponent } from '../submitted-file/submitted-file.component';

// Constants and types
import { APP_CONSTANTS } from '../shared/constants';
import { SubscriptionManager } from '../shared/types';

@Component({
  selector: 'app-submit',
  templateUrl: './submit.component.html',
  styleUrls: ['./submit.component.scss'],
  imports: [
    ButtonDirective,
    Ripple,
    Dialog,
    Checkbox,
    FormsModule,
    PrimeTemplate,
    Button,
    TreeTableModule,
    MetadatafieldComponent,
    SubmittedFileComponent,
  ],
})
export class SubmitComponent implements OnInit, OnDestroy, SubscriptionManager {
  private readonly dataStateService = inject(DataStateService);
  private readonly dataUpdatesService = inject(DataUpdatesService);
  private readonly submitService = inject(SubmitService);
  private readonly location = inject(Location);
  private readonly pluginService = inject(PluginService);
  private readonly router = inject(Router);
  private readonly utils = inject(UtilsService);
  dataService = inject(DataService);
  private readonly credentialsService = inject(CredentialsService);
  private readonly datasetService = inject(DatasetService);
  private readonly notificationService = inject(NotificationService);

  // Subscriptions for cleanup
  private readonly subscriptions = new Set<Subscription>();

  // Icon constants
  readonly icon_warning = APP_CONSTANTS.ICONS.WARNING;
  readonly icon_copy = APP_CONSTANTS.ICONS.UPDATE;
  readonly icon_update = 'pi pi-clone';
  readonly icon_delete = 'pi pi-trash';

  data: Datafile[] = []; // this is a local state of the submit component; nice-to-have as it allows to see the progress of the submitted job
  pid = '';
  datasetUrl = '';

  // local state derived from this.data:
  created: Datafile[] = [];
  updated: Datafile[] = [];
  deleted: Datafile[] = [];

  disabled = false;
  submitted = false;
  done = false;
  sendEmailOnSuccess = false;
  popup = false;
  hasAccessToCompute = false;

  metadata?: Metadata;

  root?: TreeNode<Field>;
  rootNodeChildren: TreeNode<Field>[] = [];
  rowNodeMap: Map<string, TreeNode<Field>> = new Map<string, TreeNode<Field>>();

  id = 0;

  constructor() { }

  ngOnInit(): void {
    this.loadData();
    const subscription = this.dataService
      .checkAccessToQueue(
        '',
        this.credentialsService.credentials.dataverse_token,
        '',
      )
      .subscribe({
        next: (access) => {
          subscription.unsubscribe();
          this.hasAccessToCompute = access.access;
        },
        error: () => {
          subscription.unsubscribe();
        },
      });
  }

  ngOnDestroy(): void {
    // Clean up all subscriptions
    this.subscriptions.forEach(sub => sub.unsubscribe());
    this.subscriptions.clear();
  }

  getDataSubscription(): void {
    const dataSubscription = this.dataUpdatesService
      .updateData(this.data, this.pid)
      .subscribe({
        next: async (res: CompareResult) => {
          dataSubscription?.unsubscribe();
          if (res.data !== undefined) {
            this.setData(res.data);
          }
          if (!this.hasUnfinishedDataFiles()) {
            this.done = true;
          } else {
            await this.utils.sleep(1000);
            this.getDataSubscription();
          }
        },
        error: (err) => {
          dataSubscription?.unsubscribe();
          this.notificationService.showError(`Getting status of data failed: ${err.error}`);
          this.router.navigate(['/connect']);
        },
      });
  }

  hasUnfinishedDataFiles(): boolean {
    return (
      this.created.some((d) => d.status !== Filestatus.Equal) ||
      this.updated.some((d) => d.status !== Filestatus.Equal) ||
      this.deleted.some((d) => d.status !== Filestatus.New)
    );
  }

  loadData(): void {
    const value = this.dataStateService.getCurrentValue();
    this.pid = value && value.id ? value.id : '';
    const data = value?.data;
    if (data) {
      this.setData(data);
    }
  }

  async setData(data: Datafile[]) {
    this.data = data;
    this.created = this.toCreate();
    this.updated = this.toUpdate();
    this.deleted = this.toDelete();
    this.data = [...this.created, ...this.updated, ...this.deleted];
    if (this.pid.endsWith(':New Dataset')) {
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
      this.metadata = await firstValueFrom(
        this.datasetService.getMetadata(req),
      );
      const rowDataMap = this.mapFields(this.metadata);
      rowDataMap.forEach((v) => this.addChild(v, rowDataMap));
      this.root = rowDataMap.get('');
      this.rowNodeMap = rowDataMap;
      if (this.root?.children) {
        this.rootNodeChildren = this.root.children;
      }
    }
  }

  toCreate(): Datafile[] {
    const result: Datafile[] = [];
    this.data.forEach((datafile) => {
      if (datafile.action === Fileaction.Copy) {
        result.push(datafile);
      }
    });
    return result;
  }

  toUpdate(): Datafile[] {
    const result: Datafile[] = [];
    this.data.forEach((datafile) => {
      if (datafile.action === Fileaction.Update) {
        result.push(datafile);
      }
    });
    return result;
  }

  toDelete(): Datafile[] {
    const result: Datafile[] = [];
    this.data.forEach((datafile) => {
      if (datafile.action === Fileaction.Delete) {
        if (
          datafile.attributes?.remoteHashType === undefined ||
          datafile.attributes?.remoteHashType === ''
        ) {
          // file from unknown origin, by setting the hash type to not empty value we can detect in comparison that the file got deleted
          datafile.attributes!.remoteHashType = 'unknown';
          datafile.attributes!.remoteHash = 'unknown';
        }
        result.push(datafile);
      }
    });
    return result;
  }

  submit() {
    if (this.credentialsService.credentials.plugin === 'globus') {
      this.continueSubmit();
    } else {
      this.popup = true;
    }
  }

  async continueSubmit() {
    this.popup = false;
    this.disabled = true;
    const selected: Datafile[] = [];
    this.data.forEach((datafile) => {
      const action =
        datafile.action === undefined ? Fileaction.Ignore : datafile.action;
      if (action != Fileaction.Ignore) {
        selected.push(datafile);
      }
    });
    if (selected.length === 0) {
      this.router.navigate(['/connect']);
      return;
    }

    if (this.pid.endsWith(':New Dataset')) {
      const ids = this.pid.split(':');
      const ok = await this.newDataset(ids[0]);
      if (!ok) {
        this.disabled = false;
        return;
      }
    }

    const httpSubscription = this.submitService
      .submit(selected, this.sendEmailOnSuccess)
      .subscribe({
        next: (data: StoreResult) => {
          if (data.status !== 'OK') {
            // this should not happen
            this.notificationService.showError(`Store failed, status: ${data.status}`);
            this.router.navigate(['/connect']);
          } else {
            this.getDataSubscription();
            this.submitted = true;
            this.datasetUrl = data.datasetUrl!;
          }
          httpSubscription.unsubscribe();
        },
        error: (err) => {
          this.notificationService.showError(`Store failed: ${err.error}`);
          this.router.navigate(['/connect']);
        },
      });
  }

  back(): void {
    this.location.back();
  }

  goToDataset() {
    window.open(this.datasetUrl, '_blank');
  }

  goToCompute() {
    this.router.navigate(['/compute'], { queryParams: { pid: this.pid } });
  }

  sendMails(): boolean {
    return this.pluginService.sendMails();
  }

  async newDataset(collectionId: string): Promise<boolean> {
    const metadata = this.filteredMetadata();
    const data = await firstValueFrom(
      this.datasetService.newDataset(
        collectionId,
        this.credentialsService.credentials.dataverse_token,
        metadata,
      ),
    );
    if (data.persistentId !== undefined && data.persistentId !== '') {
      this.pid = data.persistentId;
      this.credentialsService.credentials.dataset_id = data.persistentId;
      return true;
    } else {
      this.notificationService.showError('Creating new dataset failed');
      return false;
    }
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
    if (v.data?.id == '') {
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
