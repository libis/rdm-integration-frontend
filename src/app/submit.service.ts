// Author: Eryk Kulikowski @ KU Leuven (2023). Apache 2.0 License

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

  submit(selected: Datafile[], sendEmailOnSuccess: boolean): Observable<StoreResult> {
    const credentials = this.credentialsService.credentials;
    const req = {
      plugin: credentials.plugin,
      streamParams: {
        pluginId: credentials.pluginId,
        repoName: credentials.repo_name,
        url: credentials.url,
        option: credentials.option,
        user: credentials.user,
        token: credentials.token,
      },
      persistentId: credentials.dataset_id,
      dataverseKey: credentials.dataverse_token,
      selectedNodes: selected,
      sendEmailOnSuccess: sendEmailOnSuccess,
    };

    return this.http.post<StoreResult>(this.store_url, req);
  }
}
