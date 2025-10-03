import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { PluginService } from './plugin.service';
import { Config } from './models/plugin';

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

  it('isStoreDvToken returns false if undefined', () => {
    // storeDvToken missing from default config => false
    expect(service.isStoreDvToken()).toBeFalse();
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
});
