import { SimpleChange } from '@angular/core';
import {
  ComponentFixture,
  TestBed,
  fakeAsync,
  tick,
} from '@angular/core/testing';
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
    submit = TestBed.inject(SubmitService) as unknown as MockSubmitService;
    dataUpdates = TestBed.inject(
      DataUpdatesService,
    ) as unknown as MockDataUpdatesService;
  });

  afterEach(() => {
    component.ngOnDestroy();
    dataUpdates.updateData.calls.reset();
  });

  it('polls status until terminal state and emits events', fakeAsync(() => {
    submit.statuses = [
      { task_id: 'task-1', status: 'ACTIVE' },
      { task_id: 'task-1', status: 'SUCCEEDED', nice_status: 'All done' },
    ];

    const pollingStates: boolean[] = [];
    component.pollingChange.subscribe((value) => pollingStates.push(value));
    const completions: TransferTaskStatus[] = [];
    component.completed.subscribe((value) => completions.push(value));

    component.isGlobus = true;
    component.taskId = 'task-1';
    component.ngOnChanges({ taskId: new SimpleChange(null, 'task-1', true) });
    fixture.detectChanges();

    expect(component.hasStatus).toBeTrue();

    tick();
    expect(component.status?.status).toBe('ACTIVE');
    expect(component.statusPollingActive).toBeTrue();

    tick(5000);
    tick();
    expect(component.status?.status).toBe('SUCCEEDED');
    expect(component.statusMessage).toContain('All done');
    expect(component.statusPollingActive).toBeFalse();
    expect(completions.length).toBe(1);
    expect(pollingStates).toEqual([true, false]);
  }));

  it('shows error message when polling fails', fakeAsync(() => {
    submit.errors = [{ status: 401 }];

    component.isGlobus = true;
    component.taskId = 'task-2';
    component.ngOnChanges({ taskId: new SimpleChange(null, 'task-2', true) });
    fixture.detectChanges();

    tick();

    expect(component.statusPollingActive).toBeFalse();
    expect(component.statusMessage).toContain('Globus session expired');
    expect(component.statusIcon).toContain('exclamation');
  }));

  it('shows error message for non-globus when polling fails with 401', fakeAsync(() => {
    const mockError = { status: 401 };
    dataUpdates.updateData.and.returnValue(throwError(() => mockError));

    component.isGlobus = false;
    component.data = [];
    component.taskId = 'pid-123';
    component.ngOnChanges({ taskId: new SimpleChange(null, 'pid-123', true) });
    fixture.detectChanges();

    tick();

    expect(component.statusPollingActive).toBeFalse();
    expect(component.statusMessage).toContain('Session expired');
    expect(component.statusMessage).not.toContain('Globus');
    expect(component.statusIcon).toContain('exclamation');
    expect(component.statusTone).toBe('error');
  }));

  it('handles generic error message from error object', fakeAsync(() => {
    const mockError = { error: 'Custom error message' };
    submit.errors = [mockError];

    component.isGlobus = true;
    component.taskId = 'task-3';
    component.ngOnChanges({ taskId: new SimpleChange(null, 'task-3', true) });
    fixture.detectChanges();

    tick();

    expect(component.statusPollingError).toBe('Custom error message');
    expect(component.statusMessage).toBe('Custom error message');
  }));

  it('handles error with message property', fakeAsync(() => {
    const mockError = { message: 'Network timeout' };
    submit.errors = [mockError];

    component.isGlobus = true;
    component.taskId = 'task-4';
    component.ngOnChanges({ taskId: new SimpleChange(null, 'task-4', true) });
    fixture.detectChanges();

    tick();

    expect(component.statusPollingError).toBe('Network timeout');
  }));

  it('uses default error message for globus when no specific error', fakeAsync(() => {
    const mockError = {};
    submit.errors = [mockError];

    component.isGlobus = true;
    component.taskId = 'task-5';
    component.ngOnChanges({ taskId: new SimpleChange(null, 'task-5', true) });
    fixture.detectChanges();

    tick();

    expect(component.statusPollingError).toContain(
      'Unable to retrieve the latest status from Globus',
    );
  }));

  it('uses default error message for non-globus when no specific error', fakeAsync(() => {
    const mockError = {};
    dataUpdates.updateData.and.returnValue(throwError(() => mockError));

    component.isGlobus = false;
    component.data = [];
    component.taskId = 'pid-456';
    component.ngOnChanges({ taskId: new SimpleChange(null, 'pid-456', true) });
    fixture.detectChanges();

    tick();

    expect(component.statusPollingError).toContain(
      'Unable to retrieve the latest transfer status',
    );
    expect(component.statusPollingError).not.toContain('Globus');
  }));

  it('renders submitting-only state messaging', () => {
    component.submitting = true;
    fixture.detectChanges();

    expect(component.hasStatus).toBeTrue();
    expect(component.statusMessage).toContain('Submitting transfer request');
    expect(component.statusIcon).toContain('spinner');
    expect(component.statusTone).toBe('info');
  });

  it('shows waiting message when no status and not polling for globus', () => {
    component.isGlobus = true;
    component.taskId = 'task-waiting';
    fixture.detectChanges();

    expect(component.statusMessage).toContain('Waiting for Globus updates');
  });

  it('shows waiting message when no status and not polling for non-globus', () => {
    component.isGlobus = false;
    component.taskId = 'pid-waiting';
    fixture.detectChanges();

    expect(component.statusMessage).toContain('Waiting for status updates');
    expect(component.statusMessage).not.toContain('Globus');
  });

  it('starts polling immediately when taskId is set for globus', fakeAsync(() => {
    submit.statuses = [{ task_id: 'task-check', status: 'ACTIVE' }];

    component.isGlobus = true;
    component.taskId = 'task-check';
    component.ngOnChanges({
      taskId: new SimpleChange(null, 'task-check', true),
    });
    fixture.detectChanges();

    // Polling should be active
    expect(component.statusPollingActive).toBeTrue();

    tick();
    fixture.detectChanges();

    // Status should be retrieved
    expect(component.status?.status).toBe('ACTIVE');
    expect(component.statusMessage).toContain('ACTIVE');
  }));

  it('starts polling immediately when taskId is set for non-globus', fakeAsync(() => {
    const mockFiles = [
      {
        id: '1',
        name: 'file.txt',
        action: Fileaction.Copy,
        status: Filestatus.New,
      } as any,
    ];
    dataUpdates.updateData.and.returnValue(of({ data: mockFiles }));

    component.isGlobus = false;
    component.data = mockFiles;
    component.taskId = 'pid-check';
    component.ngOnChanges({
      taskId: new SimpleChange(null, 'pid-check', true),
      data: new SimpleChange(null, mockFiles, true),
    });
    fixture.detectChanges();

    // Polling should be active initially
    expect(component.statusPollingActive).toBeTrue();

    tick();
    fixture.detectChanges();

    // Should have computed status from data - one file in progress (not complete)
    expect(component.status).toBeDefined();
    expect(component.statusMessage).toContain('Transfer in progress');
  }));

  it('computes transfer progress when bytes known', fakeAsync(() => {
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

    component.isGlobus = true;
    component.taskId = 'task-progress';
    component.ngOnChanges({
      taskId: new SimpleChange(null, 'task-progress', true),
    });
    fixture.detectChanges();

    tick();
    expect(component.transferProgress).toBe(50);

    tick(5000);
    tick();
    expect(component.transferProgress).toBe(100);
  }));

  it('returns undefined progress when bytes_expected is zero', fakeAsync(() => {
    submit.statuses = [
      {
        task_id: 'task-no-bytes',
        status: 'ACTIVE',
        bytes_transferred: 100,
        bytes_expected: 0,
      },
    ];

    component.isGlobus = true;
    component.taskId = 'task-no-bytes';
    component.ngOnChanges({
      taskId: new SimpleChange(null, 'task-no-bytes', true),
    });
    fixture.detectChanges();

    tick();
    expect(component.transferProgress).toBeUndefined();
  }));

  it('calculates files summary correctly', fakeAsync(() => {
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

    component.isGlobus = true;
    component.taskId = 'task-files';
    component.ngOnChanges({
      taskId: new SimpleChange(null, 'task-files', true),
    });
    fixture.detectChanges();

    tick();
    const summary = component.filesSummary;
    expect(summary.total).toBe(100);
    expect(summary.processed).toBe(60); // transferred + skipped
    expect(summary.failed).toBe(5);
  }));

  it('creates monitor link when task id present', () => {
    component.isGlobus = true;
    component.taskId = 'task-xyz';
    component.ngOnChanges({ taskId: new SimpleChange(null, 'task-xyz', true) });
    fixture.detectChanges();

    expect(component.formattedMonitorUrl).toBe(
      'https://app.globus.org/activity/task-xyz',
    );
  });

  it('uses custom monitor URL when provided', () => {
    component.isGlobus = true;
    component.taskId = 'task-custom';
    component.monitorUrl = 'https://custom.monitor/url';
    fixture.detectChanges();

    expect(component.formattedMonitorUrl).toBe('https://custom.monitor/url');
  });

  it('returns undefined monitor URL when no taskId', () => {
    component.taskId = null;
    fixture.detectChanges();

    expect(component.formattedMonitorUrl).toBeUndefined();
  });

  it('opens monitor URL in new window', () => {
    spyOn(window, 'open');
    component.isGlobus = true; // Must be Globus to show monitor URL
    component.taskId = 'task-open';
    component.monitorUrl = 'https://monitor.test/url';
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
    component.taskId = null;
    fixture.detectChanges();

    component.openGlobus();

    expect(window.open).not.toHaveBeenCalled();
  });

  it('refresh clears error and restarts polling', fakeAsync(() => {
    submit.statuses = [{ task_id: 'task-refresh', status: 'ACTIVE' }];

    component.isGlobus = true;
    component.taskId = 'task-refresh';
    component.statusPollingError = 'Previous error';
    component.ngOnChanges({
      taskId: new SimpleChange(null, 'task-refresh', true),
    });
    fixture.detectChanges();

    tick();

    component.refresh();

    expect(component.statusPollingError).toBeUndefined();
    expect(component.statusPollingActive).toBeTrue();
  }));

  it('refresh does nothing when no taskId', () => {
    component.taskId = null;
    component.statusPollingError = 'Some error';

    component.refresh();

    expect(component.statusPollingError).toBe('Some error');
  });

  it('resets state when taskId changes to empty', fakeAsync(() => {
    submit.statuses = [{ task_id: 'task-reset', status: 'ACTIVE' }];

    component.isGlobus = true;
    component.taskId = 'task-reset';
    component.ngOnChanges({
      taskId: new SimpleChange(null, 'task-reset', true),
    });
    fixture.detectChanges();

    tick();
    expect(component.statusPollingActive).toBeTrue();

    component.taskId = '';
    component.ngOnChanges({
      taskId: new SimpleChange('task-reset', '', false),
    });

    expect(component.statusPollingActive).toBeFalse();
    expect(component.status).toBeUndefined();
    expect(component.statusPollingError).toBeUndefined();
  }));

  it('resets when submitting changes to false without taskId', () => {
    component.submitting = true;
    component.taskId = null;
    fixture.detectChanges();

    expect(component.hasStatus).toBeTrue();

    component.submitting = false;
    component.ngOnChanges({ submitting: new SimpleChange(true, false, false) });

    expect(component.status).toBeUndefined();
  });

  it('recognizes FAILED as error status', fakeAsync(() => {
    submit.statuses = [
      {
        task_id: 'task-failed',
        status: 'FAILED',
        nice_status: 'Transfer failed',
      },
    ];

    component.isGlobus = true;
    component.taskId = 'task-failed';
    component.ngOnChanges({
      taskId: new SimpleChange(null, 'task-failed', true),
    });
    fixture.detectChanges();

    tick();

    expect(component.statusTone).toBe('error');
    expect(component.statusIcon).toContain('exclamation');
    expect(component.statusMessage).toContain('Transfer failed');
  }));

  it('recognizes CANCELED as error status', fakeAsync(() => {
    submit.statuses = [
      {
        task_id: 'task-cancel',
        status: 'CANCELED',
        nice_status: 'Transfer canceled',
      },
    ];

    component.isGlobus = true;
    component.taskId = 'task-cancel';
    component.ngOnChanges({
      taskId: new SimpleChange(null, 'task-cancel', true),
    });
    fixture.detectChanges();

    tick();

    expect(component.statusTone).toBe('error');
    expect(component.statusIcon).toContain('exclamation');
  }));

  it('stops polling on INACTIVE terminal status', fakeAsync(() => {
    submit.statuses = [
      { task_id: 'task-inactive', status: 'ACTIVE' },
      { task_id: 'task-inactive', status: 'INACTIVE' },
    ];

    const completions: TransferTaskStatus[] = [];
    component.completed.subscribe((value) => completions.push(value));

    component.isGlobus = true;
    component.taskId = 'task-inactive';
    component.ngOnChanges({
      taskId: new SimpleChange(null, 'task-inactive', true),
    });
    fixture.detectChanges();

    tick();
    expect(component.statusPollingActive).toBeTrue();

    tick(5000);
    tick();

    expect(component.status?.status).toBe('INACTIVE');
    expect(component.statusPollingActive).toBeFalse();
    expect(completions.length).toBe(1);
  }));

  it('shows nice_status when present without SUCCEEDED/FAILED', fakeAsync(() => {
    submit.statuses = [
      {
        task_id: 'task-nice',
        status: 'ACTIVE',
        nice_status: 'Processing files 45/100',
      },
    ];

    component.isGlobus = true;
    component.taskId = 'task-nice';
    component.ngOnChanges({
      taskId: new SimpleChange(null, 'task-nice', true),
    });
    fixture.detectChanges();

    tick();

    expect(component.statusMessage).toBe('Processing files 45/100');
  }));

  it('shows status when no nice_status', fakeAsync(() => {
    submit.statuses = [
      {
        task_id: 'task-plain',
        status: 'PENDING',
      },
    ];

    component.isGlobus = true;
    component.taskId = 'task-plain';
    component.ngOnChanges({
      taskId: new SimpleChange(null, 'task-plain', true),
    });
    fixture.detectChanges();

    tick();

    expect(component.statusMessage).toBe('Current status: PENDING');
  }));

  it('defaults to waiting message when status is empty', fakeAsync(() => {
    submit.statuses = [
      {
        task_id: 'task-empty',
        status: '',
      },
    ];

    component.isGlobus = true;
    component.taskId = 'task-empty';
    component.ngOnChanges({
      taskId: new SimpleChange(null, 'task-empty', true),
    });
    fixture.detectChanges();

    tick();

    expect(component.statusMessage).toBe('Waiting for Globus updates…');
  }));

  it('shows error message with status when FAILED without nice_status', fakeAsync(() => {
    submit.statuses = [
      {
        task_id: 'task-plain-fail',
        status: 'FAILED',
      },
    ];

    component.isGlobus = true;
    component.taskId = 'task-plain-fail';
    component.ngOnChanges({
      taskId: new SimpleChange(null, 'task-plain-fail', true),
    });
    fixture.detectChanges();

    tick();

    expect(component.statusMessage).toContain(
      'Transfer ended with status FAILED',
    );
  }));

  it('shows success message without nice_status', fakeAsync(() => {
    submit.statuses = [
      {
        task_id: 'task-plain-success',
        status: 'SUCCEEDED',
      },
    ];

    component.isGlobus = true;
    component.taskId = 'task-plain-success';
    component.ngOnChanges({
      taskId: new SimpleChange(null, 'task-plain-success', true),
    });
    fixture.detectChanges();

    tick();

    expect(component.statusMessage).toBe('Transfer completed successfully.');
  }));

  it('clamps progress to 0-100 range', fakeAsync(() => {
    submit.statuses = [
      {
        task_id: 'task-clamp',
        status: 'ACTIVE',
        bytes_transferred: 500,
        bytes_expected: 100, // More transferred than expected (edge case)
      },
    ];

    component.isGlobus = true;
    component.taskId = 'task-clamp';
    component.ngOnChanges({
      taskId: new SimpleChange(null, 'task-clamp', true),
    });
    fixture.detectChanges();

    tick();

    expect(component.transferProgress).toBe(100); // Clamped to max
  }));

  it('does not emit pollingChange when state stays the same', fakeAsync(() => {
    submit.statuses = [{ task_id: 'task-same', status: 'ACTIVE' }];

    const pollingStates: boolean[] = [];
    component.pollingChange.subscribe((value) => pollingStates.push(value));

    component.isGlobus = true;
    component.taskId = 'task-same';
    component.ngOnChanges({
      taskId: new SimpleChange(null, 'task-same', true),
    });
    fixture.detectChanges();

    tick();

    // Should only emit once (true) not twice
    expect(pollingStates).toEqual([true]);
  }));

  it('returns empty files summary when no status', () => {
    component.taskId = null;
    fixture.detectChanges();

    const summary = component.filesSummary;
    expect(summary.total).toBe(0);
    expect(summary.processed).toBe(0);
    expect(summary.failed).toBe(0);
  });

  it('correctly encodes taskId in monitor URL', () => {
    component.isGlobus = true;
    component.taskId = 'task/with/slashes';
    fixture.detectChanges();

    expect(component.formattedMonitorUrl).toContain(
      encodeURIComponent('task/with/slashes'),
    );
    expect(component.formattedMonitorUrl).toBe(
      'https://app.globus.org/activity/task%2Fwith%2Fslashes',
    );
  });

  it('counts Update files as complete when status is Equal', fakeAsync(() => {
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

    component.isGlobus = false;
    component.data = mockFiles;
    component.taskId = 'pid-update';
    component.ngOnChanges({
      taskId: new SimpleChange(null, 'pid-update', true),
      data: new SimpleChange(null, mockFiles, true),
    });

    tick();
    fixture.detectChanges();

    // Only file1 should be complete (Equal), file2 is still in progress (Updated)
    expect(component.status?.files).toBe(2);
    expect(component.status?.files_transferred).toBe(1);
    expect(component.statusMessage).toContain('Transfer in progress');
  }));

  it('counts Delete files as complete when status is New', fakeAsync(() => {
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

    component.isGlobus = false;
    component.data = mockFiles;
    component.taskId = 'pid-delete';
    component.ngOnChanges({
      taskId: new SimpleChange(null, 'pid-delete', true),
      data: new SimpleChange(null, mockFiles, true),
    });

    tick();
    fixture.detectChanges();

    // Only file1 should be complete (New), file2 is still being deleted (Deleted)
    expect(component.status?.files).toBe(2);
    expect(component.status?.files_transferred).toBe(1);
    expect(component.statusMessage).toContain('Transfer in progress');
  }));

  it('handles Ignore action files (no progress counted)', fakeAsync(() => {
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

    component.isGlobus = false;
    component.data = mockFiles;
    component.taskId = 'pid-ignore';
    component.ngOnChanges({
      taskId: new SimpleChange(null, 'pid-ignore', true),
      data: new SimpleChange(null, mockFiles, true),
    });

    tick();
    fixture.detectChanges();

    // Only file2 (Copy) should count, file1 (Ignore) should not affect completion
    expect(component.status?.files).toBe(2);
    expect(component.status?.files_transferred).toBe(1);
  }));

  it('marks transfer as succeeded when all files complete', fakeAsync(() => {
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

    component.isGlobus = false;
    component.data = mockFiles;
    component.taskId = 'pid-complete';
    component.ngOnChanges({
      taskId: new SimpleChange(null, 'pid-complete', true),
      data: new SimpleChange(null, mockFiles, true),
    });

    tick();
    fixture.detectChanges();

    // All files complete
    expect(component.status?.status).toBe('SUCCEEDED');
    expect(component.statusMessage).toContain(
      'Transfer completed successfully',
    );
    expect(component.statusPollingActive).toBeFalse();
    expect(completions.length).toBe(1);
  }));

  it('handles empty files array correctly', fakeAsync(() => {
    dataUpdates.updateData.and.returnValue(of({ data: [] }));

    component.isGlobus = false;
    component.data = [];
    component.taskId = 'pid-empty';
    component.ngOnChanges({
      taskId: new SimpleChange(null, 'pid-empty', true),
      data: new SimpleChange(null, [], true),
    });

    tick();
    fixture.detectChanges();

    // Empty transfer is considered complete
    expect(component.status?.files).toBe(0);
    expect(component.status?.files_transferred).toBe(0);
    expect(component.status?.status).toBe('SUCCEEDED');
    expect(component.statusMessage).toContain(
      'Transfer completed successfully',
    );
  }));

  it('handles dataUpdate callback when provided', fakeAsync(() => {
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
    component.dataUpdate = (updated) => {
      callbackInvoked = true;
      expect(updated.data).toEqual(updatedFiles);
    };

    component.isGlobus = false;
    component.data = mockFiles;
    component.taskId = 'pid-callback';
    component.ngOnChanges({
      taskId: new SimpleChange(null, 'pid-callback', true),
      data: new SimpleChange(null, mockFiles, true),
    });

    tick();
    fixture.detectChanges();

    expect(callbackInvoked).toBeTrue();
  }));

  it('builds status without calling updateData when data is falsy', fakeAsync(() => {
    component.isGlobus = false;
    component.data = null;
    component.taskId = 'pid-no-data';
    component.ngOnChanges({
      taskId: new SimpleChange(null, 'pid-no-data', true),
    });

    tick();
    fixture.detectChanges();

    // Should not have called updateData
    expect(dataUpdates.updateData).not.toHaveBeenCalled();

    // Should show completed status for null data
    expect(component.status?.status).toBe('SUCCEEDED');
  }));

  it('shows Globus-specific waiting message when not polling', () => {
    component.isGlobus = true;
    component.taskId = null;
    component.statusPollingActive = false;
    fixture.detectChanges();

    expect(component.statusMessage).toContain('Waiting for Globus updates');
  });

  it('shows non-Globus waiting message when not polling', () => {
    component.isGlobus = false;
    component.taskId = null;
    component.statusPollingActive = false;
    fixture.detectChanges();

    expect(component.statusMessage).toContain('Waiting for status updates');
    expect(component.statusMessage).not.toContain('Globus');
  });

  it('cleans up subscriptions on destroy', fakeAsync(() => {
    submit.statuses = [{ task_id: 'task-destroy', status: 'ACTIVE' }];

    component.isGlobus = true;
    component.taskId = 'task-destroy';
    component.ngOnChanges({
      taskId: new SimpleChange(null, 'task-destroy', true),
    });
    fixture.detectChanges();

    tick();
    expect(component.statusPollingActive).toBeTrue();

    // Destroy the component
    component.ngOnDestroy();

    // Polling should be stopped
    expect(component.statusPollingActive).toBeFalse();
  }));

  it('shows generic error message when error has no specific message', fakeAsync(() => {
    submit.errors = [new Error()]; // Error with no message

    component.isGlobus = true;
    component.taskId = 'task-generic-error';
    component.ngOnChanges({
      taskId: new SimpleChange(null, 'task-generic-error', true),
    });
    fixture.detectChanges();

    tick();

    expect(component.statusPollingError).toContain(
      'Unable to retrieve the latest status from Globus',
    );
    expect(component.statusTone).toBe('error');
  }));

  it('shows generic error message for non-Globus when error has no specific message', fakeAsync(() => {
    dataUpdates.updateData.and.returnValue(throwError(() => new Error()));

    component.isGlobus = false;
    component.data = [];
    component.taskId = 'pid-generic-error';
    component.ngOnChanges({
      taskId: new SimpleChange(null, 'pid-generic-error', true),
      data: new SimpleChange(null, [], true),
    });
    fixture.detectChanges();

    tick();

    expect(component.statusPollingError).toContain(
      'Unable to retrieve the latest transfer status',
    );
    expect(component.statusPollingError).not.toContain('Globus');
    expect(component.statusTone).toBe('error');
  }));

  it('uses error.error property when available', fakeAsync(() => {
    submit.errors = [{ error: 'Custom error from API', status: 500 }];

    component.isGlobus = true;
    component.taskId = 'task-error-property';
    component.ngOnChanges({
      taskId: new SimpleChange(null, 'task-error-property', true),
    });
    fixture.detectChanges();

    tick();

    expect(component.statusPollingError).toBe('Custom error from API');
  }));

  it('detects INACTIVE as terminal status', fakeAsync(() => {
    submit.statuses = [
      { task_id: 'task-inactive-check', status: 'ACTIVE' },
      { task_id: 'task-inactive-check', status: 'INACTIVE' },
    ];

    component.isGlobus = true;
    component.taskId = 'task-inactive-check';
    component.ngOnChanges({
      taskId: new SimpleChange(null, 'task-inactive-check', true),
    });

    tick();
    expect(component.statusPollingActive).toBeTrue();

    tick(5000);
    tick();

    // Should have stopped polling
    expect(component.status?.status).toBe('INACTIVE');
    expect(component.statusPollingActive).toBeFalse();
  }));

  it('clamps progress to 0-100 range when calculation exceeds bounds', fakeAsync(() => {
    submit.statuses = [
      {
        task_id: 'task-clamp',
        status: 'ACTIVE',
        bytes_transferred: 150,
        bytes_expected: 100, // Transferred more than expected
      },
    ];

    component.isGlobus = true;
    component.taskId = 'task-clamp';
    component.ngOnChanges({
      taskId: new SimpleChange(null, 'task-clamp', true),
    });

    tick();
    fixture.detectChanges();

    // Should be clamped to 100
    expect(component.transferProgress).toBe(100);
  }));

  it('returns correct statusIcon for info status', fakeAsync(() => {
    submit.statuses = [
      {
        task_id: 'task-icon-info',
        status: 'ACTIVE',
      },
    ];

    component.isGlobus = true;
    component.taskId = 'task-icon-info';
    component.ngOnChanges({
      taskId: new SimpleChange(null, 'task-icon-info', true),
    });

    tick();
    fixture.detectChanges();

    expect(component.statusIcon).toContain('spinner');
    expect(component.statusTone).toBe('info');
  }));

  it('returns correct statusIcon for success status', fakeAsync(() => {
    submit.statuses = [
      {
        task_id: 'task-icon-success',
        status: 'SUCCEEDED',
      },
    ];

    component.isGlobus = true;
    component.taskId = 'task-icon-success';
    component.ngOnChanges({
      taskId: new SimpleChange(null, 'task-icon-success', true),
    });

    tick();
    fixture.detectChanges();

    expect(component.statusIcon).toContain('check');
    expect(component.statusTone).toBe('success');
  }));

  it('returns correct statusIcon for error status', fakeAsync(() => {
    submit.statuses = [
      {
        task_id: 'task-icon-error',
        status: 'FAILED',
      },
    ];

    component.isGlobus = true;
    component.taskId = 'task-icon-error';
    component.ngOnChanges({
      taskId: new SimpleChange(null, 'task-icon-error', true),
    });

    tick();
    fixture.detectChanges();

    expect(component.statusIcon).toContain('exclamation');
    expect(component.statusTone).toBe('error');
  }));

  it('hasStatus returns true when submitting', () => {
    component.submitting = true;
    component.status = undefined;
    fixture.detectChanges();

    expect(component.hasStatus).toBeTrue();
  });

  it('hasStatus returns true when status exists', fakeAsync(() => {
    submit.statuses = [
      {
        task_id: 'task-has-status',
        status: 'ACTIVE',
      },
    ];

    component.isGlobus = true;
    component.taskId = 'task-has-status';
    component.ngOnChanges({
      taskId: new SimpleChange(null, 'task-has-status', true),
    });

    tick();
    fixture.detectChanges();

    expect(component.hasStatus).toBeTrue();
  }));

  it('hasStatus returns false when not submitting and no status', () => {
    component.submitting = false;
    component.status = undefined;
    fixture.detectChanges();

    expect(component.hasStatus).toBeFalse();
  });

  it('uses nice_status as statusMessage when available and not terminal', fakeAsync(() => {
    submit.statuses = [
      {
        task_id: 'task-nice',
        status: 'ACTIVE',
        nice_status: 'Processing your files',
      },
    ];

    component.isGlobus = true;
    component.taskId = 'task-nice';
    component.ngOnChanges({
      taskId: new SimpleChange(null, 'task-nice', true),
    });

    tick();
    fixture.detectChanges();

    expect(component.statusMessage).toBe('Processing your files');
  }));

  it('falls back to "Current status: X" when no nice_status', fakeAsync(() => {
    submit.statuses = [
      {
        task_id: 'task-fallback',
        status: 'PENDING',
        nice_status: '',
      },
    ];

    component.isGlobus = true;
    component.taskId = 'task-fallback';
    component.ngOnChanges({
      taskId: new SimpleChange(null, 'task-fallback', true),
    });

    tick();
    fixture.detectChanges();

    expect(component.statusMessage).toBe('Current status: PENDING');
  }));

  it('uses empty nice_status as default Globus waiting message when status but no value', fakeAsync(() => {
    submit.statuses = [
      {
        task_id: 'task-empty-nice',
        status: '',
        nice_status: '',
      },
    ];

    component.isGlobus = true;
    component.taskId = 'task-empty-nice';
    component.ngOnChanges({
      taskId: new SimpleChange(null, 'task-empty-nice', true),
    });

    tick();
    fixture.detectChanges();

    expect(component.statusMessage).toContain('Waiting for Globus updates');
  }));

  it('renders completion_time in template when available', fakeAsync(() => {
    submit.statuses = [
      {
        task_id: 'task-completion-time',
        status: 'SUCCEEDED',
        completion_time: '2025-01-10T12:00:00Z',
      },
    ];

    component.isGlobus = true;
    component.taskId = 'task-completion-time';
    component.ngOnChanges({
      taskId: new SimpleChange(null, 'task-completion-time', true),
    });

    tick();
    fixture.detectChanges();

    const compiled = fixture.nativeElement;
    expect(compiled.textContent).toContain('Completed at:');
    expect(compiled.textContent).toContain('2025-01-10T12:00:00Z');
  }));

  it('renders request_time when completion_time not available', fakeAsync(() => {
    submit.statuses = [
      {
        task_id: 'task-request-time',
        status: 'ACTIVE',
        request_time: '2025-01-10T11:00:00Z',
      },
    ];

    component.isGlobus = true;
    component.taskId = 'task-request-time';
    component.ngOnChanges({
      taskId: new SimpleChange(null, 'task-request-time', true),
    });

    tick();
    fixture.detectChanges();

    const compiled = fixture.nativeElement;
    expect(compiled.textContent).toContain('Started at:');
    expect(compiled.textContent).toContain('2025-01-10T11:00:00Z');
  }));

  it('renders files progress in template', fakeAsync(() => {
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

    component.isGlobus = true;
    component.taskId = 'task-files-display';
    component.ngOnChanges({
      taskId: new SimpleChange(null, 'task-files-display', true),
    });

    tick();
    fixture.detectChanges();

    const compiled = fixture.nativeElement;
    expect(compiled.textContent).toContain('Files processed');
    expect(compiled.textContent).toContain('1/2');
  }));

  it('renders failed files count when present', fakeAsync(() => {
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

    component.isGlobus = true;
    component.taskId = 'task-failed-files';
    component.ngOnChanges({
      taskId: new SimpleChange(null, 'task-failed-files', true),
    });

    tick();
    fixture.detectChanges();

    const compiled = fixture.nativeElement;
    expect(compiled.textContent).toContain('Failed: 3');
  }));

  it('does not render failed files count when zero', fakeAsync(() => {
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

    component.isGlobus = true;
    component.taskId = 'task-no-failed';
    component.ngOnChanges({
      taskId: new SimpleChange(null, 'task-no-failed', true),
    });

    tick();
    fixture.detectChanges();

    const compiled = fixture.nativeElement;
    expect(compiled.textContent).not.toContain('Failed:');
  }));

  it('disables refresh button when polling is active', fakeAsync(() => {
    submit.statuses = [{ task_id: 'task-disable-refresh', status: 'ACTIVE' }];

    component.isGlobus = true;
    component.taskId = 'task-disable-refresh';
    component.ngOnChanges({
      taskId: new SimpleChange(null, 'task-disable-refresh', true),
    });

    tick();
    fixture.detectChanges();

    const refreshButton = fixture.nativeElement.querySelector(
      'button:not(.monitor-link)',
    );
    expect(refreshButton.disabled).toBeTrue();
  }));

  it('enables refresh button when polling is not active', fakeAsync(() => {
    submit.statuses = [{ task_id: 'task-enable-refresh', status: 'SUCCEEDED' }];

    component.isGlobus = true;
    component.taskId = 'task-enable-refresh';
    component.ngOnChanges({
      taskId: new SimpleChange(null, 'task-enable-refresh', true),
    });

    tick();
    fixture.detectChanges();

    // Wait for terminal status to stop polling
    expect(component.statusPollingActive).toBeFalse();

    const refreshButton = fixture.nativeElement.querySelector(
      'button:not(.monitor-link)',
    );
    expect(refreshButton.disabled).toBeFalse();
  }));

  it('renders task ID in template', fakeAsync(() => {
    submit.statuses = [
      {
        task_id: 'display-task-123',
        status: 'ACTIVE',
      },
    ];

    component.isGlobus = true;
    component.taskId = 'display-task-123';
    component.ngOnChanges({
      taskId: new SimpleChange(null, 'display-task-123', true),
    });

    tick();
    fixture.detectChanges();

    const compiled = fixture.nativeElement;
    expect(compiled.textContent).toContain('Task ID:');
    expect(compiled.textContent).toContain('display-task-123');
  }));
});
