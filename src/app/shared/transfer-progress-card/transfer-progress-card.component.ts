// Author: Eryk Kulikowski @ KU Leuven (2025). Apache 2.0 License

import { CommonModule } from '@angular/common';
import {
    AfterViewInit,
    Component,
    ElementRef,
    EventEmitter,
    Input,
    OnChanges,
    OnDestroy,
    Output,
    SimpleChanges,
    ViewChild,
    inject,
} from '@angular/core';
import { ButtonDirective } from 'primeng/button';

import { ProgressBarModule } from 'primeng/progressbar';
import { Observable, Subscription, merge, of, timer } from 'rxjs';
import { map, switchMap, tap } from 'rxjs/operators';
import { DataUpdatesService } from 'src/app/data.updates.service';
import { CompareResult } from '../../models/compare-result';
import { Datafile, Fileaction, Filestatus } from '../../models/datafile';
import { SubmitService, TransferTaskStatus } from '../../submit.service';

/**
 * Universal transfer progress card that works with all transfer plugins.
 *
 * The parent component must specify the transfer mode via the `isGlobus` input:
 *
 * - **Globus transfers** (`isGlobus=true`): Uses `taskId` to poll Globus API and shows
 *   real-time Globus status
 * - **Non-Globus transfers** (`isGlobus=false`): Uses `taskId` (dataset ID) + `data`
 *   (CompareResult) to poll the rdm-integration backend and maps file statuses to a
 *   unified TransferTaskStatus
 *
 * This explicit mode selection avoids relying on global state and ensures correct behavior
 * regardless of how the user navigated to the page.
 */
@Component({
  selector: 'app-transfer-progress-card',
  standalone: true,
  imports: [CommonModule, ButtonDirective, ProgressBarModule],
  templateUrl: './transfer-progress-card.component.html',
  styleUrls: ['./transfer-progress-card.component.scss'],
})
export class TransferProgressCardComponent
  implements OnChanges, OnDestroy, AfterViewInit
{
  private readonly submitService = inject(SubmitService);
  private dataUpdatesService = inject(DataUpdatesService);

  @ViewChild('cardRoot')
  private cardRoot?: ElementRef<HTMLDivElement>;

  private viewInitialized = false;
  private hasRenderedCard = false;

  private statusSubscription?: Subscription;
  private readonly pollIntervalMs = 5000;
  private readonly terminalStatuses = new Set([
    'SUCCEEDED',
    'FAILED',
    'CANCELED',
    'INACTIVE',
  ]);

  // Determines the transfer mode: Globus or non-Globus backend polling
  // Must be explicitly provided by parent component
  @Input({ required: true })
  isGlobus = false;

  // For Globus: this is the Globus task ID
  // For non-Globus: this is the dataset ID used for backend polling
  @Input({ required: true })
  taskId?: string | null;

  // Optional external monitor URL (Globus only)
  @Input()
  monitorUrl?: string | null;

  @Input()
  submitting = false;

  // CompareResult for non-Globus transfers (ignored for Globus)
  @Input()
  data?: Datafile[] | null;

  // Callback to update parent component's data (non-Globus only)
  @Input()
  dataUpdate?: (result: CompareResult) => void;

  @Output()
  pollingChange = new EventEmitter<boolean>();

  @Output()
  completed = new EventEmitter<TransferTaskStatus>();

  statusPollingActive = false;
  statusPollingError?: string;
  status?: TransferTaskStatus;

  ngOnChanges(changes: SimpleChanges): void {
    if ('taskId' in changes) {
      const taskId = this.taskId ?? '';
      if (taskId) {
        this.startPolling(taskId);
      } else {
        this.reset();
      }
    }

    if ('submitting' in changes && !this.submitting && !this.taskId) {
      this.reset();
    }

    if (this.viewInitialized) {
      this.maybeScrollCardIntoView();
    }
  }

  ngOnDestroy(): void {
    this.stopPolling();
  }

  ngAfterViewInit(): void {
    this.viewInitialized = true;
    this.maybeScrollCardIntoView();
  }

  get hasStatus(): boolean {
    // Always show status if we have any status information, even after completion
    return !!(
      this.submitting ||
      this.taskId ||
      this.status ||
      this.statusPollingError ||
      this.statusPollingActive
    );
  }

  get statusIcon(): string {
    if (this.statusPollingError || this.isErrorStatus(this.status?.status)) {
      return 'pi pi-exclamation-triangle';
    }
    if (this.isSuccessStatus(this.status?.status)) {
      return 'pi pi-check-circle';
    }
    if (this.statusPollingActive || this.submitting) {
      return 'pi pi-spinner pi-spin';
    }
    return 'pi pi-info-circle';
  }

  get statusTone(): 'success' | 'error' | 'info' {
    if (this.statusPollingError || this.isErrorStatus(this.status?.status)) {
      return 'error';
    }
    if (this.isSuccessStatus(this.status?.status)) {
      return 'success';
    }
    return 'info';
  }

  get statusMessage(): string {
    if (this.statusPollingError) {
      return this.statusPollingError;
    }

    if (this.submitting && !this.taskId) {
      return 'Submitting transfer request…';
    }

    if (!this.status && this.statusPollingActive) {
      return this.isGlobus
        ? 'Checking Globus transfer status…'
        : 'Checking transfer status…';
    }

    if (!this.status) {
      return this.isGlobus
        ? 'Waiting for Globus updates…'
        : 'Waiting for status updates…';
    }

    const niceStatus = this.status.nice_status?.trim();
    const normalized = (this.status.status ?? '').toUpperCase().trim();

    if (this.isSuccessStatus(normalized)) {
      return niceStatus || 'Transfer completed successfully.';
    }

    if (this.isErrorStatus(normalized)) {
      return niceStatus || `Transfer ended with status ${normalized}.`;
    }

    // For active transfers, show "Transfer in progress..." instead of technical status
    if (normalized === 'ACTIVE') {
      if (niceStatus) {
        return niceStatus;
      }
      return 'Transfer in progress... (ACTIVE)';
    }

    if (niceStatus) {
      return niceStatus;
    }

    if (normalized) {
      return `Current status: ${normalized}`;
    }

    return 'Waiting for Globus updates…';
  }

  get transferProgress(): number | undefined {
    const expected = this.status?.bytes_expected ?? 0;
    const transferred = this.status?.bytes_transferred ?? 0;
    if (!expected) {
      return undefined;
    }
    const percent = Math.round((transferred / expected) * 100);
    return Math.min(100, Math.max(0, percent));
  }

  // Percentage [0..100] for files-based progress (processed vs total)
  get filesProgressPercent(): number {
    const total = this.filesSummary.total;
    const processed = this.filesSummary.processed;
    if (!total) {
      return 0; // hidden by template when total is 0
    }
    const percent = Math.round((processed / total) * 100);
    return Math.min(100, Math.max(0, percent));
  }

  get filesSummary(): { processed: number; total: number; failed: number } {
    const total = this.status?.files ?? 0;
    const transferred = this.status?.files_transferred ?? 0;
    const skipped = this.status?.files_skipped ?? 0;
    const failed = this.status?.files_failed ?? 0;
    return {
      processed: transferred + skipped,
      total,
      failed,
    };
  }

  get formattedMonitorUrl(): string | undefined {
    // Only show Globus monitor URL for Globus transfers
    if (!this.isGlobus) {
      return undefined;
    }
    if (this.monitorUrl) {
      return this.monitorUrl;
    }
    if (!this.taskId) {
      return undefined;
    }
    return `https://app.globus.org/activity/${encodeURIComponent(this.taskId)}`;
  }

  refresh(): void {
    if (!this.taskId) {
      return;
    }
    this.statusPollingError = undefined;
    this.startPolling(this.taskId);
  }

  openGlobus(): void {
    const url = this.formattedMonitorUrl;
    if (url) {
      window.open(url, '_blank', 'noopener');
    }
  }

  private startPolling(taskId: string): void {
    this.stopPolling();
    this.statusPollingError = undefined;
    this.setPollingState(true);
    const immediate$ = this.getTransferStatus(taskId);
    const polling$ = timer(this.pollIntervalMs, this.pollIntervalMs).pipe(
      switchMap(() => this.getTransferStatus(taskId)),
    );
    this.statusSubscription = merge(immediate$, polling$).subscribe({
      next: (status) => this.handleStatus(status),
      error: (err) => this.handleError(err),
    });
  }

  private getTransferStatus(taskId: string): Observable<TransferTaskStatus> {
    if (this.isGlobus) {
      // Globus: poll the Globus API using the task ID
      return this.submitService.getGlobusTransferStatus(taskId);
    }

    // Non-Globus: poll the backend using dataset ID and CompareResult
    if (!this.data) {
      return of(this.buildStatusFromCompareResult(taskId, this.data));
    }

    return this.dataUpdatesService.updateData(this.data, taskId).pipe(
      tap((updated) => {
        // Update parent component's data for UI refresh
        this.dataUpdate?.(updated);
      }),
      map((updated) => this.buildStatusFromCompareResult(taskId, updated)),
    );
  }

  private stopPolling(): void {
    this.statusSubscription?.unsubscribe();
    this.statusSubscription = undefined;
    this.setPollingState(false);
  }

  private reset(): void {
    this.stopPolling();
    this.status = undefined;
    this.statusPollingError = undefined;
    this.hasRenderedCard = false;
  }

  private handleStatus(status: TransferTaskStatus): void {
    this.status = status;
    if (this.isTerminalStatus(status.status)) {
      this.stopPolling();
      this.completed.emit(status);
    }
  }

  private handleError(err: unknown): void {
    this.stopPolling();
    const statusCode = (err as { status?: number })?.status;

    if (statusCode === 401) {
      this.statusPollingError = this.isGlobus
        ? 'Globus session expired. Please reconnect to refresh the transfer status.'
        : 'Session expired. Please reconnect to refresh the transfer status.';
      return;
    }

    const errorMessage =
      (err as { error?: string; message?: string })?.error ||
      (err as { message?: string })?.message ||
      (this.isGlobus
        ? 'Unable to retrieve the latest status from Globus.'
        : 'Unable to retrieve the latest transfer status.');
    this.statusPollingError = errorMessage;
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

  /**
   * Summarizes file transfer progress based on file actions and statuses.
   *
   * Completion rules:
   * - Copy/Update files: done when status is Equal (file matches source)
   * - Delete files: done when status is New (file no longer exists in destination)
   * - Unknown status: counted as failed
   */
  private summarizeCompareData(datafiles?: Datafile[] | null): {
    status: string;
    message: string;
    total: number;
    completed: number;
    skipped: number;
    failed: number;
  } {
    const skipped = 0; // Reserved for future use
    const failed = 0; // Reserved for future use
    const files = datafiles ?? [];
    let completed = 0;

    for (const file of files) {
      switch (file.action) {
        case Fileaction.Copy:
          if (file.status === Filestatus.Equal) {
            completed++;
          }
          break;
        case Fileaction.Update:
          if (file.status === Filestatus.Equal) {
            completed++;
          }
          break;
        case Fileaction.Delete:
          if (file.status === Filestatus.New) {
            completed++;
          }
          break;
      }
    }

    let status: string;
    let message: string;
    if (files.length === completed) {
      status = 'SUCCEEDED';
      message = 'Transfer completed successfully.';
    } else {
      status = 'ACTIVE';
      message = 'Transfer in progress...';
    }
    return {
      status,
      message,
      total: files.length,
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
    if (this.statusPollingActive === active) {
      return;
    }
    this.statusPollingActive = active;
    this.pollingChange.emit(active);
  }

  private maybeScrollCardIntoView(): void {
    const visible = this.hasStatus;
    if (visible && !this.hasRenderedCard) {
      setTimeout(() => {
        this.cardRoot?.nativeElement.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
      });
    }
    this.hasRenderedCard = visible;
  }
}
