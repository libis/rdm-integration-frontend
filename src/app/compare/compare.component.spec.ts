import {
  provideHttpClient,
  withInterceptorsFromDi,
  withXhr,
} from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import {
  CdkVirtualScrollViewport,
  ScrollDispatcher,
} from '@angular/cdk/scrolling';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';

import { Router } from '@angular/router';
import { Observable, Observer, Subscription, of, throwError } from 'rxjs';
import { CredentialsService } from '../credentials.service';
import { DataStateService } from '../data.state.service';
import { DataUpdatesService } from '../data.updates.service';
import { CompareResult, ResultStatus } from '../models/compare-result';
import { Datafile, Fileaction, Filestatus } from '../models/datafile';
import { PluginService } from '../plugin.service';
import { SnapshotStorageService } from '../shared/snapshot-storage.service';
import { APP_CONSTANTS } from '../shared/constants';
import { NotificationService } from '../shared/notification.service';
import { takePendingReauth } from '../shared/reauth';
import {
  measurePage,
  resizeTestWindow,
  scrolledContainers,
} from '../../testing/page-layout';
import { treegridStructure } from '../../testing/treegrid';
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
  const pluginOptionsSignal = signal<string | undefined>(undefined);

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
    pluginOptionsSignal.set(creds.plugin_options);
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
    pluginOptions$: pluginOptionsSignal.asReadonly(),

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
        provideHttpClient(withXhr(), withInterceptorsFromDi()),
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

  it('redirects redcap2 to the export settings page when plugin options are missing', () => {
    const router = TestBed.inject(Router);
    const navigateSpy = spyOn(router, 'navigate');
    const initializeSpy = spyOn(dataStateStub, 'initializeState');
    credentialsStub.credentials = {
      plugin: 'redcap2',
      pluginId: 'redcap2',
      dataset_id: 'doi:10.777/TEST',
      url: 'https://redcap.test',
      token: 'tok',
    };
    dataStateStub.state$.set(null);
    component.ngOnInit();
    expect(navigateSpy).toHaveBeenCalledWith([
      '/redcap2-export',
      'doi:10.777/TEST',
    ]);
    expect(initializeSpy).not.toHaveBeenCalled();
  });

  it('redirects redcap2 to connect when plugin options and dataset are missing', () => {
    const router = TestBed.inject(Router);
    const navigateSpy = spyOn(router, 'navigate');
    credentialsStub.credentials = { plugin: 'redcap2', pluginId: 'redcap2' };
    dataStateStub.state$.set(null);
    component.ngOnInit();
    expect(navigateSpy).toHaveBeenCalledWith(['/connect']);
  });

  it('compares normally for redcap2 when plugin options are present', () => {
    const router = TestBed.inject(Router);
    const navigateSpy = spyOn(router, 'navigate');
    const initializeSpy = spyOn(dataStateStub, 'initializeState');
    credentialsStub.credentials = {
      plugin: 'redcap2',
      pluginId: 'redcap2',
      dataset_id: 'doi:10.777/TEST',
      plugin_options: '{"exportMode":"records"}',
    };
    dataStateStub.state$.set(null);
    component.ngOnInit();
    expect(navigateSpy).not.toHaveBeenCalled();
    expect(initializeSpy).toHaveBeenCalled();
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

    it('toggleFilter and toggleAllFilters update the selected filters', () => {
      component.toggleAllFilters(false);
      expect(component.selectedFilterItems()).toEqual([]);
      component.toggleFilter(component.filterItems[0], true);
      expect(component.isFilterSelected(component.filterItems[0])).toBeTrue();
      component.toggleAllFilters(true);
      expect(component.selectedFilterItems().length).toBe(
        component.filterItems.length,
      );
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
      component['startUpdatePolling']();
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

    it('shows a progress request failure and allows Refresh to recover', () => {
      const notify = spyOn(TestBed.inject(NotificationService), 'showError');
      const update = spyOn(
        TestBed.inject(DataUpdatesService),
        'updateData',
      ).and.returnValue(
        throwError(() => ({ status: 500, error: 'job failed' })),
      );
      component.data.set({ id: 'id', data: [], status: ResultStatus.Updating });
      component['startUpdatePolling']();

      expect(notify).toHaveBeenCalledWith(
        'Updating file status failed: job failed',
      );
      expect(component.loading()).toBeFalse();
      expect(component.refreshHidden()).toBeFalse();

      update.and.returnValue(
        of({ id: 'id', data: [], status: ResultStatus.Finished }),
      );
      component.refresh();
      expect(update).toHaveBeenCalledTimes(2);
      expect(component.data().status).toBe(ResultStatus.Finished);
      expect(component.loading()).toBeFalse();
    });

    it('preserves a progress reauth request and returns to login', () => {
      spyOn(TestBed.inject(NotificationService), 'showError');
      const navigate = spyOn(TestBed.inject(Router), 'navigate');
      spyOn(TestBed.inject(DataUpdatesService), 'updateData').and.returnValue(
        throwError(() => ({
          status: 401,
          error: { reauth: { required_domains: ['example.org'] } },
        })),
      );
      dataStateStub.updateState({
        id: 'id',
        data: [],
        status: ResultStatus.Updating,
      });
      fixture.detectChanges();

      expect(component.loading()).toBeFalse();
      expect(dataStateStub.state$()).toBeNull();
      expect(takePendingReauth()).toEqual({ domains: ['example.org'] });
      expect(navigate).toHaveBeenCalledWith(['/connect']);
    });

    it('requests a login reset for a plain progress 401', () => {
      spyOn(TestBed.inject(NotificationService), 'showError');
      const navigate = spyOn(TestBed.inject(Router), 'navigate');
      spyOn(TestBed.inject(DataUpdatesService), 'updateData').and.returnValue(
        throwError(() => ({ status: 401, error: 'session expired' })),
      );
      component.data.set({ id: 'id', data: [], status: ResultStatus.Updating });
      component['startUpdatePolling']();

      expect(component.loading()).toBeFalse();
      expect(navigate).toHaveBeenCalledWith(['/connect'], {
        queryParams: { reset: 'true' },
      });
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
      expect((component as any).pollingActive).toBeFalse();
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

// The page with the real template: the host takes the window height minus the
// header and footer tokens, as in the app.
describe('CompareComponent layout', () => {
  const statuses = [
    Filestatus.Equal,
    Filestatus.New,
    Filestatus.Updated,
    Filestatus.Deleted,
  ];
  const files = (count: number): Datafile[] =>
    Array.from({ length: count }, (_, i) => {
      const path = i % 3 === 0 ? '' : `folder${i % 5}`;
      return {
        id: path ? `${path}/file${i}.txt` : `file${i}.txt`,
        name: `file${i}.txt`,
        path,
        hidden: false,
        status: statuses[i % 4],
        action: Fileaction.Ignore,
        attributes: { isFile: true },
      } as unknown as Datafile;
    });

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CompareComponent],
      providers: [
        provideHttpClient(withXhr(), withInterceptorsFromDi()),
        provideHttpClientTesting(),
        { provide: DataStateService, useClass: StubDataStateService },
        { provide: DataUpdatesService, useClass: StubDataUpdatesService },
        { provide: CredentialsService, useValue: createCredentialsStub() },
        { provide: PluginService, useClass: StubPluginService },
        {
          provide: SnapshotStorageService,
          useClass: StubSnapshotStorageService,
        },
        { provide: Router, useClass: StubRouter },
      ],
    }).compileComponents();
  });

  // 300 files at the root and in five folders, like the harness fixture.
  const render = async (rejected: number) => {
    const fixture = TestBed.createComponent(CompareComponent);
    fixture.componentInstance.data.set({
      id: 'doi:10.1234/ABC',
      url: 'https://example.org/ds',
      data: files(300),
      rejectedName: Array.from(
        { length: rejected },
        (_, i) => `bad?name ${i}.txt`,
      ),
      allowedFileNamePattern: '^[\\w .-]+$',
      allowedFolderPathPattern: '^[\\w /.-]*$',
    });
    fixture.componentInstance.loading.set(false);
    await fixture.whenStable();
    return fixture;
  };

  const viewportSize = (fixture: ComponentFixture<CompareComponent>) =>
    fixture.debugElement
      .query(By.directive(CdkVirtualScrollViewport))
      .injector.get(CdkVirtualScrollViewport)
      .getViewportSize();

  // Virtual scrolling renders a window of the rows: each rendered row keeps
  // its position in the whole table and the table its full row count.
  it('numbers the rendered rows within all rows of the treegrid while scrolling', async () => {
    const fixture = await render(0);
    const table = fixture.nativeElement.querySelector('.tt') as HTMLElement;
    const indexes = () =>
      Array.from(
        table.querySelectorAll<HTMLElement>('.tt-body div[app-datafile]'),
        (row) => Number(row.getAttribute('aria-rowindex')),
      );
    // 100 files at the root and the five folders, plus the header row.
    expect(table.getAttribute('aria-rowcount')).toBe('106');
    const top = indexes();
    expect(top[0]).toBe(2);
    expect(top.length).toBeLessThan(105);
    const body = table.querySelector('.tt-body') as HTMLElement;
    body.scrollTop = body.scrollHeight;
    body.dispatchEvent(new Event('scroll'));
    for (let i = 0; i < 3; i++) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
      await fixture.whenStable();
    }
    const bottom = indexes();
    expect(bottom[0]).toBeGreaterThan(2);
    expect(bottom[bottom.length - 1]).toBe(106);
    expect(bottom).toEqual(bottom.map((_, i) => bottom[0] + i));
  });

  const rejectedList = (fixture: ComponentFixture<CompareComponent>) =>
    fixture.nativeElement.querySelector('.compare-rejected') as HTMLElement;

  // An open select or filter panel follows the host when the host scrolls.
  it('reports the scrolling page host to the overlays', async () => {
    const fixture = await render(0);
    expect(
      scrolledContainers(
        TestBed.inject(ScrollDispatcher),
        fixture.nativeElement,
      ),
    ).toEqual([fixture.nativeElement]);
  });

  // The Karma frame is about 437 px high: too small to fit the page, but the
  // table must keep its rows (the review measured 0 px with 3 names).
  for (const rejected of [3, 40]) {
    it(`keeps 12rem of table rows in the Karma frame with ${rejected} rejected file names`, async () => {
      const fixture = await render(rejected);
      const layout = measurePage(fixture.nativeElement);
      expect(layout.body).toBeGreaterThanOrEqual(12 * layout.rem);
      expect(viewportSize(fixture)).toBeGreaterThanOrEqual(12 * layout.rem);
      expect(rejectedList(fixture).offsetHeight).toBeGreaterThan(0);
      // The page host scrolls instead of running under the footer, and
      // scrolled to its end it shows the whole table.
      const host = fixture.nativeElement as HTMLElement;
      expect(getComputedStyle(host).overflowY).toBe('auto');
      expect(host.scrollHeight).toBeGreaterThan(host.clientHeight);
      host.scrollTop = host.scrollHeight;
      const body = host.querySelector('.tt-body') as HTMLElement;
      expect(body.getBoundingClientRect().bottom).toBeLessThanOrEqual(
        host.getBoundingClientRect().bottom + 0.5,
      );
    });
  }

  it('counts the rejected files in the list headings', async () => {
    const fixture = await render(12);
    fixture.componentInstance.data.update((d) => ({
      ...d,
      maxFileSize: 1000,
      rejectedSize: ['big.bin'],
    }));
    await fixture.whenStable();
    const headings = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll(
        '.compare-rejected .file-list-header th',
      ),
    ).map((th) => th.textContent!.replace(/\s+/g, ' ').trim());
    expect(headings).toEqual([
      '1 file exceeding maximum allowed size (1000 bytes):',
      '12 files with unsupported characters (allowed patterns shown below):',
    ]);
  });

  describe('in a 1366x768 window', () => {
    let restoreWindow: () => void;
    beforeEach(() => (restoreWindow = resizeTestWindow(1366, 768)));
    afterEach(() => restoreWindow());

    for (const rejected of [0, 12, 40]) {
      it(`fits the window with ${rejected} rejected file names`, async () => {
        const fixture = await render(rejected);
        const layout = measurePage(fixture.nativeElement);
        expect(layout.window).toBe(768);
        expect(layout.pageHeight).toBeLessThanOrEqual(layout.window);
        expect(layout.hostScrollHeight).toBeLessThanOrEqual(
          layout.hostClientHeight,
        );
        expect(layout.body).toBeGreaterThanOrEqual(12 * layout.rem);
        expect(layout.header).toBe(layout.headerNoRows);
        expect(viewportSize(fixture)).toBeGreaterThanOrEqual(12 * layout.rem);
        expect(
          fixture.nativeElement.querySelectorAll('div[app-datafile]').length,
        ).toBeGreaterThan(10);
        const list = rejectedList(fixture);
        if (!rejected) {
          expect(list).toBeNull();
          return;
        }
        expect(list.offsetHeight).toBeLessThan(layout.body);
        // The names that do not fit scroll inside the list.
        expect(list.scrollHeight).toBeGreaterThan(list.clientHeight);
      });
    }
  });
});

// A folder with one file and a file at the root, rendered with the real
// template: the folder row has a toggler in the source and in the destination
// column.
describe('CompareComponent table', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CompareComponent],
      providers: [
        provideHttpClient(withXhr(), withInterceptorsFromDi()),
        provideHttpClientTesting(),
        { provide: DataStateService, useClass: StubDataStateService },
        { provide: DataUpdatesService, useClass: StubDataUpdatesService },
        { provide: CredentialsService, useValue: createCredentialsStub() },
        { provide: PluginService, useClass: StubPluginService },
        {
          provide: SnapshotStorageService,
          useClass: StubSnapshotStorageService,
        },
        { provide: Router, useClass: StubRouter },
      ],
    }).compileComponents();
  });

  const render = async () => {
    const fixture = TestBed.createComponent(CompareComponent);
    fixture.componentInstance.data.set({
      id: 'doi:10.1234/ABC',
      data: [
        {
          id: 'dir/a.txt',
          name: 'a.txt',
          path: 'dir',
          hidden: false,
          status: Filestatus.New,
          action: Fileaction.Ignore,
          attributes: { isFile: true },
        },
        {
          id: 'b.txt',
          name: 'b.txt',
          path: '',
          hidden: false,
          status: Filestatus.Equal,
          action: Fileaction.Ignore,
          attributes: { isFile: true },
        },
      ] as Datafile[],
    });
    fixture.componentInstance.loading.set(false);
    await fixture.whenStable();
    return fixture;
  };

  const rows = (fixture: ComponentFixture<CompareComponent>) =>
    Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>(
        'div[app-datafile]',
      ),
    );
  const folderRow = (fixture: ComponentFixture<CompareComponent>) =>
    rows(fixture).find((row) => row.querySelector('app-tree-toggler button'))!;

  // The review's demo: after a click on the source toggler the destination
  // toggler still showed a collapsed folder.
  it('shows the same state in both togglers of a row after a click on either', async () => {
    const fixture = await render();
    const row = folderRow(fixture);
    const togglers = () =>
      Array.from(
        row.querySelectorAll<HTMLButtonElement>('app-tree-toggler button'),
      );
    const icons = () =>
      togglers().map((b) =>
        b.querySelector('i')!.classList.contains('pi-chevron-down')
          ? 'down'
          : b.querySelector('i')!.classList.contains('pi-chevron-right')
            ? 'right'
            : 'none',
      );
    const expanded = () =>
      togglers().map((b) => b.getAttribute('aria-expanded'));
    expect(togglers().length).toBe(2);
    expect(icons()).toEqual(['right', 'right']);

    togglers()[0].click();
    await fixture.whenStable();
    expect(rows(fixture).length).toBe(3);
    expect(icons()).toEqual(['down', 'down']);
    expect(expanded()).toEqual(['true', 'true']);

    togglers()[1].click();
    await fixture.whenStable();
    expect(rows(fixture).length).toBe(2);
    expect(icons()).toEqual(['right', 'right']);
    expect(expanded()).toEqual(['false', 'false']);
  });

  // Header and rows had role row without a table, grid or treegrid around
  // them, without cell roles, levels or expansion.
  it('renders a treegrid with levels and the expansion of folder rows', async () => {
    const fixture = await render();
    const header = [
      'columnheader',
      'columnheader',
      'columnheader',
      'columnheader',
    ];
    expect(treegridStructure(fixture.nativeElement)).toEqual({
      table: 'treegrid',
      label: 'Files',
      rowCount: '3',
      header: 'row 1',
      headerCells: header,
      rows: [
        'dir: row 2, level 1, expanded false',
        'b.txt: row 3, level 1, expanded null',
      ],
      cells: ['gridcell'],
    });
    folderRow(fixture)
      .querySelector<HTMLButtonElement>('app-tree-toggler button')!
      .click();
    await fixture.whenStable();
    expect(treegridStructure(fixture.nativeElement)).toEqual({
      table: 'treegrid',
      label: 'Files',
      rowCount: '4',
      header: 'row 1',
      headerCells: header,
      rows: [
        'dir: row 2, level 1, expanded true',
        'a.txt: row 3, level 2, expanded null',
        'b.txt: row 4, level 1, expanded null',
      ],
      cells: ['gridcell'],
    });
  });

  const filterButton = (fixture: ComponentFixture<CompareComponent>) =>
    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(
      '.tt-header button.btn-primary',
    )!;

  // The icon only buttons had no accessible name; the filter button's title
  // sat on the span around it.
  it('names the status filter button and the row action buttons', async () => {
    const fixture = await render();
    const filter = filterButton(fixture);
    expect(filter.getAttribute('aria-label')).toBe(
      'Filter by comparison status',
    );
    expect(filter.title).toBe('Filter by comparison status');
    const file = rows(fixture).find((row) =>
      row.textContent!.includes('b.txt'),
    )!;
    const action = file.querySelector<HTMLButtonElement>(
      '.btn-outline-secondary',
    )!;
    expect(action.getAttribute('aria-label')).toBe('Action: none, change');
    action.click();
    await fixture.whenStable();
    expect(action.getAttribute('aria-label')).toBe('Action: delete, change');
    expect(action.title).toBe('Action: delete, change');
  });
  const filterAll = () =>
    document.querySelector<HTMLInputElement>(
      '.cdk-overlay-container #filter-all',
    );
  const pressEscape = (el: Element) =>
    el.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Escape',
        keyCode: 27,
        bubbles: true,
        cancelable: true,
      }),
    );

  // The panel renders at the end of the body: the review needed 78 Tab
  // presses to reach its first checkbox.
  it('moves focus into the status filter on open and back to its button on Escape', async () => {
    const fixture = await render();
    const button = filterButton(fixture);
    button.focus();
    button.click();
    await fixture.whenStable();
    expect(filterAll()).not.toBeNull();
    expect(document.activeElement).toBe(filterAll());

    pressEscape(document.activeElement!);
    await fixture.whenStable();
    expect(filterAll()).toBeNull();
    expect(document.activeElement).toBe(button);
  });

  // Escape closed the panel through the CDK while filterOpen stayed true, so
  // the next click on the button only reset it and the panel stayed closed.
  it('opens the status filter on the first click after Escape closed it', async () => {
    const fixture = await render();
    const button = filterButton(fixture);
    button.focus();
    button.click();
    await fixture.whenStable();
    pressEscape(filterAll()!);
    await fixture.whenStable();
    expect(filterAll()).toBeNull();
    expect(fixture.componentInstance.filterOpen()).toBeFalse();

    button.click();
    await fixture.whenStable();
    expect(filterAll()).not.toBeNull();
  });

  // Safari and Firefox on macOS do not focus a button on a mouse click, so
  // the focus trap had only the body to give focus back to.
  it('returns focus to the filter button on close when the button had no focus at open', async () => {
    const fixture = await render();
    const button = filterButton(fixture);
    const open = async () => {
      (document.activeElement as HTMLElement | null)?.blur();
      expect(document.activeElement).toBe(document.body);
      button.click();
      await fixture.whenStable();
      expect(document.activeElement).toBe(filterAll());
    };

    await open();
    pressEscape(document.activeElement!);
    await fixture.whenStable();
    expect(filterAll()).toBeNull();
    expect(document.activeElement).toBe(button);

    await open();
    document
      .querySelector<HTMLElement>(
        '.cdk-overlay-container .cdk-overlay-backdrop',
      )!
      .click();
    await fixture.whenStable();
    expect(filterAll()).toBeNull();
    expect(document.activeElement).toBe(button);
  });
});
