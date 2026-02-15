import {
  provideHttpClient,
  withInterceptorsFromDi,
} from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { CredentialsService } from './credentials.service';
import { DataService } from './data.service';
import { ComputeRequest, Key } from './models/compare-result';

describe('DataService', () => {
  let service: DataService;
  let httpMock: HttpTestingController;
  let credentialsService: CredentialsService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(DataService);
    httpMock = TestBed.inject(HttpTestingController);
    credentialsService = TestBed.inject(CredentialsService);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should call getData with credentials', () => {
    credentialsService.setCredentials({
      pluginId: 'test-plugin',
      plugin: 'github',
      repo_name: 'test/repo',
      url: 'https://test.com',
      option: 'branch',
      user: 'testuser',
      token: 'test-token',
      dataset_id: 'doi:123',
      newly_created: false,
      dataverse_token: 'dv-token',
    });

    const mockResponse: Key = { key: 'test-key-123' };

    service.getData().subscribe((response) => {
      expect(response).toEqual(mockResponse);
    });

    const req = httpMock.expectOne('api/plugin/compare');
    expect(req.request.method).toBe('POST');
    expect(req.request.body.pluginId).toBe('test-plugin');
    expect(req.request.body.plugin).toBe('github');
    req.flush(mockResponse);
  });

  it('should call getCachedData', () => {
    const key: Key = { key: 'test-key' };
    const mockResponse = { key: 'test-key', ready: true, res: {} };

    service.getCachedData(key).subscribe((response) => {
      expect(response.key).toBe('test-key');
      expect(response.ready).toBe(true);
    });

    const req = httpMock.expectOne('api/common/cached');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(key);
    req.flush(mockResponse);
  });

  it('should call getExecutableFiles', () => {
    const pid = 'doi:123';
    const token = 'dv-token';
    const mockResponse = { id: '1', data: [] };

    service.getExecutableFiles(pid, token).subscribe((response) => {
      expect(response.id).toBe('1');
      expect(response.data).toEqual([]);
    });

    const req = httpMock.expectOne('api/common/executable');
    expect(req.request.method).toBe('POST');
    expect(req.request.body.persistentId).toBe(pid);
    expect(req.request.body.dataverseKey).toBe(token);
    req.flush(mockResponse);
  });

  it('should call checkAccessToQueue', () => {
    const pid = 'doi:123';
    const token = 'dv-token';
    const queue = 'compute-queue';
    const mockResponse = { access: true, message: 'Access granted' };

    service.checkAccessToQueue(pid, token, queue).subscribe((response) => {
      expect(response.access).toBe(true);
      expect(response.message).toBe('Access granted');
    });

    const req = httpMock.expectOne('api/common/checkaccess');
    expect(req.request.method).toBe('POST');
    expect(req.request.body.persistentId).toBe(pid);
    expect(req.request.body.dataverseKey).toBe(token);
    expect(req.request.body.queue).toBe(queue);
    req.flush(mockResponse);
  });

  it('should call compute', () => {
    const computeReq: ComputeRequest = {
      persistentId: 'doi:123',
      dataverseKey: 'dv-token',
      queue: 'test-queue',
      executable: 'test-script.sh',
      sendEmailOnSuccess: true,
    };
    const mockResponse: Key = { key: 'compute-key' };

    service.compute(computeReq).subscribe((response) => {
      expect(response).toEqual(mockResponse);
    });

    const req = httpMock.expectOne('api/common/compute');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(computeReq);
    req.flush(mockResponse);
  });

  it('should call getCachedComputeData', () => {
    const key: Key = { key: 'compute-key' };
    const mockResponse = { key: 'compute-key', ready: true, res: 'result' };

    service.getCachedComputeData(key).subscribe((response) => {
      expect(response.key).toBe('compute-key');
      expect(response.ready).toBe(true);
      expect(response.res).toBe('result');
    });

    const req = httpMock.expectOne('api/common/cachedcompute');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(key);
    req.flush(mockResponse);
  });

  it('should call getDownloadableFiles', () => {
    const pid = 'doi:123';
    const token = 'dv-token';
    const mockResponse = { id: '2', data: [] };

    service.getDownloadableFiles(pid, token).subscribe((response) => {
      expect(response.id).toBe('2');
      expect(response.data).toEqual([]);
    });

    const req = httpMock.expectOne('api/common/downloadable');
    expect(req.request.method).toBe('POST');
    expect(req.request.body.persistentId).toBe(pid);
    expect(req.request.body.dataverseKey).toBe(token);
    req.flush(mockResponse);
  });

  it('should call generateDdiCdi', () => {
    const reqBody = {
      persistentId: 'doi:ddi',
      dataverseKey: 'dv-token',
    } as any;
    const mockResponse: Key = { key: 'ddi-key' };

    service.generateDdiCdi(reqBody).subscribe((response) => {
      expect(response).toEqual(mockResponse);
    });

    const req = httpMock.expectOne('api/common/ddicdi');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(reqBody);
    req.flush(mockResponse);
  });

  it('should call getCachedDdiCdiData', () => {
    const key: Key = { key: 'ddi-key' };
    const mockResponse = { key: 'ddi-key', ready: true, res: 'result' };

    service.getCachedDdiCdiData(key).subscribe((response) => {
      expect(response.key).toBe('ddi-key');
      expect(response.ready).toBeTrue();
    });

    const req = httpMock.expectOne('api/common/cachedddicdi');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(key);
    req.flush(mockResponse);
  });

  it('should call getDdiCdiCompatibleFiles', () => {
    const pid = 'doi:compatible';
    const token = 'dv-token';
    const mockResponse = { id: 'cmp', data: [] };

    service.getDdiCdiCompatibleFiles(pid, token).subscribe((response) => {
      expect(response.id).toBe('cmp');
    });

    const req = httpMock.expectOne('api/common/ddicdicompatible');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      persistentId: pid,
      dataverseKey: token,
    });
    req.flush(mockResponse);
  });

  it('should call getCachedDdiCdiOutput', () => {
    const pid = 'doi:output';
    const mockResponse = { data: { ok: true } };

    service.getCachedDdiCdiOutput(pid).subscribe((response) => {
      expect(response).toEqual(mockResponse as any);
    });

    const req = httpMock.expectOne('api/common/cachedddicdioutput');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ persistentId: pid });
    req.flush(mockResponse);
  });

  it('should call addFileToDataset', () => {
    const addReq = {
      persistentId: 'doi:add',
      dataverseKey: 'dv-token',
      filePid: 'file-1',
    } as any;
    const mockResponse = { message: 'ok' };

    service.addFileToDataset(addReq).subscribe((response) => {
      expect(response).toEqual(mockResponse as any);
    });

    const req = httpMock.expectOne('api/common/addfile');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(addReq);
    req.flush(mockResponse);
  });

  it('should call getUserInfo', () => {
    service.getUserInfo().subscribe((response) => {
      expect(response.loggedIn).toBeTrue();
    });

    const req = httpMock.expectOne('api/common/userinfo');
    expect(req.request.method).toBe('GET');
    req.flush({ loggedIn: true });
  });

  it('should call getGlobusDownloadParams with X-Dataverse-key when preview token is provided', () => {
    service
      .getGlobusDownloadParams(
        'https://dv.example',
        '123',
        'download-1',
        'preview-token',
      )
      .subscribe();

    const req = httpMock.expectOne(
      'https://dv.example/api/datasets/123/globusDownloadParameters?downloadId=download-1',
    );
    expect(req.request.method).toBe('GET');
    expect(req.request.headers.get('X-Dataverse-key')).toBe('preview-token');
    req.flush({ data: { queryParameters: {} } });
  });

  it('should call getGlobusDownloadParams without X-Dataverse-key when preview token is missing', () => {
    service
      .getGlobusDownloadParams('https://dv.example', '123', 'download-1')
      .subscribe();

    const req = httpMock.expectOne(
      'https://dv.example/api/datasets/123/globusDownloadParameters?downloadId=download-1',
    );
    expect(req.request.method).toBe('GET');
    expect(req.request.headers.has('X-Dataverse-key')).toBeFalse();
    req.flush({ data: { queryParameters: {} } });
  });
});
