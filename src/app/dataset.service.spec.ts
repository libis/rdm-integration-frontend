import {
    provideHttpClient,
    withInterceptorsFromDi,
} from '@angular/common/http';
import {
    HttpTestingController,
    provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { DatasetService } from './dataset.service';
import { DatasetVersionResponse, NewDatasetResponse } from './models/new-dataset-response';

describe('DatasetService', () => {
  let service: DatasetService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(DatasetService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should call newDataset', () => {
    const collectionId = 'root';
    const apiToken = 'test-token';
    const metadata: any = { datasetVersion: { metadataBlocks: {} } };
    const mockResponse: NewDatasetResponse = {
      persistentId: 'doi:10.123/test'
    };

    service.newDataset(collectionId, apiToken, metadata).subscribe((response) => {
      expect(response.persistentId).toBe('doi:10.123/test');
    });

    const req = httpMock.expectOne('api/common/newdataset');
    expect(req.request.method).toBe('POST');
    expect(req.request.body.collectionId).toBe(collectionId);
    expect(req.request.body.dataverseKey).toBe(apiToken);
    expect(req.request.body.metadata).toEqual(metadata);
    req.flush(mockResponse);
  });

  it('should call getDatasetVersion', () => {
    const datasetDbId = '123';
    const apiToken = 'test-token';
    const mockResponse: DatasetVersionResponse = {
      persistentId: 'doi:10.123/test'
    };

    service.getDatasetVersion(datasetDbId, apiToken).subscribe((response) => {
      expect(response.persistentId).toBe('doi:10.123/test');
    });

    const req = httpMock.expectOne('api/common/datasetversion');
    expect(req.request.method).toBe('POST');
    expect(req.request.body.datasetDbId).toBe(datasetDbId);
    expect(req.request.body.dataverseKey).toBe(apiToken);
    req.flush(mockResponse);
  });

  it('should call getMetadata', () => {
    const metadataReq: any = {
      pluginId: 'github',
      plugin: 'github',
      repoName: 'test/repo',
      option: 'main',
      user: 'testuser',
      token: 'test-token',
      compareResult: {}
    };
    const mockResponse: any = {
      datasetVersion: {
        metadataBlocks: {}
      }
    };

    service.getMetadata(metadataReq).subscribe((response) => {
      expect(response.datasetVersion).toBeDefined();
    });

    const req = httpMock.expectOne('api/common/metadata');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(metadataReq);
    req.flush(mockResponse);
  });
});
