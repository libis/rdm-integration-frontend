import { Injectable } from '@angular/core';
import { CachedResponse, Key } from './models/compare-result';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { CredentialsService } from './credentials.service';

@Injectable({
  providedIn: 'root'
})
export class DataService {

  compare_url = 'api/plugin/compare';
  common_get_cached_data_url = 'api/common/cached';

  constructor(private http: HttpClient, private credentialsService: CredentialsService) { }

  getData(): Observable<Key> {
    let credentials = this.credentialsService.credentials;
    let req = {
      repoType: credentials.repo_type,
      repoName: credentials.repo_name,
      url: credentials.url,
      option: credentials.option,
      user: credentials.user,
      token: credentials.token,
      datasetId: credentials.dataset_id,
      dataverseKey: credentials.dataverse_token,
    };

    return this.http.post<Key>(this.compare_url, req);
  }

  getCachedData(key: Key): Observable<CachedResponse> {
    return this.http.post<CachedResponse>(this.common_get_cached_data_url, key);
  }

}
