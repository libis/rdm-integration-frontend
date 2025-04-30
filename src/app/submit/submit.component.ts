 
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

  metadata?: JSON;

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
        this.metadata = await firstValueFrom(this.datasetService.getMetadata(req))
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
}
