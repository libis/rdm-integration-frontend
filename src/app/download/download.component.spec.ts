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
import { ActivatedRoute } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
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
import { GlobusTaskStatus, SubmitService } from '../submit.service';
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
  statusResponses: GlobusTaskStatus[] = [];
  statusError?: unknown;

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

  getDownloadStatus(taskId: string) {
    return new Observable<GlobusTaskStatus>((obs) => {
      setTimeout(() => {
        if (this.statusError) {
          obs.error(this.statusError);
          return;
        }
        const nextStatus =
          this.statusResponses.shift() ??
          ({ task_id: taskId, status: 'ACTIVE' } as GlobusTaskStatus);
        obs.next(nextStatus);
        obs.complete();
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
      imports: [RouterTestingModule, DownloadComponent],
      providers: [
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
    submit.statusResponses = [];
    submit.statusError = undefined;
    submit.succeed = true;
  });

  it('should create', () => {
    initComponent();
    expect(component).toBeTruthy();
  });

  it('rowClass reflects action styling', () => {
    initComponent();
    const file: Datafile = {
      id: '1',
      name: 'a',
      path: '',
      hidden: false,
      action: Fileaction.Download,
    };
    expect(component.rowClass(file)).toBe('file-action-copy');
    file.action = Fileaction.Custom;
    expect(component.rowClass(file)).toBe('file-action-custom');
    file.action = Fileaction.Ignore;
    expect(component.rowClass(file)).toBe('');
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

  it('download success kicks off polling and stores monitoring info', fakeAsync(() => {
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
    submit.statusResponses = [
      {
        task_id: 'task-789',
        status: 'ACTIVE',
        bytes_transferred: 50,
        bytes_expected: 200,
      },
      {
        task_id: 'task-789',
        status: 'SUCCEEDED',
        nice_status: 'All done',
        bytes_transferred: 200,
        bytes_expected: 200,
        files: 4,
        files_transferred: 4,
      },
    ];

    component.download();
    tick();
    // first poll
    tick();
    expect(notification.successes.pop()).toContain('Globus task ID: task-789');
    expect(component.lastTransferTaskId).toBe('task-789');
    expect(component.globusMonitorUrl).toBe(
      'https://app.globus.org/activity/task-789',
    );
    expect(component.statusPollingActive).toBeTrue();
    expect(component.downloadProgress).toBe(25);
    expect(component.taskStatus?.status).toBe('ACTIVE');
    expect(component.statusTone).toBe('info');
    expect(component.statusMessage).toContain('ACTIVE');

    // second poll reaches terminal state
    tick(component.statusPollIntervalMs);
    tick();
    expect(component.statusPollingActive).toBeFalse();
    expect(component.downloadProgress).toBe(100);
    expect(component.statusMessage).toContain('All done');
    expect(component.statusTone).toBe('success');
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

  it('status polling error surfaces user-facing message', fakeAsync(() => {
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

    submit.statusError = { status: 401 };
    component.download();
    tick();
    tick();

    expect(component.statusPollingError).toContain('Globus session expired');
    expect(component.statusTone).toBe('error');
    expect(component.statusIcon).toContain('exclamation');

    submit.statusError = undefined;
  }));

  it('refreshGlobusStatus restarts polling when task id present', fakeAsync(() => {
    initComponent();
    component.lastTransferTaskId = 'task-99';
    submit.statusResponses = [
      {
        task_id: 'task-99',
        status: 'ACTIVE',
        bytes_transferred: 10,
        bytes_expected: 100,
      } as GlobusTaskStatus,
    ];

    component.refreshGlobusStatus();
    expect(component.statusPollingActive).toBeTrue();
    tick();
    expect(component.taskStatus?.task_id).toBe('task-99');
    component['stopStatusPolling']();
  }));

  it('status helpers adapt to lifecycle states', () => {
    initComponent();
    expect(component.hasStatusDetails).toBeFalse();

    component.downloadInProgress = true;
    expect(component.hasStatusDetails).toBeTrue();
    expect(component.statusMessage).toContain('Submitting download request');

    component.downloadInProgress = false;
    component.statusPollingActive = true;
    expect(component.statusMessage).toContain('Checking Globus transfer');

    component.statusPollingActive = false;
    component.statusPollingError = 'oops';
    expect(component.statusMessage).toBe('oops');

    component.statusPollingError = undefined;
    component.taskStatus = {
      task_id: 't-1',
      status: 'FAILED',
    } as GlobusTaskStatus;
    expect(component.statusTone).toBe('error');
    expect(component.statusIcon).toContain('exclamation');
    expect(component.statusMessage).toContain('FAILED');

    component.taskStatus = {
      task_id: 't-2',
      status: 'SUCCEEDED',
      nice_status: 'Transfer complete',
    } as GlobusTaskStatus;
    expect(component.statusMessage).toContain('Transfer complete');

    component.taskStatus = undefined;
    component.lastTransferTaskId = 't-3';
    expect(component.statusMessage).toContain('Download request submitted');
  });

  it('downloadProgress reflects bytes when expected available', () => {
    initComponent();
    component.taskStatus = {
      task_id: 't-1',
      status: 'ACTIVE',
      bytes_transferred: 150,
      bytes_expected: 300,
    } as GlobusTaskStatus;
    expect(component.downloadProgress).toBe(50);

    component.taskStatus = {
      task_id: 't-2',
      status: 'ACTIVE',
      bytes_transferred: 150,
    } as GlobusTaskStatus;
    expect(component.downloadProgress).toBeUndefined();
  });

  it('openGlobusMonitor opens external window when url present', () => {
    initComponent();
    component.globusMonitorUrl = 'https://app.globus.org/activity/task-1';
    const spyOpen = spyOn(window, 'open');
    component.openGlobusMonitor();
    expect(spyOpen).toHaveBeenCalledWith(
      'https://app.globus.org/activity/task-1',
      '_blank',
      'noopener',
    );
  });

  it('downloadDisabled responds to selection & option presence', () => {
    initComponent();
    const df: Datafile = {
      id: '1',
      name: 'f',
      path: '',
      hidden: false,
      action: Fileaction.Ignore,
    } as any;
    component.rowNodeMap.set('1:file', { data: df });
    component.option = 'b';
    expect(component.downloadDisabled()).toBeTrue();
    df.action = Fileaction.Download;
    expect(component.downloadDisabled()).toBeFalse();
  });

  it('downloadDisabled prevents new requests while progress is active', () => {
    initComponent();
    const df: Datafile = {
      id: '1',
      name: 'f',
      path: '',
      hidden: false,
      action: Fileaction.Download,
    } as any;
    component.rowNodeMap.set('1:file', { data: df });
    component.option = 'folder';
    component.downloadInProgress = true;
    expect(component.downloadDisabled()).toBeTrue();

    component.downloadInProgress = false;
    component.statusPollingActive = true;
    expect(component.downloadDisabled()).toBeTrue();

    component.statusPollingActive = false;
    expect(component.downloadDisabled()).toBeFalse();
  });

  it('startRepoSearch uses init capability when enabled', fakeAsync(() => {
    initComponent();
    component.globusPlugin = { repoNameFieldHasInit: true } as any;
    component.startRepoSearch();
    expect(component.repoNames[0].label).toContain('loading');
  }));

  it('startRepoSearch shows typing hint when init disabled', () => {
    initComponent();
    component.globusPlugin = { repoNameFieldHasInit: false } as any;
    component.startRepoSearch();
    expect(component.repoNames[0].label).toContain('start typing');
  });

  it('startRepoSearch returns early when found repo name already populated', () => {
    initComponent();
    component.foundRepoName = 'existing-endpoint';
    component.startRepoSearch();
    expect(component.repoNames.length).toBe(0);
  });

  it('back navigates by assigning location href', () => {
    initComponent();
    component.back();
    expect(navigation.assign).toHaveBeenCalledWith('connect');
  });

  it('showDVToken reflects plugin toggle', () => {
    initComponent();
    plugin.showDvToken = true;
    expect(component.showDVToken()).toBeTrue();
    plugin.showDvToken = false;
    expect(component.showDVToken()).toBeFalse();
  });

  it('getDoiOptions populates list and reports errors', fakeAsync(() => {
    initComponent();
    dvLookup.items = [
      { label: 'Dataset A', value: 'doi:A' },
      { label: 'Dataset B', value: 'doi:B' },
    ];
    component.getDoiOptions();
    tick();
    expect(component.doiItems.length).toBe(2);

    component.doiItems = [];
    dvLookup.error = 'boom';
    component.getDoiOptions();
    tick();
    expect(
      notification.errors.some((msg) => msg.includes('DOI lookup failed')),
    ).toBeTrue();
  }));

  it('onUserChange clears state and persists token when provided', () => {
    initComponent();
    plugin.storeDvToken = true;
    component.dataverseToken = 'tok123';
    component.doiItems = [{ label: 'old', value: 'old' }];
    component.datasetId = 'old';
    component.onUserChange();
    expect(component.doiItems.length).toBe(0);
    expect(component.datasetId).toBeUndefined();
    expect(localStorage.getItem('dataverseToken')).toBe('tok123');
    plugin.storeDvToken = false;
  });

  it('getRepoToken skips navigation when token getter missing', () => {
    initComponent();
    const initialCalls = navigation.assign.calls.count();
    component.dataverseToken = 'tok456';
    component.globusPlugin = {
      sourceUrlFieldValue: 'https://example.com',
      tokenGetter: undefined,
    } as any;
    component.getRepoToken();
    expect(navigation.assign.calls.count()).toBe(initialCalls);
  });

  it('getRepoToken opens new window when oauth client id missing', () => {
    initComponent();
    component.globusPlugin = {
      sourceUrlFieldValue: 'https://example.com',
      tokenGetter: { URL: '/oauth', oauth_client_id: '' },
    } as any;
    const openSpy = spyOn(window, 'open');
    component.getRepoToken();
    expect(openSpy).toHaveBeenCalled();
  });

  it('repoNameSearch returns error placeholder when branchItems already loaded', async () => {
    initComponent();
    component.branchItems = [{ label: 'existing', value: 'x' }];
    const results = await component.repoNameSearch('branch');
    expect(results[0].value).toBe('error');
  });

  it('repoNameSearch yields service results when request available', async () => {
    const comp = initComponent();
    comp.selectedRepoName = 'repoX';
    spyOn(repoLookup, 'search').and.returnValue(
      of<SelectItem<string>[]>([
        { label: 'remote-1', value: 'remote-1' },
        { label: 'remote-2', value: 'remote-2' },
      ]),
    );

    const results = await comp.repoNameSearch('remote');

    expect(repoLookup.search).toHaveBeenCalled();
    expect(results.length).toBe(2);
    expect(results[0].value).toBe('remote-1');
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
