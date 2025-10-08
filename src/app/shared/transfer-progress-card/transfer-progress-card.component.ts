// Author: Eryk Kulikowski @ KU Leuven (2025). Apache 2.0 License

import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  inject,
} from '@angular/core';
import { ButtonDirective } from 'primeng/button';

import { Observable, Subscription, merge, timer } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { TransferTaskStatus, SubmitService } from '../../submit.service';
import { CredentialsService } from 'src/app/credentials.service';
import { DataUpdatesService } from 'src/app/data.updates.service';

@Component({
  selector: 'app-transfer-progress-card',
  standalone: true,
  imports: [CommonModule, ButtonDirective],
  templateUrl: './transfer-progress-card.component.html',
  styleUrls: ['./transfer-progress-card.component.scss'],
})
export class TransferProgressCardComponent implements OnChanges, OnDestroy {
  private readonly submitService = inject(SubmitService);
  private credentialsService = inject(CredentialsService);
  private dataUpdatesService = inject(DataUpdatesService);

  private statusSubscription?: Subscription;
  private readonly pollIntervalMs = 5000;
  private readonly terminalStatuses = new Set([
    'SUCCEEDED',
    'FAILED',
    'CANCELED',
    'INACTIVE',
  ]);

  @Input({ required: true })
  taskId?: string | null;

  @Input()
  monitorUrl?: string | null;

  @Input()
  submitting = false;

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
  }

  ngOnDestroy(): void {
    this.stopPolling();
  }

  get hasStatus(): boolean {
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
      return 'Checking Globus transfer status…';
    }

    if (!this.status) {
      return 'Waiting for Globus updates…';
    }

    const niceStatus = this.status.nice_status?.trim();
    const normalized = (this.status.status ?? '').toUpperCase().trim();

    if (this.isSuccessStatus(normalized)) {
      return niceStatus || 'Transfer completed successfully.';
    }

    if (this.isErrorStatus(normalized)) {
      return niceStatus || `Transfer ended with status ${normalized}.`;
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
    if (!this.isGlobus()) {
      //return this.dataUpdatesService.updateData(this.data, taskId);
    }
    return this.submitService.getGlobusTransferStatus(taskId);
  }

  private isGlobus(): boolean {
    return this.credentialsService.credentials.plugin === 'globus';
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
      this.statusPollingError =
        'Globus session expired. Please reconnect to refresh the transfer status.';
      return;
    }
    const errorMessage =
      (err as { error?: string; message?: string })?.error ||
      (err as { message?: string })?.message ||
      'Unable to retrieve the latest status from Globus.';
    this.statusPollingError = errorMessage;
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
}
