import { Injectable } from '@angular/core';
import { StoreResult } from './models/store-result';
import { HttpClient } from '@angular/common/http';
import { Datafile } from './models/datafile';
import { Observable } from 'rxjs';
import { CredentialsService } from './credentials.service';

@Injectable({
  providedIn: 'root'
})
export class SubmitService {

  github_store_url = 'api/github/store';

  constructor(private http: HttpClient, private credentialsService: CredentialsService) { }

  submit(selected: Datafile[]): Observable<StoreResult> {
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
          selectedNodes: selected,
        };
        url = this.github_store_url;
        break;

      default:
        break;
    }

    return this.http.post<StoreResult>(url, req);
  }
}
