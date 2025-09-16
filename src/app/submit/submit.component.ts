// Author: Eryk Kulikowski @ KU Leuven (2023). Apache 2.0 License

import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Location } from '@angular/common';
import { Subscription } from 'rxjs';

// Services
import { DataUpdatesService } from '../data.updates.service';
import { DataStateService } from '../data.state.service';
import { SubmitService } from '../submit.service';
import { PluginService } from '../plugin.service';
import { UtilsService } from '../utils.service';
import { CredentialsService } from '../credentials.service';
import { DataService } from '../data.service';
// import { DatasetService } from '../dataset.service';
import { NotificationService } from '../shared/notification.service';

// Models
import { Datafile, Fileaction, Filestatus } from '../models/datafile';
import { StoreResult } from '../models/store-result';
import { CompareResult } from '../models/compare-result';
// import { MetadataRequest } from '../models/metadata-request';
// import { Field, Fieldaction, FieldDictonary, Metadata, MetadataField } from '../models/field';

// PrimeNG
// import { TreeNode, PrimeTemplate } from 'primeng/api';
import { ButtonDirective, Button } from 'primeng/button';
import { Ripple } from 'primeng/ripple';
import { Dialog } from 'primeng/dialog';
import { Checkbox } from 'primeng/checkbox';
import { FormsModule } from '@angular/forms';
// import { TreeTableModule } from 'primeng/treetable';

// Components
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
    Button,
    Ripple,
    Dialog,
    Checkbox,
    FormsModule,
    // PrimeTemplate,
    // TreeTableModule, // no longer used here
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
  // private readonly datasetService = inject(DatasetService);
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

  // Metadata selection is handled in MetadataSelectorComponent

  constructor() {}

  ngOnInit(): void {
    this.loadData();
    // If somehow navigated directly while creating a new dataset, send to metadata selection first
    if (this.pid.endsWith(':New Dataset')) {
      this.router.navigate(['/metadata-selector']);
      return;
    }
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
    this.subscriptions.forEach((sub) => sub.unsubscribe());
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
          this.notificationService.showError(
            `Getting status of data failed: ${err.error}`,
          );
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

    // New dataset creation is handled in MetadataSelectorComponent

    const httpSubscription = this.submitService
      .submit(selected, this.sendEmailOnSuccess)
      .subscribe({
        next: (data: StoreResult) => {
          if (data.status !== 'OK') {
            // this should not happen
            this.notificationService.showError(
              `Store failed, status: ${data.status}`,
            );
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

  // New dataset creation moved to MetadataSelectorComponent

  // Metadata helper methods removed; file submission only
}
