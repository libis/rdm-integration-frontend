import { TestBed } from '@angular/core/testing';
import { CredentialsService } from './credentials.service';

describe('CredentialsService', () => {
  let service: CredentialsService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(CredentialsService);
  });

  it('setCredentials should update all computed signals', () => {
    service.setCredentials({
      plugin: 'globus',
      pluginId: 'globus',
      repo_name: 'endpoint-A',
      url: 'https://example.org',
      option: '/folder',
      user: 'u1',
      token: 'tok-1',
      dataset_id: 'doi:10.1234/ABC',
      newly_created: false,
      dataverse_token: 'dv-1',
      metadata_available: true,
    });

    expect(service.plugin$()).toBe('globus');
    expect(service.pluginId$()).toBe('globus');
    expect(service.repoName$()).toBe('endpoint-A');
    expect(service.url$()).toBe('https://example.org');
    expect(service.option$()).toBe('/folder');
    expect(service.user$()).toBe('u1');
    expect(service.token$()).toBe('tok-1');
    expect(service.datasetId$()).toBe('doi:10.1234/ABC');
    expect(service.newlyCreated$()).toBeFalse();
    expect(service.dataverseToken$()).toBe('dv-1');
    expect(service.metadataAvailable$()).toBeTrue();
  });

  it('updateCredentials should patch existing values only', () => {
    service.setCredentials({
      plugin: 'globus',
      pluginId: 'globus',
      repo_name: 'endpoint-A',
    });

    service.updateCredentials({
      repo_name: 'endpoint-B',
      option: '/new-path',
    });

    expect(service.plugin$()).toBe('globus');
    expect(service.repoName$()).toBe('endpoint-B');
    expect(service.option$()).toBe('/new-path');
  });

  it('clearCredentials should reset state', () => {
    service.setCredentials({
      plugin: 'globus',
      pluginId: 'globus',
      repo_name: 'endpoint-A',
    });

    service.clearCredentials();

    expect(service.credentials$()).toEqual({});
    expect(service.plugin$()).toBeUndefined();
    expect(service.repoName$()).toBeUndefined();
  });
});
