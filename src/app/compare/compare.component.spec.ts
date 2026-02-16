import {
  provideHttpClient,
  withInterceptorsFromDi,
} from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Router } from '@angular/router';
import { Observable, Observer, Subscription, of } from 'rxjs';
import { CredentialsService } from '../credentials.service';
import { DataStateService } from '../data.state.service';
import { DataUpdatesService } from '../data.updates.service';
import { CompareResult, ResultStatus } from '../models/compare-result';
import { Datafile, Fileaction, Filestatus } from '../models/datafile';
import { PluginService } from '../plugin.service';
import { SnapshotStorageService } from '../shared/snapshot-storage.service';
import { APP_CONSTANTS } from '../shared/constants';
import { CompareComponent } from './compare.component';

class StubDataStateService {
  // Signal-based API (primary)
  state$ = signal<CompareResult | null>(null);

  initializeState(): void {}

  cancelInitialization(resetState = true): void {
    if (resetState) {
      this.state$.set(null);
    }
  }

  updateState(state: CompareResult): void {
    this.state$.set(state);
  }

  resetState(): void {
    this.state$.set(null);
  }
}

class StubDataUpdatesService {
  updateData(data: Datafile[], pid: string) {
    return of({ id: pid, data } as CompareResult);
  }
}

// Create a factory function for creating properly synced credential stub
function createCredentialsStub() {
  // Internal signals that can be updated
  const credentialsSignal = signal<any>({
    pluginId: 'local',
    plugin: 'local',
    repo_name: 'owner/repo',
  });
  const pluginIdSignal = signal<string | undefined>('local');
  const pluginSignal = signal<string | undefined>('local');
  const repoNameSignal = signal<string | undefined>('owner/repo');
  const urlSignal = signal<string | undefined>(undefined);
  const optionSignal = signal<string | undefined>(undefined);
  const userSignal = signal<string | undefined>(undefined);
  const tokenSignal = signal<string | undefined>(undefined);
  const datasetIdSignal = signal<string | undefined>(undefined);
  const newlyCreatedSignal = signal<boolean | undefined>(undefined);
  const dataverseTokenSignal = signal<string | undefined>(undefined);
  const metadataAvailableSignal = signal<boolean | undefined>(undefined);

  // Helper to sync all signals from credentials object
  function syncSignals(creds: any) {
    pluginIdSignal.set(creds.pluginId);
    pluginSignal.set(creds.plugin);
    repoNameSignal.set(creds.repo_name);
    urlSignal.set(creds.url);
    optionSignal.set(creds.option);
    userSignal.set(creds.user);
    tokenSignal.set(creds.token);
    datasetIdSignal.set(creds.dataset_id);
    newlyCreatedSignal.set(creds.newly_created);
    dataverseTokenSignal.set(creds.dataverse_token);
    metadataAvailableSignal.set(creds.metadata_available);
    credentialsSignal.set(creds);
  }

  return {
    get credentials() {
      return credentialsSignal();
    },
    set credentials(value: any) {
      syncSignals(value);
    },
    // Signal-based API
    credentials$: credentialsSignal.asReadonly(),
    plugin$: pluginSignal.asReadonly(),
    pluginId$: pluginIdSignal.asReadonly(),
    repoName$: repoNameSignal.asReadonly(),
    url$: urlSignal.asReadonly(),
    option$: optionSignal.asReadonly(),
    user$: userSignal.asReadonly(),
    token$: tokenSignal.asReadonly(),
    datasetId$: datasetIdSignal.asReadonly(),
    newlyCreated$: newlyCreatedSignal.asReadonly(),
    dataverseToken$: dataverseTokenSignal.asReadonly(),
    metadataAvailable$: metadataAvailableSignal.asReadonly(),

    setCredentials(creds: any): void {
      syncSignals(creds);
    },
    updateCredentials(partial: any): void {
      const current = credentialsSignal();
      syncSignals({ ...current, ...partial });
    },
    clearCredentials(): void {
      syncSignals({});
    },
  };
}

class StubPluginService {
  getPlugin(_id: string) {
    return { name: 'Test Plugin' };
  }

  dataverseHeader() {
    return 'Dataverse:';
  }

  // Signal property for computed signal consumers
  dataverseHeader$ = signal('Dataverse:').asReadonly();
}

class StubSnapshotStorageService {
  mergeConnect(_snapshot: unknown): void {}
}

class StubRouter {
  navigate(commands: any[], _extras?: any) {
    return Promise.resolve(commands);
  }
}

describe('CompareComponent', () => {
  let component: CompareComponent;
  let fixture: ComponentFixture<CompareComponent>;
  let dataStateStub: StubDataStateService;
  let credentialsStub: ReturnType<typeof createCredentialsStub>;

  beforeEach(async () => {
    credentialsStub = createCredentialsStub();

    await TestBed.configureTestingModule({
      imports: [CompareComponent],
      providers: [
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
        { provide: DataStateService, useClass: StubDataStateService },
        { provide: DataUpdatesService, useClass: StubDataUpdatesService },
        { provide: CredentialsService, useValue: credentialsStub },
        { provide: PluginService, useClass: StubPluginService },
        {
          provide: SnapshotStorageService,
          useClass: StubSnapshotStorageService,
        },
        { provide: Router, useClass: StubRouter },
      ],
    }).compileComponents();

    dataStateStub = TestBed.inject(
      DataStateService,
    ) as unknown as StubDataStateService;

    fixture = TestBed.createComponent(CompareComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('back() navigates to /connect and persists snapshot to storage', () => {
    const router = TestBed.inject(Router);
    const snapshotService = TestBed.inject(SnapshotStorageService);
    const navigateSpy = spyOn(router, 'navigate');
    const mergeSpy = spyOn(snapshotService, 'mergeConnect');
    // Ensure no breadcrumb state from prior tests
    if (window && window.history && window.history.replaceState) {
      window.history.replaceState({}, '', '/');
    }
    credentialsStub.credentials = { dataset_id: 'doi:10.777/TEST' };
    component.data.set({ id: 'doiFallback' } as any);
    component.back();
    expect(mergeSpy).toHaveBeenCalledWith(
      jasmine.objectContaining({ dataset_id: 'doi:10.777/TEST' }),
    );
    expect(navigateSpy).toHaveBeenCalledWith(['/connect']);
  });

  it('submit() navigates to metadata-selector when new dataset path', () => {
    const router = TestBed.inject(Router);
    const navigateSpy = spyOn(router, 'navigate');
    credentialsStub.credentials = { newly_created: true };
    component.data.set({ id: '' } as any); // new dataset heuristic
    component.submit();
    expect(navigateSpy).toHaveBeenCalledWith(['/metadata-selector']);
  });

  it('ngOnDestroy cancels initialization with reset when loading', () => {
    const cancelSpy = jasmine.createSpy('cancelInitialization');
    (component as any).dataStateService = { cancelInitialization: cancelSpy };
    let unsubscribeCalled = false;
    (component as any).subscriptions.add(
      new Subscription(() => {
        unsubscribeCalled = true;
      }),
    );
    component.loading.set(true);

    component.ngOnDestroy();

    expect(unsubscribeCalled).toBeTrue();
    expect(cancelSpy).toHaveBeenCalledOnceWith(true);
  });

  it('ngOnDestroy skips reset when not loading', () => {
    const cancelSpy = jasmine.createSpy('cancelInitialization');
    (component as any).dataStateService = { cancelInitialization: cancelSpy };

    component.loading.set(false);
    component.ngOnDestroy();

    expect(cancelSpy).toHaveBeenCalledOnceWith(false);
  });

  describe('canProceed() logic', () => {
    function setCreds(creds: any) {
      credentialsStub.credentials = creds;
    }
    function addFileSelectionViaData() {
      // Setup data with a file that has non-Ignore action
      const datafile = {
        id: 'file1',
        name: 'test.txt',
        path: '',
        hidden: false,
        attributes: { isFile: true },
        action: Fileaction.Copy,
      } as any;
      component.data.set({ id: 'doi:test', data: [datafile] } as any);
    }

    it('non-new dataset requires selection', () => {
      setCreds({ newly_created: false });
      // Empty data - no selection
      component.data.set({ id: 'doi:10/EXISTING', data: [] } as any);
      expect(component.canProceed()).toBeFalse();
      // Add file selection
      addFileSelectionViaData();
      expect(component.canProceed()).toBeTrue();
    });

    it('new dataset with metadata_available true can proceed without selection', () => {
      setCreds({ newly_created: true, metadata_available: true });
      component.data.set({ id: '', data: [] } as any); // new dataset scenario with no files
      expect(component.canProceed()).toBeTrue();
    });

    it('new dataset without metadata_available requires selection', () => {
      // Need fresh fixture with credentials set before component creation
      fixture.destroy();
      credentialsStub.credentials = {
        newly_created: true,
        metadata_available: false,
      };
      fixture = TestBed.createComponent(CompareComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();

      component.data.set({ id: '', data: [] } as any);
      expect(component.canProceed()).toBeFalse();
      addFileSelectionViaData();
      expect(component.canProceed()).toBeTrue();
    });

    it('proceedTitle reflects metadata-only vs blocked states', () => {
      // Test 1: Blocked - new dataset, no metadata, no files
      fixture.destroy();
      credentialsStub.credentials = {
        newly_created: true,
        metadata_available: false,
      };
      fixture = TestBed.createComponent(CompareComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();
      component.data.set({ id: '', data: [] } as any);
      expect(component.proceedTitle()).toContain('Select at least one file');

      // Test 2: Metadata-only allowed - new dataset, metadata available, no files
      fixture.destroy();
      credentialsStub.credentials = {
        newly_created: true,
        metadata_available: true,
      };
      fixture = TestBed.createComponent(CompareComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();
      component.data.set({ id: '', data: [] } as any);
      expect(component.canProceed()).toBeTrue();
      expect(component.proceedTitle()).toContain('metadata-only');

      // Test 3: Existing dataset - need selection
      fixture.destroy();
      credentialsStub.credentials = { newly_created: false };
      fixture = TestBed.createComponent(CompareComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();
      component.data.set({ id: 'doi:10/EXISTING', data: [] } as any);
      expect(component.canProceed()).toBeFalse();
      expect(component.proceedTitle()).toBe('Action not available yet');
    });

    it('new dataset with undefined metadata_available allowed metadata-only', () => {
      fixture.destroy();
      credentialsStub.credentials = { newly_created: true };
      fixture = TestBed.createComponent(CompareComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();
      component.data.set({ id: '', data: [] } as any);
      expect(component.canProceed()).toBeTrue();
      expect(component.proceedTitle()).toContain('metadata-only');
    });

    it('isNewDataset() falls back to dataset id heuristic when flag missing', () => {
      // No newly_created flag, id includes New Dataset (case-insensitive)
      credentialsStub.credentials = {};
      component.data.set({ id: 'root:COLL:New Dataset' } as any);
      expect(component['isNewDataset']()).toBeTrue();

      // Plain empty id treated as new
      component.data.set({ id: '' } as any);
      expect(component['isNewDataset']()).toBeTrue();

      // Non-new id without flag
      component.data.set({ id: 'doi:10.123/EXISTING' } as any);
      expect(component['isNewDataset']()).toBeFalse();
    });
  });

  describe('row operations and filtering', () => {
    const makeDatafile = (
      id: string,
      status: Filestatus,
      action: Fileaction = Fileaction.Ignore,
      hidden = false,
    ): Datafile =>
      ({
        id,
        name: 'f',
        path: '',
        hidden,
        status,
        action,
        attributes: { isFile: true },
      }) as unknown as Datafile;

    it('noActionSelection resets only visible nodes', () => {
      const visible = makeDatafile('v', Filestatus.New, Fileaction.Copy, false);
      const hidden = makeDatafile('h', Filestatus.New, Fileaction.Delete, true);
      component.data.set({ id: 'test', data: [visible, hidden] } as any);

      component.noActionSelection();
      const map = component.rowNodeMap();
      expect(map.get('v:file')?.data?.action).toBe(Fileaction.Ignore);
      expect(map.get('h:file')?.data?.action).toBe(Fileaction.Delete);
    });

    it('updateSelection and mirrorSelection apply status-specific actions', () => {
      const files = [
        makeDatafile('new', Filestatus.New),
        makeDatafile('equal', Filestatus.Equal),
        makeDatafile('upd', Filestatus.Updated),
        makeDatafile('del', Filestatus.Deleted),
      ];
      component.data.set({ id: 'test', data: files } as any);
      const map = component.rowNodeMap();

      component.updateSelection();
      expect(map.get('new:file')?.data?.action).toBe(Fileaction.Copy);
      expect(map.get('equal:file')?.data?.action).toBe(Fileaction.Ignore);
      expect(map.get('upd:file')?.data?.action).toBe(Fileaction.Update);
      expect(map.get('del:file')?.data?.action).toBe(Fileaction.Ignore);

      component.mirrorSelection();
      expect(map.get('del:file')?.data?.action).toBe(Fileaction.Delete);
    });

    it('isInFilterMode is computed based on selectedFilterItems', () => {
      // Default state has all filter items selected
      expect(component.selectedFilterItems().length).toBe(4);
      expect(component.isInFilterMode()).toBeFalse();

      // Selecting fewer items enables filter mode
      component.selectedFilterItems.set([component.filterItems[0]]);
      expect(component.isInFilterMode()).toBeTrue();

      // Selecting all items disables filter mode
      component.selectedFilterItems.set([...component.filterItems]);
      expect(component.isInFilterMode()).toBeFalse();
    });

    it('rootNodeChildrenView returns empty array when no data', () => {
      component.data.set({});
      expect(component.rootNodeChildrenView()).toEqual([]);
    });

    it('rootNodeChildrenView filters based on selectedFilterItems', () => {
      // Set up data with multiple file statuses
      const files: Datafile[] = [
        {
          id: 'file1',
          name: 'newfile',
          path: '',
          status: Filestatus.New,
          action: Fileaction.Copy,
          hidden: false,
          attributes: { isFile: true },
        } as unknown as Datafile,
        {
          id: 'file2',
          name: 'equalfile',
          path: '',
          status: Filestatus.Equal,
          action: Fileaction.Ignore,
          hidden: false,
          attributes: { isFile: true },
        } as unknown as Datafile,
      ];
      component.data.set({ id: 'test', data: files } as CompareResult);

      // With all filters selected, all files should be visible
      component.selectedFilterItems.set([...component.filterItems]);
      const allVisible = component.rootNodeChildrenView();
      expect(allVisible.length).toBeGreaterThan(0);

      // Filter to only show new files
      component.selectedFilterItems.set([
        component.filterItems.find((f) => f.fileStatus === Filestatus.New)!,
      ]);
      const filteredVisible = component.rootNodeChildrenView();
      const visibleStatuses = filteredVisible
        .filter((n) => n.data?.attributes?.isFile)
        .map((n) => n.data?.status);
      expect(visibleStatuses.every((s) => s === Filestatus.New)).toBeTrue();
    });

    it('hasSelection detects files with non-ignore actions', () => {
      const copyFile: Datafile = {
        id: 'file1',
        name: 'f',
        path: '',
        hidden: false,
        status: Filestatus.New,
        action: Fileaction.Copy,
        attributes: { isFile: true },
      } as unknown as Datafile;

      component.data.set({ id: 'test', data: [copyFile] } as any);
      expect(component.hasSelection()).toBeTrue();

      // Change to ignore action
      copyFile.action = Fileaction.Ignore;
      component.data.set({ id: 'test', data: [copyFile] } as any);
      expect(component.hasSelection()).toBeFalse();
    });

    it('rowNodeMap is computed from data signal', () => {
      const df: Datafile = {
        id: 'id',
        name: 'File',
        path: '',
        hidden: false,
        attributes: { isFile: true },
      } as unknown as Datafile;

      // Set data via the signal
      component.data.set({ data: [df], id: 'root' } as CompareResult);

      // rowNodeMap should be computed from the data
      const map = component.rowNodeMap();
      expect(map.size).toBeGreaterThan(0);
    });

    it('restores folder aggregate actions after returning from metadata', () => {
      fixture.destroy();
      credentialsStub.credentials = {
        pluginId: 'local',
        plugin: 'local',
        repo_name: 'owner/repo',
        newly_created: true,
      };
      const compareResult: CompareResult = {
        id: 'new-dataset',
        status: ResultStatus.Finished,
        data: [
          {
            id: 'folder/file1',
            name: 'file1',
            path: 'folder',
            status: Filestatus.New,
            action: Fileaction.Ignore,
            hidden: false,
            attributes: { isFile: true },
          },
          {
            id: 'folder/file2',
            name: 'file2',
            path: 'folder',
            status: Filestatus.New,
            action: Fileaction.Ignore,
            hidden: false,
            attributes: { isFile: true },
          },
        ],
      };

      dataStateStub.updateState(compareResult);

      const firstFixture = TestBed.createComponent(CompareComponent);
      const firstComponent = firstFixture.componentInstance;
      firstFixture.detectChanges();
      firstComponent.updateSelection();
      expect(firstComponent.rowNodeMap().get('folder')?.data?.action).toBe(
        Fileaction.Copy,
      );

      (firstComponent as any).dataStateService.updateState(
        firstComponent.data(),
      );

      firstComponent.loading.set(false);
      firstFixture.destroy();

      const secondFixture = TestBed.createComponent(CompareComponent);
      const secondComponent = secondFixture.componentInstance;
      secondFixture.detectChanges();

      const restoredFolderAction = secondComponent.rowNodeMap().get('folder')
        ?.data?.action;
      expect(restoredFolderAction).toBe(Fileaction.Copy);
      compareResult.data?.forEach((file) => {
        expect(
          secondComponent.rowNodeMap().get(`${file.id}:file`)?.data?.action,
        ).toBe(Fileaction.Copy);
      });

      secondFixture.destroy();
    });

    it('folderName derives labels based on plugin context', () => {
      // Test 1: GitHub with just owner/repo - no subfolder
      fixture.destroy();
      credentialsStub.credentials = {
        pluginId: 'github',
        repo_name: 'owner/repo',
        option: '',
      };
      fixture = TestBed.createComponent(CompareComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();
      expect(component.folderName()).toBeUndefined();

      // Test 2: GitHub with subfolder
      fixture.destroy();
      credentialsStub.credentials = {
        pluginId: 'github',
        repo_name: 'owner/repo/subfolder',
        option: '',
      };
      fixture = TestBed.createComponent(CompareComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();
      expect(component.folderName()).toBe('subfolder');

      // Test 3: Globus
      fixture.destroy();
      credentialsStub.credentials = {
        pluginId: 'globus',
        option: '/path/to/folder/',
      };
      fixture = TestBed.createComponent(CompareComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();
      expect(component.folderName()).toBe('folder');

      // Test 4: OneDrive
      fixture.destroy();
      credentialsStub.credentials = {
        pluginId: 'onedrive',
        option: 'driveId/path/to/folder',
      };
      fixture = TestBed.createComponent(CompareComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();
      expect(component.folderName()).toBe('folder');

      // Test 5: SFTP
      fixture.destroy();
      credentialsStub.credentials = {
        pluginId: 'sftp',
        option: 'dir/sub',
      };
      fixture = TestBed.createComponent(CompareComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();
      expect(component.folderName()).toBe('sub');
    });

    it('displayDatasetId normalizes new dataset labels', () => {
      component.data.set({ id: '' } as CompareResult);
      expect(component.displayDatasetId()).toBe('New Dataset');
      component.data.set({ id: ':New Dataset' } as CompareResult);
      expect(component.displayDatasetId()).toBe('New Dataset');
      component.data.set({ id: 'doi:10.1/ABC' } as CompareResult);
      expect(component.displayDatasetId()).toBe('doi:10.1/ABC');
    });

    it('repo and dataverseHeaderNoColon use plugin service helpers', () => {
      fixture.destroy();
      credentialsStub.credentials = { pluginId: 'github' };
      fixture = TestBed.createComponent(CompareComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();
      expect(component.repo()).toBe('Test Plugin');
      expect(component.dataverseHeaderNoColon()).toBe('Dataverse');
    });

    it('newlyCreated and hasSelection cooperate with credentials', () => {
      // Test with newly_created: true
      fixture.destroy();
      credentialsStub.credentials = { newly_created: true };
      fixture = TestBed.createComponent(CompareComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();
      expect(component.newlyCreated()).toBeTrue();

      // Test with newly_created: false
      fixture.destroy();
      credentialsStub.credentials = { newly_created: false };
      fixture = TestBed.createComponent(CompareComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();
      expect(component.newlyCreated()).toBeFalse();
    });

    it('getUpdatedData and refresh process data update responses', async () => {
      const updates: CompareResult = {
        data: [],
        id: 'id',
        status: ResultStatus.Finished,
      };
      const updating: CompareResult = {
        data: [],
        id: 'id',
        status: ResultStatus.Updating,
      };
      const dataUpdatesStub = {
        updateData: jasmine.createSpy('updateData').and.returnValue(
          new Observable<CompareResult>((obs: Observer<CompareResult>) => {
            setTimeout(() => {
              obs.next(updates);
              obs.complete();
            }, 0);
          }),
        ),
      };
      const utilsStub = {
        mapDatafiles: () => new Map([['', { data: {}, children: [] } as any]]),
        addChild: () => undefined,
        sleep: () => Promise.resolve(),
      };
      (component as any).dataUpdatesService = dataUpdatesStub;
      (component as any).utils = utilsStub;
      component.data.set(updating);
      component['startUpdatePolling'](true);
      await new Promise<void>((r) => setTimeout(r));
      expect(component.loading()).toBeFalse();

      dataUpdatesStub.updateData.and.returnValue(
        new Observable<CompareResult>((obs: Observer<CompareResult>) => {
          setTimeout(() => {
            obs.next(updating);
            obs.complete();
          }, 0);
        }),
      );
      component.refreshHidden.set(false);
      component.refresh();
      // refresh() immediately sets refreshHidden to true
      expect(component.refreshHidden()).toBeTrue();
      // After yielding, the polling loop may change it based on retries
      await new Promise<void>((r) => setTimeout(r));
    });

    it('does not start parallel compare polling loops on repeated updating state emissions', () => {
      const updating: CompareResult = {
        data: [],
        id: 'id',
        status: ResultStatus.Updating,
      };
      const dataUpdatesStub = {
        updateData: jasmine
          .createSpy('updateData')
          .and.returnValue(of(updating)),
      };
      const utilsStub = {
        mapDatafiles: () => new Map([['', { data: {}, children: [] } as any]]),
        addChild: () => undefined,
        sleep: jasmine
          .createSpy('sleep')
          .and.returnValue(new Promise<void>(() => undefined)),
      };
      (component as any).dataUpdatesService = dataUpdatesStub;
      (component as any).utils = utilsStub;

      dataStateStub.updateState({ ...updating });
      fixture.detectChanges();
      expect(dataUpdatesStub.updateData.calls.count()).toBe(1);

      dataStateStub.updateState({ ...updating });
      fixture.detectChanges();
      expect(dataUpdatesStub.updateData.calls.count()).toBe(1);

      component.ngOnDestroy();
    });

    it('stops recursive compare polling after destroy', async () => {
      const updating: CompareResult = {
        data: [],
        id: 'id',
        status: ResultStatus.Updating,
      };
      const dataUpdatesStub = {
        updateData: jasmine
          .createSpy('updateData')
          .and.returnValue(of(updating)),
      };
      let resolveSleep: (() => void) | undefined;
      const utilsStub = {
        mapDatafiles: () => new Map([['', { data: {}, children: [] } as any]]),
        addChild: () => undefined,
        sleep: jasmine.createSpy('sleep').and.callFake(
          () =>
            new Promise<void>((resolve) => {
              resolveSleep = resolve;
            }),
        ),
      };
      (component as any).dataUpdatesService = dataUpdatesStub;
      (component as any).utils = utilsStub;

      dataStateStub.updateState({ ...updating });
      fixture.detectChanges();
      expect(dataUpdatesStub.updateData.calls.count()).toBe(1);

      component.ngOnDestroy();
      resolveSleep?.();
      await new Promise<void>((resolve) => setTimeout(resolve, 0));

      expect(dataUpdatesStub.updateData.calls.count()).toBe(1);
      expect((component as any).updatePollingActive).toBeFalse();
    });

    it('caps compare polling retries for updating status', async () => {
      const updating: CompareResult = {
        data: [],
        id: 'id',
        status: ResultStatus.Updating,
      };
      const dataUpdatesStub = {
        updateData: jasmine
          .createSpy('updateData')
          .and.returnValue(of(updating)),
      };
      const utilsStub = {
        mapDatafiles: () => new Map([['', { data: {}, children: [] } as any]]),
        addChild: () => undefined,
        sleep: () => Promise.resolve(),
      };
      (component as any).dataUpdatesService = dataUpdatesStub;
      (component as any).utils = utilsStub;

      dataStateStub.updateState({ ...updating });
      fixture.detectChanges();
      await new Promise<void>((resolve) => setTimeout(resolve, 0));

      expect(dataUpdatesStub.updateData.calls.count()).toBe(
        APP_CONSTANTS.MAX_UPDATE_RETRIES + 1,
      );
      expect(component.refreshHidden()).toBeFalse();
      expect(component.loading()).toBeFalse();
    });
  });
});
