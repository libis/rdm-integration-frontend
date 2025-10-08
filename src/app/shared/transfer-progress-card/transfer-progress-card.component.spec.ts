import { SimpleChange } from '@angular/core';
import {
  ComponentFixture,
  TestBed,
  fakeAsync,
  tick,
} from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { GlobusTaskStatus, SubmitService } from '../../submit.service';
import { TransferProgressCardComponent } from './transfer-progress-card.component';

class MockSubmitService {
  statuses: GlobusTaskStatus[] = [];
  errors: unknown[] = [];

  getGlobusTransferStatus(taskId: string) {
    if (this.errors.length > 0) {
      const error = this.errors.shift();
      return throwError(() => error);
    }
    const status =
      this.statuses.shift() ??
      ({ task_id: taskId, status: 'ACTIVE' } as GlobusTaskStatus);
    return of(status);
  }
}

describe('TransferProgressCardComponent', () => {
  let fixture: ComponentFixture<TransferProgressCardComponent>;
  let component: TransferProgressCardComponent;
  let submit: MockSubmitService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TransferProgressCardComponent],
      providers: [{ provide: SubmitService, useClass: MockSubmitService }],
    }).compileComponents();

    fixture = TestBed.createComponent(TransferProgressCardComponent);
    component = fixture.componentInstance;
    submit = TestBed.inject(SubmitService) as unknown as MockSubmitService;
  });

  afterEach(() => {
    component.ngOnDestroy();
  });

  it('polls status until terminal state and emits events', fakeAsync(() => {
    submit.statuses = [
      { task_id: 'task-1', status: 'ACTIVE' },
      { task_id: 'task-1', status: 'SUCCEEDED', nice_status: 'All done' },
    ];

    const pollingStates: boolean[] = [];
    component.pollingChange.subscribe((value) => pollingStates.push(value));
    const completions: GlobusTaskStatus[] = [];
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
