// Author: Eryk Kulikowski @ KU Leuven (2023). Apache 2.0 License

import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { DatasetVersionResponse, NewDatasetResponse } from './models/new-dataset-response';

@Injectable({
  providedIn: 'root'
})
export class DatasetService {

  new_dataset_url = 'api/common/newdataset';
  dataset_version_url = 'api/common/version';

  constructor(private http: HttpClient) { }

  newDataset(collectionId: string, apiToken?: string): Observable<NewDatasetResponse> {
    const req = {
      collectionId: collectionId,
      dataverseKey: apiToken,
    };

    return this.http.post<NewDatasetResponse>(this.new_dataset_url, req);
  }

  getDatasetVersion(datasetDbId: string, apiToken?: string): Observable<DatasetVersionResponse> {
    const req = {
      datasetDbId: datasetDbId,
      dataverseKey: apiToken,
    };

    return this.http.post<NewDatasetResponse>(this.dataset_version_url, req);
  }
}
