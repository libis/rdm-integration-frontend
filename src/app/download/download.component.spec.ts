import {
  provideHttpClient,
  withInterceptorsFromDi,
} from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import {
  TestBed,
  fakeAsync,
  flush,
  flushMicrotasks,
  tick,
} from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { SelectItem, TreeNode } from 'primeng/api';
import { BehaviorSubject, Observable, of, throwError } from 'rxjs';
import { DataService } from '../data.service';
import { DvObjectLookupService } from '../dvobject.lookup.service';
import { CompareResult } from '../models/compare-result';
import { Datafile, Fileaction } from '../models/datafile';
import { PluginService } from '../plugin.service';
import { RepoLookupService } from '../repo.lookup.service';
import { NavigationService } from '../shared/navigation.service';
import { NotificationService } from '../shared/notification.service';
import { SubmitService } from '../submit.service';
import { UtilsService } from '../utils.service';
import { DownloadComponent } from './download.component';

class MockNotificationService {
  errors: string[] = [];
  successes: string[] = [];
  showError(msg: string) {
    this.errors.push(msg);
  }
  showSuccess(msg: string) {
    this.successes.push(msg);
  }
}

class MockRepoLookupService {
  options: SelectItem<string>[] = [];
  search(_req?: unknown): Observable<SelectItem<string>[]> {
    return of<SelectItem<string>[]>([]);
  }
  getOptions(): Observable<SelectItem<string>[]> {
    return new Observable<SelectItem<string>[]>((obs) => {
      setTimeout(() => {
        obs.next(this.options);
        obs.complete();
      }, 0);
    });
  }
}

class MockSubmitService {
  succeed = true;
  responseTaskId = 'task-123';
  responseMonitorUrl?: string;

  download() {
    return new Observable<{ taskId: string; monitorUrl?: string }>((obs) => {
      setTimeout(() => {
        if (this.succeed) {
          obs.next({
            taskId: this.responseTaskId,
            monitorUrl: this.responseMonitorUrl,
          });
          obs.complete();
        } else {
          obs.error({ error: 'failX' });
        }
      }, 0);
    });
  }
}

class MockDvObjectLookupService {
  items: SelectItem<string>[] = [];
  error?: string;

  getItems() {
    return new Observable<SelectItem<string>[]>((obs) => {
      setTimeout(() => {
        if (this.error) {
          obs.error({ error: this.error });
        } else {
          obs.next(this.items);
          obs.complete();
        }
      }, 0);
    });
  }
}

class MockDataService {
  response: any = { data: [] };
  error?: string;
  userLoggedIn = false;

  getDownloadableFiles() {
    return new Observable<any>((obs) => {
      setTimeout(() => {
        if (this.error) {
          obs.error({ error: this.error });
        } else {
          obs.next(this.response);
          obs.complete();
        }
      }, 0);
    });
  }

  getUserInfo() {
    return of({ loggedIn: this.userLoggedIn });
  }
}

class MockUtilsService {
  mapDatafiles(datafiles: Datafile[]) {
    const root: TreeNode<Datafile> = {
      data: {
        id: '',
        name: '',
        path: '',
        hidden: false,
        action: Fileaction.Ignore,
      } as Datafile,
      children: [],
    };
    const map = new Map<string, TreeNode<Datafile>>();
    map.set('', root);
    datafiles.forEach((df, idx) => {
      const node: TreeNode<Datafile> = { data: df, children: [] };
      root.children!.push(node);
      map.set(df.id ?? String(idx), node);
    });
    return map;
  }

  addChild(): void {
    // already linked in mapDatafiles
  }
}

class MockPluginService {
  storeDvToken = false;
  showDvToken = false;
  oauthClientId = 'client-id';

  setConfig() {
    return Promise.resolve();
  }
  isStoreDvToken() {
    return this.storeDvToken;
  }
  showDVToken() {
    return this.showDvToken;
  }
  datasetFieldEditable() {
    return true;
  }
  getGlobusPlugin() {
    return {
      repoNameFieldName: 'Repo Name',
      sourceUrlFieldValue: 'https://example.com',
      repoNameFieldHasInit: true,
      tokenGetter: {
        URL: '/oauth',
        oauth_client_id: this.oauthClientId,
      },
      optionFieldName: 'Folder',
      repoNameFieldEditable: true,
      repoNameFieldPlaceholder: 'endpoint',
      optionFieldInteractive: true,
    } as any;
  }
  getRedirectUri() {
    return 'https://app.example/callback';
  }
}

class MockNavigationService {
  assign = jasmine.createSpy('assign');
}

describe('DownloadComponent', () => {
  let component: DownloadComponent;

  let notification: MockNotificationService;
  let repoLookup: MockRepoLookupService;
  let submit: MockSubmitService;
  let plugin: MockPluginService;
  let dvLookup: MockDvObjectLookupService;
  let dataService: MockDataService;
  let utils: MockUtilsService;
  let navigation: MockNavigationService;
  let routeSubject: BehaviorSubject<Record<string, string | undefined>>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    notification = new MockNotificationService();
    repoLookup = new MockRepoLookupService();
    submit = new MockSubmitService();
    plugin = new MockPluginService();
    dvLookup = new MockDvObjectLookupService();
    dataService = new MockDataService();
    utils = new MockUtilsService();
    navigation = new MockNavigationService();
    routeSubject = new BehaviorSubject<Record<string, string | undefined>>({});

    await TestBed.configureTestingModule({
      imports: [DownloadComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
        { provide: NotificationService, useValue: notification },
        { provide: RepoLookupService, useValue: repoLookup },
        { provide: SubmitService, useValue: submit },
        { provide: PluginService, useValue: plugin },
        { provide: DvObjectLookupService, useValue: dvLookup },
        { provide: DataService, useValue: dataService },
        { provide: UtilsService, useValue: utils },
        { provide: NavigationService, useValue: navigation },
        {
          provide: ActivatedRoute,
          useValue: { queryParams: routeSubject.asObservable() },
        },
      ],
    })
      .overrideComponent(DownloadComponent, {
        set: { template: '<div></div>' },
      })
      .compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
  });

  function initComponent(
    params?: Record<string, string | undefined>,
    beforeDetect?: (comp: DownloadComponent) => void,
  ): DownloadComponent {
    routeSubject.next(params ?? {});
    const fixtureInstance = TestBed.createComponent(DownloadComponent);
    const compInstance = fixtureInstance.componentInstance;
    beforeDetect?.(compInstance);
    fixtureInstance.detectChanges();
    compInstance.globusPlugin = plugin.getGlobusPlugin();
    navigation.assign.calls.reset();
    component = compInstance;
    return compInstance;
  }

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
    submit.succeed = true;
  });

  it('should create', () => {
    initComponent();
    expect(component).toBeTruthy();
  });

  it('downloadDisabled true when no selected download actions', () => {
    initComponent();
    component.rowNodeMap.set('', {
      data: { id: '', name: '', path: '', hidden: false },
    });
    expect(component.downloadDisabled()).toBeTrue();
  });

  it('onDatasetSearch guards short terms and triggers search for valid term', () => {
    initComponent();
    component.onDatasetSearch(null);
    expect(component.doiItems[0].label).toContain('start typing');
    component.onDatasetSearch('ab');
    expect(component.doiItems[0].label).toContain('start typing');
    component.onDatasetSearch('abc');
    expect(component.doiItems[0].label).toContain('searching');
  });

  it('toggleAction propagates through root when present', () => {
    initComponent();
    const root: TreeNode<Datafile> = {
      data: {
        id: '',
        name: '',
        path: '',
        hidden: false,
        action: Fileaction.Ignore,
      },
      children: [],
    };
    component.rowNodeMap.set('', root);
    component.toggleAction(); // should not throw
    expect(root.data?.action).toBeDefined();
  });

  it('getRepoLookupRequest enforces repo name presence when not search', () => {
    initComponent();
    component.globusPlugin = {
      repoNameFieldName: 'Repo Name',
      sourceUrlFieldValue: 'https://x',
    } as any;
    const req = component.getRepoLookupRequest(false);
    expect(req).toBeUndefined();
    expect(notification.errors.some((e) => e.includes('Repo Name'))).toBeTrue();
  });

  it('getRepoLookupRequest short-circuits when branchItems already loaded', () => {
    initComponent();
    component.branchItems = [{ label: 'existing', value: 'v' }];
    const req = component.getRepoLookupRequest(false);
    expect(req).toBeUndefined();
  });

  it('getRepoLookupRequest builds request when conditions satisfied', () => {
    initComponent();
    component.selectedRepoName = 'repoA';
    const req = component.getRepoLookupRequest(false);
    expect(req).toBeDefined();
    expect(component.branchItems[0].label).toBe('Loading...');
  });

  it('getOptions populates node children for nested request', fakeAsync(() => {
    initComponent();
    component.selectedRepoName = 'repoA';
    repoLookup.options = [
      { label: 'opt1', value: 'o1' },
      { label: 'opt2', value: 'o2' },
    ];
    const parent: TreeNode<string> = {
      label: 'p',
      data: 'p',
      selectable: true,
    };
    component.getOptions(parent);
    tick();
    expect(parent.children?.length).toBe(2);
    expect(component.optionsLoading).toBeFalse();
  }));

  it('getOptions handles error path', fakeAsync(() => {
    initComponent();
    component.selectedRepoName = 'repoA';
    // force error
    spyOn(repoLookup, 'getOptions').and.returnValue(
      new Observable((obs) => {
        queueMicrotask(() => obs.error({ error: 'BOOM' }));
      }),
    );
    component.getOptions();
    tick();
    expect(
      notification.errors.some((e) => e.includes('Branch lookup failed')),
    ).toBeTrue();
    expect(component.branchItems.length).toBe(0);
    expect(component.option).toBeUndefined();
  }));

  it('download surfaces error and stops polling setup', fakeAsync(() => {
    initComponent();
    const df: Datafile = {
      id: '1',
      name: 'f',
      path: '',
      hidden: false,
      action: Fileaction.Download,
    } as any;
    component.rowNodeMap.set('1:file', { data: df });
    component.option = 'branchX';
    component.selectedRepoName = 'repoX';

    submit.succeed = false;
    component.download();
    tick();

    expect(
      notification.errors.some((e) => e.includes('Download request failed')),
    ).toBeTrue();
    expect(component.statusPollingActive).toBeFalse();
    expect(component.lastTransferTaskId).toBeUndefined();
  }));

  it('download success stores monitoring info', fakeAsync(() => {
    initComponent();
    const df: Datafile = {
      id: '1',
      name: 'f',
      path: '',
      hidden: false,
      action: Fileaction.Download,
    } as any;
    component.rowNodeMap.set('1:file', { data: df });
    component.option = 'branchX';
    component.selectedRepoName = 'repoX';

    submit.responseTaskId = 'task-789';
    submit.responseMonitorUrl = 'https://app.globus.org/activity/task-789';

    component.download();
    tick();

    expect(notification.successes.pop()).toContain('Globus task ID: task-789');
    expect(component.lastTransferTaskId).toBe('task-789');
    expect(component.globusMonitorUrl).toBe(
      'https://app.globus.org/activity/task-789',
    );
    expect(component.downloadRequested).toBeFalse();
    expect(component.downloadInProgress).toBeFalse();
  }));

  it('download surfaces error notification', fakeAsync(() => {
    initComponent();
    const df: Datafile = {
      id: '1',
      name: 'f',
      path: '',
      hidden: false,
      action: Fileaction.Download,
    } as any;
    component.rowNodeMap.set('1:file', { data: df });
    component.option = 'branchX';
    component.selectedRepoName = 'repoX';

    submit.succeed = false;
    component.download();
    tick();

    expect(
      notification.errors.some((e) => e.includes('Download request failed')),
    ).toBeTrue();
    expect(component.statusPollingActive).toBeFalse();
    expect(component.lastTransferTaskId).toBeUndefined();
  }));

  it('onStatusPollingChange toggles polling state flag', () => {
    initComponent();
    component.onStatusPollingChange(true);
    expect(component.statusPollingActive).toBeTrue();
    component.onStatusPollingChange(false);
    expect(component.statusPollingActive).toBeFalse();
  });

  it('datasetSearch resolves lookup results', async () => {
    const comp = initComponent();
    dvLookup.items = [
      { label: 'Dataset 1', value: 'doi:1' },
      { label: 'Dataset 2', value: 'doi:2' },
    ];

    const results = await comp.datasetSearch('Dat');

    expect(results.length).toBe(2);
    expect(results[1].value).toBe('doi:2');
  });

  it('getOptions populates branchItems when called without node', fakeAsync(() => {
    const comp = initComponent();
    comp.selectedRepoName = 'repoA';
    repoLookup.options = [
      { label: 'folder-a', value: 'folder-a' },
      { label: 'folder-b', value: 'folder-b' },
    ];

    comp.getOptions();
    tick();

    expect(comp.branchItems.length).toBe(2);
    expect(comp.branchItems[0].label).toBe('folder-a');
  }));

  it('helper accessors mirror globus plugin configuration', () => {
    const comp = initComponent();
    comp.globusPlugin = {
      repoNameFieldEditable: true,
      repoNameFieldPlaceholder: 'type repo',
      repoNameFieldHasInit: false,
      optionFieldName: 'Storage Option',
      repoNameFieldName: 'Endpoint',
    } as any;

    expect(comp.repoNameFieldEditable()).toBeTrue();
    expect(comp.getRepoNamePlaceholder()).toBe('type repo');
    expect(comp.repoNameSearchInitEnabled()).toBeFalse();
    expect(comp.getOptionFieldName()).toBe('Storage Option');
    expect(comp.getRepoNameFieldName()).toBe('Endpoint');
  });

  it('getRepoName prefers selected value but falls back to found name', () => {
    const comp = initComponent();
    comp.foundRepoName = 'found-repo';
    expect(comp.getRepoName()).toBe('found-repo');
    comp.selectedRepoName = 'chosen-repo';
    expect(comp.getRepoName()).toBe('chosen-repo');
  });

  it('getRepoLookupRequest uses fallback repo name when selection missing', () => {
    const comp = initComponent();
    comp.foundRepoName = 'fallback-repo';
    const req = comp.getRepoLookupRequest(true);
    expect(req?.repoName).toBe('fallback-repo');
  });

  it('getRepoToken honours absolute token getter URL', () => {
    const comp = initComponent();
    const openSpy = spyOn(window, 'open');
    comp.globusPlugin = {
      sourceUrlFieldValue: 'https://api.example',
      tokenGetter: {
        URL: 'https://oauth.example/authorize',
        oauth_client_id: '',
      },
    } as any;

    comp.getRepoToken();

    expect(openSpy).toHaveBeenCalledWith(
      'https://oauth.example/authorize',
      '_blank',
    );
  });

  it('newNonce produces random alphanumeric string of given length', () => {
    const comp = initComponent();
    const nonce = comp.newNonce(24);
    const nonce2 = comp.newNonce(24);

    expect(nonce.length).toBe(24);
    expect(/^[A-Za-z0-9]+$/.test(nonce)).toBeTrue();
    expect(nonce2).not.toBe(nonce);
  });

  it('optionSelected toggles option depending on node data', () => {
    initComponent();
    component.optionSelected({ data: '' } as TreeNode<string>);
    expect(component.option).toBeUndefined();
    expect(component.selectedOption).toBeUndefined();

    const node: TreeNode<string> = { data: '/path', label: 'Path' };
    component.optionSelected(node);
    expect(component.option).toBe('/path');
    expect(component.selectedOption).toBe(node);
  });

  it('onRepoChange clears branch options and selection', () => {
    initComponent();
    component.branchItems = [{ label: 'opt', value: 'opt' }];
    component.option = 'opt';
    component.onRepoChange();
    expect(component.branchItems.length).toBe(0);
    expect(component.option).toBeUndefined();
  });

  it('getDoiOptions skips reload when options already present', () => {
    initComponent();
    component.doiItems = [{ label: 'existing', value: 'doi:existing' }];
    component.datasetId = 'doi:existing';
    dvLookup.items = [{ label: 'other', value: 'doi:other' }];
    component.getDoiOptions();
    expect(component.doiItems[0].value).toBe('doi:existing');
  });

  it('onUserChange resets selections and persists token when configured', () => {
    initComponent();
    plugin.storeDvToken = true;
    component.dataverseToken = 'dvTok';
    component.doiItems = [{ label: 'a', value: 'a' }];
    component.datasetId = 'a';
    component.onUserChange();
    expect(localStorage.getItem('dataverseToken')).toBe('dvTok');
    expect(component.doiItems.length).toBe(0);
    expect(component.datasetId).toBeUndefined();
  });

  it('getRepoToken builds redirect including dataset state when available', () => {
    initComponent();
    component.globusPlugin = plugin.getGlobusPlugin();
    component.datasetId = 'doi:ABC';
    component.dataverseToken = 'tok';
    component.getRepoToken();
    expect(localStorage.getItem('dataverseToken')).toBe('tok');
    expect(navigation.assign).toHaveBeenCalled();
    const redirectUrl = navigation.assign.calls.mostRecent().args[0] as string;
    const match = redirectUrl.match(/state=([^&]+)/);
    expect(match).toBeTruthy();
    const state = JSON.parse(decodeURIComponent(match![1]));
    expect(state.datasetId.value).toBe('doi:ABC');
  });

  it('getRepoToken omits dataset when placeholder selected', () => {
    initComponent();
    component.globusPlugin = plugin.getGlobusPlugin();
    component.datasetId = '?';
    component.getRepoToken();
    expect(navigation.assign).toHaveBeenCalled();
    const redirectUrl = navigation.assign.calls.mostRecent().args[0] as string;
    const match = redirectUrl.match(/state=([^&]+)/);
    expect(match).toBeTruthy();
    const state = JSON.parse(decodeURIComponent(match![1]));
    expect(state.datasetId).toBeUndefined();
  });

  it('optionSelected clears selection when node empty', () => {
    initComponent();
    component.optionSelected({
      data: 'folder',
      selectable: true,
    } as TreeNode<string>);
    expect(component.option).toBe('folder');
    component.optionSelected({
      data: '',
      selectable: true,
    } as TreeNode<string>);
    expect(component.option).toBeUndefined();
    expect(component.selectedOption).toBeUndefined();
  });

  it('downloadDisabled requires option and at least one download action', () => {
    initComponent();
    const df: Datafile = {
      id: '1',
      name: 'f',
      path: '',
      hidden: false,
      action: Fileaction.Download,
    } as any;
    component.rowNodeMap.set('1', { data: df });
    component.downloadRequested = false;
    component.option = undefined;
    expect(component.downloadDisabled()).toBeTrue();
    component.option = 'folder';
    expect(component.downloadDisabled()).toBeFalse();
  });

  it('onDatasetChange populates tree on success', fakeAsync(() => {
    initComponent();
    const payload: CompareResult = {
      data: [
        {
          id: 'b',
          name: 'B',
          path: '',
          hidden: false,
          action: Fileaction.Download,
        } as Datafile,
        {
          id: 'a',
          name: 'A',
          path: '',
          hidden: false,
          action: Fileaction.Ignore,
        } as Datafile,
      ],
      id: 'root',
    };
    dataService.response = payload;
    component.datasetId = 'doi:test';
    component.onDatasetChange();
    tick();
    expect(component.loading).toBeFalse();
    expect(component.rootNodeChildren.length).toBe(2);
    expect(component.rootNodeChildren[0].data?.id).toBe('a');
  }));

  it('onDatasetChange surfaces errors from service', fakeAsync(() => {
    initComponent();
    dataService.error = 'service-down';
    component.datasetId = 'doi:test';
    component.onDatasetChange();
    tick();
    expect(
      notification.errors.some((msg) =>
        msg.includes('Getting downloadable files failed'),
      ),
    ).toBeTrue();
  }));

  it('ngOnInit processes globus callback state and fetches token', fakeAsync(() => {
    localStorage.setItem('dataverseToken', 'persisted');
    let datasetSpy!: jasmine.Spy<() => void>;
    initComponent(
      {
        code: 'oauth-code',
        state: JSON.stringify({
          nonce: 'nonce-123',
          datasetId: { value: 'doi:123', label: 'Dataset 123' },
        }),
      },
      (compInstance) => {
        datasetSpy = spyOn(compInstance, 'onDatasetChange').and.stub();
      },
    );
    tick();

    const req = httpMock.expectOne('api/common/oauthtoken');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      pluginId: 'globus',
      code: 'oauth-code',
      nonce: 'nonce-123',
    });
    req.flush({ session_id: 'session-xyz' });
    tick();

    expect(datasetSpy).toHaveBeenCalled();
    expect(component.token).toBe('session-xyz');
    expect(localStorage.getItem('dataverseToken')).toBeNull();
  }));

  it('ngOnInit skips dataset load when state value is placeholder', fakeAsync(() => {
    let datasetSpy!: jasmine.Spy<() => void>;
    initComponent(
      {
        code: 'oauth-code',
        state: JSON.stringify({
          nonce: 'nonce-789',
          datasetId: { value: '?' },
        }),
      },
      (compInstance) => {
        datasetSpy = spyOn(compInstance, 'onDatasetChange').and.stub();
      },
    );
    tick();

    const req = httpMock.expectOne('api/common/oauthtoken');
    req.flush({ session_id: 'session-abc' });
    tick();

    expect(datasetSpy).not.toHaveBeenCalled();
  }));

  it('ngOnInit without oauth code triggers repo token lookup', fakeAsync(() => {
    let tokenSpy!: jasmine.Spy<() => void>;
    initComponent(
      {
        datasetPid: 'doi:XYZ',
        apiToken: 'dvTok',
      },
      (compInstance) => {
        tokenSpy = spyOn(compInstance, 'getRepoToken').and.callThrough();
      },
    );
    tick();

    expect(component.datasetId).toBe('doi:XYZ');
    expect(tokenSpy).toHaveBeenCalled();
  }));

  it('repoName search subscription surfaces errors from service', fakeAsync(() => {
    const comp = initComponent();
    tick();
    flushMicrotasks();
    comp.globusPlugin = {
      repoNameFieldName: 'Endpoint',
      repoNameFieldHasInit: true,
      sourceUrlFieldValue: 'https://globus.example',
    } as any;
    spyOn(repoLookup, 'search').and.returnValue(
      throwError(() => new Error('network down')),
    );

    comp.onRepoNameSearch('abc');
    tick(comp.DEBOUNCE_TIME + 1);
    flushMicrotasks();
    flush();
    flushMicrotasks();

    expect(comp.repoNames[0].label).toContain('search failed');
  }));

  it('dataset search subscription handles rejected lookups', fakeAsync(() => {
    const comp = initComponent();
    tick();
    flushMicrotasks();
    spyOn(dvLookup, 'getItems').and.returnValue(
      throwError(() => new Error('lookup-fail')),
    );

    comp.onDatasetSearch('proj');
    tick(comp.DEBOUNCE_TIME + 1);
    flushMicrotasks();
    flush();
    flushMicrotasks();

    expect(comp.doiItems[0].label).toContain('search failed');
  }));
});
