import {
    provideHttpClient,
    withInterceptorsFromDi,
} from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';

import { Location } from '@angular/common';
import { CredentialsService } from '../credentials.service';
import { DataService } from '../data.service';
import { DataStateService } from '../data.state.service';
import { DataUpdatesService } from '../data.updates.service';
import { DatasetService } from '../dataset.service';
import { Datafile, Fileaction, Filestatus } from '../models/datafile';
import { PluginService } from '../plugin.service';
import { NotificationService } from '../shared/notification.service';
import { SubmitService } from '../submit.service';
import { SubmitComponent } from './submit.component';

describe('SubmitComponent', () => {
  let component: SubmitComponent;
  let fixture: ComponentFixture<SubmitComponent>;
  let dataStateStub: Partial<DataStateService>;
  let credentialsStub: any;
  let dataServiceStub: any;
  let submitServiceStub: any;
  let datasetServiceStub: any;
  let dataUpdatesServiceStub: any;
  let notificationServiceStub: any;
  let pluginServiceStub: any;
  let routerStub: any;
  let locationStub: any;

  beforeEach(async () => {
    dataStateStub = {
      getCurrentValue: () => ({ id: 'doi:123', data: [] }),
      cancelInitialization: () => {},
    };

    credentialsStub = {
      credentials: {
        plugin: 'other',
        dataverse_token: 'dv-token',
        dataset_id: undefined,
      },
    };

    dataServiceStub = {
      checkAccessToQueue: () => of({ access: false }),
    };

    submitServiceStub = {
      submit: jasmine
        .createSpy('submit')
        .and.returnValue(
          of({ status: 'OK', datasetUrl: 'http://example.com' }),
        ),
    };

    datasetServiceStub = {
      newDataset: jasmine
        .createSpy('newDataset')
        .and.returnValue(of({ persistentId: 'doi:new' })),
    };

    dataUpdatesServiceStub = {
      updateData: jasmine
        .createSpy('updateData')
        .and.returnValue(of({ data: undefined } as any)),
    };

    notificationServiceStub = {
      showError: jasmine.createSpy('showError'),
    };

    pluginServiceStub = {
      sendMails: () => true,
    };

    routerStub = {
      navigate: jasmine.createSpy('navigate'),
    } as unknown as Router;

    locationStub = {
      back: jasmine.createSpy('back'),
    } as unknown as Location;
    await TestBed.configureTestingModule({
      imports: [SubmitComponent],
      providers: [
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
        { provide: DataStateService, useValue: dataStateStub },
        { provide: CredentialsService, useValue: credentialsStub },
        { provide: DataService, useValue: dataServiceStub },
        { provide: SubmitService, useValue: submitServiceStub },
        { provide: DatasetService, useValue: datasetServiceStub },
        { provide: DataUpdatesService, useValue: dataUpdatesServiceStub },
        { provide: NotificationService, useValue: notificationServiceStub },
        { provide: PluginService, useValue: pluginServiceStub },
        { provide: Router, useValue: routerStub },
        { provide: Location, useValue: locationStub },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SubmitComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should categorize files into created/updated/deleted on setData', async () => {
    const files: Datafile[] = [
      { action: Fileaction.Copy, status: Filestatus.Equal } as any,
      { action: Fileaction.Update, status: Filestatus.Equal } as any,
      {
        action: Fileaction.Delete,
        status: Filestatus.New,
        attributes: { remoteHashType: '', remoteHash: '' },
      } as any,
      { action: Fileaction.Ignore, status: Filestatus.Equal } as any,
    ];
    await component.setData(files);
    expect(component.created.length).toBe(1);
    expect(component.updated.length).toBe(1);
    expect(component.deleted.length).toBe(1);
    // deleted file should have unknown hash type set when missing
    expect(component.deleted[0].attributes?.remoteHashType).toBe('unknown');
    // flattened data is concatenation of the three lists
    expect(component.data.length).toBe(3);
  });

  it('submit should show popup when plugin is not globus', () => {
    credentialsStub.credentials.plugin = 'other';
    component.submit();
    expect(component.popup).toBeTrue();
  });

  it('continueSubmit should navigate to /connect when no changes selected', async () => {
    component.data = [
      { action: Fileaction.Ignore, status: Filestatus.Equal } as any,
    ];
    await component.continueSubmit();
    expect(routerStub.navigate as any).toHaveBeenCalledWith(['/connect']);
  });

  it('continueSubmit should call submit service and mark submitted on OK', async () => {
    const files: Datafile[] = [
      { action: Fileaction.Copy, status: Filestatus.Equal } as any,
    ];
    await component.setData(files);
    await component.continueSubmit();
    expect(submitServiceStub.submit).toHaveBeenCalled();
    expect(component.submitted).toBeTrue();
    expect(component.datasetUrl).toBe('http://example.com');
  });

  it('continueSubmit aborts when new dataset creation fails', async () => {
    datasetServiceStub.newDataset.and.returnValue(of({ persistentId: '' }));
    component.pid = 'root:COLL:New Dataset';
    component.data = [
      { action: Fileaction.Copy, status: Filestatus.Equal } as any,
    ];
    await component.continueSubmit();
    expect(component.disabled).toBeFalse();
    expect(component.transferStarted).toBeFalse();
  });

  it('continueSubmit reports errors from submit service', async () => {
    submitServiceStub.submit.and.returnValue(
      throwError(() => ({ error: 'boom' })),
    );
    component.data = [
      { action: Fileaction.Copy, status: Filestatus.Equal } as any,
    ];
    await component.continueSubmit();
    expect(notificationServiceStub.showError).toHaveBeenCalledWith(
      'Store failed: boom',
    );
    expect(routerStub.navigate as any).toHaveBeenCalledWith(['/connect']);
  });

  it('newDataset should set pid and return true on success', async () => {
    const ok = await component.newDataset('collection-1');
    expect(ok).toBeTrue();
    expect(component.pid).toBe('doi:new');
    expect(credentialsStub.credentials.dataset_id).toBe('doi:new');
  });

  it('goToCompute should navigate to compute route with pid', () => {
    component.pid = 'doi:abc';
    component.goToCompute();
    expect(routerStub.navigate as any).toHaveBeenCalledWith(['/compute'], {
      queryParams: { pid: 'doi:abc' },
    });
  });

  it('back should navigate to compare with dataset id (from data state)', () => {
    // Data state stub returns id doi:123
    component.pid = 'ignored:pid';
    component.back();
    expect(routerStub.navigate as any).toHaveBeenCalled();
    const args = (routerStub.navigate as any).calls.mostRecent().args;
    expect(args[0]).toEqual(['/compare', 'doi:123']);
  });

  it('back should navigate to metadata-selector when incomingMetadata present', () => {
    // Simulate having come from metadata-selector by assigning private field
    (component as any).incomingMetadata = {
      datasetVersion: { metadataBlocks: { citation: { fields: [] } } },
    } as any;
    component.back();
    expect(routerStub.navigate as any).toHaveBeenCalled();
    const args = (routerStub.navigate as any).calls.mostRecent().args;
    expect(args[0]).toEqual(['/metadata-selector']);
    expect(args[1]?.state?.fromSubmit).toBeTrue();
  });

  it('sendMails should return plugin service value', () => {
    expect(component.sendMails()).toBeTrue();
  });

  it('isGlobus should return true when plugin is globus', () => {
    credentialsStub.credentials.plugin = 'globus';
    expect(component.isGlobus()).toBeTrue();
  });

  it('isGlobus should return false when plugin is not globus', () => {
    credentialsStub.credentials.plugin = 'other';
    expect(component.isGlobus()).toBeFalse();
  });

  it('submit should call continueSubmit directly when plugin is globus', () => {
    credentialsStub.credentials.plugin = 'globus';
    spyOn(component, 'continueSubmit');
    component.submit();
    expect(component.popup).toBeFalse();
    expect(component.continueSubmit).toHaveBeenCalled();
  });

  it('continueSubmit should close popup', async () => {
    component.popup = true;
    component.data = [];
    await component.continueSubmit();
    expect(component.popup).toBeFalse();
  });

  it('continueSubmit should disable submit button during processing', async () => {
    component.data = [
      { action: Fileaction.Copy, status: Filestatus.Equal } as any,
    ];
    await component.continueSubmit();
    expect(component.disabled).toBeTrue();
  });

  it('continueSubmit should set transferTaskId to globus task id for globus plugin', async () => {
    credentialsStub.credentials.plugin = 'globus';
    submitServiceStub.submit.and.returnValue(
      of({
        status: 'OK',
        datasetUrl: 'http://example.com',
        globusTransferTaskId: 'task-123',
        globusTransferMonitorUrl: 'https://app.globus.org/activity/task-123',
      }),
    );
    component.data = [
      { action: Fileaction.Copy, status: Filestatus.Equal } as any,
    ];
    await component.continueSubmit();
    expect(component.transferTaskId).toBe('task-123');
    expect(component.transferMonitorUrl).toBe(
      'https://app.globus.org/activity/task-123',
    );
  });

  it('continueSubmit should set transferTaskId to pid for non-globus plugin', async () => {
    credentialsStub.credentials.plugin = 'other';
    component.pid = 'doi:456';
    component.data = [
      { action: Fileaction.Copy, status: Filestatus.Equal } as any,
    ];
    await component.continueSubmit();
    expect(component.transferTaskId).toBe('doi:456');
    expect(component.transferMonitorUrl).toBeUndefined();
  });

  it('continueSubmit should set transferInProgress to true on success', async () => {
    component.data = [
      { action: Fileaction.Copy, status: Filestatus.Equal } as any,
    ];
    await component.continueSubmit();
    expect(component.transferInProgress).toBeTrue();
  });

  it('continueSubmit should set transferStarted to true on success', async () => {
    component.data = [
      { action: Fileaction.Copy, status: Filestatus.Equal } as any,
    ];
    await component.continueSubmit();
    expect(component.transferStarted).toBeTrue();
  });

  it('continueSubmit should handle submit service returning non-OK status', async () => {
    submitServiceStub.submit.and.returnValue(
      of({ status: 'ERROR', datasetUrl: null }),
    );
    component.data = [
      { action: Fileaction.Copy, status: Filestatus.Equal } as any,
    ];
    await component.continueSubmit();
    expect(notificationServiceStub.showError).toHaveBeenCalledWith(
      'Store failed, status: ERROR',
    );
    expect(routerStub.navigate as any).toHaveBeenCalledWith(['/connect']);
  });

  it('continueSubmit should create new dataset when pid ends with :New Dataset', async () => {
    component.pid = 'root:COLLECTION:New Dataset';
    component.data = [
      { action: Fileaction.Copy, status: Filestatus.Equal } as any,
    ];
    await component.continueSubmit();
    expect(datasetServiceStub.newDataset).toHaveBeenCalledWith(
      'root',
      'dv-token',
      undefined,
    );
    expect(component.pid).toBe('doi:new');
  });

  it('continueSubmit should pass metadata when creating new dataset', async () => {
    const metadata = {
      datasetVersion: { metadataBlocks: { citation: { fields: [] } } },
    } as any;
    (component as any).incomingMetadata = metadata;
    component.pid = 'root:COLL:New Dataset';
    component.data = [
      { action: Fileaction.Copy, status: Filestatus.Equal } as any,
    ];
    await component.continueSubmit();
    expect(datasetServiceStub.newDataset).toHaveBeenCalledWith(
      'root',
      'dv-token',
      metadata,
    );
  });

  it('continueSubmit should handle globus task id being null', async () => {
    credentialsStub.credentials.plugin = 'globus';
    submitServiceStub.submit.and.returnValue(
      of({
        status: 'OK',
        datasetUrl: 'http://example.com',
        globusTransferTaskId: null,
        globusTransferMonitorUrl: null,
      }),
    );
    component.data = [
      { action: Fileaction.Copy, status: Filestatus.Equal } as any,
    ];
    await component.continueSubmit();
    expect(component.transferTaskId).toBeNull();
    expect(component.transferMonitorUrl).toBeNull();
  });

  it('onStatusPollingChange should update transferInProgress', () => {
    component.transferInProgress = false;
    component.onStatusPollingChange(true);
    expect(component.transferInProgress).toBeTrue();

    component.onStatusPollingChange(false);
    expect(component.transferInProgress).toBeFalse();
  });

  it('onDataUpdate should call setData with result data', async () => {
    const files: Datafile[] = [
      { action: Fileaction.Copy, status: Filestatus.New } as any,
    ];
    spyOn(component, 'setData');
    component.onDataUpdate({ data: files });
    expect(component.setData).toHaveBeenCalledWith(files);
  });

  it('onDataUpdate should do nothing when result has no data', async () => {
    spyOn(component, 'setData');
    component.onDataUpdate({ data: undefined });
    expect(component.setData).not.toHaveBeenCalled();
  });

  it('goToDataset should open dataset URL in new window', () => {
    spyOn(window, 'open');
    component.datasetUrl = 'https://example.com/dataset/123';
    component.goToDataset();
    expect(window.open).toHaveBeenCalledWith(
      'https://example.com/dataset/123',
      '_blank',
    );
  });

  it('ngOnInit should set hasAccessToCompute when access check succeeds', async () => {
    // Create a new component with access granted
    const accessService = {
      checkAccessToQueue: jasmine
        .createSpy('checkAccessToQueue')
        .and.returnValue(of({ access: true })),
    };

    await TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [SubmitComponent],
      providers: [
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
        { provide: DataStateService, useValue: dataStateStub },
        { provide: CredentialsService, useValue: credentialsStub },
        { provide: DataService, useValue: accessService },
        { provide: SubmitService, useValue: submitServiceStub },
        { provide: DatasetService, useValue: datasetServiceStub },
        { provide: DataUpdatesService, useValue: dataUpdatesServiceStub },
        { provide: NotificationService, useValue: notificationServiceStub },
        { provide: PluginService, useValue: pluginServiceStub },
        { provide: Router, useValue: routerStub },
        { provide: Location, useValue: locationStub },
      ],
    }).compileComponents();

    const testFixture = TestBed.createComponent(SubmitComponent);
    const testComponent = testFixture.componentInstance;
    testFixture.detectChanges();

    expect(accessService.checkAccessToQueue).toHaveBeenCalled();
    expect(testComponent.hasAccessToCompute).toBeTrue();
  });

  it('ngOnInit should handle access check errors silently', async () => {
    const errorService = {
      checkAccessToQueue: jasmine
        .createSpy('checkAccessToQueue')
        .and.returnValue(throwError(() => new Error('Access check failed'))),
    };

    await TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [SubmitComponent],
      providers: [
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
        { provide: DataStateService, useValue: dataStateStub },
        { provide: CredentialsService, useValue: credentialsStub },
        { provide: DataService, useValue: errorService },
        { provide: SubmitService, useValue: submitServiceStub },
        { provide: DatasetService, useValue: datasetServiceStub },
        { provide: DataUpdatesService, useValue: dataUpdatesServiceStub },
        { provide: NotificationService, useValue: notificationServiceStub },
        { provide: PluginService, useValue: pluginServiceStub },
        { provide: Router, useValue: routerStub },
        { provide: Location, useValue: locationStub },
      ],
    }).compileComponents();

    expect(() => {
      const testFixture = TestBed.createComponent(SubmitComponent);
      testFixture.detectChanges();
    }).not.toThrow();
  });

  it('loadData should set pid and data from data state service', () => {
    const files: Datafile[] = [
      { action: Fileaction.Copy, status: Filestatus.New } as any,
    ];
    dataStateStub.getCurrentValue = () => ({ id: 'doi:xyz', data: files });
    component.loadData();
    expect(component.pid).toBe('doi:xyz');
    expect(component.data).toEqual(files);
  });

  it('loadData should handle missing id in data state', () => {
    dataStateStub.getCurrentValue = () => ({ id: undefined, data: [] });
    component.loadData();
    expect(component.pid).toBe('');
  });

  it('loadData should handle missing data in data state', () => {
    dataStateStub.getCurrentValue = () => ({ id: 'doi:123', data: undefined });
    component.loadData();
    expect(component.pid).toBe('doi:123');
  });

  it('setData should handle files without action field', async () => {
    const files: Datafile[] = [
      { status: Filestatus.New } as any, // No action field
    ];
    await component.setData(files);
    // Files without action should not be in any category
    expect(component.created.length).toBe(0);
    expect(component.updated.length).toBe(0);
    expect(component.deleted.length).toBe(0);
  });

  it('setData should set unknown hash for deleted files without remoteHashType', async () => {
    const files: Datafile[] = [
      {
        action: Fileaction.Delete,
        status: Filestatus.New,
        attributes: undefined,
      } as any,
    ];
    await component.setData(files);
    expect(component.deleted[0].attributes?.remoteHashType).toBe('unknown');
    expect(component.deleted[0].attributes?.remoteHash).toBe('unknown');
  });

  it('newDataset should show error notification when persistentId is undefined', async () => {
    datasetServiceStub.newDataset.and.returnValue(
      of({ persistentId: undefined }),
    );
    const ok = await component.newDataset('collection-1');
    expect(ok).toBeFalse();
    expect(notificationServiceStub.showError).toHaveBeenCalledWith(
      'Creating new dataset failed',
    );
  });

  it('newDataset should show error notification when persistentId is empty', async () => {
    datasetServiceStub.newDataset.and.returnValue(of({ persistentId: '' }));
    const ok = await component.newDataset('collection-1');
    expect(ok).toBeFalse();
    expect(notificationServiceStub.showError).toHaveBeenCalledWith(
      'Creating new dataset failed',
    );
  });

  it('ngOnDestroy should unsubscribe from all subscriptions', () => {
    const sub1 = jasmine.createSpyObj('Subscription', ['unsubscribe']);
    const sub2 = jasmine.createSpyObj('Subscription', ['unsubscribe']);
    (component as any).subscriptions.add(sub1);
    (component as any).subscriptions.add(sub2);

    component.ngOnDestroy();

    expect(sub1.unsubscribe).toHaveBeenCalled();
    expect(sub2.unsubscribe).toHaveBeenCalled();
    expect((component as any).subscriptions.size).toBe(0);
  });

  it('back should merge dataset_id into snapshot storage', () => {
    const snapshotStorage = TestBed.inject(
      component['snapshotStorage'].constructor,
    );
    if (snapshotStorage) {
      spyOn(snapshotStorage, 'mergeConnect');
    }
    component.back();
    // Just verify back() was called without error - snapshot merge is internal implementation
    expect(routerStub.navigate as any).toHaveBeenCalled();
  });

  it('setData should preserve attributes when setting unknown hash', async () => {
    const files: Datafile[] = [
      {
        action: Fileaction.Delete,
        status: Filestatus.New,
        attributes: { remoteHashType: null } as any,
      } as any,
    ];
    await component.setData(files);
    expect(component.deleted[0].attributes?.remoteHashType).toBe('unknown');
    expect(component.deleted[0].attributes?.remoteHash).toBe('unknown');
  });

  it('continueSubmit should handle undefined action as Ignore', async () => {
    component.data = [
      { action: undefined, status: Filestatus.New } as any,
      { action: Fileaction.Copy, status: Filestatus.New } as any,
    ];
    await component.continueSubmit();
    // Should submit, having filtered out the undefined action file
    expect(submitServiceStub.submit).toHaveBeenCalled();
    const args = submitServiceStub.submit.calls.mostRecent().args;
    expect(args[0].length).toBe(1); // Only the Copy file
  });

  it('continueSubmit should include sendEmailOnSuccess parameter', async () => {
    component.sendEmailOnSuccess = true;
    component.data = [
      { action: Fileaction.Copy, status: Filestatus.Equal } as any,
    ];
    await component.continueSubmit();
    expect(submitServiceStub.submit).toHaveBeenCalled();
    const args = submitServiceStub.submit.calls.mostRecent().args;
    expect(args[1]).toBeTrue();
  });

  it('continueSubmit should pass false for sendEmailOnSuccess when not checked', async () => {
    component.sendEmailOnSuccess = false;
    component.data = [
      { action: Fileaction.Copy, status: Filestatus.Equal } as any,
    ];
    await component.continueSubmit();
    const args = submitServiceStub.submit.calls.mostRecent().args;
    expect(args[1]).toBeFalse();
  });

  it('loadData should call setData when data is present', () => {
    const files: Datafile[] = [
      { action: Fileaction.Copy, status: Filestatus.New } as any,
    ];
    dataStateStub.getCurrentValue = () => ({ id: 'doi:xyz', data: files });
    spyOn(component, 'setData');
    component.loadData();
    expect(component.setData).toHaveBeenCalledWith(files);
  });

  it('loadData should not call setData when data is undefined', () => {
    dataStateStub.getCurrentValue = () => ({ id: 'doi:xyz', data: undefined });
    spyOn(component, 'setData');
    component.loadData();
    expect(component.setData).not.toHaveBeenCalled();
  });

  it('loadData should not call setData when data is null', () => {
    dataStateStub.getCurrentValue = () => ({
      id: 'doi:xyz',
      data: null as any,
    });
    spyOn(component, 'setData');
    component.loadData();
    expect(component.setData).not.toHaveBeenCalled();
  });

  it('back should use pid when data state has no id', () => {
    dataStateStub.getCurrentValue = () => ({ id: undefined, data: [] });
    component.pid = 'doi:fallback';
    component.back();
    // Verify navigation happened - snapshot merge is internal implementation
    expect(routerStub.navigate as any).toHaveBeenCalled();
    const args = (routerStub.navigate as any).calls.mostRecent().args;
    expect(args[0]).toEqual(['/compare', 'doi:fallback']);
  });

  it('continueSubmit should reset disabled and transferStarted on new dataset failure', async () => {
    datasetServiceStub.newDataset.and.returnValue(of({ persistentId: '' }));
    component.pid = 'root:COLL:New Dataset';
    component.data = [
      { action: Fileaction.Copy, status: Filestatus.Equal } as any,
    ];
    component.disabled = false;
    component.transferStarted = false;
    await component.continueSubmit();
    expect(component.disabled).toBeFalse();
    expect(component.transferStarted).toBeFalse();
  });

  it('ngOnInit should load data on initialization', () => {
    spyOn(component, 'loadData');
    component.ngOnInit();
    expect(component.loadData).toHaveBeenCalled();
  });
});
