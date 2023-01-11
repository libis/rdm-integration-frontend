import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { NewDatasetResponse } from './models/new-dataset-response';

@Injectable({
  providedIn: 'root'
})
export class DatasetService {

  new_dataset_url = 'api/common/newdataset';

  constructor(private http: HttpClient) { }

  newDataset(collectionId: string, apiToken: string): Observable<NewDatasetResponse> {
    let req = {
      collectionId: collectionId,
      dataverseKey: apiToken,
    };

    return this.http.post<NewDatasetResponse>(this.new_dataset_url, req);
  }
}
