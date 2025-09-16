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
import { Metadata } from '../models/field';

// PrimeNG
import { PrimeTemplate } from 'primeng/api';
import { ButtonDirective, Button } from 'primeng/button';
import { Ripple } from 'primeng/ripple';
import { Dialog } from 'primeng/dialog';
import { Checkbox } from 'primeng/checkbox';
import { FormsModule } from '@angular/forms';

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
    Ripple,
    Dialog,
    Checkbox,
    FormsModule,
    PrimeTemplate,
    Button,
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
  // Keep a handle only for polling, so we can cancel/replace safely
  private dataStatusSub?: Subscription;

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
  private incomingMetadata?: Metadata;

  constructor() {}

  ngOnInit(): void {
    this.loadData();
    // Capture metadata from navigation state if coming from metadata-selector
    let state: { metadata?: Metadata } | undefined;
    // Use Router.getCurrentNavigation when available (only during navigation)
    const nav = this.router.getCurrentNavigation?.();
    if (nav?.extras?.state) {
      state = nav.extras.state as { metadata?: Metadata };
    } else if (
      typeof window !== 'undefined' &&
      window.history &&
      window.history.state
    ) {
      // Fallback for environments/tests where Router.getCurrentNavigation is not available
      state = window.history.state as { metadata?: Metadata };
    }
    if (state?.metadata) {
      this.incomingMetadata = state.metadata;
    }
    const accessCheckSub = this.dataService
      .checkAccessToQueue(
        '',
        this.credentialsService.credentials.dataverse_token,
        '',
      )
      .subscribe({
        next: (access) => {
          this.hasAccessToCompute = access.access;
        },
        error: () => {
          // ignore access check failures silently as before
        },
      });
    this.subscriptions.add(accessCheckSub);
  }

  ngOnDestroy(): void {
    // Clean up all subscriptions
    this.subscriptions.forEach((sub) => sub.unsubscribe());
    this.subscriptions.clear();
  }

  getDataSubscription(): void {
    // Ensure previous polling subscription is stopped before starting a new one
    this.dataStatusSub?.unsubscribe();
    this.dataStatusSub = this.dataUpdatesService
      .updateData(this.data, this.pid)
      .subscribe({
        next: async (res: CompareResult) => {
          this.dataStatusSub?.unsubscribe();
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
          this.dataStatusSub?.unsubscribe();
          this.notificationService.showError(
            `Getting status of data failed: ${err.error}`,
          );
          this.router.navigate(['/connect']);
        },
      });
    this.subscriptions.add(this.dataStatusSub);
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

    if (this.pid.endsWith(':New Dataset')) {
      const ids = this.pid.split(':');
      const ok = await this.newDataset(ids[0]);
      if (!ok) {
        this.disabled = false;
        return;
      }
    }

    const submitSub = this.submitService
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
        },
        error: (err) => {
          this.notificationService.showError(`Store failed: ${err.error}`);
          this.router.navigate(['/connect']);
        },
      });
    this.subscriptions.add(submitSub);
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
    const data = await firstValueFrom(
      this.datasetService.newDataset(
        collectionId,
        this.credentialsService.credentials.dataverse_token,
        this.incomingMetadata, // use metadata selected in metadata-selector when present
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
}
