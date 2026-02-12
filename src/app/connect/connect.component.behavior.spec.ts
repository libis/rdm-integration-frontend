import {
  provideHttpClient,
  withInterceptorsFromDi,
} from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { signal } from '@angular/core';
import {
  TestBed,
} from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { SelectItem } from 'primeng/api';
import { of, throwError } from 'rxjs';
import { CredentialsService } from '../credentials.service';
import { DataStateService } from '../data.state.service';
import { DatasetService } from '../dataset.service';
import { DvObjectLookupService } from '../dvobject.lookup.service';
import { OauthService } from '../oauth.service';
import { PluginService } from '../plugin.service';
import { RepoLookupService } from '../repo.lookup.service';
import { ConnectValidationService } from '../shared/connect-validation.service';
import { NotificationService } from '../shared/notification.service';
import { SnapshotStorageService } from '../shared/snapshot-storage.service';
import { ConnectComponent } from './connect.component';

class DataStateServiceStub {
  initializeState(_creds?: any) {}
  resetState() {}
  cancelInitialization(_resetState?: boolean) {}
}

class PluginServiceStub {
  pluginIds: SelectItem[] = [];
  pluginList: SelectItem[] = [];
  pluginConfig: any = {
    tokenGetter: {},
    repoNameFieldHasSearch: false,
    parseSourceUrlField: true,
    repoNameFieldName: 'Repository',
    repoNameFieldEditable: true,
    sourceUrlFieldName: 'Source URL',
    sourceUrlFieldPlaceholder: 'https://host/owner/repo',
    sourceUrlFieldValue: undefined,
    optionFieldInteractive: false,
    usernameFieldName: 'Username',
    tokenFieldName: 'Token',
    tokenFieldPlaceholder: 'token',
    datasetFieldEditable: true,
    repoNameFieldPlaceholder: 'owner/repo',
    showTokenGetter: false,
    repoNameFieldHasInit: false,
  };
  setConfig() {
    return Promise.resolve();
  }
  getPlugins() {
    return this.pluginList;
  }
  getPluginIds() {
    return this.pluginIds;
  }
  getPlugin() {
    return this.pluginConfig as any;
  }
  dataverseHeader() {
    return 'Dataverse';
  }
  showDVTokenGetter() {
    return false;
  }
  showDVToken() {
    return false;
  }
  isStoreDvToken() {
    return false;
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
    return '';
  }
  getExternalURL() {
    return '';
  }
  getGlobusPlugin() {
    return undefined;
  }

  // Signal properties for computed signal consumers
  dataverseHeader$ = signal('Dataverse').asReadonly();
  showDVTokenGetter$ = signal(false).asReadonly();
  showDVToken$ = signal(false).asReadonly();
  collectionOptionsHidden$ = signal(false).asReadonly();
  collectionFieldEditable$ = signal(true).asReadonly();
  datasetFieldEditable$ = signal(true).asReadonly();
  createNewDatasetEnabled$ = signal(true).asReadonly();
  externalURL$ = signal('').asReadonly();
}

class RepoLookupServiceStub {
  searchSpy = jasmine.createSpy('search').and.returnValue(of([]));
  optionsSpy = jasmine.createSpy('getOptions').and.returnValue(of([]));

  search(req: unknown) {
    return this.searchSpy(req);
  }

  getOptions(req: unknown) {
    return this.optionsSpy(req);
  }
}

class SnapshotStorageServiceStub {
  cleared = false;
  snapshot: unknown;

  loadConnect() {
    return this.snapshot;
  }

  saveConnect(data: unknown) {
    this.snapshot = data;
  }

  clearConnect() {
    this.cleared = true;
    this.snapshot = undefined;
  }
}

class DatasetServiceStub {
  getDatasetVersion() {
    return of({ persistentId: 'doi:10.123/XYZ' });
  }
}

class DvObjectLookupServiceStub {
  getItems() {
    return of([]);
  }
}

class OauthServiceStub {
  getToken() {
    return of({ session_id: 'session' });
  }
}

class NotificationServiceStub {
  errors: string[] = [];
  showError(msg: string) {
    this.errors.push(msg);
  }
}

class ConnectValidationServiceStub {
  valid = true;
  issues: string[] = [];
  isValid(_ctx: any) {
    return this.valid;
  }
  gatherIssues(_ctx: any) {
    return this.issues;
  }
  summarizeIssues(issues: string[]) {
    return issues.length ? issues.join('; ') : undefined;
  }
}

describe('ConnectComponent additional behavior/validation', () => {
  let notification: NotificationServiceStub;
  let validation: ConnectValidationServiceStub;
  let pluginService: PluginServiceStub;
  let repoLookup: RepoLookupServiceStub;
  let snapshotStorage: SnapshotStorageServiceStub;
  let credentialsService: CredentialsService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ConnectComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
        { provide: PluginService, useClass: PluginServiceStub },
        { provide: NotificationService, useClass: NotificationServiceStub },
        {
          provide: ConnectValidationService,
          useClass: ConnectValidationServiceStub,
        },
        { provide: DataStateService, useClass: DataStateServiceStub },
        { provide: RepoLookupService, useClass: RepoLookupServiceStub },
        {
          provide: SnapshotStorageService,
          useClass: SnapshotStorageServiceStub,
        },
        { provide: DatasetService, useClass: DatasetServiceStub },
        { provide: DvObjectLookupService, useClass: DvObjectLookupServiceStub },
        { provide: OauthService, useClass: OauthServiceStub },
      ],
    }).compileComponents();
    notification = TestBed.inject(
      NotificationService,
    ) as unknown as NotificationServiceStub;
    validation = TestBed.inject(
      ConnectValidationService,
    ) as unknown as ConnectValidationServiceStub;
    pluginService = TestBed.inject(
      PluginService,
    ) as unknown as PluginServiceStub;
    repoLookup = TestBed.inject(
      RepoLookupService,
    ) as unknown as RepoLookupServiceStub;
    snapshotStorage = TestBed.inject(
      SnapshotStorageService,
    ) as unknown as SnapshotStorageServiceStub;
    credentialsService = TestBed.inject(CredentialsService);
  });

  it('newNonce produces string of expected length', () => {
    const comp = TestBed.createComponent(ConnectComponent)
      .componentInstance as any;
    const nonce = comp.newNonce(32);
    expect(nonce.length).toBe(32);
    const nonce2 = comp.newNonce(32);
    expect(nonce2).not.toBe(nonce); // very small probability of collision
  });

  it('connect button classes react to validation state', async () => {
    // First, test with invalid state
    validation.valid = false;
    let fixture = TestBed.createComponent(ConnectComponent);
    let comp: any = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    expect(comp.isConnectReady()).toBeFalse();
    expect(comp.connectButtonClass()).toContain('p-button-secondary');

    // Destroy and recreate to test valid state (computed signals don't track plain object properties)
    fixture.destroy();
    validation.valid = true;
    fixture = TestBed.createComponent(ConnectComponent);
    comp = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    expect(comp.isConnectReady()).toBeTrue();
    expect(comp.connectButtonClass()).toContain('p-button-primary');
  });

  it('getRepoLookupRequest emits errors in expected order for missing fields and succeeds once populated', () => {
    const fixture = TestBed.createComponent(ConnectComponent);
    const comp: any = fixture.componentInstance;
    fixture.detectChanges();

    // Ensure a clean slate regardless of any restored snapshot side-effects
    comp.pluginId.set(undefined);
    comp.sourceUrl.set(undefined);
    comp.user.set(undefined);
    comp.token.set(undefined);
    comp.repoName.set(undefined);
    comp.branchItems.set([]);

    // 1. Missing pluginId
    let req = comp.getRepoLookupRequest(true);
    expect(req).toBeUndefined();
    expect(notification.errors.pop()).toContain('Repository type is missing');

    // Populate pluginId to continue
    comp.pluginId.set('github');

    // 2. Malformed source URL
    comp.sourceUrl.set('not-a-url');
    req = comp.getRepoLookupRequest(true);
    expect(req).toBeUndefined();
    expect(notification.errors.pop()).toContain('Malformed source url');

    // 3. Provide valid source URL - still missing username
    comp.sourceUrl.set('https://host/owner/repo');
    req = comp.getRepoLookupRequest(true);
    expect(req).toBeUndefined();
    expect(notification.errors.pop()).toContain('Username is missing');

    // 4. Provide username - next missing requirement is token (as per current implementation order)
    comp.user.set('alice');
    // Force parseUrl to populate internal url and repoName
    comp.parseUrl();
    // Simulate user cleared repo name afterwards
    comp.repoName.set(undefined);
    req = comp.getRepoLookupRequest(false); // expect token missing before repo name validation surfaces
    expect(req).toBeUndefined();
    expect(notification.errors.pop()).toContain('Token is missing');
    // 5. Provide token now; parseUrl repopulates repo name so request succeeds
    comp.token.set('tok');
    req = comp.getRepoLookupRequest(false);
    expect(req).toBeDefined();

    // 6. Simulate existing branchItems causing early return for subsequent search request
    comp.branchItems.set([{ label: 'main', value: 'main' }]);
    req = comp.getRepoLookupRequest(true);
    expect(req).toBeUndefined();

    // 7. Allow normal path (clear branchItems so request proceeds)
    comp.branchItems.set([]);
    req = comp.getRepoLookupRequest(true);
    expect(req).toBeDefined();
    expect(req.pluginId).toBe('github');
    expect(comp.branchItems().length).toBeGreaterThan(0); // set to loading state
  });

  it('newDataset creates and selects dataset with collection prefix and inserts option once', () => {
    const fixture = TestBed.createComponent(ConnectComponent);
    const comp: any = fixture.componentInstance;
    comp.collectionId.set('root:COLL');
    comp.doiItems.set([
      { label: '+ Create new dataset', value: 'CREATE_NEW_DATASET' },
      { label: 'doi:10.123/ABC', value: 'doi:10.123/ABC' },
    ] as SelectItem<string>[]);
    fixture.detectChanges();
    comp.newDataset();
    expect(comp.datasetId()).toBe('root:COLL:New Dataset');
    const matches = comp
      .doiItems()
      .filter((i: any) => i.value === 'root:COLL:New Dataset');
    expect(matches.length).toBe(1);
  });

  it('onDatasetSelectionChange triggers new dataset creation flow and hides message after timeout', () => {
    jasmine.clock().install();
    try {
      const fixture = TestBed.createComponent(ConnectComponent);
      const comp: any = fixture.componentInstance;
      comp.collectionId.set('root:COLL');
      comp.doiItems.set([
        { label: '+ Create new dataset', value: 'CREATE_NEW_DATASET' },
      ]);
      fixture.detectChanges();
      comp.onDatasetSelectionChange({ value: 'CREATE_NEW_DATASET' });
      expect(comp.datasetId()).toContain('root:COLL:New Dataset');
      expect(comp.showNewDatasetCreatedMessage()).toBeTrue();
      jasmine.clock().tick(3000);
      expect(comp.showNewDatasetCreatedMessage()).toBeFalse();
    } finally {
      jasmine.clock().uninstall();
    }
  });

  it('applySnapshot respects existing datasetId (precedence)', () => {
    const fixture = TestBed.createComponent(ConnectComponent);
    const comp: any = fixture.componentInstance;
    comp.datasetId.set('existing');
    comp['applySnapshot']({ dataset_id: 'snapVal' }, 'navVal', 'colNav');
    expect(comp.datasetId()).toBe('existing');
  });

  it('applySnapshot dataset precedence chooses navigation over snapshot when empty current', () => {
    const fixture = TestBed.createComponent(ConnectComponent);
    const comp: any = fixture.componentInstance;
    comp['applySnapshot']({ dataset_id: 'snapVal' }, 'navVal', undefined);
    expect(comp.datasetId()).toBe('navVal');
  });

  it('connect sets newly_created=true for prefixed new dataset id', () => {
    const fixture = TestBed.createComponent(ConnectComponent);
    const comp: any = fixture.componentInstance;
    // Minimal fields for connect; validation stub returns valid regardless
    comp.pluginId.set('github');
    comp.plugin.set('github');
    comp.datasetId.set('root:COLL:New Dataset');
    const httpMock = TestBed.inject(HttpTestingController);

    comp.connect();
    const req = httpMock.expectOne('api/common/useremail');
    expect(req.request.method).toBe('POST');
    req.flush('user@example.com');

    expect(credentialsService.newlyCreated$()).toBeTrue();
  });

  it('deep-link with datasetPid/apiToken clears previous snapshot and preserves only explicit values', async () => {
    // Pre-populate snapshot with fields that should be cleared
    sessionStorage.setItem(
      'rdm-connect-snapshot',
      JSON.stringify({
        plugin: 'github',
        pluginId: 'github',
        user: 'alice',
        token: 'secret',
        repo_name: 'owner/repo',
        dataset_id: 'doi:10.OLD/SHOULD_NOT_RESTORE',
      }),
    );

    // Provide query params simulating deep link
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [ConnectComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
        { provide: PluginService, useClass: PluginServiceStub },
        { provide: NotificationService, useClass: NotificationServiceStub },
        {
          provide: ConnectValidationService,
          useClass: ConnectValidationServiceStub,
        },
        { provide: DataStateService, useClass: DataStateServiceStub },
        {
          provide: ActivatedRoute,
          useValue: {
            queryParams: of({
              datasetPid: 'doi:10.999/DEEP',
              apiToken: 'tok123',
            }),
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(ConnectComponent);
    fixture.detectChanges();
    await new Promise<void>(r => setTimeout(r)); // flush async setConfig promise
    const comp: any = fixture.componentInstance;

    // Explicit deep-link values applied
    expect(comp.datasetId()).toBe('doi:10.999/DEEP');
    expect(comp.dataverseToken()).toBe('tok123');
    // All previously persisted fields cleared
    expect(comp.plugin()).toBeUndefined();
    expect(comp.pluginId()).toBeUndefined();
    expect(comp.user()).toBeUndefined();
    expect(comp.token()).toBeUndefined();
    expect(comp.repoName()).toBeUndefined();
    // Session storage cleared
    expect(sessionStorage.getItem('rdm-connect-snapshot')).toBeNull();
  });

  it('explicit reset query param clears snapshot and all fields including datasetId', async () => {
    sessionStorage.setItem(
      'rdm-connect-snapshot',
      JSON.stringify({
        plugin: 'gitlab',
        pluginId: 'gitlab',
        dataset_id: 'doi:10.X/OLD',
      }),
    );
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [ConnectComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
        { provide: PluginService, useClass: PluginServiceStub },
        { provide: NotificationService, useClass: NotificationServiceStub },
        {
          provide: ConnectValidationService,
          useClass: ConnectValidationServiceStub,
        },
        { provide: DataStateService, useClass: DataStateServiceStub },
        {
          provide: ActivatedRoute,
          useValue: { queryParams: of({ reset: '1' }) },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(ConnectComponent);
    fixture.detectChanges();
    await new Promise<void>(r => setTimeout(r));
    const comp: any = fixture.componentInstance;
    expect(comp.datasetId()).toBeUndefined();
    expect(comp.plugin()).toBeUndefined();
    expect(sessionStorage.getItem('rdm-connect-snapshot')).toBeNull();
  });

  it('validateUrl requires complete repo path', () => {
    const comp = TestBed.createComponent(ConnectComponent)
      .componentInstance as any;
    // Set pluginId so validation is active (plugin config has parseSourceUrlField)
    comp.pluginId.set('github');
    comp.sourceUrl.set(undefined);
    expect(comp.validateUrl()).toBe('Malformed source url'); // undefined source is malformed
    comp.sourceUrl.set('https://host/only');
    expect(comp.validateUrl()).toBe('Malformed source url');
    comp.sourceUrl.set('https://host/owner/repo');
    expect(comp.validateUrl()).toBeUndefined();
  });

  it('changePlugin handles single and multiple plugin ids', () => {
    pluginService.pluginIds = [{ label: 'GitHub', value: 'github' }];
    pluginService.pluginList = [{ label: 'GitHub', value: 'github' }];
    const fixture = TestBed.createComponent(ConnectComponent);
    const comp: any = fixture.componentInstance;
    comp.plugin.set('github');
    comp.token.set('tok');
    comp.sourceUrl.set('https://host/owner/repo');
    comp.changePlugin();
    expect(comp.pluginId()).toBe('github');
    expect(comp.token()).toBeUndefined();
    expect(comp.pluginIdSelectHidden()).toBeTrue();

    pluginService.pluginIds = [
      { label: 'GitHub', value: 'github' },
      { label: 'GitLab', value: 'gitlab' },
    ];
    comp.pluginId.set(undefined);
    comp.changePlugin();
    expect(comp.pluginId()).toBeUndefined();
    expect(comp.pluginIdSelectHidden()).toBeFalse();
  });

  it('resetForm clears all bindable fields and hides reset indicator', () => {
    const fixture = TestBed.createComponent(ConnectComponent);
    const comp: any = fixture.componentInstance;
    comp.plugin.set('github');
    comp.datasetId.set('doi:123');
    expect(comp.showReset()).toBeTrue();
    comp.resetForm();
    expect(comp.showReset()).toBeFalse();
    expect(comp.datasetId()).toBeUndefined();
    expect(comp.plugins().length).toBe(0);
    expect(comp.pluginIdSelectHidden()).toBeTrue();
  });

  it('repoNameSearch handles service errors by presenting failure message', async () => {
    pluginService.pluginConfig.repoNameFieldHasSearch = true;
    pluginService.pluginConfig.parseSourceUrlField = true;
    pluginService.pluginIds = [{ label: 'GitHub', value: 'github' }];
    pluginService.pluginList = [{ label: 'GitHub', value: 'github' }];
    repoLookup.searchSpy.and.returnValue(throwError(() => new Error('boom')));

    const fixture = TestBed.createComponent(ConnectComponent);
    const comp: any = fixture.componentInstance;
    fixture.detectChanges();
    await new Promise<void>(r => setTimeout(r));

    comp.plugin.set('github');
    comp.pluginId.set('github');
    comp.sourceUrl.set('https://host/owner/repo');
    comp.user.set('alice');
    comp.token.set('tok');

    comp.startRepoSearch();
    comp.onRepoNameSearch('repo');
    await new Promise<void>(r => setTimeout(r, comp.DEBOUNCE_TIME + 100));
    await new Promise<void>(r => setTimeout(r));

    expect(repoLookup.searchSpy).toHaveBeenCalled();
    expect(comp.repoNames()[0].label).toContain('search failed: boom');
  });

  it('getOptions requests oauth scopes when branch lookup returns scopes marker', () => {
    pluginService.pluginConfig.repoNameFieldHasSearch = true;
    pluginService.pluginConfig.parseSourceUrlField = true;
    pluginService.pluginConfig.optionFieldInteractive = true;
    repoLookup.optionsSpy.and.returnValue(
      throwError(() => ({ error: '*scopes*repo.read*scopes*' })),
    );

    const fixture = TestBed.createComponent(ConnectComponent);
    const comp: any = fixture.componentInstance;
    fixture.detectChanges();

    spyOn(comp, 'getRepoToken');

    comp.plugin.set('github');
    comp.pluginId.set('github');
    comp.sourceUrl.set('https://host/owner/repo');
    comp.user.set('alice');
    comp.token.set('tok');
    comp.repoName.set('owner/repo');

    comp.getOptions();

    expect(comp.getRepoToken).toHaveBeenCalledOnceWith('repo.read');
  });

  it('getOptions surfaces errors and resets state when scopes marker missing', () => {
    repoLookup.optionsSpy.and.returnValue(
      throwError(() => ({ error: 'network offline' })),
    );

    const fixture = TestBed.createComponent(ConnectComponent);
    const comp: any = fixture.componentInstance;
    fixture.detectChanges();

    comp.plugin.set('github');
    comp.pluginId.set('github');
    comp.sourceUrl.set('https://host/owner/repo');
    comp.user.set('alice');
    comp.token.set('tok');
    comp.repoName.set('owner/repo');
    comp.branchItems.set([]);
    comp.option.set(undefined);
    comp.optionsLoading.set(true);

    comp.getOptions();

    expect(notification.errors.pop()).toBe(
      'Branch lookup failed: network offline',
    );
    expect(comp.branchItems()).toEqual([]);
    expect(comp.option()).toBeUndefined();
    expect(comp.optionsLoading()).toBeFalse();
  });

  it('setDoiItems clears datasetId when existing selection is placeholder', () => {
    const fixture = TestBed.createComponent(ConnectComponent);
    const comp: any = fixture.componentInstance;
    comp.datasetId.set('CREATE_NEW_DATASET');
    comp.doiItems.set([]);

    comp.setDoiItems(comp, [{ label: 'doi:1', value: 'doi:1' }]);

    expect(comp.datasetId()).toBeUndefined();
    expect(comp.doiItems()[0].value).toBe('CREATE_NEW_DATASET');
    expect(comp.doiItems().length).toBeGreaterThan(1);
  });

  it('restoreFromDatasetPid clears snapshot and seeds dataset list with provided pid', () => {
    const fixture = TestBed.createComponent(ConnectComponent);
    const comp: any = fixture.componentInstance;

    comp.plugins.set([{ label: 'GitHub', value: 'github' }]);
    comp.pluginIds.set([{ label: 'GitHub', value: 'github' }]);
    comp.repoNames.set([{ label: 'owner/repo', value: 'owner/repo' }]);
    comp.branchItems.set([{ label: 'main', value: 'main' }]);
    comp.collectionItems.set([{ label: 'root', value: 'root' }]);
    comp.doiItems.set([]);
    comp.dataverseToken.set('old');

    comp['restoreFromDatasetPid']({
      datasetPid: 'doi:10.123/NEW',
      apiToken: 'newtoken',
    });

    expect(snapshotStorage.cleared).toBeTrue();
    expect(comp.plugins()).toEqual([]);
    expect(comp.branchItems()).toEqual([]);
    expect(comp.datasetId()).toBe('doi:10.123/NEW');
    expect(comp.dataverseToken()).toBe('newtoken');
    expect(comp.doiItems().some((i: any) => i.value === 'doi:10.123/NEW')).toBe(
      true,
    );
  });

  it('getOptions auto-selects item when backend returns selected:true on tree node expand', () => {
    // Configure plugin to use interactive tree options (like Globus)
    pluginService.pluginConfig.optionFieldInteractive = true;
    pluginService.pluginConfig.parseSourceUrlField = false;
    pluginService.pluginConfig.sourceUrlFieldValue =
      'https://transfer.api.globus.org/v0.10';

    // Backend returns items with one marked as selected (e.g., default folder)
    const itemsWithSelected = [
      { label: '3DMark', value: '/C/Users/ErykK/Documents/3DMark/' },
      { label: 'Garmin', value: '/C/Users/ErykK/Documents/Garmin/' },
      {
        label: 'globus download',
        value: '/C/Users/ErykK/Documents/globus download/',
        selected: true,
      },
      { label: 'MAXON', value: '/C/Users/ErykK/Documents/MAXON/' },
    ];
    repoLookup.optionsSpy.and.returnValue(of(itemsWithSelected));

    const fixture = TestBed.createComponent(ConnectComponent);
    const comp: any = fixture.componentInstance;
    fixture.detectChanges();

    // Setup required fields
    comp.plugin.set('globus');
    comp.pluginId.set('globus');
    comp.sourceUrl.set('https://transfer.api.globus.org/v0.10');
    comp.user.set('user');
    comp.token.set('tok');
    comp.repoName.set('endpoint-id');

    // Create a parent node to expand (simulating tree node expansion)
    const parentNode: any = {
      label: 'Documents',
      data: '/C/Users/ErykK/Documents/',
      children: [],
    };

    // Call getOptions with a node (simulating tree expansion)
    comp.getOptions(parentNode);

    // After getOptions completes, the node should have children
    expect(parentNode.children.length).toBe(4);
    expect(parentNode.children[0].label).toBe('3DMark');
    expect(parentNode.children[2].label).toBe('globus download');

    // The item with selected:true should be auto-selected
    expect(comp.selectedOption()).toBeDefined();
    expect(comp.selectedOption().label).toBe('globus download');
    expect(comp.selectedOption().data).toBe(
      '/C/Users/ErykK/Documents/globus download/',
    );
    expect(comp.option()).toBe('/C/Users/ErykK/Documents/globus download/');
  });
});
