import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  provideHttpClient,
  withInterceptorsFromDi,
} from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { of, throwError } from 'rxjs';
import { Router } from '@angular/router';

import { SubmitComponent } from './submit.component';
import { DataStateService } from '../data.state.service';
import { CredentialsService } from '../credentials.service';
import { DataService } from '../data.service';
import { SubmitService } from '../submit.service';
import { DatasetService } from '../dataset.service';
import { DataUpdatesService } from '../data.updates.service';
import { NotificationService } from '../shared/notification.service';
import { PluginService } from '../plugin.service';
import { Location } from '@angular/common';
import { Fileaction, Filestatus, Datafile } from '../models/datafile';

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
    datasetServiceStub.newDataset.and.returnValue(
      of({ persistentId: '' }),
    );
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

  it('getDataSubscription should navigate to /connect and show error on failure', () => {
    (dataUpdatesServiceStub.updateData as jasmine.Spy).and.returnValue(
      throwError(() => ({ error: 'boom' })),
    );
    component.getDataSubscription();
    expect(notificationServiceStub.showError).toHaveBeenCalled();
    expect(routerStub.navigate as any).toHaveBeenCalledWith(['/connect']);
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

  it('progress helpers reflect transfer state', async () => {
    expect(component.progressRatio()).toBe(0);
    expect(component.progressLabel()).toBe('');
    const files: Datafile[] = [
      { action: Fileaction.Copy, status: Filestatus.Equal } as any,
      { action: Fileaction.Update, status: Filestatus.Equal } as any,
    ];
    await component.setData(files);
    component.transferStarted = true;
    component['recomputeProgress']();
    expect(component.progressRatio()).toBe(1);
    expect(component.progressLabel()).toContain('2/2');
  });

  it('hasUnfinishedDataFiles responds to status changes', async () => {
    const files: Datafile[] = [
      { action: Fileaction.Copy, status: Filestatus.New } as any,
      { action: Fileaction.Update, status: Filestatus.Equal } as any,
      { action: Fileaction.Delete, status: Filestatus.Deleted } as any,
    ];
    await component.setData(files);
    expect(component.hasUnfinishedDataFiles()).toBeTrue();
    component.created[0].status = Filestatus.Equal;
    component.deleted[0].status = Filestatus.New;
    expect(component.hasUnfinishedDataFiles()).toBeFalse();
  });
});
