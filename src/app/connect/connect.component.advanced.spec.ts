import {
  provideHttpClient,
  withInterceptorsFromDi,
} from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { SelectItem, TreeNode } from 'primeng/api';
import { Observable, of } from 'rxjs';
import { DataStateService } from '../data.state.service';
import { DatasetService } from '../dataset.service';
import { DvObjectLookupService } from '../dvobject.lookup.service';
import { OauthService } from '../oauth.service';
import { PluginService } from '../plugin.service';
import { RepoLookupService } from '../repo.lookup.service';
import { ConnectValidationService } from '../shared/connect-validation.service';
import { NavigationService } from '../shared/navigation.service';
import { NotificationService } from '../shared/notification.service';
import { SnapshotStorageService } from '../shared/snapshot-storage.service';
import { ConnectComponent } from './connect.component';

class MockDataStateService {
  initializeStateCalls: unknown[] = [];
  initializeState(creds: unknown) {
    this.initializeStateCalls.push(creds);
  }
  getObservableState() {
    return of(null);
  }
  getCurrentValue() {
    return null;
  }
  resetState() {}
}

class MockPluginService {
  oauthClientId = 'client-id';
  repoNameFieldInteractive = true;
  showTokenGetter = true;
  showDvToken = true;
  repoNameFieldHasInit = true;
  sourceUrlFieldValue?: string;
  repoNameFieldValues: string[] = ['owner/repo'];

  async setConfig() {
    return;
  }
  getPlugins() {
    return [
      { label: 'GitHub', value: 'github' },
      { label: 'Globus', value: 'globus' },
    ];
  }
  getPluginIds(plugin?: string) {
    if (plugin === 'globus') {
      return [{ label: 'Globus', value: 'globus' }];
    }
    return [{ label: 'GitHub', value: 'github' }];
  }
  getPlugin(pluginId?: string) {
    const tokenGetter = {
      URL: '/oauth',
      oauth_client_id: this.oauthClientId,
    } as const;
    return {
      tokenGetter,
      repoNameFieldHasSearch: true,
      parseSourceUrlField: true,
      repoNameFieldName: 'Repository',
      repoNameFieldEditable: true,
      repoNameFieldPlaceholder: 'owner/repo',
      sourceUrlFieldName: 'Source URL',
      sourceUrlFieldPlaceholder: 'https://host/owner/repo',
      sourceUrlFieldValue: this.sourceUrlFieldValue,
      optionFieldInteractive: this.repoNameFieldInteractive,
      optionFieldName: 'Branch',
      usernameFieldName: 'Username',
      tokenFieldName: 'Token',
      tokenFieldPlaceholder: 'token',
      showTokenGetter: this.showTokenGetter,
      repoNameFieldValues: this.repoNameFieldValues,
      repoNameFieldHasInit: this.repoNameFieldHasInit,
      datasetFieldEditable: true,
      collectionFieldEditable: true,
      collectionOptionsHidden: () => false,
      createNewDatasetEnabled: () => true,
      sendMails: () => false,
      name: pluginId ?? 'github',
    } as any;
  }
  dataverseHeader() {
    return 'Dataverse:';
  }
  showDVTokenGetter() {
    return this.showTokenGetter;
  }
  showDVToken() {
    return this.showDvToken;
  }
  collectionOptionsHidden() {
    return false;
  }
  collectionFieldEditable() {
    return true;
  }
  datasetFieldEditable() {
    return true;
  }
  createNewDatasetEnabled() {
    return true;
  }
  getRedirectUri() {
    return 'https://app.example/callback';
  }
  getExternalURL() {
    return 'https://dataverse.example';
  }
  getGlobusPlugin() {
    return {
      tokenGetter: {
        URL: '/globus/oauth',
        oauth_client_id: 'globus-client',
      },
      repoNameFieldName: 'Endpoint',
      repoNameFieldPlaceholder: 'endpoint',
      repoNameFieldEditable: true,
      repoNameFieldHasInit: true,
      optionFieldName: 'Path',
      optionFieldInteractive: true,
      sourceUrlFieldValue: 'https://globus.example',
    } as any;
  }
  sendMails() {
    return false;
  }
}

class MockRepoLookupService {
  options: SelectItem<string>[] = [];
  error?: string;

  search() {
    return of([]);
  }

  getOptions(): Observable<SelectItem<string>[]> {
    return new Observable((observer) => {
      setTimeout(() => {
        if (this.error) {
          observer.error({ error: this.error });
        } else {
          observer.next(this.options);
          observer.complete();
        }
      }, 0);
    });
  }
}

class MockDvObjectLookupService {
  items: SelectItem<string>[] = [];
  error?: string;

  getItems(): Observable<SelectItem<string>[]> {
    return new Observable((observer) => {
      setTimeout(() => {
        if (this.error) {
          observer.error({ error: this.error });
        } else {
          observer.next(this.items);
          observer.complete();
        }
      }, 0);
    });
  }
}

class MockDatasetService {
  lastArgs?: { datasetDbId: string; apiToken?: string };
  response = { persistentId: 'doi:10.123/RESTORED' };

  getDatasetVersion(datasetDbId: string, apiToken?: string) {
    this.lastArgs = { datasetDbId, apiToken };
    return new Observable((observer) => {
      setTimeout(() => {
        observer.next(this.response);
        observer.complete();
      }, 0);
    });
  }
  cancelInitialization(_resetState?: boolean): void {}
}

class MockOauthService {
  lastArgs?: { pluginId: string; code: string; nonce: string };
  session = { session_id: 'session-123' };

  getToken(pluginId: string, code: string, nonce: string) {
    this.lastArgs = { pluginId, code, nonce };
    return new Observable((observer) => {
      setTimeout(() => {
        observer.next(this.session);
        observer.complete();
      }, 0);
    });
  }
}

class MockNotificationService {
  errors: string[] = [];

  showError(msg: string) {
    this.errors.push(msg);
  }

  showSuccess(_: string) {
    // noop
  }
}

class MockSnapshotStorageService {
  saved?: unknown;
  cleared = false;
  stored?: unknown;

  loadConnect() {
    return this.stored as any;
  }
  saveConnect(snapshot: unknown) {
    this.saved = snapshot;
  }
  clearConnect() {
    this.cleared = true;
  }
  mergeConnect(_: unknown) {
    // noop for tests
  }
}

class MockConnectValidationService {
  gatherIssues() {
    return [] as string[];
  }
  summarizeIssues(_: string[]) {
    return undefined;
  }
  isValid() {
    return true;
  }
}

class MockNavigationService {
  assign = jasmine.createSpy('assign');
}

describe('ConnectComponent advanced behaviors', () => {
  let pluginService: MockPluginService;
  let repoLookup: MockRepoLookupService;
  let dvLookup: MockDvObjectLookupService;
  let datasetService: MockDatasetService;
  let oauthService: MockOauthService;
  let notification: MockNotificationService;
  let snapshot: MockSnapshotStorageService;
  let navigation: MockNavigationService;

  beforeEach(async () => {
    pluginService = new MockPluginService();
    repoLookup = new MockRepoLookupService();
    dvLookup = new MockDvObjectLookupService();
    datasetService = new MockDatasetService();
    oauthService = new MockOauthService();
    notification = new MockNotificationService();
    snapshot = new MockSnapshotStorageService();
    navigation = new MockNavigationService();

    await TestBed.configureTestingModule({
      imports: [ConnectComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
        provideNoopAnimations(),
        { provide: PluginService, useValue: pluginService },
        { provide: RepoLookupService, useValue: repoLookup },
        { provide: DvObjectLookupService, useValue: dvLookup },
        { provide: DatasetService, useValue: datasetService },
        { provide: OauthService, useValue: oauthService },
        { provide: NotificationService, useValue: notification },
        { provide: SnapshotStorageService, useValue: snapshot },
        { provide: NavigationService, useValue: navigation },
        {
          provide: ConnectValidationService,
          useClass: MockConnectValidationService,
        },
        { provide: DataStateService, useClass: MockDataStateService },
        { provide: ActivatedRoute, useValue: { queryParams: of({}) } },
      ],
    }).compileComponents();
    navigation.assign.calls.reset();
  });

  function createComponent() {
    const fixture = TestBed.createComponent(ConnectComponent);
    const comp = fixture.componentInstance as any;
    fixture.detectChanges();
    return { fixture, comp };
  }

  it('getRepoToken warns when pluginId missing', () => {
    const { comp } = createComponent();
    comp.pluginId = undefined;
    comp.getRepoToken();
    expect(
      notification.errors.some((e) => e.includes('Repository type is missing')),
    ).toBeTrue();
  });

  it('getRepoToken builds redirect url including dataset', () => {
    const { comp } = createComponent();
    comp.plugin = 'github';
    comp.pluginId = 'github';
    comp.repoName = 'owner/repo';
    comp.url = 'https://host';
    comp.datasetId = 'doi:10.123/XYZ';
    comp.dataverseToken = 'tok';
    comp.pluginIds = [{ label: 'GitHub', value: 'github', hidden: true }];
    comp.plugins = [{ label: 'GitHub', value: 'github' }];

    comp.getRepoToken();

    expect(navigation.assign).toHaveBeenCalled();
    const redirectUrl = navigation.assign.calls.mostRecent().args[0] as string;
    expect(redirectUrl).toContain('client_id=');
    const match = redirectUrl.match(/state=([^&]+)/);
    expect(match).toBeTruthy();
    const state = JSON.parse(decodeURIComponent(match![1]));
    expect(state.datasetId.value).toBe('doi:10.123/XYZ');
    expect(state.plugin.value).toBe('github');
  });

  it('getRepoToken opens new window when oauth client id missing', () => {
    pluginService.oauthClientId = '';
    const { comp } = createComponent();
    comp.plugin = 'github';
    comp.pluginId = 'github';
    comp.pluginIds = [{ label: 'GitHub', value: 'github' }];
    const openSpy = spyOn(window, 'open');
    comp.getRepoToken();
    expect(openSpy).toHaveBeenCalled();
  });

  it('parseUrl handles valid and invalid inputs', () => {
    const { comp } = createComponent();
    comp.pluginId = 'github';
    comp.sourceUrl = 'https://github.com/org/repo.git';
    const err = comp.parseUrl();
    expect(err).toBeUndefined();
    expect(comp.url).toBe('https://github.com');
    expect(comp.repoName).toBe('org/repo');

    comp.sourceUrl = 'invalid';
    const err2 = comp.parseUrl();
    expect(err2).toBe('Malformed source url');
  });

  // Note: handleGlobusCallback was removed from ConnectComponent.
  // Callback parsing is now handled by AppComponent which redirects to /connect with datasetPid.
  // See app.component.spec.ts for tests of parseGlobusCallback and redirect handling.

  it('restoreFromOauthState populates selections and fetches token', fakeAsync(() => {
    const { comp } = createComponent();
    const state = {
      plugin: { label: 'GitHub', value: 'github' },
      pluginId: { label: 'GitHub', value: 'github', hidden: false },
      repoName: 'owner/repo',
      option: { label: 'main', value: 'main' },
      datasetId: { label: 'doi:ABC', value: 'doi:ABC' },
      collectionId: { label: 'root:COLL', value: 'root:COLL' },
      nonce: 'nonce-123',
    };
    comp['restoreFromOauthState']({
      state: JSON.stringify(state),
      code: 'oauthCode',
    });
    expect(comp.plugin).toBe('github');
    expect(comp.pluginId).toBe('github');
    expect(comp.repoName).toBe('owner/repo');
    expect(comp.option).toBe('main');
    expect(comp.datasetId).toBe('doi:ABC');
    expect(comp.collectionId).toBe('root:COLL');
    expect(oauthService.lastArgs).toEqual({
      pluginId: 'github',
      code: 'oauthCode',
      nonce: 'nonce-123',
    });
    tick();
    expect(comp.token).toBe('session-123');
  }));

  it('getDvObjectOptions populates dropdowns and handles errors', fakeAsync(() => {
    dvLookup.items = [
      { label: 'Dataset A', value: 'doi:AAA' },
      { label: 'Dataset B', value: 'doi:BBB' },
    ];
    const { comp } = createComponent();
    comp['getDvObjectOptions'](
      'Dataset',
      comp.doiItems,
      (c: any, items: SelectItem<string>[]) => {
        c.doiItems = items;
      },
    );
    tick();
    expect(comp.doiItems.length).toBe(2);

    comp.doiItems = [];
    dvLookup.error = 'boom';
    comp['getDvObjectOptions'](
      'Dataset',
      comp.doiItems,
      (c: any, items: SelectItem<string>[]) => {
        c.doiItems = items;
      },
    );
    tick();
    expect(
      notification.errors.some((e) => e.includes('DOI lookup failed')),
    ).toBeTrue();
  }));

  it('getOptions populates branch items and handles nested nodes', fakeAsync(() => {
    repoLookup.options = [
      { label: 'opt1', value: 'o1' },
      { label: 'opt2', value: 'o2' },
    ];
    const { comp } = createComponent();
    comp.pluginId = 'github';
    comp.plugin = 'github';
    comp.repoName = 'owner/repo';
    comp.user = 'alice';
    comp.token = 'tok';
    comp.url = 'https://host';
    comp.sourceUrl = 'https://host/owner/repo';
    comp.option = undefined;
    comp.branchItems = [];
    const node: TreeNode<string> = {
      label: 'root',
      data: 'root',
      selectable: true,
    };
    comp.getOptions(node);
    tick();
    expect(node.children?.length).toBe(2);

    repoLookup.error = 'Bad request';
    comp.branchItems = [];
    comp.getOptions();
    tick();
    expect(
      notification.errors.some((e) => e.includes('Branch lookup failed')),
    ).toBeTrue();
    expect(comp.branchItems.length).toBe(0);
  }));

  it('optionSelected clears selection when value empty', () => {
    const { comp } = createComponent();
    comp.optionSelected({
      data: 'branch',
      selectable: true,
    } as TreeNode<string>);
    expect(comp.option).toBe('branch');
    expect(comp.selectedOption?.data).toBe('branch');
    comp.optionSelected({ data: '', selectable: true } as TreeNode<string>);
    expect(comp.option).toBeUndefined();
    expect(comp.selectedOption).toBeUndefined();
  });

  it('showReset reflects non-empty fields and performReset clears them', () => {
    const { comp } = createComponent();
    comp.plugin = 'github';
    expect(comp.showReset).toBeTrue();
    comp['performReset']();
    expect(comp.showReset).toBeFalse();
    expect(snapshot.cleared).toBeTrue();
  });

  it('isOptionFieldInteractive respects plugin configuration', () => {
    const { comp } = createComponent();
    expect(comp.isOptionFieldInteractive()).toBeTrue();
    pluginService.repoNameFieldInteractive = false;
    expect(comp.isOptionFieldInteractive()).toBeFalse();
  });

  it('validateUrlParsing enforces well-formed source URL', () => {
    const { comp } = createComponent();
    comp.sourceUrl = undefined;
    expect(comp['validateUrlParsing']()).toBe('Source URL is required');
    comp.sourceUrl = 'https://host/repo';
    expect(comp['validateUrlParsing']()).toBe('Malformed source url');
    comp.sourceUrl = 'https://host/owner/repo/path';
    expect(comp['validateUrlParsing']()).toBeUndefined();
  });

  it('repoNameSearch returns error placeholder when request invalid', async () => {
    const { comp } = createComponent();
    comp.pluginId = undefined;
    const results = await comp.repoNameSearch('owner');
    expect(results[0].value).toBe('error');
    expect(
      notification.errors.some((e) => e.includes('Repository type is missing')),
    ).toBeTrue();
  });

  it('startRepoSearch respects foundRepoName and init toggle', () => {
    const { comp } = createComponent();
    const existing = [...comp.repoNames];
    comp.foundRepoName = 'owner/repo';
    comp.startRepoSearch();
    expect(comp.repoNames).toEqual(existing);
    comp.foundRepoName = undefined;
    pluginService.repoNameFieldHasInit = false;
    comp.repoNames = [];
    comp.startRepoSearch();
    expect(comp.repoNames[0].label).toContain('start typing');
    pluginService.repoNameFieldHasInit = true;
  });

  it('getSourceUrlValue prefers plugin-provided defaults over user input', () => {
    pluginService.sourceUrlFieldValue = 'https://preconfigured';
    const { comp } = createComponent();
    comp.sourceUrl = 'https://user/provided';
    expect(comp.getSourceUrlValue()).toBe('https://preconfigured');
    pluginService.sourceUrlFieldValue = undefined;
  });

  it('getRepoName falls back from repoName to selected and found names', () => {
    const { comp } = createComponent();
    comp.repoName = undefined;
    comp.selectedRepoName = 'selected';
    comp.foundRepoName = 'found';
    expect(comp.getRepoName()).toBe('selected');
    comp.selectedRepoName = undefined;
    expect(comp.getRepoName()).toBe('found');
  });

  it('getOptions requests additional scopes via getRepoToken when signalled', fakeAsync(() => {
    const { comp } = createComponent();
    comp.plugin = 'github';
    comp.pluginId = 'github';
    comp.sourceUrl = 'https://host/owner/repo';
    comp.user = 'alice';
    comp.token = 'tok';
    comp.repoName = 'owner/repo';
    spyOn(comp, 'getRepoToken');
    spyOn(repoLookup, 'getOptions').and.returnValue(
      new Observable((observer) => {
        queueMicrotask(() =>
          observer.error({ error: '*scopes*repo:read*scopes*' }),
        );
      }),
    );
    comp.getOptions();
    tick();
    expect(comp.getRepoToken).toHaveBeenCalledWith('repo:read');
  }));

  it('getDvObjectOptions returns immediately when items already loaded', () => {
    const { comp } = createComponent();
    const spy = spyOn(dvLookup, 'getItems').and.callThrough();
    comp.doiItems = [{ label: 'Existing', value: 'doi:123' }];
    comp['getDvObjectOptions']('Dataset', comp.doiItems, comp.setDoiItems);
    expect(spy).not.toHaveBeenCalled();
  });

  it('setDoiItems preserves existing dataset selection even when missing from results', () => {
    const { comp } = createComponent();
    comp.datasetId = 'doi:missing';
    comp.doiItems = [];
    comp.setDoiItems(comp, [{ label: 'Existing dataset', value: 'doi:AAA' }]);
    expect(comp.doiItems[0].value).toBe('CREATE_NEW_DATASET');
    expect(
      comp.doiItems.some((i: any) => i.value === 'doi:missing'),
    ).toBeTrue();
  });

  it('newDataset avoids duplicating option when already present', () => {
    const { comp } = createComponent();
    comp.collectionId = 'root';
    const newValue = 'root:New Dataset';
    comp.doiItems = [
      { label: 'New Dataset', value: newValue },
      { label: '+ Create new dataset', value: 'CREATE_NEW_DATASET' },
    ];
    comp.newDataset();
    expect(comp.doiItems.filter((i: any) => i.value === newValue).length).toBe(
      1,
    );
  });

  it('isNewDatasetId detects colon-prefixed values', () => {
    const { comp } = createComponent();
    expect(comp['isNewDatasetId']('root:New Dataset')).toBeTrue();
    expect(comp['isNewDatasetId']('New Dataset')).toBeTrue();
    expect(comp['isNewDatasetId']('root:Other')).toBeFalse();
  });

  it('onCollectionSearch handles short input and emits search term for valid queries', () => {
    const { comp } = createComponent();
    const nextSpy = spyOn(comp.collectionSearchSubject, 'next');

    comp.onCollectionSearch(null);
    expect(comp.collectionItems[0].value).toBe('start');
    expect(nextSpy).not.toHaveBeenCalled();

    comp.onCollectionSearch('ab');
    expect(comp.collectionItems[0].value).toBe('start');
    expect(nextSpy).not.toHaveBeenCalled();

    comp.onCollectionSearch('term');
    expect(comp.collectionItems[0].label).toContain('searching "term"');
    expect(comp.collectionItems[0].value).toBe('term');
    expect(nextSpy).toHaveBeenCalledOnceWith('term');
  });

  it('collectionSearch delegates to DV lookup service with current selection', async () => {
    dvLookup.items = [
      { label: 'Coll A', value: 'root:A' },
      { label: 'Coll B', value: 'root:B' },
    ];
    const { comp } = createComponent();
    comp.collectionId = 'root:BASE';
    comp.dataverseToken = 'dvTok';

    const items = await comp.collectionSearch('term');
    expect(items).toEqual(dvLookup.items);
  });

  it('onDatasetSearch guards short inputs and triggers search subject otherwise', () => {
    const { comp } = createComponent();
    const nextSpy = spyOn(comp.datasetSearchSubject, 'next');

    comp.onDatasetSearch(null);
    expect(comp.doiItems[0].value).toBe('start');
    expect(nextSpy).not.toHaveBeenCalled();

    comp.onDatasetSearch('xy');
    expect(comp.doiItems[0].value).toBe('start');
    expect(nextSpy).not.toHaveBeenCalled();

    comp.onDatasetSearch('term');
    expect(comp.doiItems[0].label).toContain('searching "term"');
    expect(comp.doiItems[0].value).toBe('term');
    expect(nextSpy).toHaveBeenCalledOnceWith('term');
  });

  it('datasetSearch prepends create new dataset option to lookup results', async () => {
    dvLookup.items = [
      { label: 'Dataset 1', value: 'doi:1' },
      { label: 'Dataset 2', value: 'doi:2' },
    ];
    const { comp } = createComponent();
    comp.collectionId = 'root:COLL';

    const items = await comp.datasetSearch('sample');
    expect(items[0].value).toBe('CREATE_NEW_DATASET');
    expect(items.slice(1)).toEqual(dvLookup.items);
  });

  it('onDatasetSelectionChange handles create-new sentinel and explicit selections', fakeAsync(() => {
    const { comp } = createComponent();
    comp.collectionId = 'root:COLL';
    comp.doiItems = [
      { label: '+ Create new dataset', value: 'CREATE_NEW_DATASET' },
      { label: 'Existing', value: 'doi:123' },
    ];
    const newDatasetSpy = spyOn(comp, 'newDataset').and.callThrough();

    comp.onDatasetSelectionChange({ value: 'CREATE_NEW_DATASET' });
    expect(newDatasetSpy).toHaveBeenCalled();
    expect(comp.datasetId).toContain('root:COLL');
    expect(comp.showNewDatasetCreatedMessage).toBeTrue();

    tick(3000);
    expect(comp.showNewDatasetCreatedMessage).toBeFalse();

    const previousValue = comp.datasetId;
    comp.onDatasetSelectionChange({ value: 'doi:567' });
    expect(comp.showNewDatasetCreatedMessage).toBeFalse();
    expect(comp.datasetId).toBe(previousValue);
  }));
});
