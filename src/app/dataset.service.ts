// Author: Eryk Kulikowski @ KU Leuven (2023). Apache 2.0 License

import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  DatasetVersionResponse,
  NewDatasetResponse,
} from './models/new-dataset-response';
import { MetadataRequest } from './models/metadata-request';
import { Metadata } from './models/field';

@Injectable({
  providedIn: 'root',
})
export class DatasetService {
  private http = inject(HttpClient);

  new_dataset_url = 'api/common/newdataset';
  dataset_version_url = 'api/common/datasetversion';
  metadata_url = 'api/common/metadata';

  constructor() {}

  newDataset(
    collectionId: string,
    apiToken?: string,
    metadata?: Metadata,
  ): Observable<NewDatasetResponse> {
    const req = {
      collectionId: collectionId,
      dataverseKey: apiToken,
      metadata: metadata,
    };

    return this.http.post<NewDatasetResponse>(this.new_dataset_url, req);
  }

  getDatasetVersion(
    datasetDbId: string,
    apiToken?: string,
  ): Observable<DatasetVersionResponse> {
    const req = {
      datasetDbId: datasetDbId,
      dataverseKey: apiToken,
    };

    return this.http.post<DatasetVersionResponse>(
      this.dataset_version_url,
      req,
    );
  }

  getMetadata(req: MetadataRequest): Observable<Metadata> {
    return this.http.post<Metadata>(this.metadata_url, req);
  }
}
