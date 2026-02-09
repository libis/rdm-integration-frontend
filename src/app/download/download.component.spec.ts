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
import { signal } from '@angular/core';
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
  private readonly _showDvToken = signal(false);
  private readonly _storeDvToken = signal(false);
  oauthClientId = 'client-id';

  // Signals for computed signal consumers
  readonly showDVToken$ = this._showDvToken.asReadonly();
  readonly datasetFieldEditable$ = signal(true).asReadonly();
  readonly externalURL$ = signal('').asReadonly();

  // Setters for test control
  set showDvToken(v: boolean) {
    this._showDvToken.set(v);
  }
  set storeDvToken(v: boolean) {
    this._storeDvToken.set(v);
  }

  setConfig() {
    return Promise.resolve();
  }
  showDVToken() {
    return this._showDvToken();
  }
  isStoreDvToken() {
    return this._storeDvToken();
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
  redirectToLogin = jasmine.createSpy('redirectToLogin');
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
    compInstance.globusPlugin.set(plugin.getGlobusPlugin());
    navigation.assign.calls.reset();
    component = compInstance;
    return compInstance;
  }

  afterEach(() => {
    httpMock.verify();
    submit.succeed = true;
  });

  it('should create', () => {
    initComponent();
    expect(component).toBeTruthy();
  });

  it('downloadDisabled true when no selected download actions', () => {
    initComponent();
    component.rowNodeMap().set('', {
      data: { id: '', name: '', path: '', hidden: false },
    });
    expect(component.downloadDisabled()).toBeTrue();
  });

  it('onDatasetSearch guards short terms and triggers search for valid term', () => {
    initComponent();
    component.onDatasetSearch(null);
    expect(component.doiItems()[0].label).toContain('start typing');
    component.onDatasetSearch('ab');
    expect(component.doiItems()[0].label).toContain('start typing');
    component.onDatasetSearch('abc');
    expect(component.doiItems()[0].label).toContain('searching');
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
    component.rowNodeMap().set('', root);
    component.toggleAction(); // should not throw
    expect(root.data?.action).toBeDefined();
  });

  it('getRepoLookupRequest enforces repo name presence when not search', () => {
    initComponent();
    component.globusPlugin.set({
      repoNameFieldName: 'Repo Name',
      sourceUrlFieldValue: 'https://x',
    } as any);
    const req = component.getRepoLookupRequest(false);
    expect(req).toBeUndefined();
    expect(notification.errors.some((e) => e.includes('Repo Name'))).toBeTrue();
  });

  it('getRepoLookupRequest short-circuits when branchItems already loaded', () => {
    initComponent();
    component.branchItems.set([{ label: 'existing', value: 'v' }]);
    const req = component.getRepoLookupRequest(false);
    expect(req).toBeUndefined();
  });

  it('getRepoLookupRequest builds request when conditions satisfied', () => {
    initComponent();
    component.selectedRepoName.set('repoA');
    const req = component.getRepoLookupRequest(false);
    expect(req).toBeDefined();
    expect(component.branchItems()[0].label).toBe('Loading...');
  });

  it('getOptions populates node children for nested request', fakeAsync(() => {
    initComponent();
    component.selectedRepoName.set('repoA');
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
    expect(component.optionsLoading()).toBeFalse();
  }));

  it('getOptions handles error path', fakeAsync(() => {
    initComponent();
    component.selectedRepoName.set('repoA');
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
    expect(component.branchItems().length).toBe(0);
    expect(component.option()).toBeUndefined();
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
    component.rowNodeMap().set('1:file', { data: df });
    component.option.set('branchX');
    component.selectedRepoName.set('repoX');

    submit.succeed = false;
    component.download();
    tick();

    expect(
      notification.errors.some((e) => e.includes('Download request failed')),
    ).toBeTrue();
    expect(component.statusPollingActive()).toBeFalse();
    expect(component.lastTransferTaskId()).toBeUndefined();
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
    component.rowNodeMap().set('1:file', { data: df });
    component.option.set('branchX');
    component.selectedRepoName.set('repoX');

    submit.responseTaskId = 'task-789';
    submit.responseMonitorUrl = 'https://app.globus.org/activity/task-789';

    component.download();
    tick();

    expect(notification.successes.pop()).toContain('Globus task ID: task-789');
    expect(component.lastTransferTaskId()).toBe('task-789');
    expect(component.globusMonitorUrl()).toBe(
      'https://app.globus.org/activity/task-789',
    );
    expect(component.downloadRequested()).toBeFalse();
    expect(component.downloadInProgress()).toBeFalse();
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
    component.rowNodeMap().set('1:file', { data: df });
    component.option.set('branchX');
    component.selectedRepoName.set('repoX');

    submit.succeed = false;
    component.download();
    tick();

    expect(
      notification.errors.some((e) => e.includes('Download request failed')),
    ).toBeTrue();
    expect(component.statusPollingActive()).toBeFalse();
    expect(component.lastTransferTaskId()).toBeUndefined();
  }));

  it('onStatusPollingChange toggles polling state flag', () => {
    initComponent();
    component.onStatusPollingChange(true);
    expect(component.statusPollingActive()).toBeTrue();
    component.onStatusPollingChange(false);
    expect(component.statusPollingActive()).toBeFalse();
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
    comp.selectedRepoName.set('repoA');
    repoLookup.options = [
      { label: 'folder-a', value: 'folder-a' },
      { label: 'folder-b', value: 'folder-b' },
    ];

    comp.getOptions();
    tick();

    expect(comp.branchItems().length).toBe(2);
    expect(comp.branchItems()[0].label).toBe('folder-a');
  }));

  it('helper accessors mirror globus plugin configuration', () => {
    const comp = initComponent();
    comp.globusPlugin.set({
      repoNameFieldEditable: true,
      repoNameFieldPlaceholder: 'type repo',
      repoNameFieldHasInit: false,
      optionFieldName: 'Storage Option',
      repoNameFieldName: 'Endpoint',
    } as any);

    expect(comp.repoNameFieldEditable()).toBeTrue();
    expect(comp.repoNamePlaceholder()).toBe('type repo');
    expect(comp.repoNameSearchInitEnabled()).toBeFalse();
    expect(comp.optionFieldName()).toBe('Storage Option');
    expect(comp.repoNameFieldName()).toBe('Endpoint');
  });

  it('repoName prefers selected value but falls back to found name', () => {
    const comp = initComponent();
    comp.foundRepoName.set('found-repo');
    expect(comp.repoName()).toBe('found-repo');
    comp.selectedRepoName.set('chosen-repo');
    expect(comp.repoName()).toBe('chosen-repo');
  });

  it('getRepoLookupRequest uses fallback repo name when selection missing', () => {
    const comp = initComponent();
    comp.foundRepoName.set('fallback-repo');
    const req = comp.getRepoLookupRequest(true);
    expect(req?.repoName).toBe('fallback-repo');
  });

  it('getRepoToken honours absolute token getter URL', () => {
    const comp = initComponent();
    const openSpy = spyOn(window, 'open');
    comp.globusPlugin.set({
      sourceUrlFieldValue: 'https://api.example',
      tokenGetter: {
        URL: 'https://oauth.example/authorize',
        oauth_client_id: '',
      },
    } as any);

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
    // Empty string is now valid (root folder selection)
    component.optionSelected({ data: '' } as TreeNode<string>);
    expect(component.option()).toBe('');
    expect(component.selectedOption()?.data).toBe('');

    const node: TreeNode<string> = { data: '/path', label: 'Path' };
    component.optionSelected(node);
    expect(component.option()).toBe('/path');
    expect(component.selectedOption()).toBe(node);
  });

  it('onRepoChange clears branch options and selection', () => {
    initComponent();
    component.branchItems.set([{ label: 'opt', value: 'opt' }]);
    component.option.set('opt');
    component.onRepoChange();
    expect(component.branchItems().length).toBe(0);
    expect(component.option()).toBeUndefined();
  });

  it('getDoiOptions skips reload when options already present', () => {
    initComponent();
    component.doiItems.set([{ label: 'existing', value: 'doi:existing' }]);
    component.datasetId.set('doi:existing');
    dvLookup.items = [{ label: 'other', value: 'doi:other' }];
    component.getDoiOptions();
    expect(component.doiItems()[0].value).toBe('doi:existing');
  });

  it('onUserChange resets selections', () => {
    initComponent();
    component.dataverseToken.set('dvTok');
    component.doiItems.set([{ label: 'a', value: 'a' }]);
    component.datasetId.set('a');
    component.onUserChange();
    expect(component.doiItems().length).toBe(0);
    expect(component.datasetId()).toBeUndefined();
  });

  it('getRepoToken builds redirect including dataset state when available', () => {
    initComponent();
    component.globusPlugin.set(plugin.getGlobusPlugin());
    component.datasetId.set('doi:ABC');
    component.dataverseToken.set('tok');
    component.getRepoToken();
    expect(navigation.assign).toHaveBeenCalled();
    const redirectUrl = navigation.assign.calls.mostRecent().args[0] as string;
    const match = redirectUrl.match(/state=([^&]+)/);
    expect(match).toBeTruthy();
    const state = JSON.parse(decodeURIComponent(match![1]));
    expect(state.datasetId.value).toBe('doi:ABC');
  });

  it('getRepoToken omits dataset when placeholder selected', () => {
    initComponent();
    component.globusPlugin.set(plugin.getGlobusPlugin());
    component.datasetId.set('?');
    component.getRepoToken();
    expect(navigation.assign).toHaveBeenCalled();
    const redirectUrl = navigation.assign.calls.mostRecent().args[0] as string;
    const match = redirectUrl.match(/state=([^&]+)/);
    expect(match).toBeTruthy();
    const state = JSON.parse(decodeURIComponent(match![1]));
    expect(state.datasetId).toBeUndefined();
  });

  it('getRepoToken strips session_required_single_domain for guest users', () => {
    initComponent();
    component.globusPlugin.set({
      ...plugin.getGlobusPlugin(),
      tokenGetter: {
        URL: 'https://auth.globus.org/authorize?scope=openid&session_required_single_domain=kuleuven.be',
        oauth_client_id: 'client-id',
      },
    } as any);
    component.showGuestLoginPopup.set(true); // user is not logged in
    component.datasetId.set('doi:GUEST');
    component.getRepoToken();
    expect(navigation.assign).toHaveBeenCalled();
    const redirectUrl = navigation.assign.calls.mostRecent().args[0] as string;
    expect(redirectUrl).not.toContain('session_required_single_domain');
    expect(redirectUrl).toContain('scope=openid');
  });

  it('getRepoToken keeps session_required_single_domain for logged-in users', () => {
    initComponent();
    component.globusPlugin.set({
      ...plugin.getGlobusPlugin(),
      tokenGetter: {
        URL: 'https://auth.globus.org/authorize?scope=openid&session_required_single_domain=kuleuven.be',
        oauth_client_id: 'client-id',
      },
    } as any);
    component.showGuestLoginPopup.set(false); // user is logged in
    component.accessMode.set('login'); // logged-in users have 'login' mode
    component.datasetId.set('doi:LOGGED');
    component.getRepoToken();
    expect(navigation.assign).toHaveBeenCalled();
    const redirectUrl = navigation.assign.calls.mostRecent().args[0] as string;
    expect(redirectUrl).toContain('session_required_single_domain=kuleuven.be');
  });

  it('optionSelected allows empty string for root folder', () => {
    initComponent();
    component.optionSelected({
      data: 'folder',
      selectable: true,
    } as TreeNode<string>);
    expect(component.option()).toBe('folder');
    // Empty string is now a valid selection (root folder)
    component.optionSelected({
      data: '',
      selectable: true,
    } as TreeNode<string>);
    expect(component.option()).toBe('');
    expect(component.selectedOption()?.data).toBe('');
  });

  it('optionSelected clears selection when node data is undefined', () => {
    initComponent();
    component.optionSelected({
      data: 'folder',
      selectable: true,
    } as TreeNode<string>);
    expect(component.option()).toBe('folder');
    // undefined should clear the selection
    component.optionSelected({
      data: undefined,
      selectable: true,
    } as TreeNode<string>);
    expect(component.option()).toBeUndefined();
    expect(component.selectedOption()).toBeUndefined();
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
    component.rowNodeMap().set('1', { data: df });
    component.downloadRequested.set(false);
    component.option.set(undefined);
    expect(component.downloadDisabled()).toBeTrue();
    component.option.set('folder');
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
    component.datasetId.set('doi:test');
    component.onDatasetChange();
    tick();
    expect(component.loading()).toBeFalse();
    expect(component.rootNodeChildren().length).toBe(2);
    expect(component.rootNodeChildren()[0].data?.id).toBe('a');
  }));

  it('onDatasetChange surfaces errors from service', fakeAsync(() => {
    initComponent();
    dataService.error = 'service-down';
    component.datasetId.set('doi:test');
    component.accessMode.set('login');
    component.onDatasetChange();
    tick();
    flush();
    expect(
      notification.errors.some((msg) =>
        msg.includes('Getting downloadable files failed'),
      ),
    ).toBeTrue();
  }));

  it('ngOnInit processes globus callback state and fetches token', fakeAsync(() => {
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
    expect(component.token()).toBe('session-xyz');
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
    dataService.userLoggedIn = true;
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

    expect(component.datasetId()).toBe('doi:XYZ');
    expect(tokenSpy).toHaveBeenCalled();
  }));

  it('repoName search subscription surfaces errors from service', fakeAsync(() => {
    const comp = initComponent();
    tick();
    flushMicrotasks();
    comp.globusPlugin.set({
      repoNameFieldName: 'Endpoint',
      repoNameFieldHasInit: true,
      sourceUrlFieldValue: 'https://globus.example',
    } as any);
    spyOn(repoLookup, 'search').and.returnValue(
      throwError(() => new Error('network down')),
    );

    comp.onRepoNameSearch('abc');
    tick(comp.DEBOUNCE_TIME + 1);
    flushMicrotasks();
    flush();
    flushMicrotasks();

    expect(comp.repoNames()[0].label).toContain('search failed');
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

    expect(comp.doiItems()[0].label).toContain('search failed');
  }));

  describe('showDVToken', () => {
    it('should return true when pluginService.showDVToken returns true', () => {
      plugin.showDvToken = true;
      const comp = initComponent();
      expect(comp.showDVToken()).toBeTrue();
    });

    it('should return false when pluginService.showDVToken returns false', () => {
      plugin.showDvToken = false;
      const comp = initComponent();
      expect(comp.showDVToken()).toBeFalse();
    });
  });

  describe('redirectToLogin', () => {
    it('should call pluginService.redirectToLogin', () => {
      const comp = initComponent();
      // Mock redirectToLogin on pluginService via spyOn
      (plugin as any).redirectToLogin = jasmine.createSpy('redirectToLogin');
      comp.redirectToLogin();
      expect((plugin as any).redirectToLogin).toHaveBeenCalled();
    });
  });

  describe('continueAsGuest', () => {
    it('should set accessMode to guest and close popup', fakeAsync(() => {
      const comp = initComponent();
      tick();
      comp.showGuestLoginPopup.set(true);
      comp.accessDeniedForGuest.set(true);
      comp.loading.set(false);
      spyOn(comp, 'getRepoToken');

      comp.continueAsGuest();

      expect(comp.accessDeniedForGuest()).toBeFalse();
      expect(comp.accessMode()).toBe('guest');
      expect(comp.showGuestLoginPopup()).toBeFalse();
      expect(comp.getRepoToken).toHaveBeenCalled();
    }));

    it('should wait for loading before proceeding', fakeAsync(() => {
      const comp = initComponent();
      tick();
      comp.showGuestLoginPopup.set(true);
      comp.loading.set(true);
      spyOn(comp, 'getRepoToken');

      comp.continueAsGuest();

      // Should not be called yet while loading
      expect(comp.getRepoToken).not.toHaveBeenCalled();

      // Simulate loading complete
      comp.loading.set(false);
      tick(200);

      expect(comp.accessMode()).toBe('guest');
      expect(comp.getRepoToken).toHaveBeenCalled();
    }));
  });

  describe('continueWithLogin', () => {
    it('should close popup and call redirectToLogin', () => {
      const comp = initComponent();
      comp.showGuestLoginPopup.set(true);
      spyOn(comp, 'redirectToLogin');

      comp.continueWithLogin();

      expect(comp.showGuestLoginPopup()).toBeFalse();
      expect(comp.redirectToLogin).toHaveBeenCalled();
    });
  });

  describe('action', () => {
    it('should return action icon from root node', () => {
      const comp = initComponent();
      const root: TreeNode<Datafile> = {
        data: {
          id: '',
          name: '',
          path: '',
          hidden: false,
          action: Fileaction.Download,
        },
        children: [],
      };
      comp.rowNodeMap().set('', root);

      const result = comp.action();

      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });

    it('should return ignore icon when no root node', () => {
      const comp = initComponent();
      comp.rowNodeMap().clear();

      const result = comp.action();

      expect(result).toBeDefined();
    });
  });

  describe('goToDataset', () => {
    it('should open dataset URL in new window when url exists', () => {
      const comp = initComponent();
      comp.datasetUrl.set('https://example.com/dataset');
      const windowSpy = spyOn(window, 'open');

      comp.goToDataset();

      expect(windowSpy).toHaveBeenCalledWith(
        'https://example.com/dataset',
        '_blank',
      );
    });

    it('should not open window when no dataset URL', () => {
      const comp = initComponent();
      comp.datasetUrl.set('');
      const windowSpy = spyOn(window, 'open');

      comp.goToDataset();

      expect(windowSpy).not.toHaveBeenCalled();
    });
  });

  describe('buildGlobusMonitorUrl', () => {
    it('should build monitor URL from task ID', () => {
      const comp = initComponent();
      const result = (comp as any).buildGlobusMonitorUrl('task-123');

      expect(result).toBe('https://app.globus.org/activity/task-123');
    });

    it('should return empty string for empty task ID', () => {
      const comp = initComponent();
      const result = (comp as any).buildGlobusMonitorUrl('');

      expect(result).toBe('');
    });

    it('should encode special characters in task ID', () => {
      const comp = initComponent();
      const result = (comp as any).buildGlobusMonitorUrl('task/with spaces');

      expect(result).toContain('task%2Fwith%20spaces');
    });
  });

  describe('startRepoSearch', () => {
    it('should not trigger search when foundRepoName is set', () => {
      const comp = initComponent();
      comp.foundRepoName.set('existing-repo');
      const subjectSpy = spyOn(comp.repoSearchSubject, 'next');

      comp.startRepoSearch();

      expect(subjectSpy).not.toHaveBeenCalled();
    });

    it('should set loading message when repoNameSearchInitEnabled', () => {
      const comp = initComponent();
      comp.foundRepoName.set(undefined);
      comp.globusPlugin.set({
        ...plugin.getGlobusPlugin(),
        repoNameFieldHasInit: true,
      } as any);
      spyOn(comp.repoSearchSubject, 'next');

      comp.startRepoSearch();

      expect(comp.repoNames()[0].label).toBe('loading...');
    });

    it('should set typing prompt when repoNameSearchInitEnabled is false', () => {
      const comp = initComponent();
      comp.foundRepoName.set(undefined);
      comp.globusPlugin.set({
        ...plugin.getGlobusPlugin(),
        repoNameFieldHasInit: false,
      } as any);

      comp.startRepoSearch();

      expect(comp.repoNames()[0].label).toContain('start typing');
    });
  });

  describe('extractPreSelectedFileIds', () => {
    it('should extract file IDs from files object', () => {
      const comp = initComponent();
      const files = { '123': 'file1.txt', '456': 'file2.txt' };

      (comp as any).extractPreSelectedFileIds(files);

      expect(comp.preSelectedFileIds().has('123')).toBeTrue();
      expect(comp.preSelectedFileIds().has('456')).toBeTrue();
    });

    it('should handle undefined files', () => {
      const comp = initComponent();
      comp.preSelectedFileIds.set(new Set());

      (comp as any).extractPreSelectedFileIds(undefined);

      expect(comp.preSelectedFileIds().size).toBe(0);
    });

    it('should handle empty files object', () => {
      const comp = initComponent();
      comp.preSelectedFileIds.set(new Set());

      (comp as any).extractPreSelectedFileIds({});

      expect(comp.preSelectedFileIds().size).toBe(0);
    });
  });

  describe('applyPreSelection', () => {
    it('should set Download action for pre-selected file IDs', () => {
      const comp = initComponent();
      comp.preSelectedFileIds.set(new Set(['123']));

      const fileNode: TreeNode<Datafile> = {
        data: {
          id: '123',
          name: 'test.txt',
          path: '/test.txt',
          hidden: false,
          action: Fileaction.Ignore,
          attributes: {
            destinationFile: { id: 123 } as any,
          } as any,
        } as Datafile,
        children: [],
      };

      const rootNode: TreeNode<Datafile> = {
        data: {
          id: '',
          name: '',
          path: '',
          hidden: false,
          action: Fileaction.Ignore,
        } as Datafile,
        children: [fileNode],
      };

      const rowDataMap = new Map<string, TreeNode<Datafile>>();
      rowDataMap.set('', rootNode);
      rowDataMap.set('123', fileNode);

      (comp as any).applyPreSelection(rowDataMap);

      expect(fileNode.data!.action).toBe(Fileaction.Download);
    });

    it('should not modify files not in pre-selected set', () => {
      const comp = initComponent();
      comp.preSelectedFileIds.set(new Set(['999']));

      const fileNode: TreeNode<Datafile> = {
        data: {
          id: '123',
          name: 'test.txt',
          path: '/test.txt',
          hidden: false,
          action: Fileaction.Ignore,
          attributes: {
            destinationFile: { id: 123 } as any,
          } as any,
        } as Datafile,
        children: [],
      };

      const rowDataMap = new Map<string, TreeNode<Datafile>>();
      rowDataMap.set('123', fileNode);

      (comp as any).applyPreSelection(rowDataMap);

      expect(fileNode.data!.action).toBe(Fileaction.Ignore);
    });
  });

  describe('extractFromPreviewUrl', () => {
    it('should extract UUID token directly', () => {
      const comp = initComponent();
      const result = comp.extractFromPreviewUrl(
        '12345678-1234-1234-1234-123456789012',
      );

      expect(result.token).toBe('12345678-1234-1234-1234-123456789012');
      expect(result.datasetDbId).toBeNull();
    });

    it('should extract token from preview URL', () => {
      const comp = initComponent();
      const result = comp.extractFromPreviewUrl(
        'https://example.com/previewurl.xhtml?token=12345678-1234-1234-1234-123456789012',
      );

      expect(result.token).toBe('12345678-1234-1234-1234-123456789012');
    });

    it('should extract token and datasetDbId from API URL', () => {
      const comp = initComponent();
      const result = comp.extractFromPreviewUrl(
        'https://example.com/api/v1/datasets/999/globusDownloadParameters?downloadId=abc&token=12345678-1234-1234-1234-123456789012',
      );

      expect(result.token).toBe('12345678-1234-1234-1234-123456789012');
      expect(result.datasetDbId).toBe('999');
    });

    it('should return nulls for empty input', () => {
      const comp = initComponent();
      const result = comp.extractFromPreviewUrl('');

      expect(result.token).toBeNull();
      expect(result.datasetDbId).toBeNull();
    });

    it('should handle malformed URL with regex fallback', () => {
      const comp = initComponent();
      const result = comp.extractFromPreviewUrl(
        'not-a-url token=12345678-1234-1234-1234-123456789012 /datasets/456',
      );

      expect(result.token).toBe('12345678-1234-1234-1234-123456789012');
      expect(result.datasetDbId).toBe('456');
    });
  });

  describe('continueWithPreviewUrl', () => {
    it('should not proceed when token cannot be extracted', () => {
      const comp = initComponent();
      comp.previewUrlInput.set('invalid-input');
      spyOn(comp, 'getRepoToken');

      comp.continueWithPreviewUrl();

      expect(comp.getRepoToken).not.toHaveBeenCalled();
    });

    it('should set token and accessMode from valid preview URL', fakeAsync(() => {
      const comp = initComponent();
      tick();
      comp.previewUrlInput.set('12345678-1234-1234-1234-123456789012');
      comp.downloadId.set(undefined);
      comp.datasetDbId.set(undefined);
      spyOn(comp, 'getRepoToken');

      comp.continueWithPreviewUrl();

      expect(comp.dataverseToken()).toBe(
        '12345678-1234-1234-1234-123456789012',
      );
      expect(comp.accessMode()).toBe('preview');
      expect(comp.showGuestLoginPopup()).toBeFalse();
      expect(comp.getRepoToken).toHaveBeenCalled();
    }));
  });
});
