 
// Author: Eryk Kulikowski @ KU Leuven (2023). Apache 2.0 License

import { Component, OnInit } from '@angular/core';
import { DataUpdatesService } from '../data.updates.service';
import { DataStateService } from '../data.state.service';
import { SubmitService } from '../submit.service';
import { Datafile, Fileaction, Filestatus } from '../models/datafile';
import { Router } from '@angular/router';
import { StoreResult } from '../models/store-result';
import { CompareResult } from '../models/compare-result';
import { Location } from '@angular/common'
import { PluginService } from '../plugin.service';
import { UtilsService } from '../utils.service';
import { CredentialsService } from '../credentials.service';
import { DataService } from '../data.service';
import { DatasetService } from '../dataset.service';
import { firstValueFrom } from 'rxjs';
import { MetadataRequest } from '../models/metadata-request';
import { TreeNode } from 'primeng/api';
import { Field, Fieldaction, FieldDictonary, Metadata } from '../models/field';
import { MetadatafieldComponent } from '../metadatafield/metadatafield.component';

@Component({
  selector: 'app-submit',
  standalone: false,
  templateUrl: './submit.component.html',
  styleUrls: ['./submit.component.scss']
})
export class SubmitComponent implements OnInit {

  icon_warning = "pi pi-exclamation-triangle";
  icon_copy = "pi pi-copy";
  icon_update = "pi pi-clone";
  icon_delete = "pi pi-trash";

  data: Datafile[] = [];// this is a local state of the submit component; nice-to-have as it allows to see the progress of the submitted job
  pid = "";
  datasetUrl = "";

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

  constructor(
    private dataStateService: DataStateService,
    private dataUpdatesService: DataUpdatesService,
    private submitService: SubmitService,
    private location: Location,
    private pluginService: PluginService,
    private router: Router,
    private utils: UtilsService,
    public dataService: DataService,
    private credentialsService: CredentialsService,
    private datasetService: DatasetService,
  ) { }

  ngOnInit(): void {
    this.loadData();
    const subscription = this.dataService.checkAccessToQueue('', this.credentialsService.credentials.dataverse_token, '').subscribe({
      next: (access) => {
        subscription.unsubscribe();
        this.hasAccessToCompute = access.access;
      },
      error: () => {
        subscription.unsubscribe();
      }
    });
  }

  getDataSubscription(): void {
    const dataSubscription = this.dataUpdatesService.updateData(this.data, this.pid).subscribe({
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
        alert("getting status of data failed: " + err.error);
        this.router.navigate(['/connect']);
      },
    });
  }

  hasUnfinishedDataFiles(): boolean {
    return this.created.some((d) => d.status !== Filestatus.Equal) ||
      this.updated.some((d) => d.status !== Filestatus.Equal) ||
      this.deleted.some((d) => d.status !== Filestatus.New);
  }

  loadData(): void {
    const value = this.dataStateService.getCurrentValue();
    this.pid = (value && value.id) ? value.id : "";
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
          };
        this.metadata = await firstValueFrom(this.datasetService.getMetadata(req));
        const rowDataMap = this.mapFields(this.metadata);
        rowDataMap.forEach(v => {
          this.addChild(v, rowDataMap)
        });
        this.root = rowDataMap.get("");
        this.rowNodeMap = rowDataMap;
        if (this.root?.children) {
            this.rootNodeChildren = this.root.children;
        }
    }
  }

  toCreate(): Datafile[] {
    const result: Datafile[] = [];
    this.data.forEach(datafile => {
      if (datafile.action === Fileaction.Copy) {
        result.push(datafile);
      }
    })
    return result;
  }

  toUpdate(): Datafile[] {
    const result: Datafile[] = [];
    this.data.forEach(datafile => {
      if (datafile.action === Fileaction.Update) {
        result.push(datafile);
      }
    })
    return result;
  }

  toDelete(): Datafile[] {
    const result: Datafile[] = [];
    this.data.forEach(datafile => {
      if (datafile.action === Fileaction.Delete) {
        if (datafile.attributes?.remoteHashType === undefined || datafile.attributes?.remoteHashType === '') { // file from unknown origin, by setting the hash type to not empty value we can detect in comparison that the file got deleted
          datafile.attributes!.remoteHashType = 'unknown'
          datafile.attributes!.remoteHash = 'unknown'
        }
        result.push(datafile);
      }
    })
    return result;
  }

  submit() {
    if (this.credentialsService.credentials.plugin === "globus") {
      this.continueSubmit();
    } else {
      this.popup = true;
    }
  }

  async continueSubmit() {
    this.popup = false;
    this.disabled = true;
    const selected: Datafile[] = [];
    this.data.forEach(datafile => {
      const action = datafile.action === undefined ? Fileaction.Ignore : datafile.action;
      if (action != Fileaction.Ignore) {
        selected.push(datafile)
      }
    });
    if (selected.length === 0) {
      this.router.navigate(['/connect']);
      return;
    }

    if (this.pid.endsWith(':New Dataset')) {
        const ids = this.pid.split(':')
        const ok = await this.newDataset(ids[0]);
        if (!ok) {
            return;
        }
    }

    const httpSubscription = this.submitService.submit(selected, this.sendEmailOnSuccess).subscribe({
      next: (data: StoreResult) => {
        if (data.status !== "OK") {// this should not happen
          alert("store failed, status: " + data.status);
          this.router.navigate(['/connect']);
        } else {
          this.getDataSubscription();
          this.submitted = true;
          this.datasetUrl = data.datasetUrl!;
        }
        httpSubscription.unsubscribe();
      },
      error: (err) => {
        alert("store failed: " + err.error);
        this.router.navigate(['/connect']);
      },
    });
  }

  back(): void {
    this.location.back();
  }

  goToDataset() {
    window.open(this.datasetUrl, "_blank");
  }

  goToCompute() {
    this.router.navigate(['/compute'], {queryParams: {pid: this.pid}});
  }

  sendMails(): boolean {
    return this.pluginService.sendMails();
  }

  async newDataset(collectionId: string): Promise<boolean> {
    const data = await firstValueFrom(this.datasetService.newDataset((collectionId), this.credentialsService.credentials.dataverse_token, this.metadata));
    if (data.persistentId !== undefined) {
        this.pid = data.persistentId;
        this.credentialsService.credentials.dataset_id = data.persistentId;
        return true;
    } else {
        alert("creating new dataset failed");
        return false;
    }
  }

  action(): string {
    return MetadatafieldComponent.actionIcon(this.root!);
  }
  
  toggleAction(): void {
    MetadatafieldComponent.toggleNodeAction(this.root!);
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
    if (v.data?.path === "" && v.data.name == "") {
      return;
    }
    const parent = rowDataMap.get(v.data!.path!)!;
    const children = parent.children ? parent.children : [];
    parent.children = children.concat(v);
  }

  mapFields(metadata: Metadata): Map<string, TreeNode<Field>> {
    const rootData: Field = {
      path: "",
      name: "",
      action: Fieldaction.Ignore,
    }

    const rowDataMap: Map<string, TreeNode<Field>> = new Map<string, TreeNode<Field>>();
    rowDataMap.set("", {
      data: rootData,
    });

    metadata.datasetVersion.metadataBlocks.citation.fields.forEach((d) => {
        const path = ""
        const data: Field = {
            path: path,
            name: d.typeName,
            action: Fieldaction.Ignore,
            leafValue: (typeof d.value === "string") ? d.value as string : undefined,
            field: d,
          }
          if (d.value && Array.isArray(d.value) && d.value.length > 0 && typeof d.value[0] === "string") {
            let content = d.value[0];
            for(let i = 1; i < d.value.length; i++) {
              content = content + ", " + d.value[i];
            }
          } else if (d.value && typeof d.value !== "string") {
            (d.value as FieldDictonary[]).forEach((v) => {
              this.mapChildField(d.typeName, v, rowDataMap);
            });
          }

          rowDataMap.set(d.typeName, {
            data: data,
          });
      });
    return rowDataMap;
  }

  mapChildField(path: string, fieldDictonary: FieldDictonary, rowDataMap: Map<string, TreeNode<Field>>) {
    Object.values(fieldDictonary).forEach((d) => {
        const data: Field = {
            path: path,
            name: d.typeName,
            action: Fieldaction.Ignore,
            leafValue: (typeof d.value === "string") ? d.value as string : undefined,
            field: d,
          }
          rowDataMap.set(path + "/" + d.typeName, {
            data: data,
          });

          if (d.value && typeof d.value !== "string") {
            (d.value as FieldDictonary[]).forEach((v) => this.mapChildField(path + d.typeName, v, rowDataMap));
          }
    })
  }
}
