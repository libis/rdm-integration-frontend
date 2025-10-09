// Author: Eryk Kulikowski @ KU Leuven (2023). Apache 2.0 License

import { CommonModule, Location } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription, firstValueFrom } from 'rxjs';

// Services
import { CredentialsService } from '../credentials.service';
import { DataService } from '../data.service';
import { DataStateService } from '../data.state.service';
import { DataUpdatesService } from '../data.updates.service';
import { DatasetService } from '../dataset.service';
import { PluginService } from '../plugin.service';
import { NotificationService } from '../shared/notification.service';
import { SnapshotStorageService } from '../shared/snapshot-storage.service';
import { SubmitService } from '../submit.service';
import { UtilsService } from '../utils.service';

// Models
import { CompareResult } from '../models/compare-result';
import { Attributes, Datafile, Fileaction } from '../models/datafile';
import { Metadata } from '../models/field';
import { StoreResult } from '../models/store-result';

// PrimeNG
import { FormsModule } from '@angular/forms';
import { PrimeTemplate } from 'primeng/api';
import { Button, ButtonDirective } from 'primeng/button';
import { Checkbox } from 'primeng/checkbox';
import { Dialog } from 'primeng/dialog';

// Components
import { TransferProgressCardComponent } from '../shared/transfer-progress-card/transfer-progress-card.component';
import { SubmittedFileComponent } from '../submitted-file/submitted-file.component';

// Constants and types
import { APP_CONSTANTS } from '../shared/constants';
import { SubscriptionManager } from '../shared/types';
import { TableModule } from 'primeng/table';

@Component({
  selector: 'app-submit',
  templateUrl: './submit.component.html',
  styleUrls: ['./submit.component.scss'],
  imports: [
    CommonModule,
    ButtonDirective,
    Dialog,
    Checkbox,
    FormsModule,
    PrimeTemplate,
    Button,
    SubmittedFileComponent,
    TransferProgressCardComponent,
    TableModule,
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
  private readonly snapshotStorage = inject(SnapshotStorageService);

  // Subscriptions for cleanup
  private readonly subscriptions = new Set<Subscription>();

  // Icon constants
  readonly icon_warning = APP_CONSTANTS.ICONS.WARNING;
  readonly icon_copy = APP_CONSTANTS.ICONS.UPDATE;
  readonly icon_update = 'pi pi-clone';
  readonly icon_delete = 'pi pi-trash';

  data: Datafile[] = []; // local state for progress display
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
  transferStarted = false; // after successful submit ack

  // Transfer tracking (works for all plugins)
  transferTaskId?: string | null; // For Globus: task ID; for others: dataset ID
  transferMonitorUrl?: string | null; // External monitor URL (Globus only)
  transferInProgress = false;

  isGlobus(): boolean {
    return this.credentialsService.credentials.plugin === 'globus';
  }

  onStatusPollingChange(isPolling: boolean): void {
    this.transferInProgress = isPolling;
  }

  /**
   * Callback for transfer-progress-card to update our local data state.
   * This keeps the file list UI in sync with backend status for non-Globus transfers.
   */
  onDataUpdate(result: CompareResult): void {
    if (result.data) {
      this.setData(result.data);
    }
  }

  constructor() {}

  ngOnInit(): void {
    this.loadData();
    // Capture metadata from navigation state (metadata-selector -> submit)
    let state: { metadata?: Metadata } | undefined;
    const maybeGetNav: unknown = (
      this.router as unknown as { getCurrentNavigation?: () => unknown }
    ).getCurrentNavigation?.();
    const nav =
      (maybeGetNav as { extras?: { state?: unknown } } | null) || null;
    if (nav?.extras?.state) {
      state = nav.extras.state as { metadata?: Metadata };
    } else if (
      typeof window !== 'undefined' &&
      typeof window.history !== 'undefined' &&
      'state' in window.history
    ) {
      const histState = window.history.state as unknown;
      if (histState && typeof histState === 'object') {
        state = histState as { metadata?: Metadata };
      }
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
        next: (access) => (this.hasAccessToCompute = access.access),
        error: () => {}, // silent
      });
    this.subscriptions.add(accessCheckSub);
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach((sub) => sub.unsubscribe());
    this.subscriptions.clear();
  }

  loadData(): void {
    const value = this.dataStateService.getCurrentValue();
    this.pid = value && value.id ? value.id : '';
    const data = value?.data;
    if (data) this.setData(data);
  }

  async setData(data: Datafile[]) {
    this.data = data;
    const created: Datafile[] = [];
    const updated: Datafile[] = [];
    const deleted: Datafile[] = [];
    for (const f of data) {
      switch (f.action) {
        case Fileaction.Copy:
          created.push(f);
          break;
        case Fileaction.Update:
          updated.push(f);
          break;
        case Fileaction.Delete:
          if (
            !f.attributes?.remoteHashType ||
            f.attributes?.remoteHashType === ''
          ) {
            f.attributes = {
              ...(f.attributes || {}),
              remoteHashType: 'unknown',
              remoteHash: 'unknown',
            } as Attributes;
          }
          deleted.push(f);
          break;
      }
    }
    this.created = created;
    this.updated = updated;
    this.deleted = deleted;
    this.data = [...created, ...updated, ...deleted];
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
      if (action != Fileaction.Ignore) selected.push(datafile);
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
        this.transferStarted = false;
        return;
      }
    }

    const submitSub = this.submitService
      .submit(selected, this.sendEmailOnSuccess)
      .subscribe({
        next: (data: StoreResult) => {
          if (data.status !== 'OK') {
            this.notificationService.showError(
              `Store failed, status: ${data.status}`,
            );
            this.router.navigate(['/connect']);
          } else {
            this.transferStarted = true;
            this.submitted = true;
            this.datasetUrl = data.datasetUrl!;

            // For Globus: use task ID; for others: use dataset ID for polling
            if (this.isGlobus()) {
              this.transferTaskId = data.globusTransferTaskId ?? null;
              this.transferMonitorUrl = data.globusTransferMonitorUrl ?? null;
            } else {
              this.transferTaskId = this.pid;
            }

            this.transferInProgress = true;
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
    const value = this.dataStateService.getCurrentValue();
    const datasetId = value?.id || this.pid;
    if (datasetId) this.snapshotStorage.mergeConnect({ dataset_id: datasetId });
    // Determine navigation origin: if we received incomingMetadata it means we passed through metadata-selector.
    if (this.incomingMetadata) {
      // Return to metadata selector (one logical step back)
      this.router.navigate(['/metadata-selector'], {
        state: { fromSubmit: true },
      });
    } else {
      this.router.navigate(['/compare', datasetId], {
        state: { preserveCompare: true },
      });
    }
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
        this.incomingMetadata,
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
