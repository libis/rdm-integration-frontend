// Author: Eryk Kulikowski @ KU Leuven (2025). Apache 2.0 License

import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { ButtonDirective } from 'primeng/button';
import { ProgressBarModule } from 'primeng/progressbar';
import { Observable, Subscription, merge, of, timer } from 'rxjs';
import { map, switchMap, tap, takeWhile } from 'rxjs/operators';
import { DataUpdatesService } from 'src/app/data.updates.service';
import { CompareResult } from '../../models/compare-result';
import { Datafile, Fileaction, Filestatus } from '../../models/datafile';
import { SubmitService, TransferTaskStatus } from '../../submit.service';

/**
 * Universal transfer progress card that works with all transfer plugins.
 * Uses Angular Signals for reactive state management in zoneless mode.
 */
@Component({
  selector: 'app-transfer-progress-card',
  standalone: true,
  imports: [CommonModule, ButtonDirective, ProgressBarModule],
  templateUrl: './transfer-progress-card.component.html',
  styleUrls: ['./transfer-progress-card.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TransferProgressCardComponent
  implements OnChanges, OnDestroy, AfterViewInit
{
  private readonly submitService = inject(SubmitService);
  private readonly dataUpdatesService = inject(DataUpdatesService);

  readonly cardRoot = viewChild<ElementRef<HTMLDivElement>>('cardRoot');

  // Inputs
  readonly isGlobus = input.required<boolean>();
  // Allow undefined to support usage where input binding might be missing/undefined in parent template
  readonly taskId = input<string | null | undefined>(undefined);
  readonly monitorUrl = input<string | null | undefined>(undefined);
  readonly oauthSessionId = input<string | null | undefined>(undefined);
  readonly submitting = input(false);
  readonly data = input<Datafile[] | null>(null);
  readonly dataUpdate = input<((result: CompareResult) => void) | undefined>(
    undefined,
  );

  // Outputs
  readonly pollingChange = output<boolean>();
  readonly completed = output<TransferTaskStatus>();

  // State
  readonly status = signal<TransferTaskStatus | undefined>(undefined);
  readonly statusPollingError = signal<string | undefined>(undefined);
  readonly statusPollingActive = signal(false);

  // Constants
  private readonly pollIntervalMs = 5000;
  private readonly terminalStatuses = new Set([
    'SUCCEEDED',
    'FAILED',
    'CANCELED',
    'INACTIVE',
  ]);

  // Computed
  readonly hasStatus = computed(() => {
    return !!(
      this.submitting() ||
      this.taskId() ||
      this.status() ||
      this.statusPollingError() ||
      this.statusPollingActive()
    );
  });

  readonly statusIcon = computed(() => {
    if (
      this.statusPollingError() ||
      this.isErrorStatus(this.status()?.status)
    ) {
      return 'pi pi-exclamation-triangle';
    }
    if (this.isSuccessStatus(this.status()?.status)) {
      return 'pi pi-check-circle';
    }
    if (this.statusPollingActive() || this.submitting()) {
      return 'pi pi-spinner pi-spin';
    }
    return 'pi pi-info-circle';
  });

  readonly statusTone = computed(() => {
    if (
      this.statusPollingError() ||
      this.isErrorStatus(this.status()?.status)
    ) {
      return 'error';
    }
    if (this.isSuccessStatus(this.status()?.status)) {
      return 'success';
    }
    return 'info';
  });

  readonly statusMessage = computed(() => {
    const error = this.statusPollingError();
    if (error) return error;

    if (this.submitting() && !this.taskId()) {
      return 'Submitting transfer request…';
    }

    const active = this.statusPollingActive();
    const s = this.status();

    if (!s && active) {
      return this.isGlobus()
        ? 'Checking Globus transfer status…'
        : 'Checking transfer status…';
    }

    if (!s) {
      return this.isGlobus()
        ? 'Waiting for Globus updates…'
        : 'Waiting for status updates…';
    }

    const niceStatus = s.nice_status?.trim();
    const normalized = (s.status ?? '').toUpperCase().trim();

    if (this.isSuccessStatus(normalized)) {
      return niceStatus || 'Transfer completed successfully.';
    }

    if (this.isErrorStatus(normalized)) {
      return niceStatus || `Transfer ended with status ${normalized}.`;
    }

    if (normalized === 'ACTIVE') {
      return 'Transfer in progress...';
    }

    if (niceStatus) return niceStatus;
    if (normalized) return `Current status: ${normalized}`;

    return 'Waiting for Globus updates…';
  });

  readonly transferProgress = computed(() => {
    const s = this.status();
    const expected = s?.bytes_expected ?? 0;
    const transferred = s?.bytes_transferred ?? 0;
    if (!expected) return undefined;
    const percent = Math.round((transferred / expected) * 100);
    return Math.min(100, Math.max(0, percent));
  });

  readonly filesSummary = computed(() => {
    const s = this.status();
    const total = s?.files ?? 0;
    const transferred = s?.files_transferred ?? 0;
    const skipped = s?.files_skipped ?? 0;
    const failed = s?.files_failed ?? 0;
    return {
      processed: transferred + skipped,
      total,
      failed,
    };
  });

  readonly filesProgressPercent = computed(() => {
    const summary = this.filesSummary();
    if (!summary.total) return 0;
    const percent = Math.round((summary.processed / summary.total) * 100);
    return Math.min(100, Math.max(0, percent));
  });

  readonly formattedMonitorUrl = computed(() => {
    if (!this.isGlobus()) return undefined;
    const url = this.monitorUrl();
    if (url) return url;
    const taskId = this.taskId();
    if (!taskId) return undefined;
    return `https://app.globus.org/activity/${encodeURIComponent(taskId)}`;
  });

  private hasRenderedCard = false;
  private viewInitialized = false;
  private currentPollingSubscription?: Subscription;
  private previousTaskId?: string | null;
  private previousSubmitting?: boolean;

  ngOnChanges(_changes: SimpleChanges): void {
    // Handle taskId changes for polling
    const currentTaskId = this.taskId();
    const currentSubmitting = this.submitting();

    if (currentTaskId !== this.previousTaskId) {
      this.previousTaskId = currentTaskId;
      if (currentTaskId) {
        this.currentPollingSubscription?.unsubscribe();
        this.currentPollingSubscription = this.startPolling(currentTaskId);
      } else {
        // Stop polling and reset when taskId becomes empty
        this.currentPollingSubscription?.unsubscribe();
        this.setPollingState(false);
        this.reset();
      }
    }

    // Reset when submitting becomes false and no taskId
    if (
      this.previousSubmitting !== currentSubmitting &&
      !currentSubmitting &&
      !currentTaskId
    ) {
      this.reset();
    }
    this.previousSubmitting = currentSubmitting;

    // Scroll logic
    if (this.viewInitialized) {
      this.maybeScrollCardIntoView();
    }
  }

  ngOnDestroy(): void {
    this.currentPollingSubscription?.unsubscribe();
    this.setPollingState(false);
  }

  ngAfterViewInit(): void {
    this.viewInitialized = true;
    this.maybeScrollCardIntoView();
  }

  refresh(): void {
    const taskId = this.taskId();
    if (!taskId) return;
    this.statusPollingError.set(undefined);
    // Restart polling
    this.currentPollingSubscription?.unsubscribe();
    this.currentPollingSubscription = this.startPolling(taskId);
  }

  openGlobus(): void {
    const url = this.formattedMonitorUrl();
    if (url) {
      window.open(url, '_blank', 'noopener');
    }
  }

  private startPolling(taskId: string): Subscription {
    this.statusPollingError.set(undefined);
    this.setPollingState(true);
    const immediate$ = this.getTransferStatus(taskId);
    const polling$ = timer(this.pollIntervalMs, this.pollIntervalMs).pipe(
      switchMap(() => this.getTransferStatus(taskId)),
    );
    return merge(immediate$, polling$)
      .pipe(takeWhile((s) => !this.isTerminalStatus(s.status), true))
      .subscribe({
        next: (status) => this.handleStatus(status),
        error: (err) => this.handleError(err),
      });
  }

  private getTransferStatus(taskId: string): Observable<TransferTaskStatus> {
    if (this.isGlobus()) {
      return this.submitService.getGlobusTransferStatus(
        taskId,
        this.oauthSessionId() || undefined,
      );
    }

    const data = this.data();
    if (!data) {
      return of(this.buildStatusFromCompareResult(taskId, undefined));
    }

    return this.dataUpdatesService.updateData(data, taskId).pipe(
      tap((updated) => {
        this.dataUpdate()?.(updated);
      }),
      map((updated) => this.buildStatusFromCompareResult(taskId, updated)),
    );
  }

  private reset(): void {
    this.status.set(undefined);
    this.statusPollingError.set(undefined);
    this.hasRenderedCard = false;
  }

  private handleStatus(status: TransferTaskStatus): void {
    this.status.set(status);
    if (this.isTerminalStatus(status.status)) {
      this.setPollingState(false);
      this.completed.emit(status);
    }
  }

  private handleError(err: unknown): void {
    this.setPollingState(false);
    const statusCode = (err as { status?: number })?.status;

    if (statusCode === 401) {
      this.statusPollingError.set(
        this.isGlobus()
          ? 'Globus session expired. Please reconnect to refresh the transfer status.'
          : 'Session expired. Please reconnect to refresh the transfer status.',
      );
      return;
    }

    const errorMessage =
      (err as { error?: string; message?: string })?.error ||
      (err as { message?: string })?.message ||
      (this.isGlobus()
        ? 'Unable to retrieve the latest status from Globus.'
        : 'Unable to retrieve the latest transfer status.');
    this.statusPollingError.set(errorMessage);
  }

  private buildStatusFromCompareResult(
    taskId: string,
    compareResult?: CompareResult | null,
  ): TransferTaskStatus {
    const summary = this.summarizeCompareData(compareResult?.data);

    return {
      task_id: taskId,
      status: summary.status,
      nice_status: summary.message,
      files: summary.total,
      files_transferred: summary.completed,
      files_skipped: summary.skipped,
      files_failed: summary.failed,
    };
  }

  private summarizeCompareData(datafiles?: Datafile[] | null): {
    status: string;
    message: string;
    total: number;
    completed: number;
    skipped: number;
    failed: number;
  } {
    const skipped = 0;
    const failed = 0;
    const files = datafiles ?? [];
    let completed = 0;
    let total = 0;

    for (const file of files) {
      switch (file.action) {
        case Fileaction.Copy:
          total++;
          if (file.status === Filestatus.Equal) {
            completed++;
          }
          break;
        case Fileaction.Update:
          total++;
          if (file.status === Filestatus.Equal) {
            completed++;
          }
          break;
        case Fileaction.Delete:
          total++;
          if (file.status === Filestatus.New) {
            completed++;
          }
          break;
        // Fileaction.Ignore files are not counted - they're not being transferred
      }
    }

    let status: string;
    let message: string;
    if (total === completed) {
      status = 'SUCCEEDED';
      message = 'Transfer completed successfully.';
    } else {
      status = 'ACTIVE';
      message = 'Transfer in progress...';
    }
    return {
      status,
      message,
      total,
      completed,
      skipped,
      failed,
    };
  }

  private isTerminalStatus(status?: string): boolean {
    if (!status) {
      return false;
    }
    return this.terminalStatuses.has(status.toUpperCase());
  }

  private isSuccessStatus(status?: string): boolean {
    return (status ?? '').toUpperCase() === 'SUCCEEDED';
  }

  private isErrorStatus(status?: string): boolean {
    const normalized = (status ?? '').toUpperCase();
    return normalized === 'FAILED' || normalized === 'CANCELED';
  }

  private setPollingState(active: boolean): void {
    if (this.statusPollingActive() === active) {
      return;
    }
    this.statusPollingActive.set(active);
    this.pollingChange.emit(active);
  }

  private maybeScrollCardIntoView(): void {
    const visible = this.hasStatus();
    if (visible && !this.hasRenderedCard) {
      setTimeout(() => {
        this.cardRoot()?.nativeElement.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
      });
    }
    this.hasRenderedCard = visible;
  }
}
