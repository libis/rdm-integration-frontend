import {
  provideHttpClient,
  withInterceptorsFromDi,
  withXhr,
} from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import {
  CdkVirtualScrollViewport,
  ScrollDispatcher,
} from '@angular/cdk/scrolling';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import {
  ActivatedRoute,
  provideRouter,
  withDisabledInitialNavigation,
} from '@angular/router';
import { TreeNode } from '../models/tree-node';
import { SelectItem } from '../models/select-item';
import { BehaviorSubject, Observable, Subject, of, throwError } from 'rxjs';
import { DataService } from '../data.service';
import { DvObjectLookupService } from '../dvobject.lookup.service';
import { CompareResult } from '../models/compare-result';
import { Datafile, Fileaction } from '../models/datafile';
import { HierarchicalSelectItem } from '../models/hierarchical-select-item';
import { PluginService } from '../plugin.service';
import { RepoLookupService } from '../repo.lookup.service';
import { NavigationService } from '../shared/navigation.service';
import { APP_CONSTANTS } from '../shared/constants';
import { updateExpandedNodeChildren } from '../shared/folder-picker';
import { NotificationService } from '../shared/notification.service';
import {
  measurePage,
  resizeTestWindow,
  scrolledContainers,
} from '../../testing/page-layout';
import { settlePromises } from '../../testing/promises';
import { answerLater } from '../../testing/answer-later';
import {
  openSelect,
  pickSelectOption,
  selectPanelLabels,
  typeInSelectFilter,
} from '../../testing/select';
import { treegridStructure } from '../../testing/treegrid';
import { registerReauthAttempt } from '../shared/reauth';
import { SubmitService } from '../submit.service';
import { UtilsService } from '../utils.service';
import { DownloadComponent } from './download.component';

class MockNotificationService {
  errors: string[] = [];
  successes: string[] = [];
  warnings: string[] = [];
  infos: string[] = [];
  showError(msg: string) {
    this.errors.push(msg);
  }
  showSuccess(msg: string) {
    this.successes.push(msg);
  }
  showWarning(msg: string) {
    this.warnings.push(msg);
  }
  showInfo(msg: string) {
    this.infos.push(msg);
  }
}

class MockRepoLookupService {
  options: HierarchicalSelectItem<string>[] = [];
  search(_req?: unknown): Observable<SelectItem<string>[]> {
    return of<SelectItem<string>[]>([]);
  }
  getOptions(_req?: unknown): Observable<SelectItem<string>[]> {
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
  errorPayload: unknown = { error: 'failX' };

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
          obs.error(this.errorPayload);
        }
      }, 0);
    });
  }

  // A running Globus task, as the transfer card polls it.
  getGlobusTransferStatus(taskId: string) {
    return of({
      task_id: taskId,
      status: 'ACTIVE',
      files: 300,
      files_transferred: 120,
      request_time: '2026-10-24 10:00:00+00:00',
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
  globusParamsError?: unknown;
  globusParamsResponse: any = { data: { queryParameters: {} } };

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

  getGlobusDownloadParams() {
    if (this.globusParamsError) {
      return throwError(() => this.globusParamsError);
    }
    return of(this.globusParamsResponse);
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

  buildFileTree = UtilsService.prototype.buildFileTree;
}

class MockPluginService {
  private readonly _showDvToken = signal(false);
  private readonly _storeDvToken = signal(false);
  oauthClientId = 'client-id';

  // Signals for computed signal consumers
  readonly showDVToken$ = this._showDvToken.asReadonly();
  readonly configLoaded$ = signal(true).asReadonly();
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
  let fixture: ComponentFixture<DownloadComponent>;

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
    // Reauth attempt counters and pending demands live in sessionStorage and
    // would leak between specs otherwise.
    sessionStorage.clear();
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
        provideRouter([], withDisabledInitialNavigation()),
        provideHttpClient(withXhr(), withInterceptorsFromDi()),
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
    }).compileComponents();

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
    fixture = fixtureInstance;
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

  it('getRepoLookupRequest does not short-circuit when branchItems already loaded', () => {
    initComponent();
    component.selectedRepoName.set('repoA');
    component.branchItems.set([{ label: 'existing', value: 'v' }]);
    const req = component.getRepoLookupRequest(false);
    expect(req).toBeDefined();
  });

  it('getRepoLookupRequest builds request when conditions satisfied', () => {
    initComponent();
    component.selectedRepoName.set('repoA');
    const req = component.getRepoLookupRequest(false);
    expect(req).toBeDefined();
  });

  it('getRepoLookupRequest ignores placeholder repo values without toast', () => {
    initComponent();
    component.foundRepoName.set('start');

    const req = component.getRepoLookupRequest(false);

    expect(req).toBeUndefined();
    expect(notification.errors.length).toBe(0);
  });

  it('getRepoLookupRequest ignores placeholder repo values even when label config is absent', () => {
    initComponent();
    component.globusPlugin.set({
      sourceUrlFieldValue: 'https://x',
      repoNameFieldName: '',
    } as any);
    component.foundRepoName.set('loading');

    const req = component.getRepoLookupRequest(false);

    expect(req).toBeUndefined();
    expect(notification.errors.length).toBe(0);
  });

  it('getOptions populates node children for nested request', async () => {
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
    await new Promise<void>((r) => setTimeout(r));
    expect(parent.children?.length).toBe(2);
    expect(component.optionsLoading()).toBeFalse();
  });

  it('getOptions nested request should update rootOptions reference for zoneless refresh', async () => {
    initComponent();
    component.selectedRepoName.set('repoA');
    repoLookup.options = [{ label: 'folderA', value: '/folderA/' }];

    const before = component.rootOptions();
    const parent = before[0];

    component.getOptions(parent);
    await new Promise<void>((r) => setTimeout(r));

    const after = component.rootOptions();
    expect(after[0]?.children?.length).toBe(1);
    expect(after).not.toBe(before);
  });

  it('getOptions should update stored tree when expanded node is detached instance (zoneless repro)', async () => {
    initComponent();
    component.selectedRepoName.set('repoA');
    repoLookup.options = [
      {
        label: 'ghum',
        value: '/ghum/',
        expanded: true,
        children: [
          {
            label: 'home',
            value: '/ghum/home/',
            expanded: true,
            children: [
              {
                label: 'u0050020',
                value: '/ghum/home/u0050020/',
                selected: true,
                expanded: true,
                children: [
                  {
                    label: 'Reports_PROD',
                    value: '/ghum/home/u0050020/Reports_PROD/',
                  },
                  { label: 'corpora', value: '/ghum/home/u0050020/corpora/' },
                  {
                    label: 'dataset_1',
                    value: '/ghum/home/u0050020/dataset_1/',
                  },
                  { label: 'github', value: '/ghum/home/u0050020/github/' },
                  { label: 'image', value: '/ghum/home/u0050020/image/' },
                  { label: 'vscode', value: '/ghum/home/u0050020/vscode/' },
                  {
                    label: 'workflows',
                    value: '/ghum/home/u0050020/workflows/',
                  },
                ],
              },
            ],
          },
        ],
      },
    ] as any;

    // The expanded node is a copy, not the node stored in component state:
    // the listing still goes into the stored tree.
    const detachedExpandedNode: TreeNode<string> = {
      label: 'Expand and select',
      data: '',
      selectable: true,
      expanded: true,
    };

    component.getOptions(detachedExpandedNode);
    await new Promise<void>((r) => setTimeout(r));

    // Expected: stored tree should include returned folders immediately.
    const storedRoot = component.rootOptions()[0];
    expect(storedRoot.children?.[0]?.label).toBe('ghum');
  });

  it('getOptions handles error path', async () => {
    initComponent();
    component.selectedRepoName.set('repoA');
    // force error
    spyOn(repoLookup, 'getOptions').and.returnValue(
      new Observable((obs) => {
        queueMicrotask(() => obs.error({ error: 'BOOM' }));
      }),
    );
    component.getOptions();
    await new Promise<void>((r) => setTimeout(r));
    expect(
      notification.errors.some((e) => e.includes('Branch lookup failed')),
    ).toBeTrue();
    expect(component.branchItems().length).toBe(0);
    expect(component.option()).toBeUndefined();
  });

  it('getOptions triggers reauth instead of raw error on structured 401 (scope consent)', async () => {
    initComponent();
    component.selectedRepoName.set('repoA');
    const reauthErr = {
      status: 401,
      error: {
        reauth: {
          required_scopes: [
            'urn:globus:auth:scope:transfer.api.globus.org:all[*https://auth.globus.org/scopes/82c495cc/data_access]',
          ],
        },
      },
    };
    spyOn(repoLookup, 'getOptions').and.returnValue(
      new Observable((obs) => {
        queueMicrotask(() => obs.error(reauthErr));
      }),
    );
    spyOn(component, 'getRepoToken');
    spyOn(notification, 'showError');

    component.getOptions();
    await new Promise<void>((r) => setTimeout(r));

    expect(component.getRepoToken).toHaveBeenCalledWith({
      scopes: [
        'urn:globus:auth:scope:transfer.api.globus.org:all[*https://auth.globus.org/scopes/82c495cc/data_access]',
      ],
    });
    // The raw "Branch lookup failed" notification must NOT have fired.
    expect(notification.showError).not.toHaveBeenCalled();
  });

  it('download surfaces error and stops polling setup', async () => {
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
    await new Promise<void>((r) => setTimeout(r));

    expect(
      notification.errors.some((e) => e.includes('Download request failed')),
    ).toBeTrue();
    expect(component.statusPollingActive()).toBeFalse();
    expect(component.lastTransferTaskId()).toBeUndefined();
  });

  it('download success stores monitoring info', async () => {
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
    await new Promise<void>((r) => setTimeout(r));

    expect(notification.successes.pop()).toContain('Globus task ID: task-789');
    expect(component.lastTransferTaskId()).toBe('task-789');
    expect(component.globusMonitorUrl()).toBe(
      'https://app.globus.org/activity/task-789',
    );
    expect(component.downloadRequested()).toBeFalse();
    expect(component.downloadInProgress()).toBeFalse();
  });

  it('download surfaces error notification', async () => {
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
    await new Promise<void>((r) => setTimeout(r));

    expect(
      notification.errors.some((e) => e.includes('Download request failed')),
    ).toBeTrue();
    expect(component.statusPollingActive()).toBeFalse();
    expect(component.lastTransferTaskId()).toBeUndefined();
  });

  it('download() shows a terminal error instead of redirecting when the same demand keeps repeating', async () => {
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

    const reauthErr = {
      status: 401,
      error: { reauth: { required_domains: ['gent.be'] } },
    };
    spyOn(submit, 'download').and.returnValue(throwError(() => reauthErr));
    spyOn(component, 'getRepoToken');
    spyOn(notification, 'showError');
    // Two round-trips for this demand already happened.
    registerReauthAttempt({ domains: ['gent.be'] });
    registerReauthAttempt({ domains: ['gent.be'] });

    component.download();
    await new Promise<void>((r) => setTimeout(r));

    expect(component.getRepoToken).not.toHaveBeenCalled();
    expect(notification.showError).toHaveBeenCalled();
  });

  it('download() triggers reauth on structured 401 with domains', async () => {
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

    const reauthErr = {
      status: 401,
      error: { reauth: { required_domains: ['sydney.edu.au'] } },
    };
    spyOn(submit, 'download').and.returnValue(throwError(() => reauthErr));
    spyOn(component, 'getRepoToken');
    spyOn(notification, 'showError');

    component.download();
    await new Promise<void>((r) => setTimeout(r));

    expect(component.getRepoToken).toHaveBeenCalledWith({
      domains: ['sydney.edu.au'],
    });
    // The raw "Download request failed" notification must NOT have fired.
    expect(notification.showError).not.toHaveBeenCalled();
  });

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

  it('getOptions populates branchItems when called without node', async () => {
    const comp = initComponent();
    comp.selectedRepoName.set('repoA');
    repoLookup.options = [
      { label: 'folder-a', value: 'folder-a' },
      { label: 'folder-b', value: 'folder-b' },
    ];

    comp.getOptions();
    await new Promise<void>((r) => setTimeout(r));

    expect(comp.branchItems().length).toBe(2);
    expect(comp.branchItems()[0].label).toBe('folder-a');
  });

  it('replaces the placeholder with the collection root and keeps the selected home', async () => {
    const comp = initComponent();
    comp.selectedRepoName.set('repoA');
    repoLookup.options = [
      {
        label: '/',
        value: '/',
        expanded: true,
        children: [
          {
            label: 'Users',
            value: '/Users/',
            expanded: true,
            children: [
              {
                label: 'alice',
                value: '/Users/alice/',
                selected: true,
                expanded: true,
              },
            ],
          },
        ],
      },
    ];

    comp.getOptions({ label: 'Expand and select', data: '', expanded: true });
    await new Promise<void>((r) => setTimeout(r));

    expect(comp.rootOptions().length).toBe(1);
    expect(comp.rootOptions()[0].data).toBe('/');
    expect(comp.rootOptions()[0].children?.[0].data).toBe('/Users/');
    expect(comp.option()).toBe('/Users/alice/');
    comp.optionSelected(comp.rootOptions()[0]);
    expect(comp.option()).toBe('/');

    const lookup = spyOn(repoLookup, 'getOptions').and.callThrough();
    repoLookup.options = [
      { label: 'Users', value: '/Users/' },
      { label: 'Volumes', value: '/Volumes/' },
    ];
    comp.getOptions(comp.rootOptions()[0]);
    await new Promise<void>((r) => setTimeout(r));
    expect(lookup).toHaveBeenCalledWith(
      jasmine.objectContaining({ option: '/' }),
    );
    expect(comp.rootOptions().length).toBe(1);
    expect(comp.rootOptions()[0].data).toBe('/');
    expect(comp.rootOptions()[0].children?.map((n) => n.data)).toEqual([
      '/Users/',
      '/Volumes/',
    ]);
    expect(comp.option()).toBe('/');
  });

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
    // The field edited to a new token, as its input events do.
    component.onTokenInput('dvTok');
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
    const assigned = navigation.assign.calls.mostRecent().args[0] as string;
    const params = new URL(assigned).searchParams;
    expect(params.get('session_required_single_domain')).toBeNull();
    expect(params.get('scope')).toBe('openid');
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
    // With a dataset selected, the option and the actions decide.
    component.datasetId.set('doi:10.1/D');
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

  it('downloadDisabled recomputes after in-place row action mutation when refresh is triggered', () => {
    initComponent();
    // With a dataset selected, the option and the actions decide.
    component.datasetId.set('doi:10.1/D');
    const df: Datafile = {
      id: '1',
      name: 'f',
      path: '',
      hidden: false,
      action: Fileaction.Ignore,
    } as any;
    component.rowNodeMap().set('1', { data: df });
    component.option.set('folder');
    expect(component.downloadDisabled()).toBeTrue();

    // Simulate child mutation without replacing row/map references.
    df.action = Fileaction.Download;
    component.onRowActionChanged();

    expect(component.downloadDisabled()).toBeFalse();
  });

  it('onDatasetChange populates tree on success', async () => {
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
    await new Promise<void>((r) => setTimeout(r));
    expect(component.loading()).toBeFalse();
    expect(component.rootNodeChildren().length).toBe(2);
    expect(component.rootNodeChildren()[0].data?.id).toBe('a');
  });

  it('onDatasetChange applies preSelectedIds from response', async () => {
    initComponent();
    const payload: CompareResult = {
      data: [
        {
          id: 'file1.txt',
          name: 'file1.txt',
          path: '',
          hidden: false,
          action: Fileaction.Ignore,
          attributes: {
            isFile: true,
            destinationFile: { id: 42 },
          },
        } as Datafile,
        {
          id: 'data/file2.csv',
          name: 'file2.csv',
          path: 'data',
          hidden: false,
          action: Fileaction.Ignore,
          attributes: {
            isFile: true,
            destinationFile: { id: 99 },
          },
        } as Datafile,
        {
          id: 'file3.dat',
          name: 'file3.dat',
          path: '',
          hidden: false,
          action: Fileaction.Ignore,
          attributes: {
            isFile: true,
            destinationFile: { id: 7 },
          },
        } as Datafile,
      ],
      id: 'root',
      preSelectedIds: [42, 99],
    };
    dataService.response = payload;
    component.datasetId.set('doi:test');
    component.downloadId.set('dl-abc');
    component.onDatasetChange();
    await new Promise<void>((r) => setTimeout(r));
    // File IDs 42 and 99 should be preselected (action=Download)
    const map = component.rowNodeMap();
    const node42 = map.get('file1.txt');
    const node99 = map.get('data/file2.csv');
    const node7 = map.get('file3.dat');
    expect(node42?.data?.action).toBe(Fileaction.Download);
    expect(node99?.data?.action).toBe(Fileaction.Download);
    expect(node7?.data?.action).toBe(Fileaction.Ignore);
  });

  it('onDatasetChange without preSelectedIds leaves all files as-is', async () => {
    initComponent();
    const payload: CompareResult = {
      data: [
        {
          id: 'file1.txt',
          name: 'file1.txt',
          path: '',
          hidden: false,
          action: Fileaction.Ignore,
          attributes: {
            isFile: true,
            destinationFile: { id: 42 },
          },
        } as Datafile,
      ],
      id: 'root',
    };
    dataService.response = payload;
    component.datasetId.set('doi:test');
    component.onDatasetChange();
    await new Promise<void>((r) => setTimeout(r));
    const map = component.rowNodeMap();
    const node = map.get('file1.txt');
    expect(node?.data?.action).toBe(Fileaction.Ignore);
  });

  it('onDatasetChange clears stale preSelected ids when no downloadId is present', async () => {
    initComponent();
    component.preSelectedFileIds.set(new Set(['42']));
    component.downloadId.set(undefined);
    const payload: CompareResult = {
      data: [
        {
          id: 'file1.txt',
          name: 'file1.txt',
          path: '',
          hidden: false,
          action: Fileaction.Ignore,
          attributes: {
            isFile: true,
            destinationFile: { id: 42 },
          },
        } as Datafile,
      ],
      id: 'root',
    };
    dataService.response = payload;
    component.datasetId.set('doi:test');
    component.onDatasetChange();
    await new Promise<void>((r) => setTimeout(r));
    const map = component.rowNodeMap();
    const node = map.get('file1.txt');
    expect(component.preSelectedFileIds().size).toBe(0);
    expect(node?.data?.action).toBe(Fileaction.Ignore);
  });

  it('onDatasetChange clears stale client-side preselection when downloadId is set but server returns no preSelectedIds', async () => {
    initComponent();
    // Simulate client-side preselection from extractPreSelectedFileIds (preview URL flow)
    component.preSelectedFileIds.set(new Set(['42']));
    component.downloadId.set('dl-abc');
    const payload: CompareResult = {
      data: [
        {
          id: 'file1.txt',
          name: 'file1.txt',
          path: '',
          hidden: false,
          action: Fileaction.Ignore,
          attributes: {
            isFile: true,
            destinationFile: { id: 42 },
          },
        } as Datafile,
      ],
      id: 'root',
      // No preSelectedIds — server-side resolution failed
    };
    dataService.response = payload;
    component.datasetId.set('doi:test');
    component.onDatasetChange();
    await new Promise<void>((r) => setTimeout(r));
    // Server is authoritative: stale client-side preselection must be cleared
    expect(component.preSelectedFileIds().size).toBe(0);
    const map = component.rowNodeMap();
    expect(map.get('file1.txt')?.data?.action).toBe(Fileaction.Ignore);
  });

  it('onDatasetChange clears stale preselection when dataset changes even if downloadId remains', async () => {
    initComponent();

    const oldPayload: CompareResult = {
      data: [
        {
          id: 'file-old.txt',
          name: 'file-old.txt',
          path: '',
          hidden: false,
          action: Fileaction.Ignore,
          attributes: {
            isFile: true,
            destinationFile: { id: 42 },
          },
        } as Datafile,
      ],
      id: 'root',
      preSelectedIds: [42],
    };
    component.downloadId.set('dl-abc');
    component.datasetId.set('doi:old');
    dataService.response = oldPayload;
    component.onDatasetChange();
    await new Promise<void>((r) => setTimeout(r));
    let map = component.rowNodeMap();
    expect(map.get('file-old.txt')?.data?.action).toBe(Fileaction.Download);
    expect(component.preSelectedFileIds().size).toBe(1);

    const newPayload: CompareResult = {
      data: [
        {
          id: 'file-new.txt',
          name: 'file-new.txt',
          path: '',
          hidden: false,
          action: Fileaction.Ignore,
          attributes: {
            isFile: true,
            destinationFile: { id: 42 },
          },
        } as Datafile,
      ],
      id: 'root',
    };
    component.datasetId.set('doi:new');
    dataService.response = newPayload;
    component.onDatasetChange();
    await new Promise<void>((r) => setTimeout(r));

    map = component.rowNodeMap();
    expect(component.preSelectedFileIds().size).toBe(0);
    expect(map.get('file-new.txt')?.data?.action).toBe(Fileaction.Ignore);
  });

  it('onDatasetChange surfaces errors from service', async () => {
    initComponent();
    dataService.error = 'service-down';
    component.datasetId.set('doi:test');
    component.accessMode.set('login');
    component.onDatasetChange();
    await new Promise<void>((r) => setTimeout(r));
    await new Promise<void>((r) => setTimeout(r));
    expect(
      notification.errors.some((msg) =>
        msg.includes('Getting downloadable files failed'),
      ),
    ).toBeTrue();
  });

  it('onDatasetChange guards against stale result when datasetId changes before response arrives', async () => {
    initComponent();
    const stalePayload: CompareResult = {
      data: [
        {
          id: 'stale-file',
          name: 'stale-file.txt',
          path: '',
          hidden: false,
          action: Fileaction.Ignore,
        } as Datafile,
      ],
      id: 'stale-root',
    };
    dataService.response = stalePayload;
    component.datasetId.set('doi:first');
    component.onDatasetChange();

    // Switch datasetId BEFORE the async timeout fires (no second onDatasetChange call).
    // The guard in the `next` callback must detect the mismatch and discard.
    component.datasetId.set('doi:second');

    await new Promise<void>((r) => setTimeout(r, 10));

    // Stale result must have been discarded; data stays undefined and loading stays true.
    expect(component.data()).toBeUndefined();
    expect(component.loading()).toBeTrue();
  });

  it('onDatasetChange cancels in-flight request and only applies second response', async () => {
    initComponent();
    const firstPayload: CompareResult = {
      data: [
        {
          id: 'first-file',
          name: 'first-file.txt',
          path: '',
          hidden: false,
          action: Fileaction.Ignore,
        } as Datafile,
      ],
      id: 'first-root',
    };
    const secondPayload: CompareResult = {
      data: [
        {
          id: 'second-file',
          name: 'second-file.txt',
          path: '',
          hidden: false,
          action: Fileaction.Ignore,
        } as Datafile,
      ],
      id: 'second-root',
    };

    // Start first request for doi:first.
    dataService.response = firstPayload;
    component.datasetId.set('doi:first');
    component.onDatasetChange();

    // Switch to doi:second and start a new request before the first completes.
    // onDatasetChange must unsubscribe the first in-flight subscription.
    dataService.response = secondPayload;
    component.datasetId.set('doi:second');
    component.onDatasetChange();

    await new Promise<void>((r) => setTimeout(r, 10));

    // Only the second dataset's result should be applied.
    expect(component.data()?.id).toBe('second-root');
    expect(component.loading()).toBeFalse();
    // First dataset's file must not appear in the tree.
    expect(component.rowNodeMap().has('first-file')).toBeFalse();
  });

  it('ngOnInit processes globus callback state and fetches token', async () => {
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
    await new Promise<void>((r) => setTimeout(r));

    const req = httpMock.expectOne('api/common/oauthtoken');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      pluginId: 'globus',
      code: 'oauth-code',
      nonce: 'nonce-123',
    });
    req.flush({ session_id: 'session-xyz' });
    await new Promise<void>((r) => setTimeout(r));

    expect(datasetSpy).toHaveBeenCalled();
    expect(component.token()).toBe('session-xyz');
  });

  it('ngOnInit skips dataset load when state value is placeholder', async () => {
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
    await new Promise<void>((r) => setTimeout(r));

    const req = httpMock.expectOne('api/common/oauthtoken');
    req.flush({ session_id: 'session-abc' });
    await new Promise<void>((r) => setTimeout(r));

    expect(datasetSpy).not.toHaveBeenCalled();
  });

  it('ngOnInit without oauth code triggers repo token lookup', async () => {
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
    await new Promise<void>((r) => setTimeout(r));

    expect(component.datasetId()).toBe('doi:XYZ');
    expect(tokenSpy).toHaveBeenCalled();
  });

  // The dataset select drives the page with three bindings: (opened) loads
  // the list again when it came back empty at load, (filterChange) searches
  // after the debounce and (valueChange) lists the files of the dataset
  // picked. The search finds a dataset the first list lacks, so the panel
  // shows what each answer holds.
  it('loads, searches and picks a dataset through the select', async () => {
    jasmine.clock().install();
    jasmine.clock().mockDate(new Date(2026, 9, 25));
    try {
      let first: SelectItem<string>[] = [];
      const found = [{ label: 'Dataset C', value: 'doi:10.1/C' }];
      // The mocks declare no parameters; the page passes them.
      const getItems: jasmine.Spy = spyOn(dvLookup, 'getItems').and.callFake(
        (...args: unknown[]) => answerLater(args[2] ? found : first),
      );
      const listing: jasmine.Spy = spyOn(
        dataService,
        'getDownloadableFiles',
      ).and.callThrough();
      initComponent();
      // The async ngOnInit asks for the list, which comes back empty.
      await settlePromises();
      jasmine.clock().tick(0);
      await settlePromises();
      expect(getItems).toHaveBeenCalledTimes(1);
      getItems.calls.reset();
      first = [
        { label: 'Dataset A', value: 'doi:10.1/A' },
        { label: 'Dataset B', value: 'doi:10.1/B' },
      ];

      openSelect(fixture.nativeElement, 'datasetId');
      fixture.detectChanges();
      expect(getItems).toHaveBeenCalledOnceWith(
        '',
        'Dataset',
        undefined,
        undefined,
        true,
      );
      expect(selectPanelLabels()).toEqual(['Loading...']);
      jasmine.clock().tick(0);
      await settlePromises();
      fixture.detectChanges();
      expect(selectPanelLabels()).toEqual(['Dataset A', 'Dataset B']);

      typeInSelectFilter('se');
      fixture.detectChanges();
      expect(selectPanelLabels()).toEqual([
        'start typing to search (at least three letters)',
      ]);
      typeInSelectFilter('set');
      fixture.detectChanges();
      expect(selectPanelLabels()).toEqual(['searching "set"...']);
      jasmine.clock().tick(APP_CONSTANTS.DEBOUNCE_TIME - 1);
      expect(getItems).toHaveBeenCalledTimes(1);
      jasmine.clock().tick(1);
      expect(getItems).toHaveBeenCalledTimes(2);
      expect(getItems.calls.mostRecent().args).toEqual([
        '',
        'Dataset',
        'set',
        undefined,
        true,
      ]);
      jasmine.clock().tick(0);
      await settlePromises();
      fixture.detectChanges();
      expect(selectPanelLabels()).toEqual(['Dataset C']);

      pickSelectOption('Dataset C');
      fixture.detectChanges();
      expect(listing).toHaveBeenCalledOnceWith(
        'doi:10.1/C',
        undefined,
        undefined,
      );
      expect(getItems).toHaveBeenCalledTimes(2);
    } finally {
      jasmine.clock().uninstall();
    }
  });

  // The searches wait DEBOUNCE_TIME after the last term on the mock clock
  // (debounceTime reads Date.now(), hence mockDate), then their promises settle.
  describe('debounced searches', () => {
    beforeEach(() => {
      jasmine.clock().install();
      jasmine.clock().mockDate(new Date(2026, 9, 25));
    });
    afterEach(() => jasmine.clock().uninstall());

    it('repoName search subscription surfaces errors from service', async () => {
      const comp = initComponent();
      // The async ngOnInit subscribes to the searches after its awaits.
      await settlePromises();
      comp.globusPlugin.set({
        repoNameFieldName: 'Endpoint',
        repoNameFieldHasInit: true,
        sourceUrlFieldValue: 'https://globus.example',
      } as any);
      const search = spyOn(repoLookup, 'search').and.returnValue(
        throwError(() => new Error('network down')),
      );

      comp.onRepoNameSearch('abc');
      jasmine.clock().tick(APP_CONSTANTS.DEBOUNCE_TIME - 1);
      expect(search).not.toHaveBeenCalled();
      jasmine.clock().tick(1);
      await settlePromises();

      expect(search).toHaveBeenCalledTimes(1);
      expect(comp.repoNames()[0].label).toContain('search failed');
    });

    it('dataset search subscription handles rejected lookups', async () => {
      const comp = initComponent();
      // The async ngOnInit subscribes to the searches after its awaits.
      await settlePromises();
      // The initial dataset listing of ngOnInit answers on a timer.
      jasmine.clock().tick(0);
      const getItems = spyOn(dvLookup, 'getItems').and.returnValue(
        throwError(() => new Error('lookup-fail')),
      );

      comp.onDatasetSearch('proj');
      jasmine.clock().tick(APP_CONSTANTS.DEBOUNCE_TIME - 1);
      expect(getItems).not.toHaveBeenCalled();
      jasmine.clock().tick(1);
      await settlePromises();

      expect(getItems).toHaveBeenCalledTimes(1);
      expect(comp.doiItems()[0].label).toContain('search failed');
    });
  });

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

  // The token field bound (onChange), which is no DOM event, so editing the
  // token never reset the dataset list nor stored the token.
  describe('dataverse token field', () => {
    const tokenInput = () =>
      fixture.nativeElement.querySelector(
        '#dataverseToken',
      ) as HTMLInputElement;

    // Typing fires input events; leaving the field after an edit fires change.
    const editToken = (value: string) => {
      const input = tokenInput();
      input.value = value;
      input.dispatchEvent(new Event('input'));
      input.dispatchEvent(new Event('change'));
    };

    const selectDataset = (comp: DownloadComponent) => {
      comp.doiItems.set([{ label: 'Dataset', value: 'doi:10.1/D' }]);
      comp.datasetId.set('doi:10.1/D');
    };

    beforeEach(() => {
      localStorage.removeItem('dataverseToken');
      plugin.showDvToken = true;
    });

    afterEach(() => localStorage.removeItem('dataverseToken'));

    // The dataset select of the page, opened with its own button.
    const openDatasetSelect = () =>
      (fixture.nativeElement.querySelector('#datasetId') as HTMLElement)
        .parentElement!.querySelector<HTMLButtonElement>('button')!
        .click();

    // A token edit during a file listing left loading on: "Loading dataset
    // files" stayed and the dataset select loaded nothing, since getDoiOptions
    // waits while loading.
    it('cancels a file listing on a token edit, so the dataset select loads its list again', async () => {
      const listing = new Subject<CompareResult>();
      spyOn(dataService, 'getDownloadableFiles').and.returnValue(listing);
      const getItems: jasmine.Spy = spyOn(dvLookup, 'getItems').and.returnValue(
        of([]),
      );
      const comp = initComponent();
      await settlePromises();
      selectDataset(comp);
      comp.onDatasetChange();
      await fixture.whenStable();
      expect(comp.loading()).toBeTrue();
      expect(listing.observed).toBeTrue();

      editToken('token-1');
      await fixture.whenStable();
      expect(listing.observed).toBeFalse();
      expect(comp.loading()).toBeFalse();
      expect(fixture.nativeElement.textContent).not.toContain(
        'Loading dataset files',
      );

      getItems.calls.reset();
      openDatasetSelect();
      await fixture.whenStable();
      expect(getItems).toHaveBeenCalledOnceWith(
        '',
        'Dataset',
        undefined,
        'token-1',
        true,
      );
    });

    // A dataset with two files, listed, every file marked for download and a
    // destination folder chosen, so Start transfer is enabled.
    const listTwoFiles = async (comp: DownloadComponent) => {
      const file = (id: string) =>
        ({
          id,
          name: id,
          path: '',
          hidden: false,
          action: Fileaction.Ignore,
          attributes: { isFile: true },
        }) as Datafile;
      spyOn(dataService, 'getDownloadableFiles').and.returnValue(
        of({
          id: 'doi:10.1/D',
          url: 'https://example.org/ds',
          data: [file('a.csv'), file('b.csv')],
        }),
      );
      selectDataset(comp);
      comp.onDatasetChange();
      comp.toggleAction();
      comp.option.set('/home/alice/');
      await fixture.whenStable();
    };
    const startTransfer = () =>
      Array.from(
        fixture.nativeElement.querySelectorAll(
          'button',
        ) as NodeListOf<HTMLButtonElement>,
      ).find((b) => b.textContent!.includes('Start transfer'))!;
    const fileRows = () =>
      fixture.nativeElement.querySelectorAll('div[app-downloadablefile]')
        .length;

    // A token edit cleared only the dataset select: the rows of the old
    // dataset stayed, and Start transfer posted them without a persistentId.
    it('clears the rows of the old dataset on a token edit, so Start transfer posts nothing', async () => {
      const post = spyOn(submit, 'download').and.callThrough();
      const comp = initComponent();
      await settlePromises();
      await listTwoFiles(comp);
      expect(fileRows()).toBe(2);
      expect(startTransfer().disabled).toBeFalse();

      editToken('token-1');
      await fixture.whenStable();
      expect(comp.data()).toBeUndefined();
      expect(comp.rootNodeChildren()).toEqual([]);
      expect(comp.rowNodeMap().size).toBe(0);
      expect(fileRows()).toBe(0);
      expect(startTransfer().disabled).toBeTrue();
      startTransfer().click();
      expect(post).not.toHaveBeenCalled();
    });

    it('keeps Start transfer disabled while no dataset is selected', async () => {
      const comp = initComponent();
      await settlePromises();
      await listTwoFiles(comp);
      expect(startTransfer().disabled).toBeFalse();
      comp.datasetId.set(undefined);
      await fixture.whenStable();
      expect(startTransfer().disabled).toBeTrue();
    });

    it('resets the dataset list and the selection on an edit and stores the token only with storeDvToken', async () => {
      const comp = initComponent();
      await fixture.whenStable();

      selectDataset(comp);
      editToken('token-1');
      expect(comp.dataverseToken()).toBe('token-1');
      expect(comp.doiItems()).toEqual([]);
      expect(comp.datasetId()).toBeUndefined();
      expect(localStorage.getItem('dataverseToken')).toBeNull();

      plugin.storeDvToken = true;
      selectDataset(comp);
      editToken('token-2');
      expect(comp.doiItems()).toEqual([]);
      expect(comp.datasetId()).toBeUndefined();
      expect(localStorage.getItem('dataverseToken')).toBe('token-2');
    });

    // Keystrokes that are never committed: input events and no change event,
    // as x typed and taken back with Backspace before Tab.
    const typeWithoutCommit = (...values: string[]) => {
      const input = tokenInput();
      for (const value of values) {
        input.value = value;
        input.dispatchEvent(new Event('input'));
      }
    };

    // The rule compared with the live token, which every keystroke changes:
    // an answer that came during an edit never committed was dropped, and a
    // dropped search left its "searching" item, which no opening replaces.
    it('keeps lookups answered while the token field is edited without a commit', async () => {
      const list = new Subject<SelectItem<string>[]>();
      const search = new Subject<SelectItem<string>[]>();
      const first = [{ label: 'Dataset A', value: 'doi:10.1/A' }];
      const found = [{ label: 'Dataset C', value: 'doi:10.1/C' }];
      const getItems: jasmine.Spy = spyOn(
        dvLookup,
        'getItems',
      ).and.returnValues(
        // The list the async ngOnInit asks for, empty.
        of([]),
        list,
        search,
      );
      initComponent();
      await settlePromises();
      jasmine.clock().install();
      jasmine.clock().mockDate(new Date(2026, 9, 25));
      try {
        // The answers arrive in the middle of the edit.
        openSelect(fixture.nativeElement, 'datasetId');
        fixture.detectChanges();
        typeWithoutCommit('x');
        list.next(first);
        list.complete();
        typeWithoutCommit('');
        expect(component.doiItems()).toEqual(first);

        component.onDatasetSearch('abc');
        jasmine.clock().tick(APP_CONSTANTS.DEBOUNCE_TIME);
        typeWithoutCommit('x');
        search.next(found);
        search.complete();
        await settlePromises();
        typeWithoutCommit('');
        expect(component.doiItems()).toEqual(found);
        expect(getItems).toHaveBeenCalledTimes(3);
      } finally {
        jasmine.clock().uninstall();
      }
    });

    // A lookup still under way when the token changed answered after the
    // reset: the select kept what the old token found and asked nothing with
    // the new one.
    it('drops lookups answered after a token edit and asks again with the new token', async () => {
      const list = new Subject<SelectItem<string>[]>();
      const search = new Subject<SelectItem<string>[]>();
      const old = [{ label: 'Dataset O', value: 'doi:10.1/O' }];
      const getItems: jasmine.Spy = spyOn(
        dvLookup,
        'getItems',
      ).and.returnValues(
        // The list the async ngOnInit asks for, empty.
        of([]),
        list,
        search,
        of([{ label: 'Dataset N', value: 'doi:10.1/N' }]),
      );
      initComponent();
      await settlePromises();
      jasmine.clock().install();
      jasmine.clock().mockDate(new Date(2026, 9, 25));
      try {
        // The first list: the select opened and closed, the token edited.
        openSelect(fixture.nativeElement, 'datasetId');
        fixture.detectChanges();
        openSelect(fixture.nativeElement, 'datasetId');
        fixture.detectChanges();
        editToken('token-1');
        list.next(old);
        list.complete();
        expect(component.doiItems()).toEqual([]);

        // A search past its debounce, the token edited again.
        component.onDatasetSearch('abc');
        jasmine.clock().tick(APP_CONSTANTS.DEBOUNCE_TIME);
        editToken('token-2');
        search.next(old);
        search.complete();
        await settlePromises();
        expect(component.doiItems()).toEqual([]);

        openSelect(fixture.nativeElement, 'datasetId');
        fixture.detectChanges();
        expect(getItems).toHaveBeenCalledTimes(4);
        expect(getItems.calls.mostRecent().args).toEqual([
          '',
          'Dataset',
          undefined,
          'token-2',
          true,
        ]);
        expect(selectPanelLabels()).toEqual(['Dataset N']);
      } finally {
        jasmine.clock().uninstall();
      }
    });

    // A change event without a new token, a browser filling in the restored
    // token again for instance, resets nothing.
    it('resets nothing when the field commits the token it already had', async () => {
      plugin.storeDvToken = true;
      localStorage.setItem('dataverseToken', 'stored-token');
      const comp = initComponent();
      await fixture.whenStable();
      selectDataset(comp);
      editToken('stored-token');
      expect(comp.datasetId()).toBe('doi:10.1/D');
      expect(comp.doiItems().length).toBe(1);
      editToken('other-token');
      expect(comp.datasetId()).toBeUndefined();
      expect(localStorage.getItem('dataverseToken')).toBe('other-token');
    });

    it('resets nothing when the token is restored at load or set in code', async () => {
      plugin.storeDvToken = true;
      localStorage.setItem('dataverseToken', 'stored-token');
      let onUserChange!: jasmine.Spy;
      const comp = initComponent({}, (c) => {
        onUserChange = spyOn(c, 'onUserChange').and.callThrough();
      });
      await fixture.whenStable();
      // ngModel writes the restored token into the field without a change event.
      expect(tokenInput().value).toBe('stored-token');

      selectDataset(comp);
      comp.dataverseToken.set('token-from-code');
      await fixture.whenStable();
      expect(tokenInput().value).toBe('token-from-code');
      expect(onUserChange).not.toHaveBeenCalled();
      expect(comp.datasetId()).toBe('doi:10.1/D');
      expect(comp.doiItems().length).toBe(1);
    });

    it('keeps the dataset preselected from globusDownloadParameters', async () => {
      dataService.globusParamsResponse = {
        data: { queryParameters: { datasetPid: 'doi:10.1/PRE' } },
      };
      let onUserChange!: jasmine.Spy;
      const comp = initComponent(
        { datasetDbId: '42', downloadId: 'dl-1' },
        (c) => {
          onUserChange = spyOn(c, 'onUserChange').and.callThrough();
        },
      );
      // The async ngOnInit asks globusDownloadParameters for the dataset.
      await settlePromises();
      await fixture.whenStable();
      expect(tokenInput()).not.toBeNull();
      expect(comp.datasetId()).toBe('doi:10.1/PRE');
      expect(comp.doiItems()).toEqual([
        { label: 'doi:10.1/PRE', value: 'doi:10.1/PRE' },
      ]);
      expect(onUserChange).not.toHaveBeenCalled();
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
    it('should set accessMode to guest and close popup', async () => {
      const comp = initComponent();
      await new Promise<void>((r) => setTimeout(r));
      comp.showGuestLoginPopup.set(true);
      comp.accessDeniedForGuest.set(true);
      comp.loading.set(false);
      spyOn(comp, 'getRepoToken');

      comp.continueAsGuest();

      expect(comp.accessDeniedForGuest()).toBeFalse();
      expect(comp.accessMode()).toBe('guest');
      expect(comp.showGuestLoginPopup()).toBeFalse();
      expect(comp.getRepoToken).toHaveBeenCalled();
    });

    it('should wait for loading before proceeding', async () => {
      const comp = initComponent();
      await new Promise<void>((r) => setTimeout(r));
      comp.showGuestLoginPopup.set(true);
      comp.loading.set(true);
      spyOn(comp, 'getRepoToken');

      comp.continueAsGuest();

      // Should not be called yet while loading
      expect(comp.getRepoToken).not.toHaveBeenCalled();

      // Simulate loading complete
      comp.loading.set(false);
      await new Promise<void>((r) => setTimeout(r, 200));

      expect(comp.accessMode()).toBe('guest');
      expect(comp.getRepoToken).toHaveBeenCalled();
    });
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
      expect(notification.warnings).toContain(
        'Invalid preview URL or token. Please check the value and try again.',
      );
    });

    it('should set token and accessMode from valid preview URL', async () => {
      const comp = initComponent();
      await new Promise<void>((r) => setTimeout(r));
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
    });

    it('should show info and continue when DOI prefill request fails', () => {
      const comp = initComponent();
      comp.downloadId.set('dl-123');
      dataService.globusParamsError = new Error('Server Error');
      comp.previewUrlInput.set(
        'https://example.com/api/v1/datasets/999/globusDownloadParameters?downloadId=dl-123&token=12345678-1234-1234-1234-123456789012',
      );
      spyOn(comp, 'getRepoToken');

      comp.continueWithPreviewUrl();

      expect(notification.infos).toContain(
        'Could not prefill dataset information from the preview URL. Continuing with OAuth.',
      );
      expect(comp.getRepoToken).toHaveBeenCalled();
      expect(comp.loading()).toBeFalse();
      dataService.globusParamsError = undefined;
    });
  });

  describe('fetchDoiFromGlobusParams', () => {
    it('should set DOI, extract preselected files, and continue when popup is closed', () => {
      const comp = initComponent();
      comp.datasetDbId.set('999');
      comp.downloadId.set('dl-123');
      comp.showGuestLoginPopup.set(false);
      dataService.globusParamsResponse = {
        data: {
          queryParameters: {
            datasetPid: 'doi:10.1234/ABC',
            files: { '11': 'file-a.txt' },
          },
        },
      };
      spyOn(comp, 'getRepoToken');

      (comp as any).fetchDoiFromGlobusParams();

      expect(comp.datasetId()).toBe('doi:10.1234/ABC');
      expect(comp.doiItems()).toEqual([
        { label: 'doi:10.1234/ABC', value: 'doi:10.1234/ABC' },
      ]);
      expect(comp.preSelectedFileIds().has('11')).toBeTrue();
      expect(comp.getRepoToken).toHaveBeenCalled();
      expect(comp.loading()).toBeFalse();
    });

    it('should not continue to OAuth when popup is open', () => {
      const comp = initComponent();
      comp.datasetDbId.set('999');
      comp.downloadId.set('dl-123');
      comp.showGuestLoginPopup.set(true);
      dataService.globusParamsResponse = {
        data: { queryParameters: { datasetPid: 'doi:10.1234/ABC' } },
      };
      spyOn(comp, 'getRepoToken');

      (comp as any).fetchDoiFromGlobusParams();

      expect(comp.datasetId()).toBe('doi:10.1234/ABC');
      expect(comp.getRepoToken).not.toHaveBeenCalled();
      expect(comp.loading()).toBeFalse();
    });

    it('should reset loading on API error', () => {
      const comp = initComponent();
      comp.datasetDbId.set('999');
      comp.downloadId.set('dl-123');
      dataService.globusParamsError = new Error('lookup failed');

      (comp as any).fetchDoiFromGlobusParams();

      expect(comp.loading()).toBeFalse();
      dataService.globusParamsError = undefined;
    });
  });

  describe('branch coverage', () => {
    it('repoName field accessors fall back when the plugin omits them', () => {
      const comp = initComponent();
      comp.globusPlugin.set({ tokenGetter: {} } as any);
      expect(comp.repoNameFieldEditable()).toBeFalse();
      expect(comp.repoNamePlaceholder()).toBe('');
      comp.globusPlugin.set({
        repoNameFieldEditable: true,
        repoNameFieldPlaceholder: 'ep',
      } as any);
      expect(comp.repoNameFieldEditable()).toBeTrue();
      expect(comp.repoNamePlaceholder()).toBe('ep');
    });

    it('hasDownloadSelection follows the root node action', () => {
      const comp = initComponent();
      const root = {
        data: { id: '', action: Fileaction.Download } as Datafile,
      };
      comp.rowNodeMap.set(new Map([['', root]]));
      expect(comp.hasDownloadSelection()).toBeTrue();
      root.data.action = Fileaction.Ignore;
      comp.refreshTrigger.update((n) => n + 1);
      expect(comp.hasDownloadSelection()).toBeFalse();
    });

    it('fileNodes skips the root entry, folders and nodes with children', () => {
      const comp = initComponent();
      comp.rowNodeMap.set(
        new Map<string, TreeNode<Datafile>>([
          ['', { data: { id: '' } as Datafile }],
          [
            'dir',
            { data: { id: 'dir', attributes: { isFile: false } } as Datafile },
          ],
          ['parent', { data: { id: 'parent' } as Datafile, children: [{}] }],
          ['nodata', {}],
          ['f', { data: { id: 'f' } as Datafile }],
        ]),
      );
      expect(comp.fileNodes().map((n) => n.data!.id)).toEqual(['f']);
    });

    it('updateFolderActionsRecursive derives folder actions from children', () => {
      const comp = initComponent() as any;
      expect(comp.updateFolderActionsRecursive({})).toBe(Fileaction.Ignore);
      expect(comp.updateFolderActionsRecursive({ data: {} })).toBe(
        Fileaction.Ignore,
      );
      const uniform = {
        data: { action: Fileaction.Ignore },
        children: [
          { data: { action: Fileaction.Download } },
          { data: { action: Fileaction.Download } },
        ],
      };
      expect(comp.updateFolderActionsRecursive(uniform)).toBe(
        Fileaction.Download,
      );
      expect(uniform.data.action).toBe(Fileaction.Download);
      const mixed = {
        children: [
          { data: { action: Fileaction.Download } },
          { data: { action: Fileaction.Ignore } },
        ],
      };
      expect(comp.updateFolderActionsRecursive(mixed)).toBe(Fileaction.Custom);
    });

    it('download success without a task id only reports the submission', async () => {
      initComponent();
      component.rowNodeMap().set('1:file', {
        data: {
          id: '1',
          name: 'f',
          path: '',
          action: Fileaction.Download,
        } as any,
      });
      component.option.set('/');
      component.selectedRepoName.set('repoX');
      submit.responseTaskId = '';
      component.download();
      await new Promise<void>((r) => setTimeout(r));
      expect(notification.successes.pop()).toBe('Download request submitted.');
      expect(component.lastTransferTaskId()).toBeUndefined();
      expect(component.globusMonitorUrl()).toBeUndefined();
    });

    it('download error falls back to message and then to a generic text', async () => {
      initComponent();
      component.rowNodeMap().set('1:file', {
        data: {
          id: '1',
          name: 'f',
          path: '',
          action: Fileaction.Download,
        } as any,
      });
      component.option.set('/');
      component.selectedRepoName.set('repoX');
      submit.succeed = false;
      submit.errorPayload = { message: 'boom' };
      component.download();
      await new Promise<void>((r) => setTimeout(r));
      expect(notification.errors.pop()).toBe('Download request failed: boom');
      submit.errorPayload = {};
      component.download();
      await new Promise<void>((r) => setTimeout(r));
      expect(notification.errors.pop()).toBe(
        'Download request failed: unknown error',
      );
      expect(component.downloadRequested()).toBeFalse();
    });

    it('getOptions skips the lookup when branch items are already loaded', () => {
      const comp = initComponent();
      comp.selectedRepoName.set('repoA');
      comp.branchItems.set([{ label: 'a', value: '/a/' }]);
      const spy = spyOn(repoLookup, 'getOptions').and.callThrough();
      comp.getOptions();
      expect(spy).not.toHaveBeenCalled();
    });

    it('updateExpandedNodeChildren replaces a nested target and reports misses', () => {
      const tree = [
        { label: 'x', data: '/x/', children: [] },
        { label: 'a', data: '/a/', children: [{ label: 'b', data: '/a/b/' }] },
      ];
      const hit: any = updateExpandedNodeChildren(
        tree,
        { label: 'b', data: '/a/b/' },
        [{ label: 'c', data: '/a/b/c/' }],
      );
      expect(hit.found).toBeTrue();
      expect(hit.tree[1].children[0].children[0].data).toBe('/a/b/c/');
      expect(hit.tree[0]).toBe(tree[0]);
      const miss = updateExpandedNodeChildren(
        tree,
        { label: 'zzz', data: '/zzz/' },
        [],
      );
      expect(miss.found).toBeFalse();
    });

    it('getRepoToken falls back to the plugin source url and carries preselected files', () => {
      const comp = initComponent();
      comp.globusPlugin.set({
        sourceUrlFieldValue: 'https://globus.example',
        tokenGetter: { oauth_client_id: 'client-id' },
      } as any);
      comp.preSelectedFileIds.set(new Set(['1', '2']));
      comp.datasetId.set('?');
      comp.getRepoToken();
      const url = navigation.assign.calls.mostRecent().args[0] as string;
      expect(new URL(url).origin).toBe('https://globus.example');
      const state = JSON.parse(new URL(url).searchParams.get('state')!);
      expect(state.preSelectedFileIds).toEqual(['1', '2']);
      expect(state.datasetId).toBeUndefined();
    });

    it('onDatasetChange explains anonymous preview url failures', async () => {
      const comp = initComponent();
      comp.datasetId.set('doi:10.1/PREV');
      comp.accessMode.set('preview');
      comp.dataverseToken.set('tok');
      dataService.error = 'forbidden';
      comp.onDatasetChange();
      await new Promise<void>((r) => setTimeout(r));
      expect(notification.errors.pop()).toContain(
        'Anonymous Preview URLs are not supported',
      );
      expect(comp.loading()).toBeFalse();
      dataService.error = undefined;
    });

    it('onDatasetChange sorts entries without ids first', async () => {
      const comp = initComponent();
      comp.datasetId.set('doi:10.1/SORT');
      dataService.response = {
        data: [
          { id: 'b', name: 'b', path: '', action: Fileaction.Ignore },
          { name: 'noid', path: '', action: Fileaction.Ignore },
          { id: 'a', name: 'a', path: '', action: Fileaction.Ignore },
        ],
      };
      comp.onDatasetChange();
      await new Promise<void>((r) => setTimeout(r));
      expect(comp.data()?.data?.map((d: Datafile) => d.name)).toEqual([
        'noid',
        'a',
        'b',
      ]);
      dataService.response = { data: [] };
    });

    it('getDoiOptions reloads when the dataset id is only a placeholder', async () => {
      const comp = initComponent();
      comp.doiItems.set([{ label: '?', value: '?' }]);
      comp.datasetId.set('?');
      dvLookup.items = [{ label: 'a', value: 'doi:a' }];
      comp.getDoiOptions();
      await new Promise<void>((r) => setTimeout(r));
      expect(comp.doiItems()[0].value).toBe('doi:a');
      expect(comp.datasetId()).toBeUndefined();
    });

    it('ngOnInit fetches the DOI from globus parameters when only ids are known', async () => {
      const spy = spyOn(
        dataService,
        'getGlobusDownloadParams',
      ).and.callThrough();
      initComponent({ downloadId: 'dl-1', datasetDbId: '999' });
      await new Promise<void>((r) => setTimeout(r));
      expect(spy).toHaveBeenCalled();
      const args = spy.calls.mostRecent().args as unknown[];
      expect(args[1]).toBe('999');
      expect(args[2]).toBe('dl-1');
    });

    it('ngOnInit uses a placeholder DOI when the OAuth state has no dataset', async () => {
      const comp = initComponent(
        {
          code: 'code-1',
          state: JSON.stringify({ nonce: 'n1', download: true }),
        },
        (c) => spyOn(c, 'getDoiOptions'),
      );
      await new Promise<void>((r) => setTimeout(r));
      httpMock.match(() => true).forEach((r) => r.flush({ session_id: 's' }));
      expect(comp.datasetId()).toBe('?');
      expect(comp.doiItems()).toEqual([{ label: '?', value: '?' }]);
    });
  });
});

describe('DownloadComponent layout', () => {
  let plugin: MockPluginService;

  beforeEach(async () => {
    sessionStorage.clear();
    plugin = new MockPluginService();
    const routeSubject = new BehaviorSubject<
      Record<string, string | undefined>
    >({});
    await TestBed.configureTestingModule({
      imports: [DownloadComponent],
      providers: [
        provideRouter([], withDisabledInitialNavigation()),
        provideHttpClient(withXhr(), withInterceptorsFromDi()),
        provideHttpClientTesting(),
        {
          provide: NotificationService,
          useValue: new MockNotificationService(),
        },
        { provide: RepoLookupService, useValue: new MockRepoLookupService() },
        { provide: SubmitService, useValue: new MockSubmitService() },
        { provide: PluginService, useValue: plugin },
        {
          provide: DvObjectLookupService,
          useValue: new MockDvObjectLookupService(),
        },
        { provide: DataService, useValue: new MockDataService() },
        { provide: UtilsService, useValue: new MockUtilsService() },
        { provide: NavigationService, useValue: new MockNavigationService() },
        {
          provide: ActivatedRoute,
          useValue: { queryParams: routeSubject.asObservable() },
        },
      ],
    }).compileComponents();
  });

  const create = () => {
    const fixture = TestBed.createComponent(DownloadComponent);
    fixture.detectChanges();
    fixture.componentInstance.globusPlugin.set(plugin.getGlobusPlugin());
    return fixture;
  };

  // An open select or filter panel follows the host when the host scrolls.
  it('reports the scrolling page host to the overlays', async () => {
    const fixture = create();
    await fixture.whenStable();
    expect(
      scrolledContainers(
        TestBed.inject(ScrollDispatcher),
        fixture.nativeElement,
      ),
    ).toEqual([fixture.nativeElement]);
  });

  // A folder with one file, collapsed.
  const renderFolder = async () => {
    const fixture = create();
    const comp = fixture.componentInstance;
    const folder: TreeNode<Datafile> = {
      key: 'dir',
      data: {
        id: 'dir',
        name: 'dir',
        path: '',
        hidden: false,
        action: Fileaction.Ignore,
      },
      children: [],
    };
    const file: TreeNode<Datafile> = {
      key: 'dir/f:file',
      data: {
        id: 'dir/f',
        name: 'f',
        path: 'dir',
        hidden: false,
        action: Fileaction.Ignore,
        attributes: { isFile: true },
      },
      children: [],
      parent: folder,
    };
    folder.children!.push(file);
    const root: TreeNode<Datafile> = {
      key: '',
      data: {
        id: '',
        name: '',
        path: '',
        hidden: false,
        action: Fileaction.Ignore,
      },
      children: [folder],
    };
    comp.rowNodeMap.set(
      new Map([
        ['', root],
        ['dir', folder],
        ['dir/f:file', file],
      ]),
    );
    comp.rootNodeChildren.set([folder]);
    comp.datasetId.set('doi:10.1/ABC');
    comp.data.set({
      id: 'doi:10.1/ABC',
      url: 'https://example.org/ds',
    } as CompareResult);
    await fixture.whenStable();
    return fixture;
  };

  it('gives the tree table viewport a height with the page styles', async () => {
    const fixture = await renderFolder();
    const body = fixture.nativeElement.querySelector('.tt-body') as HTMLElement;
    expect(body.offsetHeight).toBeGreaterThan(0);
    const viewport = fixture.debugElement
      .query(By.directive(CdkVirtualScrollViewport))
      .injector.get(CdkVirtualScrollViewport);
    expect(viewport.getViewportSize()).toBeGreaterThan(0);
    expect(
      fixture.nativeElement.querySelectorAll('div[app-downloadablefile]')
        .length,
    ).toBe(1);
    (
      fixture.nativeElement.querySelector('.tt-toggle') as HTMLButtonElement
    ).click();
    await fixture.whenStable();
    expect(
      fixture.nativeElement.querySelectorAll('div[app-downloadablefile]')
        .length,
    ).toBe(2);
    expect(treegridStructure(fixture.nativeElement)).toEqual({
      table: 'treegrid',
      label: 'Files',
      rowCount: '3',
      header: 'row 1',
      headerCells: ['columnheader', 'columnheader'],
      rows: [
        'dir: row 2, level 1, expanded true',
        'f: row 3, level 2, expanded null',
      ],
      cells: ['gridcell'],
      togglers: ['Toggle dir'],
    });
  });

  // The icon only buttons had no accessible name.
  it('names the toggle all button and the row buttons after their action', async () => {
    const fixture = await renderFolder();
    const toggleAll = fixture.nativeElement.querySelector(
      '.tt-header button',
    ) as HTMLButtonElement;
    const rowButton = () =>
      fixture.nativeElement.querySelector(
        'div[app-downloadablefile] .btn-outline-secondary',
      ) as HTMLButtonElement;
    expect(toggleAll.getAttribute('aria-label')).toBe(
      'Action for all files: none, change',
    );
    expect(toggleAll.title).toBe('Action for all files: none, change');
    expect(rowButton().getAttribute('aria-label')).toBe('Action: none, change');
    toggleAll.click();
    await fixture.whenStable();
    expect(toggleAll.getAttribute('aria-label')).toBe(
      'Action for all files: download, change',
    );
    expect(rowButton().getAttribute('aria-label')).toBe(
      'Action: download, change',
    );
  });

  describe('in a 1366x768 window', () => {
    let restoreWindow: () => void;
    beforeEach(() => (restoreWindow = resizeTestWindow(1366, 768)));
    afterEach(() => restoreWindow());

    it('fits the window with 300 files', async () => {
      const fixture = create();
      const comp = fixture.componentInstance;
      const files: TreeNode<Datafile>[] = Array.from(
        { length: 300 },
        (_, i) => ({
          key: `file${i}.csv:file`,
          data: {
            id: `file${i}.csv`,
            name: `file${i}.csv`,
            path: '',
            hidden: false,
            action: Fileaction.Ignore,
            attributes: { isFile: true },
          },
        }),
      );
      comp.rowNodeMap.set(new Map(files.map((f) => [f.key!, f])));
      comp.rootNodeChildren.set(files);
      comp.datasetId.set('doi:10.1234/ABC');
      comp.data.set({
        id: 'doi:10.1234/ABC',
        url: 'https://example.org/ds',
      } as CompareResult);
      await fixture.whenStable();
      const layout = measurePage(fixture.nativeElement);
      expect(layout.window).toBe(768);
      expect(layout.pageHeight).toBeLessThanOrEqual(layout.window);
      expect(layout.hostScrollHeight).toBeLessThanOrEqual(
        layout.hostClientHeight,
      );
      expect(layout.body).toBeGreaterThanOrEqual(12 * layout.rem);
      expect(layout.header).toBe(layout.headerNoRows);
      expect(
        fixture.nativeElement.querySelectorAll('div[app-downloadablefile]')
          .length,
      ).toBeGreaterThan(10);
      // A long folder tree scrolls in its column instead of being cut off.
      const right = fixture.nativeElement.querySelector(
        '.download-split-right',
      ) as HTMLElement;
      expect(getComputedStyle(right).overflowY).toBe('auto');
    });

    it('scrolls the page host to keep 12rem of rows below a running transfer card', async () => {
      const fixture = create();
      const comp = fixture.componentInstance;
      const files: TreeNode<Datafile>[] = Array.from(
        { length: 300 },
        (_, i) => ({
          key: `file${i}.csv:file`,
          data: {
            id: `file${i}.csv`,
            name: `file${i}.csv`,
            path: '',
            hidden: false,
            action: Fileaction.Ignore,
            attributes: { isFile: true },
          },
        }),
      );
      comp.rowNodeMap.set(new Map(files.map((f) => [f.key!, f])));
      comp.rootNodeChildren.set(files);
      comp.datasetId.set('doi:10.1234/ABC');
      comp.data.set({
        id: 'doi:10.1234/ABC',
        url: 'https://example.org/ds',
      } as CompareResult);
      comp.lastTransferTaskId.set('task-1');
      comp.globusMonitorUrl.set('https://app.globus.org/activity/task-1');
      await fixture.whenStable();
      // The guest dialog, open for a user who is not logged in, stops the host
      // from scrolling.
      expect(comp.showGuestLoginPopup()).toBeTrue();
      comp.showGuestLoginPopup.set(false);
      await fixture.whenStable();
      const host = fixture.nativeElement as HTMLElement;
      const card = host.querySelector('.transfer-status') as HTMLElement;
      expect(card.offsetHeight).toBeGreaterThan(150);
      // The select's bottom margin and the card's top margin collapse into
      // one 1rem gap, as they did before the page became a flex column.
      const select = host
        .querySelector('#datasetId')!
        .closest('.mb-3') as HTMLElement;
      expect(
        card.getBoundingClientRect().top -
          select.getBoundingClientRect().bottom,
      ).toBe(16);
      const body = host.querySelector('.tt-body') as HTMLElement;
      const rem = parseFloat(
        getComputedStyle(document.documentElement).fontSize,
      );
      expect(body.getBoundingClientRect().height).toBeGreaterThanOrEqual(
        12 * rem,
      );
      // The host scrolls instead of running under the footer, and scrolled to
      // its end it shows the whole table.
      expect(getComputedStyle(host).overflowY).toBe('auto');
      expect(host.scrollHeight).toBeGreaterThan(host.clientHeight);
      host.scrollTop = host.scrollHeight;
      expect(body.getBoundingClientRect().bottom).toBeLessThanOrEqual(
        host.getBoundingClientRect().bottom + 0.5,
      );
    });
  });
});
