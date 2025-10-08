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
import { CompareResult, ResultStatus } from '../../models/compare-result';
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
  let credentials: MockCredentialsService;
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
    credentials = TestBed.inject(
      CredentialsService,
    ) as unknown as MockCredentialsService;
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

    component.taskId = 'task-2';
    component.ngOnChanges({ taskId: new SimpleChange(null, 'task-2', true) });
    fixture.detectChanges();

    tick();

    expect(component.statusPollingActive).toBeFalse();
    expect(component.statusMessage).toContain('Globus session expired');
    expect(component.statusIcon).toContain('exclamation');
  }));

  it('maps compare result updates for non-globus transfers', fakeAsync(() => {
    credentials.credentials.plugin = 'gitlab';
    const initial: CompareResult = {
      id: 'pid-123',
      status: ResultStatus.Updating,
      data: [],
    };
    const updated: CompareResult = {
      id: 'pid-123',
      status: ResultStatus.Finished,
      data: [],
    };
    dataUpdates.updateData.and.returnValue(of(updated));

    const callback = jasmine.createSpy('callback');
    component.data = initial;
    component.dataUpdate = callback;
    component.taskId = 'pid-123';
    component.ngOnChanges({ taskId: new SimpleChange(null, 'pid-123', true) });
    fixture.detectChanges();

    tick();
    expect(dataUpdates.updateData).toHaveBeenCalledWith([], 'pid-123');
    expect(component.status?.status).toBe('SUCCEEDED');
    expect(component.statusPollingActive).toBeFalse();
    expect(callback).toHaveBeenCalledWith(updated);
  }));

  it('renders submitting-only state messaging', () => {
    component.submitting = true;
    fixture.detectChanges();

    expect(component.hasStatus).toBeTrue();
    expect(component.statusMessage).toContain('Submitting transfer request');
    expect(component.statusIcon).toContain('spinner');
  });

  it('computes transfer progress when bytes known', fakeAsync(() => {
    submit.statuses = [
      {
        task_id: 'task-3',
        status: 'ACTIVE',
        bytes_transferred: 150,
        bytes_expected: 300,
      },
      {
        task_id: 'task-3',
        status: 'SUCCEEDED',
        bytes_transferred: 300,
        bytes_expected: 300,
      },
    ];

    component.taskId = 'task-3';
    component.ngOnChanges({ taskId: new SimpleChange(null, 'task-3', true) });
    fixture.detectChanges();

    tick();
    expect(component.transferProgress).toBe(50);

    tick(5000);
    tick();
    expect(component.transferProgress).toBe(100);
  }));

  it('creates monitor link when task id present', () => {
    component.taskId = 'task-xyz';
    component.ngOnChanges({ taskId: new SimpleChange(null, 'task-xyz', true) });
    fixture.detectChanges();

    expect(component.formattedMonitorUrl).toBe(
      'https://app.globus.org/activity/task-xyz',
    );

    component.monitorUrl = 'https://custom.monitor/url';
    expect(component.formattedMonitorUrl).toBe('https://custom.monitor/url');
  });
});
