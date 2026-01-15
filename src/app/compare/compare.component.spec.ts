import {
  provideHttpClient,
  withInterceptorsFromDi,
} from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import {
  ComponentFixture,
  TestBed,
  fakeAsync,
  tick,
} from '@angular/core/testing';

import { Router } from '@angular/router';
import { TreeNode } from 'primeng/api';
import { BehaviorSubject, Observable, Observer, Subscription, of } from 'rxjs';
import { CredentialsService } from '../credentials.service';
import { DataStateService } from '../data.state.service';
import { DataUpdatesService } from '../data.updates.service';
import { CompareResult, ResultStatus } from '../models/compare-result';
import { Datafile, Fileaction, Filestatus } from '../models/datafile';
import { PluginService } from '../plugin.service';
import { SnapshotStorageService } from '../shared/snapshot-storage.service';
import { CompareComponent } from './compare.component';

class StubDataStateService {
  private readonly state$ = new BehaviorSubject<CompareResult | null>(null);

  initializeState(): void {}

  cancelInitialization(resetState = true): void {
    if (resetState) {
      this.state$.next(null);
    }
  }

  getObservableState(): Observable<CompareResult | null> {
    return this.state$.asObservable();
  }

  updateState(state: CompareResult): void {
    this.state$.next(state);
  }

  getCurrentValue(): CompareResult | null {
    return this.state$.getValue();
  }

  resetState(): void {
    this.state$.next(null);
  }
}

class StubDataUpdatesService {
  updateData(data: Datafile[], pid: string) {
    return of({ id: pid, data } as CompareResult);
  }
}

class StubCredentialsService {
  credentials: any = {
    pluginId: 'local',
    plugin: 'local',
    repo_name: 'owner/repo',
  };
}

class StubPluginService {
  getPlugin(_id: string) {
    return { name: 'Test Plugin' };
  }

  dataverseHeader() {
    return 'Dataverse:';
  }
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
  let credentialsStub: StubCredentialsService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CompareComponent],
      providers: [
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
        { provide: DataStateService, useClass: StubDataStateService },
        { provide: DataUpdatesService, useClass: StubDataUpdatesService },
        { provide: CredentialsService, useClass: StubCredentialsService },
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
    credentialsStub = TestBed.inject(
      CredentialsService,
    ) as unknown as StubCredentialsService;

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
    (component as any).credentialsService = {
      credentials: { dataset_id: 'doi:10.777/TEST' },
    };
    component['data'] = { id: 'doiFallback' } as any;
    component.back();
    expect(mergeSpy).toHaveBeenCalledWith(
      jasmine.objectContaining({ dataset_id: 'doi:10.777/TEST' }),
    );
    expect(navigateSpy).toHaveBeenCalledWith(['/connect']);
  });

  it('submit() navigates to metadata-selector when new dataset path', () => {
    const router = TestBed.inject(Router);
    const navigateSpy = spyOn(router, 'navigate');
    // Stub required services/fields for submit()
    (component as any).dataStateService = {
      updateState: jasmine.createSpy('updateState'),
      cancelInitialization: jasmine.createSpy('cancelInitialization'),
    };
    (component as any).credentialsService = {
      credentials: { newly_created: true },
    };
    component['data'] = { id: '' } as any; // new dataset heuristic
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
    component.loading = true;

    component.ngOnDestroy();

    expect(unsubscribeCalled).toBeTrue();
    expect(cancelSpy).toHaveBeenCalledOnceWith(true);
  });

  it('ngOnDestroy skips reset when not loading', () => {
    const cancelSpy = jasmine.createSpy('cancelInitialization');
    (component as any).dataStateService = { cancelInitialization: cancelSpy };

    component.loading = false;
    component.ngOnDestroy();

    expect(cancelSpy).toHaveBeenCalledOnceWith(false);
  });

  describe('canProceed() logic', () => {
    function setCreds(creds: any) {
      (component as any).credentialsService = { credentials: creds };
    }
    function addFileSelection() {
      // simulate one selected file node with non-Ignore action
      (component as any).rowNodeMap.set('file1', {
        data: { attributes: { isFile: true }, action: 1 },
      } as any);
    }

    beforeEach(() => {
      (component as any).rowNodeMap = new Map();
    });

    it('non-new dataset requires selection', () => {
      setCreds({ newly_created: false });
      component['data'] = { id: 'doi:10/EXISTING' } as any;
      expect(component.canProceed()).toBeFalse();
      addFileSelection();
      expect(component.canProceed()).toBeTrue();
    });

    it('new dataset with metadata_available true can proceed without selection', () => {
      setCreds({ newly_created: true, metadata_available: true });
      component['data'] = { id: '' } as any; // new dataset scenario
      expect(component.canProceed()).toBeTrue();
    });

    it('new dataset without metadata_available requires selection', () => {
      setCreds({ newly_created: true, metadata_available: false });
      component['data'] = { id: '' } as any;
      expect(component.canProceed()).toBeFalse();
      addFileSelection();
      expect(component.canProceed()).toBeTrue();
    });

    it('proceedTitle reflects metadata-only vs blocked states', () => {
      // Blocked: new dataset, no metadata, no files
      setCreds({ newly_created: true, metadata_available: false });
      component['data'] = { id: '' } as any;
      expect(component.proceedTitle()).toContain('Select at least one file');

      // Metadata-only allowed: new dataset, metadata available, no files
      setCreds({ newly_created: true, metadata_available: true });
      component['data'] = { id: '' } as any;
      // Ensure no selection yet
      (component as any).rowNodeMap = new Map();
      expect(component.canProceed()).toBeTrue();
      expect(component.proceedTitle()).toContain('metadata-only');

      // Existing dataset: need selection
      setCreds({ newly_created: false });
      component['data'] = { id: 'doi:10/EXISTING' } as any;
      expect(component.canProceed()).toBeFalse();
      expect(component.proceedTitle()).toBe('Action not available yet');
    });

    it('new dataset with undefined metadata_available allowed metadata-only', () => {
      setCreds({ newly_created: true });
      component['data'] = { id: '' } as any;
      expect(component.canProceed()).toBeTrue();
      expect(component.proceedTitle()).toContain('metadata-only');
    });

    it('isNewDataset() falls back to dataset id heuristic when flag missing', () => {
      // No newly_created flag, id includes New Dataset (case-insensitive)
      (component as any).credentialsService = { credentials: {} };
      component['data'] = { id: 'root:COLL:New Dataset' } as any;
      expect(component['isNewDataset']()).toBeTrue();

      // Plain empty id treated as new
      component['data'] = { id: '' } as any;
      expect(component['isNewDataset']()).toBeTrue();

      // Non-new id without flag
      component['data'] = { id: 'doi:10.123/EXISTING' } as any;
      expect(component['isNewDataset']()).toBeFalse();
    });
  });

  describe('row operations and filtering', () => {
    const makeNode = (
      status: Filestatus,
      action: Fileaction = Fileaction.Ignore,
      hidden = false,
    ): TreeNode<Datafile> => ({
      data: {
        id: Math.random().toString(),
        name: 'f',
        path: '',
        hidden,
        status,
        action,
        attributes: { isFile: true },
      } as unknown as Datafile,
      children: [],
    });

    beforeEach(() => {
      (component as any).rowNodeMap = new Map<string, TreeNode<Datafile>>();
    });

    it('noActionSelection resets only visible nodes', () => {
      const visible = makeNode(Filestatus.New, Fileaction.Copy, false);
      const hidden = makeNode(Filestatus.New, Fileaction.Delete, true);
      const map = new Map<string, TreeNode<Datafile>>([
        ['v', visible],
        ['h', hidden],
      ]);
      (component as any).rowNodeMap = map;
      component.noActionSelection();
      expect(visible.data!.action).toBe(Fileaction.Ignore);
      expect(hidden.data!.action).toBe(Fileaction.Delete);
    });

    it('updateSelection and mirrorSelection apply status-specific actions', () => {
      const nodes = [
        makeNode(Filestatus.New),
        makeNode(Filestatus.Equal),
        makeNode(Filestatus.Updated),
        makeNode(Filestatus.Deleted),
      ];
      const keys = ['new', 'equal', 'upd', 'del'];
      const map = new Map<string, TreeNode<Datafile>>([
        ...nodes.map(
          (node, idx) => [keys[idx], node] as [string, TreeNode<Datafile>],
        ),
      ]);
      (component as any).rowNodeMap = map;
      component.updateSelection();
      expect(nodes[0].data!.action).toBe(Fileaction.Copy);
      expect(nodes[1].data!.action).toBe(Fileaction.Ignore);
      expect(nodes[2].data!.action).toBe(Fileaction.Update);
      expect(nodes[3].data!.action).toBe(Fileaction.Ignore);

      component.mirrorSelection();
      expect(nodes[3].data!.action).toBe(Fileaction.Delete);
    });

    it('filterOn hides non-matching rows and filterOff restores them', () => {
      const root: TreeNode<Datafile> = {
        data: { attributes: { isFile: false } } as unknown as Datafile,
        children: [],
      };
      const includeNode = makeNode(Filestatus.New, Fileaction.Copy);
      const excludeNode = makeNode(Filestatus.Equal, Fileaction.Ignore);
      root.children = [includeNode, excludeNode];
      const map = new Map<string, TreeNode<Datafile>>([
        ['', root],
        ['inc', includeNode],
        ['exc', excludeNode],
      ]);
      (component as any).rowNodeMap = map;
      (component as any).rootNodeChildren = root.children;
      component['filterOn']([{ fileStatus: Filestatus.New } as any]);
      expect(includeNode.data!.hidden).toBeFalse();
      expect(excludeNode.data!.hidden).toBeTrue();
      expect(component.rootNodeChildren).toEqual([includeNode]);
      expect(component.isInFilterMode).toBeTrue();

      const folderUpdateStub = {
        updateFoldersAction: jasmine.createSpy('updateFoldersAction'),
      };
      (component as any).folderActionUpdateService = folderUpdateStub;
      component['filterOff']();
      expect(includeNode.data!.hidden).toBeFalse();
      expect(excludeNode.data!.hidden).toBeFalse();
      expect(folderUpdateStub.updateFoldersAction).toHaveBeenCalledWith(map);
      expect(component.isInFilterMode).toBeFalse();
    });

    it('updateFilters toggles between filtered and full views', fakeAsync(() => {
      const root: TreeNode<Datafile> = {
        data: { attributes: { isFile: false } } as unknown as Datafile,
        children: [],
      };
      const includeNode = makeNode(Filestatus.New, Fileaction.Copy);
      const excludeNode = makeNode(Filestatus.Equal, Fileaction.Ignore);
      root.children = [includeNode, excludeNode];
      const map = new Map<string, TreeNode<Datafile>>([
        ['', root],
        ['inc', includeNode],
        ['exc', excludeNode],
      ]);
      (component as any).rowNodeMap = map;
      (component as any).rootNodeChildren = root.children;
      const folderUpdateStub = {
        updateFoldersAction: jasmine.createSpy('updateFoldersAction'),
      };
      (component as any).folderActionUpdateService = folderUpdateStub;

      component.selectedFilterItems = [component.filterItems[0]];
      component.updateFilters();
      tick();
      expect(component.isInFilterMode).toBeTrue();
      expect(component.rootNodeChildren).toEqual([includeNode]);

      component.selectedFilterItems = [...component.filterItems];
      component.updateFilters();
      tick();
      expect(component.isInFilterMode).toBeFalse();
      expect(folderUpdateStub.updateFoldersAction).toHaveBeenCalledWith(map);
    }));

    it('updateFilters with all items selected resets filter mode', fakeAsync(() => {
      // Start in filtered mode with only one filter selected
      component.selectedFilterItems = [component.filterItems[0]];
      component.isInFilterMode = true;
      const folderUpdateStub = {
        updateFoldersAction: jasmine.createSpy('updateFoldersAction'),
      };
      (component as any).folderActionUpdateService = folderUpdateStub;
      (component as any).rowNodeMap = new Map([
        ['', { data: {}, children: [] } as unknown as TreeNode<Datafile>],
      ]);

      // Now select all filter items (simulating "show all")
      component.selectedFilterItems = [...component.filterItems];
      component.updateFilters();
      tick(0); // flush the setTimeout

      expect(component.selectedFilterItems.length).toBe(4);
      expect(component.isInFilterMode).toBeFalse();
      expect(folderUpdateStub.updateFoldersAction).toHaveBeenCalled();
    }));

    it('hasSelection detects files with non-ignore actions', () => {
      const map = new Map<string, TreeNode<Datafile>>([
        ['file', makeNode(Filestatus.New, Fileaction.Copy)],
      ]);
      (component as any).rowNodeMap = map;
      expect(component.hasSelection()).toBeTrue();
      map.get('file')!.data!.action = Fileaction.Ignore;
      expect(component.hasSelection()).toBeFalse();
    });

    it('setData maps rows and notifies folder status service', () => {
      const df: Datafile = {
        id: 'id',
        name: 'File',
        path: '',
        hidden: false,
        attributes: { isFile: true },
      } as unknown as Datafile;
      const root: TreeNode<Datafile> = {
        data: { attributes: { isFile: false } } as unknown as Datafile,
        children: [{ data: df } as TreeNode<Datafile>],
      };
      const mapped = new Map<string, TreeNode<Datafile>>([
        ['', root],
        ['id', root.children![0]],
      ]);
      const utilsStub = {
        mapDatafiles: jasmine.createSpy('map').and.returnValue(mapped),
        addChild: jasmine.createSpy('addChild'),
      };
      const folderStatusStub = {
        updateTreeRoot: jasmine.createSpy('updateTreeRoot'),
      };
      (component as any).utils = utilsStub;
      (component as any).folderStatusService = folderStatusStub;
      component['setData']({ data: [df], id: 'root' } as CompareResult);
      expect(utilsStub.mapDatafiles).toHaveBeenCalled();
      expect(folderStatusStub.updateTreeRoot).toHaveBeenCalledWith(root);
      expect(component.rootNodeChildren).toEqual(
        root.children as TreeNode<Datafile>[],
      );
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
      expect(firstComponent.rowNodeMap.get('folder')?.data?.action).toBe(
        Fileaction.Copy,
      );

      (firstComponent as any).dataStateService.updateState(
        firstComponent['data'],
      );

      firstComponent.loading = false;
      firstFixture.destroy();

      const secondFixture = TestBed.createComponent(CompareComponent);
      const secondComponent = secondFixture.componentInstance;
      secondFixture.detectChanges();

      const restoredFolderAction =
        secondComponent.rowNodeMap.get('folder')?.data?.action;
      expect(restoredFolderAction).toBe(Fileaction.Copy);
      compareResult.data?.forEach((file) => {
        expect(
          secondComponent.rowNodeMap.get(`${file.id}:file`)?.data?.action,
        ).toBe(Fileaction.Copy);
      });

      secondFixture.destroy();
    });

    it('folderName derives labels based on plugin context', () => {
      (component as any).credentialsService = {
        credentials: {
          pluginId: 'github',
          repo_name: 'owner/repo',
          option: '',
        },
      };
      expect(component.folderName()).toBeUndefined();
      (component as any).credentialsService.credentials.repo_name =
        'owner/repo/subfolder';
      expect(component.folderName()).toBe('subfolder');

      (component as any).credentialsService.credentials = {
        pluginId: 'globus',
        option: '/path/to/folder/',
      };
      expect(component.folderName()).toBe('folder');

      (component as any).credentialsService.credentials = {
        pluginId: 'onedrive',
        option: 'driveId/path/to/folder',
      };
      expect(component.folderName()).toBe('folder');

      (component as any).credentialsService.credentials = {
        pluginId: 'sftp',
        option: 'dir/sub',
      };
      expect(component.folderName()).toBe('sub');
    });

    it('displayDatasetId normalizes new dataset labels', () => {
      component['data'] = { id: '' } as CompareResult;
      expect(component.displayDatasetId()).toBe('New Dataset');
      component['data'] = { id: ':New Dataset' } as CompareResult;
      expect(component.displayDatasetId()).toBe('New Dataset');
      component['data'] = { id: 'doi:10.1/ABC' } as CompareResult;
      expect(component.displayDatasetId()).toBe('doi:10.1/ABC');
    });

    it('repo and dataverseHeaderNoColon use plugin service helpers', () => {
      (component as any).credentialsService = {
        credentials: { pluginId: 'github' },
      };
      (component as any).pluginService = {
        getPlugin: () => ({ name: 'GitHub' }),
        dataverseHeader: () => 'Dataverse:',
      };
      expect(component.repo()).toBe('GitHub');
      expect(component.dataverseHeaderNoColon()).toBe('Dataverse');
    });

    it('newlyCreated and hasSelection cooperate with credentials', () => {
      (component as any).credentialsService = {
        credentials: { newly_created: true },
      };
      expect(component.newlyCreated()).toBeTrue();
      (component as any).credentialsService.credentials.newly_created = false;
      expect(component.newlyCreated()).toBeFalse();
    });

    it('getUpdatedData and refresh process data update responses', fakeAsync(() => {
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
      component['data'] = updating;
      component['getUpdatedData'](0);
      tick();
      expect(component.loading).toBeFalse();

      dataUpdatesStub.updateData.and.returnValue(
        new Observable<CompareResult>((obs: Observer<CompareResult>) => {
          setTimeout(() => {
            obs.next(updating);
            obs.complete();
          }, 0);
        }),
      );
      component.refreshHidden = false;
      component.refresh();
      tick();
      expect(component.refreshHidden).toBeTrue();
    }));
  });
});
