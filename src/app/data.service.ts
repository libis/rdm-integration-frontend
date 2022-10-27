import { Injectable } from '@angular/core';
import { CachedResponse, Key } from './models/compare-result';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { CredentialsService } from './credentials.service';

@Injectable({
  providedIn: 'root'
})
export class DataService {

  github_compare_url = 'api/github/compare';
  common_get_cached_data_url = 'api/common/cached';

  constructor(private http: HttpClient, private credentialsService: CredentialsService) { }

  getData(): Observable<Key> {
    let credentials = this.credentialsService.credentials;
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

    return this.http.post<Key>(url, req);
  }

  getCachedData(key: Key): Observable<CachedResponse> {
    return this.http.post<CachedResponse>(this.common_get_cached_data_url, key);
  }

}
