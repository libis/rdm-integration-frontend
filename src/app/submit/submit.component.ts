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
import { SnapshotStorageService } from '../shared/snapshot-storage.service';
import { PollingService, PollingHandle } from '../shared/polling.service';

// Models
import {
  Datafile,
  Fileaction,
  Filestatus,
  Attributes,
} from '../models/datafile';
import { StoreResult } from '../models/store-result';
import { CompareResult } from '../models/compare-result';
import { Metadata } from '../models/field';

// PrimeNG
import { PrimeTemplate } from 'primeng/api';
import { ButtonDirective, Button } from 'primeng/button';
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
  private readonly snapshotStorage = inject(SnapshotStorageService);
  private readonly pollingService = inject(PollingService);

  // Subscriptions for cleanup
  private readonly subscriptions = new Set<Subscription>();
  // Replaces previous recursive subscription approach for status polling
  private pollingHandle?: PollingHandle;

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
  totalPlanned = 0; // created + updated + deleted
  completedCount = 0; // processed files

  isGlobus(): boolean {
    return this.credentialsService.credentials.plugin === 'globus';
  }

  progressRatio(): number {
    if (this.totalPlanned === 0) return 0;
    return Math.min(1, this.completedCount / this.totalPlanned);
  }

  progressLabel(): string {
    if (!this.transferStarted) return '';
    return `${this.completedCount}/${this.totalPlanned} files processed`;
  }

  private recomputeProgress(): void {
    this.totalPlanned =
      this.created.length + this.updated.length + this.deleted.length;
    const doneCreates = this.created.filter(
      (d) => d.status === Filestatus.Equal,
    ).length;
    const doneUpdates = this.updated.filter(
      (d) => d.status === Filestatus.Equal,
    ).length;
    const doneDeletes = this.deleted.filter(
      (d) => d.status === Filestatus.New || d.status === Filestatus.Equal,
    ).length;
    this.completedCount = doneCreates + doneUpdates + doneDeletes;
    if (this.completedCount >= this.totalPlanned && this.totalPlanned > 0) {
      this.done = true;
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
    this.pollingHandle?.cancel();
  }

  getDataSubscription(): void {
    this.pollingHandle?.cancel();
    this.pollingHandle = this.pollingService.poll<CompareResult>({
      iterate: () => this.dataUpdatesService.updateData(this.data, this.pid),
      onResult: (res: CompareResult) => {
        if (res.data !== undefined) {
          this.setData(res.data);
        }
        if (!this.hasUnfinishedDataFiles()) {
          this.done = true;
        }
      },
      shouldContinue: () => this.hasUnfinishedDataFiles(),
      delayMs: 1000,
      onError: (err: unknown) => {
        const message = (err as { error?: string })?.error || 'unknown error';
        this.notificationService.showError(
          `Getting status of data failed: ${message}`,
        );
        this.router.navigate(['/connect']);
        return false;
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
    this.recomputeProgress();
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
            this.getDataSubscription();
            this.submitted = true;
            this.datasetUrl = data.datasetUrl!;
            this.recomputeProgress();
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
    this.router.navigate(['/compare', datasetId], {
      state: { preserveCompare: true },
    });
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
