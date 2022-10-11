import { Injectable } from '@angular/core';
import { CompareResult } from './models/compare-result';
import { StoreResult } from './models/store-result';
import { Credentials } from './models/credentials';
import { HttpClient } from '@angular/common/http';
import { Datafile, Fileaction } from './models/datafile';
import { map, Observable } from 'rxjs';
import { NewDatasetResponse } from './models/new-dataset-response';

@Injectable({
  providedIn: 'root'
})
export class DataService {

  compare_result: CompareResult = {};

  github_compare_url = 'api/github/compare';
  github_store_url = 'api/github/store';
  new_dataset_url = 'api/common/newdataset';

  constructor(private http: HttpClient) { }

  getData(credentials: Credentials): Observable<CompareResult> {
    var req;
    var url = '';
    switch (credentials.repo_type) {
      case "github":
        req = {
          ghToken: credentials.repo_token,
          ghUser: credentials.repo_owner,
          repo: credentials.repo_name,
          hash: credentials.repo_branch,
          persistentId: credentials.dataset_id,
          dataverseKey: credentials.dataverse_token,
        };
        url = this.github_compare_url;
        break;

      default:
        break;
    }

    return this.http.post<CompareResult>(url, req).pipe(
      map((res: CompareResult) => {
        res.data = res.data?.sort((o1, o2) => (o1.id === undefined ? "" : o1.id) < (o2.id === undefined ? "" : o2.id) ? -1 : 1);
        this.compare_result = res;
        return this.compare_result;
    }));
  }

  submit(credentials: Credentials, selected: Datafile[]): Observable<StoreResult> {
    var req;
    var url = '';
    switch (credentials.repo_type) {
      case "github":
        req = {
          ghToken: credentials.repo_token,
          ghUser: credentials.repo_owner,
          repo: credentials.repo_name,
          hash: credentials.repo_branch,
          persistentId: credentials.dataset_id,
          dataverseKey: credentials.dataverse_token,
          selectedNodes: selected,
        };
        url = this.github_store_url;
        break;

      default:
        break;
    }

    return this.http.post<StoreResult>(url, req);
  }

  newDataset(apiToken: string): Observable<NewDatasetResponse> {
    let req = {
      dataverse: 'rdr',
      dataverseKey: apiToken,
    };

    return this.http.post<NewDatasetResponse>(this.new_dataset_url, req);
  }
}
