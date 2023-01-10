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

  store_url = 'api/common/store';

  constructor(private http: HttpClient, private credentialsService: CredentialsService) { }

  submit(selected: Datafile[]): Observable<StoreResult> {
    let credentials = this.credentialsService.credentials;
    let req = {
      streamType: credentials.repo_type,
      streamParams: {
        repoName: credentials.repo_name,
        url: credentials.url,
        option: credentials.option,
        user: credentials.user,
        token: credentials.token,
      },
      persistentId: credentials.dataset_id,
      dataverseKey: credentials.dataverse_token,
      selectedNodes: selected,
    };

    return this.http.post<StoreResult>(this.store_url, req);
  }
}
