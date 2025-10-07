import {
    provideHttpClient,
    withInterceptorsFromDi,
} from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ActivatedRoute } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { SelectItem } from 'primeng/api';
import { of } from 'rxjs';
import { DataStateService } from '../data.state.service';
import { PluginService } from '../plugin.service';
import { ConnectValidationService } from '../shared/connect-validation.service';
import { NotificationService } from '../shared/notification.service';
import { ConnectComponent } from './connect.component';

class DataStateServiceStub {
  lastCreds: any;
  initializeState(creds: any) {
    this.lastCreds = creds;
  }
}

class PluginServiceStub {
  pluginIds: SelectItem[] = [];
  pluginList: SelectItem[] = [];
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
    return {
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
    } as any;
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
  isStoreDvToken() {
    return false;
  }
  getGlobusPlugin() {
    return undefined;
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

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RouterTestingModule, ConnectComponent],
      providers: [
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
        provideNoopAnimations(),
        { provide: PluginService, useClass: PluginServiceStub },
        { provide: NotificationService, useClass: NotificationServiceStub },
        {
          provide: ConnectValidationService,
          useClass: ConnectValidationServiceStub,
        },
        { provide: DataStateService, useClass: DataStateServiceStub },
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
  });

  it('newNonce produces string of expected length', () => {
    const comp = TestBed.createComponent(ConnectComponent)
      .componentInstance as any;
    const nonce = comp.newNonce(32);
    expect(nonce.length).toBe(32);
    const nonce2 = comp.newNonce(32);
    expect(nonce2).not.toBe(nonce); // very small probability of collision
  });

  it('connect button classes react to validation state', () => {
    const fixture = TestBed.createComponent(ConnectComponent);
    const comp: any = fixture.componentInstance;
    validation.valid = false;
    fixture.detectChanges();
    expect(comp.isConnectReady).toBeFalse();
    expect(comp.connectButtonClass).toContain('p-button-secondary');
    validation.valid = true;
    // trigger change detection again
    fixture.detectChanges();
    expect(comp.isConnectReady).toBeTrue();
    expect(comp.connectButtonClass).toContain('p-button-primary');
  });

  it('getRepoLookupRequest emits errors in expected order for missing fields and succeeds once populated', () => {
    const fixture = TestBed.createComponent(ConnectComponent);
    const comp: any = fixture.componentInstance;
    fixture.detectChanges();

    // Ensure a clean slate regardless of any restored snapshot side-effects
    comp.pluginId = undefined;
    comp.sourceUrl = undefined;
    comp.user = undefined;
    comp.token = undefined;
    comp.repoName = undefined;
    comp.branchItems = [];

    // 1. Missing pluginId
    let req = comp.getRepoLookupRequest(true);
    expect(req).toBeUndefined();
    expect(notification.errors.pop()).toContain('Repository type is missing');

    // Populate pluginId to continue
    comp.pluginId = 'github';

    // 2. Malformed source URL
    comp.sourceUrl = 'not-a-url';
    req = comp.getRepoLookupRequest(true);
    expect(req).toBeUndefined();
    expect(notification.errors.pop()).toContain('Malformed source url');

    // 3. Provide valid source URL - still missing username
    comp.sourceUrl = 'https://host/owner/repo';
    req = comp.getRepoLookupRequest(true);
    expect(req).toBeUndefined();
    expect(notification.errors.pop()).toContain('Username is missing');

    // 4. Provide username - next missing requirement is token (as per current implementation order)
    comp.user = 'alice';
    // Force parseUrl to populate internal url and repoName
    comp.parseUrl();
    // Simulate user cleared repo name afterwards
    comp.repoName = undefined;
    req = comp.getRepoLookupRequest(false); // expect token missing before repo name validation surfaces
    expect(req).toBeUndefined();
    expect(notification.errors.pop()).toContain('Token is missing');
    // 5. Provide token now; parseUrl repopulates repo name so request succeeds
    comp.token = 'tok';
    req = comp.getRepoLookupRequest(false);
    expect(req).toBeDefined();

    // 6. Simulate existing branchItems causing early return for subsequent search request
    comp.branchItems = [{ label: 'main', value: 'main' }];
    req = comp.getRepoLookupRequest(true);
    expect(req).toBeUndefined();

    // 7. Allow normal path (clear branchItems so request proceeds)
    comp.branchItems = [];
    req = comp.getRepoLookupRequest(true);
    expect(req).toBeDefined();
    expect(req.pluginId).toBe('github');
    expect(comp.branchItems.length).toBeGreaterThan(0); // set to loading state
  });

  it('newDataset creates and selects dataset with collection prefix and inserts option once', () => {
    const fixture = TestBed.createComponent(ConnectComponent);
    const comp: any = fixture.componentInstance;
    comp.collectionId = 'root:COLL';
    comp.doiItems = [
      { label: '+ Create new dataset', value: 'CREATE_NEW_DATASET' },
      { label: 'doi:10.123/ABC', value: 'doi:10.123/ABC' },
    ] as SelectItem<string>[];
    fixture.detectChanges();
    comp.newDataset();
    expect(comp.datasetId).toBe('root:COLL:New Dataset');
    const matches = comp.doiItems.filter(
      (i: any) => i.value === 'root:COLL:New Dataset',
    );
    expect(matches.length).toBe(1);
  });

  it('onDatasetSelectionChange triggers new dataset creation flow and hides message after timeout', fakeAsync(() => {
    const fixture = TestBed.createComponent(ConnectComponent);
    const comp: any = fixture.componentInstance;
    comp.collectionId = 'root:COLL';
    comp.doiItems = [
      { label: '+ Create new dataset', value: 'CREATE_NEW_DATASET' },
    ];
    fixture.detectChanges();
    comp.onDatasetSelectionChange({ value: 'CREATE_NEW_DATASET' });
    expect(comp.datasetId).toContain('root:COLL:New Dataset');
    expect(comp.showNewDatasetCreatedMessage).toBeTrue();
    tick(3000);
    expect(comp.showNewDatasetCreatedMessage).toBeFalse();
  }));

  it('applySnapshot respects existing datasetId (precedence)', () => {
    const fixture = TestBed.createComponent(ConnectComponent);
    const comp: any = fixture.componentInstance;
    comp.datasetId = 'existing';
    comp['applySnapshot']({ dataset_id: 'snapVal' }, 'navVal', 'colNav');
    expect(comp.datasetId).toBe('existing');
  });

  it('applySnapshot dataset precedence chooses navigation over snapshot when empty current', () => {
    const fixture = TestBed.createComponent(ConnectComponent);
    const comp: any = fixture.componentInstance;
    comp['applySnapshot']({ dataset_id: 'snapVal' }, 'navVal', undefined);
    expect(comp.datasetId).toBe('navVal');
  });

  it('connect sets newly_created=true for prefixed new dataset id', () => {
    const fixture = TestBed.createComponent(ConnectComponent);
    const comp: any = fixture.componentInstance;
    // Minimal fields for connect; validation stub returns valid regardless
    comp.pluginId = 'github';
    comp.plugin = 'github';
    comp.datasetId = 'root:COLL:New Dataset';
    const httpMock = TestBed.inject(HttpTestingController);
    const ds = TestBed.inject(
      DataStateService,
    ) as unknown as DataStateServiceStub;

    comp.connect();
    const req = httpMock.expectOne('api/common/useremail');
    expect(req.request.method).toBe('POST');
    req.flush('user@example.com');

    expect(ds.lastCreds).toBeDefined();
    expect(ds.lastCreds.newly_created).toBeTrue();
  });

  it('deep-link with datasetPid/apiToken clears previous snapshot and preserves only explicit values', fakeAsync(() => {
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
      imports: [RouterTestingModule, ConnectComponent],
      providers: [
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
        provideNoopAnimations(),
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
    tick(); // flush async setConfig promise
    const comp: any = fixture.componentInstance;

    // Explicit deep-link values applied
    expect(comp.datasetId).toBe('doi:10.999/DEEP');
    expect(comp.dataverseToken).toBe('tok123');
    // All previously persisted fields cleared
    expect(comp.plugin).toBeUndefined();
    expect(comp.pluginId).toBeUndefined();
    expect(comp.user).toBeUndefined();
    expect(comp.token).toBeUndefined();
    expect(comp.repoName).toBeUndefined();
    // Session storage cleared
    expect(sessionStorage.getItem('rdm-connect-snapshot')).toBeNull();
  }));

  it('explicit reset query param clears snapshot and all fields including datasetId', fakeAsync(() => {
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
      imports: [RouterTestingModule, ConnectComponent],
      providers: [
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
        provideNoopAnimations(),
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
    tick();
    const comp: any = fixture.componentInstance;
    expect(comp.datasetId).toBeUndefined();
    expect(comp.plugin).toBeUndefined();
    expect(sessionStorage.getItem('rdm-connect-snapshot')).toBeNull();
  }));

  it('validateUrlParsing requires complete repo path', () => {
    const comp = TestBed.createComponent(ConnectComponent)
      .componentInstance as any;
    comp.sourceUrl = undefined;
    expect(comp['validateUrlParsing']()).toBe('Source URL is required');
    comp.sourceUrl = 'https://host/only';
    expect(comp['validateUrlParsing']()).toBe('Malformed source url');
    comp.sourceUrl = 'https://host/owner/repo';
    expect(comp['validateUrlParsing']()).toBeUndefined();
  });

  it('changePlugin handles single and multiple plugin ids', () => {
    pluginService.pluginIds = [{ label: 'GitHub', value: 'github' }];
    pluginService.pluginList = [{ label: 'GitHub', value: 'github' }];
    const fixture = TestBed.createComponent(ConnectComponent);
    const comp: any = fixture.componentInstance;
    comp.plugin = 'github';
    comp.token = 'tok';
    comp.sourceUrl = 'https://host/owner/repo';
    comp.changePlugin();
    expect(comp.pluginId).toBe('github');
    expect(comp.token).toBeUndefined();
    expect(comp.pluginIdSelectHidden).toBeTrue();

    pluginService.pluginIds = [
      { label: 'GitHub', value: 'github' },
      { label: 'GitLab', value: 'gitlab' },
    ];
    comp.pluginId = undefined;
    comp.changePlugin();
    expect(comp.pluginId).toBeUndefined();
    expect(comp.pluginIdSelectHidden).toBeFalse();
  });

  it('resetForm clears all bindable fields and hides reset indicator', () => {
    const fixture = TestBed.createComponent(ConnectComponent);
    const comp: any = fixture.componentInstance;
    comp.plugin = 'github';
    comp.datasetId = 'doi:123';
    expect(comp.showReset).toBeTrue();
    comp.resetForm();
    expect(comp.showReset).toBeFalse();
    expect(comp.datasetId).toBeUndefined();
    expect(comp.plugins.length).toBe(0);
    expect(comp.pluginIdSelectHidden).toBeTrue();
  });
});
