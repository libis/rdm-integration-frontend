import {
  provideHttpClient,
  withInterceptorsFromDi,
} from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Config } from './models/plugin';
import { PluginService } from './plugin.service';

describe('PluginService', () => {
  let service: PluginService;
  let httpMock: HttpTestingController;

  function mockConfig(partial?: Partial<Config>): Config {
    return {
      dataverseHeader: 'Header',
      collectionOptionsHidden: false,
      createNewDatasetEnabled: true,
      datasetFieldEditable: true,
      collectionFieldEditable: true,
      externalURL: 'http://x',
      showDvTokenGetter: true,
      showDvToken: true,
      redirect_uri: 'http://redirect',
      sendMails: true,
      plugins: [
        {
          id: 'globus',
          plugin: 'globus',
          name: 'Globus Repo',
          pluginName: 'Globus',
          parseSourceUrlField: false,
          repoNameFieldHasSearch: true,
          repoNameFieldHasInit: true,
          showTokenGetter: false,
          tokenGetter: { URL: '/t', oauth_client_id: 'abc' },
        },
        {
          id: 'git1',
          plugin: 'git',
          name: 'Git Repo 1',
          pluginName: 'Git',
          parseSourceUrlField: false,
          repoNameFieldHasSearch: false,
          repoNameFieldHasInit: false,
          showTokenGetter: false,
        },
      ],
      ...partial,
    } as Config;
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(PluginService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('setConfig maps plugins and marks showTokenGetter', async () => {
    const cfg = mockConfig();
    const promise = service.setConfig();
    httpMock.expectOne('api/frontend/config').flush(cfg);
    await promise;
    expect(service.getGlobusPlugin()).toBeTruthy();
    // plugin id lookup
    const gitIds = service.getPluginIds('git').map((x) => x.value);
    expect(gitIds).toContain('git1');
  });

  it('getPlugin returns default when unknown', () => {
    const p = service.getPlugin('doesnotexist');
    expect(p.id).toBe('defaultPlugin');
  });

  it('provides plugin metadata after config including token getter flags', async () => {
    const cfg = mockConfig({
      showDvTokenGetter: false,
      showDvToken: false,
      plugins: [
        {
          id: 'globus',
          plugin: 'globus',
          name: 'Globus Repo',
          pluginName: 'Globus',
          parseSourceUrlField: false,
          repoNameFieldHasSearch: true,
          repoNameFieldHasInit: true,
          showTokenGetter: false,
          tokenGetter: { URL: '/t', oauth_client_id: 'abc' },
        },
        {
          id: 'git-full',
          plugin: 'git',
          name: 'Git Repo With Token Getter',
          pluginName: 'Git',
          parseSourceUrlField: false,
          repoNameFieldHasSearch: false,
          repoNameFieldHasInit: false,
          showTokenGetter: false,
          tokenGetter: { URL: '/token' },
        },
        {
          id: 'git-empty',
          plugin: 'git',
          name: 'Git Repo Without Token Getter URL',
          pluginName: 'Git',
          parseSourceUrlField: false,
          repoNameFieldHasSearch: false,
          repoNameFieldHasInit: false,
          showTokenGetter: false,
          tokenGetter: { URL: '' },
        },
        {
          id: 'svn-plugin',
          plugin: 'svn',
          name: 'SVN Repo',
          pluginName: 'SVN',
          parseSourceUrlField: false,
          repoNameFieldHasSearch: false,
          repoNameFieldHasInit: false,
          showTokenGetter: false,
        },
      ],
    });

    const promise = service.setConfig();
    httpMock.expectOne('api/frontend/config').flush(cfg);
    await promise;

    expect(service.showDVTokenGetter()).toBeFalse();
    expect(service.showDVToken()).toBeFalse();
    expect(service.getRedirectUri()).toBe('http://redirect');

    const pluginValues = service.getPlugins().map((item) => item.value);
    expect(pluginValues).toEqual(['globus', 'git', 'svn']);

    const gitIds = service.getPluginIds('git').map((id) => id.value);
    expect(gitIds).toEqual(['git-full', 'git-empty']);
    expect(service.getPluginIds('svn').map((id) => id.value)).toEqual([
      'svn-plugin',
    ]);
    expect(service.getPluginIds('unknown')).toEqual([]);

    expect(service.getPlugin('git-full').showTokenGetter).toBeTrue();
    expect(service.getPlugin('git-empty').showTokenGetter).toBeFalse();
    expect(service.getPlugin('svn-plugin').showTokenGetter).toBeFalse();
  });

  it('getter methods return expected defaults before config loaded', () => {
    // using default internal config
    expect(service.collectionOptionsHidden()).toBeTrue();
    expect(service.createNewDatasetEnabled()).toBeFalse();
    expect(service.datasetFieldEditable()).toBeFalse();
    expect(service.collectionFieldEditable()).toBeFalse();
    expect(service.showDVToken()).toBeTrue();
  });

  it('getQueues filters by extension and exposes header/mails', async () => {
    const cfg = mockConfig({
      queues: [
        { label: 'text', value: 'q1', fileExtensions: ['.txt', '.md'] },
        { label: 'bin', value: 'q2', fileExtensions: ['.bin'] },
      ],
    });
    const promise = service.setConfig();
    httpMock.expectOne('api/frontend/config').flush(cfg);
    await promise;
    const q = service.getQueues('.md');
    expect(q.length).toBe(1);
    expect(q[0].value).toBe('q1');
    expect(service.dataverseHeader()).toBe('Header');
    expect(service.sendMails()).toBeTrue();
  });

  it('getQueues returns empty array when queues not configured', () => {
    expect(service.getQueues('.zip')).toEqual([]);
  });
});
