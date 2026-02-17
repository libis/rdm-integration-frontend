import {
  provideHttpClient,
  withInterceptorsFromDi,
} from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import {
  ActivatedRoute,
  provideRouter,
  withDisabledInitialNavigation,
} from '@angular/router';
import { of } from 'rxjs';
import { DataStateService } from '../data.state.service';
import { DatasetService } from '../dataset.service';
import { DvObjectLookupService } from '../dvobject.lookup.service';
import { Config, RepoPlugin } from '../models/plugin';
import { OauthService } from '../oauth.service';
import { PluginService } from '../plugin.service';
import { RepoLookupService } from '../repo.lookup.service';
import { ConnectValidationService } from '../shared/connect-validation.service';
import { NavigationService } from '../shared/navigation.service';
import { NotificationService } from '../shared/notification.service';
import { SnapshotStorageService } from '../shared/snapshot-storage.service';
import { ConnectComponent } from './connect.component';

const pilotPlugin = (
  plugin: Partial<RepoPlugin> &
    Pick<RepoPlugin, 'id' | 'name' | 'plugin' | 'pluginName'>,
): RepoPlugin =>
  ({
    repoNameFieldHasSearch: false,
    repoNameFieldHasInit: false,
    parseSourceUrlField: false,
    ...plugin,
  }) as RepoPlugin;

const PILOT_CONFIG: Config = {
  dataverseHeader: 'KU Leuven RDR',
  collectionOptionsHidden: true,
  createNewDatasetEnabled: true,
  datasetFieldEditable: false,
  collectionFieldEditable: false,
  externalURL: 'https://www.rdm.libis.kuleuven.be',
  showDvTokenGetter: false,
  showDvToken: true,
  redirect_uri: 'https://www.rdm.libis.kuleuven.be/integration/connect',
  sendMails: true,
  plugins: [
    pilotPlugin({
      id: 'mango',
      name: 'ManGO (KU Leuven IRODS)',
      plugin: 'irods',
      pluginName: 'IRODS/ManGO',
      optionFieldName: 'Folder',
      optionFieldPlaceholder: 'Select folder',
      optionFieldInteractive: true,
      sourceUrlFieldValue: 'kuleuven',
      repoNameFieldName: 'Zone',
      repoNameFieldPlaceholder: 'zone',
      repoNameFieldHasInit: true,
      repoNameFieldHasSearch: true,
      tokenGetter: {
        URL: 'https://idp.kuleuven.be/auth/realms/kuleuven/protocol/openid-connect/auth?scope=openid',
        oauth_client_id: 'd8c4f1b6-2a7e-4f89-9c51-64a2f7b1c3e0',
      },
    }),
    pilotPlugin({
      id: 'irods',
      name: 'Other IRODS',
      plugin: 'irods',
      pluginName: 'IRODS/ManGO',
      optionFieldName: 'Folder',
      optionFieldPlaceholder: 'Select folder',
      optionFieldInteractive: true,
      tokenFieldName: 'Token (IRODS password)',
      tokenFieldPlaceholder: 'password',
      sourceUrlFieldName: 'Hostname',
      sourceUrlFieldPlaceholder: '<hostname>:<port>',
      usernameFieldName: 'Username',
      usernameFieldPlaceholder: 'username',
      repoNameFieldName: 'Zone',
      repoNameFieldPlaceholder: 'zone',
      repoNameFieldEditable: true,
    }),
    pilotPlugin({
      id: 'kulgitlab',
      name: 'KU Leuven GitLab',
      plugin: 'gitlab',
      pluginName: 'GitLab',
      optionFieldName: 'Branch',
      optionFieldPlaceholder: 'Select branch',
      sourceUrlFieldValue: 'https://gitlab.kuleuven.be',
      repoNameFieldName: 'Repository',
      repoNameFieldPlaceholder: 'Select repository',
      repoNameFieldHasSearch: true,
      tokenGetter: {
        URL: 'https://gitlab.kuleuven.be/oauth/authorize?scope=read_api',
        oauth_client_id:
          'c7d3f26b8a9e40f3b6c1d2e7f8a4c5b7e1f2690d4b12a37c8f9e5d6027a4b1c3',
      },
    }),
    pilotPlugin({
      id: 'gitlab.com',
      name: 'gitlab.com',
      plugin: 'gitlab',
      pluginName: 'GitLab',
      optionFieldName: 'Branch',
      optionFieldPlaceholder: 'Select branch',
      sourceUrlFieldValue: 'https://gitlab.com',
      repoNameFieldName: 'Repository',
      repoNameFieldPlaceholder: 'Select repository',
      repoNameFieldHasSearch: true,
      tokenGetter: {
        URL: 'https://gitlab.com/oauth/authorize',
        oauth_client_id:
          '1f8b2c4d6e7a9f0b3c5d7e9f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b',
      },
    }),
    pilotPlugin({
      id: 'gitlab',
      name: 'Other GitLab',
      plugin: 'gitlab',
      pluginName: 'GitLab',
      optionFieldName: 'Branch',
      optionFieldPlaceholder: 'Select branch',
      tokenFieldName: 'Token',
      tokenFieldPlaceholder: 'Repository API token',
      sourceUrlFieldName: 'Source URL',
      sourceUrlFieldPlaceholder:
        'https://<gitlab_domain>/<group>/<project>.git',
      parseSourceUrlField: true,
    }),
    pilotPlugin({
      id: 'github',
      name: 'GitHub',
      plugin: 'github',
      pluginName: 'GitHub',
      optionFieldName: 'Branch',
      optionFieldPlaceholder: 'Select branch',
      sourceUrlFieldValue: 'https://github.com',
      repoNameFieldName: 'Repository',
      repoNameFieldPlaceholder: 'Select repository',
      repoNameFieldHasSearch: true,
      tokenGetter: {
        URL: 'https://github.com/login/oauth/authorize',
        oauth_client_id: 'Iv1.f3a7c9b2d6e8f0a4',
      },
    }),
    pilotPlugin({
      id: 'GBIOMED_redcap_preview',
      name: 'GBIOMED Preview RedCap',
      plugin: 'redcap',
      pluginName: 'REDCap',
      optionFieldName: 'Folder',
      optionFieldPlaceholder: 'Select folder',
      optionFieldInteractive: true,
      tokenFieldName: 'Project token',
      tokenFieldPlaceholder: 'project token',
      sourceUrlFieldValue: 'https://preview.redcap.gbiomed.kuleuven.be',
    }),
    pilotPlugin({
      id: 'redcap',
      name: 'Other REDCap',
      plugin: 'redcap',
      pluginName: 'REDCap',
      optionFieldName: 'Folder',
      optionFieldPlaceholder: 'Select folder',
      optionFieldInteractive: true,
      tokenFieldName: 'Project token',
      tokenFieldPlaceholder: 'project token',
      sourceUrlFieldName: 'Source URL',
      sourceUrlFieldPlaceholder: 'https://your.redcap.server',
    }),
    pilotPlugin({
      id: 'osf',
      name: 'OSF',
      plugin: 'osf',
      pluginName: 'OSF',
      sourceUrlFieldValue: 'https://api.osf.io',
      repoNameFieldName: 'Project/component',
      repoNameFieldPlaceholder: 'Select project/component',
      repoNameFieldHasSearch: true,
      tokenGetter: {
        URL: 'https://accounts.osf.io/oauth2/authorize?scope=osf.full_read',
        oauth_client_id: '9c2d7a5b8f1e4c6a9b3d2f4710e6c5a8',
      },
    }),
    pilotPlugin({
      id: 'onedrive',
      name: 'OneDrive',
      plugin: 'onedrive',
      pluginName: 'OneDrive and SharePoint online',
      sourceUrlFieldValue: 'https://graph.microsoft.com/v1.0',
      optionFieldName: 'Folder',
      optionFieldPlaceholder: 'Select folder',
      optionFieldInteractive: true,
      tokenGetter: {
        URL: 'https://login.microsoftonline.com/4f0f8c1a-9c42-4cce-9f8e-0b4b7a6d2c8f/oauth2/authorize?scope=onedrive.read.all',
        oauth_client_id: '5b22c8f4-1a73-4f09-b6ac-3a8d420f5c91',
      },
    }),
    pilotPlugin({
      id: 'sharepoint',
      name: 'SharePoint online',
      plugin: 'onedrive',
      pluginName: 'OneDrive and SharePoint online',
      sourceUrlFieldValue: 'https://graph.microsoft.com/v1.0',
      optionFieldName: 'Folder',
      optionFieldPlaceholder: 'Select folder',
      optionFieldInteractive: true,
      repoNameFieldName: 'Site',
      repoNameFieldPlaceholder: 'Select site',
      repoNameFieldHasSearch: true,
      tokenGetter: {
        URL: 'https://login.microsoftonline.com/d15a3a81-7f0c-4c4a-8d7d-9ab1c65f2e3c/oauth2/authorize?scope=onedrive.read.all',
        oauth_client_id: 'd7f9be3c-6a81-41c8-9d8e-5e9a12b4c3f2',
      },
    }),
    pilotPlugin({
      id: 'sftp',
      name: 'SFTP',
      plugin: 'sftp',
      pluginName: 'SFTP',
      sourceUrlFieldName: 'SFTP URL',
      sourceUrlFieldPlaceholder: 'sftp.example.org:22',
      optionFieldName: 'Folder',
      optionFieldPlaceholder: 'Select folder',
      optionFieldInteractive: true,
      usernameFieldName: 'Username',
      usernameFieldPlaceholder: 'username',
      tokenFieldName: 'Password',
      tokenFieldPlaceholder: 'password',
    }),
    pilotPlugin({
      id: 'globus',
      name: 'Globus',
      plugin: 'globus',
      pluginName: 'Globus',
      sourceUrlFieldValue: 'https://transfer.api.globusonline.org/v0.10',
      optionFieldName: 'Folder',
      optionFieldPlaceholder: 'Select folder',
      optionFieldInteractive: true,
      repoNameFieldName: 'Endpoint',
      repoNameFieldPlaceholder: 'Select endpoint',
      repoNameFieldHasSearch: true,
      tokenGetter: {
        URL: 'https://auth.globus.org/v2/oauth2/authorize?scope=urn%3Aglobus%3Aauth%3Ascope%3Atransfer.api.globus.org%3Aall+openid+email+profile&session_required_single_domain=kuleuven.be',
        oauth_client_id: '5a7d3c21-9f8b-4e6d-a2c5-7b1f9d3a6e4c',
      },
    }),
  ],
};

class DataStateServiceStub {
  initializeState(): void {}
  resetState(): void {}
  cancelInitialization(_resetState?: boolean): void {}
}

class DatasetServiceStub {
  getDatasetVersion() {
    return of({ persistentId: 'doi:10.123/XYZ' });
  }
}

class RepoLookupServiceStub {
  getOptions() {
    return of([]);
  }

  search() {
    return of([]);
  }
}

class ConnectValidationServiceStub {
  isValid() {
    return true;
  }

  gatherIssues() {
    return [];
  }

  summarizeIssues(): string | undefined {
    return undefined;
  }
}

class NavigationServiceStub {
  assign(): void {}
}

class NotificationServiceStub {
  showError(): void {}
}

class SnapshotStorageServiceStub {
  loadConnect(): unknown {
    return undefined;
  }

  saveConnect(): void {}

  clearConnect(): void {}
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

describe('ConnectComponent pilot plugin configuration', () => {
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ConnectComponent],
      providers: [
        provideRouter([], withDisabledInitialNavigation()),
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
        { provide: DataStateService, useClass: DataStateServiceStub },
        { provide: DatasetService, useClass: DatasetServiceStub },
        { provide: RepoLookupService, useClass: RepoLookupServiceStub },
        {
          provide: ConnectValidationService,
          useClass: ConnectValidationServiceStub,
        },
        { provide: NavigationService, useClass: NavigationServiceStub },
        { provide: NotificationService, useClass: NotificationServiceStub },
        {
          provide: SnapshotStorageService,
          useClass: SnapshotStorageServiceStub,
        },
        { provide: DvObjectLookupService, useClass: DvObjectLookupServiceStub },
        { provide: OauthService, useClass: OauthServiceStub },
        { provide: ActivatedRoute, useValue: { queryParams: of({}) } },
        { provide: PluginService, useClass: PluginService },
      ],
    }).compileComponents();
    httpMock = TestBed.inject(HttpTestingController);
    sessionStorage.clear();
  });

  afterEach(() => {
    httpMock.verify();
  });

  async function createComponent(): Promise<ConnectComponent> {
    // Simulate APP_INITIALIZER: load config before component creation
    const pluginService = TestBed.inject(PluginService);
    const configPromise = pluginService.setConfig();
    const req = httpMock.expectOne('api/frontend/config');
    req.flush(PILOT_CONFIG);
    await configPromise;

    const fixture = TestBed.createComponent(ConnectComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  it('exposes pilot plugin families on demand', async () => {
    const component = await createComponent();
    component.getPlugins();
    const actual = new Set(component.plugins().map((p) => p.value));
    expect(actual).toEqual(
      new Set([
        'irods',
        'gitlab',
        'github',
        'redcap',
        'osf',
        'onedrive',
        'sftp',
        'globus',
      ]),
    );
    expect(component.dataverseHeader()).toBe(PILOT_CONFIG.dataverseHeader);
  });

  it('requires explicit plugin instance selection when multiple options exist', async () => {
    const component = await createComponent();

    component.plugin.set('gitlab');
    component.changePlugin();
    component.getPluginIds();
    expect(component.pluginId()).toBeUndefined();
    expect(component.pluginIdSelectHidden()).toBeFalse();
    expect(component.pluginIds().map((i) => i.value)).toEqual([
      'kulgitlab',
      'gitlab.com',
      'gitlab',
    ]);

    component.plugin.set('github');
    component.changePlugin();
    expect(component.pluginId()).toBe('github');
    expect(component.pluginIdSelectHidden()).toBeTrue();
  });

  PILOT_CONFIG.plugins.forEach((plugin) => {
    it(`mirrors pilot configuration for plugin ${plugin.id}`, async () => {
      const component = await createComponent();
      component.plugin.set(plugin.plugin);
      component.changePlugin();
      component.pluginId.set(plugin.id);
      component.changePluginId();

      const expectBoolean = (value: unknown) => Boolean(value);

      expect(component.showRepoTokenGetter()).toBe(
        Boolean(plugin.tokenGetter?.URL),
      );
      expect(component.hasOauthConfig()).toBe(
        Boolean(plugin.tokenGetter?.oauth_client_id),
      );

      expect(component.tokenFieldName()).toBe(plugin.tokenFieldName);
      expect(component.tokenPlaceholder()).toBe(
        plugin.tokenFieldPlaceholder ?? '',
      );

      expect(component.usernameFieldName()).toBe(plugin.usernameFieldName);
      expect(component.usernamePlaceholder()).toBe(
        plugin.usernameFieldPlaceholder ?? '',
      );

      if (plugin.optionFieldName) {
        expect(component.optionFieldName()).toBe(plugin.optionFieldName);
        expect(component.optionPlaceholder()).toBe(
          plugin.optionFieldPlaceholder ?? '',
        );
      } else {
        expect(component.optionFieldName()).toBeUndefined();
        expect(component.optionPlaceholder()).toBe('');
      }
      expect(component.isOptionFieldInteractive()).toBe(
        Boolean(plugin.optionFieldInteractive),
      );

      expect(component.sourceUrlFieldName()).toBe(plugin.sourceUrlFieldName);
      expect(component.sourceUrlPlaceholder()).toBe(
        plugin.sourceUrlFieldPlaceholder ?? '',
      );
      expect(component.sourceUrlValue()).toBe(plugin.sourceUrlFieldValue);

      expect(component.repoNameFieldName()).toBe(plugin.repoNameFieldName);
      expect(component.repoNamePlaceholder()).toBe(
        plugin.repoNameFieldPlaceholder ?? '',
      );
      expect(component.repoNameFieldEditable()).toBe(
        Boolean(plugin.repoNameFieldEditable),
      );
      expect(expectBoolean(component.repoNameSearchEnabled())).toBe(
        Boolean(plugin.repoNameFieldHasSearch),
      );
      expect(expectBoolean(component.repoNameSearchInitEnabled())).toBe(
        Boolean(plugin.repoNameFieldHasInit),
      );
    });
  });
});
