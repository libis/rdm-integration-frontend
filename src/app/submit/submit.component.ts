// Author: Eryk Kulikowski @ KU Leuven (2023). Apache 2.0 License

import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { Subscription, firstValueFrom } from 'rxjs';

// Services
import { CredentialsService } from '../credentials.service';
import { DataService } from '../data.service';
import { DataStateService } from '../data.state.service';
import { DatasetService } from '../dataset.service';
import { PluginService } from '../plugin.service';
import { NotificationService } from '../shared/notification.service';
import { SnapshotStorageService } from '../shared/snapshot-storage.service';
import { SubmitService } from '../submit.service';

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
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SubmitComponent implements OnInit, OnDestroy, SubscriptionManager {
  private readonly dataStateService = inject(DataStateService);
  private readonly submitService = inject(SubmitService);
  private readonly pluginService = inject(PluginService);
  private readonly router = inject(Router);
  private readonly dataService = inject(DataService);
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

  // Signals
  readonly data = signal<Datafile[]>([]);
  readonly pid = signal('');
  readonly datasetUrl = signal('');

  readonly created = computed(() =>
    this.data().filter((f) => f.action === Fileaction.Copy),
  );
  readonly updated = computed(() =>
    this.data().filter((f) => f.action === Fileaction.Update),
  );
  readonly deleted = computed(() =>
    this.data().filter((f) => f.action === Fileaction.Delete),
  );

  readonly disabled = signal(false);
  readonly submitted = signal(false);
  readonly done = signal(false);
  readonly sendEmailOnSuccess = signal(false); // Model binding needs handling
  readonly popup = signal(false);
  readonly hasAccessToCompute = signal(false);

  private incomingMetadata?: Metadata;

  readonly transferStarted = signal(false);

  // Transfer tracking
  readonly transferTaskId = signal<string | null | undefined>(undefined);
  readonly transferMonitorUrl = signal<string | null | undefined>(undefined);
  readonly transferInProgress = signal(false);

  readonly isGlobus = computed(
    () => this.credentialsService.plugin$() === 'globus',
  );

  // Method bound to component instance for TransferProgressCard
  readonly onDataUpdateCallback = (result: CompareResult) => {
    if (result.data) {
      this.updateData(result.data);
    }
  };

  onStatusPollingChange(isPolling: boolean): void {
    this.transferInProgress.set(isPolling);
  }

  constructor() {}

  ngOnInit(): void {
    this.loadData();
    // Capture metadata from navigation state
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
      .checkAccessToQueue('', this.credentialsService.dataverseToken$(), '')
      .subscribe({
        next: (access) => this.hasAccessToCompute.set(access.access),
        error: () => {}, // silent
      });
    this.subscriptions.add(accessCheckSub);
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach((sub) => sub.unsubscribe());
    this.subscriptions.clear();
  }

  loadData(): void {
    const value = this.dataStateService.state$();
    this.pid.set(value && value.id ? value.id : '');
    const data = value?.data;
    if (data) this.updateData(data);
  }

  // Helper to process and set data
  private updateData(data: Datafile[]) {
    // Process delete actions (logic from original setData)
    const processed = data.map((f) => {
      if (f.action === Fileaction.Delete) {
        if (
          !f.attributes?.remoteHashType ||
          f.attributes?.remoteHashType === ''
        ) {
          // Mutate or create copy? Better copy if possible, but for now specific mutation
          f.attributes = {
            ...(f.attributes || {}),
            remoteHashType: 'unknown',
            remoteHash: 'unknown',
          } as Attributes;
        }
      }
      return f;
    });
    this.data.set(processed);
  }

  submit() {
    if (this.credentialsService.plugin$() === 'globus') {
      this.continueSubmit();
    } else {
      this.popup.set(true);
    }
  }

  async continueSubmit() {
    this.popup.set(false);
    this.disabled.set(true);
    const selected: Datafile[] = [];
    this.data().forEach((datafile) => {
      const action =
        datafile.action === undefined ? Fileaction.Ignore : datafile.action;
      if (action != Fileaction.Ignore) selected.push(datafile);
    });
    if (selected.length === 0) {
      this.router.navigate(['/connect']);
      return;
    }

    const pidVal = this.pid();
    if (pidVal.endsWith(':New Dataset')) {
      const ids = pidVal.split(':');
      const ok = await this.newDataset(ids[0]);
      if (!ok) {
        this.disabled.set(false);
        this.transferStarted.set(false);
        return;
      }
    }

    const submitSub = this.submitService
      .submit(selected, this.sendEmailOnSuccess())
      .subscribe({
        next: (data: StoreResult) => {
          if (data.status !== 'OK') {
            this.notificationService.showError(
              `Store failed, status: ${data.status}`,
            );
            this.router.navigate(['/connect']);
          } else {
            this.transferStarted.set(true);
            this.submitted.set(true);
            this.datasetUrl.set(data.datasetUrl!);

            // For Globus: use task ID; for others: use dataset ID for polling
            if (this.isGlobus()) {
              this.transferTaskId.set(data.globusTransferTaskId ?? null);
              this.transferMonitorUrl.set(
                data.globusTransferMonitorUrl ?? null,
              );
            } else {
              this.transferTaskId.set(this.pid());
            }

            this.transferInProgress.set(true);
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
    const value = this.dataStateService.state$();
    const datasetId = value?.id || this.pid();
    if (datasetId) this.snapshotStorage.mergeConnect({ dataset_id: datasetId });
    if (this.incomingMetadata) {
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
    window.open(this.datasetUrl(), '_blank');
  }

  goToCompute() {
    this.router.navigate(['/compute'], { queryParams: { pid: this.pid() } });
  }

  readonly sendMails = computed(() => this.pluginService.sendMails$());

  async newDataset(collectionId: string): Promise<boolean> {
    const data = await firstValueFrom(
      this.datasetService.newDataset(
        collectionId,
        this.credentialsService.dataverseToken$(),
        this.incomingMetadata,
      ),
    );
    if (data.persistentId !== undefined && data.persistentId !== '') {
      this.pid.set(data.persistentId);
      this.credentialsService.updateCredentials({
        dataset_id: data.persistentId,
      });
      return true;
    } else {
      this.notificationService.showError('Creating new dataset failed');
      return false;
    }
  }
}
