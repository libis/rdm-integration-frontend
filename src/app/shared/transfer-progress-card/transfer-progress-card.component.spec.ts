import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of, throwError } from 'rxjs';
import { CredentialsService } from 'src/app/credentials.service';
import { DataUpdatesService } from 'src/app/data.updates.service';
import { Fileaction, Filestatus } from 'src/app/models/datafile';
import { SubmitService, TransferTaskStatus } from '../../submit.service';
import { TransferProgressCardComponent } from './transfer-progress-card.component';

class MockSubmitService {
  statuses: TransferTaskStatus[] = [];
  errors: unknown[] = [];

  getGlobusTransferStatus(taskId: string) {
    if (this.errors.length > 0) {
      const error = this.errors.shift();
      return throwError(() => error);
    }
    const status =
      this.statuses.shift() ??
      ({ task_id: taskId, status: 'ACTIVE' } as TransferTaskStatus);
    return of(status);
  }
}

class MockCredentialsService {
  credentials = { plugin: 'globus', dataset_id: 'pid-default' };

  // Signal-based API
  credentials$ = signal(this.credentials).asReadonly();
  plugin$ = signal('globus').asReadonly();
  pluginId$ = signal<string | undefined>(undefined).asReadonly();
  repoName$ = signal<string | undefined>(undefined).asReadonly();
  url$ = signal<string | undefined>(undefined).asReadonly();
  option$ = signal<string | undefined>(undefined).asReadonly();
  user$ = signal<string | undefined>(undefined).asReadonly();
  token$ = signal<string | undefined>(undefined).asReadonly();
  datasetId$ = signal('pid-default').asReadonly();
  newlyCreated$ = signal<boolean | undefined>(undefined).asReadonly();
  dataverseToken$ = signal<string | undefined>(undefined).asReadonly();
  metadataAvailable$ = signal<boolean | undefined>(undefined).asReadonly();

  setCredentials(creds: { plugin?: string; dataset_id?: string }): void {
    this.credentials = { ...this.credentials, ...creds };
  }
  updateCredentials(partial: { plugin?: string; dataset_id?: string }): void {
    this.credentials = { ...this.credentials, ...partial };
  }
  clearCredentials(): void {
    this.credentials = { plugin: 'globus', dataset_id: 'pid-default' };
  }
}

class MockDataUpdatesService {
  updateData = jasmine.createSpy('updateData');
}

describe('TransferProgressCardComponent', () => {
  let fixture: ComponentFixture<TransferProgressCardComponent>;
  let component: TransferProgressCardComponent;
  let submit: MockSubmitService;
  let dataUpdates: MockDataUpdatesService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TransferProgressCardComponent],
      providers: [
        { provide: SubmitService, useClass: MockSubmitService },
        { provide: CredentialsService, useClass: MockCredentialsService },
        { provide: DataUpdatesService, useClass: MockDataUpdatesService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TransferProgressCardComponent);
    component = fixture.componentInstance;
    // Set required input immediately after component creation to prevent effect errors
    fixture.componentRef.setInput('isGlobus', false);
    submit = TestBed.inject(SubmitService) as unknown as MockSubmitService;
    dataUpdates = TestBed.inject(
      DataUpdatesService,
    ) as unknown as MockDataUpdatesService;
  });

  afterEach(() => {
    fixture.destroy();
    dataUpdates.updateData.calls.reset();
  });

  it('polls status until terminal state and emits events', () => {
    jasmine.clock().install();
    try {
      submit.statuses = [
        { task_id: 'task-1', status: 'ACTIVE' },
        { task_id: 'task-1', status: 'SUCCEEDED', nice_status: 'All done' },
      ];

      const pollingStates: boolean[] = [];
      component.pollingChange.subscribe((value) => pollingStates.push(value));
      const completions: TransferTaskStatus[] = [];
      component.completed.subscribe((value) => completions.push(value));

      fixture.componentRef.setInput('isGlobus', true);
      fixture.componentRef.setInput('taskId', 'task-1');
      fixture.detectChanges();

      expect(component.hasStatus()).toBeTrue();
      // immediate$ fires synchronously — first status is ACTIVE
      expect(component.status()?.status).toBe('ACTIVE');
      expect(component.statusPollingActive()).toBeTrue();

      // Advance timer to trigger poll — second status is SUCCEEDED
      jasmine.clock().tick(5001);
      expect(component.status()?.status).toBe('SUCCEEDED');
      expect(component.statusMessage()).toContain('All done');
      expect(component.statusPollingActive()).toBeFalse();
      expect(completions.length).toBe(1);
      expect(pollingStates).toEqual([true, false]);
    } finally {
      jasmine.clock().uninstall();
    }
  });

  it('shows error message when polling fails', async () => {
    submit.errors = [{ status: 401 }];

    fixture.componentRef.setInput('isGlobus', true);
    fixture.componentRef.setInput('taskId', 'task-2');
    fixture.detectChanges();

    await new Promise<void>((r) => setTimeout(r));

    expect(component.statusPollingActive()).toBeFalse();
    expect(component.statusMessage()).toContain('Globus session expired');
    expect(component.statusIcon()).toContain('exclamation');
  });

  it('shows error message for non-globus when polling fails with 401', async () => {
    const mockError = { status: 401 };
    dataUpdates.updateData.and.returnValue(throwError(() => mockError));

    fixture.componentRef.setInput('isGlobus', false);
    fixture.componentRef.setInput('data', []);
    fixture.componentRef.setInput('taskId', 'pid-123');
    fixture.detectChanges();

    await new Promise<void>((r) => setTimeout(r));

    expect(component.statusPollingActive()).toBeFalse();
    expect(component.statusMessage()).toContain('Session expired');
    expect(component.statusMessage()).not.toContain('Globus');
    expect(component.statusIcon()).toContain('exclamation');
    expect(component.statusTone()).toBe('error');
  });

  it('handles generic error message from error object', async () => {
    const mockError = { error: 'Custom error message' };
    submit.errors = [mockError];

    fixture.componentRef.setInput('isGlobus', true);
    fixture.componentRef.setInput('taskId', 'task-3');
    fixture.detectChanges();

    await new Promise<void>((r) => setTimeout(r));

    expect(component.statusPollingError()).toBe('Custom error message');
    expect(component.statusMessage()).toBe('Custom error message');
  });

  it('handles error with message property', async () => {
    const mockError = { message: 'Network timeout' };
    submit.errors = [mockError];

    fixture.componentRef.setInput('isGlobus', true);
    fixture.componentRef.setInput('taskId', 'task-4');
    fixture.detectChanges();

    await new Promise<void>((r) => setTimeout(r));

    expect(component.statusPollingError()).toBe('Network timeout');
  });

  it('uses default error message for globus when no specific error', async () => {
    const mockError = {};
    submit.errors = [mockError];

    fixture.componentRef.setInput('isGlobus', true);
    fixture.componentRef.setInput('taskId', 'task-5');
    fixture.detectChanges();

    await new Promise<void>((r) => setTimeout(r));

    expect(component.statusPollingError()).toContain(
      'Unable to retrieve the latest status from Globus',
    );
  });

  it('uses default error message for non-globus when no specific error', async () => {
    const mockError = {};
    dataUpdates.updateData.and.returnValue(throwError(() => mockError));

    fixture.componentRef.setInput('isGlobus', false);
    fixture.componentRef.setInput('data', []);
    fixture.componentRef.setInput('taskId', 'pid-456');
    fixture.detectChanges();

    await new Promise<void>((r) => setTimeout(r));

    expect(component.statusPollingError()).toContain(
      'Unable to retrieve the latest transfer status',
    );
    expect(component.statusPollingError()).not.toContain('Globus');
  });

  it('renders submitting-only state messaging', () => {
    fixture.componentRef.setInput('isGlobus', false);
    fixture.componentRef.setInput('submitting', true);
    fixture.detectChanges();

    expect(component.hasStatus()).toBeTrue();
    expect(component.statusMessage()).toContain('Submitting transfer request');
    expect(component.statusIcon()).toContain('spinner');
    expect(component.statusTone()).toBe('info');
  });

  it('shows active message when polling starts for globus', () => {
    // Mock returns ACTIVE status immediately
    submit.statuses = [{ task_id: 'task-waiting', status: 'ACTIVE' }];
    fixture.componentRef.setInput('isGlobus', true);
    fixture.componentRef.setInput('taskId', 'task-waiting');
    fixture.detectChanges();

    expect(component.statusMessage()).toContain('Transfer in progress');
  });

  it('shows waiting message when no taskId is set for non-globus', () => {
    fixture.componentRef.setInput('isGlobus', false);
    // No taskId set - should show waiting
    fixture.detectChanges();

    expect(component.hasStatus()).toBeFalse();
  });

  it('starts polling immediately when taskId is set for globus', async () => {
    submit.statuses = [{ task_id: 'task-check', status: 'ACTIVE' }];

    fixture.componentRef.setInput('isGlobus', true);
    fixture.componentRef.setInput('taskId', 'task-check');
    fixture.detectChanges();

    // Polling should be active
    expect(component.statusPollingActive()).toBeTrue();

    await new Promise<void>((r) => setTimeout(r));
    fixture.detectChanges();

    // Status should be retrieved
    expect(component.status()?.status).toBe('ACTIVE');
    expect(component.statusMessage()).toContain('Transfer in progress');
  });

  it('starts polling immediately when taskId is set for non-globus', async () => {
    const mockFiles = [
      {
        id: '1',
        name: 'file.txt',
        action: Fileaction.Copy,
        status: Filestatus.New,
      } as any,
    ];
    dataUpdates.updateData.and.returnValue(of({ data: mockFiles }));

    fixture.componentRef.setInput('isGlobus', false);
    fixture.componentRef.setInput('data', mockFiles);
    fixture.componentRef.setInput('taskId', 'pid-check');
    fixture.detectChanges();

    // Polling should be active initially
    expect(component.statusPollingActive()).toBeTrue();

    await new Promise<void>((r) => setTimeout(r));
    fixture.detectChanges();

    // Should have computed status from data - one file in progress (not complete)
    expect(component.status()).toBeDefined();
    expect(component.statusMessage()).toContain('Transfer in progress');
  });

  it('computes transfer progress when bytes known', () => {
    jasmine.clock().install();
    try {
      submit.statuses = [
        {
          task_id: 'task-progress',
          status: 'ACTIVE',
          bytes_transferred: 150,
          bytes_expected: 300,
        },
        {
          task_id: 'task-progress',
          status: 'SUCCEEDED',
          bytes_transferred: 300,
          bytes_expected: 300,
        },
      ];

      fixture.componentRef.setInput('isGlobus', true);
      fixture.componentRef.setInput('taskId', 'task-progress');
      fixture.detectChanges();

      // immediate$ fires synchronously — first status: 50%
      expect(component.transferProgress()).toBe(50);

      // Advance timer to trigger poll — second status: 100%
      jasmine.clock().tick(5001);
      expect(component.transferProgress()).toBe(100);
    } finally {
      jasmine.clock().uninstall();
    }
  });

  it('returns undefined progress when bytes_expected is zero', async () => {
    submit.statuses = [
      {
        task_id: 'task-no-bytes',
        status: 'ACTIVE',
        bytes_transferred: 100,
        bytes_expected: 0,
      },
    ];

    fixture.componentRef.setInput('isGlobus', true);
    fixture.componentRef.setInput('taskId', 'task-no-bytes');
    fixture.detectChanges();

    await new Promise<void>((r) => setTimeout(r));
    expect(component.transferProgress()).toBeUndefined();
  });

  it('calculates files summary correctly', async () => {
    submit.statuses = [
      {
        task_id: 'task-files',
        status: 'ACTIVE',
        files: 100,
        files_transferred: 50,
        files_skipped: 10,
        files_failed: 5,
      },
    ];

    fixture.componentRef.setInput('isGlobus', true);
    fixture.componentRef.setInput('taskId', 'task-files');
    fixture.detectChanges();

    await new Promise<void>((r) => setTimeout(r));
    const summary = component.filesSummary();
    expect(summary.total).toBe(100);
    expect(summary.processed).toBe(60); // transferred + skipped
    expect(summary.failed).toBe(5);
  });

  it('creates monitor link when task id present', () => {
    fixture.componentRef.setInput('isGlobus', true);
    fixture.componentRef.setInput('taskId', 'task-xyz');
    fixture.detectChanges();

    expect(component.formattedMonitorUrl()).toBe(
      'https://app.globus.org/activity/task-xyz',
    );
  });

  it('uses custom monitor URL when provided', () => {
    fixture.componentRef.setInput('isGlobus', true);
    fixture.componentRef.setInput('taskId', 'task-custom');
    fixture.componentRef.setInput('monitorUrl', 'https://custom.monitor/url');
    fixture.detectChanges();

    expect(component.formattedMonitorUrl()).toBe('https://custom.monitor/url');
  });

  it('returns undefined monitor URL when no taskId', () => {
    fixture.componentRef.setInput('taskId', null);
    fixture.detectChanges();

    expect(component.formattedMonitorUrl()).toBeUndefined();
  });

  it('opens monitor URL in new window', () => {
    spyOn(window, 'open');
    fixture.componentRef.setInput('isGlobus', true); // Must be Globus to show monitor URL
    fixture.componentRef.setInput('taskId', 'task-open');
    fixture.componentRef.setInput('monitorUrl', 'https://monitor.test/url');
    fixture.detectChanges();

    component.openGlobus();

    expect(window.open).toHaveBeenCalledWith(
      'https://monitor.test/url',
      '_blank',
      'noopener',
    );
  });

  it('does not open window when no monitor URL', () => {
    spyOn(window, 'open');
    fixture.componentRef.setInput('taskId', null);
    fixture.detectChanges();

    component.openGlobus();

    expect(window.open).not.toHaveBeenCalled();
  });

  it('refresh clears error and restarts polling', async () => {
    submit.statuses = [{ task_id: 'task-refresh', status: 'ACTIVE' }];

    fixture.componentRef.setInput('isGlobus', true);
    fixture.componentRef.setInput('taskId', 'task-refresh');
    component.statusPollingError.set('Previous error');
    fixture.detectChanges();

    await new Promise<void>((r) => setTimeout(r));

    component.refresh();

    expect(component.statusPollingError()).toBeUndefined();
    expect(component.statusPollingActive()).toBeTrue();
  });

  it('refresh does nothing when no taskId', () => {
    fixture.componentRef.setInput('taskId', null);
    component.statusPollingError.set('Some error');

    component.refresh();

    expect(component.statusPollingError()).toBe('Some error');
  });

  it('resets state when taskId changes to empty', async () => {
    submit.statuses = [{ task_id: 'task-reset', status: 'ACTIVE' }];

    fixture.componentRef.setInput('isGlobus', true);
    fixture.componentRef.setInput('taskId', 'task-reset');
    fixture.detectChanges();

    await new Promise<void>((r) => setTimeout(r));
    expect(component.statusPollingActive()).toBeTrue();

    fixture.componentRef.setInput('taskId', '');
    fixture.detectChanges(); // Trigger ngOnChanges

    expect(component.statusPollingActive()).toBeFalse();
    expect(component.status()).toBeUndefined();
    expect(component.statusPollingError()).toBeUndefined();
  });

  it('resets when submitting changes to false without taskId', () => {
    fixture.componentRef.setInput('submitting', true);
    fixture.componentRef.setInput('taskId', null);
    fixture.detectChanges();

    expect(component.hasStatus()).toBeTrue();

    fixture.componentRef.setInput('submitting', false);

    expect(component.status()).toBeUndefined();
  });

  it('recognizes FAILED as error status', async () => {
    submit.statuses = [
      {
        task_id: 'task-failed',
        status: 'FAILED',
        nice_status: 'Transfer failed',
      },
    ];

    fixture.componentRef.setInput('isGlobus', true);
    fixture.componentRef.setInput('taskId', 'task-failed');
    fixture.detectChanges();

    await new Promise<void>((r) => setTimeout(r));

    expect(component.statusTone()).toBe('error');
    expect(component.statusIcon()).toContain('exclamation');
    expect(component.statusMessage()).toContain('Transfer failed');
  });

  it('recognizes CANCELED as error status', async () => {
    submit.statuses = [
      {
        task_id: 'task-cancel',
        status: 'CANCELED',
        nice_status: 'Transfer canceled',
      },
    ];

    fixture.componentRef.setInput('isGlobus', true);
    fixture.componentRef.setInput('taskId', 'task-cancel');
    fixture.detectChanges();

    await new Promise<void>((r) => setTimeout(r));

    expect(component.statusTone()).toBe('error');
    expect(component.statusIcon()).toContain('exclamation');
  });

  it('stops polling on INACTIVE terminal status', () => {
    jasmine.clock().install();
    try {
      submit.statuses = [
        { task_id: 'task-inactive', status: 'ACTIVE' },
        { task_id: 'task-inactive', status: 'INACTIVE' },
      ];

      const completions: TransferTaskStatus[] = [];
      component.completed.subscribe((value) => completions.push(value));

      fixture.componentRef.setInput('isGlobus', true);
      fixture.componentRef.setInput('taskId', 'task-inactive');
      fixture.detectChanges();

      // immediate$ fires synchronously — ACTIVE
      expect(component.statusPollingActive()).toBeTrue();

      // Advance timer to trigger poll — INACTIVE (terminal)
      jasmine.clock().tick(5001);

      expect(component.status()!.status).toBe('INACTIVE');
      expect(component.statusPollingActive()).toBeFalse();
      expect(completions.length).toBe(1);
    } finally {
      jasmine.clock().uninstall();
    }
  });

  it('shows nice_status when present without SUCCEEDED/FAILED', async () => {
    submit.statuses = [
      {
        task_id: 'task-nice',
        status: 'QUEUED',
        nice_status: 'Processing files 45/100',
      },
    ];

    fixture.componentRef.setInput('isGlobus', true);
    fixture.componentRef.setInput('taskId', 'task-nice');
    fixture.detectChanges();

    await new Promise<void>((r) => setTimeout(r));

    expect(component.statusMessage()).toBe('Processing files 45/100');
  });

  it('shows status when no nice_status', async () => {
    submit.statuses = [
      {
        task_id: 'task-plain',
        status: 'PENDING',
      },
    ];

    fixture.componentRef.setInput('isGlobus', true);
    fixture.componentRef.setInput('taskId', 'task-plain');
    fixture.detectChanges();

    await new Promise<void>((r) => setTimeout(r));

    expect(component.statusMessage()).toBe('Current status: PENDING');
  });

  it('defaults to waiting message when status is empty', async () => {
    submit.statuses = [
      {
        task_id: 'task-empty',
        status: '',
      },
    ];

    fixture.componentRef.setInput('isGlobus', true);
    fixture.componentRef.setInput('taskId', 'task-empty');
    fixture.detectChanges();

    await new Promise<void>((r) => setTimeout(r));

    expect(component.statusMessage()).toBe('Waiting for Globus updates…');
  });

  it('shows error message with status when FAILED without nice_status', async () => {
    submit.statuses = [
      {
        task_id: 'task-plain-fail',
        status: 'FAILED',
      },
    ];

    fixture.componentRef.setInput('isGlobus', true);
    fixture.componentRef.setInput('taskId', 'task-plain-fail');
    fixture.detectChanges();

    await new Promise<void>((r) => setTimeout(r));

    expect(component.statusMessage()).toContain(
      'Transfer ended with status FAILED',
    );
  });

  it('shows success message without nice_status', async () => {
    submit.statuses = [
      {
        task_id: 'task-plain-success',
        status: 'SUCCEEDED',
      },
    ];

    fixture.componentRef.setInput('isGlobus', true);
    fixture.componentRef.setInput('taskId', 'task-plain-success');
    fixture.detectChanges();

    await new Promise<void>((r) => setTimeout(r));

    expect(component.statusMessage()).toBe('Transfer completed successfully.');
  });

  it('clamps progress to 0-100 range', async () => {
    submit.statuses = [
      {
        task_id: 'task-clamp',
        status: 'ACTIVE',
        bytes_transferred: 500,
        bytes_expected: 100, // More transferred than expected (edge case)
      },
    ];

    fixture.componentRef.setInput('isGlobus', true);
    fixture.componentRef.setInput('taskId', 'task-clamp');
    fixture.detectChanges();

    await new Promise<void>((r) => setTimeout(r));

    expect(component.transferProgress()).toBe(100); // Clamped to max
  });

  it('does not emit pollingChange when state stays the same', async () => {
    submit.statuses = [{ task_id: 'task-same', status: 'ACTIVE' }];

    const pollingStates: boolean[] = [];
    component.pollingChange.subscribe((value) => pollingStates.push(value));

    fixture.componentRef.setInput('isGlobus', true);
    fixture.componentRef.setInput('taskId', 'task-same');
    fixture.detectChanges();

    await new Promise<void>((r) => setTimeout(r));

    // Should only emit once (true) not twice
    expect(pollingStates).toEqual([true]);
  });

  it('returns empty files summary when no status', () => {
    fixture.componentRef.setInput('taskId', null);
    fixture.detectChanges();

    const summary = component.filesSummary();
    expect(summary.total).toBe(0);
    expect(summary.processed).toBe(0);
    expect(summary.failed).toBe(0);
  });

  it('correctly encodes taskId in monitor URL', () => {
    fixture.componentRef.setInput('isGlobus', true);
    fixture.componentRef.setInput('taskId', 'task/with/slashes');
    fixture.detectChanges();

    expect(component.formattedMonitorUrl()).toContain(
      encodeURIComponent('task/with/slashes'),
    );
    expect(component.formattedMonitorUrl()).toBe(
      'https://app.globus.org/activity/task%2Fwith%2Fslashes',
    );
  });

  it('counts Update files as complete when status is Equal', async () => {
    const mockFiles = [
      {
        id: '1',
        name: 'file1.txt',
        action: Fileaction.Update,
        status: Filestatus.Equal,
      } as any,
      {
        id: '2',
        name: 'file2.txt',
        action: Fileaction.Update,
        status: Filestatus.Updated,
      } as any,
    ];
    dataUpdates.updateData.and.returnValue(of({ data: mockFiles }));

    fixture.componentRef.setInput('isGlobus', false);
    fixture.componentRef.setInput('data', mockFiles);
    fixture.componentRef.setInput('taskId', 'pid-update');

    await new Promise<void>((r) => setTimeout(r));
    fixture.detectChanges();

    // Only file1 should be complete (Equal), file2 is still in progress (Updated)
    expect(component.status()!.files).toBe(2);
    expect(component.status()!.files_transferred).toBe(1);
    expect(component.statusMessage()).toContain('Transfer in progress');
  });

  it('counts Delete files as complete when status is New', async () => {
    const mockFiles = [
      {
        id: '1',
        name: 'file1.txt',
        action: Fileaction.Delete,
        status: Filestatus.New,
      } as any,
      {
        id: '2',
        name: 'file2.txt',
        action: Fileaction.Delete,
        status: Filestatus.Deleted,
      } as any,
    ];
    dataUpdates.updateData.and.returnValue(of({ data: mockFiles }));

    fixture.componentRef.setInput('isGlobus', false);
    fixture.componentRef.setInput('data', mockFiles);
    fixture.componentRef.setInput('taskId', 'pid-delete');

    await new Promise<void>((r) => setTimeout(r));
    fixture.detectChanges();

    // Only file1 should be complete (New), file2 is still being deleted (Deleted)
    expect(component.status()!.files).toBe(2);
    expect(component.status()!.files_transferred).toBe(1);
    expect(component.statusMessage()).toContain('Transfer in progress');
  });

  it('handles Ignore action files (no progress counted)', async () => {
    const mockFiles = [
      {
        id: '1',
        name: 'file1.txt',
        action: Fileaction.Ignore,
        status: Filestatus.Equal,
      } as any,
      {
        id: '2',
        name: 'file2.txt',
        action: Fileaction.Copy,
        status: Filestatus.Equal,
      } as any,
    ];
    dataUpdates.updateData.and.returnValue(of({ data: mockFiles }));

    fixture.componentRef.setInput('isGlobus', false);
    fixture.componentRef.setInput('data', mockFiles);
    fixture.componentRef.setInput('taskId', 'pid-ignore');

    await new Promise<void>((r) => setTimeout(r));
    fixture.detectChanges();

    // Only file2 (Copy) should count in total, file1 (Ignore) should not be counted at all
    expect(component.status()!.files).toBe(1);
    expect(component.status()!.files_transferred).toBe(1);
    // Transfer should be complete since all active files (1/1) are done
    expect(component.status()!.status).toBe('SUCCEEDED');
  });

  it('counts only active files when dataset has many existing (Ignore) files', async () => {
    // Simulate dataset with 300 existing files (Ignore) and 1 new file being uploaded (Copy)
    const mockFiles: any[] = [];
    // 300 existing files that should not be counted
    for (let i = 0; i < 300; i++) {
      mockFiles.push({
        id: `existing-${i}`,
        name: `existing-file-${i}.txt`,
        action: Fileaction.Ignore,
        status: Filestatus.Equal,
      });
    }
    // 1 new file being uploaded
    mockFiles.push({
      id: 'new-1',
      name: 'new-file.txt',
      action: Fileaction.Copy,
      status: Filestatus.Equal,
    });

    dataUpdates.updateData.and.returnValue(of({ data: mockFiles }));

    fixture.componentRef.setInput('isGlobus', false);
    fixture.componentRef.setInput('data', mockFiles);
    fixture.componentRef.setInput('taskId', 'pid-single-upload');

    await new Promise<void>((r) => setTimeout(r));
    fixture.detectChanges();

    // Should count only 1 file (the Copy action), not 301
    expect(component.status()!.files).toBe(1);
    expect(component.status()!.files_transferred).toBe(1);
    expect(component.status()!.status).toBe('SUCCEEDED');
  });

  it('marks transfer as succeeded when all files complete', async () => {
    const mockFiles = [
      {
        id: '1',
        name: 'file1.txt',
        action: Fileaction.Copy,
        status: Filestatus.Equal,
      } as any,
      {
        id: '2',
        name: 'file2.txt',
        action: Fileaction.Update,
        status: Filestatus.Equal,
      } as any,
      {
        id: '3',
        name: 'file3.txt',
        action: Fileaction.Delete,
        status: Filestatus.New,
      } as any,
    ];
    dataUpdates.updateData.and.returnValue(of({ data: mockFiles }));

    const completions: TransferTaskStatus[] = [];
    component.completed.subscribe((value) => completions.push(value));

    fixture.componentRef.setInput('isGlobus', false);
    fixture.componentRef.setInput('data', mockFiles);
    fixture.componentRef.setInput('taskId', 'pid-complete');

    await new Promise<void>((r) => setTimeout(r));
    fixture.detectChanges();

    // All files complete
    expect(component.status()!.status).toBe('SUCCEEDED');
    expect(component.statusMessage()).toContain(
      'Transfer completed successfully',
    );
    expect(component.statusPollingActive()).toBeFalse();
    expect(completions.length).toBe(1);
  });

  it('handles empty files array correctly', async () => {
    dataUpdates.updateData.and.returnValue(of({ data: [] }));

    fixture.componentRef.setInput('isGlobus', false);
    fixture.componentRef.setInput('data', []);
    fixture.componentRef.setInput('taskId', 'pid-empty');

    await new Promise<void>((r) => setTimeout(r));
    fixture.detectChanges();

    // Empty transfer is considered complete
    expect(component.status()!.files).toBe(0);
    expect(component.status()!.files_transferred).toBe(0);
    expect(component.status()!.status).toBe('SUCCEEDED');
    expect(component.statusMessage()).toContain(
      'Transfer completed successfully',
    );
  });

  it('handles dataUpdate callback when provided', async () => {
    const mockFiles = [
      {
        id: '1',
        name: 'file1.txt',
        action: Fileaction.Copy,
        status: Filestatus.New,
      } as any,
    ];
    const updatedFiles = [
      {
        id: '1',
        name: 'file1.txt',
        action: Fileaction.Copy,
        status: Filestatus.Equal,
      } as any,
    ];
    dataUpdates.updateData.and.returnValue(of({ data: updatedFiles }));

    let callbackInvoked = false;
    fixture.componentRef.setInput('dataUpdate', (updated: any) => {
      callbackInvoked = true;
      expect(updated.data).toEqual(updatedFiles);
    });

    fixture.componentRef.setInput('isGlobus', false);
    fixture.componentRef.setInput('data', mockFiles);
    fixture.componentRef.setInput('taskId', 'pid-callback');
    fixture.detectChanges();

    await new Promise<void>((r) => setTimeout(r));
    fixture.detectChanges();

    expect(callbackInvoked).toBeTrue();
  });

  it('builds status without calling updateData when data is falsy', async () => {
    fixture.componentRef.setInput('isGlobus', false);
    fixture.componentRef.setInput('data', null);
    fixture.componentRef.setInput('taskId', 'pid-no-data');

    await new Promise<void>((r) => setTimeout(r));
    fixture.detectChanges();

    // Should not have called updateData
    expect(dataUpdates.updateData).not.toHaveBeenCalled();

    // Should show completed status for null data
    expect(component.status()!.status).toBe('SUCCEEDED');
  });

  it('shows Globus-specific waiting message when not polling', () => {
    fixture.componentRef.setInput('isGlobus', true);
    fixture.componentRef.setInput('taskId', null);
    component.statusPollingActive.set(false);
    fixture.detectChanges();

    expect(component.statusMessage()).toContain('Waiting for Globus updates');
  });

  it('shows non-Globus waiting message when not polling', () => {
    fixture.componentRef.setInput('isGlobus', false);
    fixture.componentRef.setInput('taskId', null);
    component.statusPollingActive.set(false);
    fixture.detectChanges();

    expect(component.statusMessage()).toContain('Waiting for status updates');
    expect(component.statusMessage()).not.toContain('Globus');
  });

  it('cleans up subscriptions on destroy', async () => {
    submit.statuses = [{ task_id: 'task-destroy', status: 'ACTIVE' }];

    fixture.componentRef.setInput('isGlobus', true);
    fixture.componentRef.setInput('taskId', 'task-destroy');
    fixture.detectChanges();

    await new Promise<void>((r) => setTimeout(r));
    expect(component.statusPollingActive()).toBeTrue();

    // Destroy the component by destroying the fixture
    fixture.destroy();

    // After fixture destroyed, polling should have been cleaned up
    // Note: We can't check statusPollingActive since the component is destroyed
  });

  it('shows generic error message when error has no specific message', async () => {
    submit.errors = [new Error()]; // Error with no message

    fixture.componentRef.setInput('isGlobus', true);
    fixture.componentRef.setInput('taskId', 'task-generic-error');
    fixture.detectChanges();

    await new Promise<void>((r) => setTimeout(r));

    expect(component.statusPollingError()).toContain(
      'Unable to retrieve the latest status from Globus',
    );
    expect(component.statusTone()).toBe('error');
  });

  it('shows generic error message for non-Globus when error has no specific message', async () => {
    dataUpdates.updateData.and.returnValue(throwError(() => new Error()));

    fixture.componentRef.setInput('isGlobus', false);
    fixture.componentRef.setInput('data', []);
    fixture.componentRef.setInput('taskId', 'pid-generic-error');
    fixture.detectChanges();

    await new Promise<void>((r) => setTimeout(r));

    expect(component.statusPollingError()).toContain(
      'Unable to retrieve the latest transfer status',
    );
    expect(component.statusPollingError()).not.toContain('Globus');
    expect(component.statusTone()).toBe('error');
  });

  it('uses error.error property when available', async () => {
    submit.errors = [{ error: 'Custom error from API', status: 500 }];

    fixture.componentRef.setInput('isGlobus', true);
    fixture.componentRef.setInput('taskId', 'task-error-property');
    fixture.detectChanges();

    await new Promise<void>((r) => setTimeout(r));

    expect(component.statusPollingError()).toBe('Custom error from API');
  });

  it('detects INACTIVE as terminal status', () => {
    jasmine.clock().install();
    try {
      submit.statuses = [
        { task_id: 'task-inactive-check', status: 'ACTIVE' },
        { task_id: 'task-inactive-check', status: 'INACTIVE' },
      ];

      fixture.componentRef.setInput('isGlobus', true);
      fixture.componentRef.setInput('taskId', 'task-inactive-check');
      fixture.detectChanges();

      // immediate$ fires synchronously — ACTIVE
      expect(component.statusPollingActive()).toBeTrue();

      // Advance timer to trigger poll — INACTIVE (terminal)
      jasmine.clock().tick(5001);

      // Should have stopped polling
      expect(component.status()!.status).toBe('INACTIVE');
      expect(component.statusPollingActive()).toBeFalse();
    } finally {
      jasmine.clock().uninstall();
    }
  });

  it('clamps progress to 0-100 range when calculation exceeds bounds', async () => {
    submit.statuses = [
      {
        task_id: 'task-clamp',
        status: 'ACTIVE',
        bytes_transferred: 150,
        bytes_expected: 100, // Transferred more than expected
      },
    ];

    fixture.componentRef.setInput('isGlobus', true);
    fixture.componentRef.setInput('taskId', 'task-clamp');

    await new Promise<void>((r) => setTimeout(r));
    fixture.detectChanges();

    // Should be clamped to 100
    expect(component.transferProgress()).toBe(100);
  });

  it('returns correct statusIcon for info status', async () => {
    submit.statuses = [
      {
        task_id: 'task-icon-info',
        status: 'ACTIVE',
      },
    ];

    fixture.componentRef.setInput('isGlobus', true);
    fixture.componentRef.setInput('taskId', 'task-icon-info');

    await new Promise<void>((r) => setTimeout(r));
    fixture.detectChanges();

    expect(component.statusIcon()).toContain('spinner');
    expect(component.statusTone()).toBe('info');
  });

  it('returns correct statusIcon for success status', async () => {
    submit.statuses = [
      {
        task_id: 'task-icon-success',
        status: 'SUCCEEDED',
      },
    ];

    fixture.componentRef.setInput('isGlobus', true);
    fixture.componentRef.setInput('taskId', 'task-icon-success');

    await new Promise<void>((r) => setTimeout(r));
    fixture.detectChanges();

    expect(component.statusIcon()).toContain('check');
    expect(component.statusTone()).toBe('success');
  });

  it('returns correct statusIcon for error status', async () => {
    submit.statuses = [
      {
        task_id: 'task-icon-error',
        status: 'FAILED',
      },
    ];

    fixture.componentRef.setInput('isGlobus', true);
    fixture.componentRef.setInput('taskId', 'task-icon-error');

    await new Promise<void>((r) => setTimeout(r));
    fixture.detectChanges();

    expect(component.statusIcon()).toContain('exclamation');
    expect(component.statusTone()).toBe('error');
  });

  it('hasStatus returns true when submitting', () => {
    fixture.componentRef.setInput('submitting', true);
    // Don't set taskId to ensure no status polling happens
    fixture.componentRef.setInput('taskId', null);
    fixture.detectChanges();

    expect(component.hasStatus()).toBeTrue();
  });

  it('hasStatus returns true when status exists', async () => {
    submit.statuses = [
      {
        task_id: 'task-has-status',
        status: 'ACTIVE',
      },
    ];

    fixture.componentRef.setInput('isGlobus', true);
    fixture.componentRef.setInput('taskId', 'task-has-status');

    await new Promise<void>((r) => setTimeout(r));
    fixture.detectChanges();

    expect(component.hasStatus()).toBeTrue();
  });

  it('hasStatus returns false when not submitting and no status', () => {
    fixture.componentRef.setInput('submitting', false);
    // Don't set taskId to ensure no status is loaded
    fixture.componentRef.setInput('taskId', null);
    fixture.detectChanges();

    expect(component.hasStatus()).toBeFalse();
  });

  it('uses nice_status as statusMessage when available and not terminal', async () => {
    submit.statuses = [
      {
        task_id: 'task-nice',
        status: 'QUEUED',
        nice_status: 'Processing your files',
      },
    ];

    fixture.componentRef.setInput('isGlobus', true);
    fixture.componentRef.setInput('taskId', 'task-nice');

    await new Promise<void>((r) => setTimeout(r));
    fixture.detectChanges();

    expect(component.statusMessage()).toBe('Processing your files');
  });

  it('falls back to "Current status: X" when no nice_status', async () => {
    submit.statuses = [
      {
        task_id: 'task-fallback',
        status: 'PENDING',
        nice_status: '',
      },
    ];

    fixture.componentRef.setInput('isGlobus', true);
    fixture.componentRef.setInput('taskId', 'task-fallback');

    await new Promise<void>((r) => setTimeout(r));
    fixture.detectChanges();

    expect(component.statusMessage()).toBe('Current status: PENDING');
  });

  it('uses empty nice_status as default Globus waiting message when status but no value', async () => {
    submit.statuses = [
      {
        task_id: 'task-empty-nice',
        status: '',
        nice_status: '',
      },
    ];

    fixture.componentRef.setInput('isGlobus', true);
    fixture.componentRef.setInput('taskId', 'task-empty-nice');

    await new Promise<void>((r) => setTimeout(r));
    fixture.detectChanges();

    expect(component.statusMessage()).toContain('Waiting for Globus updates');
  });

  it('renders completion_time in template when available', async () => {
    submit.statuses = [
      {
        task_id: 'task-completion-time',
        status: 'SUCCEEDED',
        completion_time: '2025-01-10T12:00:00Z',
      },
    ];

    fixture.componentRef.setInput('isGlobus', true);
    fixture.componentRef.setInput('taskId', 'task-completion-time');

    await new Promise<void>((r) => setTimeout(r));
    fixture.detectChanges();

    const compiled = fixture.nativeElement;
    expect(compiled.textContent).toContain('Completed at:');
    expect(compiled.textContent).toContain('2025-01-10T12:00:00Z');
  });

  it('renders request_time when completion_time not available', async () => {
    submit.statuses = [
      {
        task_id: 'task-request-time',
        status: 'ACTIVE',
        request_time: '2025-01-10T11:00:00Z',
      },
    ];

    fixture.componentRef.setInput('isGlobus', true);
    fixture.componentRef.setInput('taskId', 'task-request-time');

    await new Promise<void>((r) => setTimeout(r));
    fixture.detectChanges();

    const compiled = fixture.nativeElement;
    expect(compiled.textContent).toContain('Started at:');
    expect(compiled.textContent).toContain('2025-01-10T11:00:00Z');
  });

  it('renders files progress in template', async () => {
    submit.statuses = [
      {
        task_id: 'task-files-display',
        status: 'ACTIVE',
        files: 2,
        files_transferred: 1,
        files_skipped: 0,
        files_failed: 0,
      },
    ];

    fixture.componentRef.setInput('isGlobus', true);
    fixture.componentRef.setInput('taskId', 'task-files-display');

    await new Promise<void>((r) => setTimeout(r));
    fixture.detectChanges();

    const compiled = fixture.nativeElement;
    expect(compiled.textContent).toContain('Files processed');
    expect(compiled.textContent).toContain('1/2');
  });

  it('scrolls the card into view when first displayed', async () => {
    // Initially detect changes with default state
    fixture.detectChanges();

    // Set submitting to true to trigger hasStatus() -> true
    fixture.componentRef.setInput('submitting', true);
    fixture.detectChanges();
    await new Promise<void>((r) => setTimeout(r)); // Let effects run

    // Now get the card element via viewChild signal
    const cardEl = component['cardRoot']()?.nativeElement as HTMLElement;
    expect(cardEl).toBeTruthy();

    // Verify the scroll would have been attempted
    // Since scrollIntoView is called in setTimeout, we need to flush
    await new Promise<void>((r) => setTimeout(r, 100));

    // The scroll logic ran - we verify by checking hasRenderedCard is now true
    expect((component as any).hasRenderedCard).toBeTrue();
  });

  it('renders failed files count when present', async () => {
    submit.statuses = [
      {
        task_id: 'task-failed-files',
        status: 'ACTIVE',
        files: 10,
        files_transferred: 5,
        files_skipped: 2,
        files_failed: 3,
      },
    ];

    fixture.componentRef.setInput('isGlobus', true);
    fixture.componentRef.setInput('taskId', 'task-failed-files');

    await new Promise<void>((r) => setTimeout(r));
    fixture.detectChanges();

    const compiled = fixture.nativeElement;
    expect(compiled.textContent).toContain('Failed: 3');
  });

  it('does not render failed files count when zero', async () => {
    submit.statuses = [
      {
        task_id: 'task-no-failed',
        status: 'ACTIVE',
        files: 10,
        files_transferred: 7,
        files_skipped: 3,
        files_failed: 0,
      },
    ];

    fixture.componentRef.setInput('isGlobus', true);
    fixture.componentRef.setInput('taskId', 'task-no-failed');

    await new Promise<void>((r) => setTimeout(r));
    fixture.detectChanges();

    const compiled = fixture.nativeElement;
    expect(compiled.textContent).not.toContain('Failed:');
  });

  it('hides refresh button when polling is active', async () => {
    submit.statuses = [{ task_id: 'task-disable-refresh', status: 'ACTIVE' }];

    fixture.componentRef.setInput('isGlobus', true);
    fixture.componentRef.setInput('taskId', 'task-disable-refresh');

    await new Promise<void>((r) => setTimeout(r));
    fixture.detectChanges();

    const refreshButton = fixture.nativeElement.querySelector(
      'button:not(.monitor-link)',
    );
    expect(refreshButton).toBeNull();
  });

  it('shows refresh button when polling is not active and not succeeded', async () => {
    submit.statuses = [{ task_id: 'task-enable-refresh', status: 'INACTIVE' }];

    fixture.componentRef.setInput('isGlobus', true);
    fixture.componentRef.setInput('taskId', 'task-enable-refresh');

    await new Promise<void>((r) => setTimeout(r));
    fixture.detectChanges();

    // Wait for terminal status to stop polling
    expect(component.statusPollingActive()).toBeFalse();

    const refreshButton = fixture.nativeElement.querySelector(
      'button:not(.monitor-link)',
    );
    expect(refreshButton).not.toBeNull();
  });

  it('renders task ID in template', async () => {
    submit.statuses = [
      {
        task_id: 'display-task-123',
        status: 'ACTIVE',
      },
    ];

    fixture.componentRef.setInput('isGlobus', true);
    fixture.componentRef.setInput('taskId', 'display-task-123');

    await new Promise<void>((r) => setTimeout(r));
    fixture.detectChanges();

    const compiled = fixture.nativeElement;
    expect(compiled.textContent).toContain('Task ID:');
    expect(compiled.textContent).toContain('display-task-123');
  });
});
